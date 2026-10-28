import { StudentMonthlyGradesTable } from './StudentMonthlyGradesTable';
import { monthlyGpa } from '../utils/monthlyReport';
import { examMonthLabel, examMonthsWithData, studentExamSummary, faExamPct } from '../utils/examReport';
import { scorePillClass, scoreLabel } from '../utils/gradePeriods';
import { ParentMeetingsProfileCard } from './ParentMeetingsProfileCard';
import React, { useState, useEffect, useMemo } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { 
  Student, 
  SchoolClass, 
  DisciplinaryNote, 
  MorningDelayRecord, 
  AttendanceSession 
} from '../types';
import { EditDisciplineNoteModal } from './EditDisciplineNoteModal';
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
import { nationalIdError, phoneError, realNationalId } from '../utils/validators';
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
  Loader2,
  ClipboardCheck,
  History,
  Pencil
} from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import { studentFullName } from '../utils/studentName';
import { StudentBadges } from './StudentBadges';
import { computeStudentBadges } from '../utils/studentBadges';
import { useBadgeSettings } from '../lib/badgeSettingsStore';
import { studentWorksheetHistory } from '../utils/worksheets';
import { summarizeStudentDelays, delayDeductionState, DELAY_MINUTES_PER_POINT, DELAY_POINTS_DEDUCTED, formatMinutesLong } from '../utils/delays';
import { FitTable } from './ui/FitTable';
import { StudentTimeline } from './StudentTimeline';
import { StudentEducationTab } from './StudentEducationTab';
import { useUnsavedGuard } from '../utils/unsavedGuard';

