import React, { useState, useEffect, useMemo } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { 
  Student, 
  SchoolClass, 
  DisciplinaryNote, 
  MorningDelayRecord, 
  AttendanceSession 
} from '../types';
import { useSchool } from '../context/SchoolContext';
import { StudentGrowthChart } from './StudentGrowthChart';
import { AddDisciplineModal } from './AddDisciplineModal';
import { MorningDelayModal } from './MorningDelayModal';
import { SchoolAbsenceModal } from './SchoolAbsenceModal';
import { generateComprehensiveAcademicReport } from '../utils/academicAnalysis';
import { exportStudentIndividualReportToExcel } from '../utils/excelExport';
import { 
  toPersianDigits, 
  formatShamsiDisplay, 
  getTodayShamsi, 
  getDayOfWeekFromShamsi 
} from '../utils/persianDate';
import {
  X,
  User,
  GraduationCap,
  Award,
  Calendar,
  CheckCircle2,
  UserX,
  Clock,
  Phone,
  Edit3,
  Save,
  Printer,
  FileSpreadsheet,
  BookOpen,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Send,
  Check,
  ShieldAlert,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2,
  Activity,
  ShieldCheck,
  CheckCircle,
  FileText,
  Info,
  Loader2
} from 'lucide-react';

export type ProfileTab = 'overview' | 'info' | 'attendance' | 'discipline' | 'grades';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  initialTab?: ProfileTab;
  onOpenAttendanceForClass?: (classId: string) => void;
  onOpenGradeEntry?: (classId: string) => void;
  onOpenAcademicGrades?: (classId: string, subjectId?: string) => void;
}

