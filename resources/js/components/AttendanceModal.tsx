import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import {
  AttendanceSession,
  AttendanceStatus,
  HomeworkStatus,
  StudentAttendanceRecord,
  Student,
  SchoolClass,
} from '../types';
import { getTodayShamsi, getDayOfWeekFromShamsi, toPersianDigits, toEnglishDigits } from '../utils/persianDate';
import { subjectAppliesToClass } from '../utils/courseAssignments';
import { compareByLastName } from '../utils/morningAttendance';
import { X, Check, Clock, UserX, ShieldAlert, Trash2, MoreHorizontal, Loader2, BookOpen, AlertCircle } from 'lucide-react';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetClassId?: string;
  targetSubject?: string;
  existingSession?: AttendanceSession | null;
  onSelectStudent?: (student: Student) => void;
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
}) => {
  const {
    currentUser,
    accessibleClasses,
    classes,
    academicSubjects,
    bellPeriods,
    students,
    sessions,
    saveAttendanceSession,
    addDisciplinaryNote,
    showToast,
  } = useSchool();

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
    const pool: SchoolClass[] = accessibleClasses.length > 0 ? accessibleClasses : classes;
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
        hoursPerWeek: subject?.hoursPerWeek && subject.hoursPerWeek > 0 ? Math.round(subject.hoursPerWeek) : 2,
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
    } else {
      // مدیر/معاونین: همه دروس مرتبط با کلاس‌های قابل دسترس
      pool.forEach((cls) =>
        academicSubjects.filter((sub) => subjectAppliesToClass(sub, cls)).forEach((sub) => push(cls, sub.id, sub.name))
      );
    }

    // سازگاری: کلاس/درس ارسالی از بیرون یا جلسه در حال ویرایش
    if (existingSession) {
      const cls = classes.find((c) => c.id === existingSession.classId);
      if (cls) push(cls, existingSession.subjectId, existingSession.subject);
    }
    if (targetClassId) {
      const cls = poolById.get(targetClassId) || classes.find((c) => c.id === targetClassId);
      if (cls && !list.some((o) => o.classId === targetClassId)) {
        push(cls, undefined, targetSubject || currentUser.subject || 'درس عمومی');
      }
    }
    if (list.length === 0) {
      pool.forEach((cls) => push(cls, undefined, targetSubject || currentUser.subject || 'درس عمومی'));
    }
    return list;
  }, [accessibleClasses, classes, academicSubjects, currentUser, existingSession, targetClassId, targetSubject]);

  const course = courseOptions.find((o) => o.key === courseKey) || courseOptions[0];

  // تعداد زنگ‌ها دقیقاً برابر ساعات هفتگی درس
  const periodCount = Math.min(
    MAX_PERIODS,
    Math.max(course?.hoursPerWeek ?? 1, existingSession?.periodNumber && course ? existingSession.periodNumber : 1)
  );
  const periodChoices = Array.from({ length: periodCount }, (_, i) => i + 1);

  const classStudents = useMemo(
    () => students.filter((s) => s.classId === course?.classId).sort(compareByLastName),
    [students, course?.classId]
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
    students
      .filter((s) => s.classId === classId)
      .forEach((st) => {
        initial[st.id] = { studentId: st.id, status: 'present', homeworkStatus: 'done' };
      });
    return initial;
  };

  /** بارگذاری یک زنگ مشخص: اگر قبلاً ثبت شده باشد برای ویرایش بازخوانی می‌شود */
  const loadSlot = (opt: CourseOption | undefined, period: number, forDate: string) => {
    if (!opt) return;
    const existing = findSlotSession(opt, period, forDate);
    setTopicError('');
    setExpandedId(null);
    if (existing) {
      setEditingSessionId(existing.id);
      setLessonTopic(existing.lessonTopic || '');
      setHomeworkDescription(existing.homeworkDescription || '');
      setSessionNotes(existing.sessionNotes || '');
      setShowSessionNotes(Boolean(existing.homeworkDescription || existing.sessionNotes));
      setRecords({ ...freshRecords(opt.classId), ...(existing.records || {}) });
    } else {
      setEditingSessionId(undefined);
      setLessonTopic('');
      setHomeworkDescription('');
      setSessionNotes('');
      setShowSessionNotes(false);
      setRecords(freshRecords(opt.classId));
    }
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
      setEditingSessionId(existingSession.id);
      setLessonTopic(existingSession.lessonTopic || '');
      setHomeworkDescription(existingSession.homeworkDescription || '');
      setSessionNotes(existingSession.sessionNotes || '');
      setShowSessionNotes(Boolean(existingSession.homeworkDescription || existingSession.sessionNotes));
      setRecords({ ...freshRecords(existingSession.classId), ...(existingSession.records || {}) });
      setTopicError('');
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
  }, [isOpen, existingSession?.id, targetClassId, targetSubject]);

  const handleCourseChange = (key: string) => {
    const opt = courseOptions.find((o) => o.key === key);
    setCourseKey(key);
    // لیست زنگ‌ها بازتولید و اولین زنگ پیش‌فرض انتخاب می‌شود
    setPeriodNumber(1);
    loadSlot(opt, 1, date);
  };

  const handlePeriodChange = (n: number) => {
    setPeriodNumber(n);
    loadSlot(course, n, date);
  };

  const hasUnsavedChanges = Boolean(
    lessonTopic.trim() ||
      homeworkDescription.trim() ||
      sessionNotes.trim() ||
      Object.values(records).some((r) => r.status !== 'present' || r.score !== undefined || r.note || r.disciplinaryWarning)
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
  const handleSave = () => {
    if (isSubmitting) return;
    if (!course) {
      showToast('لطفاً درس و کلاس را انتخاب نمایید.', 'error');
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

    setIsSubmitting(true);
    try {
      const finalRecords: Record<string, StudentAttendanceRecord> = {};
      classStudents.forEach((st) => {
        finalRecords[st.id] = records[st.id] || { studentId: st.id, status: 'present', homeworkStatus: 'done' };
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
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/10 w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden font-['Vazirmatn',sans-serif]">
        {/* هدر */}
        <div className="px-5 sm:px-6 pt-5 pb-3 space-y-3 shrink-0">
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

            {showSessionNotes ? (
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                <input
                  id="textarea-homework"
                  type="text"
                  value={homeworkDescription}
                  onChange={(e) => setHomeworkDescription(e.target.value)}
                  placeholder="تکلیف جلسه آینده"
                  className={fieldBase}
                />
                <input
                  id="textarea-session-notes"
                  type="text"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="یادداشت کلی جلسه"
                  className={fieldBase}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSessionNotes(true)}
                className="mt-1.5 text-[11px] font-bold text-slate-400 hover:text-emerald-700 transition cursor-pointer"
              >
                + تکلیف و یادداشت جلسه
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">حاضر {toPersianDigits(presentCount)}</span>
            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100">غایب {toPersianDigits(absentCount)}</span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">تأخیر {toPersianDigits(lateCount)}</span>
          </div>
        </div>

        {/* لیست دانش‌آموزان */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 border-t border-slate-100 space-y-2.5">
          {classStudents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">دانش‌آموزی در این کلاس ثبت نشده است.</div>
          ) : (
            classStudents.map((student, idx) => {
              const rec = records[student.id] || ({ studentId: student.id, status: 'present' } as StudentAttendanceRecord);
              const status: AttendanceStatus = rec.status === 'excused' ? 'absent' : rec.status;
              const expanded = expandedId === student.id;
              const hasWarning = Boolean(rec.disciplinaryWarning?.hasWarning);
              const hasExtra = rec.score !== undefined || !!rec.note || (rec.homeworkStatus && rec.homeworkStatus !== 'done');
              const tone =
                status === 'absent'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : status === 'late'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50/70 text-emerald-900 border-emerald-200';

              return (
                <div key={student.id} className={`rounded-2xl border p-3 transition ${tone}`}>
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
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
                      <div className="text-sm font-extrabold truncate">
                        {student.lastName} {student.firstName}
                      </div>
                      {student.studentCode && (
                        <div className="text-[11px] opacity-60 truncate">کد دانش‌آموزی: {toPersianDigits(student.studentCode)}</div>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0 mr-auto">
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
                        className={`px-3 py-2 rounded-2xl text-xs font-extrabold border transition cursor-pointer inline-flex items-center gap-1 ${
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
                        className={`px-3 py-2 rounded-2xl text-xs font-extrabold border transition cursor-pointer inline-flex items-center gap-1 ${
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
                        className={`px-3 py-2 rounded-2xl text-xs font-extrabold border transition cursor-pointer inline-flex items-center gap-1 ${
                          hasWarning
                            ? 'bg-violet-100 text-violet-900 border-violet-300'
                            : 'bg-violet-50 hover:bg-violet-100 text-violet-800 border-violet-200'
                        }`}
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{hasWarning ? 'اخطار ثبت شد' : 'ثبت اخطار'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : student.id)}
                        aria-label="جزئیات بیشتر"
                        title="نمره، تکلیف و یادداشت"
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center transition cursor-pointer ${
                          expanded || hasExtra ? 'bg-white text-emerald-700' : 'text-slate-400 hover:bg-white/70'
                        }`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

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
                    <div className="mt-2 bg-white/70 rounded-2xl p-3 grid sm:grid-cols-2 gap-3 text-xs text-slate-700">
                      <label className="flex items-center gap-2 font-bold">
                        <span className="shrink-0">نمره مستمر</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={rec.score !== undefined ? toPersianDigits(rec.score) : ''}
                          onChange={(e) => {
                            const n = parseFloat(toEnglishDigits(e.target.value));
                            patchRecord(student.id, { score: Number.isNaN(n) ? undefined : Math.min(20, Math.max(0, n)) });
                          }}
                          placeholder="—"
                          className="w-16 text-center font-bold bg-white border border-slate-200 rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <span className="text-slate-400 font-normal">از ۲۰</span>
                      </label>
                      <label className="flex items-center gap-2 font-bold">
                        <span className="shrink-0">تکلیف</span>
                        <select
                          value={rec.homeworkStatus || 'done'}
                          onChange={(e) => patchRecord(student.id, { homeworkStatus: e.target.value as HomeworkStatus })}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 outline-none cursor-pointer font-bold"
                        >
                          <option value="done">کامل</option>
                          <option value="incomplete">ناقص</option>
                          <option value="not_done">انجام نشده</option>
                        </select>
                      </label>
                      <input
                        type="text"
                        value={rec.note || ''}
                        onChange={(e) => patchRecord(student.id, { note: e.target.value })}
                        placeholder="یادداشت فردی..."
                        className="sm:col-span-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* فوتر */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center gap-3 shrink-0">
          <button
            type="button"
            id="btn-save-attendance-session"
            onClick={handleSave}
            disabled={isSubmitting || !course}
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
      {warningStudent && (
        <div className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl shadow-slate-900/10 overflow-hidden">
            <div className="px-6 pt-6 pb-2 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                اخطار کلاسی: {warningStudent.firstName} {warningStudent.lastName}
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
      )}

      {/* تأیید خروج بدون ذخیره */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4 text-center">
            <h3 className="text-base font-extrabold text-slate-900">خروج بدون ذخیره؟</h3>
            <p className="text-xs text-slate-500">تغییرات این جلسه هنوز ثبت نشده است.</p>
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
                خروج
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
