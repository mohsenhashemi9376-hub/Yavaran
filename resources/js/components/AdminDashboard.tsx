import React, { useState, useMemo, useRef, useEffect } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, AttendanceSession, User, Student, DisciplinaryNote, StudentAttendanceRecord } from '../types';
import { toPersianDigits, getTodayShamsi, formatShamsiDisplay } from '../utils/persianDate';
import { getUserGreeting } from '../utils/userRoles';

// Workspaces
import { AdminSidebarNav, FullScreenView } from './AdminSidebarNav';
import { AdminClassesWorkspace } from './AdminClassesWorkspace';
import { AdminStudentsWorkspace } from './AdminStudentsWorkspace';
import { AdminTeachersWorkspace } from './AdminTeachersWorkspace';
import { AdminCoachesWorkspace } from './AdminCoachesWorkspace';
import { AdminAttendanceWorkspace } from './AdminAttendanceWorkspace';
import { AdminDelaysWorkspace } from './AdminDelaysWorkspace';
import { AdminDisciplineWorkspace } from './AdminDisciplineWorkspace';
import { AdminReportsWorkspace } from './AdminReportsWorkspace';
import { AdminSubjectsWorkspace } from './AdminSubjectsWorkspace';
import { AdminWarningsWorkspace } from './AdminWarningsWorkspace';
import { AdminSettingsWorkspace } from './AdminSettingsWorkspace';

// Modals
import { EditTeacherModal } from './EditTeacherModal';
import { TeacherProfileModal } from './TeacherProfileModal';
import { EditClassModal } from './EditClassModal';
import { AddCoachModal } from './AddCoachModal';
import { EditCoachModal } from './EditCoachModal';
import { CoachProfileModal } from './CoachProfileModal';
import { AddDisciplineModal } from './AddDisciplineModal';
import { MorningDelayModal } from './MorningDelayModal';
import { SchoolAbsenceModal } from './SchoolAbsenceModal';
import { QuickAddStudentModal } from './QuickAddStudentModal';
import { ReportsModal } from './ReportsModal';
import { SystemSettingsModal } from './SystemSettingsModal';

// Icons
import { 
  GraduationCap, 
  Users, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Menu, 
  UserPlus, 
  FileSpreadsheet, 
  Clock, 
  ShieldAlert, 
  ChevronLeft, 
  Phone,
  Search,
  Plus,
  ArrowUpRight,
  ClipboardCheck,
  UserX,
  Sparkles,
  BookOpen,
  Award,
  X,
  Layers,
  BarChart3,
  ArrowLeft,
  HeartHandshake,
  Settings
} from 'lucide-react';

