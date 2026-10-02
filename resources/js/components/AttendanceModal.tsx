import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, AttendanceSession, AttendanceStatus, HomeworkStatus, StudentAttendanceRecord, Student, ClassDisciplinaryWarning } from '../types';
import { getTodayShamsi, getDayOfWeekFromShamsi, toPersianDigits, toEnglishDigits } from '../utils/persianDate';
import { 
  X, 
  Check, 
  UserX, 
  Clock, 
  FileCheck, 
  Sparkles, 
  Save, 
  BookOpen, 
  Calendar, 
  FileText,
  AlertCircle,
  Award,
  ListChecks,
  ShieldAlert,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetClassId?: string;
  targetSubject?: string;
  existingSession?: AttendanceSession | null;
  onSelectStudent?: (student: Student) => void;
}

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
    bellPeriods,
    getCurrentOrNextBellPeriod,
    students, 
    saveAttendanceSession, 
    addDisciplinaryNote,
    updateStudentDiscipline,
    isTeacher,
    showToast 
  } = useSchool();

  const todayInfo = getTodayShamsi();

  // Submission lock state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected Class
  const [selectedClassId, setSelectedClassId] = useState<string>(
    targetClassId || (accessibleClasses.length > 0 ? accessibleClasses[0].id : '')
  );

  // Session Meta & Timing
  const [date, setDate] = useState<string>(todayInfo.formattedDate);
  const [dayOfWeek, setDayOfWeek] = useState<string>(todayInfo.dayOfWeek);
  const [startTime, setStartTime] = useState<string>('07:45');
  const [endTime, setEndTime] = useState<string>('09:15');
  const [selectedBellId, setSelectedBellId] = useState<string>('');
  const [bellPeriodName, setBellPeriodName] = useState<string>('');
  const [subject, setSubject] = useState<string>(targetSubject || currentUser.subject || 'درس عمومی');
  const [lessonTopic, setLessonTopic] = useState<string>('');
  const [homeworkDescription, setHomeworkDescription] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');

  // Disciplinary Warning Modal State for Teacher
  const [warningStudent, setWarningStudent] = useState<Student | null>(null);
  const [warningTitle, setWarningTitle] = useState<string>('بی‌نظمی در کلاس درس');
  const [warningDescription, setWarningDescription] = useState<string>('');
  const [warningDeduction, setWarningDeduction] = useState<number>(0.5);
  const [warningType, setWarningType] = useState<'behavior' | 'delay' | 'absence' | 'uniform' | 'other'>('behavior');

  // Attendance Records mapped by studentId
  const [records, setRecords] = useState<Record<string, StudentAttendanceRecord>>({});
  const [activeTab, setActiveTab] = useState<'attendance' | 'details'>('attendance');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSessionNotes, setShowSessionNotes] = useState(false);

  // Check unsaved changes
  const hasUnsavedChanges = Boolean(
    lessonTopic.trim() || 
    homeworkDescription.trim() || 
    sessionNotes.trim() ||
    Object.values(records).some(r => r.status !== 'present' || r.score !== undefined || r.note || r.homeworkStatus || r.disciplinaryWarning)
  );

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  // Find currently selected class
  const currentClass = accessibleClasses.find((c) => c.id === selectedClassId) || classes.find((c) => c.id === selectedClassId) || accessibleClasses[0];
  const classStudents = students.filter((s) => s.classId === selectedClassId);

  // Helper to determine default timings for a class
  const applyClassTimingDefaults = (classItem?: SchoolClass) => {
    if (!classItem) {
      const fallbackBell = getCurrentOrNextBellPeriod();
      setStartTime(fallbackBell.startTime);
      setEndTime(fallbackBell.endTime);
      setSelectedBellId(fallbackBell.id);
      setBellPeriodName(fallbackBell.name);
      return;
    }

    if (classItem.defaultStartTime && classItem.defaultEndTime) {
      setStartTime(classItem.defaultStartTime);
      setEndTime(classItem.defaultEndTime);
      
      if (classItem.defaultBellPeriodId) {
        const bp = bellPeriods.find(b => b.id === classItem.defaultBellPeriodId);
        if (bp) {
          setSelectedBellId(bp.id);
          setBellPeriodName(bp.name);
          return;
        }
      }

      const matching = bellPeriods.find(
        b => b.startTime === classItem.defaultStartTime && b.endTime === classItem.defaultEndTime
      );
      if (matching) {
        setSelectedBellId(matching.id);
        setBellPeriodName(matching.name);
      } else {
        setSelectedBellId('custom');
        setBellPeriodName('ساعت اختصاصی کلاس');
      }
    } else {
      const fallbackBell = getCurrentOrNextBellPeriod();
      setStartTime(fallbackBell.startTime);
      setEndTime(fallbackBell.endTime);
      setSelectedBellId(fallbackBell.id);
      setBellPeriodName(fallbackBell.name);
    }
  };

  // Initialize form when opened or existing session changes
  useEffect(() => {
    if (existingSession) {
      setSelectedClassId(existingSession.classId);
      setDate(existingSession.date);
      setDayOfWeek(existingSession.dayOfWeek || getDayOfWeekFromShamsi(existingSession.date));
      setStartTime(existingSession.startTime || '07:45');
      setEndTime(existingSession.endTime || '09:15');
      setSelectedBellId(existingSession.bellPeriodId || '');
      setBellPeriodName(existingSession.bellPeriodName || '');
      setSubject(existingSession.subject || currentUser.subject || 'درس');
      setLessonTopic(existingSession.lessonTopic || '');
      setHomeworkDescription(existingSession.homeworkDescription || '');
      setSessionNotes(existingSession.sessionNotes || '');
      setRecords(existingSession.records || {});
    } else {
      const initialClassId = targetClassId || (accessibleClasses.length > 0 ? accessibleClasses[0].id : '');
      setSelectedClassId(initialClassId);
      
      const targetCls = accessibleClasses.find((c) => c.id === initialClassId) || classes.find((c) => c.id === initialClassId);
      applyClassTimingDefaults(targetCls);

      setDate(todayInfo.formattedDate);
      setDayOfWeek(todayInfo.dayOfWeek);
      setSubject(targetSubject || currentUser.subject || 'درس');
      setLessonTopic('');
      setHomeworkDescription('');
      setSessionNotes('');

      // Auto-initialize all students to 'present' for fast workflow
      const initial: Record<string, StudentAttendanceRecord> = {};
      const targetStus = students.filter((s) => s.classId === initialClassId);
      targetStus.forEach((st) => {
        initial[st.id] = {
          studentId: st.id,
          status: 'present',
          homeworkStatus: 'done',
        };
      });
      setRecords(initial);
    }
  }, [existingSession, isOpen, targetClassId, targetSubject]);

  // When class changes, ensure students in that class have initialized records and default times applied
  const handleClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    const targetCls = accessibleClasses.find((c) => c.id === newClassId) || classes.find((c) => c.id === newClassId);
    applyClassTimingDefaults(targetCls);

    const targetStudents = students.filter((s) => s.classId === newClassId);
    const initial: Record<string, StudentAttendanceRecord> = {};
    targetStudents.forEach((st) => {
      initial[st.id] = {
        studentId: st.id,
        status: 'present',
        homeworkStatus: 'done',
      };
    });
    setRecords(initial);
  };

  const handleSelectBellPeriod = (bellId: string) => {
    setSelectedBellId(bellId);
    if (bellId === 'custom') {
      setBellPeriodName('ساعت سفارشی');
    } else {
      const bp = bellPeriods.find(b => b.id === bellId);
      if (bp) {
        setStartTime(bp.startTime);
        setEndTime(bp.endTime);
        setBellPeriodName(bp.name);
      }
    }
  };

  // فقط دو زنگ اول و دوم قابل انتخاب است
  const twoBells = [...bellPeriods].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).slice(0, 2);

  useEffect(() => {
    if (!isOpen || existingSession || twoBells.length === 0) return;
    if (!twoBells.some((b) => b.id === selectedBellId)) {
      const current = getCurrentOrNextBellPeriod();
      const pick = twoBells.find((b) => b.id === current.id) || twoBells[0];
      handleSelectBellPeriod(pick.id);
    }
  }, [isOpen, selectedBellId, bellPeriods.length]);

  // Date change handler
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setDayOfWeek(getDayOfWeekFromShamsi(newDate));
  };

  // Record status update
  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        studentId,
        status,
        delayMinutes: status === 'late' ? (prev[studentId]?.delayMinutes || 10) : undefined,
      },
    }));
  };

  const setStudentDelay = (studentId: string, minutes: number) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        studentId,
        status: 'late',
        delayMinutes: minutes,
      },
    }));
  };

  const setStudentScore = (studentId: string, scoreStr: string) => {
    const scoreNum = parseFloat(scoreStr);
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        studentId,
        status: prev[studentId]?.status || 'present',
        score: isNaN(scoreNum) ? undefined : Math.min(20, Math.max(0, scoreNum)),
      },
    }));
  };

  const setStudentHomework = (studentId: string, homeworkStatus: HomeworkStatus) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        studentId,
        status: prev[studentId]?.status || 'present',
        homeworkStatus,
      },
    }));
  };

  const setStudentNote = (studentId: string, note: string) => {
    setRecords((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        studentId,
        status: prev[studentId]?.status || 'present',
        note,
      },
    }));
  };

  const handleOpenWarningModal = (student: Student) => {
    const existingWarning = records[student.id]?.disciplinaryWarning;
    setWarningStudent(student);
    if (existingWarning && existingWarning.hasWarning) {
      setWarningTitle(existingWarning.title);
      setWarningDescription(existingWarning.description);
      setWarningDeduction(existingWarning.scoreDeduction);
      setWarningType(existingWarning.type);
    } else {
      setWarningTitle('بی‌نظمی در کلاس درس');
      setWarningDescription('');
      setWarningDeduction(0.5);
      setWarningType('behavior');
    }
  };

  const handleSaveDisciplinaryWarning = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warningStudent) return;

    setRecords((prev) => ({
      ...prev,
      [warningStudent.id]: {
        ...prev[warningStudent.id],
        studentId: warningStudent.id,
        status: prev[warningStudent.id]?.status || 'present',
        disciplinaryWarning: {
          hasWarning: true,
          title: warningTitle.trim() || 'اخطار کلاسی',
          description: warningDescription.trim(),
          scoreDeduction: Number(warningDeduction),
          type: warningType,
        },
      },
    }));

    setWarningStudent(null);
  };

  const handleRemoveDisciplinaryWarning = (studentId: string) => {
    setRecords((prev) => {
      const updated = { ...prev };
      if (updated[studentId]) {
        delete updated[studentId].disciplinaryWarning;
      }
      return updated;
    });
  };

  // Bulk Actions
  const markAllPresent = () => {
    const updated: Record<string, StudentAttendanceRecord> = {};
    classStudents.forEach((st) => {
      updated[st.id] = {
        ...(records[st.id] || {}),
        studentId: st.id,
        status: 'present',
      };
    });
    setRecords(updated);
  };

  const handleSave = () => {
    if (isSubmitting) return;

    if (!selectedClassId) {
      showToast('لطفاً یک کلاس را انتخاب نمایید.', 'error');
      return;
    }

    const finalTopic = lessonTopic.trim() || 'تدریس و مرور مباحث درسی';

    setIsSubmitting(true);
    try {
      // 1. Save Attendance Session
      saveAttendanceSession({
        id: existingSession?.id,
        classId: selectedClassId,
        teacherId: currentUser.id,
        teacherName: currentUser.name,
        subject: subject || currentUser.subject || 'درس عمومی',
        date: date.trim(),
        dayOfWeek,
        startTime,
        endTime,
        bellPeriodId: selectedBellId || undefined,
        bellPeriodName: bellPeriodName || undefined,
        lessonTopic: finalTopic,
        homeworkDescription: homeworkDescription.trim(),
        sessionNotes: sessionNotes.trim(),
        records,
      });

      // 2. Automatically sync any registered Disciplinary Warnings to student disciplinary history
      (Object.entries(records) as [string, StudentAttendanceRecord][]).forEach(([studentId, rec]) => {
        if (rec.disciplinaryWarning && rec.disciplinaryWarning.hasWarning) {
          const warn = rec.disciplinaryWarning;
          addDisciplinaryNote(studentId, {
            date: date.trim(),
            title: `اخطار کلاسی: ${warn.title}`,
            description: `${warn.description || 'ثبت اخطار توسط دبیر در حین جلسه کلاس'} (مربوط به درس ${subject || currentUser.subject || 'کلاس'} • استاد ${currentUser.name})`,
            scoreDeduction: Number(warn.scoreDeduction) || 0.5,
            recordedBy: `${currentUser.name} (دبیر ${subject || currentUser.subject || ''})`,
            type: warn.type,
          });

          const stu = students.find((s) => s.id === studentId);
          if (stu) {
            const currentScore = stu.disciplineScore ?? 20;
            updateStudentDiscipline(studentId, Math.max(0, currentScore - (Number(warn.scoreDeduction) || 0.5)));
          }
        }
      });

      showToast('ثبت جلسه', 'اطلاعات جلسه و حضور و غیاب با موفقیت ثبت شد.', 'success');
      onClose();
    } catch {
      showToast('خطا در ذخیره اطلاعات جلسه. لطفاً مجدداً بررسی کنید.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Realtime Counts
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;

  classStudents.forEach((st) => {
    const rec = records[st.id];
    const status = rec?.status || 'present';
    if (status === 'present') presentCount++;
    else if (status === 'absent') absentCount++;
    else if (status === 'late') lateCount++;
    else if (status === 'excused') excusedCount++;
  });

  const totalStudents = classStudents.length;
  const attendanceRate = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 100;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/10 w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 font-['Vazirmatn',sans-serif]">

        {/* هدر سفید و مینیمال: عنوان، تاریخ، زنگ، شمارنده‌ها */}
        <div className="px-5 sm:px-6 pt-5 pb-3 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
              <h2 className="text-lg font-extrabold text-slate-900">
                {existingSession ? 'ویرایش حضور و غیاب' : 'حضور و غیاب'}
                {currentClass ? <span className="text-slate-400 font-bold"> • {currentClass.name}</span> : null}
              </h2>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                {dayOfWeek} {toPersianDigits(date)}
              </span>
            </div>
            <button
              id="btn-close-attendance-modal"
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer shrink-0"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!targetClassId && !existingSession && accessibleClasses.length > 1 && (
              <select
                value={selectedClassId}
                onChange={(e) => handleClassChange(e.target.value)}
                aria-label="کلاس"
                className="h-8 text-xs font-bold bg-slate-50 rounded-lg px-2.5 outline-none border border-transparent focus:border-emerald-500 cursor-pointer"
              >
                {accessibleClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
              {twoBells.map((bp, idx) => (
                <button
                  key={bp.id}
                  type="button"
                  onClick={() => handleSelectBellPeriod(bp.id)}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    selectedBellId === bp.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {idx === 0 ? 'زنگ اول' : 'زنگ دوم'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-bold mr-auto">
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">حاضر {toPersianDigits(presentCount)}</span>
              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700">غایب {toPersianDigits(absentCount + excusedCount)}</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">تأخیر {toPersianDigits(lateCount)}</span>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{toPersianDigits(attendanceRate)}٪ حضور</span>
            </div>
          </div>

          <div>
            <input
              id="textarea-lesson-topic"
              type="text"
              value={lessonTopic}
              onChange={(e) => setLessonTopic(e.target.value)}
              placeholder="مبحث تدریس امروز (اختیاری)"
              className="w-full text-sm bg-slate-50 rounded-xl px-4 py-2.5 text-slate-900 outline-none border border-transparent focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 transition"
            />
            {showSessionNotes ? (
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                <input
                  id="textarea-homework"
                  type="text"
                  value={homeworkDescription}
                  onChange={(e) => setHomeworkDescription(e.target.value)}
                  placeholder="تکلیف جلسه آینده"
                  className="text-sm bg-slate-50 rounded-xl px-4 py-2.5 outline-none border border-transparent focus:border-emerald-500 focus:bg-white transition"
                />
                <input
                  id="textarea-session-notes"
                  type="text"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="یادداشت کلی جلسه"
                  className="text-sm bg-slate-50 rounded-xl px-4 py-2.5 outline-none border border-transparent focus:border-emerald-500 focus:bg-white transition"
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
        </div>

        {/* لیست دانش‌آموزان */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-2 border-t border-slate-100">
          {classStudents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">دانش‌آموزی در این کلاس ثبت نشده است.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {classStudents.map((student, idx) => {
                const rec = records[student.id] || ({ studentId: student.id, status: 'present' } as StudentAttendanceRecord);
                const status = rec.status === 'excused' ? 'absent' : rec.status;
                const expanded = expandedId === student.id;
                const hasExtra = rec.score !== undefined || !!rec.note || rec.disciplinaryWarning?.hasWarning || (rec.homeworkStatus && rec.homeworkStatus !== 'done');

                return (
                  <li key={student.id} className="py-2">
                    <div className="flex items-center gap-3">
                      <span className="hidden sm:block w-7 text-center text-xs font-bold text-slate-400 shrink-0">{toPersianDigits(idx + 1)}</span>

                      <button
                        type="button"
                        onClick={() => onSelectStudent && onSelectStudent(student)}
                        className="flex-1 min-w-0 text-right text-sm font-bold text-slate-800 truncate hover:text-emerald-700 transition cursor-pointer"
                      >
                        {student.firstName} {student.lastName}
                      </button>

                      {status === 'late' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={toPersianDigits(rec.delayMinutes || 10)}
                            onChange={(e) => {
                              const n = parseInt(toEnglishDigits(e.target.value).replace(/[^0-9]/g, ''), 10);
                              setStudentDelay(student.id, Math.min(90, Math.max(1, isNaN(n) ? 1 : n)));
                            }}
                            aria-label="دقیقه تأخیر"
                            className="w-10 text-center text-xs font-bold bg-amber-50 text-amber-800 rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-amber-300"
                          />
                          <span className="text-[10px] text-amber-700 font-bold">دقیقه</span>
                        </div>
                      )}

                      {/* سگمنت سه‌حالته */}
                      <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-extrabold shrink-0">
                        {([
                          ['present', 'حاضر', 'bg-emerald-600 text-white shadow-sm'],
                          ['absent', 'غایب', 'bg-rose-600 text-white shadow-sm'],
                          ['late', 'تأخیر', 'bg-amber-500 text-white shadow-sm'],
                        ] as const).map(([value, label, activeCls]) => (
                          <button
                            key={value}
                            type="button"
                            id={`btn-status-${value}-${student.id}`}
                            onClick={() => setStudentStatus(student.id, value)}
                            className={`px-2.5 sm:px-4 py-2 rounded-[10px] transition cursor-pointer ${
                              status === value ? activeCls : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenWarningModal(student)}
                        title={rec.disciplinaryWarning?.hasWarning ? 'ویرایش اخطار کلاسی' : 'ثبت اخطار کلاسی'}
                        aria-label="ثبت اخطار کلاسی"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer shrink-0 ${
                          rec.disciplinaryWarning?.hasWarning ? 'bg-rose-100 text-rose-700' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-700'
                        }`}
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : student.id)}
                        title="جزئیات بیشتر"
                        aria-label="جزئیات بیشتر"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer shrink-0 ${
                          expanded || hasExtra ? 'bg-emerald-50 text-emerald-700' : 'text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {expanded && (
                      <div className="mt-2 mr-10 bg-slate-50 rounded-2xl p-3 grid sm:grid-cols-2 gap-3 text-xs animate-in fade-in">
                        <label className="flex items-center gap-2 font-bold text-slate-600">
                          <span className="shrink-0">نمره مستمر</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={rec.score !== undefined ? toPersianDigits(rec.score) : ''}
                            onChange={(e) => setStudentScore(student.id, toEnglishDigits(e.target.value))}
                            placeholder="—"
                            className="w-16 text-center font-bold bg-white rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-emerald-300"
                          />
                          <span className="text-slate-400 font-normal">از ۲۰</span>
                        </label>

                        <label className="flex items-center gap-2 font-bold text-slate-600">
                          <span className="shrink-0">تکلیف</span>
                          <select
                            value={rec.homeworkStatus || 'done'}
                            onChange={(e) => setStudentHomework(student.id, e.target.value as HomeworkStatus)}
                            className="flex-1 bg-white rounded-lg px-2 py-1.5 outline-none cursor-pointer font-bold"
                          >
                            <option value="done">کامل</option>
                            <option value="incomplete">ناقص</option>
                            <option value="not_done">انجام نشده</option>
                          </select>
                        </label>

                        <input
                          type="text"
                          value={rec.note || ''}
                          onChange={(e) => setStudentNote(student.id, e.target.value)}
                          placeholder="یادداشت فردی..."
                          className="bg-white rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-300"
                        />

                        {rec.disciplinaryWarning?.hasWarning ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenWarningModal(student)}
                              className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>اخطار (-{toPersianDigits(rec.disciplinaryWarning.scoreDeduction)})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDisciplinaryWarning(student.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 rounded transition cursor-pointer"
                              title="حذف اخطار"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenWarningModal(student)}
                            className="px-3 py-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg font-bold flex items-center gap-1 justify-center cursor-pointer transition"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>ثبت اخطار کلاسی</span>
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* فوتر */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-100 flex items-center gap-3 shrink-0">
          <button
            type="button"
            id="btn-save-attendance-session"
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold rounded-2xl shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت حضور و غیاب'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 px-5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl transition cursor-pointer"
          >
            انصراف
          </button>
        </div>
      </div>

      {/* اخطار انضباطی کلاسی */}
      {warningStudent && (
        <div className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
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

            <form onSubmit={handleSaveDisciplinaryWarning} className="px-6 pb-6 pt-2 space-y-3">
              <select
                value={warningTitle}
                onChange={(e) => setWarningTitle(e.target.value)}
                className="w-full text-sm bg-slate-50 rounded-2xl px-4 py-3 font-bold outline-none focus:ring-4 focus:ring-emerald-100"
              >
                <option value="بی‌نظمی در کلاس درس">بی‌نظمی و برهم زدن نظم کلاس</option>
                <option value="عدم انجام تکالیف درسی">عدم انجام تکالیف درسی</option>
                <option value="بی‌توجهی به تذکرات دبیر">بی‌توجهی به تذکرات دبیر</option>
                <option value="همراه نداشتن کتاب یا وسایل کمک‌آموزشی">همراه نداشتن کتاب یا وسایل کمک‌آموزشی</option>
                <option value="رفتار نامناسب با همکلاسی‌ها">رفتار نامناسب با همکلاسی‌ها</option>
                <option value="تاخیر ورود به کلاس درس">تاخیر در ورود به کلاس درس</option>
              </select>

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={warningType}
                  onChange={(e) => setWarningType(e.target.value as any)}
                  className="text-sm bg-slate-50 rounded-2xl px-3 py-3 outline-none focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="behavior">رفتاری و انضباطی</option>
                  <option value="delay">تاخیر کلاسی</option>
                  <option value="absence">غیبت غیرموجه</option>
                  <option value="uniform">عدم رعایت پوشش</option>
                  <option value="other">سایر موارد</option>
                </select>
                <select
                  value={warningDeduction}
                  onChange={(e) => setWarningDeduction(Number(e.target.value))}
                  className="text-sm bg-slate-50 rounded-2xl px-3 py-3 font-bold outline-none focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="0.25">۰٫۲۵ نمره</option>
                  <option value="0.5">۰٫۵ نمره</option>
                  <option value="1">۱ نمره</option>
                  <option value="0">بدون کسر نمره</option>
                </select>
              </div>

              <textarea
                rows={2}
                value={warningDescription}
                onChange={(e) => setWarningDescription(e.target.value)}
                placeholder="توضیح کوتاه (اختیاری)"
                className="w-full text-sm bg-slate-50 rounded-2xl p-3 outline-none resize-none focus:ring-4 focus:ring-emerald-100"
              />

              <button
                type="submit"
                className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white text-base font-extrabold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-5 h-5" />
                <span>درج اخطار</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