interface TimelineEvent {
  id: string;
  type: 'discipline' | 'morning_delay' | 'session_delay' | 'session_absence' | 'school_absence';
  title: string;
  description: string;
  date: string;
  badgeText: string;
  badgeClass: string;
  iconType: 'discipline' | 'delay' | 'absence';
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  initialTab = 'overview',
  onOpenAttendanceForClass,
  onOpenGradeEntry,
  onOpenAcademicGrades,
}) => {
  const { 
    students, 
    classes, 
    sessions, 
    morningDelays, 
    schoolAbsences,
    academicGrades, 
    academicSubjects, 
    updateStudent,
    deleteDisciplinaryNote,
    deleteMorningDelay,
    deleteSchoolAbsence,
    showToast,
    deleteStudent,
    showConfirm,
    isAdminOrVice,
  } = useSchool();

  // Always bind to the most up-to-date student record from SchoolContext
  const currentStudent = useMemo(() => {
    if (!student) return null;
    return students.find((s) => s.id === student.id) || student;
  }, [students, student]);

  // Tab State
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sub-modals inside profile for direct actions
  const [isAddDisciplineOpen, setIsAddDisciplineOpen] = useState(false);
  const [isAddDelayOpen, setIsAddDelayOpen] = useState(false);
  const [isAddAbsenceOpen, setIsAddAbsenceOpen] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [smsCopied, setSmsCopied] = useState(false);

  // Attendance tab sub-filter
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'absent' | 'late' | 'excused' | 'graded'>('all');

  // Edit form state
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editStudentCode, setEditStudentCode] = useState('');
  const [editNationalId, setEditNationalId] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Synchronize state when modal opens or student changes
  useEffect(() => {
    if (isOpen && currentStudent) {
      setActiveTab(initialTab || 'overview');
      setIsEditing(false);
      setEditFirstName(currentStudent.firstName || '');
      setEditLastName(currentStudent.lastName || '');
      setEditFatherName(currentStudent.fatherName || '');
      setEditStudentCode(currentStudent.studentCode || '');
      setEditNationalId(currentStudent.nationalId || '');
      setEditParentPhone(currentStudent.parentPhone || '');
      setEditNotes(currentStudent.notes || '');
    }
  }, [isOpen, currentStudent?.id, initialTab]);

  // Class Info
  const studentClass = useMemo(() => {
    if (!currentStudent) return undefined;
    return classes.find((c) => c.id === currentStudent.classId);
  }, [classes, currentStudent]);

  // Morning Delays for this student
  const studentMorningDelays = useMemo(() => {
    if (!currentStudent) return [];
    return morningDelays
      .filter((d) => d.studentId === currentStudent.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [morningDelays, currentStudent]);

  // School Absences (عدم حضور در کل روز مدرسه)
  const studentSchoolAbsences = useMemo(() => {
    if (!currentStudent) return [];
    return (schoolAbsences || [])
      .filter((a) => a.studentId === currentStudent.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [schoolAbsences, currentStudent]);

  // Attendance Sessions for this student's class
  const classSessions = useMemo(() => {
    if (!currentStudent) return [];
    return sessions
      .filter((s) => s.classId === currentStudent.classId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, currentStudent]);

  // Session Logs for this student
  const sessionLogs = useMemo(() => {
    if (!currentStudent) return [];
    return classSessions
      .map((session) => {
        const record = session.records[currentStudent.id];
        if (!record) return null;
        return {
          session,
          status: record.status,
          score: record.score,
          delayMinutes: record.delayMinutes,
          homeworkStatus: record.homeworkStatus,
          note: record.note,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [classSessions, currentStudent]);

  // Attendance Metrics
  const totalSessions = sessionLogs.length;
  const attendedCount = sessionLogs.filter((l) => l.status === 'present').length;
  const absentCount = sessionLogs.filter((l) => l.status === 'absent').length;
  const excusedCount = sessionLogs.filter((l) => l.status === 'excused').length;
  const classLateCount = sessionLogs.filter((l) => l.status === 'late').length;
  const morningLateCount = studentMorningDelays.length;
  const totalDelaysCount = classLateCount + morningLateCount;
  const scoresList = sessionLogs.filter((l) => l.score !== undefined);

  const attendanceRate = totalSessions > 0 
    ? Math.round((attendedCount / totalSessions) * 100) 
    : 100;

  // Disciplinary Metrics
  const disciplinaryNotes: DisciplinaryNote[] = useMemo(() => {
    return currentStudent?.disciplinaryNotes || [];
  }, [currentStudent]);

  const totalDeductedPoints = useMemo(() => {
    return disciplinaryNotes.reduce((sum, n) => sum + (Number(n.scoreDeduction) || 0), 0);
  }, [disciplinaryNotes]);

  const calculatedDisciplineScore = Math.max(0, 20 - totalDeductedPoints);
  const disciplineScore = currentStudent?.disciplineScore !== undefined 
    ? currentStudent.disciplineScore 
    : calculatedDisciplineScore;

  // Academic Report
  const studentAcademicGrades = useMemo(() => {
    if (!currentStudent) return [];
    return academicGrades.filter((g) => g.studentId === currentStudent.id);
  }, [academicGrades, currentStudent]);

  const academicReport = useMemo(() => {
    if (!currentStudent) {
      return {
        overallGrowthDelta: 0,
        growthCategory: 'stable',
        subjectAnalyses: [],
        strengths: [],
        weaknesses: [],
        recommendations: [],
      } as any;
    }
    return generateComprehensiveAcademicReport(
      currentStudent.id,
      studentAcademicGrades,
      classSessions
    );
  }, [currentStudent, studentAcademicGrades, classSessions]);

  // Recent Activity Timeline (Aggregated from real sources)
  const timelineEvents: TimelineEvent[] = useMemo(() => {
    if (!currentStudent) return [];
    const events: TimelineEvent[] = [];

    // 1. Disciplinary notes
    disciplinaryNotes.forEach((note) => {
      events.push({
        id: `disc-${note.id}`,
        type: 'discipline',
        title: note.title || 'ثبت مورد انضباطی',
        description: `${note.description || 'بدون توضیحات'}${note.scoreDeduction ? ` (کسر ${toPersianDigits(note.scoreDeduction)} نمره)` : ''}`,
        date: note.date,
        badgeText: note.scoreDeduction ? `کسر ${toPersianDigits(note.scoreDeduction)} نمره` : 'تذکر انضباطی',
        badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
        iconType: 'discipline',
      });
    });

    // 2. Morning delays
    studentMorningDelays.forEach((delay) => {
      events.push({
        id: `morning-${delay.id}`,
        type: 'morning_delay',
        title: 'تأخیر در ورود به مدرسه',
        description: `${toPersianDigits(delay.delayMinutes)} دقیقه تأخیر${delay.reason ? ` • دلیل: ${delay.reason}` : ''}`,
        date: delay.date,
        badgeText: `${toPersianDigits(delay.delayMinutes)} دقیقه تأخیر`,
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
        iconType: 'delay',
      });
    });

    // 3. Class absences & delays
    sessionLogs.forEach((log) => {
      if (log.status === 'absent') {
        events.push({
          id: `sess-abs-${log.session.id}`,
          type: 'session_absence',
          title: 'غیبت غیرموجه در کلاس',
          description: `درس ${log.session.subject || ''}${log.session.lessonTopic ? ` (${log.session.lessonTopic})` : ''}`,
          date: log.session.date,
          badgeText: 'غیبت غیرموجه',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
          iconType: 'absence',
        });
      } else if (log.status === 'excused') {
        events.push({
          id: `sess-exc-${log.session.id}`,
          type: 'session_absence',
          title: 'غیبت موجه در کلاس',
          description: `درس ${log.session.subject || ''}${log.session.lessonTopic ? ` (${log.session.lessonTopic})` : ''}`,
          date: log.session.date,
          badgeText: 'غیبت موجه',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
          iconType: 'absence',
        });
      } else if (log.status === 'late') {
        events.push({
          id: `sess-late-${log.session.id}`,
          type: 'session_delay',
          title: 'تأخیر در کلاس درس',
          description: `درس ${log.session.subject || ''} • ${toPersianDigits(log.delayMinutes || 10)} دقیقه تأخیر`,
          date: log.session.date,
          badgeText: `${toPersianDigits(log.delayMinutes || 10)} دقیقه تأخیر`,
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
          iconType: 'delay',
        });
      }
    });

    // 4. School Absences (غیبت کل روز مدرسه)
    studentSchoolAbsences.forEach((abs) => {
      events.push({
        id: `school-abs-${abs.id}`,
        type: 'school_absence',
        title: abs.isExcused ? 'غیبت موجه در کل روز مدرسه' : 'غیبت غیرموجه در مدرسه',
        description: `عدم حضور در مدرسه${abs.reason ? ` • دلیل: ${abs.reason}` : ''}${abs.parentContacted ? ' • تماس با اولیاء انجام شد' : ''}`,
        date: abs.date,
        badgeText: abs.isExcused ? 'غیبت موجه مدرسه' : 'غیبت غیرموجه مدرسه',
        badgeClass: abs.isExcused ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-rose-100 text-rose-800 border-rose-200',
        iconType: 'absence',
      });
    });

    // Sort descending by date
    events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return events;
  }, [currentStudent, disciplinaryNotes, studentMorningDelays, studentSchoolAbsences, sessionLogs]);

  // Latest Events Quick Checks
  const latestAbsence = useMemo(() => {
    const ev = timelineEvents.find((e) => e.type === 'session_absence');
    return ev ? ev.date : null;
  }, [timelineEvents]);

  const latestDelay = useMemo(() => {
    const ev = timelineEvents.find((e) => e.type === 'morning_delay' || e.type === 'session_delay');
    return ev ? { date: ev.date, text: ev.badgeText } : null;
  }, [timelineEvents]);

  const latestDiscipline = useMemo(() => {
    const ev = timelineEvents.find((e) => e.type === 'discipline');
    return ev ? { date: ev.date, title: ev.title } : null;
  }, [timelineEvents]);

  // Filtered session logs for Attendance Tab
  const filteredSessionLogs = useMemo(() => {
    if (attendanceFilter === 'all') return sessionLogs;
    if (attendanceFilter === 'absent') return sessionLogs.filter((l) => l.status === 'absent');
    if (attendanceFilter === 'late') return sessionLogs.filter((l) => l.status === 'late');
    if (attendanceFilter === 'excused') return sessionLogs.filter((l) => l.status === 'excused');
    if (attendanceFilter === 'graded') return sessionLogs.filter((l) => l.score !== undefined);
    return sessionLogs;
  }, [sessionLogs, attendanceFilter]);

  if (!isOpen || !currentStudent) return null;

  // Handlers
  const handleSaveStudentInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      updateStudent(currentStudent.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        fatherName: editFatherName.trim(),
        studentCode: editStudentCode.trim(),
        nationalId: editNationalId.trim(),
        parentPhone: editParentPhone.trim(),
        notes: editNotes.trim(),
      });
      showToast('ویرایش پرونده', `اطلاعات پرونده ${editFirstName.trim()} ${editLastName.trim()} با موفقیت به‌روزرسانی شد.`, 'success');
      setIsEditing(false);
    } catch {
      showToast('خطا در ذخیره پرونده', 'مشکلی در ثبت اطلاعات رخ داد. لطفاً مجدداً بررسی نمایید.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDelay = (delayId: string) => {
    try {
      deleteMorningDelay(delayId);
      showToast('حذف تأخیر', 'رکورد تأخیر صبحگاهی با موفقیت حذف گردید.', 'info');
    } catch {
      showToast('خطا در حذف', 'عملیات حذف با خطا مواجه شد.', 'error');
    }
  };

  const handleDeleteAbsence = (absenceId: string) => {
    try {
      deleteSchoolAbsence(absenceId);
      showToast('حذف غیبت', 'سوابق غیبت مدرسه با موفقیت حذف گردید.', 'info');
    } catch {
      showToast('خطا در حذف', 'عملیات حذف با خطا مواجه شد.', 'error');
    }
  };

  const handleDeleteDiscipline = (noteId: string) => {
    try {
      deleteDisciplinaryNote(currentStudent.id, noteId);
      showToast('حذف انضباطی', 'مورد انضباطی از پرونده دانش‌آموز حذف گردید.', 'info');
    } catch {
      showToast('خطا در حذف', 'عملیات حذف با خطا مواجه شد.', 'error');
    }
  };

  const handleOpenSms = () => {
    const text = `سلام و احترام؛
ولی محترم دانش‌آموز ${currentStudent.firstName} ${currentStudent.lastName}
گزارش وضعیت مدرسه یاوران ولایت:
• درصد حضور: ${toPersianDigits(attendanceRate)}٪ (غیبت غیرموجه: ${toPersianDigits(absentCount)} جلسه)
• مجموع تأخیرات: ${toPersianDigits(totalDelaysCount)} بار
• نمره انضباط فعلی: ${toPersianDigits(disciplineScore)} از ۲۰
${academicReport.annualGpa ? `• معدل سالانه: ${toPersianDigits(academicReport.annualGpa)}` : ''}

با تشکر - مدیریت مدرسه یاوران ولایت`;
    setSmsText(text);
    setSmsCopied(false);
    setSmsModalOpen(true);
  };

  const copySmsToClipboard = () => {
    navigator.clipboard.writeText(smsText);
    setSmsCopied(true);
    setTimeout(() => setSmsCopied(false), 2500);
  };

  const handleExportExcel = () => {
    exportStudentIndividualReportToExcel(
      currentStudent,
      studentClass,
      sessionLogs
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      id="student-profile-modal-backdrop"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200"
    >
      <div 
        id="student-profile-modal-container"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 text-slate-800"
      >
        {/* =========================================================================
            HEADER (مرحله ۳: مشخص، ساده، با عملکرد سریع)
        ========================================================================= */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            {/* Student Avatar / Initials */}
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-indigo-900/30 shrink-0">
              {currentStudent.firstName[0]}
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  {currentStudent.firstName} {currentStudent.lastName}
                </h2>
                {studentClass && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                    {studentClass.name} {studentClass.grade ? `(${studentClass.grade})` : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                <span>کد سناد: <strong className="text-slate-200 font-mono">{toPersianDigits(currentStudent.studentCode || 'ثبت نشده')}</strong></span>
                <span>•</span>
                <span>کد ملی: <strong className="text-slate-200 font-mono">{toPersianDigits(currentStudent.nationalId || 'ثبت نشده')}</strong></span>
                {currentStudent.fatherName && (
                  <>
                    <span>•</span>
                    <span>نام پدر: <strong className="text-slate-200">{currentStudent.fatherName}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-profile-edit-info"
              onClick={() => {
                setActiveTab('info');
                setIsEditing(true);
              }}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
              title="ویرایش مشخصات شناسنامه‌ای و پرونده"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">ویرایش مشخصات</span>
            </button>

            <button
              id="btn-profile-print"
              onClick={handlePrint}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer border border-slate-700"
              title="چاپ پرونده و کارنامه"
            >
              <Printer className="w-4 h-4 text-slate-300" />
            </button>

            <button
              id="btn-profile-excel"
              onClick={handleExportExcel}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer border border-slate-700"
              title="خروجی اکسل"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </button>

            <button
              id="btn-profile-sms"
              onClick={handleOpenSms}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="ارسال پیامک یا تماس با اولیاء"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">پیام به اولیاء</span>
            </button>

            <button
              id="btn-close-student-profile"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="بستن پرونده"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            OVERALL STATUS ROW (مرحله ۴: وضعیت کلی ۵ ثانیه‌ای)
        ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 text-xs">
          {/* Absences Card */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>تعداد غیبت</span>
              <UserX className={`w-3.5 h-3.5 ${absentCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            </div>
            <div className={`text-base sm:text-lg font-bold mt-1 ${absentCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {toPersianDigits(absentCount)} جلسه
              {excusedCount > 0 && (
                <span className="text-[10px] font-normal text-blue-600 mr-1.5">
                  (+ {toPersianDigits(excusedCount)} موجه)
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {absentCount === 0 ? 'بدون غیبت غیرموجه' : 'نیازمند پیگیری علت غیبت'}
            </div>
          </div>

          {/* Delays Card */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>تعداد تأخیرها</span>
              <Clock className={`w-3.5 h-3.5 ${totalDelaysCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
            </div>
            <div className={`text-base sm:text-lg font-bold mt-1 ${totalDelaysCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
              {toPersianDigits(totalDelaysCount)} مورد
              {morningLateCount > 0 && (
                <span className="text-[10px] font-normal text-slate-500 mr-1">
                  ({toPersianDigits(morningLateCount)} ورود)
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {totalDelaysCount === 0 ? 'ورود و حضور به‌موقع' : 'تأخیر کلاسی و صبحگاهی'}
            </div>
          </div>

          {/* Disciplinary Incidents Card */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>موارد انضباطی</span>
              <ShieldAlert className={`w-3.5 h-3.5 ${disciplinaryNotes.length > 0 ? 'text-purple-600' : 'text-slate-400'}`} />
            </div>
            <div className={`text-base sm:text-lg font-bold mt-1 ${disciplinaryNotes.length > 0 ? 'text-purple-700' : 'text-slate-700'}`}>
              {toPersianDigits(disciplinaryNotes.length)} مورد
              {totalDeductedPoints > 0 && (
                <span className="text-[10px] font-normal text-rose-600 mr-1">
                  (-{toPersianDigits(totalDeductedPoints)} نمره)
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {disciplinaryNotes.length === 0 ? 'پرونده انضباطی تمیز' : 'ثبت‌شده در پرونده'}
            </div>
          </div>

          {/* Discipline Score Card */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>نمره انضباط فعلی</span>
              <ShieldCheck className={`w-3.5 h-3.5 ${
                disciplineScore >= 18 ? 'text-emerald-600' : disciplineScore >= 15 ? 'text-amber-600' : 'text-rose-600'
              }`} />
            </div>
            <div className={`text-base sm:text-lg font-bold mt-1 font-mono ${
              disciplineScore >= 18 ? 'text-emerald-700' : disciplineScore >= 15 ? 'text-amber-700' : 'text-rose-700'
            }`}>
              {toPersianDigits(disciplineScore)} از ۲۰
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {disciplineScore >= 18 ? 'وضعیت عالی' : disciplineScore >= 15 ? 'هشدار انضباطی' : 'بحرانی'}
            </div>
          </div>
        </div>

        {/* =========================================================================
            TABS NAVIGATION (مرحله ۵: ۵ تب مشخص و منطقی)
        ========================================================================= */}
        <div className="flex items-center justify-between px-4 pt-2.5 pb-2 border-b border-slate-200 bg-white gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            <button
              id="tab-btn-overview"
              onClick={() => {
                setActiveTab('overview');
                setIsEditing(false);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'overview' && !isEditing
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>خلاصه پرونده</span>
            </button>

            <button
              id="tab-btn-personal-info"
              onClick={() => {
                setActiveTab('info');
                setIsEditing(false);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'info' && !isEditing
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>اطلاعات فردی</span>
            </button>

            <button
              id="tab-btn-attendance"
              onClick={() => {
                setActiveTab('attendance');
                setIsEditing(false);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'attendance' && !isEditing
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>حضور و غیاب ({toPersianDigits(sessionLogs.length)})</span>
            </button>

            <button
              id="tab-btn-discipline"
              onClick={() => {
                setActiveTab('discipline');
                setIsEditing(false);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'discipline' && !isEditing
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>انضباط ({toPersianDigits(disciplinaryNotes.length)})</span>
            </button>

            <button
              id="tab-btn-grades"
              onClick={() => {
                setActiveTab('grades');
                setIsEditing(false);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'grades' && !isEditing
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>کارنامه و نمرات</span>
            </button>
          </div>

          {currentStudent.parentPhone && (
            <a
              href={`tel:${currentStudent.parentPhone}`}
              className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1 shrink-0"
              title="تماس تلفنی با ولی دانش‌آموز"
            >
              <Phone className="w-3 h-3 text-emerald-600" />
              <span className="font-mono">{toPersianDigits(currentStudent.parentPhone)}</span>
            </a>
          )}
        </div>

        {/* =========================================================================
            SCROLLABLE BODY
        ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          
          {/* =======================================================================
              TAB 1: خلاصه پرونده (OVERVIEW) - مهم‌ترین بخش
          ======================================================================= */}
          {activeTab === 'overview' && !isEditing && (
            <div className="space-y-5">
              
              {/* Snapshot Row (آخرین غیبت، آخرین تأخیر، آخرین مورد انضباطی) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Latest Absence */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <UserX className="w-4 h-4 text-rose-500" />
                    <span className="font-bold">آخرین غیبت</span>
                  </div>
                  <div className="font-bold text-sm text-slate-800 font-mono">
                    {latestAbsence ? formatShamsiDisplay(latestAbsence) : 'بدون غیبت ثبت‌شده'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {latestAbsence ? 'ثبت در سیستم حضور و غیاب کلاسی' : 'حضور کامل در کلاس‌ها'}
                  </div>
                </div>

                {/* Latest Delay */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="font-bold">آخرین تأخیر</span>
                  </div>
                  <div className="font-bold text-sm text-slate-800 font-mono">
                    {latestDelay ? `${formatShamsiDisplay(latestDelay.date)} (${latestDelay.text})` : 'بدون تأخیر ثبت‌شده'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {latestDelay ? 'شامل تأخیر صبحگاهی و کلاسی' : 'ورود و حضور وقت‌شناسانه'}
                  </div>
                </div>

                {/* Latest Disciplinary */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <ShieldAlert className="w-4 h-4 text-purple-500" />
                    <span className="font-bold">آخرین مورد انضباطی</span>
                  </div>
                  <div className="font-bold text-sm text-slate-800 truncate" title={latestDiscipline ? latestDiscipline.title : ''}>
                    {latestDiscipline ? latestDiscipline.title : 'مورد انضباطی ثبت نشده'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 font-mono">
                    {latestDiscipline ? formatShamsiDisplay(latestDiscipline.date) : 'پرونده اخلاقی و انضباطی کامل'}
                  </div>
                </div>
              </div>

              {/* Direct Quick Actions Bar (مرحله ۱۲ و ۱۳: ثبت مستقیم از پرونده) */}
              <div className="bg-linear-to-r from-slate-900 to-indigo-950 p-4 rounded-2xl text-white shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>عملیات سریع برای {currentStudent.firstName} {currentStudent.lastName}</span>
                  </h3>
                  <p className="text-[11px] text-indigo-200 mt-0.5">
                    ثبت مستقیم با انتخاب خودکار این دانش‌آموز در سیستم واحد مدرسه
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    id="btn-quick-add-absence"
                    onClick={() => setIsAddAbsenceOpen(true)}
                    className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="ثبت غیبت برای این دانش‌آموز در کل روز مدرسه"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>ثبت غیبت مدرسه</span>
                  </button>

                  <button
                    id="btn-quick-add-discipline"
                    onClick={() => setIsAddDisciplineOpen(true)}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="ثبت مورد انضباطی در پرونده"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ثبت مورد انضباطی</span>
                  </button>

                  <button
                    id="btn-quick-add-delay"
                    onClick={() => setIsAddDelayOpen(true)}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="ثبت تأخیر ورود صبحگاهی"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>ثبت تأخیر ورود</span>
                  </button>

                  <button
                    id="btn-quick-view-grades"
                    onClick={() => setActiveTab('grades')}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-300" />
                    <span>مشاهده کارنامه</span>
                  </button>
                </div>
              </div>

              {/* Recent Activity Timeline (مرحله ۹: آخرین فعالیت‌ها) */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                      آخرین فعالیت‌ها و وقایع پرونده
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    ترتیب زمانی بر اساس آخرین تاریخ ثبت
                  </span>
                </div>

                {timelineEvents.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl text-slate-400 text-xs space-y-1">
                    <p className="font-semibold text-slate-600">هنوز رویدادی برای این دانش‌آموز ثبت نشده است.</p>
                    <p className="text-[11px]">تمام تأخیرات، غیبت‌ها و موارد انضباطی به‌صورت خودکار در این بخش نمایش داده می‌شوند.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {timelineEvents.slice(0, 6).map((ev) => (
                      <div key={ev.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 shrink-0">
                            {ev.iconType === 'discipline' && <ShieldAlert className="w-4 h-4 text-purple-600" />}
                            {ev.iconType === 'delay' && <Clock className="w-4 h-4 text-amber-600" />}
                            {ev.iconType === 'absence' && <UserX className="w-4 h-4 text-rose-600" />}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{ev.title}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{ev.description}</div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ev.badgeClass}`}>
                            {ev.badgeText}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatShamsiDisplay(ev.date)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* =======================================================================
              TAB 2: اطلاعات فردی و شناسنامه‌ای (PERSONAL INFO)
          ======================================================================= */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              {!isEditing ? (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">مشخصات سجلی و هویتی دانش‌آموز</h3>
                      <p className="text-xs text-slate-500 mt-0.5">اطلاعات پایه ثبت‌شده در سامانه</p>
                    </div>
                    <button
                      id="btn-toggle-edit-mode"
                      onClick={() => setIsEditing(true)}
                      className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>ویرایش اطلاعات</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-slate-400 text-[11px]">نام و نام خانوادگی</div>
                      <div className="font-bold text-slate-800 text-sm mt-1">
                        {currentStudent.firstName} {currentStudent.lastName}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-slate-400 text-[11px]">نام پدر</div>
                      <div className="font-bold text-slate-800 text-sm mt-1">
                        {currentStudent.fatherName || 'ثبت نشده'}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-slate-400 text-[11px]">کلاس و پایه تحصیلی</div>
                      <div className="font-bold text-slate-800 text-sm mt-1">
                        {studentClass ? `${studentClass.name} (${studentClass.grade || 'متوسطه اول'})` : 'ثبت نشده'}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-slate-400 text-[11px]">کد دانش‌آموزی (سناد)</div>
                      <div className="font-bold text-slate-800 text-sm mt-1 font-mono">
                        {toPersianDigits(currentStudent.studentCode || 'ثبت نشده')}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-slate-400 text-[11px]">کد ملی</div>
                      <div className="font-bold text-slate-800 text-sm mt-1 font-mono">
                        {toPersianDigits(currentStudent.nationalId || 'ثبت نشده')}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-slate-400 text-[11px]">شماره تماس ولی / سرپرست</div>
                      <div className="font-bold text-slate-800 text-sm mt-1 font-mono flex items-center justify-between">
                        <span>{toPersianDigits(currentStudent.parentPhone || 'ثبت نشده')}</span>
                        {currentStudent.parentPhone && (
                          <a 
                            href={`tel:${currentStudent.parentPhone}`}
                            className="text-indigo-600 hover:text-indigo-800 text-[11px]"
                          >
                            تماس مستقیم
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes / Special remarks */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="text-slate-500 font-bold mb-1">یادداشت‌ها و پرونده مشاوره‌ای / پزشکی دانش‌آموز:</div>
                    <p className="text-slate-700 leading-relaxed">
                      {currentStudent.notes || 'یادداشت یا نکته خاصی در پرونده ثبت نشده است.'}
                    </p>
                  </div>
                </div>
              ) : (
                /* Edit Mode Form */
                <form onSubmit={handleSaveStudentInfo} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">فرم ویرایش اطلاعات دانش‌آموز</h3>
                      <p className="text-xs text-slate-500 mt-0.5">تغییر مشخصات شناسنامه‌ای و شماره‌های ارتباطی</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        نام <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        نام خانوادگی <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        نام پدر
                      </label>
                      <input
                        type="text"
                        value={editFatherName}
                        onChange={(e) => setEditFatherName(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        کد سناد
                      </label>
                      <input
                        type="text"
                        value={editStudentCode}
                        onChange={(e) => setEditStudentCode(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-left"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        کد ملی
                      </label>
                      <input
                        type="text"
                        value={editNationalId}
                        onChange={(e) => setEditNationalId(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-left"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        شماره همراه ولی
                      </label>
                      <input
                        type="text"
                        value={editParentPhone}
                        onChange={(e) => setEditParentPhone(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-left"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      یادداشت‌ها و ملاحظات پرونده
                    </label>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="نکات ویژه آموزشی، مشاوره‌ای یا پزشکی..."
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {isAdminOrVice && (
                      <button
                        type="button"
                        onClick={() =>
                          showConfirm({
                            title: 'حذف کامل دانش‌آموز',
                            message: `آیا از حذف «${currentStudent.firstName} ${currentStudent.lastName}» اطمینان دارید؟ تمام سوابق حضور و غیاب، نمرات، تأخیرها و پرونده تربیتی این دانش‌آموز نیز حذف خواهد شد و قابل بازگشت نیست.`,
                            confirmLabel: 'حذف دانش‌آموز',
                            cancelLabel: 'انصراف',
                            isDangerous: true,
                            onConfirm: () => {
                              deleteStudent(currentStudent.id);
                              onClose();
                            },
                          })
                        }
                        disabled={isSubmitting}
                        className="ml-auto px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>حذف دانش‌آموز</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>{isSubmitting ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* =======================================================================
              TAB 3: حضور و غیاب و تأخیرها (ATTENDANCE & DELAYS)
          ======================================================================= */}
          {activeTab === 'attendance' && !isEditing && (
            <div className="space-y-4">
              
              {/* Filter & Action Toolbar */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-600 ml-1">فیلتر جلسات:</span>
                  <button
                    onClick={() => setAttendanceFilter('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      attendanceFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    همه ({toPersianDigits(sessionLogs.length)})
                  </button>
                  <button
                    onClick={() => setAttendanceFilter('absent')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      attendanceFilter === 'absent' ? 'bg-rose-600 text-white' : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
                    }`}
                  >
                    غیبت‌ها ({toPersianDigits(absentCount)})
                  </button>
                  <button
                    onClick={() => setAttendanceFilter('late')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      attendanceFilter === 'late' ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
                    }`}
                  >
                    تأخیرها ({toPersianDigits(classLateCount)})
                  </button>
                  <button
                    onClick={() => setAttendanceFilter('excused')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                      attendanceFilter === 'excused' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                    }`}
                  >
                    موجه‌ها ({toPersianDigits(excusedCount)})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddAbsenceOpen(true)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition cursor-pointer flex items-center gap-1"
                  >
                    <UserX className="w-3.5 h-3.5 text-rose-600" />
                    <span>ثبت غیبت مدرسه</span>
                  </button>
                  <button
                    onClick={() => setIsAddDelayOpen(true)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition cursor-pointer flex items-center gap-1"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>ثبت تأخیر ورود</span>
                  </button>
                </div>
              </div>

              {/* Class Sessions Table */}
              {filteredSessionLogs.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                  {attendanceFilter === 'absent' ? 'هیچ غیبتی برای این دانش‌آموز ثبت نشده است.' : 'جلسه‌ای با فیلتر انتخابی یافت نشد.'}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 w-10 text-center">ردیف</th>
                        <th className="p-3">تاریخ و روز</th>
                        <th className="p-3">درس و دبیر</th>
                        <th className="p-3">مبحث تدریس</th>
                        <th className="p-3 text-center">وضعیت حضور</th>
                        <th className="p-3 text-center">نمره</th>
                        <th className="p-3">توضیح / دلیل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSessionLogs.map((log, idx) => (
                        <tr 
                          key={log.session.id}
                          className={`transition ${
                            log.status === 'absent'
                              ? 'bg-rose-50/60'
                              : log.status === 'late'
                                ? 'bg-amber-50/60'
                                : log.status === 'excused'
                                  ? 'bg-blue-50/60'
                                  : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="p-3 text-center text-slate-400 font-bold">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="p-3 font-mono text-slate-700">
                            <div className="font-bold">{log.session.date}</div>
                            <div className="text-[10px] text-slate-400 font-sans">{log.session.dayOfWeek}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{log.session.subject}</div>
                            <div className="text-[10px] text-slate-500">{log.session.teacherName}</div>
                          </td>
                          <td className="p-3 text-slate-700 max-w-[180px] truncate" title={log.session.lessonTopic}>
                            {log.session.lessonTopic || '-'}
                          </td>
                          <td className="p-3 text-center">
                            {log.status === 'present' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                حاضر
                              </span>
                            )}
                            {log.status === 'absent' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                غایب غیرموجه
                              </span>
                            )}
                            {log.status === 'late' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                تاخیر ({toPersianDigits(log.delayMinutes || 10)}دقیقه)
                              </span>
                            )}
                            {log.status === 'excused' && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                غیبت موجه
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold font-mono">
                            {log.score !== undefined ? toPersianDigits(log.score) : '-'}
                          </td>
                          <td className="p-3 text-slate-600 text-[11px]">
                            {log.note || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Sub-section: Morning Delays (دفتر تأخیرهای ورود به مدرسه) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 mt-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                      سوابق تأخیر در ورود به مدرسه ({toPersianDigits(studentMorningDelays.length)} مورد)
                    </h4>
                  </div>
                  <button
                    onClick={() => setIsAddDelayOpen(true)}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ثبت تأخیر جدید</span>
                  </button>
                </div>

                {studentMorningDelays.length === 0 ? (
                  <div className="text-center py-5 text-slate-400 text-xs">
                    هنوز تأخیری در ورود به مدرسه برای این دانش‌آموز ثبت نشده است.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {studentMorningDelays.map((d) => (
                      <div key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-bold text-slate-800">
                            {toPersianDigits(d.delayMinutes)} دقیقه تأخیر
                            {d.reason && <span className="font-normal text-slate-500 mr-2">• دلیل: {d.reason}</span>}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            تاریخ: {formatShamsiDisplay(d.date)} {d.parentContacted ? '• تماس با ولی انجام شد' : ''}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteDelay(d.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="حذف رکورد تأخیر"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-section: School Absences (دفتر غیبت‌های کل روز مدرسه) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 mt-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <UserX className="w-4 h-4 text-rose-600" />
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                      سوابق غیبت در کل روز مدرسه ({toPersianDigits(studentSchoolAbsences.length)} مورد)
                    </h4>
                  </div>
                  <button
                    onClick={() => setIsAddAbsenceOpen(true)}
                    className="text-xs font-semibold text-rose-700 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ثبت غیبت جدید</span>
                  </button>
                </div>

                {studentSchoolAbsences.length === 0 ? (
                  <div className="text-center py-5 text-slate-400 text-xs">
                    هنوز غیبتی در مدرسه برای این دانش‌آموز ثبت نشده است.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {studentSchoolAbsences.map((a) => (
                      <div key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              a.isExcused ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              {a.isExcused ? 'موجه' : 'غیرموجه'}
                            </span>
                            <span className="font-bold text-slate-800">
                              {a.reason || (a.isExcused ? 'غیبت موجه با اطلاع قبلی' : 'غیبت بدون اطلاع')}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-1">
                            تاریخ: {formatShamsiDisplay(a.date)} {a.parentContacted ? '• تماس با ولی انجام شد' : ''}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteAbsence(a.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="حذف رکورد غیبت مدرسه"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* =======================================================================
              TAB 4: پرونده و سوابق انضباطی (DISCIPLINE) - سیستم واحد
          ======================================================================= */}
          {activeTab === 'discipline' && !isEditing && (
            <div className="space-y-4">
              
              {/* Discipline Score Overview Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs text-slate-500">وضعیت فعلی انضباط دانش‌آموز:</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xl font-bold font-mono ${
                      disciplineScore >= 18 ? 'text-emerald-700' : disciplineScore >= 15 ? 'text-amber-700' : 'text-rose-700'
                    }`}>
                      {toPersianDigits(disciplineScore)} از ۲۰
                    </span>
                    <span className="text-xs text-slate-400">
                      (مجموع کسر امتیاز: {toPersianDigits(totalDeductedPoints)} نمره)
                    </span>
                  </div>
                </div>

                <button
                  id="btn-discipline-add-note"
                  onClick={() => setIsAddDisciplineOpen(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>ثبت مورد انضباطی جدید</span>
                </button>
              </div>

              {/* Disciplinary Notes List */}
              {disciplinaryNotes.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs space-y-2">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="font-bold text-slate-700">هنوز مورد انضباطی برای این دانش‌آموز ثبت نشده است.</p>
                  <p className="text-slate-500 text-[11px]">نمره انضباط کامل (۲۰) و وضعیت اخلاقی و رفتاری عالی است.</p>
                  <button
                    onClick={() => setIsAddDisciplineOpen(true)}
                    className="mt-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ثبت اولین مورد انضباطی</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {disciplinaryNotes.map((note) => (
                    <div 
                      key={note.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <ShieldAlert className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">
                              {note.title}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              تاریخ ثبت: {formatShamsiDisplay(note.date)} {note.recordedBy ? `• ثبت‌کننده: ${note.recordedBy}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {note.scoreDeduction ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              کسر {toPersianDigits(note.scoreDeduction)} نمره
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              تذکر بدون کسر نمره
                            </span>
                          )}

                          <button
                            onClick={() => handleDeleteDiscipline(note.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="حذف این مورد انضباطی"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {note.description && (
                        <p className="text-xs text-slate-600 leading-relaxed pr-6 bg-slate-50 p-2.5 rounded-lg">
                          {note.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* =======================================================================
              TAB 5: کارنامه رسمی و نمودار رشد (GRADES & REPORTS)
          ======================================================================= */}
          {activeTab === 'grades' && !isEditing && (
            <div className="space-y-6">
              
              {/* Interactive Growth Trend Chart */}
              <StudentGrowthChart 
                grades={studentAcademicGrades} 
                studentName={`${currentStudent.firstName} ${currentStudent.lastName}`} 
              />

              {/* 4-Period Official Grade Sheet */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      کارنامه تفکیکی دروس (مستمر اول، پایانی اول، مستمر دوم، پایانی دوم)
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">
                      معدل کل سالانه: <b className="text-indigo-700 font-mono">{toPersianDigits(academicReport.annualGpa ?? '-')}</b>
                    </span>
                    {onOpenGradeEntry && studentClass && (
                      <button
                        onClick={() => {
                          onClose();
                          onOpenGradeEntry(studentClass.id);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ثبت و ویرایش نمرات این کلاس</span>
                      </button>
                    )}
                  </div>
                </div>

                {academicReport.subjectAnalyses.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs space-y-2">
                    <p>هنوز نمره رسمی برای این دانش‌آموز ثبت نشده است.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] sm:text-xs">
                        <tr>
                          <th className="p-3 w-10 text-center">ردیف</th>
                          <th className="p-3 font-bold min-w-[140px]">عنوان درس</th>
                          <th className="p-2.5 text-center w-14">ضریب</th>
                          <th className="p-2.5 text-center bg-amber-50/70 text-amber-900 font-bold min-w-[75px]">
                            مستمر ۱
                          </th>
                          <th className="p-2.5 text-center bg-amber-100/70 text-amber-950 font-bold min-w-[75px]">
                            پایانی ۱
                          </th>
                          <th className="p-2.5 text-center bg-emerald-50/70 text-emerald-900 font-bold min-w-[75px]">
                            مستمر ۲
                          </th>
                          <th className="p-2.5 text-center bg-emerald-100/70 text-emerald-950 font-bold min-w-[75px]">
                            پایانی ۲
                          </th>
                          <th className="p-2.5 text-center bg-indigo-50 text-indigo-950 font-bold min-w-[85px]">
                            نمره سالانه
                          </th>
                          <th className="p-2.5 text-center min-w-[70px]">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {academicReport.subjectAnalyses.map((sub: any, idx: number) => (
                          <tr key={sub.subjectId} className="hover:bg-slate-50 transition">
                            <td className="p-3 text-center text-slate-400 font-bold">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{sub.subjectName}</div>
                              {sub.teacherName && (
                                <div className="text-[10px] text-slate-400">استاد: {sub.teacherName}</div>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-bold text-slate-600 font-mono">
                              {toPersianDigits(sub.coefficient)}
                            </td>
                            <td className="p-2.5 text-center bg-amber-50/30 font-bold font-mono text-slate-800">
                              {sub.term1Continuous !== undefined ? toPersianDigits(sub.term1Continuous) : '-'}
                            </td>
                            <td className="p-2.5 text-center bg-amber-50/60 font-bold font-mono text-slate-800">
                              {sub.term1Final !== undefined ? toPersianDigits(sub.term1Final) : '-'}
                            </td>
                            <td className="p-2.5 text-center bg-emerald-50/30 font-bold font-mono text-slate-800">
                              {sub.term2Continuous !== undefined ? toPersianDigits(sub.term2Continuous) : '-'}
                            </td>
                            <td className="p-2.5 text-center bg-emerald-50/60 font-bold font-mono text-slate-800">
                              {sub.term2Final !== undefined ? toPersianDigits(sub.term2Final) : '-'}
                            </td>
                            <td className="p-2.5 text-center bg-indigo-50/70">
                              <span className={`font-mono font-bold text-sm ${
                                sub.annualScore !== undefined
                                  ? sub.annualScore >= 14 ? 'text-indigo-700' : sub.annualScore >= 10 ? 'text-emerald-700' : 'text-rose-600'
                                  : 'text-slate-400'
                              }`}>
                                {sub.annualScore !== undefined ? toPersianDigits(sub.annualScore) : '-'}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                sub.passStatus === 'passed'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : sub.passStatus === 'conditional'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}>
                                {sub.passStatus === 'passed' ? 'قبول' : sub.passStatus === 'conditional' ? 'تبصره' : 'تجدید'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* =========================================================================
            FOOTER
        ========================================================================= */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            کلاس: <strong className="text-slate-800">{studentClass?.name || 'نامشخص'}</strong> • سال تحصیلی {getActiveAcademicYear()}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition cursor-pointer"
            >
              بستن پرونده
            </button>
          </div>
        </div>

      </div>

      {/* =======================================================================
          INTEGRATED ACTION MODALS (Pre-selected with THIS student)
      ======================================================================= */}
      {/* 1. Add Disciplinary Note Modal (Unified System) */}
      <AddDisciplineModal
        isOpen={isAddDisciplineOpen}
        onClose={() => setIsAddDisciplineOpen(false)}
        initialStudent={currentStudent}
        students={students}
        classes={classes}
      />

      {/* 2. Morning Delay Modal (Unified System) */}
      <MorningDelayModal
        isOpen={isAddDelayOpen}
        onClose={() => setIsAddDelayOpen(false)}
        initialStudent={currentStudent}
      />

      {/* 3. School Absence Modal (غیبت در کل روز مدرسه) */}
      <SchoolAbsenceModal
        isOpen={isAddAbsenceOpen}
        onClose={() => setIsAddAbsenceOpen(false)}
        initialStudent={currentStudent}
      />

      {/* 3. SMS Dialog */}
      {smsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-indigo-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-300" />
                <h3 className="text-sm font-bold">متن پیامک به ولی دانش‌آموز</h3>
              </div>
              <button
                onClick={() => setSmsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-xs text-slate-600">
                گیرنده: <strong>{currentStudent.firstName} {currentStudent.lastName}</strong> (شماره: <span className="font-mono">{currentStudent.parentPhone || 'ثبت نشده'}</span>)
              </div>

              <textarea
                rows={7}
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                className="w-full text-xs font-sans bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={copySmsToClipboard}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {smsCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Send className="w-4 h-4" />}
                  <span>{smsCopied ? 'کپی شد ✔' : 'کپی متن پیامک'}</span>
                </button>

                {currentStudent.parentPhone && (
                  <a
                    href={`sms:${currentStudent.parentPhone}?body=${encodeURIComponent(smsText)}`}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>ارسال پیامک</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
