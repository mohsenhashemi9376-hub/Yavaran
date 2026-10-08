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
import { generateComprehensiveAcademicReport } from '../utils/academicAnalysis';
import { exportStudentIndividualReportToExcel } from '../utils/excelExport';
import { 
  toPersianDigits, 
  formatShamsiDisplay, 
  formatShamsiWithWeekday,
  getTodayShamsi, 
  getDayOfWeekFromShamsi,
  toEnglishDigits
} from '../utils/persianDate';
import { formatDelayText } from '../utils/morningAttendance';
import { summarizeActivity } from '../utils/classroomActivity';
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
import { studentFullName } from '../utils/studentName';
import { summarizeStudentDelays, DELAY_MINUTES_PER_POINT, DELAY_POINTS_DEDUCTED, formatMinutesLong } from '../utils/delays';

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
    morningAttendance,
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
    isTeacher,
  } = useSchool();

  // دبیر فقط نام دانش‌آموز و سوابق خودش (حضور و غیاب و نمرات درس خودش) را می‌بیند؛ نه مشخصات و نه موارد انضباطی/تربیتی
  const teacherView = isTeacher;

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
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [smsCopied, setSmsCopied] = useState(false);

  // Attendance tab sub-filter
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'absent' | 'late'>('all');

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
      setActiveTab(teacherView && (initialTab === 'info' || initialTab === 'discipline') ? 'overview' : initialTab || 'overview');
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

  // حضور و غیاب صبحگاه: رکوردهای ثبت‌شده + غیبت ضمنی امروز (حضور هنوز ثبت نشده)
  const morningLogs = useMemo(() => {
    if (!currentStudent) return [];
    const today = getTodayShamsi().formattedDate;
    const rows = (morningAttendance || [])
      .filter((r) => r.studentId === currentStudent.id)
      .filter((r) => r.status === 'absent' || r.delayMinutes > 0)
      .map((r) => ({
        id: r.id,
        date: r.date,
        dayOfWeek: r.dayOfWeek,
        status: r.status,
        isExcused: Boolean(r.isExcused),
        note: r.absenceNote || '',
        entryTime: r.entryTime,
        delayMinutes: r.delayMinutes,
        recordedBy: r.recordedBy,
      }));
    const hasToday = (morningAttendance || []).some((r) => r.studentId === currentStudent.id && r.date === today);
    if (!hasToday) {
      rows.push({
        id: `implicit-${today}`,
        date: today,
        dayOfWeek: getTodayShamsi().dayOfWeek,
        status: 'absent',
        isExcused: false,
        note: '',
        entryTime: undefined,
        delayMinutes: 0,
        recordedBy: '',
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [morningAttendance, currentStudent]);

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

  // سوابق یکپارچه غیبت و تأخیر: صبحگاه (سامانه جدید + دفترهای قدیمی) و کلاسی
  const attendanceRecords = useMemo(() => {
    type Row = {
      id: string;
      date: string;
      kind: 'morning' | 'class';
      eventLabel: string;
      type: 'absent' | 'late';
      isExcused: boolean;
      entryTime?: string;
      delayMinutes: number;
      note: string;
      recordedBy: string;
    };
    const rows: Row[] = [];

    morningLogs.forEach((l) => {
      if (l.status !== 'absent' && !(l.delayMinutes > 0)) return;
      rows.push({
        id: `ma-${l.id}`,
        date: l.date,
        kind: 'morning',
        eventLabel: 'صبحگاه',
        type: l.status === 'absent' ? 'absent' : 'late',
        isExcused: l.status === 'absent' && l.isExcused,
        entryTime: l.entryTime,
        delayMinutes: l.status === 'absent' ? 0 : l.delayMinutes,
        note: l.note,
        recordedBy: l.recordedBy || '',
      });
    });
    studentMorningDelays.forEach((d) =>
      rows.push({
        id: `md-${d.id}`,
        date: d.date,
        kind: 'morning',
        eventLabel: 'صبحگاه',
        type: 'late',
        isExcused: false,
        entryTime: d.arrivalTime,
        delayMinutes: d.delayMinutes,
        note: [d.reason, d.parentContacted ? 'تماس با اولیاء انجام شد' : ''].filter(Boolean).join(' • '),
        recordedBy: d.recordedBy || '',
      })
    );
    studentSchoolAbsences.forEach((a) =>
      rows.push({
        id: `sa-${a.id}`,
        date: a.date,
        kind: 'morning',
        eventLabel: 'صبحگاه',
        type: 'absent',
        isExcused: Boolean(a.isExcused),
        delayMinutes: 0,
        note: [a.reason, a.parentContacted ? 'تماس با اولیاء انجام شد' : '', a.notes].filter(Boolean).join(' • '),
        recordedBy: a.recordedBy || '',
      })
    );
    sessionLogs.forEach((l) => {
      if (l.status === 'present') return;
      rows.push({
        id: `cs-${l.session.id}`,
        date: l.session.date,
        kind: 'class',
        eventLabel: `${l.session.subject}${l.session.bellPeriodName ? ` • ${l.session.bellPeriodName}` : ''}`,
        type: l.status === 'late' ? 'late' : 'absent',
        isExcused: l.status === 'excused',
        delayMinutes: l.status === 'late' ? l.delayMinutes || 10 : 0,
        note: l.note || '',
        recordedBy: l.session.teacherName || '',
      });
    });
    return rows.sort((a, b) => toEnglishDigits(b.date).localeCompare(toEnglishDigits(a.date)));
  }, [morningLogs, studentMorningDelays, studentSchoolAbsences, sessionLogs]);

  const attendanceAbsentRows = attendanceRecords.filter((r) => r.type === 'absent');
  const attendanceLateRows = attendanceRecords.filter((r) => r.type === 'late');
  const filteredAttendanceRecords =
    attendanceFilter === 'absent' ? attendanceAbsentRows : attendanceFilter === 'late' ? attendanceLateRows : attendanceRecords;

  /** سوئیچ به تب حضور و غیاب با فیلتر مشخص (کارت‌های آماری بالای پرونده) */
  const openAttendanceTab = (filter: 'all' | 'absent' | 'late') => {
    setAttendanceFilter(filter);
    setActiveTab('attendance');
    setIsEditing(false);
  };

  // Attendance Metrics
  const totalSessions = sessionLogs.length;
  const attendedCount = sessionLogs.filter((l) => l.status === 'present').length;
  const absentCount = sessionLogs.filter((l) => l.status === 'absent').length;
  const excusedCount = sessionLogs.filter((l) => l.status === 'excused').length;
  const classLateCount = sessionLogs.filter((l) => l.status === 'late').length;
  const morningLateCount = studentMorningDelays.length;
  const legacyAbsentCount = studentSchoolAbsences.filter((a) => !a.isExcused).length;
  const legacyExcusedCount = studentSchoolAbsences.filter((a) => a.isExcused).length;
  const morningAbsentCount = morningLogs.filter((l) => l.status === 'absent' && !l.isExcused).length;
  const morningExcusedCount = morningLogs.filter((l) => l.status === 'absent' && l.isExcused).length;
  const morningAttendanceLateCount = morningLogs.filter((l) => l.status === 'present' && l.delayMinutes > 0).length;
  const totalAbsentCount = absentCount + morningAbsentCount + legacyAbsentCount;
  const totalExcusedCount = excusedCount + morningExcusedCount + legacyExcusedCount;
  const totalDelaysCount = classLateCount + morningLateCount + morningAttendanceLateCount;
  const scoresList = sessionLogs.filter((l) => l.score !== undefined);

  // مجموع دقایق تأخیر (مبنای کسر خودکار نمره انضباط)
  const delaySummary = currentStudent
    ? summarizeStudentDelays(currentStudent, { morningDelays, morningAttendance, sessions })
    : { count: 0, minutes: 0 };
  const autoDeductedPoints = Math.floor(delaySummary.minutes / DELAY_MINUTES_PER_POINT) * DELAY_POINTS_DEDUCTED;
  const minutesToNextPoint = DELAY_MINUTES_PER_POINT - (delaySummary.minutes % DELAY_MINUTES_PER_POINT);

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
ولی محترم دانش‌آموز ${studentFullName(currentStudent)}
گزارش وضعیت مدرسه یاوران ولایت:
• درصد حضور: ${toPersianDigits(attendanceRate)}٪ (غیبت غیرموجه: ${toPersianDigits(totalAbsentCount)} مورد)
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
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* کل پنجره یک کانتینر اسکرول‌شونده است (بدون اسکرول داخلی تودرتو) */}
      <div 
        id="student-profile-modal-container"
        className="bg-slate-50 rounded-3xl shadow-2xl shadow-slate-900/10 w-full max-w-4xl max-h-[96vh] overflow-y-auto text-slate-800"
      >
        {/* ===================== HEADER ===================== */}
        <div className="bg-white px-5 sm:px-7 pt-5 pb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-extrabold shrink-0">
              {currentStudent.firstName[0]}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold text-slate-900 truncate">
                {studentFullName(currentStudent)}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                {studentClass && (
                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                    {studentClass.name}
                  </span>
                )}
                {currentStudent.studentCode && <span>کد: {toPersianDigits(currentStudent.studentCode)}</span>}
                {currentStudent.fatherName && <span>پدر: {currentStudent.fatherName}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!teacherView && (
            <>
            <button
              id="btn-profile-edit-info"
              onClick={() => {
                setActiveTab('info');
                setIsEditing(true);
              }}
              className="p-2.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
              title="ویرایش مشخصات"
            >
              <Edit3 className="w-5 h-5" />
            </button>
            <button
              id="btn-profile-print"
              onClick={handlePrint}
              className="p-2.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
              title="چاپ پرونده"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              id="btn-profile-excel"
              onClick={handleExportExcel}
              className="p-2.5 hover:bg-slate-100 text-slate-500 hover:text-emerald-700 rounded-xl transition cursor-pointer"
              title="خروجی اکسل"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </button>
            <button
              id="btn-profile-sms"
              onClick={handleOpenSms}
              className="p-2.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
              title="پیام به اولیاء"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            </>
            )}
            <button
              id="btn-close-student-profile"
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              title="بستن پرونده"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ===================== عملیات سریع ===================== */}
        {!teacherView && (
        <div className="bg-white px-5 sm:px-7 pb-5 grid grid-cols-1 gap-3">
          <button
            id="btn-quick-add-discipline"
            onClick={() => setIsAddDisciplineOpen(true)}
            className="h-16 rounded-2xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-extrabold text-sm transition flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 cursor-pointer"
          >
            <ShieldAlert className="w-6 h-6" />
            <span>ثبت مورد انضباطی</span>
          </button>
        </div>
        )}

        {/* ===================== آمار (با آخرین مورد) ===================== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 sm:px-7 pt-5 text-xs">
          <button
            type="button"
            onClick={() => openAttendanceTab('absent')}
            className="text-right bg-white p-4 rounded-2xl shadow-xs border border-transparent hover:bg-rose-50/60 hover:border-rose-200 transition cursor-pointer"
          >
            <div className="text-slate-500 text-xs">غیبت</div>
            <div className={`text-2xl font-extrabold mt-1 ${totalAbsentCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {toPersianDigits(totalAbsentCount)}
              {totalExcusedCount > 0 && (
                <span className="text-[11px] font-normal text-slate-400 mr-1.5">+{toPersianDigits(totalExcusedCount)} موجه</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {latestAbsence ? `آخرین: ${formatShamsiDisplay(latestAbsence)}` : 'بدون غیبت'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => openAttendanceTab('late')}
            className="text-right bg-white p-4 rounded-2xl shadow-xs border border-transparent hover:bg-amber-50/60 hover:border-amber-200 transition cursor-pointer"
          >
            <div className="text-slate-500 text-xs">تأخیر</div>
            <div className={`text-2xl font-extrabold mt-1 ${totalDelaysCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {toPersianDigits(totalDelaysCount)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {latestDelay ? `آخرین: ${formatShamsiDisplay(latestDelay.date)}` : 'بدون تأخیر'}
            </div>
            {delaySummary.minutes > 0 && (
              <div className="text-[11px] font-bold text-amber-700 mt-1">
                مجموع {toPersianDigits(delaySummary.minutes)} دقیقه
              </div>
            )}
          </button>

          <div className="bg-white p-4 rounded-2xl shadow-xs">
            <div className="text-slate-500 text-xs">موارد انضباطی</div>
            <div className={`text-2xl font-extrabold mt-1 ${disciplinaryNotes.length > 0 ? 'text-violet-600' : 'text-slate-800'}`}>
              {toPersianDigits(disciplinaryNotes.length)}
              {totalDeductedPoints > 0 && (
                <span className="text-[11px] font-normal text-rose-500 mr-1.5">-{toPersianDigits(totalDeductedPoints)} نمره</span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 truncate">
              {latestDiscipline ? `آخرین: ${latestDiscipline.title}` : 'پرونده تمیز'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-xs">
            <div className="text-slate-500 text-xs">نمره انضباط</div>
            <div className={`text-2xl font-extrabold mt-1 ${
              disciplineScore >= 18 ? 'text-emerald-600' : disciplineScore >= 15 ? 'text-amber-600' : 'text-rose-600'
            }`}>
              {toPersianDigits(disciplineScore)}<span className="text-sm font-normal text-slate-400"> از ۲۰</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {disciplineScore >= 18 ? 'وضعیت عالی' : disciplineScore >= 15 ? 'هشدار' : 'بحرانی'}
            </div>
          </div>
        </div>

        {/* =========================================================================
            TABS NAVIGATION (مرحله ۵: ۵ تب مشخص و منطقی)
        ========================================================================= */}
        <div className="flex items-center justify-between px-5 sm:px-7 pt-5 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            <button
              id="tab-btn-overview"
              onClick={() => {
                setActiveTab('overview');
                setIsEditing(false);
              }}
              className={`px-4 py-2.5 text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'overview' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>خلاصه پرونده</span>
            </button>

            {!teacherView && (
            <button
              id="tab-btn-personal-info"
              onClick={() => {
                setActiveTab('info');
                setIsEditing(false);
              }}
              className={`px-4 py-2.5 text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'info' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>اطلاعات فردی</span>
            </button>
            )}

            <button
              id="tab-btn-attendance"
              onClick={() => {
                setActiveTab('attendance');
                setIsEditing(false);
              }}
              className={`px-4 py-2.5 text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'attendance' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>حضور و غیاب ({toPersianDigits(attendanceRecords.length)})</span>
            </button>

            {!teacherView && (
            <button
              id="tab-btn-discipline"
              onClick={() => {
                setActiveTab('discipline');
                setIsEditing(false);
              }}
              className={`px-4 py-2.5 text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'discipline' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>انضباط ({toPersianDigits(disciplinaryNotes.length)})</span>
            </button>
            )}

            <button
              id="tab-btn-grades"
              onClick={() => {
                setActiveTab('grades');
                setIsEditing(false);
              }}
              className={`px-4 py-2.5 text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'grades' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
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
        <div className="p-5 sm:p-7 space-y-5">
          
          {/* =======================================================================
              TAB 1: خلاصه پرونده (OVERVIEW) - مهم‌ترین بخش
          ======================================================================= */}
          {activeTab === 'overview' && !isEditing && (
            <div className="space-y-5">
              
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
                        {studentFullName(currentStudent)}
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
                        {studentClass ? `${studentClass.name}` : 'ثبت نشده'}
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
                            message: `آیا از حذف «${studentFullName(currentStudent)}» اطمینان دارید؟ تمام سوابق حضور و غیاب، نمرات، تأخیرها و پرونده تربیتی این دانش‌آموز نیز حذف خواهد شد و قابل بازگشت نیست.`,
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
              {/* خلاصه فعالیت و تکالیف کلاسی */}
              {(() => {
                const sum = summarizeActivity(sessions, currentStudent.id, { classId: currentStudent.classId });
                return (
                  <div className="bg-sky-50/50 border border-sky-200/80 rounded-2xl p-3.5 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-sky-900 whitespace-nowrap">فعالیت و تکالیف کلاسی:</span>
                    {sum.total === 0 ? (
                      <span className="text-[11px] text-slate-500">هنوز ارزیابی روزانه‌ای ثبت نشده است.</span>
                    ) : (
                      <>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold whitespace-nowrap">⭐ {toPersianDigits(sum.excellent)} عالی</span>
                        <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-bold whitespace-nowrap">{toPersianDigits(sum.done)} انجام‌شده</span>
                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold whitespace-nowrap">{toPersianDigits(sum.incomplete)} ناقص</span>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* خلاصه غیبت و تأخیر + کسر خودکار نمره */}
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-l from-rose-50/60 via-white to-amber-50/70 p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-slate-500 font-bold">دفعات غیبت</div>
                  <div className="mt-1 text-lg font-black text-rose-700">
                    {toPersianDigits(totalAbsentCount + totalExcusedCount)}
                    <span className="text-[11px] font-bold text-slate-400 mr-1.5">
                      ({toPersianDigits(totalExcusedCount)} موجه)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-bold">مجموع دقایق تأخیر</div>
                  <div className="mt-1 text-lg font-black text-amber-700">
                    {toPersianDigits(delaySummary.minutes)} دقیقه
                    <span className="text-[11px] font-bold text-slate-400 mr-1.5">
                      در {toPersianDigits(delaySummary.count)} بار
                    </span>
                  </div>
                  {delaySummary.minutes >= 60 && (
                    <div className="text-[10px] text-slate-400 mt-0.5">معادل {toPersianDigits(formatMinutesLong(delaySummary.minutes))}</div>
                  )}
                </div>
                <div>
                  <div className="text-slate-500 font-bold">کسر خودکار نمره انضباط</div>
                  <div className={`mt-1 text-lg font-black ${autoDeductedPoints > 0 ? 'text-violet-700' : 'text-slate-700'}`}>
                    {autoDeductedPoints > 0 ? `−${toPersianDigits(autoDeductedPoints)} نمره` : 'بدون کسر'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    به‌ازای هر {toPersianDigits(DELAY_MINUTES_PER_POINT)} دقیقه تأخیر، {toPersianDigits(DELAY_POINTS_DEDUCTED)} نمره • {toPersianDigits(minutesToNextPoint)} دقیقه تا کسر بعدی
                  </div>
                </div>
              </div>

              {/* فیلترهای وضعیت */}
              <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="فیلتر سوابق">
                {([
                  ['all', 'همه موارد', attendanceRecords.length, 'bg-slate-50 text-slate-800 border-slate-200 ring-slate-300'],
                  ['absent', 'فقط غیبت‌ها', attendanceAbsentRows.length, 'bg-rose-50 text-rose-800 border-rose-200 ring-rose-300'],
                  ['late', 'فقط تأخیرها', attendanceLateRows.length, 'bg-amber-50 text-amber-800 border-amber-200 ring-amber-300'],
                ] as const).map(([key, label, count, cls]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={attendanceFilter === key}
                    onClick={() => setAttendanceFilter(key)}
                    className={`px-4 py-2 rounded-2xl border text-xs font-bold transition cursor-pointer whitespace-nowrap ${cls} ${
                      attendanceFilter === key ? 'ring-2 shadow-sm' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    {label} ({toPersianDigits(count)})
                  </button>
                ))}
              </div>

              {filteredAttendanceRecords.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                  {attendanceFilter === 'late'
                    ? 'هیچ تأخیری برای این دانش‌آموز ثبت نشده است.'
                    : attendanceFilter === 'absent'
                      ? 'هیچ غیبتی برای این دانش‌آموز ثبت نشده است.'
                      : 'سابقه‌ای برای این دانش‌آموز ثبت نشده است.'}
                </div>
              ) : (
                <div className="w-full border border-slate-200 rounded-2xl overflow-x-auto shadow-2xs">
                  <table className="w-full min-w-[750px] text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">تاریخ و روز</th>
                        <th className="p-3">نوع رویداد</th>
                        <th className="p-3">وضعیت</th>
                        <th className="p-3">توضیحات و علت</th>
                        <th className="p-3">ثبت‌کننده</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAttendanceRecords.map((r) => (
                        <tr key={r.id} className={r.type === 'absent' ? 'bg-rose-50/30' : 'bg-amber-50/30'}>
                          <td className="p-3 font-bold text-slate-700">
                            {formatShamsiWithWeekday(r.date)}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                r.kind === 'morning'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-sky-50 text-sky-700 border-sky-200'
                              }`}
                            >
                              {r.kind === 'morning' ? 'صبحگاه' : `کلاسی (${r.eventLabel})`}
                            </span>
                          </td>
                          <td className="p-3">
                            {r.type === 'absent' ? (
                              <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                  r.isExcused
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {r.isExcused ? 'غایب موجه' : 'غایب غیرموجه'}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                تأخیر
                                {r.entryTime ? ` • ورود ${toPersianDigits(r.entryTime)}` : ''}
                                {` • ${formatDelayText(r.delayMinutes)}`}
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-normal min-w-[220px]">
                            {r.note ? (
                              <div className="bg-slate-50 border border-slate-200 text-slate-700 text-[11px] leading-relaxed p-2 rounded-lg">{r.note}</div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-600">{r.recordedBy || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

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
                            {note.source === 'class_warning' && (
                              <span className="bg-violet-50 text-violet-800 border border-violet-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">اخطار کلاسی{note.subject ? ` • ${note.subject}` : ''}</span>
                            )}
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
                studentName={`${studentFullName(currentStudent)}`} 
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
                  <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] sm:text-xs">
                        <tr>
                          <th className="p-3 w-10 text-center">ردیف</th>
                          <th className="p-3 font-bold min-w-[140px]">عنوان درس</th>
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
                گیرنده: <strong>{studentFullName(currentStudent)}</strong> (شماره: <span className="font-mono">{currentStudent.parentPhone || 'ثبت نشده'}</span>)
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
