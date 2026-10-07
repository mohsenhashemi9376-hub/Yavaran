import { AccessDeniedNotice } from './AccessDeniedNotice';
import { canAccessSection } from '../utils/permissions';
import React, { useState, useMemo, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Student, SchoolClass, DisciplinaryNote, MorningDelayRecord, User } from '../types';
import { toPersianDigits, getTodayShamsi, formatShamsiDisplay, getDayOfWeekFromShamsi } from '../utils/persianDate';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Phone, 
  MessageSquare, 
  Printer, 
  Clock, 
  UserX, 
  CheckCircle2, 
  X, 
  Calendar,
  Sparkles,
  Users,
  ChevronLeft,
  ChevronRight,
  Menu,
  PhoneCall,
  GraduationCap,
  FileSpreadsheet,
  Settings,
  Plus,
  AlertCircle
} from 'lucide-react';
import { YavaranLogo } from './YavaranLogo';
import { ExecutiveSidebarNav, ExecutiveViewType } from './ExecutiveSidebarNav';

// Workspaces
import { AdminStudentsWorkspace } from './AdminStudentsWorkspace';
import { AdminClassesWorkspace } from './AdminClassesWorkspace';
import { AdminAttendanceWorkspace } from './AdminAttendanceWorkspace';
import type { MorningStatusFilter } from './MorningAttendanceWorkspace';
import { EarlyWarningDossier, EarlyWarningPill } from './EarlyWarningDossier';
import { getMorningTodayStats } from '../utils/morningAttendance';
import { AdminDisciplineWorkspace } from './AdminDisciplineWorkspace';
import { AdminTeachersWorkspace } from './AdminTeachersWorkspace';
import { AdminCoachesWorkspace } from './AdminCoachesWorkspace';
import { AdminWarningsWorkspace } from './AdminWarningsWorkspace';
import { AdminReportsWorkspace } from './AdminReportsWorkspace';
import { AdminSettingsWorkspace } from './AdminSettingsWorkspace';

// Modals
import { AddDisciplineModal } from './AddDisciplineModal';
import { QuickAddStudentModal } from './QuickAddStudentModal';
import { AddClassModal } from './AddClassModal';
import { EditClassModal } from './EditClassModal';
import { AddTeacherModal } from './AddTeacherModal';
import { EditTeacherModal } from './EditTeacherModal';
import { TeacherProfileModal } from './TeacherProfileModal';
import { AddCoachModal } from './AddCoachModal';
import { EditCoachModal } from './EditCoachModal';
import { CoachProfileModal } from './CoachProfileModal';
import { MobileBottomNav } from './MobileBottomNav';
import { executiveMobileNav, HOME } from './mobileNavConfigs';
import { LoansWorkspace } from './LoansWorkspace';
import { LOAN_ALERT_DAYS, overdueLoans } from '../utils/loans';
import { studentFullName } from '../utils/studentName';

interface DisciplinaryDashboardProps {
  onSelectStudent: (student: Student, initialTab?: 'overview' | 'info' | 'attendance' | 'discipline' | 'grades') => void;
  onOpenClassDetail?: (cls: SchoolClass) => void;
  onOpenNewAttendance?: (classId?: string) => void;
  onOpenAcademicGrades?: (classId?: string) => void;
  onOpenMonthlySummary?: (classId?: string) => void;
}