export type ProfileTab = 'overview' | 'info' | 'attendance' | 'discipline' | 'grades' | 'education' | 'timeline';

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
    isAdmin,
    isDisciplinaryVice,
    isTeacher,
    currentUser,
    worksheets,
    worksheetWeeks,
    todayClosedReason,
    comprehensiveExams,
  } = useSchool();

  // کاربرگ هفتگی: فقط کسانی که مجوز مشاهده/ثبت کاربرگ دارند (دبیر ندارد)
  const canSeeWorksheets = hasPermission(currentUser, 'view-worksheets') || hasPermission(currentUser, 'manage-worksheets');

  // دبیر فقط نام دانش‌آموز و سوابق خودش (حضور و غیاب و نمرات درس خودش) را می‌بیند؛ نه مشخصات و نه موارد انضباطی/تربیتی
  const teacherView = isTeacher;

  // Always bind to the most up-to-date student record from SchoolContext
  const currentStudent = useMemo(() => {
    if (!student) return null;
    return students.find((s) => s.id === student.id) || student;
  }, [students, student]);

  const badgeSettings = useBadgeSettings();

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
  const [editNationalId, setEditNationalId] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editMotherPhone, setEditMotherPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Synchronize state when modal opens or student changes
  useEffect(() => {
    if (isOpen && currentStudent) {
      setActiveTab(teacherView ? (initialTab === 'grades' || initialTab === 'education' ? initialTab : 'discipline') : initialTab === 'attendance' ? 'discipline' : initialTab || 'overview');
      setIsEditing(false);
      setEditFirstName(currentStudent.firstName || '');
      setEditLastName(currentStudent.lastName || '');
      setEditFatherName(currentStudent.fatherName || '');
      setEditNationalId(realNationalId(currentStudent.nationalId, currentStudent.studentCode));
      setEditParentPhone(currentStudent.parentPhone || '');
      setEditMotherPhone(currentStudent.motherPhone || '');
      setEditNotes(currentStudent.notes || '');
    }
  }, [isOpen, currentStudent?.id, initialTab]);

  // ویرایش مشخصات: تا ذخیره نشده، خروج از صفحه هشدار می‌دهد
  const profileEditDirty = Boolean(isOpen && isEditing && currentStudent && (
    editFirstName !== (currentStudent.firstName || '') ||
    editLastName !== (currentStudent.lastName || '') ||
    editFatherName !== (currentStudent.fatherName || '') ||
    editNationalId !== realNationalId(currentStudent.nationalId, currentStudent.studentCode) ||
    editParentPhone !== (currentStudent.parentPhone || '') ||
    editMotherPhone !== (currentStudent.motherPhone || '') ||
    editNotes !== (currentStudent.notes || '')
  ));
  useUnsavedGuard(profileEditDirty);

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
    if (!hasToday && !todayClosedReason) {
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
  }, [morningAttendance, currentStudent, todayClosedReason]);

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
      // غیبت‌های کلاسی (غایب/موجه در زنگ‌ها) در آمار غیبت دانش‌آموز نمی‌آیند؛ فقط تأخیر کلاسی شمرده می‌شود
      if (l.status !== 'late') return;
      rows.push({
        id: `cs-${l.session.id}`,
        date: l.session.date,
        kind: 'class',
        eventLabel: `${l.session.subject}${l.session.bellPeriodName ? ` • ${l.session.bellPeriodName}` : ''}`,
        type: 'late',
        isExcused: false,
        delayMinutes: l.delayMinutes || 0,
        note: l.note || '',
        recordedBy: l.session.teacherName || '',
      });
    });
    return rows.sort((a, b) => toEnglishDigits(b.date).localeCompare(toEnglishDigits(a.date)));
  }, [morningLogs, studentMorningDelays, studentSchoolAbsences, sessionLogs]);

  // دبیر فقط سوابقی را می‌بیند که خودش در جلسه‌های کلاسش برای این دانش‌آموز ثبت کرده
  const ownLogs = sessionLogs.filter((l) => l.session.teacherId === currentUser.id);
  const ownProblemLogs = ownLogs.filter((l) => l.status !== 'present');
  const ownAbsentCount = ownLogs.filter((l) => l.status === 'absent').length;
  const ownLateCount = ownLogs.filter((l) => l.status === 'late').length;

  const attendanceAbsentRows = attendanceRecords.filter((r) => r.type === 'absent');
  const attendanceLateRows = attendanceRecords.filter((r) => r.type === 'late');
  const filteredAttendanceRecords =
    attendanceFilter === 'absent' ? attendanceAbsentRows : attendanceFilter === 'late' ? attendanceLateRows : attendanceRecords;

  /** بعد از عوض شدن تب، تا بخش مورد نظر پایین می‌رود */
  const scrollToSection = (id: string) => {
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
  };

  /** سوئیچ به تب حضور و غیاب با فیلتر مشخص (کارت‌های آماری بالای پرونده) و رفتن به همان فهرست */
  const openAttendanceTab = (filter: 'all' | 'absent' | 'late') => {
    setAttendanceFilter(filter);
    setActiveTab('discipline');
    setIsEditing(false);
    scrollToSection('profile-attendance-list');
  };

  // Attendance Metrics
  const totalSessions = sessionLogs.length;
  const attendedCount = sessionLogs.filter((l) => l.status === 'present').length;
  const classLateCount = sessionLogs.filter((l) => l.status === 'late').length;
  const morningLateCount = studentMorningDelays.length;
  const legacyAbsentCount = studentSchoolAbsences.filter((a) => !a.isExcused).length;
  const legacyExcusedCount = studentSchoolAbsences.filter((a) => a.isExcused).length;
  const morningAbsentCount = morningLogs.filter((l) => l.status === 'absent' && !l.isExcused).length;
  const morningExcusedCount = morningLogs.filter((l) => l.status === 'absent' && l.isExcused).length;
  const morningAttendanceLateCount = morningLogs.filter((l) => l.status === 'present' && l.delayMinutes > 0).length;
  const totalAbsentCount = morningAbsentCount + legacyAbsentCount;
  const totalExcusedCount = morningExcusedCount + legacyExcusedCount;
  const totalDelaysCount = classLateCount + morningLateCount + morningAttendanceLateCount;
  const scoresList = sessionLogs.filter((l) => l.score !== undefined);

  // مجموع دقایق تأخیر (مبنای کسر خودکار نمره انضباط)
  const delaySummary = currentStudent
    ? summarizeStudentDelays(currentStudent, { morningDelays, morningAttendance, sessions })
    : { count: 0, minutes: 0 };
  const deductionState = delayDeductionState(currentStudent?.disciplinaryNotes, delaySummary.minutes);
  const autoDeductedPoints = (deductionState.approved + (currentStudent?.disciplinaryNotes || []).filter((n) => n.source === 'auto_delay').length) * DELAY_POINTS_DEDUCTED;
  const minutesToNextPoint = deductionState.minutesToNext;

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

  // معدل آزمون جامع دانش‌آموز (کل سال و هر ماه)؛ فقط وقتی نمره‌ای ثبت شده باشد
  const examSummary = useMemo(() => {
    if (!currentStudent) return null;
    const record = comprehensiveExams.find((r) => r.classId === currentStudent.classId);
    if (!record) return null;
    const total = studentExamSummary(record, currentStudent.id, 'all').gpa;
    if (total === undefined) return null;
    const months = examMonthsWithData(record)
      .map((m) => ({ key: m, label: examMonthLabel(m), gpa: studentExamSummary(record, currentStudent.id, m).gpa }))
      .filter((m) => m.gpa !== undefined) as { key: string; label: string; gpa: number }[];
    return { total, months };
  }, [comprehensiveExams, currentStudent]);

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
      // غیبت‌های کلاسی (غایب/موجه در زنگ‌ها) در سوابق غیبت دانش‌آموز نمی‌آیند
      if (log.status === 'late') {
        events.push({
          id: `sess-late-${log.session.id}`,
          type: 'session_delay',
          title: 'تأخیر در کلاس درس',
          description: `درس ${log.session.subject || ''} • ${toPersianDigits(log.delayMinutes || 0)} دقیقه تأخیر`,
          date: log.session.date,
          badgeText: `${toPersianDigits(log.delayMinutes || 0)} دقیقه تأخیر`,
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

  // نشان‌های افتخار (شرایط را مدیر مدرسه از تنظیمات تعیین می‌کند)
  const badges = currentStudent && !teacherView
    ? (() => {
        const delayDates = new Set(studentMorningDelays.map((d) => d.date));
        return computeStudentBadges({
          notes: disciplinaryNotes,
          unexcusedAbsenceDates: [
            ...morningLogs.filter((l) => l.status === 'absent' && !l.isExcused && !String(l.id).startsWith('implicit-')).map((l) => l.date),
            ...studentSchoolAbsences.filter((a) => !a.isExcused).map((a) => a.date),
          ],
          lates: [
            ...studentMorningDelays.map((d) => ({ date: d.date, time: d.arrivalTime })),
            ...morningLogs.filter((l) => l.status === 'present' && l.delayMinutes > 0 && !delayDates.has(l.date)).map((l) => ({ date: l.date, time: l.entryTime })),
          ],
          worksheetWeeks: studentWorksheetHistory(currentStudent.id, worksheets, worksheetWeeks).map((w) => ({ weekStart: w.weekStart, delivered: w.status !== 'missing' })),
          homework: sessionLogs.map((l) => ({ date: l.session.date, status: l.homeworkStatus })),
          grades: studentAcademicGrades,
        }, badgeSettings);
      })()
    : { discipline: false, academic: false };

  const [editingNote, setEditingNote] = useState<DisciplinaryNote | null>(null);

  if (!isOpen || !currentStudent) return null;

  // Handlers
  const handleSaveStudentInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const fieldError = nationalIdError(editNationalId) || phoneError(editParentPhone) || phoneError(editMotherPhone);
    if (fieldError) {
      showToast('اطلاعات نامعتبر', fieldError, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      updateStudent(currentStudent.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        fatherName: editFatherName.trim(),
        nationalId: editNationalId.trim(),
        parentPhone: editParentPhone.trim(),
        motherPhone: editMotherPhone.trim(),
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
${monthlyGpa(studentAcademicGrades, 'all') !== undefined ? `• میانگین نمرات ماهانه: ${toPersianDigits(monthlyGpa(studentAcademicGrades, 'all') as number)}` : ''}

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

  const requestClose = () => {
    if (!profileEditDirty) { onClose(); return; }
    showConfirm({
      title: 'تغییرات ذخیره نشده',
      message: 'ویرایش مشخصات هنوز ذخیره نشده است. با بستن پرونده تغییرات از بین می‌رود.',
      confirmLabel: 'بستن بدون ذخیره',
      cancelLabel: 'ادامه ویرایش',
      isDangerous: true,
      onConfirm: onClose,
    });
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
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      {/* کل پنجره یک کانتینر اسکرول‌شونده است (بدون اسکرول داخلی تودرتو) */}
      <div 
        id="student-profile-modal-container"
        className="bg-slate-50 rounded-3xl shadow-2xl shadow-slate-900/10 w-full max-w-4xl max-h-[96vh] overflow-y-auto text-slate-800"
      >
        {/* ===================== HEADER ===================== */}
        <div className="relative bg-white border-b border-slate-200 px-3 sm:px-6 py-3 pl-14 flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-extrabold shrink-0">
              {currentStudent.firstName[0]}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                {studentFullName(currentStudent)}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                {studentClass && (
                  <span className="px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                    {studentClass.name}
                  </span>
                )}
                {currentStudent.fatherName && <span>پدر: {currentStudent.fatherName}</span>}
              </div>
              {!teacherView && <StudentBadges badges={badges} settings={badgeSettings} />}
              {!teacherView && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {currentStudent.parentPhone && (
            <a
              href={`tel:${currentStudent.parentPhone}`}
              className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition flex items-center gap-1 shrink-0"
              title="تماس تلفنی با ولی دانش‌آموز"
            >
              <Phone className="w-3 h-3 text-emerald-600" />
              <span className="font-mono">{toPersianDigits(currentStudent.parentPhone)}</span>
            </a>
          )}
          {currentStudent.motherPhone && (
            <a
              href={`tel:${currentStudent.motherPhone}`}
              className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 transition flex items-center gap-1 shrink-0"
              title="تماس تلفنی با مادر دانش‌آموز"
            >
              <Phone className="w-3 h-3 text-rose-600" />
              <span>مادر:</span>
              <span className="font-mono">{toPersianDigits(currentStudent.motherPhone)}</span>
            </a>
          )}
              </div>
              )}
            </div>
          </div>

          <button
            id="btn-close-student-profile"
            onClick={requestClose}
            className="absolute top-2 left-2 w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            title="بستن پرونده"
            aria-label="بستن پرونده"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===================== نوار عملیات: دکمهٔ اصلی + ابزارها ===================== */}
        {!teacherView && (
        <div className="bg-white border-b border-slate-200 px-3 sm:px-6 pb-3 flex items-center gap-2">
          <button
            id="btn-quick-add-discipline"
            onClick={() => setIsAddDisciplineOpen(true)}
            className="flex-1 min-h-11 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-extrabold transition inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="whitespace-nowrap">ثبت مورد انضباطی</span>
          </button>
          <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-0.5 shrink-0">
            <button id="btn-profile-edit-info" onClick={() => { setActiveTab('info'); setIsEditing(true); }} className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition cursor-pointer" title="ویرایش مشخصات" aria-label="ویرایش مشخصات"><Edit3 className="w-5 h-5" /></button>
            <button id="btn-profile-print" onClick={handlePrint} className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition cursor-pointer" title="چاپ پرونده" aria-label="چاپ پرونده"><Printer className="w-5 h-5" /></button>
            <button id="btn-profile-sms" onClick={handleOpenSms} className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition cursor-pointer" title="پیام به اولیاء" aria-label="پیام به اولیاء"><MessageSquare className="w-5 h-5" /></button>
            <button id="btn-profile-excel" onClick={handleExportExcel} className="hidden sm:flex w-11 h-11 items-center justify-center text-slate-500 hover:text-emerald-700 hover:bg-white rounded-lg transition cursor-pointer" title="خروجی اکسل" aria-label="خروجی اکسل"><FileSpreadsheet className="w-5 h-5" /></button>
          </div>
        </div>
        )}

        {/* ===================== آمار (با آخرین مورد) ===================== */}
        {teacherView ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 px-3 sm:px-7 pt-3 sm:pt-5 text-xs">
          {([
            ['جلسه‌های من', ownLogs.length, 'text-slate-800', 'ثبت‌شده برای این دانش‌آموز'],
            ['غیبت در کلاس من', ownAbsentCount, ownAbsentCount > 0 ? 'text-rose-600' : 'text-slate-800', 'تعداد جلسه‌هایی که غایب بود'],
            ['تأخیر در کلاس من', ownLateCount, ownLateCount > 0 ? 'text-amber-600' : 'text-slate-800', 'تعداد جلسه‌هایی که دیر آمد'],
          ] as const).map(([label, value, tone, hint]) => (
            <div key={label} className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200">
              <div className="text-slate-500 text-xs">{label}</div>
              <div className={`text-xl sm:text-2xl font-extrabold mt-0.5 ${tone}`}>{toPersianDigits(value)}</div>
              <div className="text-[11px] text-slate-400 mt-1">{hint}</div>
            </div>
          ))}
        </div>
        ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 px-3 sm:px-6 pt-3 text-xs">
          {/* ۱) نمره انضباط */}
          <div className="order-1 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200">
            <div className="text-slate-500 text-xs font-bold">نمره انضباط</div>
            <div className={`mt-1 text-2xl font-extrabold ${disciplineScore >= 18 ? 'text-emerald-600' : disciplineScore >= 15 ? 'text-amber-600' : 'text-rose-600'}`}>
              {toPersianDigits(disciplineScore)}<span className="text-sm font-normal text-slate-400"> از ۲۰</span>
            </div>
            <div className={`mt-1 text-[11px] font-bold ${disciplineScore >= 18 ? 'text-emerald-700' : disciplineScore >= 15 ? 'text-amber-700' : 'text-rose-700'}`}>
              {disciplineScore >= 18 ? 'وضعیت عالی' : disciplineScore >= 15 ? 'هشدار' : 'بحرانی'}
            </div>
          </div>

          {/* ۲) موارد انضباطی */}
          <button
            type="button"
            onClick={() => { setActiveTab('discipline'); setIsEditing(false); scrollToSection('profile-discipline-notes'); }}
            className="order-3 lg:order-2 col-span-2 lg:col-span-1 text-right bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 hover:border-violet-300 transition cursor-pointer"
          >
            <div className="text-slate-500 text-xs font-bold">موارد انضباطی</div>
            <div className={`mt-1 text-2xl font-extrabold ${disciplinaryNotes.length > 0 ? 'text-violet-600' : 'text-slate-800'}`}>
              {toPersianDigits(disciplinaryNotes.length)}<span className="text-sm font-normal text-slate-400"> مورد</span>
              {totalDeductedPoints > 0 && <span className="text-[11px] font-bold text-rose-500 mr-1.5">(-{toPersianDigits(Math.round(totalDeductedPoints * 100) / 100)} نمره)</span>}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 truncate">{latestDiscipline ? `آخرین: ${latestDiscipline.title}` : 'پرونده تمیز'}</div>
            {deductionState.pending > 0 && (
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                {toPersianDigits(deductionState.pending)} کسر نمره منتظر تأیید
              </div>
            )}
          </button>

          {/* ۳) تأخیرها (هوشمند) */}
          <button
            type="button"
            onClick={() => openAttendanceTab('late')}
            className="order-4 lg:order-3 col-span-2 lg:col-span-1 text-right bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-300 transition cursor-pointer"
          >
            <div className="text-slate-500 text-xs font-bold">تأخیرها</div>
            <div className={`mt-1 text-2xl font-extrabold ${totalDelaysCount > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
              {toPersianDigits(totalDelaysCount)}<span className="text-sm font-normal text-slate-400"> بار</span>
            </div>
            {delaySummary.minutes > 0 ? (
              <>
                <div className="mt-1 text-[11px] text-slate-500">
                  مجموع {toPersianDigits(delaySummary.minutes)} دقیقه
                  {delaySummary.minutes >= 60 && <span className="text-slate-400"> · معادل {toPersianDigits(formatMinutesLong(delaySummary.minutes))}</span>}
                </div>
                <div className="mt-2" title={`${toPersianDigits(minutesToNextPoint)} دقیقه تا کسر بعدی`}>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={DELAY_MINUTES_PER_POINT} aria-valuenow={Math.max(0, DELAY_MINUTES_PER_POINT - minutesToNextPoint)}>
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, Math.max(0, ((DELAY_MINUTES_PER_POINT - minutesToNextPoint) / DELAY_MINUTES_PER_POINT) * 100))}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">{toPersianDigits(minutesToNextPoint)} دقیقه تا کسر نمرهٔ بعدی (هر {toPersianDigits(DELAY_MINUTES_PER_POINT)} دقیقه)</div>
                </div>
              </>
            ) : (
              <div className="mt-1 text-[11px] text-slate-400">بدون تأخیر</div>
            )}
          </button>

          {/* ۴) غیبت‌ها */}
          <button
            type="button"
            onClick={() => openAttendanceTab('absent')}
            className="order-2 lg:order-4 text-right bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 hover:border-rose-300 transition cursor-pointer"
          >
            <div className="text-slate-500 text-xs font-bold">غیبت‌ها</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-800">
              {toPersianDigits(totalExcusedCount)}<span className="text-sm font-normal text-slate-400"> موجه</span>
            </div>
            <div className={`mt-1 text-[11px] font-bold ${totalAbsentCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {toPersianDigits(totalAbsentCount)} غیرموجه
            </div>
            {latestAbsence && <div className="mt-0.5 text-[10px] text-slate-400">آخرین: {formatShamsiDisplay(latestAbsence)}</div>}
          </button>
        </div>
        )}

        {/* =========================================================================
            TABS NAVIGATION (مرحله ۵: ۵ تب مشخص و منطقی)
        ========================================================================= */}
        <div className="flex items-center px-3 sm:px-6 pt-3">
          <div className="flex items-center gap-1.5 py-1 max-w-full overflow-x-auto whitespace-nowrap flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {!teacherView && (
            <button
              id="tab-btn-overview"
              onClick={() => {
                setActiveTab('overview');
                setIsEditing(false);
              }}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'overview' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white/70 backdrop-blur text-slate-600 hover:bg-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>خلاصه پرونده</span>
            </button>
            )}

            {!teacherView && (
            <button
              id="tab-btn-personal-info"
              onClick={() => {
                setActiveTab('info');
                setIsEditing(false);
              }}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'info' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white/70 backdrop-blur text-slate-600 hover:bg-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>اطلاعات فردی</span>
            </button>
            )}

            <button
              id="tab-btn-discipline"
              onClick={() => {
                setActiveTab('discipline');
                setIsEditing(false);
              }}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'discipline' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white/70 backdrop-blur text-slate-600 hover:bg-white'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{teacherView ? `سوابق من (${toPersianDigits(ownProblemLogs.length)})` : `انضباط و حضور (${toPersianDigits(disciplinaryNotes.length + attendanceRecords.length)})`}</span>
            </button>

            <button
              id="tab-btn-grades"
              onClick={() => {
                setActiveTab('grades');
                setIsEditing(false);
              }}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'grades' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white/70 backdrop-blur text-slate-600 hover:bg-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>کارنامه و نمرات</span>
            </button>

            {!teacherView && (
            <button
              id="tab-btn-timeline"
              onClick={() => {
                setActiveTab('timeline');
                setIsEditing(false);
              }}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'timeline' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white/70 backdrop-blur text-slate-600 hover:bg-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>خط زمانی</span>
            </button>
            )}

            <button
              id="tab-btn-education"
              onClick={() => {
                setActiveTab('education');
                setIsEditing(false);
              }}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                activeTab === 'education' && !isEditing
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white/70 backdrop-blur text-slate-600 hover:bg-white'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>آموزش و تکالیف</span>
            </button>
          </div>

        </div>

        {/* =========================================================================
            SCROLLABLE BODY
        ========================================================================= */}
        <div className="p-3 sm:p-7 space-y-4 sm:space-y-5">
          
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
                      <div className="text-slate-400 text-[11px]">کد ملی</div>
                      <div className="font-bold text-slate-800 text-sm mt-1 font-mono">
                        {toPersianDigits(realNationalId(currentStudent.nationalId, currentStudent.studentCode) || 'ثبت نشده')}
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

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-slate-400 text-[11px]">شماره تماس مادر</div>
                      <div className="font-bold text-slate-800 text-sm mt-1 font-mono flex items-center justify-between">
                        <span>{toPersianDigits(currentStudent.motherPhone || 'ثبت نشده')}</span>
                        {currentStudent.motherPhone && (
                          <a
                            href={`tel:${currentStudent.motherPhone}`}
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

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        شماره همراه مادر
                      </label>
                      <input
                        type="text"
                        value={editMotherPhone}
                        onChange={(e) => setEditMotherPhone(e.target.value)}
                        placeholder="اختیاری"
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
          {activeTab === 'discipline' && !isEditing && teacherView && (
            <div className="space-y-3" id="profile-attendance-list">
              <p className="text-xs text-slate-500 leading-6">فقط مواردی که خودتان در جلسه‌های کلاس برای این دانش‌آموز ثبت کرده‌اید نمایش داده می‌شود.</p>
              {ownProblemLogs.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs">
                  هنوز غیبت، تأخیر یا یادداشتی از طرف شما برای این دانش‌آموز ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-2">
                  {ownProblemLogs.map((l) => (
                    <div key={l.session.id} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-800">{formatShamsiWithWeekday(l.session.date)}</span>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          l.status === 'absent' ? 'bg-rose-50 text-rose-700 border-rose-200' : l.status === 'late' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {l.status === 'absent' ? 'غایب' : l.status === 'late' ? `تأخیر${l.delayMinutes ? ` • ${toPersianDigits(l.delayMinutes)} دقیقه` : ''}` : 'موجه'}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{l.session.subject}{l.session.bellPeriodName ? ` • ${l.session.bellPeriodName}` : ''}</div>
                      {l.note && <div className="mt-2 bg-slate-50 border border-slate-200 text-slate-700 text-[11px] leading-relaxed p-2 rounded-lg">{l.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'discipline' && !isEditing && !teacherView && (
            <div className="space-y-4">
              {/* آمار تجمیعی حضور پدر و مادر در جلسات عمومی أولیا (فقط با مجوز) */}
              <ParentMeetingsProfileCard studentId={currentStudent.id} />

              {/* فیلترهای وضعیت */}
              <div id="profile-attendance-list" className="scroll-mt-4 flex items-center gap-2 flex-wrap" role="tablist" aria-label="فیلتر سوابق">
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
                <>
                <div className="md:hidden space-y-2">
                  {filteredAttendanceRecords.map((r) => (
                    <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-slate-800">{formatShamsiWithWeekday(r.date)}</span>
                        {r.type === 'absent' ? (
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${r.isExcused ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {r.isExcused ? 'غایب موجه' : 'غایب غیرموجه'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            تأخیر{r.entryTime ? ` • ورود ${toPersianDigits(r.entryTime)}` : ''}{` • ${formatDelayText(r.delayMinutes)}`}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{r.kind === 'morning' ? 'صبحگاه' : `کلاسی (${r.eventLabel})`}{r.recordedBy ? ` · ثبت: ${r.recordedBy}` : ''}</div>
                      {r.note && <div className="mt-2 bg-slate-50 border border-slate-200 text-slate-700 text-[11px] leading-relaxed p-2 rounded-lg">{r.note}</div>}
                    </div>
                  ))}
                </div>
                <FitTable className="hidden md:block w-full border border-slate-200 rounded-2xl shadow-2xs">
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
                </FitTable>
                </>
              )}
            </div>
          )}

          {activeTab === 'discipline' && !isEditing && !teacherView && (
            <div id="profile-discipline-notes" className="scroll-mt-4 space-y-4">
              
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

                          {(isAdmin || isDisciplinaryVice) && (
                            <button
                              onClick={() => setEditingNote(note)}
                              className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="ویرایش این مورد انضباطی"
                              aria-label="ویرایش این مورد انضباطی"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
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
          {activeTab === 'timeline' && !isEditing && !teacherView && <StudentTimeline student={currentStudent} />}

          {activeTab === 'education' && !isEditing && (
            <StudentEducationTab
              studentId={currentStudent.id}
              sessionLogs={sessionLogs}
              worksheets={worksheets}
              worksheetWeeks={worksheetWeeks}
              showWorksheets={canSeeWorksheets}
            />
          )}

          {activeTab === 'grades' && !isEditing && (
            <div className="space-y-6">
              
              {/* Interactive Growth Trend Chart */}
              <StudentGrowthChart 
                grades={studentAcademicGrades} 
                studentName={`${studentFullName(currentStudent)}`} 
              />

              {/* معدل آزمون جامع */}
              {examSummary && (
                <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-500">معدل آزمون جامع</div>
                      <div className="mt-1 text-3xl font-black text-indigo-900 tabular-nums">{faExamPct(examSummary.total)}</div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-xl text-xs font-black ${scorePillClass(examSummary.total)}`}>{scoreLabel(examSummary.total)}</span>
                  </div>
                  {examSummary.months.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {examSummary.months.map((m) => (
                        <span key={m.key} className="rounded-xl bg-white border border-indigo-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">
                          {m.label}: <b className="text-indigo-900 tabular-nums">{faExamPct(m.gpa)}</b>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* کارنامه تفکیکی دروس: نمره‌ی هر ماه جداگانه */}
              <StudentMonthlyGradesTable
                grades={studentAcademicGrades}
                onEdit={onOpenGradeEntry && studentClass ? () => { onClose(); onOpenGradeEntry(studentClass.id); } : undefined}
              />

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
              onClick={requestClose}
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

      <EditDisciplineNoteModal student={currentStudent ?? null} note={editingNote} onClose={() => setEditingNote(null)} />
    </div>
  );
};
