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
  CheckCircle,
  Loader2
} from 'lucide-react';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetClassId?: string;
  existingSession?: AttendanceSession | null;
  onSelectStudent?: (student: Student) => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  onClose,
  targetClassId,
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
  const [subject, setSubject] = useState<string>(currentUser.subject || 'درس عمومی');
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
      setSubject(currentUser.subject || 'درس');
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
  }, [existingSession, isOpen, targetClassId]);

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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        
        {/* Modal Top Header */}
        <div className="bg-gradient-to-l from-slate-900 to-slate-800 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {existingSession ? 'ویرایش جلسه حضور و غیاب' : 'ثبت جلسه حضور و غیاب جدید'}
              </h2>
              <p className="text-xs text-slate-300">
                استاد: {currentUser.name} {currentUser.subject ? `• درس ${currentUser.subject}` : ''}
              </p>
            </div>
          </div>
          <button
            id="btn-close-attendance-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Settings & Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              id="tab-btn-attendance"
              onClick={() => setActiveTab('attendance')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'attendance'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>لیست دانش‌آموزان و غیبت‌ها</span>
            </button>
            <button
              id="tab-btn-details"
              onClick={() => setActiveTab('details')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'details'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>مبحث تدریس، تکالیف و نکات ({lessonTopic ? 'ثبت‌شده' : 'خالی'})</span>
            </button>
          </div>

          {/* Realtime Stats Pills */}
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              حاضر: {toPersianDigits(presentCount)} نفر
            </span>
            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              غایب: {toPersianDigits(absentCount)} نفر
            </span>
            {lateCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                تاخیر: {toPersianDigits(lateCount)} نفر
              </span>
            )}
            {excusedCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                موجه: {toPersianDigits(excusedCount)} نفر
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white font-bold">
              درصد حضور: {toPersianDigits(attendanceRate)}٪
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Top Session Config Bar & Approved Bell Banner */}
          <div className="space-y-3">
            {/* Auto Timetable Banner */}
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 text-xs text-indigo-950">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold flex items-center gap-1.5">
                    <span>ساعت پیش‌فرض کلاس:</span>
                    <span className="text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200 font-mono">
                      {toPersianDigits(startTime)} الی {toPersianDigits(endTime)}
                    </span>
                    {bellPeriodName && (
                      <span className="bg-indigo-200/70 text-indigo-900 px-2 py-0.5 rounded-md text-[11px] font-bold">
                        ({bellPeriodName})
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    ساعت این کلاس توسط مدیر یا معاونت آموزش مشخص شده و نیازی به تغییر دستی توسط معلم نیست.
                  </p>
                </div>
              </div>

              {/* Quick Bell Period Chips for instant switch */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[10px] text-slate-500 font-bold ml-1">تغییر زنگ:</span>
                {bellPeriods.map((bp) => (
                  <button
                    key={bp.id}
                    type="button"
                    onClick={() => handleSelectBellPeriod(bp.id)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                      selectedBellId === bp.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-indigo-200/60'
                    }`}
                    title={`${bp.name}: ${bp.startTime} الی ${bp.endTime}`}
                  >
                    {bp.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              {/* Class Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  کلاس درس
                </label>
                <select
                  id="select-session-class"
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  disabled={!!existingSession}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {accessibleClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان ماده درسی
                </label>
                <input
                  id="input-session-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="مثلاً: فیزیک، حسابان"
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Date Picker (Shamsi) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>روز و تاریخ تدریس (شمسی)</span>
                  <button
                    type="button"
                    onClick={() => handleDateChange(todayInfo.formattedDate)}
                    className="text-[10px] text-emerald-600 font-semibold hover:underline"
                  >
                    امروز
                  </button>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="input-session-date"
                    type="text"
                    value={date}
                    onChange={(e) => handleDateChange(e.target.value)}
                    placeholder="1404/08/15"
                    className="w-full text-xs font-mono font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                    dir="ltr"
                  />
                  <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap bg-slate-100 px-2 py-2 rounded-lg border border-slate-200">
                    {dayOfWeek}
                  </span>
                </div>
              </div>

              {/* Time Slot (Readonly / Customizable) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>ساعت برگزاری</span>
                  <span className="text-[10px] text-indigo-600 font-normal">خودکار</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="07:45"
                    className="w-full text-xs font-mono text-center bg-slate-50 border border-slate-200 rounded-lg py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    dir="ltr"
                  />
                  <span className="text-xs text-slate-400">تا</span>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="09:15"
                    className="w-full text-xs font-mono text-center bg-slate-50 border border-slate-200 rounded-lg py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: Attendance Marking Table */}
          {activeTab === 'attendance' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl">
                <div className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>تعداد کل دانش‌آموزان این کلاس: {toPersianDigits(classStudents.length)} نفر</span>
                </div>
                <button
                  type="button"
                  id="btn-mark-all-present"
                  onClick={markAllPresent}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>حاضر کردن همه دانش‌آموزان</span>
                </button>
              </div>

              {classStudents.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  هنوز دانش‌آموزی در این کلاس ثبت نشده است. از بخش مدیریت کلاس، دانش‌آموزان را اضافه نمایید.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-12 text-center">ردیف</th>
                        <th className="p-3">نام و نام خانوادگی</th>
                        <th className="p-3">وضعیت حضور و غیاب</th>
                        <th className="p-3 w-28 text-center">نمره مستمر (۰-۲۰)</th>
                        <th className="p-3 w-32 text-center">وضعیت تکلیف</th>
                        <th className="p-3 w-36 text-center">اخطار انضباطی کلاسی</th>
                        <th className="p-3">یادداشت دبیر</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classStudents.map((student, idx) => {
                        const rec = records[student.id] || { studentId: student.id, status: 'present' };
                        const currentStatus = rec.status || 'present';

                        return (
                          <tr 
                            key={student.id} 
                            className={`transition-colors ${
                              currentStatus === 'absent' 
                                ? 'bg-rose-50/60' 
                                : currentStatus === 'late'
                                  ? 'bg-amber-50/60'
                                  : currentStatus === 'excused'
                                    ? 'bg-blue-50/60'
                                    : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Index */}
                            <td className="p-3 text-center font-bold text-slate-500">
                              {toPersianDigits(idx + 1)}
                            </td>

                            {/* Student Name */}
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => onSelectStudent && onSelectStudent(student)}
                                className="text-right hover:text-emerald-700 hover:underline font-bold text-slate-900 cursor-pointer block"
                                title="مشاهده مشخصات و پرونده دانش‌آموز"
                              >
                                {student.firstName} {student.lastName}
                              </button>
                            </td>

                            {/* Status Buttons */}
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Present */}
                                <button
                                  type="button"
                                  id={`btn-status-present-${student.id}`}
                                  onClick={() => setStudentStatus(student.id, 'present')}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                    currentStatus === 'present'
                                      ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                                      : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>حاضر</span>
                                </button>

                                {/* Absent */}
                                <button
                                  type="button"
                                  id={`btn-status-absent-${student.id}`}
                                  onClick={() => setStudentStatus(student.id, 'absent')}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                    currentStatus === 'absent'
                                      ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300'
                                      : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'
                                  }`}
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>غایب</span>
                                </button>

                                {/* Late */}
                                <button
                                  type="button"
                                  id={`btn-status-late-${student.id}`}
                                  onClick={() => setStudentStatus(student.id, 'late')}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                    currentStatus === 'late'
                                      ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-300'
                                      : 'bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                                  }`}
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>تاخیر</span>
                                </button>

                                {/* Excused */}
                                <button
                                  type="button"
                                  id={`btn-status-excused-${student.id}`}
                                  onClick={() => setStudentStatus(student.id, 'excused')}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                    currentStatus === 'excused'
                                      ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                                      : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
                                  }`}
                                >
                                  <FileCheck className="w-3.5 h-3.5" />
                                  <span>موجه</span>
                                </button>

                                {/* If Late, show minutes input */}
                                {currentStatus === 'late' && (
                                  <div className="flex items-center gap-1 mr-1">
                                    <input
                                      type="number"
                                      min="1"
                                      max="90"
                                      value={rec.delayMinutes || 10}
                                      onChange={(e) => setStudentDelay(student.id, Number(e.target.value))}
                                      className="w-14 text-center font-bold text-xs bg-white border border-amber-300 rounded px-1 py-1 focus:ring-1 focus:ring-amber-500 outline-none"
                                    />
                                    <span className="text-[10px] text-amber-800 font-medium">دقیقه</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Continuous Score */}
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                step="0.5"
                                value={rec.score !== undefined ? rec.score : ''}
                                onChange={(e) => setStudentScore(student.id, e.target.value)}
                                placeholder="--"
                                className="w-14 text-center font-bold text-xs bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                            </td>

                            {/* Homework Check */}
                            <td className="p-3 text-center">
                              <select
                                value={rec.homeworkStatus || 'done'}
                                onChange={(e) => setStudentHomework(student.id, e.target.value as HomeworkStatus)}
                                className={`text-[11px] font-bold rounded-lg px-2 py-1.5 border outline-none cursor-pointer ${
                                  rec.homeworkStatus === 'done'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : rec.homeworkStatus === 'incomplete'
                                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                                      : 'bg-rose-50 border-rose-200 text-rose-800'
                                }`}
                              >
                                <option value="done">✔ کامل</option>
                                <option value="incomplete">⚠ ناقص</option>
                                <option value="not_done">✖ انجام نشده</option>
                              </select>
                            </td>

                            {/* Disciplinary Warning for Teacher */}
                            <td className="p-3 text-center">
                              {rec.disciplinaryWarning?.hasWarning ? (
                                <div className="inline-flex items-center gap-1 justify-center">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenWarningModal(student)}
                                    className="px-2 py-1 bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-800 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    title={`اخطار: ${rec.disciplinaryWarning.title}`}
                                  >
                                    <ShieldAlert className="w-3 h-3 text-rose-600" />
                                    <span>اخطار (-{toPersianDigits(rec.disciplinaryWarning.scoreDeduction)})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDisciplinaryWarning(student.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                    title="حذف اخطار"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWarningModal(student)}
                                  className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-dashed border-slate-200 hover:border-rose-300 transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                >
                                  <ShieldAlert className="w-3 h-3 text-slate-400" />
                                  <span>+ اخطار کلاسی</span>
                                </button>
                              )}
                            </td>

                            {/* Note */}
                            <td className="p-3">
                              <input
                                type="text"
                                value={rec.note || ''}
                                onChange={(e) => setStudentNote(student.id, e.target.value)}
                                placeholder="یادداشت فردی..."
                                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Lesson Topic, Homework, Notes */}
          {activeTab === 'details' && (
            <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span>مبحث و سرفصل تدریس شده در این جلسه <span className="text-red-500">*</span></span>
                </label>
                <textarea
                  id="textarea-lesson-topic"
                  rows={3}
                  value={lessonTopic}
                  onChange={(e) => setLessonTopic(e.target.value)}
                  placeholder="مثال: فصل ۳ - حل مسائل انرژی پتانسیل کشسانی و پایستگی انرژی مکانیکی، صفحات ۶۵ تا ۶۸ کتاب درسی"
                  className="w-full text-xs leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>تکالیف داده شده برای جلسه آینده</span>
                </label>
                <textarea
                  id="textarea-homework"
                  rows={2}
                  value={homeworkDescription}
                  onChange={(e) => setHomeworkDescription(e.target.value)}
                  placeholder="مثال: حل تمرین‌های شماره ۱ تا ۱۰ انتهای فصل + حل آزمونک آنلاین سامانه"
                  className="w-full text-xs leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-slate-500" />
                  <span>یادداشت‌ها و نکات کلی جلسه (انضباط کلاسی، آزمونک و غیره)</span>
                </label>
                <textarea
                  id="textarea-session-notes"
                  rows={2}
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="مثال: پرسش کلاسی از ۵ نفر اول لیست به عمل آمد. نظم کلاس عالی بود."
                  className="w-full text-xs leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/80 rounded-xl transition cursor-pointer"
          >
            انصراف
          </button>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-save-attendance-session"
              onClick={handleSave}
              disabled={isSubmitting}
              className={`px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-md shadow-emerald-700/20 flex items-center gap-1.5 cursor-pointer ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت و ذخیره نهایی جلسه'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Disciplinary Warning Dialog for Teacher */}
      {warningStudent && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-sm">
                  ثبت اخطار انضباطی کلاسی برای {warningStudent.firstName} {warningStudent.lastName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setWarningStudent(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDisciplinaryWarning} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نوع و عنوان تخلف:
                </label>
                <select
                  value={warningTitle}
                  onChange={(e) => setWarningTitle(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="بی‌نظمی در کلاس درس">بی‌نظمی و برهم زدن نظم کلاس</option>
                  <option value="عدم انجام تکالیف درسی">عدم انجام تکالیف درسی</option>
                  <option value="بی‌توجهی به تذکرات دبیر">بی‌توجهی به تذکرات دبیر</option>
                  <option value="همراه نداشتن کتاب یا وسایل کمک‌آموزشی">همراه نداشتن کتاب یا وسایل کمک‌آموزشی</option>
                  <option value="رفتار نامناسب با همکلاسی‌ها">رفتار نامناسب با همکلاسی‌ها</option>
                  <option value="تاخیر ورود به کلاس درس">تاخیر در ورود به کلاس درس</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    دسته‌بندی:
                  </label>
                  <select
                    value={warningType}
                    onChange={(e) => setWarningType(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 font-medium outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="behavior">رفتاری و انضباطی</option>
                    <option value="delay">تاخیر کلاسی</option>
                    <option value="absence">غیبت غیرموجه</option>
                    <option value="uniform">عدم رعایت پوشش</option>
                    <option value="other">سایر موارد</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    میزان کسر نمره انضباط:
                  </label>
                  <select
                    value={warningDeduction}
                    onChange={(e) => setWarningDeduction(Number(e.target.value))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-800 font-bold outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="0.25">۰.۲۵ نمره (تذکر جدی)</option>
                    <option value="0.5">۰.۵ نمره (اخطار استاندارد)</option>
                    <option value="1">۱.۰ نمره (تخلف شدید)</option>
                    <option value="0">بدون کسر نمره (فقط ثبت تذکر)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  توضیحات تکمیلی دبیر برای پرونده دانش‌آموز:
                </label>
                <textarea
                  rows={2}
                  value={warningDescription}
                  onChange={(e) => setWarningDescription(e.target.value)}
                  placeholder="توضیح کوتاه در مورد مورد پیش‌آمده..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-[11px] text-rose-800 leading-relaxed">
                ℹ️ با ذخیره این اخطار و ثبت نهایی جلسه، این مورد مستقیماً در کارنامه انضباطی دانش‌آموز درج شده و معاونت انضباطی مطلع می‌گردد.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setWarningStudent(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>تایید و درج اخطار</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
