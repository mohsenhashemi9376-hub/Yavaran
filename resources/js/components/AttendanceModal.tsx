import { closedReasonMessage, normalizeShamsi } from '../utils/schoolCalendar';
import { isFutureShamsi } from '../utils/validators';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSchool } from '../context/SchoolContext';
import {
  AttendanceSession,
  AttendanceStatus,
  HomeworkStatus,
  StudentAttendanceRecord,
  Student,
  SchoolClass,
} from '../types';
import { getTodayShamsi, getDayOfWeekFromShamsi, toPersianDigits, toEnglishDigits, shamsiStringToDate, dateToShamsiString } from '../utils/persianDate';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { subjectAppliesToClass } from '../utils/courseAssignments';
import { compareByLastName } from '../utils/morningAttendance';
import { NotebookPen, X, Check, Clock, UserX, ShieldAlert, Trash2, MoreHorizontal, Loader2, BookOpen, AlertCircle } from 'lucide-react';
import { studentFullName } from '../utils/studentName';
import { previousCourseSession } from '../utils/homework';
import {
  ActiveAttendance,
  clearAttendanceDraft,
  loadAttendanceDraft,
  saveActiveAttendance,
  saveAttendanceDraft,
} from '../utils/attendanceDraft';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetClassId?: string;
  targetSubject?: string;
  existingSession?: AttendanceSession | null;
  onSelectStudent?: (student: Student) => void;
  /** بازگشت به فهرستی که پیش از خاموش‌شدن صفحه / بارگذاری دوباره باز بوده */
  resume?: ActiveAttendance | null;
}

/** یک «درس تخصیص‌یافته به کلاس» (Subject-Class Assignment) — واحد اصلی ثبت حضور و غیاب */
interface CourseOption {
  key: string;
  classId: string;
  className: string;
  subjectId?: string;
  subjectName: string;
  hoursPerWeek: number;
}

const ORDINALS = ['اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم'];
const MAX_PERIODS = ORDINALS.length;
const periodLabel = (n: number) => `زنگ ${ORDINALS[n - 1] ?? toPersianDigits(n)}`;

const WARNING_KINDS: { label: string; type: 'behavior' | 'other' }[] = [
  { label: 'عدم انجام تکلیف', type: 'other' },
  { label: 'بی‌انضباطی کلاسی', type: 'behavior' },
  { label: 'عدم همراه داشتن کتاب', type: 'other' },
  { label: 'تذکر درسی', type: 'other' },
];