export const DisciplinaryDashboard: React.FC<DisciplinaryDashboardProps> = ({
  onSelectStudent,
  onOpenClassDetail,
  onOpenNewAttendance,
  onOpenAcademicGrades,
  onOpenMonthlySummary,
}) => {
  const { 
    students, 
    classes, 
    sessions, 
    morningDelays,
    morningAttendance,
    schoolAbsences,
    allTeachers,
    allCoaches,
    currentUser,
    deleteDisciplinaryNote,
    updateStudentDiscipline,
    deleteMorningDelay,
    deleteSchoolAbsence,
    allUsers,
    schoolSettings,
    loanItems,
    showToast,
  } = useSchool();

  const disciplinaryViceName =
    (currentUser.role === 'vice_disciplinary' ? currentUser.name : '') ||
    allUsers.find((u) => u.role === 'vice_disciplinary')?.name ||
    '';
  const principalDisplayName =
    schoolSettings.principalName || allUsers.find((u) => u.role === 'admin')?.name || '';

  // وضعیت ناوبری سایدبار
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [rawView, setCurrentView] = useState<ExecutiveViewType>(null);
  const deniedView = rawView && !canAccessSection(currentUser, rawView);
  const currentView = deniedView ? null : rawView;

  // وضعیت‌های مربوط به مدال‌های عملیاتی

  const [isDisciplineModalOpen, setIsDisciplineModalOpen] = useState(false);
  const [disciplineModalStudent, setDisciplineModalStudent] = useState<Student | null>(null);

  // مدال‌های اضافه / ویرایش دانش‌آموز و کلاس
  const [isQuickAddStudentOpen, setIsQuickAddStudentOpen] = useState(false);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [classToEdit, setClassToEdit] = useState<SchoolClass | null>(null);

  // مدال‌های معلمان و مربیان
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<User | null>(null);
  const [isEditTeacherModalOpen, setIsEditTeacherModalOpen] = useState(false);
  const [selectedTeacherForProfile, setSelectedTeacherForProfile] = useState<User | null>(null);
  const [isTeacherProfileModalOpen, setIsTeacherProfileModalOpen] = useState(false);

  const [isAddCoachModalOpen, setIsAddCoachModalOpen] = useState(false);
  const [coachToEdit, setCoachToEdit] = useState<User | null>(null);
  const [isEditCoachModalOpen, setIsEditCoachModalOpen] = useState(false);
  const [selectedCoachForProfile, setSelectedCoachForProfile] = useState<User | null>(null);
  const [isCoachProfileModalOpen, setIsCoachProfileModalOpen] = useState(false);

  // مدال پیامک و برگه رسمی احضار
  const [smsStudent, setSmsStudent] = useState<Student | null>(null);
  const [smsTemplate, setSmsTemplate] = useState<'absence' | 'delay' | 'discipline' | 'meeting'>('absence');
  const [smsCustomText, setSmsCustomText] = useState('');
  const [smsSentNotice, setSmsSentNotice] = useState(false);
  const [printStudent, setPrintStudent] = useState<Student | null>(null);

  // داده‌های زمان امروز
  const todayInfo = useMemo(() => getTodayShamsi(), []);

  // تأخیرهای معتبر
  const safeMorningDelays = useMemo(() => morningDelays || [], [morningDelays]);
  const safeSchoolAbsences = useMemo(() => schoolAbsences || [], [schoolAbsences]);

  // ثبت‌های امروز
  const todayMorningDelays = useMemo(() => {
    return safeMorningDelays.filter((d) => d.date === todayInfo.formattedDate);
  }, [safeMorningDelays, todayInfo.formattedDate]);

  const todaySchoolAbsencesList = useMemo(() => {
    return safeSchoolAbsences.filter((a) => a.date === todayInfo.formattedDate);
  }, [safeSchoolAbsences, todayInfo.formattedDate]);

  const morningToday = useMemo(
    () => getMorningTodayStats(students, morningAttendance || [], todayInfo.formattedDate),
    [students, morningAttendance, todayInfo.formattedDate]
  );
  const [isEarlyWarningOpen, setIsEarlyWarningOpen] = useState(false);
  const [morningFilter, setMorningFilter] = useState<MorningStatusFilter>(null);
  const openMorning = (f: MorningStatusFilter) => {
    setMorningFilter(f);
    setCurrentView('attendance');
  };

  useEffect(() => {
    if (rawView !== 'attendance') setMorningFilter(null);
  }, [rawView]);

  const todaySessions = useMemo(() => {
    return (sessions || []).filter((s) => s.date === todayInfo.formattedDate);
  }, [sessions, todayInfo.formattedDate]);

  // دانش‌آموزان دارای غیبت بالا برای هشدارها
  const highAbsenceStudents = useMemo(() => {
    return students
      .map((student) => {
        let absentCount = 0;
        (sessions || []).forEach((session) => {
          if (!session.records) return;
          const rec = Array.isArray(session.records)
            ? (session.records as any[]).find((r) => r.studentId === student.id)
            : (session.records as Record<string, any>)[student.id];
          if (rec && rec.status === 'absent') absentCount++;
        });
        const schoolAbsCount = safeSchoolAbsences.filter((a) => a.studentId === student.id).length;
        const totalAbsences = absentCount + schoolAbsCount;
        return { student, absentCount: totalAbsences };
      })
      .filter((s) => s.absentCount >= 3)
      .sort((a, b) => b.absentCount - a.absentCount);
  }, [students, sessions, safeSchoolAbsences]);

  // موارد نیازمند توجه فوری امروز
  const urgentNeedsList = useMemo(() => {
    const list: Array<{
      id: string;
      student: Student;
      type: 'absence' | 'delay' | 'warning';
      title: string;
      detail: string;
      time?: string;
    }> = [];

    // ۱. غیبت‌های کل روز مدرسه ثبت‌شده برای امروز
    todaySchoolAbsencesList.forEach((abs) => {
      const student = students.find((s) => s.id === abs.studentId);
      if (student) {
        list.push({
          id: `abs-${abs.id}`,
          student,
          type: 'absence',
          title: 'غیبت کل روز مدرسه',
          detail: abs.reason || 'علت نامشخص / غیرموجه',
        });
      }
    });

    // ۲. تأخیرهای ثبت‌شده امروز
    todayMorningDelays.forEach((delay) => {
      const student = students.find((s) => s.id === delay.studentId);
      if (student) {
        list.push({
          id: `delay-${delay.id}`,
          student,
          type: 'delay',
          title: `تأخیر ورود (${toPersianDigits(delay.delayMinutes)} دقیقه)`,
          detail: delay.reason || 'ورود پس از صف صبحگاه',
          time: delay.arrivalTime,
        });
      }
    });

    // ۳. دانش‌آموزان با اخطار غیبت مکرر (۳ مورد و بیشتر)
    highAbsenceStudents.slice(0, 3).forEach((item) => {
      if (!list.some((existing) => existing.student.id === item.student.id)) {
        list.push({
          id: `warn-${item.student.id}`,
          student: item.student,
          type: 'warning',
          title: 'هشدار مرز اخراج انضباطی',
          detail: `${toPersianDigits(item.absentCount)} جلسه غیبت متوالی یا پراکنده`,
        });
      }
    });

    return list;
  }, [todaySchoolAbsencesList, todayMorningDelays, highAbsenceStudents, students]);

  const urgentNeedsCount = urgentNeedsList.length;

  // امانات و لوازم: وسایلی که بیش از ۲ روز برنگشته‌اند
  const overdueLoanList = useMemo(
    () => overdueLoans(loanItems, todayInfo.formattedDate),
    [loanItems, todayInfo.formattedDate]
  );
  const overdueLoanCount = overdueLoanList.length;

  // هشدار یک‌بارِ هر نشست هنگام ورود
  useEffect(() => {
    if (overdueLoanCount === 0) return;
    try {
      if (sessionStorage.getItem('loans-overdue-alerted') === String(overdueLoanCount)) return;
      sessionStorage.setItem('loans-overdue-alerted', String(overdueLoanCount));
    } catch {
      /* ignore */
    }
    showToast(`${toPersianDigits(overdueLoanCount)} وسیله بیش از ${toPersianDigits(LOAN_ALERT_DAYS)} روز است برگردانده نشده (امانات و لوازم).`, 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueLoanCount]);

  // تابع باز کردن دیالوگ پیامک با متن پیش‌فرض هوشمند
  const handleOpenSms = (
    student: Student, 
    type: 'absence' | 'delay' | 'discipline' | 'meeting', 
    customText?: string
  ) => {
    setSmsStudent(student);
    setSmsTemplate(type);
    setSmsSentNotice(false);

    if (customText) {
      setSmsCustomText(customText);
      return;
    }

    const parentName = student.fatherName ? `جناب آقای ${student.fatherName}` : 'ولی محترم دانش‌آموز';
    const fullName = `${studentFullName(student)}`;

    if (type === 'absence') {
      setSmsCustomText(
        `با سلام خدمت ${parentName}؛ به اطلاع می‌رساند فرزند گرامی شما «${fullName}» در تاریخ ${todayInfo.displayDate} در آموزشگاه حضور نیافته است. لطفاً جهت پیگیری با معاونت اجرایی تماس حاصل فرمایید.\nمعاونت اجرایی دبیرستان یاوران ولایت`
      );
    } else if (type === 'delay') {
      setSmsCustomText(
        `با سلام خدمت ${parentName}؛ به اطلاع می‌رساند فرزند گرامی شما «${fullName}» امروز ${todayInfo.displayDate} با تأخیر در آموزشگاه حاضر شده است. لطفاً نسبت به تنظیم ساعت خروج دانش‌آموز از منزل نظارت فرمایید.\nمعاونت اجرایی دبیرستان یاوران ولایت`
      );
    } else if (type === 'discipline') {
      setSmsCustomText(
        `با سلام خدمت ${parentName}؛ به اطلاع می‌رساند موردی انضباطی در پرونده دانش‌آموز «${fullName}» ثبت گردیده است. جهت بررسی جزئیات، لطفاً به دفتر آموزشگاه مراجعه فرمایید.\nمعاونت اجرایی دبیرستان یاوران ولایت`
      );
    } else {
      setSmsCustomText(
        `با سلام خدمت ${parentName}؛ خواهشمند است روز آینده جهت دیدار و گفت‌وگو با معاونت اجرایی پیرامون وضعیت تحصیلی و انضباطی فرزندتان «${fullName}» به مدرسه مراجعه فرمایید.\nمعاونت اجرایی دبیرستان یاوران ولایت`
      );
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* دو ستونه در دسکتاپ: سایدبار ناوبری ثابت در سمت راست (RTL) + محتوای اصلی */}
      <div className="flex flex-col lg:flex-row items-start gap-6">

        {/* سایدبار ثابت دسکتاپ (Docked Sidebar) */}
        <div className="hidden lg:block shrink-0 sticky top-20">
          <ExecutiveSidebarNav
            variant="docked"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            isOpen={true}
            onClose={() => {}}
            activeView={currentView}
            onSelectView={(view) => setCurrentView(view)}
            onOpenSettings={() => setCurrentView('settings')}
            counts={{
              students: students.length,
              classes: classes.length,
              teachers: allTeachers.length,
              coaches: allCoaches.length,
              warnings: urgentNeedsCount,
              sessions: todaySessions.length,
              loans: overdueLoanCount,
            }}
          />
        </div>

        {/* بدنه محتوا (پیشخوان اصلی کار روزانه یا صفحات کاری تخصصی) */}
        <div className="flex-1 min-w-0 w-full space-y-6">

          {/* ========================================================================= */}
          {/* حالت ۱: پیشخوان اصلی کار روزانه معاونت اجرایی (currentView === null) */}
          {/* ========================================================================= */}
          {deniedView && <AccessDeniedNotice onClose={() => setCurrentView(null)} />}
          {currentView === null && (
            <div className="space-y-6 animate-in fade-in" id="executive-dashboard-home">

              {/* هشدار امانات و لوازمِ بازنگشته */}
              {overdueLoanCount > 0 && (
                <button
                  type="button"
                  onClick={() => setCurrentView('loans')}
                  className="w-full text-right rounded-2xl border border-rose-200 bg-gradient-to-l from-rose-50 to-white p-4 flex items-center gap-3.5 cursor-pointer hover:border-rose-300 transition"
                  role="alert"
                >
                  <span className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 animate-pulse">
                    <AlertTriangle className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-black text-rose-800">
                      {toPersianDigits(overdueLoanCount)} وسیله بیش از {toPersianDigits(LOAN_ALERT_DAYS)} روز است برگردانده نشده
                    </span>
                    <span className="block text-xs text-rose-700/90 mt-1 truncate">
                      {overdueLoanList.slice(0, 3).map((l) => `${l.itemName} (${l.recipientName})`).join('، ')}
                      {overdueLoanCount > 3 ? ' و ...' : ''}
                    </span>
                  </span>
                  <span className="text-xs font-extrabold text-rose-700 flex items-center gap-1 shrink-0">
                    <span>امانات و لوازم</span>
                    <ChevronLeft className="w-4 h-4" />
                  </span>
                </button>
              )}
              
              {/* ۱. هدر پیشخوان معاونت اجرایی */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg sm:text-xl font-black text-slate-900">
                        سلام، {currentUser?.name || 'همکار گرامی'}
                      </h1>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                        معاونت اجرایی
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 flex-wrap">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>امروز: {todayInfo.dayOfWeek}، {todayInfo.displayDate}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500">مرکز کار روزانه معاونت اجرایی</span>
                    </div>
                  </div>

                  {/* دکمه منوی موبایل (فقط در موبایل و تبلت فعال است) */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-mobile-sidebar-toggle"
                      onClick={() => setIsMobileSidebarOpen(true)}
                      className="lg:hidden px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
                      title="باز کردن نوار کناری"
                      aria-label="باز کردن نوار کناری"
                    >
                      <Menu className="w-4 h-4" />
                      <span>منوی معاونت اجرایی</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* ۲. خلاصه وضعیت امروز (کارت‌های آماری هوشمند قابل کلیک با داده واقعی) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* کارت ۱: کل دانش‌آموزان فعال */}
                <button
                  type="button"
                  onClick={() => setCurrentView('students')}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-teal-500/50 hover:shadow-sm transition text-right group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">کل دانش‌آموزان</span>
                    <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:bg-teal-700 group-hover:text-white transition">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                    {toPersianDigits(students.length)}
                  </div>
                  <div className="text-[11px] text-teal-700 mt-1 flex items-center gap-1 font-medium">
                    <span>مدیریت فهرست دانش‌آموزان</span>
                    <ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition" />
                  </div>
                </button>

                {/* کارت ۲: غایبان امروز */}
                <button
                  type="button"
                  onClick={() => openMorning('absent')}
                  className="hover:scale-[1.01] bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-400 hover:shadow-sm transition text-right group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">غایبان امروز</span>
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center group-hover:bg-rose-700 group-hover:text-white transition">
                      <UserX className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-rose-700 mt-2 font-mono">
                    {toPersianDigits(morningToday.absent)}
                  </div>
                  <div className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                    <span>مشاهده و ثبت غیبت‌ها</span>
                    <ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition" />
                  </div>
                </button>

                {/* کارت ۳: تأخیرهای امروز */}
                <button
                  type="button"
                  onClick={() => openMorning('late')}
                  className="hover:scale-[1.01] bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-amber-400 hover:shadow-sm transition text-right group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">تأخیرهای امروز</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-700 group-hover:text-white transition">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-amber-700 mt-2 font-mono">
                    {toPersianDigits(morningToday.late)}
                  </div>
                  <div className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                    <span>مشاهده دفتر تأخیر ورود</span>
                    <ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition" />
                  </div>
                </button>

                {/* کارت ۴: نیازمند پیگیری و هشدارها */}
                <button
                  type="button"
                  onClick={() => setCurrentView('warnings')}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-400 hover:shadow-sm transition text-right group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">نیازمند پیگیری</span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-700 group-hover:text-white transition">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-indigo-900 mt-2 font-mono">
                    {toPersianDigits(urgentNeedsCount)}
                  </div>
                  <div className="text-[11px] text-indigo-700 mt-1 flex items-center gap-1 font-medium">
                    <span>رسیدگی به موارد بحرانی</span>
                    <ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition" />
                  </div>
                </button>
              </div>

              {/* ۳. بخش دسترسی سریع به امور روزانه (Quick Actions) */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-700" />
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      دسترسی سریع امور روزانه
                    </h2>
                  </div>
                  <EarlyWarningPill onClick={() => setIsEarlyWarningOpen(true)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* اکشن ۱: حضور و غیاب صبحگاه */}
                  <button
                    type="button"
                    onClick={() => setCurrentView('attendance')}
                    className="p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 hover:bg-emerald-50 text-right transition flex items-center justify-between group cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-emerald-900">حضور و غیاب صبحگاه</div>
                      <div className="text-[11px] text-emerald-700/80">غیبت و تأخیر ورود با یک لمس</div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition shadow-2xs">
                      <UserX className="w-4 h-4" />
                    </div>
                  </button>

                  {/* اکشن ۳: ثبت مورد انضباطی */}
                  <button
                    type="button"
                    onClick={() => {
                      setDisciplineModalStudent(null);
                      setIsDisciplineModalOpen(true);
                    }}
                    className="p-4 rounded-xl border border-purple-200/80 bg-purple-50/50 hover:bg-purple-50 text-right transition flex items-center justify-between group cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-purple-900">ثبت مورد انضباطی</div>
                      <div className="text-[11px] text-purple-700/80">تذکر، اخطار یا کسر نمره</div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-white border border-purple-200 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition shadow-2xs">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  </button>

                  {/* اکشن ۴: ثبت حضور و غیاب کلاس */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenNewAttendance) {
                        onOpenNewAttendance();
                      } else {
                        setCurrentView('attendance');
                      }
                    }}
                    className="p-4 rounded-xl border border-teal-200/80 bg-teal-50/50 hover:bg-teal-50 text-right transition flex items-center justify-between group cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-teal-900">حضور و غیاب کلاس</div>
                      <div className="text-[11px] text-teal-700/80">شروع جلسه کلاسی جدید</div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-white border border-teal-200 text-teal-700 flex items-center justify-center group-hover:bg-teal-700 group-hover:text-white transition shadow-2xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </button>
                </div>
              </div>

              {/* ۴. بخش نیازمند توجه امروز (پاسخ سریع به: الان چه چیزی مهم است؟) */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      {urgentNeedsCount > 0 ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      )}
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900">
                      نیازمند توجه و پیگیری امروز
                    </h2>
                    {urgentNeedsCount > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-800 border border-rose-200">
                        {toPersianDigits(urgentNeedsCount)} مورد
                      </span>
                    )}
                  </div>
                  {urgentNeedsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setCurrentView('warnings')}
                      className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>مشاهده همه هشدارها</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {urgentNeedsList.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50/60 rounded-xl border border-slate-200/60 space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      وضعیت امروز در حال حاضر آرام است.
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      هیچ غیبت پیگیری‌نشده، تأخیر جدید یا مورد انضباطی بحرانی برای امروز ثبت نشده است.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                    {urgentNeedsList.slice(0, 6).map((item) => {
                      const studentClass = classes.find((c) => c.id === item.student.classId);
                      return (
                        <div 
                          key={item.id}
                          className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              item.type === 'absence'
                                ? 'bg-rose-50 text-rose-700'
                                : item.type === 'delay'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-indigo-50 text-indigo-700'
                            }`}>
                              {item.type === 'absence' && <UserX className="w-4 h-4" />}
                              {item.type === 'delay' && <Clock className="w-4 h-4" />}
                              {item.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => onSelectStudent(item.student, 'discipline')}
                                  className="text-xs font-black text-slate-900 hover:text-teal-800 transition cursor-pointer text-right"
                                >
                                  {studentFullName(item.student)}
                                </button>
                                <span className="text-[11px] text-slate-400 font-medium">
                                  ({studentClass?.name || 'کلاس نامشخص'})
                                </span>
                                <span className={`text-[10px] px-2 py-0.2 rounded-md font-bold ${
                                  item.type === 'absence'
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : item.type === 'delay'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                }`}>
                                  {item.title}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {item.detail} {item.time && `• ساعت ثبت: ${toPersianDigits(item.time)}`}
                              </div>
                            </div>
                          </div>

                          {/* دکمه‌های اقدام فوری (پیامک به اولیا، تماس تلفنی، برگه احضار) */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                            {item.student.parentPhone && (
                              <>
                                <a
                                  href={`tel:${item.student.parentPhone}`}
                                  className="p-2 text-slate-600 hover:text-teal-800 hover:bg-teal-50 rounded-xl transition border border-slate-200/80 cursor-pointer"
                                  title={`تماس با اولیا: ${item.student.parentPhone}`}
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleOpenSms(item.student, item.type === 'delay' ? 'delay' : 'absence')}
                                  className="px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition border border-blue-200/80 flex items-center gap-1 cursor-pointer"
                                  title="ارسال پیامک اطلاع‌رسانی به ولی"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>پیامک</span>
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => setPrintStudent(item.student)}
                              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center gap-1 cursor-pointer"
                              title="چاپ برگه احضار رسمی اولیا"
                            >
                              <Printer className="w-3 h-3 text-slate-500" />
                              <span>برگه احضار</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ۵. آخرین فعالیت‌ها و ثبت‌های امروز */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    آخرین فعالیت‌ها و ثبت‌های امروز
                  </h2>
                  <span className="text-xs text-slate-400">
                    امروز: {todayInfo.displayDate}
                  </span>
                </div>

                {todayMorningDelays.length === 0 && todaySchoolAbsencesList.length === 0 && todaySessions.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    امروز هنوز فعالیتی در سامانه ثبت نشده است. از دکمه‌های «دسترسی سریع» در بالا برای ثبت روزانه استفاده فرمایید.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayMorningDelays.slice(0, 3).map((d) => {
                      const stu = students.find((s) => s.id === d.studentId);
                      return (
                        <div key={d.id} className="p-3 bg-amber-50/40 rounded-xl border border-amber-200/60 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                            <span className="font-bold text-slate-900">
                              تأخیر {stu ? `${studentFullName(stu)}` : 'دانش‌آموز'}
                            </span>
                            <span className="text-amber-800 font-mono">
                              ({toPersianDigits(d.delayMinutes)} دقیقه)
                            </span>
                            {d.reason && <span className="text-slate-500">• {d.reason}</span>}
                          </div>
                          <span className="font-mono text-slate-400 text-[11px]">
                            {toPersianDigits(d.arrivalTime || '')}
                          </span>
                        </div>
                      );
                    })}

                    {todaySchoolAbsencesList.slice(0, 3).map((a) => {
                      const stu = students.find((s) => s.id === a.studentId);
                      return (
                        <div key={a.id} className="p-3 bg-rose-50/40 rounded-xl border border-rose-200/60 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <UserX className="w-3.5 h-3.5 text-rose-700" />
                            <span className="font-bold text-slate-900">
                              غیبت کل روز {stu ? `${studentFullName(stu)}` : 'دانش‌آموز'}
                            </span>
                            {a.reason && <span className="text-slate-500">• {a.reason}</span>}
                          </div>
                          <span className="text-rose-700 text-[11px] font-bold">
                            ثبت غیبت روزانه
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* حالت ۲: مدیریت دانش‌آموزان (currentView === 'students') */}
          {/* ========================================================================= */}
          {currentView === 'students' && (
            <AdminStudentsWorkspace
              students={students}
              classes={classes}
              sessions={sessions}
              morningDelays={safeMorningDelays}
              onBack={() => setCurrentView(null)}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              onSelectStudent={(stu) => onSelectStudent(stu, 'discipline')}
              onOpenQuickAddStudent={() => setIsQuickAddStudentOpen(true)}
            />
          )}

          {/* ========================================================================= */}
          {/* حالت ۳: مدیریت کلاس‌ها (currentView === 'classes') */}
          {/* ========================================================================= */}
          {currentView === 'classes' && (
            <AdminClassesWorkspace
              classes={classes}
              students={students}
              sessions={sessions}
              allTeachers={allTeachers}
              allCoaches={allCoaches}
              onBack={() => setCurrentView(null)}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              onOpenNewClass={() => setIsAddClassModalOpen(true)}
              onOpenClassDetail={(cls) => onOpenClassDetail ? onOpenClassDetail(cls) : null}
              onOpenNewAttendance={onOpenNewAttendance || (() => {})}
              onOpenMonthlySummary={onOpenMonthlySummary || (() => {})}
              onOpenAcademicGrades={onOpenAcademicGrades}
              onSelectStudent={(stu) => onSelectStudent(stu, 'discipline')}
              onEditClass={(cls) => setClassToEdit(cls)}
            />
          )}

          {/* ========================================================================= */}
          {/* حالت ۴: حضور و غیاب یکپارچه (currentView === 'attendance') */}
          {/* ========================================================================= */}
          {currentView === 'attendance' && (
            <AdminAttendanceWorkspace
              initialStatusFilter={morningFilter}
              classes={classes}
              sessions={sessions}
              onBack={() => setCurrentView(null)}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              onOpenNewAttendance={onOpenNewAttendance || (() => {})}
              onSelectStudent={(stu) => onSelectStudent(stu, 'attendance')}
            />
          )}

          {/* امانات و لوازم (currentView === 'loans') */}
          {currentView === 'loans' && (
            <LoansWorkspace
              onBack={() => setCurrentView(null)}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
            />
          )}

          {/* ========================================================================= */}
          {/* حالت ۵: ثبت مورد انضباطی (currentView === 'discipline') */}
          {/* ========================================================================= */}
          {currentView === 'discipline' && (
            <AdminDisciplineWorkspace
              students={students}
              classes={classes}
              onBack={() => setCurrentView(null)}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              onOpenAddDiscipline={() => {
                setDisciplineModalStudent(null);
                setIsDisciplineModalOpen(true);
              }}
              onSelectStudent={(stu) => onSelectStudent(stu, 'discipline')}
              onDeleteDisciplinaryNote={(studentId, noteId) => deleteDisciplinaryNote(studentId, noteId)}
              onUpdateScore={(studentId, score) => updateStudentDiscipline(studentId, score)}
            />
          )}

          {/* ========================================================================= */}
          {/* حالت ۶: معلمان (currentView === 'teachers') */}
          {/* ========================================================================= */}
          {currentView === 'teachers' && (
            <AdminTeachersWorkspace
              allTeachers={allTeachers}
              classes={classes}
              onBack={() => setCurrentView(null)}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              onOpenNewTeacher={() => setIsAddTeacherModalOpen(true)}
              onSelectTeacherForProfile={(teacher) => {
                setSelectedTeacherForProfile(teacher);
                setIsTeacherProfileModalOpen(true);
              }}
              onEditTeacher={(teacher) => {
                setTeacherToEdit(teacher);
                setIsEditTeacherModalOpen(true);
              }}
            />
          )}

          {/* ========================================================================= */}
          {/* حالت ۷: مربیان (currentView === 'coaches') */}
          {/* ========================================================================= */}
          {currentView === 'coaches' && (
            <AdminCoachesWorkspace
              allCoaches={allCoaches}
              classes={classes}
              onBack={() => setCurrentView(null)}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              onOpenNewCoach={() => setIsAddCoachModalOpen(true)}
              onSelectCoachForProfile={(coach) => {
                setSelectedCoachForProfile(coach);
                setIsCoachProfileModalOpen(true);
              }}
              onEditCoach={(coach) => {
                setCoachToEdit(coach);
                setIsEditCoachModalOpen(true);
              }}
            />
          )}

          {/* ========================================================================= */}
          {/* حالت ۸: هشدارها و پیگیری (currentView === 'warnings') */}
          {/* ========================================================================= */}
          {currentView === 'warnings' && (
            <AdminWarningsWorkspace
              warnings={highAbsenceStudents.map((s) => ({
                student: s.student,
                className: classes.find((c) => c.id === s.student.classId)?.name || 'کلاس',
                absentCount: s.absentCount,
              }))}
              onBack={() => setCurrentView(null)}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              onSelectStudent={(stu) => onSelectStudent(stu, 'discipline')}
            />
          )}

          {/* ========================================================================= */}
          {/* حالت ۹: گزارش‌ها و آمار (currentView === 'reports') */}
          {/* ========================================================================= */}
          {currentView === 'reports' && (
            <AdminReportsWorkspace
              classes={classes}
              students={students}
              sessions={sessions}
              teachers={allTeachers}
              onBack={() => setCurrentView(null)}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
              onOpenAcademicGrades={onOpenAcademicGrades}
              onViewWarnings={() => setCurrentView('warnings')}
            />
          )}

          {/* ========================================================================= */}
          {/* حالت ۱۰: تنظیمات پایه (currentView === 'settings') */}
          {/* ========================================================================= */}
          {currentView === 'settings' && (
            <AdminSettingsWorkspace
              onBack={() => setCurrentView(null)}
              onOpenSidebar={() => setIsMobileSidebarOpen(true)}
            />
          )}

        </div>
      </div>

      {/* سایدبار کشویی دستگاه‌های همراه (Mobile / Tablet Drawer) */}
      {/* نوار ناوبری پایین (فقط موبایل) */}
      {(() => {
        const nav = executiveMobileNav({ warnings: urgentNeedsCount, loans: overdueLoanCount });
        return (
          <MobileBottomNav
            items={nav.primary}
            moreItems={nav.more}
            activeId={currentView ?? HOME}
            onSelect={(id) => setCurrentView(id === HOME ? null : (id as ExecutiveViewType))}
          />
        );
      })()}

      <ExecutiveSidebarNav
        variant="drawer"
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        activeView={currentView}
        onSelectView={(view) => setCurrentView(view)}
        onOpenSettings={() => setCurrentView('settings')}
        counts={{
          students: students.length,
          classes: classes.length,
          teachers: allTeachers.length,
          coaches: allCoaches.length,
          warnings: urgentNeedsCount,
          sessions: todaySessions.length,
          loans: overdueLoanCount,
        }}
      />

      <EarlyWarningDossier isOpen={isEarlyWarningOpen} onClose={() => setIsEarlyWarningOpen(false)} onSelectStudent={onSelectStudent} />

      {/* ========================================================================= */}
      {/* مدال ۳: ثبت مورد انضباطی */}
      {/* ========================================================================= */}
      <AddDisciplineModal
        isOpen={isDisciplineModalOpen}
        onClose={() => {
          setIsDisciplineModalOpen(false);
          setDisciplineModalStudent(null);
        }}
        students={students}
        classes={classes}
        initialStudent={disciplineModalStudent}
      />

      {/* ========================================================================= */}
      {/* مدال‌های جانبی مدیریت کلاس و پرسنل */}
      {/* ========================================================================= */}
      <QuickAddStudentModal
        isOpen={isQuickAddStudentOpen}
        onClose={() => setIsQuickAddStudentOpen(false)}
      />

      <AddClassModal
        isOpen={isAddClassModalOpen}
        onClose={() => setIsAddClassModalOpen(false)}
      />

      {classToEdit && (
        <EditClassModal
          isOpen={!!classToEdit}
          onClose={() => setClassToEdit(null)}
          classData={classToEdit}
        />
      )}

      <AddTeacherModal
        isOpen={isAddTeacherModalOpen}
        onClose={() => setIsAddTeacherModalOpen(false)}
      />

      {teacherToEdit && (
        <EditTeacherModal
          isOpen={isEditTeacherModalOpen}
          onClose={() => {
            setIsEditTeacherModalOpen(false);
            setTeacherToEdit(null);
          }}
          teacher={teacherToEdit}
        />
      )}

      {selectedTeacherForProfile && (
        <TeacherProfileModal
          isOpen={isTeacherProfileModalOpen}
          onClose={() => {
            setIsTeacherProfileModalOpen(false);
            setSelectedTeacherForProfile(null);
          }}
          teacher={selectedTeacherForProfile}
          onEdit={(teacher) => {
            setIsTeacherProfileModalOpen(false);
            setTeacherToEdit(teacher);
            setIsEditTeacherModalOpen(true);
          }}
        />
      )}

      <AddCoachModal
        isOpen={isAddCoachModalOpen}
        onClose={() => setIsAddCoachModalOpen(false)}
      />

      {coachToEdit && (
        <EditCoachModal
          isOpen={isEditCoachModalOpen}
          onClose={() => {
            setIsEditCoachModalOpen(false);
            setCoachToEdit(null);
          }}
          coach={coachToEdit}
        />
      )}

      {selectedCoachForProfile && (
        <CoachProfileModal
          isOpen={isCoachProfileModalOpen}
          onClose={() => {
            setIsCoachProfileModalOpen(false);
            setSelectedCoachForProfile(null);
          }}
          coach={selectedCoachForProfile}
          onEdit={(coach) => {
            setIsCoachProfileModalOpen(false);
            setCoachToEdit(coach);
            setIsEditCoachModalOpen(true);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* مدال پیامک به اولیا */}
      {/* ========================================================================= */}
      {smsStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold">سامانه پیام‌کوتاه به اولیا • مدرسه یاوران ولایت</h3>
              </div>
              <button
                type="button"
                onClick={() => setSmsStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">
                    گیرنده: ولی دانش‌آموز {studentFullName(smsStudent)}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                    شماره همراه: {smsStudent.parentPhone || 'ثبت نشده'}
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">انتخاب متن پیش‌فرض:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenSms(smsStudent, 'absence')}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                      smsTemplate === 'absence' ? 'bg-rose-50 border-rose-400 font-bold text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    گزارش غیبت غیرموجه
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenSms(smsStudent, 'delay')}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                      smsTemplate === 'delay' ? 'bg-amber-50 border-amber-400 font-bold text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    اخطار تأخیر ورود
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenSms(smsStudent, 'discipline')}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                      smsTemplate === 'discipline' ? 'bg-purple-50 border-purple-400 font-bold text-purple-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    کسر نمره انضباط
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenSms(smsStudent, 'meeting')}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                      smsTemplate === 'meeting' ? 'bg-blue-50 border-blue-400 font-bold text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    دعوت حضوری به مدرسه
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">متن پیامک ارسالی (قابل ویرایش):</label>
                <textarea
                  rows={4}
                  value={smsCustomText}
                  onChange={(e) => setSmsCustomText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed text-slate-800"
                />
              </div>

              {smsSentNotice && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-800 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>پیامک با موفقیت در صف ارسال سامانه مخابراتی مدرسه قرار گرفت.</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSmsStudent(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  بستن
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSmsSentNotice(true);
                    setTimeout(() => {
                      setSmsStudent(null);
                      setSmsSentNotice(false);
                    }, 1200);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>ارسال پیامک به ولی</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* مدال برگه رسمی احضار اولیا */}
      {/* ========================================================================= */}
      {printStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">برگه رسمی ارجاع انضباطی / احضار اولیا</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ برگه</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintStudent(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-slate-900 bg-white" id="printable-discipline-sheet">
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <YavaranLogo size="lg" showText />
                <div className="text-center space-y-1">
                  <div className="text-sm font-black">بسمه‌تعالی</div>
                  <div className="text-base font-black text-slate-900">برگه اخطار و دعوت از اولیای دانش‌آموز</div>
                  <div className="text-xs text-slate-600">معاونت اجرایی دبیرستان</div>
                </div>
                <div className="text-left text-xs font-mono space-y-1 text-slate-600">
                  <div>تاریخ صدور: {todayInfo.displayDate}</div>
                  <div>پیوست: دارد</div>
                  <div>وضعیت: محرمانه</div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">نام دانش‌آموز:</span>
                  <div className="font-bold text-slate-900 mt-0.5">{studentFullName(printStudent)}</div>
                </div>
                <div>
                  <span className="text-slate-500">نام پدر:</span>
                  <div className="font-bold text-slate-900 mt-0.5">{printStudent.fatherName || '-'}</div>
                </div>
                <div>
                  <span className="text-slate-500">کلاس / پایه:</span>
                  <div className="font-bold text-slate-900 mt-0.5">{classes.find((c) => c.id === printStudent.classId)?.name}</div>
                </div>
                <div>
                  <span className="text-slate-500">نمره انضباط فعلی:</span>
                  <div className="font-bold text-slate-900 mt-0.5 font-mono">{toPersianDigits(printStudent.disciplineScore ?? 20)} از ۲۰</div>
                </div>
              </div>

              <div className="text-xs leading-relaxed space-y-4 text-justify">
                <p>
                  <strong>ولی محترم دانش‌آموز جناب آقای / سرکار خانم؛</strong>
                </p>
                <p>
                  با سلام و احترام؛ پیرو آیین‌نامه اجرایی و انضباطی مصوب آموزش و پرورش، به استحضار می‌رساند فرزند گرامی شما در طول سال تحصیلی جاری به دلایل مشروحه زیر نیازمند پیگیری جدی و هماهنگی حضوری اولیا با مدرسه می‌باشد:
                </p>
                
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                  <div className="font-bold text-slate-800">خلاصه سوابق و دلایل ارجاع:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    <li>تعداد غیبت‌های ثبت شده در سامانه</li>
                    <li>تأخیرهای صبحگاهی و عدم حضور به موقع در آموزشگاه</li>
                    <li>ضرورت تعیین تکلیف و پیگیری امور اجرایی دانش‌آموز</li>
                  </ul>
                </div>

                <p className="font-bold text-slate-900">
                  خواهشمند است در اسرع وقت جهت بررسی پرونده و دیدار با معاونت اجرایی مدرسه یاوران ولایت، به همراه این برگه به دفتر آموزشگاه مراجعه فرمایید.
                </p>
              </div>

              <div className="pt-8 grid grid-cols-3 text-center text-xs border-t border-slate-200 mt-8">
                <div>
                  <div className="font-bold text-slate-800">امضای ولی دانش‌آموز</div>
                  <div className="h-16"></div>
                  <div className="text-slate-400">تاریخ و اثر انگشت</div>
                </div>
                <div>
                  <div className="font-bold text-slate-800">معاونت اجرایی آموزشگاه</div>
                  <div className="h-16 flex items-center justify-center font-bold text-teal-800">
                    {disciplinaryViceName}
                  </div>
                  <div className="text-slate-400">مهر و امضا</div>
                </div>
                <div>
                  <div className="font-bold text-slate-800">مدیریت مجتمع یاوران ولایت</div>
                  <div className="h-16 flex items-center justify-center font-bold text-indigo-900">
                    {principalDisplayName}
                  </div>
                  <div className="text-slate-400">مهر آموزشگاه</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