interface AdminDashboardProps {
  onOpenNewClass: () => void;
  onOpenNewTeacher: () => void;
  onOpenClassDetail: (cls: SchoolClass) => void;
  onOpenNewAttendance: (classId?: string) => void;
  onOpenMonthlySummary: (classId?: string) => void;
  onOpenAcademicGrades?: (classId?: string) => void;
  onSelectStudent?: (student: Student, initialTab?: 'overview' | 'info' | 'attendance' | 'discipline' | 'grades') => void;
  onOpenGlobalSearch?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenNewClass,
  onOpenNewTeacher,
  onOpenClassDetail,
  onOpenNewAttendance,
  onOpenMonthlySummary,
  onOpenAcademicGrades,
  onSelectStudent,
  onOpenGlobalSearch,
}) => {
  const { 
    currentUser,
    isAdmin,
    isEducationalVice,
    isDisciplinaryVice,
    isNurturingVice,
    classes, 
    students, 
    sessions, 
    allTeachers,
    allCoaches,
    deleteClass,
    morningDelays,
    schoolAbsences,
    addMorningDelay,
    deleteMorningDelay,
    deleteSchoolAbsence,
    addDisciplinaryNote,
    deleteDisciplinaryNote,
    updateStudentDiscipline,
    schoolSettings
  } = useSchool();

  // Dynamic greeting and role presentation based on authenticated user
  const userGreeting = useMemo(() => getUserGreeting(currentUser), [currentUser]);

  // Contextual quick actions subtitle tailored to active role
  const quickActionsSubtitle = useMemo(() => {
    if (isAdmin) return 'اقدامات کلیدی مدیریت مدرسه، نظارت و تنظیمات پایه';
    if (isDisciplinaryVice) return 'امور اجرایی، ثبت غیبت‌ها، تأخیرهای ورود و موارد انضباطی';
    if (isEducationalVice) return 'امور آموزشی، حضور و غیاب زنگ‌ها، نمرات و اطلاعات کلاس‌ها';
    if (isNurturingVice) return 'امور پرورشی، ثبت پرونده‌های تربیتی و پیگیری دانش‌آموزان';
    return 'مهم‌ترین و پرتکرارترین کارهای روزمره مدرسه';
  }, [isAdmin, isDisciplinaryVice, isEducationalVice, isNurturingVice]);

  // Navigation: Layer 1 (Dashboard = null) vs Layer 3 (FullScreenView)
  const [currentFullScreenView, setCurrentFullScreenView] = useState<FullScreenView | null>(null);

  // Navigation: Layer 2 (Sidebar Drawer)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Desktop Collapsible Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('yavaran_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('yavaran_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleOpenSidebar = () => {
    setIsSidebarOpen(true);
    setIsSidebarCollapsed(false);
  };

  // Modal States
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isQuickAddStudentOpen, setIsQuickAddStudentOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [isAddDelayModalOpen, setIsAddDelayModalOpen] = useState(false);
  const [isAddAbsenceModalOpen, setIsAddAbsenceModalOpen] = useState(false);
  const [isAddDisciplineModalOpen, setIsAddDisciplineModalOpen] = useState(false);
  const [disciplineSelectedStudent, setDisciplineSelectedStudent] = useState<Student | null>(null);

  const [isAddCoachModalOpen, setIsAddCoachModalOpen] = useState(false);
  const [editingCoachUser, setEditingCoachUser] = useState<User | null>(null);
  const [isEditCoachModalOpen, setIsEditCoachModalOpen] = useState(false);
  const [selectedCoachForProfile, setSelectedCoachForProfile] = useState<User | null>(null);
  const [isCoachProfileModalOpen, setIsCoachProfileModalOpen] = useState(false);

  const [editingTeacherUser, setEditingTeacherUser] = useState<User | null>(null);
  const [isEditTeacherModalOpen, setIsEditTeacherModalOpen] = useState(false);
  const [selectedTeacherForProfile, setSelectedTeacherForProfile] = useState<User | null>(null);
  const [isTeacherProfileModalOpen, setIsTeacherProfileModalOpen] = useState(false);

  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);

  const todayInfo = getTodayShamsi();

  // Handle opening student profile
  const handleSelectStudent = (
    student: Student, 
    tab: 'overview' | 'info' | 'attendance' | 'discipline' | 'grades' = 'overview'
  ) => {
    if (onSelectStudent) {
      onSelectStudent(student, tab);
    }
  };

  // 1. Core Totals
  const totalClasses = classes.length;
  const totalStudents = students.length;
  const totalTeachers = allTeachers.length;

  // 2. Today's Sessions & Attendance
  const todaySessions = useMemo(() => {
    return sessions.filter((s) => s.date === todayInfo.formattedDate);
  }, [sessions, todayInfo.formattedDate]);

  const classesWithAttendanceToday = useMemo(() => {
    const ids = new Set(todaySessions.map((s) => s.classId));
    return classes.filter((c) => ids.has(c.id));
  }, [classes, todaySessions]);

  const classesWithoutAttendanceToday = useMemo(() => {
    const ids = new Set(todaySessions.map((s) => s.classId));
    return classes.filter((c) => !ids.has(c.id));
  }, [classes, todaySessions]);

  const todayAttendanceStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    todaySessions.forEach((s) => {
      Object.values(s.records || {}).forEach((item) => {
        const r = item as StudentAttendanceRecord;
        if (r.status === 'present') present++;
        else if (r.status === 'absent') absent++;
        else if (r.status === 'late') late++;
        else if (r.status === 'excused') excused++;
      });
    });

    return { present, absent, late, excused, totalRecorded: present + absent + late + excused };
  }, [todaySessions]);

  // 3. Delays & School Absences
  const todayDelays = useMemo(() => {
    return (morningDelays || []).filter((d) => d.date === todayInfo.formattedDate);
  }, [morningDelays, todayInfo.formattedDate]);

  const todaySchoolAbsences = useMemo(() => {
    return (schoolAbsences || []).filter((a) => a.date === todayInfo.formattedDate);
  }, [schoolAbsences, todayInfo.formattedDate]);

  const totalDelaysCount = (morningDelays || []).length;
  const unexcusedDelays = useMemo(() => {
    return (morningDelays || []).filter((d) => d.isExcused === false);
  }, [morningDelays]);

  // 4. Overall Attendance Stats across all sessions
  const overallSchoolStats = useMemo(() => {
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;

    sessions.forEach((s) => {
      Object.values(s.records || {}).forEach((item) => {
        const r = item as StudentAttendanceRecord;
        if (r.status === 'present') totalPresent++;
        else if (r.status === 'absent') totalAbsent++;
        else if (r.status === 'late') totalLate++;
      });
    });

    const total = totalPresent + totalAbsent + totalLate;
    const rate = total > 0 ? Math.round((totalPresent / total) * 100) : 100;
    return { totalPresent, totalAbsent, totalLate, rate, totalRecords: total };
  }, [sessions]);

  // 5. Absence Warnings (Students with >= 2 absences across all sessions)
  const schoolWarningList = useMemo(() => {
    const list: { student: Student; className: string; absentCount: number }[] = [];
    students.forEach((student) => {
      const studentClass = classes.find((c) => c.id === student.classId);
      const classSessions = sessions.filter((s) => s.classId === student.classId);
      
      let absentCount = 0;
      classSessions.forEach((sess) => {
        const record = sess.records ? sess.records[student.id] : undefined;
        if (record && record.status === 'absent') {
          absentCount++;
        }
      });

      if (absentCount >= 2) {
        list.push({
          student,
          className: studentClass?.name || 'کلاس نامشخص',
          absentCount,
        });
      }
    });

    return list.sort((a, b) => b.absentCount - a.absentCount);
  }, [students, classes, sessions]);

  // 6. Flagged Discipline Students
  const flaggedDisciplineStudents = useMemo(() => {
    return students.filter((s) => {
      const statusWarning = s.disciplinaryStatus === 'written_warning' || s.disciplinaryStatus === 'parents_summoned';
      const scoreLow = s.disciplineScore !== undefined && s.disciplineScore < 18;
      const hasNotes = (s.disciplinaryNotes || []).length > 0;
      return statusWarning || scoreLow || hasNotes;
    });
  }, [students]);

  // 7. Discipline Status Breakdown
  const disciplineBreakdown = useMemo(() => {
    let normal = 0;
    let verbal = 0;
    let written = 0;
    let parents = 0;

    students.forEach((s) => {
      const st = s.disciplinaryStatus || 'normal';
      if (st === 'normal') normal++;
      else if (st === 'verbal_warning') verbal++;
      else if (st === 'written_warning') written++;
      else if (st === 'parents_summoned') parents++;
    });

    const avgScore = students.length > 0
      ? (students.reduce((acc, s) => acc + (s.disciplineScore ?? 20), 0) / students.length).toFixed(1)
      : '۲۰';

    return { normal, verbal, written, parents, avgScore };
  }, [students]);

  // 8. Needs Attention Items
  const needsAttentionItems = useMemo(() => {
    const items: {
      id: string;
      severity: 'danger' | 'warning' | 'info';
      title: string;
      description: string;
      actionLabel: string;
      onAction: () => void;
      icon: typeof AlertTriangle;
      badgeCount?: number;
    }[] = [];

    // Check 1: Attendance not taken today
    if (classesWithoutAttendanceToday.length > 0) {
      items.push({
        id: 'unrecorded-attendance',
        severity: 'warning',
        title: `${toPersianDigits(classesWithoutAttendanceToday.length)} کلاس نیازمند ثبت حضور و غیاب امروز`,
        description: classesWithoutAttendanceToday.length === classes.length
          ? 'هنوز هیچ کلاسی لیست حضور و غیاب روز جاری را ثبت نکرده است.'
          : `کلاس‌های ثبت‌نشده: ${classesWithoutAttendanceToday.map((c) => c.name).join('، ')}`,
        actionLabel: 'ثبت حضور و غیاب',
        onAction: () => onOpenNewAttendance(classesWithoutAttendanceToday[0]?.id),
        icon: ClipboardCheck,
        badgeCount: classesWithoutAttendanceToday.length,
      });
    }

    // Check 2: Absences
    if (todayAttendanceStats.absent > 0) {
      items.push({
        id: 'today-absences',
        severity: 'danger',
        title: `${toPersianDigits(todayAttendanceStats.absent)} غیبت ثبت‌شده در روز جاری`,
        description: 'دانش‌آموزان غایب نیازمند بررسی علت غیبت و هماهنگی تلفنی با والدین هستند.',
        actionLabel: 'مشاهده غیبت‌ها',
        onAction: () => setCurrentFullScreenView('attendance'),
        icon: UserX,
        badgeCount: todayAttendanceStats.absent,
      });
    } else if (schoolWarningList.length > 0) {
      items.push({
        id: 'critical-absences',
        severity: 'danger',
        title: `${toPersianDigits(schoolWarningList.length)} دانش‌آموز دارای غیبت‌های مکرر و بحرانی`,
        description: 'دانش‌آموزان با ۲ جلسه غیبت یا بیشتر نیازمند صدور اخطار غیبت و تماس با اولیاء هستند.',
        actionLabel: 'مشاهده لیست پیگیری',
        onAction: () => setCurrentFullScreenView('warnings'),
        icon: AlertTriangle,
        badgeCount: schoolWarningList.length,
      });
    }

    // Check 3: Delays
    if (todayDelays.length > 0) {
      const totalMin = todayDelays.reduce((sum, d) => sum + (d.delayMinutes || 0), 0);
      items.push({
        id: 'today-delays',
        severity: 'warning',
        title: `${toPersianDigits(todayDelays.length)} مورد تأخیر صبحگاهی ثبت‌شده امروز`,
        description: `مجموعاً ${toPersianDigits(totalMin)} دقیقه تأخیر ورود. نیازمند بررسی وضعیت موجه/غیرموجه و تماس با اولیاء.`,
        actionLabel: 'مشاهده تأخیرها',
        onAction: () => setCurrentFullScreenView('delays'),
        icon: Clock,
        badgeCount: todayDelays.length,
      });
    } else if (unexcusedDelays.length > 0) {
      items.push({
        id: 'unexcused-delays',
        severity: 'warning',
        title: `${toPersianDigits(unexcusedDelays.length)} مورد تأخیر غیرموجه در پرونده‌ها`,
        description: 'تأخیرهای بدون عذر موجه نیازمند بررسی معاونت انضباطی جهت اقدام یا کسر نمره هستند.',
        actionLabel: 'بررسی تأخیرها',
        onAction: () => setCurrentFullScreenView('delays'),
        icon: Clock,
        badgeCount: unexcusedDelays.length,
      });
    }

    // Check 4: Discipline Flags
    if (flaggedDisciplineStudents.length > 0) {
      items.push({
        id: 'flagged-discipline',
        severity: 'danger',
        title: `${toPersianDigits(flaggedDisciplineStudents.length)} پرونده انضباطی نیازمند مداخله و بررسی`,
        description: 'دانش‌آموزان دارای تذکر کتبی، کسر نمره یا وضعیت احضار اولیاء نیازمند رسیدگی هستند.',
        actionLabel: 'بررسی پرونده‌های انضباطی',
        onAction: () => setCurrentFullScreenView('discipline'),
        icon: ShieldAlert,
        badgeCount: flaggedDisciplineStudents.length,
      });
    }

    // Check 5: Classes without teachers
    const classesWithoutTeachers = classes.filter((c) => !c.teacherIds || c.teacherIds.length === 0);
    if (classesWithoutTeachers.length > 0) {
      items.push({
        id: 'classes-without-teachers',
        severity: 'warning',
        title: `${toPersianDigits(classesWithoutTeachers.length)} کلاس بدون معلم تخصیص‌یافته`,
        description: `کلاس‌های (${classesWithoutTeachers.map((c) => c.name).join('، ')}) هنوز هیچ معلمی ندارند.`,
        actionLabel: 'تخصیص معلم به کلاس',
        onAction: () => setCurrentFullScreenView('teachers'),
        icon: UserCheck,
        badgeCount: classesWithoutTeachers.length,
      });
    }

    // Check 6: Classes without coach
    const classesWithoutCoaches = classes.filter((c) => !c.coachId);
    if (classesWithoutCoaches.length > 0) {
      items.push({
        id: 'classes-without-coaches',
        severity: 'info',
        title: `${toPersianDigits(classesWithoutCoaches.length)} کلاس بدون مربی تربیتی`,
        description: `کلاس‌های (${classesWithoutCoaches.map((c) => c.name).join('، ')}) نیازمند تعیین مربی تربیتی هستند.`,
        actionLabel: 'تعیین مربی تربیتی',
        onAction: () => setCurrentFullScreenView('coaches'),
        icon: HeartHandshake,
        badgeCount: classesWithoutCoaches.length,
      });
    }

    return items;
  }, [
    classesWithoutAttendanceToday,
    classes,
    todayAttendanceStats.absent,
    schoolWarningList,
    todayDelays,
    unexcusedDelays,
    flaggedDisciplineStudents,
    onOpenNewAttendance,
  ]);

  // 9. Recent Activities Timeline (Chronologically sorted from real data)
  const recentActivities = useMemo(() => {
    type ActivityItem = {
      id: string;
      type: 'attendance' | 'delay' | 'discipline';
      title: string;
      description: string;
      date: string;
      timeBadge?: string;
      student?: Student;
      classId?: string;
      className?: string;
      badgeText: string;
    };

    const list: ActivityItem[] = [];

    // Sessions
    sessions.forEach((sess) => {
      const cls = classes.find((c) => c.id === sess.classId);
      const recordsList = Object.values(sess.records || {}) as StudentAttendanceRecord[];
      const presentCount = recordsList.filter((r) => r.status === 'present').length;
      const absentCount = recordsList.filter((r) => r.status === 'absent').length;

      list.push({
        id: `act-sess-${sess.id}`,
        type: 'attendance',
        title: `ثبت حضور و غیاب ${cls?.name || 'کلاس'} - درس ${sess.subject}`,
        description: `توسط ${sess.teacherName} • ${toPersianDigits(presentCount)} حاضر، ${toPersianDigits(absentCount)} غایب`,
        date: sess.date,
        timeBadge: sess.startTime || 'زنگ کلاسی',
        classId: sess.classId,
        className: cls?.name,
        badgeText: 'حضور و غیاب',
      });
    });

    // Delays
    (morningDelays || []).forEach((del) => {
      const student = students.find((s) => s.id === del.studentId);
      const cls = classes.find((c) => c.id === student?.classId);

      list.push({
        id: `act-del-${del.id}`,
        type: 'delay',
        title: `ثبت تأخیر ورود ${student ? `${student.firstName} ${student.lastName}` : 'دانش‌آموز'}`,
        description: `${toPersianDigits(del.delayMinutes)} دقیقه تأخیر (${del.reason || (del.isExcused ? 'موجه' : 'غیرموجه')}) • ثبت توسط ${del.recordedBy || 'معاونت'}`,
        date: del.date,
        timeBadge: del.arrivalTime || 'صبحگاه',
        student,
        className: cls?.name,
        badgeText: 'تأخیر ورود',
      });
    });

    // Disciplinary Notes
    students.forEach((student) => {
      const cls = classes.find((c) => c.id === student.classId);
      (student.disciplinaryNotes || []).forEach((note) => {
        list.push({
          id: `act-disc-${note.id}-${student.id}`,
          type: 'discipline',
          title: `ثبت مورد انضباطی برای ${student.firstName} ${student.lastName}`,
          description: `${note.title} • کسر ${toPersianDigits(note.scoreDeduction)} نمره • ثبت توسط ${note.recordedBy || 'معاونت انضباطی'}`,
          date: note.date,
          timeBadge: 'انضباطی',
          student,
          className: cls?.name,
          badgeText: 'انضباطی',
        });
      });
    });

    // Sort descending by date
    return list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }, [sessions, morningDelays, students, classes]);

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* چیدمان منعطف دو ستونه در دسکتاپ: سایدبار ثابت + بدنه صفحه */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        
        {/* سایدبار ثابت ناوبری دسکتاپ (Docked Sidebar) */}
        <div className="hidden lg:block shrink-0 sticky top-20">
          <AdminSidebarNav
            variant="docked"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapse}
            isOpen={true}
            onClose={() => {}}
            activeView={currentFullScreenView}
            onSelectView={(view) => setCurrentFullScreenView(view)}
            onOpenSettings={() => setCurrentFullScreenView('settings')}
            counts={{
              classes: classes.length,
              students: students.length,
              teachers: allTeachers.length,
              coaches: allCoaches.length,
              warnings: schoolWarningList.length,
              delays: morningDelays.length,
              sessions: sessions.length,
            }}
          />
        </div>

        {/* بدنه محتوا (پیشخوان اصلی یا صفحات تمام‌صفحه) */}
        <div className="flex-1 min-w-0 w-full space-y-6">

          {/* ========================================================================= */}
          {/* لایه ۱: داشبورد اصلی (راهنمای انجام کار و خلاصه وضعیت مدرسه) */}
          {/* ========================================================================= */}
          {currentFullScreenView === null && (
            <div className="space-y-6" id="admin-main-dashboard-view">
          
          {/* ۱. هدر اصلی داشبورد (ساده، کارآمد و جهت‌یاب) */}
          <div 
            id="admin-dashboard-header" 
            className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col gap-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200/60">
                    {schoolSettings.schoolName || 'دبیرستان یاوران ولایت'}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-medium text-slate-500">
                    سال تحصیلی {toPersianDigits(schoolSettings.academicYear || getCurrentAcademicYear())}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setCurrentFullScreenView('settings')}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-800 hover:underline mr-1 cursor-pointer"
                      title="تنظیمات مشخصات مدرسه و سال تحصیلی"
                    >
                      (تنظیمات مدرسه)
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                    <span>{userGreeting.greeting}</span>
                    <span className="text-xl">👋</span>
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    {userGreeting.roleLabel}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {userGreeting.roleDescription}
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/80">
                  <Calendar className="w-4 h-4 text-teal-700" />
                  <span>امروز: {todayInfo.dayOfWeek}، {todayInfo.displayDate}</span>
                </div>

                {/* دکمه باز کردن سایدبار فقط در موبایل و تبلت که سایدبار دسکتاپ مخفی است */}
                <button
                  type="button"
                  id="btn-mobile-sidebar-toggle"
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden px-3.5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
                  title="باز کردن نوار کناری"
                  aria-label="باز کردن نوار کناری"
                >
                  <Menu className="w-4 h-4" />
                  <span>منو</span>
                </button>
              </div>
            </div>
          </div>

          {/* ۲. بخش نیازمند توجه (بالاترین اولویت بصری - پاسخ به: الان چه چیزی مهم است؟) */}
          <div 
            id="section-needs-attention"
            className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  {needsAttentionItems.length > 0 ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  )}
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  نیازمند توجه و پیگیری
                </h2>
                {needsAttentionItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                    {toPersianDigits(needsAttentionItems.length)} مورد
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 hidden sm:inline">
                رویدادهایی که نیازمند تصمیم‌گیری، ثبت یا تماس با اولیاء هستند
              </span>
            </div>

            {needsAttentionItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {needsAttentionItems.map((item) => {
                  const Icon = item.icon;
                  const isDanger = item.severity === 'danger';
                  return (
                    <div
                      key={item.id}
                      id={`attention-card-${item.id}`}
                      className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                        isDanger 
                          ? 'bg-rose-50/50 border-rose-200/90 hover:border-rose-300' 
                          : 'bg-amber-50/50 border-amber-200/90 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          isDanger ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                            {item.title}
                          </h3>
                          <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-2 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={item.onAction}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                            isDanger
                              ? 'bg-rose-700 hover:bg-rose-800 text-white'
                              : 'bg-amber-700 hover:bg-amber-800 text-white'
                          }`}
                        >
                          <span>{item.actionLabel}</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State مثبت و اطمینان‌بخش */
              <div 
                id="attention-empty-state"
                className="p-6 rounded-xl bg-emerald-50/60 border border-emerald-200 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-right"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-emerald-950">
                    همه چیز مرتب است!
                  </h3>
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    در حال حاضر موردی برای پیگیری فوری وجود ندارد. وضعیت حضور و غیاب، تردد صبحگاهی و انضباط دانش‌آموزان در شرایط مطلوب است.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ۳. اقدامات سریع (ساده، استاندارد و بدون سیستم‌های موازی) */}
          <div 
            id="section-quick-actions"
            className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4"
          >
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                اقدامات سریع
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {quickActionsSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* اقدامات سفارشی بر اساس نقش کاربر (Role-Tailored Actions) */}
              {isAdmin ? (
                <>
                  {/* مدیر: مدیریت کاربران و تنظیمات */}
                  <button
                    type="button"
                    id="btn-quick-admin-settings"
                    onClick={() => setCurrentFullScreenView('settings')}
                    className="p-3.5 rounded-xl bg-white hover:bg-teal-50/70 border border-teal-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-teal-100 text-teal-800 group-hover:scale-105 transition">
                      <Settings className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-teal-950">مدیریت و کاربران</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">تنظیمات، پایه‌ها و کادر</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-school-absence"
                    onClick={() => setIsAddAbsenceModalOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-rose-50/70 border border-rose-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-rose-100 text-rose-700 group-hover:scale-105 transition">
                      <UserX className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-950">ثبت غیبت مدرسه</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">عدم حضور در مدرسه</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-delay"
                    onClick={() => setIsAddDelayModalOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-amber-50/70 border border-amber-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-800 group-hover:scale-105 transition">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-950">ثبت تأخیر ورود</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">دیر رسیدن به مدرسه</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-attendance"
                    onClick={() => onOpenNewAttendance()}
                    className="p-3.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white transition flex flex-col items-center justify-center text-center gap-2 group shadow-xs cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-teal-700/80 group-hover:scale-105 transition">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">حضور و غیاب کلاس</div>
                      <div className="text-[10px] text-teal-100 mt-0.5">جلسات و زنگ کلاسی</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-discipline"
                    onClick={() => setIsAddDisciplineModalOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-purple-50/70 border border-purple-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:scale-105 transition">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-purple-950">ثبت مورد انضباطی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">تذکر، اخطار، کسر نمره</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-reports"
                    onClick={() => setCurrentFullScreenView('reports')}
                    className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:scale-105 transition">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">گزارش‌ها و خروجی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">فایل اکسل و آمار</div>
                    </div>
                  </button>
                </>
              ) : isEducationalVice ? (
                <>
                  {/* معاون آموزش: تمرکز بر حضور و غیاب کلاسی، نمرات و کلاس‌ها */}
                  <button
                    type="button"
                    id="btn-quick-attendance"
                    onClick={() => onOpenNewAttendance()}
                    className="p-3.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white transition flex flex-col items-center justify-center text-center gap-2 group shadow-xs cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-teal-700/80 group-hover:scale-105 transition">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">حضور و غیاب کلاس</div>
                      <div className="text-[10px] text-teal-100 mt-0.5">ثبت زنگ‌های تدریس</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-classes"
                    onClick={() => setCurrentFullScreenView('classes')}
                    className="p-3.5 rounded-xl bg-white hover:bg-blue-50 border border-blue-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:scale-105 transition">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-blue-950">کلاس‌ها و پایه‌ها</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">مدیریت لیست کلاس</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-subjects"
                    onClick={() => setCurrentFullScreenView('subjects')}
                    className="p-3.5 rounded-xl bg-white hover:bg-teal-50 border border-teal-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-teal-100 text-teal-700 group-hover:scale-105 transition">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-teal-950">برنامه دروس</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">عناوین درسی و اساتید</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-add-student"
                    onClick={() => setIsQuickAddStudentOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:scale-105 transition">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">ثبت‌نام دانش‌آموز</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">تخصیص به کلاس</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-grades"
                    onClick={() => {
                      if (onOpenAcademicGrades) onOpenAcademicGrades();
                      else setCurrentFullScreenView('reports');
                    }}
                    className="p-3.5 rounded-xl bg-white hover:bg-indigo-50 border border-indigo-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 group-hover:scale-105 transition">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-950">نمرات و کارنامه</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">ارزیابی مستمر تحصیلی</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-reports"
                    onClick={() => setCurrentFullScreenView('reports')}
                    className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:scale-105 transition">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">گزارش‌های تحصیلی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">فایل اکسل و آمار</div>
                    </div>
                  </button>
                </>
              ) : isDisciplinaryVice ? (
                <>
                  {/* معاون انضباطی: تمرکز بر غیبت، تأخیر، موارد انضباطی و پرونده‌های رفتاری */}
                  <button
                    type="button"
                    id="btn-quick-school-absence"
                    onClick={() => setIsAddAbsenceModalOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-rose-50/70 border border-rose-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-rose-100 text-rose-700 group-hover:scale-105 transition">
                      <UserX className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-950">ثبت غیبت روزانه</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">عدم حضور در مدرسه</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-delay"
                    onClick={() => setIsAddDelayModalOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-amber-50/70 border border-amber-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-800 group-hover:scale-105 transition">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-950">ثبت تأخیر ورود</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">دیر رسیدن به مدرسه</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-discipline"
                    onClick={() => setIsAddDisciplineModalOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-purple-50/70 border border-purple-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:scale-105 transition">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-purple-950">ثبت مورد انضباطی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">تذکر، تعهد و کسر نمره</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-attendance"
                    onClick={() => onOpenNewAttendance()}
                    className="p-3.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white transition flex flex-col items-center justify-center text-center gap-2 group shadow-xs cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-teal-700/80 group-hover:scale-105 transition">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">حضور و غیاب کلاس</div>
                      <div className="text-[10px] text-teal-100 mt-0.5">بررسی وضعیت زنگ‌ها</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-discipline-list"
                    onClick={() => setCurrentFullScreenView('discipline')}
                    className="p-3.5 rounded-xl bg-white hover:bg-purple-50 border border-purple-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:scale-105 transition">
                      <ClipboardCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-purple-950">پرونده‌های انضباطی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">سوابق تعهدات و نمرات</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-reports"
                    onClick={() => setCurrentFullScreenView('reports')}
                    className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:scale-105 transition">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">گزارش انضباطی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">خروجی اکسل و آمار</div>
                    </div>
                  </button>
                </>
              ) : isNurturingVice ? (
                <>
                  {/* معاون تربیتی: تمرکز بر پرونده‌های رشد، مربیان و برنامه‌های پرورشی */}
                  <button
                    type="button"
                    id="btn-quick-nurture-students"
                    onClick={() => setCurrentFullScreenView('students')}
                    className="p-3.5 rounded-xl bg-white hover:bg-teal-50 border border-teal-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-teal-100 text-teal-800 group-hover:scale-105 transition">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-teal-950">پرونده تربیتی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">پایش رشد اخلاقی</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-coaches"
                    onClick={() => setCurrentFullScreenView('coaches')}
                    className="p-3.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 group-hover:scale-105 transition">
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950">مربیان یاوران ولایت</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">حلقه‌ها و برنامه‌ها</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-discipline"
                    onClick={() => setIsAddDisciplineModalOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-purple-50/70 border border-purple-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:scale-105 transition">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-purple-950">ثبت تشویق و رفتار</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">امتیازات رفتاری</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-attendance"
                    onClick={() => onOpenNewAttendance()}
                    className="p-3.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white transition flex flex-col items-center justify-center text-center gap-2 group shadow-xs cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-teal-700/80 group-hover:scale-105 transition">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">حضور در برنامه‌ها</div>
                      <div className="text-[10px] text-teal-100 mt-0.5">مراسم و جلسات</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-warnings"
                    onClick={() => setCurrentFullScreenView('warnings')}
                    className="p-3.5 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-800 group-hover:scale-105 transition">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-950">هشدارهای تربیتی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">نیازمند پیگیری و مشاوره</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-reports"
                    onClick={() => setCurrentFullScreenView('reports')}
                    className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:scale-105 transition">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">گزارش‌های پرورشی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">فایل اکسل و آمار</div>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  {/* حالت استاندارد و عمومی برای سایر نقش‌ها */}
                  <button
                    type="button"
                    id="btn-quick-school-absence"
                    onClick={() => setIsAddAbsenceModalOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-rose-50/70 border border-rose-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-rose-100 text-rose-700 group-hover:scale-105 transition">
                      <UserX className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-rose-950">ثبت غیبت مدرسه</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">عدم حضور در مدرسه</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-delay"
                    onClick={() => setIsAddDelayModalOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-amber-50/70 border border-amber-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-800 group-hover:scale-105 transition">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-amber-950">ثبت تأخیر ورود</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">دیر رسیدن به مدرسه</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-attendance"
                    onClick={() => onOpenNewAttendance()}
                    className="p-3.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white transition flex flex-col items-center justify-center text-center gap-2 group shadow-xs cursor-pointer"
                  >
                    <div className="p-2 rounded-lg bg-teal-700/80 group-hover:scale-105 transition">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">حضور و غیاب کلاس</div>
                      <div className="text-[10px] text-teal-100 mt-0.5">جلسات و زنگ کلاسی</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-discipline"
                    onClick={() => setIsAddDisciplineModalOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-purple-50/70 border border-purple-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:scale-105 transition">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-purple-950">ثبت مورد انضباطی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">تذکر، اخطار، کسر نمره</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-add-student"
                    onClick={() => setIsQuickAddStudentOpen(true)}
                    className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:scale-105 transition">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">افزودن دانش‌آموز</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">تشکیل پرونده تحصیلی</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-quick-reports"
                    onClick={() => setCurrentFullScreenView('reports')}
                    className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 transition flex flex-col items-center justify-center text-center gap-2 group cursor-pointer shadow-2xs"
                  >
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:scale-105 transition">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">گزارش‌ها و خروجی</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">فایل اکسل و آمار</div>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ۴. خلاصه وضعیت مدرسه (کارت‌های آماری کاملاً Actionable و قابل کلیک) */}
          <div 
            id="section-school-status-cards"
            className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  خلاصه وضعیت مدرسه
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  برای ورود مستقیم به هر بخش، روی کارت مربوطه کلیک کنید.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* کارت ۱: کل دانش‌آموزان */}
              <div
                id="stat-card-students"
                onClick={() => setCurrentFullScreenView('students')}
                className="p-4 rounded-xl bg-slate-50 hover:bg-teal-50/50 border border-slate-200/90 hover:border-teal-300 transition cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">دانش‌آموزان</span>
                  <Users className="w-4 h-4 text-slate-400 group-hover:text-teal-700 transition" />
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-slate-900">
                    {toPersianDigits(totalStudents)}
                  </div>
                  <div className="text-[11px] text-teal-700 font-semibold mt-1 flex items-center gap-1">
                    <span>مشاهده لیست</span>
                    <ChevronLeft className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* کارت ۲: کلاس‌های دایر */}
              <div
                id="stat-card-classes"
                onClick={() => setCurrentFullScreenView('classes')}
                className="p-4 rounded-xl bg-slate-50 hover:bg-teal-50/50 border border-slate-200/90 hover:border-teal-300 transition cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">کلاس‌های دایر</span>
                  <GraduationCap className="w-4 h-4 text-slate-400 group-hover:text-teal-700 transition" />
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-slate-900">
                    {toPersianDigits(totalClasses)}
                  </div>
                  <div className="text-[11px] text-teal-700 font-semibold mt-1 flex items-center gap-1">
                    <span>مدیریت کلاس‌ها</span>
                    <ChevronLeft className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* کارت ۳: وضعیت حضور امروز / نرخ حضور مدرسه */}
              <div
                id="stat-card-attendance"
                onClick={() => setCurrentFullScreenView('attendance')}
                className="p-4 rounded-xl bg-slate-50 hover:bg-teal-50/50 border border-slate-200/90 hover:border-teal-300 transition cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">
                    {todaySessions.length > 0 ? 'حاضرین امروز' : 'نرخ حضور مدرسه'}
                  </span>
                  <UserCheck className="w-4 h-4 text-slate-400 group-hover:text-teal-700 transition" />
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-emerald-700">
                    {todaySessions.length > 0 
                      ? `${toPersianDigits(todayAttendanceStats.present)} نفر`
                      : `${toPersianDigits(overallSchoolStats.rate)}٪`}
                  </div>
                  <div className="text-[11px] text-teal-700 font-semibold mt-1 flex items-center gap-1">
                    <span>{todaySessions.length > 0 ? `${toPersianDigits(todaySessions.length)} جلسه ثبت‌شده` : 'دفتر حضور و غیاب'}</span>
                    <ChevronLeft className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* کارت ۴: غیبت‌های مدرسه (عدم حضور در مدرسه) */}
              <div
                id="stat-card-absences"
                onClick={() => setIsAddAbsenceModalOpen(true)}
                className="p-4 rounded-xl bg-slate-50 hover:bg-rose-50/50 border border-slate-200/90 hover:border-rose-300 transition cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">
                    {todaySchoolAbsences.length > 0 ? 'غیبت‌های مدرسه (امروز)' : 'کل غیبت‌های مدرسه'}
                  </span>
                  <UserX className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition" />
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-rose-700">
                    {todaySchoolAbsences.length > 0 
                      ? toPersianDigits(todaySchoolAbsences.length) 
                      : toPersianDigits(schoolAbsences?.length || 0)}
                  </div>
                  <div className="text-[11px] text-rose-700 font-semibold mt-1 flex items-center gap-1">
                    <span>ثبت یا پیگیری</span>
                    <ChevronLeft className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* کارت ۵: تأخیر ورود صبحگاه */}
              <div
                id="stat-card-delays"
                onClick={() => setCurrentFullScreenView('delays')}
                className="p-4 rounded-xl bg-slate-50 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 transition cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">
                    {todayDelays.length > 0 ? 'تأخیر ورود (امروز)' : 'کل تأخیرهای ورود'}
                  </span>
                  <Clock className="w-4 h-4 text-slate-400 group-hover:text-amber-700 transition" />
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-amber-800">
                    {todayDelays.length > 0 
                      ? toPersianDigits(todayDelays.length) 
                      : toPersianDigits(totalDelaysCount)}
                  </div>
                  <div className="text-[11px] text-amber-800 font-semibold mt-1 flex items-center gap-1">
                    <span>لیست تأخیرها</span>
                    <ChevronLeft className="w-3 h-3" />
                  </div>
                </div>
              </div>

              {/* کارت ۶: پرونده‌های انضباطی */}
              <div
                id="stat-card-discipline"
                onClick={() => setCurrentFullScreenView('discipline')}
                className="p-4 rounded-xl bg-slate-50 hover:bg-purple-50/50 border border-slate-200/90 hover:border-purple-300 transition cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">پرونده انضباطی</span>
                  <ShieldAlert className="w-4 h-4 text-slate-400 group-hover:text-purple-700 transition" />
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-purple-900">
                    {toPersianDigits(flaggedDisciplineStudents.length)}
                  </div>
                  <div className="text-[11px] text-purple-800 font-semibold mt-1 flex items-center gap-1">
                    <span>بررسی انضباط</span>
                    <ChevronLeft className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ۵. رویدادها و فعالیت‌های اخیر (تایم‌لاین پویا از داده‌های واقعی) */}
          <div 
            id="section-recent-activities"
            className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  فعالیت‌های اخیر مدرسه
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  آخرین ثبت‌های انجام‌شده در حضور و غیاب کلاسی، تأخیرهای تردد و پرونده‌های انضباطی
                </p>
              </div>
            </div>

            {recentActivities.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentActivities.map((act) => {
                  const isAttendance = act.type === 'attendance';
                  const isDelay = act.type === 'delay';
                  const isDiscipline = act.type === 'discipline';

                  return (
                    <div 
                      key={act.id} 
                      className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 px-2 rounded-lg transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          isAttendance 
                            ? 'bg-teal-50 text-teal-700 border border-teal-200/60' 
                            : isDelay
                            ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                            : 'bg-purple-50 text-purple-800 border border-purple-200/60'
                        }`}>
                          {isAttendance && <CheckCircle2 className="w-4 h-4" />}
                          {isDelay && <Clock className="w-4 h-4" />}
                          {isDiscipline && <ShieldAlert className="w-4 h-4" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900">
                              {act.title}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isAttendance 
                                ? 'bg-teal-50 text-teal-800' 
                                : isDelay
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-purple-50 text-purple-800'
                            }`}>
                              {act.badgeText}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {act.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                        <div className="text-right">
                          <div className="text-[11px] font-bold text-slate-700">
                            {formatShamsiDisplay(act.date)}
                          </div>
                          {act.timeBadge && (
                            <div className="text-[10px] text-slate-400">
                              {act.timeBadge}
                            </div>
                          )}
                        </div>

                        {act.student && (
                          <button
                            type="button"
                            onClick={() => handleSelectStudent(act.student!, 'overview')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                          >
                            مشاهده پرونده
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">
                هنوز فعالیتی در سامانه ثبت نشده است.
              </div>
            )}
          </div>

          {/* ۶. وضعیت تفصیلی انضباطی و کلاس‌ها (اطلاعات تکمیلی بدون پیچیدگی) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* کارت چپ: توزیع وضعیت انضباطی کل مدرسه */}
            <div 
              id="card-discipline-overview"
              className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    وضعیت نمرات و پرونده‌های انضباطی
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    میانگین انضباط مدرسه: {toPersianDigits(disciplineBreakdown.avgScore)} از ۲۰
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentFullScreenView('discipline')}
                  className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>ورود به دفتر انضباط</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-center">
                  <div className="text-base font-black text-emerald-800">
                    {toPersianDigits(disciplineBreakdown.normal)}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-700 mt-0.5">عادی و عالی</div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-center">
                  <div className="text-base font-black text-amber-800">
                    {toPersianDigits(disciplineBreakdown.verbal)}
                  </div>
                  <div className="text-[10px] font-bold text-amber-700 mt-0.5">تذکر شفاهی</div>
                </div>

                <div className="p-2.5 rounded-xl bg-orange-50/70 border border-orange-200/70 text-center">
                  <div className="text-base font-black text-orange-800">
                    {toPersianDigits(disciplineBreakdown.written)}
                  </div>
                  <div className="text-[10px] font-bold text-orange-700 mt-0.5">تذکر کتبی</div>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/70 text-center">
                  <div className="text-base font-black text-rose-800">
                    {toPersianDigits(disciplineBreakdown.parents)}
                  </div>
                  <div className="text-[10px] font-bold text-rose-700 mt-0.5">احضار اولیاء</div>
                </div>
              </div>
            </div>

            {/* کارت راست: فهرست کلاس‌ها با دسترسی مستقیم */}
            <div 
              id="card-classes-overview"
              className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    کلاس‌های دایر مدرسه
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تعداد {toPersianDigits(classes.length)} کلاس با مجموع {toPersianDigits(students.length)} دانش‌آموز
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentFullScreenView('classes')}
                  className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>مدیریت همه کلاس‌ها</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 pt-1">
                {classes.slice(0, 3).map((cls) => {
                  const classStudents = students.filter((s) => s.classId === cls.id);
                  const classSessions = sessions.filter((s) => s.classId === cls.id);
                  return (
                    <div 
                      key={cls.id}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 flex items-center justify-between transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-teal-100/70 text-teal-800 font-bold text-xs flex items-center justify-center">
                          {cls.grade[0]}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{cls.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {toPersianDigits(classStudents.length)} دانش‌آموز • {toPersianDigits(classSessions.length)} جلسه ثبت‌شده
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenClassDetail(cls)}
                          className="px-2 py-1 text-[11px] font-bold text-teal-800 hover:bg-teal-100/60 rounded-lg transition cursor-pointer"
                        >
                          مشاهده لیست ←
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* لایه ۳: صفحات تمام‌صفحه (FULL SCREEN WORKSPACES) */}
      {/* ========================================================================= */}
      {currentFullScreenView === 'classes' && (
        <AdminClassesWorkspace
          classes={classes}
          students={students}
          sessions={sessions}
          allTeachers={allTeachers}
          allCoaches={allCoaches}
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
          onOpenNewClass={onOpenNewClass}
          onOpenClassDetail={onOpenClassDetail}
          onOpenNewAttendance={onOpenNewAttendance}
          onOpenMonthlySummary={onOpenMonthlySummary}
          onOpenAcademicGrades={onOpenAcademicGrades}
          onSelectStudent={onSelectStudent}
          onEditClass={(cls) => {
            setEditingClass(cls);
            setIsEditClassModalOpen(true);
          }}
        />
      )}

      {currentFullScreenView === 'students' && (
        <AdminStudentsWorkspace
          students={students}
          classes={classes}
          sessions={sessions}
          morningDelays={morningDelays || []}
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
          onSelectStudent={handleSelectStudent}
          onOpenQuickAddStudent={() => setIsQuickAddStudentOpen(true)}
        />
      )}

      {currentFullScreenView === 'teachers' && (
        <AdminTeachersWorkspace
          allTeachers={allTeachers}
          classes={classes}
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
          onOpenNewTeacher={onOpenNewTeacher}
          onSelectTeacherForProfile={(teacher) => {
            setSelectedTeacherForProfile(teacher);
            setIsTeacherProfileModalOpen(true);
          }}
          onEditTeacher={(teacher) => {
            setEditingTeacherUser(teacher);
            setIsEditTeacherModalOpen(true);
          }}
        />
      )}

      {currentFullScreenView === 'coaches' && (
        <AdminCoachesWorkspace
          allCoaches={allCoaches}
          classes={classes}
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
          onOpenNewCoach={() => setIsAddCoachModalOpen(true)}
          onSelectCoachForProfile={(coach) => {
            setSelectedCoachForProfile(coach);
            setIsCoachProfileModalOpen(true);
          }}
          onEditCoach={(coach) => {
            setEditingCoachUser(coach);
            setIsEditCoachModalOpen(true);
          }}
        />
      )}

      {currentFullScreenView === 'attendance' && (
        <AdminAttendanceWorkspace
          classes={classes}
          sessions={sessions}
          delays={morningDelays}
          schoolAbsences={schoolAbsences}
          students={students}
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
          onOpenNewAttendance={onOpenNewAttendance}
          onOpenAddDelay={() => setIsAddDelayModalOpen(true)}
          onOpenAddAbsence={() => setIsAddAbsenceModalOpen(true)}
          onDeleteDelay={deleteMorningDelay}
          onDeleteSchoolAbsence={deleteSchoolAbsence}
        />
      )}

      {currentFullScreenView === 'delays' && (
        <AdminAttendanceWorkspace
          classes={classes}
          sessions={sessions}
          delays={morningDelays}
          schoolAbsences={schoolAbsences}
          students={students}
          initialTab="delays"
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
          onOpenNewAttendance={onOpenNewAttendance}
          onOpenAddDelay={() => setIsAddDelayModalOpen(true)}
          onOpenAddAbsence={() => setIsAddAbsenceModalOpen(true)}
          onDeleteDelay={deleteMorningDelay}
          onDeleteSchoolAbsence={deleteSchoolAbsence}
        />
      )}

      {currentFullScreenView === 'discipline' && (
        <AdminDisciplineWorkspace
          students={students}
          classes={classes}
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
          onOpenAddDiscipline={() => {
            setDisciplineSelectedStudent(null);
            setIsAddDisciplineModalOpen(true);
          }}
          onOpenAddNote={() => {
            setDisciplineSelectedStudent(null);
            setIsAddDisciplineModalOpen(true);
          }}
          onDeleteNote={(studentId, noteId) => deleteDisciplinaryNote(studentId, noteId)}
          onDeleteDisciplinaryNote={(studentId, noteId) => deleteDisciplinaryNote(studentId, noteId)}
          onUpdateScore={(studentId, score) => updateStudentDiscipline(studentId, score)}
        />
      )}

      {currentFullScreenView === 'reports' && (
        <AdminReportsWorkspace
          classes={classes}
          students={students}
          sessions={sessions}
          teachers={allTeachers}
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
          onOpenAcademicGrades={onOpenAcademicGrades}
          onViewWarnings={() => setCurrentFullScreenView('warnings')}
        />
      )}

      {currentFullScreenView === 'subjects' && (
        <AdminSubjectsWorkspace
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
        />
      )}

      {currentFullScreenView === 'warnings' && (
        <AdminWarningsWorkspace
          warnings={schoolWarningList}
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
          onSelectStudent={handleSelectStudent}
        />
      )}

      {currentFullScreenView === 'settings' && (
        <AdminSettingsWorkspace
          onBack={() => setCurrentFullScreenView(null)}
          onOpenSidebar={handleOpenSidebar}
        />
      )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* لایه ۲: SIDEBAR کشویی موبایل (MOBILE SIDEBAR NAVIGATION DRAWER) */}
      {/* ========================================================================= */}
      <AdminSidebarNav
        variant="drawer"
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeView={currentFullScreenView}
        onSelectView={(view) => {
          setCurrentFullScreenView(view);
          setIsSidebarOpen(false);
        }}
        onOpenSettings={() => {
          setIsSidebarOpen(false);
          setCurrentFullScreenView('settings');
        }}
        counts={{
          classes: classes.length,
          students: students.length,
          teachers: allTeachers.length,
          coaches: allCoaches.length,
          warnings: schoolWarningList.length,
          delays: morningDelays.length,
          sessions: sessions.length,
        }}
      />

      {/* مودال تنظیمات سامانه (پشتیبان‌گیری، بازیابی و ریست اطلاعات) */}
      <SystemSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Add Coach Modal */}
      <AddCoachModal
        isOpen={isAddCoachModalOpen}
        onClose={() => setIsAddCoachModalOpen(false)}
      />

      {/* Edit Coach Modal */}
      <EditCoachModal
        isOpen={isEditCoachModalOpen}
        onClose={() => {
          setIsEditCoachModalOpen(false);
          setEditingCoachUser(null);
        }}
        coach={editingCoachUser}
      />

      {/* Coach Profile Modal (پنل شخصی مربی) */}
      <CoachProfileModal
        isOpen={isCoachProfileModalOpen}
        onClose={() => {
          setIsCoachProfileModalOpen(false);
          setSelectedCoachForProfile(null);
        }}
        coach={selectedCoachForProfile}
        onEdit={(coach) => {
          setIsCoachProfileModalOpen(false);
          setEditingCoachUser(coach);
          setIsEditCoachModalOpen(true);
        }}
        onSelectStudent={(studentId) => {
          setIsCoachProfileModalOpen(false);
          const found = students.find((s) => s.id === studentId);
          if (found && onSelectStudent) {
            onSelectStudent(found);
          }
        }}
      />

      {/* Teacher Profile Modal */}
      <TeacherProfileModal
        isOpen={isTeacherProfileModalOpen}
        onClose={() => {
          setIsTeacherProfileModalOpen(false);
          setSelectedTeacherForProfile(null);
        }}
        teacher={selectedTeacherForProfile}
        onEdit={(teacher) => {
          setIsTeacherProfileModalOpen(false);
          setEditingTeacherUser(teacher);
          setIsEditTeacherModalOpen(true);
        }}
      />

      {/* Edit Teacher Modal */}
      <EditTeacherModal
        isOpen={isEditTeacherModalOpen}
        onClose={() => {
          setIsEditTeacherModalOpen(false);
          setEditingTeacherUser(null);
        }}
        teacher={editingTeacherUser}
      />

      {/* Edit Class Modal */}
      <EditClassModal
        isOpen={isEditClassModalOpen}
        onClose={() => {
          setIsEditClassModalOpen(false);
          setEditingClass(null);
        }}
        schoolClass={editingClass}
      />

      {/* Quick Add Student Modal */}
      <QuickAddStudentModal
        isOpen={isQuickAddStudentOpen}
        onClose={() => setIsQuickAddStudentOpen(false)}
      />

      {/* Reports Modal */}
      <ReportsModal
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
        onOpenAcademicGrades={onOpenAcademicGrades}
      />

      {/* School Absence Modal (غیبت در مدرسه) */}
      <SchoolAbsenceModal
        isOpen={isAddAbsenceModalOpen}
        onClose={() => setIsAddAbsenceModalOpen(false)}
      />

      {/* Morning Delay Modal (تأخیر ورود به مدرسه) */}
      <MorningDelayModal
        isOpen={isAddDelayModalOpen}
        onClose={() => setIsAddDelayModalOpen(false)}
      />

      {/* Add Discipline Modal */}
      <AddDisciplineModal
        isOpen={isAddDisciplineModalOpen}
        onClose={() => {
          setIsAddDisciplineModalOpen(false);
          setDisciplineSelectedStudent(null);
        }}
        students={students}
        classes={classes}
        initialStudent={disciplineSelectedStudent}
        onAddNote={addDisciplinaryNote}
      />

    </div>
  );
};