const sameSubject = (a: { subjectId?: string; subjectName: string }, subjectId: string | undefined, subjectName: string) =>
  a.subjectId && subjectId ? a.subjectId === subjectId : a.subjectName === subjectName;

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  onClose,
  targetClassId,
  targetSubject,
  existingSession,
  onSelectStudent,
  resume,
}) => {
  const {
    currentUser,
    accessibleClasses,
    classes,
    sessionClasses,
    myWorkshopClasses,
    workshopAssignments,
    studentsOfClass,
    academicSubjects,
    bellPeriods,
    students,
    sessions,
    saveAttendanceSession,
    addDisciplinaryNote,
    showToast,
    showConfirm,
    closedReasonOf,
    schoolHolidays,
  } = useSchool();

  // جمعه یا روز تعطیل اعلام‌شده: لیست حضور و غیاب باز نمی‌شود


  const todayInfo = getTodayShamsi();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // انتخاب درس و کلاس + زنگ جلسه
  const [courseKey, setCourseKey] = useState<string>('');
  const [periodNumber, setPeriodNumber] = useState<number>(1);
  const [date, setDate] = useState<string>(todayInfo.formattedDate);
  const [editingSessionId, setEditingSessionId] = useState<string | undefined>(undefined);

  // محتوای جلسه
  const [lessonTopic, setLessonTopic] = useState<string>('');
  const [topicError, setTopicError] = useState<string>('');
  const [homeworkDescription, setHomeworkDescription] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [showSessionNotes, setShowSessionNotes] = useState(false);
  const [records, setRecords] = useState<Record<string, StudentAttendanceRecord>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  /** امضای وضعیت بارگذاری‌شده؛ فقط تغییر نسبت به آن به‌عنوان پیش‌نویس ذخیره می‌شود */
  const baselineRef = useRef<string | null>(null);
  const topicRef = useRef<HTMLInputElement>(null);

  // پاپ‌آپ ثبت اخطار کلاسی
  const [warningStudent, setWarningStudent] = useState<Student | null>(null);
  const [warningKind, setWarningKind] = useState<string>(WARNING_KINDS[0].label);
  const [warningNote, setWarningNote] = useState<string>('');
  const [warningDeduction, setWarningDeduction] = useState<number>(0.5);

  // ------------------------------------------------------------------
  // فهرست «درس • کلاس» های قابل ثبت برای کاربر جاری
  // ------------------------------------------------------------------
  const courseOptions = useMemo<CourseOption[]>(() => {
    const ownOnly = currentUser.role === 'vice_nurturing' || currentUser.role === 'coach';
    const basePool: SchoolClass[] = accessibleClasses.length > 0 ? accessibleClasses : classes;
    const pool: SchoolClass[] = [...basePool, ...myWorkshopClasses.filter((w) => !basePool.some((c) => c.id === w.id))];
    const poolById = new Map(pool.map((c) => [c.id, c]));
    const list: CourseOption[] = [];
    const push = (cls: SchoolClass, subjectId: string | undefined, subjectName: string) => {
      const subject = academicSubjects.find((s) => (subjectId ? s.id === subjectId : s.name === subjectName));
      const key = `${cls.id}|${subject?.id ?? subjectId ?? subjectName}`;
      if (list.some((o) => o.key === key)) return;
      list.push({
        key,
        classId: cls.id,
        className: cls.name,
        subjectId: subject?.id ?? subjectId,
        subjectName: subject?.name ?? subjectName,
        hoursPerWeek: cls.isWorkshop ? 1 : subject?.hoursPerWeek && subject.hoursPerWeek > 0 ? Math.round(subject.hoursPerWeek) : 2,
      });
    };

    const assignments = currentUser.teachingAssignments || [];
    if (assignments.length > 0) {
      assignments.forEach((a) =>
        a.classIds.forEach((cid) => {
          const cls = poolById.get(cid);
          if (cls) push(cls, a.subjectId, a.subjectName);
        })
      );
    } else if (ownOnly) {
      // معاون تربیتی و مربی فقط کلاس‌هایی را می‌بینند که خودشان تدریس می‌کنند (نه همه‌ی کلاس‌های مدرسه)
      const own = new Set(currentUser.teachingClassIds || []);
      const names = String(currentUser.teachingSubject || currentUser.subject || '').split(/[،,]/).map((n) => n.trim()).filter(Boolean);
      pool
        .filter((cls) => !cls.isWorkshop && own.has(cls.id))
        .forEach((cls) => {
          if (names.length === 0) push(cls, undefined, 'درس عمومی');
          names.forEach((n) => push(cls, academicSubjects.find((sub) => sub.name === n)?.id, n));
        });
    } else {
      // مدیر/معاونین: همه دروس مرتبط با کلاس‌های قابل دسترس
      pool
        .filter((cls) => !cls.isWorkshop)
        .forEach((cls) =>
          academicSubjects.filter((sub) => subjectAppliesToClass(sub, cls)).forEach((sub) => push(cls, sub.id, sub.name))
        );
    }
    // کارگاه‌ها: هر کارگاه یک درس با ظرفیت یک جلسه در هفته
    workshopAssignments.forEach((a) =>
      a.classIds.forEach((cid) => {
        const cls = poolById.get(cid);
        if (cls) push(cls, a.subjectId, a.subjectName);
      })
    );
    if (!currentUser.teachingAssignments?.length || currentUser.role === 'admin' || currentUser.role.startsWith('vice')) {
      myWorkshopClasses.forEach((cls) => {
        if (!list.some((o) => o.classId === cls.id)) push(cls, `ws-subject-${cls.id}`, cls.name);
      });
    }

    // سازگاری: کلاس/درس ارسالی از بیرون یا جلسه در حال ویرایش
    if (existingSession) {
      const cls = sessionClasses.find((c) => c.id === existingSession.classId);
      if (cls) push(cls, existingSession.subjectId, existingSession.subject);
    }
    if (targetClassId) {
      const cls = poolById.get(targetClassId) || sessionClasses.find((c) => c.id === targetClassId);
      if (cls && !list.some((o) => o.classId === targetClassId)) {
        push(cls, undefined, targetSubject || currentUser.subject || 'درس عمومی');
      }
    }
    if (list.length === 0 && !ownOnly) {
      pool.filter((c) => !c.isWorkshop).forEach((cls) => push(cls, undefined, targetSubject || currentUser.subject || 'درس عمومی'));
    }
    return list;
  }, [accessibleClasses, classes, sessionClasses, myWorkshopClasses, workshopAssignments, academicSubjects, currentUser, existingSession, targetClassId, targetSubject]);

  const course = courseOptions.find((o) => o.key === courseKey) || courseOptions[0];

  // تعداد زنگ‌ها دقیقاً برابر ساعات هفتگی درس
  const periodCount = Math.min(
    MAX_PERIODS,
    Math.max(course?.hoursPerWeek ?? 1, existingSession?.periodNumber && course ? existingSession.periodNumber : 1)
  );
  const periodChoices = Array.from({ length: periodCount }, (_, i) => i + 1);

  const classStudents = useMemo(
    () => (course ? studentsOfClass(course.classId) : []).slice().sort(compareByLastName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, course?.classId, sessionClasses]
  );

  // وضعیت «انجام شده / ناقص / انجام نشده» مربوط به تکلیف جلسه قبل همین درس است
  const prevSession = useMemo(
    () =>
      course
        ? previousCourseSession(sessions, {
            id: editingSessionId || '',
            classId: course.classId,
            subjectId: course.subjectId,
            subject: course.subjectName,
            date,
            periodNumber,
          })
        : undefined,
    [sessions, course, date, periodNumber, editingSessionId]
  );

  const findSlotSession = (opt: CourseOption | undefined, period: number, forDate: string) =>
    opt
      ? sessions.find(
          (s) =>
            s.classId === opt.classId &&
            s.date === forDate &&
            (s.periodNumber ?? 1) === period &&
            sameSubject(opt, s.subjectId, s.subject)
        )
      : undefined;

  const freshRecords = (classId: string): Record<string, StudentAttendanceRecord> => {
    const initial: Record<string, StudentAttendanceRecord> = {};
    studentsOfClass(classId)
      .forEach((st) => {
        initial[st.id] = { studentId: st.id, status: 'present' };
      });
    return initial;
  };

  const formSignature = (topic: string, homework: string, notes: string, recs: Record<string, StudentAttendanceRecord>) =>
    JSON.stringify([topic, homework, notes, recs]);

  /** بارگذاری یک زنگ مشخص: اگر قبلاً ثبت شده باشد برای ویرایش بازخوانی می‌شود؛ پیش‌نویس ذخیره‌شده بر هر دو مقدم است */
  const loadSlot = (opt: CourseOption | undefined, period: number, forDate: string) => {
    if (!opt) return;
    const existing = findSlotSession(opt, period, forDate);
    setTopicError('');
    setExpandedId(null);
    let topic = '';
    let homework = '';
    let notes = '';
    let recs = freshRecords(opt.classId);
    if (existing) {
      topic = existing.lessonTopic || '';
      homework = existing.homeworkDescription || '';
      notes = existing.sessionNotes || '';
      recs = { ...recs, ...(existing.records || {}) };
    }
    setEditingSessionId(existing?.id);
    baselineRef.current = formSignature(topic, homework, notes, recs);

    const draft = loadAttendanceDraft(currentUser.id, opt.key, forDate, period);
    if (draft) {
      topic = draft.lessonTopic;
      homework = draft.homeworkDescription;
      notes = draft.sessionNotes;
      recs = { ...recs, ...draft.records };
    }
    setDraftRestored(Boolean(draft) && formSignature(topic, homework, notes, recs) !== baselineRef.current);
    setLessonTopic(topic);
    setHomeworkDescription(homework);
    setSessionNotes(notes);
    setShowSessionNotes(Boolean(homework || notes));
    setRecords(recs);
  };

  /** دور ریختن پیش‌نویس و بازگشت به وضعیت ثبت‌شده (یا فرم خالی) */
  const discardDraft = () => {
    if (!course) return;
    clearAttendanceDraft(currentUser.id, course.key, date, periodNumber);
    loadSlot(course, periodNumber, date);
  };

  // مقداردهی اولیه هنگام باز شدن
  useEffect(() => {
    if (!isOpen) return;
    setShowExitConfirm(false);
    setWarningStudent(null);

    if (existingSession) {
      const opt =
        courseOptions.find(
          (o) => o.classId === existingSession.classId && sameSubject(o, existingSession.subjectId, existingSession.subject)
        ) || courseOptions.find((o) => o.classId === existingSession.classId);
      setCourseKey(opt?.key || '');
      setPeriodNumber(existingSession.periodNumber || 1);
      setDate(existingSession.date);
      loadSlot(opt, existingSession.periodNumber || 1, existingSession.date);
      return;
    }

    const resumed = resume ? courseOptions.find((o) => o.key === resume.courseKey) : undefined;
    if (resume && resumed) {
      setCourseKey(resumed.key);
      setPeriodNumber(resume.period);
      setDate(resume.date);
      loadSlot(resumed, resume.period, resume.date);
      return;
    }

    const preferred =
      courseOptions.find(
        (o) => o.classId === targetClassId && (!targetSubject || o.subjectName === targetSubject)
      ) ||
      courseOptions.find((o) => o.classId === targetClassId) ||
      courseOptions[0];
    setCourseKey(preferred?.key || '');
    setPeriodNumber(1);
    setDate(todayInfo.formattedDate);
    loadSlot(preferred, 1, todayInfo.formattedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, existingSession?.id, targetClassId, targetSubject, resume?.updatedAt]);

  // ذخیره‌ی لحظه‌ای پیش‌نویس: هر تغییر بلافاصله روی دستگاه نوشته می‌شود تا با خاموش‌شدن صفحه از بین نرود
  useEffect(() => {
    if (!isOpen || !course || baselineRef.current === null) return;
    if (formSignature(lessonTopic, homeworkDescription, sessionNotes, records) === baselineRef.current) {
      clearAttendanceDraft(currentUser.id, course.key, date, periodNumber);
      return;
    }
    saveAttendanceDraft(currentUser.id, course.key, date, periodNumber, { lessonTopic, homeworkDescription, sessionNotes, records });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, course?.key, date, periodNumber, lessonTopic, homeworkDescription, sessionNotes, records]);

  // یادآوری فهرست باز، برای بازگشت به همان فهرست پس از بارگذاری دوباره‌ی برنامه
  useEffect(() => {
    if (!isOpen || !course) return;
    saveActiveAttendance(currentUser.id, {
      classId: course.classId,
      subject: course.subjectName,
      courseKey: course.key,
      period: periodNumber,
      date,
      sessionId: editingSessionId,
    });
  }, [isOpen, course?.key, course?.classId, course?.subjectName, periodNumber, date, editingSessionId, currentUser.id]);

  const handleCourseChange = (key: string) => {
    const opt = courseOptions.find((o) => o.key === key);
    setCourseKey(key);
    // لیست زنگ‌ها بازتولید و اولین زنگ پیش‌فرض انتخاب می‌شود
    setPeriodNumber(1);
    loadSlot(opt, 1, date);
  };

  /** تغییر تاریخ جلسه (مثلاً ثبت کلاس دیروز در امروز)؛ جلسه‌ی همان روز/زنگ اگر ثبت شده باشد برای ویرایش بارگذاری می‌شود */
  const handleDateChange = (value: string) => {
    const next = toEnglishDigits(value || '').trim();
    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(next) || next === date) return;
    if (isFutureShamsi(next)) {
      showToast('ثبت حضور و غیاب برای تاریخ آینده ممکن نیست.', 'error');
      return;
    }
    const apply = () => {
      setDate(next);
      loadSlot(course, periodNumber, next);
    };
    if (hasUnsavedChanges) {
      showConfirm({
        title: 'تغییر تاریخ جلسه',
        message: 'با تغییر تاریخ، اطلاعات واردشده‌ی این فرم (مبحث، تکلیف و وضعیت دانش‌آموزان) ذخیره نشده و پاک می‌شود. ادامه می‌دهید؟',
        confirmLabel: 'بله، تاریخ تغییر کند',
        cancelLabel: 'انصراف',
        onConfirm: apply,
      });
      return;
    }
    apply();
  };

  const daysAgoShamsi = (n: number): string => {
    const d = shamsiStringToDate(todayInfo.formattedDate);
    d.setDate(d.getDate() - n);
    return dateToShamsiString(d);
  };

  const handlePeriodChange = (n: number) => {
    setPeriodNumber(n);
    loadSlot(course, n, date);
  };

  const hasUnsavedChanges = Boolean(
    lessonTopic.trim() ||
      homeworkDescription.trim() ||
      sessionNotes.trim() ||
      Object.values(records).some((r) => r.status !== 'present' || r.note || r.disciplinaryWarning || r.homeworkStatus)
  );

  const handleRequestClose = () => {
    if (hasUnsavedChanges && !editingSessionId) setShowExitConfirm(true);
    else onClose();
  };

  // ------------------------------------------------------------------
  // تغییر وضعیت دانش‌آموزان (پیش‌فرض: حاضر)
  // ------------------------------------------------------------------
  const patchRecord = (studentId: string, patch: Partial<StudentAttendanceRecord>) =>
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        studentId,
        status: prev[studentId]?.status || 'present',
        ...patch,
      },
    }));

  /** کلیک روی همان دکمه فعال، وضعیت را به «حاضر» برمی‌گرداند */
  const toggleStatus = (studentId: string, target: 'absent' | 'late') => {
    const current = records[studentId]?.status === 'excused' ? 'absent' : records[studentId]?.status || 'present';
    const next: AttendanceStatus = current === target ? 'present' : target;
    patchRecord(studentId, {
      status: next,
      delayMinutes: next === 'late' ? records[studentId]?.delayMinutes || 10 : undefined,
    });
  };

  const openWarning = (student: Student) => {
    const existing = records[student.id]?.disciplinaryWarning;
    setWarningStudent(student);
    if (existing?.hasWarning) {
      setWarningKind(existing.kind || WARNING_KINDS[0].label);
      setWarningNote(existing.description || '');
      setWarningDeduction(existing.scoreDeduction);
    } else {
      setWarningKind(WARNING_KINDS[0].label);
      setWarningNote('');
      setWarningDeduction(0.5);
    }
  };

  const saveWarning = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warningStudent) return;
    const kind = WARNING_KINDS.find((k) => k.label === warningKind) || WARNING_KINDS[0];
    patchRecord(warningStudent.id, {
      disciplinaryWarning: {
        hasWarning: true,
        title: kind.label,
        kind: kind.label,
        description: warningNote.trim(),
        scoreDeduction: Number(warningDeduction) || 0,
        type: kind.type,
      },
    });
    setWarningStudent(null);
  };

  const removeWarning = (studentId: string) =>
    setRecords((prev) => {
      const next = { ...prev };
      if (next[studentId]) {
        const { disciplinaryWarning: _removed, ...rest } = next[studentId];
        next[studentId] = rest;
      }
      return next;
    });

  // ------------------------------------------------------------------
  // ذخیره
  // ------------------------------------------------------------------
  const dayClosedReason = closedReasonOf(date);

  const handleSave = (skipHomeworkCheck: boolean = false) => {
    if (isSubmitting) return;
    if (dayClosedReason) {
      showToast(closedReasonMessage(dayClosedReason), 'error');
      return;
    }
    if (!course) {
      showToast('لطفاً درس و کلاس را انتخاب نمایید.', 'error');
      return;
    }
    if (isFutureShamsi(date.trim())) {
      showToast('ثبت حضور و غیاب برای تاریخ آینده ممکن نیست.', 'error');
      return;
    }

    const topic = lessonTopic.trim();
    if (topic.length < 2) {
      const message = 'لطفاً مبحث تدریس‌شده این جلسه را وارد کنید';
      setTopicError(message);
      showToast(message, 'error');
      topicRef.current?.focus();
      return;
    }

    // یادآوری: جلسه قبل تکلیف داشته ولی وضعیت هیچ دانش‌آموز حاضری ثبت نشده است
    if (!skipHomeworkCheck && prevSession && (prevSession.homeworkDescription || '').trim()) {
      const attending = classStudents.filter((st) => (records[st.id]?.status ?? 'present') !== 'absent' && records[st.id]?.status !== 'excused');
      if (attending.length > 0 && attending.every((st) => !records[st.id]?.homeworkStatus)) {
        showConfirm({
          title: 'وضعیت تکلیف ثبت نشده است',
          message: 'جلسه قبل تکلیف داده شده بود، اما وضعیت تکلیف هیچ دانش‌آموزی ثبت نشده است. بدون ثبت وضعیت ذخیره شود؟',
          confirmLabel: 'بله، ذخیره شود',
          cancelLabel: 'بازگشت و ثبت وضعیت',
          onConfirm: () => handleSave(true),
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const finalRecords: Record<string, StudentAttendanceRecord> = {};
      classStudents.forEach((st) => {
        finalRecords[st.id] = records[st.id] || { studentId: st.id, status: 'present' };
      });

      const bell = [...bellPeriods].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[periodNumber - 1];
      const original = editingSessionId ? sessions.find((s) => s.id === editingSessionId) : undefined;

      const sessionId = saveAttendanceSession({
        id: editingSessionId,
        classId: course.classId,
        teacherId: original?.teacherId || currentUser.id,
        teacherName: original?.teacherName || currentUser.name,
        subject: course.subjectName,
        subjectId: course.subjectId,
        date: date.trim(),
        dayOfWeek: getDayOfWeekFromShamsi(date.trim()),
        startTime: bell?.startTime,
        endTime: bell?.endTime,
        bellPeriodName: periodLabel(periodNumber),
        periodNumber,
        lessonTopic: topic,
        homeworkDescription: homeworkDescription.trim(),
        sessionNotes: sessionNotes.trim(),
        records: finalRecords,
      });

      // اخطارهای کلاسی به‌صورت خودکار در پرونده انضباطی/تربیتی دانش‌آموز ثبت و برچسب‌گذاری می‌شوند
      Object.entries(finalRecords).forEach(([studentId, rec]) => {
        const warn = rec.disciplinaryWarning;
        if (!warn?.hasWarning) return;
        const stu = students.find((s) => s.id === studentId);
        if (stu?.disciplinaryNotes?.some((n) => n.sessionRef === sessionId && n.source === 'class_warning')) return;
        addDisciplinaryNote(studentId, {
          date: date.trim(),
          title: `اخطار کلاسی: ${warn.kind || warn.title}`,
          description: `${warn.description || 'ثبت اخطار توسط استاد در جلسه کلاسی'} (درس ${course.subjectName} • ${periodLabel(periodNumber)} • استاد ${currentUser.name})`,
          scoreDeduction: Number(warn.scoreDeduction) || 0,
          recordedBy: `${currentUser.name} (استاد ${course.subjectName})`,
          type: warn.type,
          source: 'class_warning',
          warningKind: warn.kind || warn.title,
          subject: course.subjectName,
          sessionRef: sessionId,
        });
      });

      clearAttendanceDraft(currentUser.id, course.key, date.trim(), periodNumber);
      baselineRef.current = null;
      onClose();
    } catch {
      showToast('خطا در ذخیره اطلاعات جلسه. لطفاً مجدداً بررسی کنید.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  classStudents.forEach((st) => {
    const status = records[st.id]?.status || 'present';
    if (status === 'present') presentCount++;
    else if (status === 'late') lateCount++;
    else absentCount++;
  });

  const fieldBase =
    'w-full text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-slate-900 outline-none transition';

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-0 sm:p-4 z-50 w-full min-h-screen overflow-y-auto overscroll-contain"
      dir="rtl"
    >
      <div className="bg-white sm:rounded-3xl shadow-2xl shadow-slate-900/10 w-full min-h-screen sm:min-h-0 sm:my-auto max-w-3xl flex flex-col font-['Vazirmatn',sans-serif]">
        {/* هدر */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 space-y-3 bg-white sm:rounded-t-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900">
                {editingSessionId ? 'ویرایش حضور و غیاب کلاسی' : 'حضور و غیاب کلاسی'}
              </h2>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">
                {getDayOfWeekFromShamsi(date)} {toPersianDigits(date)}
              </span>
            </div>
            <button
              id="btn-close-attendance-modal"
              onClick={handleRequestClose}
              className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* تاریخ جلسه: امکان ثبت کلاس روزهای گذشته */}
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="تاریخ جلسه">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">تاریخ جلسه:</span>
            {([['امروز', 0], ['دیروز', 1], ['۲ روز پیش', 2]] as const).map(([label, n]) => {
              const value = daysAgoShamsi(n);
              const active = toEnglishDigits(date) === toEnglishDigits(value);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleDateChange(value)}
                  aria-pressed={active}
                  className={`shrink-0 h-9 px-3.5 rounded-full border text-xs whitespace-nowrap cursor-pointer transition-colors ${
                    active ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold' : 'bg-white border-slate-200 text-slate-600 font-medium active:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <ShamsiDatePicker
              value={date}
              onChange={handleDateChange}
              fallbackDate={date}
              placeholder="انتخاب تاریخ..."
              className="shrink-0 w-32 h-9 text-xs bg-white border border-slate-200 rounded-full px-3 outline-none focus:border-emerald-500 text-center cursor-pointer"
            />
          </div>

          {dayClosedReason && (
            <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900 leading-6">
              {closedReasonMessage(dayClosedReason, schoolHolidays.find((h) => normalizeShamsi(h.date) === normalizeShamsi(date))?.title)}
            </div>
          )}

          {/* دو انتخابگر پویا: درس و کلاس / زنگ جلسه */}
          <div className="grid sm:grid-cols-3 gap-2.5">
            <label className="sm:col-span-2 block">
              <span className="block text-[11px] font-bold text-slate-500 mb-1">درس و کلاس</span>
              <select
                id="select-course-class"
                value={course?.key || ''}
                onChange={(e) => handleCourseChange(e.target.value)}
                disabled={Boolean(existingSession)}
                className="w-full text-sm font-bold bg-sky-50/60 border border-sky-200 text-sky-900 rounded-2xl px-3.5 py-2.5 outline-none focus:border-sky-400 cursor-pointer disabled:opacity-70"
              >
                {courseOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.subjectName} • {o.className}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold text-slate-500 mb-1">
                زنگ / جلسه ({toPersianDigits(course?.hoursPerWeek ?? 0)} ساعت در هفته)
              </span>
              <select
                id="select-period"
                value={periodNumber}
                onChange={(e) => handlePeriodChange(Number(e.target.value))}
                disabled={Boolean(existingSession)}
                className="w-full text-sm font-bold bg-violet-50/60 border border-violet-200 text-violet-900 rounded-2xl px-3.5 py-2.5 outline-none focus:border-violet-400 cursor-pointer disabled:opacity-70"
              >
                {periodChoices.map((n) => (
                  <option key={n} value={n}>
                    {periodLabel(n)}
                    {findSlotSession(course, n, date) ? ' ✓ ثبت‌شده' : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {draftRestored && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <NotebookPen className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">پیش‌نویس ذخیره‌شده‌ی شما بازیابی شد؛ هنوز ثبت نهایی نشده است.</span>
              <button type="button" onClick={discardDraft} className="min-h-[32px] px-2.5 rounded-lg border border-emerald-300 bg-white text-emerald-800 cursor-pointer whitespace-nowrap">
                پاک‌کردن پیش‌نویس
              </button>
            </div>
          )}

          {editingSessionId && !existingSession && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>این زنگ در این تاریخ قبلاً ثبت شده است؛ اطلاعات آن برای ویرایش بازخوانی شد.</span>
            </div>
          )}

          {/* مبحث تدریس‌شده (اجباری) */}
          <div>
            <label htmlFor="input-lesson-topic" className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 mb-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>مبحث تدریس‌شده / عنوان درس امروز</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-lesson-topic"
              ref={topicRef}
              type="text"
              value={lessonTopic}
              onChange={(e) => {
                setLessonTopic(e.target.value);
                if (topicError) setTopicError('');
              }}
              aria-required="true"
              aria-invalid={Boolean(topicError)}
              placeholder="مثلاً: فصل سوم – معادلات درجه اول"
              className={`${fieldBase} ${topicError ? 'border-rose-300 bg-rose-50/40 focus:border-rose-400' : ''}`}
            />
            {topicError && <p className="mt-1.5 text-[11px] font-bold text-rose-700">{topicError}</p>}

          </div>

          <div>
 
            <label htmlFor="textarea-homework" className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 mb-1.5">
              <NotebookPen className="w-3.5 h-3.5 text-sky-600" />
              <span>تکلیف جلسه</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium whitespace-nowrap">(اختیاری)</span>
            </label>
            <textarea
              id="textarea-homework"
              rows={2}
              value={homeworkDescription}
              onChange={(e) => setHomeworkDescription(e.target.value)}
              placeholder="مثلاً: حل تمرینات صفحه ۴۲ کتاب، یا مطالعه فصل سوم جهت کوئیز..."
              className="w-full text-sm bg-slate-50/80 focus:bg-white border border-slate-200 focus:border-teal-400 rounded-xl px-4 py-2.5 text-slate-900 outline-none transition resize-none"
            />
            <input
              id="textarea-session-notes"
              type="text"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="یادداشت کلی جلسه (اختیاری)"
              className={`${fieldBase} mt-2`}
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">حاضر {toPersianDigits(presentCount)}</span>
            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100">غایب {toPersianDigits(absentCount)}</span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">تأخیر {toPersianDigits(lateCount)}</span>
          </div>
        </div>

        {/* لیست دانش‌آموزان */}
        <div className="px-3 sm:px-4 pt-3 pb-28 border-t border-slate-100 space-y-2.5">
          {classStudents.length > 0 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 text-[11px] text-sky-900">
              {prevSession ? (
                <>
                  <b>تکلیف جلسه قبل ({toPersianDigits(prevSession.date)}):</b>{' '}
                  {(prevSession.homeworkDescription || '').trim() || 'تکلیفی ثبت نشده بود'}
                  <button
                    type="button"
                    onClick={() =>
                      setRecords((prev) => {
                        const next = { ...prev };
                        classStudents.forEach((st) => {
                          const cur = next[st.id] || ({ studentId: st.id, status: 'present' } as StudentAttendanceRecord);
                          if (cur.status === 'absent' || cur.status === 'excused' || cur.homeworkStatus) return;
                          next[st.id] = { ...cur, homeworkStatus: 'done' };
                        });
                        return next;
                      })
                    }
                    className="mr-2 px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-[11px] font-bold cursor-pointer hover:bg-emerald-100"
                  >
                    همه انجام شده
                  </button>
                  <span className="block opacity-70 mt-0.5">وضعیت «انجام شده / ناقص / انجام نشده» هر دانش‌آموز مربوط به همین تکلیف است؛ پیش‌فرض بدون وضعیت است (با زدن دوباره‌ی گزینه‌ی انتخاب‌شده برداشته می‌شود).</span>
                </>
              ) : (
                <>جلسه قبلی برای این درس ثبت نشده است؛ وضعیت تکلیف از جلسه بعد قابل ثبت است.</>
              )}
            </div>
          )}
          {classStudents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">دانش‌آموزی در این کلاس ثبت نشده است.</div>
          ) : (
            classStudents.map((student, idx) => {
              const rec = records[student.id] || ({ studentId: student.id, status: 'present' } as StudentAttendanceRecord);
              const status: AttendanceStatus = rec.status === 'excused' ? 'absent' : rec.status;
              const expanded = expandedId === student.id;
              const hasWarning = Boolean(rec.disciplinaryWarning?.hasWarning);
              const hasExtra = !!rec.note;
              const tone =
                status === 'absent'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : status === 'late'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50/70 text-emerald-900 border-emerald-200';

              return (
                <div key={student.id} className={`rounded-2xl border p-3 transition ${tone}`}>
                  <div className="flex items-center gap-x-3 gap-y-2.5 flex-wrap">
                    <span className="hidden sm:block w-6 text-center text-xs font-bold opacity-50 shrink-0">{toPersianDigits(idx + 1)}</span>

                    {student.avatar ? (
                      <img src={student.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-white shadow-xs shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/70 border border-white flex items-center justify-center text-sm font-extrabold opacity-80 shrink-0">
                        {(student.firstName || '؟').charAt(0)}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectStudent?.(student)}
                      className="flex-1 min-w-0 text-right cursor-pointer"
                    >
                      <div className="text-sm font-extrabold whitespace-nowrap">
                        {studentFullName(student)}
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto sm:mr-auto">
                      {status === 'late' && (
                        <span className="flex items-center gap-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={toPersianDigits(rec.delayMinutes || 10)}
                            onChange={(e) => {
                              const n = parseInt(toEnglishDigits(e.target.value).replace(/[^0-9]/g, ''), 10);
                              patchRecord(student.id, { status: 'late', delayMinutes: Math.min(90, Math.max(1, Number.isNaN(n) ? 1 : n)) });
                            }}
                            aria-label="دقیقه تأخیر"
                            className="w-11 text-center text-xs font-bold bg-white/80 text-amber-800 border border-amber-200 rounded-xl py-1.5 outline-none focus:ring-2 focus:ring-amber-200"
                          />
                          <span className="text-[10px] font-bold">دقیقه</span>
                        </span>
                      )}

                      <button
                        type="button"
                        id={`btn-status-absent-${student.id}`}
                        aria-pressed={status === 'absent'}
                        onClick={() => toggleStatus(student.id, 'absent')}
                        className={`min-h-[40px] px-3.5 py-2 rounded-2xl text-xs font-extrabold border transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap ${
                          status === 'absent'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-white/70 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-200'
                        }`}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>غیبت</span>
                      </button>
                      <button
                        type="button"
                        id={`btn-status-late-${student.id}`}
                        aria-pressed={status === 'late'}
                        onClick={() => toggleStatus(student.id, 'late')}
                        className={`min-h-[40px] px-3.5 py-2 rounded-2xl text-xs font-extrabold border transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap ${
                          status === 'late'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-white/70 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>تأخیر</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openWarning(student)}
                        aria-label="ثبت اخطار کلاسی"
                        title={hasWarning ? 'ویرایش اخطار کلاسی' : 'ثبت اخطار کلاسی'}
                        className={`min-h-[40px] px-3.5 py-2 rounded-2xl text-xs font-extrabold border transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap ${
                          hasWarning
                            ? 'bg-violet-100 text-violet-900 border-violet-300'
                            : 'bg-violet-50 hover:bg-violet-100 text-violet-800 border-violet-200'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{hasWarning ? 'اخطار ثبت شد' : 'ثبت اخطار'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : student.id)}
                        aria-label="جزئیات بیشتر"
                        title="یادداشت فردی"
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center transition cursor-pointer ${
                          expanded || hasExtra ? 'bg-white text-emerald-700' : 'text-slate-400 hover:bg-white/70'
                        }`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {status !== 'absent' && prevSession && (
                    <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold opacity-70 whitespace-nowrap">تکلیف جلسه قبل:</span>
                      {([
                        ['done', 'انجام شده', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
                        ['incomplete', 'ناقص', 'bg-amber-50 text-amber-700 border-amber-200'],
                        ['not_done', 'انجام نشده', 'bg-rose-50 text-rose-700 border-rose-200'],
                      ] as const).map(([key, label, cls]) => {
                        const active = rec.homeworkStatus === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={active}
                            onClick={() => patchRecord(student.id, { homeworkStatus: active ? undefined : key })}
                            className={`min-h-[36px] px-3 rounded-xl border text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${cls} ${
                              active ? 'ring-2 ring-offset-1 ring-current shadow-sm' : 'opacity-60 hover:opacity-100'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {hasWarning && rec.disciplinaryWarning && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-violet-800 bg-violet-50 border border-violet-200 rounded-xl px-3 py-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {rec.disciplinaryWarning.kind || rec.disciplinaryWarning.title}
                        {rec.disciplinaryWarning.description ? ` — ${rec.disciplinaryWarning.description}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeWarning(student.id)}
                        className="mr-auto p-1 text-violet-400 hover:text-rose-600 transition cursor-pointer"
                        title="حذف اخطار"
                        aria-label="حذف اخطار"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {expanded && (
                    <div className="mt-2 bg-white/70 rounded-2xl p-3 text-xs text-slate-700">
                      <input
                        type="text"
                        value={rec.note || ''}
                        onChange={(e) => patchRecord(student.id, { note: e.target.value })}
                        placeholder="یادداشت فردی..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* فوتر */}
        <div className="sticky bottom-0 z-20 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-white/95 backdrop-blur flex items-center gap-3 sm:rounded-b-3xl" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            id="btn-save-attendance-session"
            onClick={() => handleSave()}
            disabled={isSubmitting || !course || Boolean(dayClosedReason)}
            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold rounded-2xl shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            <span>{isSubmitting ? 'در حال ثبت...' : editingSessionId ? 'ذخیره ویرایش' : 'ثبت حضور و غیاب'}</span>
          </button>
          <button
            type="button"
            onClick={handleRequestClose}
            className="h-12 px-5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition cursor-pointer"
          >
            انصراف
          </button>
        </div>
      </div>

      {/* پاپ‌آپ ثبت اخطار کلاسی */}
      {warningStudent && createPortal(
        <div className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl shadow-slate-900/10 overflow-hidden">
            <div className="px-6 pt-6 pb-2 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                اخطار کلاسی: {studentFullName(warningStudent)}
              </h3>
              <button
                type="button"
                onClick={() => setWarningStudent(null)}
                className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveWarning} className="px-6 pb-6 pt-2 space-y-3">
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-1.5">نوع تذکر</div>
                <div className="grid grid-cols-2 gap-2">
                  {WARNING_KINDS.map((k) => (
                    <button
                      key={k.label}
                      type="button"
                      onClick={() => setWarningKind(k.label)}
                      aria-pressed={warningKind === k.label}
                      className={`px-3 py-2.5 rounded-2xl text-xs font-bold border transition cursor-pointer ${
                        warningKind === k.label
                          ? 'bg-violet-100 text-violet-900 border-violet-300'
                          : 'bg-violet-50/50 text-violet-800 border-violet-200 hover:bg-violet-50'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={2}
                value={warningNote}
                onChange={(e) => setWarningNote(e.target.value)}
                placeholder="یادداشت کوتاه استاد (اختیاری)"
                className="w-full text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-violet-400 rounded-2xl p-3 outline-none resize-none transition"
              />

              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="shrink-0">کسر نمره انضباطی</span>
                <select
                  value={warningDeduction}
                  onChange={(e) => setWarningDeduction(Number(e.target.value))}
                  className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 outline-none cursor-pointer"
                >
                  <option value="0">بدون کسر نمره</option>
                  <option value="0.25">۰٫۲۵ نمره</option>
                  <option value="0.5">۰٫۵ نمره</option>
                  <option value="1">۱ نمره</option>
                </select>
              </label>

              <button
                type="submit"
                className="w-full h-12 bg-violet-100 hover:bg-violet-200 text-violet-900 border border-violet-200 text-base font-extrabold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-5 h-5" />
                <span>درج اخطار</span>
              </button>
            </form>
          </div>
        </div>
        , document.body)}

      {/* تأیید خروج بدون ذخیره */}
      {showExitConfirm && createPortal(
        <div className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4 text-center">
            <h3 className="text-base font-extrabold text-slate-900">خروج بدون ذخیره؟</h3>
            <p className="text-xs text-slate-500">تغییرات این جلسه هنوز ثبت نهایی نشده است؛ به‌صورت پیش‌نویس نگه داشته می‌شود و با باز کردن دوباره‌ی همین زنگ برمی‌گردد.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 h-11 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl text-sm font-bold cursor-pointer"
              >
                ادامه ثبت
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false);
                  onClose();
                }}
                className="flex-1 h-11 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-2xl text-sm font-bold cursor-pointer"
              >
                خروج و نگه‌داشتن پیش‌نویس
              </button>
            </div>
          </div>
        </div>
        , document.body)}
    </div>
  );
};
