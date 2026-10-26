import { subjectAppliesToClass } from '../utils/courseAssignments';
import { useScrollTop } from '../utils/useScrollTop';
import { AccessDeniedNotice } from './AccessDeniedNotice';
import { canAccessSection } from '../utils/permissions';
import React, { useState, useMemo, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { computeFollowUps, FollowUpReason, FOLLOW_UP_GROUP_LABEL, FollowUpGroup, isDefaultFollowUpConfig } from '../utils/academicFollowUp';
import { gradeScoreForMonth, ReportMonth } from '../utils/monthlyReport';
import { SCORE_COLUMNS, EXAM_MONTHS, ExamMonth, studentExamSummary } from '../utils/examReport';
import { FollowUpCriteriaModal } from './FollowUpCriteriaModal';
import { AcademicFollowUpStatus, EXAM_SUBJECTS } from '../types';
import { SchoolClass, Student, StudentAcademicGrade, AcademicSubject, User, MonthlyContinuousKey } from '../types';
import { toPersianDigits, toEnglishDigits, getTodayShamsi, getActiveAcademicYear } from '../utils/persianDate';
import { homeworkProblemStudentCount } from '../utils/homework';
import { lastShamsiDays } from '../utils/trends';
import { calculateAnnualScore, analyzeSubjectGrade } from '../utils/academicAnalysis';
import { StudentGrowthChart } from './StudentGrowthChart';
import { TeacherEvaluationSection } from './TeacherEvaluationSection';
import { AnnouncementsManagement } from './AnnouncementsManagement';
import { HomeworkFollowUpReport } from './HomeworkFollowUpReport';
import { WorksheetsWorkspace } from './WorksheetsWorkspace';
import { WorksheetAlertsCard } from './WorksheetAlertsCard';
import { GradePeriodsModal } from './GradePeriodsModal';
import { ClassMonthlyGradesSection } from './ClassMonthlyGradesSection';
import { periodUngradedStats, scorePillClass } from '../utils/gradePeriods';
import { ComprehensiveExamManagement } from './ComprehensiveExamManagement';
import { ExamEducationalReport } from './ExamEducationalReport';
import { SubjectClassAnalysis } from './SubjectClassAnalysis';
import { TermComprehensiveReport } from './TermComprehensiveReport';
import { UngradedSubjectsPanel } from './UngradedSubjectsPanel';
import { LessonPlansReview } from './LessonPlansReview';
import { GreyListWorkspace } from './GreyListWorkspace';
import { WeeklyFollowUpDigest } from './WeeklyFollowUpDigest';
import { buildGreySnapshot } from '../utils/greyList';
import { currentMonthKey } from '../utils/academicMonths';
import { EducationalSidebarNav, EducationalViewType } from './EducationalSidebarNav';
import { AdminClassesWorkspace } from './AdminClassesWorkspace';
import { AdminSubjectsWorkspace } from './AdminSubjectsWorkspace';
import { AdminTeachersWorkspace } from './AdminTeachersWorkspace';
import { AdminReportsWorkspace } from './AdminReportsWorkspace';
import { AdminStudentsWorkspace } from './AdminStudentsWorkspace';
import { AdminAttendanceWorkspace } from './AdminAttendanceWorkspace';
import { AdminSettingsWorkspace } from './AdminSettingsWorkspace';
import { AddClassModal } from './AddClassModal';
import { EditClassModal } from './EditClassModal';
import { AddTeacherModal } from './AddTeacherModal';
import { EditTeacherModal } from './EditTeacherModal';
import { TeacherClassesSummary } from './TeacherClassesSummary';
import { MaybeAnimated } from './AnimatedNumber';
import { ClassActivityTrends } from './ClassActivityTrends';
import { TodayAbsenteesChip } from './TodayAbsenteesChip';
import { TeacherProfileModal } from './TeacherProfileModal';
import { QuickAddStudentModal } from './QuickAddStudentModal';
import { 
  BookOpen, 
  GraduationCap, 
  Award, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Save, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  Plus, 
  Users, 
  Sparkles, 
  BarChart3, 
  ClipboardList,
  Lightbulb, 
  ArrowUpRight, 
  Eye, 
  RefreshCw, 
  Check, 
  UserCheck,
  MoreVertical,
  ChevronDown,
  ChevronLeft,
  SlidersHorizontal,
  Printer,
  ArrowRight,
  ArrowLeft,
  School,
  LayoutDashboard,
  Menu,
  Calendar,
  AlertTriangle,
  X,
  FileText,
  CalendarCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MobileBottomNav } from './MobileBottomNav';
import { educationalMobileNav, HOME } from './mobileNavConfigs';
import { studentFullName } from '../utils/studentName';
import { AcademicFollowUpTable } from './AcademicFollowUpTable';

interface EducationalDashboardProps {
  onSelectStudent: (student: Student, initialTab?: 'overview' | 'info' | 'attendance' | 'discipline' | 'grades' | 'timeline') => void;
  onOpenAcademicGradesModal?: (classId?: string, subjectId?: string) => void;
  onOpenClassDetail?: (cls: SchoolClass) => void;
  onOpenNewAttendance?: (classId?: string) => void;
  onOpenMonthlySummary?: (classId?: string) => void;
  onOpenNewClass?: () => void;
  onOpenNewTeacher?: () => void;
  onSelectTeacherForProfile?: (teacher: User) => void;
}

export const EducationalDashboard: React.FC<EducationalDashboardProps> = ({
  onSelectStudent,
  onOpenAcademicGradesModal,
  onOpenClassDetail,
  onOpenNewAttendance,
  onOpenMonthlySummary,
  onOpenNewClass,
  onOpenNewTeacher,
  onSelectTeacherForProfile,
}) => {
  const { 
    classes, 
    students, 
    sessions,
    morningDelays,
    academicSubjects, 
    academicGrades, 
    comprehensiveExams,
    academicFollowUps,
    setAcademicFollowUp,
    followUpConfig,
    saveFollowUpConfig,
    greyList,
    sendToGreyList,
    withdrawFromGreyList,
    showToast,
    worksheets,
    worksheetWeeks,
    gradePeriods,
    allTeachers,
    allCoaches,
    currentUser,
    saveBatchAcademicGrades,
    addAcademicSubject 
  } = useSchool();

  // وضعیت ناوبری سایدبار معاونت آموزشی
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [rawView, setCurrentView] = useState<EducationalViewType>(null);
  const deniedView = rawView && !canAccessSection(currentUser, rawView);
  const currentView = deniedView ? null : rawView;
  useScrollTop(currentView);

  // وضعیت‌های مربوط به ثبت نمرات
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(academicSubjects[0]?.id || '');
  // دروس منحصراً مربوط به پایه‌ی کلاس انتخاب‌شده
  const classSubjects = React.useMemo(() => {
    const cls = classes.find((c) => c.id === selectedClassId);
    return cls ? academicSubjects.filter((s) => subjectAppliesToClass(s, cls)) : academicSubjects;
  }, [academicSubjects, classes, selectedClassId]);

  useEffect(() => {
    if (classSubjects.length > 0 && !classSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(classSubjects[0].id);
    }
  }, [classSubjects, selectedSubjectId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'excellent' | 'normal' | 'weak' | 'ungraded'>('all');
  const [selectedStudentForChart, setSelectedStudentForChart] = useState<Student | null>(null);
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuStudentId, setOpenMenuStudentId] = useState<string | null>(null);

  // وضعیت‌های بخش کارنامه
  const [reportCardClassId, setReportCardClassId] = useState<string>(classes[0]?.id || 'all');
  const [reportCardSearch, setReportCardSearch] = useState('');
  const [reportMonth, setReportMonth] = useState<ReportMonth>('all');

  // وضعیت‌های بخش هشدارهای آموزشی
  const [warningClassFilter, setWarningClassFilter] = useState<string>('all');
  const [warningSearch, setWarningSearch] = useState('');
  const [warningGroup, setWarningGroup] = useState<'all' | FollowUpGroup>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  // مدال‌های افزودن و ویرایش کلاس، معلم، و ثبت سریع دانش‌آموز
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [classToEdit, setClassToEdit] = useState<SchoolClass | null>(null);
  const [isAddTeacherModalOpen, setIsAddTeacherModalOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<User | null>(null);
  const [isEditTeacherModalOpen, setIsEditTeacherModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
  const [isTeacherProfileOpen, setIsTeacherProfileOpen] = useState(false);
  const [isQuickAddStudentOpen, setIsQuickAddStudentOpen] = useState(false);

  // داده‌های تاریخ روز
  const todayInfo = useMemo(() => getTodayShamsi(), []);

  // بستن منوهای شناور
  React.useEffect(() => {
    const handleDocumentClick = () => {
      setOpenMenuStudentId(null);
    };
    window.addEventListener('click', handleDocumentClick);
    return () => window.removeEventListener('click', handleDocumentClick);
  }, []);

  const currentClass = classes.find(c => c.id === selectedClassId);
  const currentSubject = academicSubjects.find(s => s.id === selectedSubjectId);
  const classStudents = students.filter(s => s.classId === selectedClassId);

  // محاسبات آماری آموزشی کل مدرسه
  let schoolTotalStudents = students.length;
  let totalGradesRecorded = academicGrades.length;
  let passedCount = 0;
  let excellentCount = 0;
  let needHelpCount = 0;

  academicGrades.forEach(g => {
    const ann = gradeScoreForMonth(g, 'all');
    if (ann !== undefined) {
      if (ann >= 10) passedCount++;
      if (ann >= 17) excellentCount++;
      if (ann < 12) needHelpCount++;
    }
  });

  // نمرات ثبت‌نشده: فقط بازه‌های فعال‌شده توسط معاون آموزش مبنای محاسبه‌اند
  // = [مجموع دانش‌آموزان هر درس × بازه‌های فعال] − [نمرات ثبت‌شده همان بازه‌ها]
  const activeGradePeriods = gradePeriods.filter((p) => p.isActive);

  // نوار فرمان چسبان صفحه‌ی ثبت نمرات: ماه انتخابی و فاصله‌ی چسبان زیر هدر برنامه
  const [gradesPeriod, setGradesPeriod] = useState<MonthlyContinuousKey>(
    () => SCORE_COLUMNS.find((m) => gradePeriods.find((p) => p.code === m.key)?.isActive)?.key ?? 'mehrContinuous'
  );
  const gradesPeriodOpen = gradePeriods.some((p) => p.code === gradesPeriod && p.isActive);
  const [gradesStickyTop, setGradesStickyTop] = useState(0);
  const [gradesFiltersOpen, setGradesFiltersOpen] = useState(false);
  const gradesMonthName = SCORE_COLUMNS.find((m) => m.key === gradesPeriod)?.monthName ?? '';
  // با اسکرول به پایین، پنل فیلترها خودکار جمع می‌شود
  useEffect(() => {
    if (!gradesFiltersOpen) return;
    let last = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - last) > 60) setGradesFiltersOpen(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [gradesFiltersOpen]);
  useEffect(() => {
    const measure = () => setGradesStickyTop(document.querySelector<HTMLElement>('.yv-header')?.offsetHeight || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const homeworkProblemCount = useMemo(() => homeworkProblemStudentCount(sessions, lastShamsiDays(14)), [sessions]);

  // فقط دروسی که نمره‌ی آن ماه برایشان باز شده و نمره‌ای ثبت نشده حساب می‌شوند
  const { totalUngradedGrades } = useMemo(() => {
    const totalUngradedGrades = activeGradePeriods.reduce(
      (n, p) => n + periodUngradedStats(p, academicSubjects, classes, students, academicGrades).missing,
      0,
    );
    return { totalUngradedGrades };
  }, [activeGradePeriods, academicSubjects, classes, students, academicGrades]);
  const [isGradePeriodsOpen, setIsGradePeriodsOpen] = useState(false);

  // معدل هر دانش‌آموز بر مبنای آزمون جامع (نه مستمر)؛ ماه کارنامه: یکی از ماه‌های آزمون یا میانگین همه‌ی آزمون‌ها
  const studentsAcademicData = useMemo(() => {
    const recordByClass = new Map(comprehensiveExams.map((r) => [r.classId, r]));
    return students.map(stu => {
      const studentClass = classes.find(c => c.id === stu.classId);
      const { gpa, scores } = studentExamSummary(recordByClass.get(stu.classId), stu.id, reportMonth as ExamMonth);
      const weakSubjects = EXAM_SUBJECTS.filter((s) => (scores[s.key] ?? 20) < 12).map((s) => s.label);

      return {
        student: stu,
        className: studentClass?.name || 'نامشخص',
        classId: stu.classId,
        gpa: gpa !== undefined ? Number(gpa.toFixed(2)) : undefined,
        gradesCount: Object.keys(scores).length,
        weakSubjects,
        hasWarning: gpa !== undefined ? gpa < 12 : false,
      };
    });
  }, [students, classes, comprehensiveExams, reportMonth]);

  // لیست دانش‌آموزان نیازمند پیگیری آموزشی
  // معیارها: مستمر زیر ۱۲، میانگین مستمر زیر ۱۲، دو هفته متوالی کاربرگ تحویل‌نداده، آزمون جامع زیر ۱۲، میانگین آزمون جامع زیر ۱۲
  const followUpsByStudent = useMemo(
    () => computeFollowUps({ students, grades: academicGrades, exams: comprehensiveExams, worksheets, worksheetWeeks, sessions, config: followUpConfig }),
    [students, academicGrades, comprehensiveExams, worksheets, worksheetWeeks, sessions, followUpConfig]
  );
  const academicWarningStudents = useMemo(() => {
    const byStudent = new Map(academicFollowUps.map((r) => [r.studentId, r]));
    return studentsAcademicData
      .map((s) => {
        const followUps = followUpsByStudent.get(s.student.id) || ([] as FollowUpReason[]);
        // اولویت: تعداد انواع مختلف مشکل (۱–۲ زرد، ۳ نارنجی، ۴ به بالا قرمز)
        const priority = new Set(followUps.map((f) => f.kind)).size;
        return { ...s, followUps, priority, followRecord: byStudent.get(s.student.id) };
      })
      .filter((s) => s.followUps.length > 0)
      .sort((a, b) => b.priority - a.priority);
  }, [studentsAcademicData, followUpsByStudent, academicFollowUps]);
  // موارد حل‌شده در شمارنده‌ها نمی‌آیند
  // لیست خاکستری این ماه: کدام دانش‌آموزان فرستاده شده‌اند
  const greyMonth = currentMonthKey();
  const greyThisMonth = useMemo(() => new Map(greyList.filter((r) => r.month === greyMonth).map((r) => [r.studentId, r])), [greyList, greyMonth]);
  const digestEntries = useMemo(
    () => academicWarningStudents.filter((s) => s.followRecord?.status !== 'resolved').map((s) => ({ id: s.student.id, name: studentFullName(s.student), className: s.className, priority: s.priority })),
    [academicWarningStudents]
  );
  const unsentIds = useMemo(() => new Set(digestEntries.filter((e) => !greyThisMonth.has(e.id)).map((e) => e.id)), [digestEntries, greyThisMonth]);
  const openWarningStudents = useMemo(() => academicWarningStudents.filter((s) => s.followRecord?.status !== 'resolved'), [academicWarningStudents]);

  // خروجی اکسل کلی مدرسه
  const handleExportSchoolExcel = () => {
    const data: any[] = [];
    classes.forEach(c => {
      const clsStudents = students.filter(s => s.classId === c.id);
      clsStudents.forEach(stu => {
        academicSubjects.forEach(sub => {
          const g = academicGrades.find(grd => grd.studentId === stu.id && grd.subjectId === sub.id);
          const avg = g ? gradeScoreForMonth(g, 'all') : undefined;
          data.push({
            'کلاس': c.name,
            'نام دانش‌آموز': `${studentFullName(stu)}`,
            'کد ملی / دانش‌آموزی': stu.nationalId || stu.studentCode || '-',
            'نام درس': sub.name,
            ...Object.fromEntries(SCORE_COLUMNS.map((m) => [m.monthName, g && typeof g[m.key] === 'number' ? g[m.key] : ''])),
            'میانگین مستمر': avg !== undefined ? Math.round(avg * 100) / 100 : 'ثبت نشده',
            'دبیر': sub.defaultTeacherName || sub.teacherName || c.academicAdvisor || '-',
          });
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'کارنامه کل آموزشگاه');
    XLSX.writeFile(workbook, `کارنامه_کل_آموزشگاه_یاوران_ولایت_${todayInfo.formattedDate}.xlsx`);
  };

  // خروجی اکسل کارنامه‌های کلاس
  const handleExportReportCardsExcel = (classId: string) => {
    const targetCls = classes.find(c => c.id === classId);
    const clsStudentsData = studentsAcademicData.filter(s => classId === 'all' || s.classId === classId);

    const rows = clsStudentsData.map((item, idx) => ({
      'ردیف': idx + 1,
      'نام و نام خانوادگی': `${studentFullName(item.student)}`,
      'کلاس': item.className,
      'کد ملی': item.student.nationalId || '-',
      'ستون': reportMonth === 'all' ? 'میانگین آزمون‌های جامع' : (SCORE_COLUMNS.find((m) => m.key === reportMonth)?.monthName ?? ''),
      'معدل': item.gpa !== undefined ? item.gpa : 'محاسبه نشده',
      'تعداد دروس ثبت شده': item.gradesCount,
      'وضعیت تحصیلی': item.gpa === undefined ? 'در حال ثبت' : item.gpa >= 17 ? 'ممتاز' : item.gpa >= 12 ? 'عادی' : 'نیازمند تلاش',
      'دروس دارای افت': item.weakSubjects.join('، ') || 'ندارد',
      'شماره تماس اولیا': item.student.parentPhone,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'کارنامه_تحصیلی');
    XLSX.writeFile(wb, `کارنامه_${targetCls ? targetCls.name : 'کل_کلاس‌ها'}_${todayInfo.formattedDate}.xlsx`);
  };

  return (
    <div className="edu-pastel flex flex-col lg:flex-row items-start gap-6 relative" dir="rtl">
      
      {/* سایدبار در حالت دسکتاپ (Docked Sidebar) */}
      <div className="hidden lg:block shrink-0 sticky top-20 z-20 yv-sidebar-dock">
        <EducationalSidebarNav
          variant="docked"
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          isOpen={true}
          onClose={() => {}}
          activeView={currentView}
          onSelectView={(view) => setCurrentView(view)}
          onOpenSettings={() => setCurrentView('settings')}
          counts={{
            classes: classes.length,
            subjects: academicSubjects.length,
            teachers: allTeachers.length,
            grades: totalUngradedGrades,
            reportCards: students.length,
            warnings: openWarningStudents.length,
            students: students.length,
            attendanceSessions: sessions.length,
          }}
        />
      </div>

      {/* نوار ناوبری پایین (فقط موبایل) */}
      {(() => {
        const nav = educationalMobileNav({ warnings: openWarningStudents.length }, currentUser.role === 'vice_educational');
        return (
          <MobileBottomNav
            items={nav.primary}
            moreItems={nav.more}
            activeId={currentView ?? HOME}
            onSelect={(id) => setCurrentView(id === HOME ? null : (id as EducationalViewType))}
          />
        );
      })()}

      {/* سایدبار در حالت موبایل و تبلت (Drawer) */}
      <EducationalSidebarNav
        variant="drawer"
        isCollapsed={false}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        activeView={currentView}
        onSelectView={(view) => {
          setCurrentView(view);
          setIsMobileSidebarOpen(false);
        }}
        onOpenSettings={() => {
          setCurrentView('settings');
          setIsMobileSidebarOpen(false);
        }}
        counts={{
          classes: classes.length,
          subjects: academicSubjects.length,
          teachers: allTeachers.length,
          grades: totalUngradedGrades,
          reportCards: students.length,
          warnings: openWarningStudents.length,
          students: students.length,
          attendanceSessions: sessions.length,
        }}
      />

      {/* بدنه محتوا (پیشخوان اصلی کار روزانه یا صفحات کاری تخصصی آموزشی) */}
      <div className="flex-1 min-w-0 w-full space-y-6">

        {/* ========================================================================= */}
        {/* حالت ۱: پیشخوان اصلی کار روزانه معاونت آموزشی (currentView === null) */}
        {/* ========================================================================= */}
        {deniedView && <AccessDeniedNotice onClose={() => setCurrentView(null)} />}
        {(currentView === null || currentView === 'warnings') && (
          <WeeklyFollowUpDigest
            userId={currentUser.id}
            entries={digestEntries}
            unsentIds={unsentIds}
            ready={students.length > 0}
            onOpenList={() => setCurrentView('warnings')}
          />
        )}
        {currentView === null && (
          <div className="space-y-6 animate-in fade-in" id="educational-dashboard-home">
            
            {/* ۱. هدر پیشخوان معاونت آموزشی */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex flex-row items-start sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-base sm:text-xl font-black text-slate-900 whitespace-nowrap">
                      سلام، {currentUser?.name || 'معاون آموزشی گرامی'} 👋
                    </h1>
                    <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-gradient-to-l from-emerald-50 to-teal-50 text-teal-800 border border-teal-200/80 shadow-2xs whitespace-nowrap">
                      معاونت آموزشی
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 flex-wrap">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>امروز: {todayInfo.dayOfWeek}، {todayInfo.displayDate}</span>
                    <span className="hidden sm:inline text-slate-300">•</span>
                    <span className="hidden sm:inline text-slate-500">مرکز مدیریت امور درسی و ارزیابی آموزشی</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <div className="hidden sm:block">
                    <TodayAbsenteesChip onSelectStudent={(stu) => onSelectStudent(stu, 'attendance')} />
                  </div>
                  <button
                    type="button"
                    id="btn-mobile-educational-sidebar-toggle"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="lg:hidden px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
                    title="باز کردن نوار کناری"
                    aria-label="باز کردن نوار کناری"
                  >
                    <Menu className="w-4 h-4" />
                    <span>منوی معاونت آموزشی</span>
                  </button>
                </div>
              </div>
              <div className="sm:hidden mt-3">
                <TodayAbsenteesChip variant="bar" onSelectStudent={(stu) => onSelectStudent(stu, 'attendance')} />
              </div>
            </div>

            {/* ۲. خلاصه وضعیت آماری با داده‌های واقعی */}
            <div data-stagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {([
                ['classes', 'کلاس‌ها', toPersianDigits(classes.length), 'مشاهده کلاس‌ها', School, 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950', 'text-emerald-600'],
                ['subjects', 'برنامه دروس', toPersianDigits(academicSubjects.length), 'تنظیم زنگ‌ها', BookOpen, 'bg-sky-50/70 border-sky-200/80 text-sky-950', 'text-blue-600'],
                ['teachers', 'کادر اساتید', toPersianDigits(allTeachers.length), 'لیست دبیران', GraduationCap, 'bg-purple-50/70 border-purple-200/80 text-purple-950', 'text-purple-600'],
                ['homework_followup', 'پیگیری تکالیف', toPersianDigits(homeworkProblemCount), homeworkProblemCount === 0 ? 'مورد باز نیست' : 'دانش‌آموز نیازمند پیگیری', ClipboardList, 'bg-teal-50/70 border-teal-200/80 text-teal-950', 'text-teal-600'],
                [
                  'grades',
                  'نمره ثبت‌نشده',
                  toPersianDigits(totalUngradedGrades),
                  activeGradePeriods.length === 0
                    ? 'بازه فعالی باز نیست'
                    : totalUngradedGrades === 0
                      ? 'تمام نمرات ثبت شده'
                      : 'ورود به کارپوشه',
                  Award,
                  'bg-amber-50/70 border-amber-200/80 text-amber-950',
                  'text-amber-600',
                ],
                ['warnings', 'نیازمند پیگیری', toPersianDigits(openWarningStudents.length), 'رسیدگی فوری', AlertTriangle, 'bg-rose-50/70 border-rose-200/80 text-rose-950', 'text-rose-600'],
              ] as const).map(([view, label, value, hint, Icon, tone, iconTone], idx) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => (view === 'grades' && activeGradePeriods.length === 0 ? setIsGradePeriodsOpen(true) : setCurrentView(view))}
                  className={`${idx >= 4 ? 'hidden sm:block ' : ''}p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-teal-200 transition-all text-right cursor-pointer min-h-[7.5rem]`}
                  data-tone={tone}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap">{label}</span>
                    <div className={`bg-slate-50 rounded-xl p-2 ${iconTone}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tabular-nums mt-2"><MaybeAnimated text={value} /></div>
                  {view === 'homework_followup' && homeworkProblemCount > 0 ? (
                    <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800 whitespace-nowrap">
                      <span>نیازمند پیگیری</span>
                      <ChevronLeft className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1 whitespace-nowrap">
                      <span>{hint}</span>
                      <ChevronLeft className="w-3 h-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsGradePeriodsOpen(true)}
              className="w-full sm:w-auto min-h-11 px-4 rounded-2xl bg-emerald-50/70 backdrop-blur border border-emerald-200/90 text-emerald-800 hover:bg-emerald-100 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>مدیریت ثبت نمره‌ی ماه‌ها (مهر تا اردیبهشت)</span>
            </button>

            <ClassActivityTrends />

            {/* ۲/۱. هشدار کاربرگ هفتگی */}
            {canAccessSection(currentUser, 'worksheets') && <WorksheetAlertsCard onOpen={() => setCurrentView('worksheets')} />}

            {/* ۳. مسیرهای کار روزمره */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <h2 className="text-sm font-bold text-slate-800 mb-3.5">
                مسیرهای کار روزمره معاونت آموزشی
              </h2>
              <div data-stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  ['grades', 'کارپوشه ثبت نمره', Award, 'bg-emerald-50/60 border-emerald-200/80', 'text-emerald-600', 'bg-emerald-100/70 text-emerald-800 border-emerald-200'],
                  ['report_cards', 'کارنامه و سوابق تحصیلی', FileText, 'bg-sky-50/60 border-sky-200/80', 'text-sky-600', 'bg-sky-100/70 text-sky-800 border-sky-200'],
                  ['subjects', 'برنامه دروس و اساتید', BookOpen, 'bg-violet-50/60 border-violet-200/80', 'text-violet-600', 'bg-violet-100/70 text-violet-800 border-violet-200'],
                  ['reports', 'گزارش‌های آموزشی', BarChart3, 'bg-teal-50/60 border-teal-200/80', 'text-teal-600', 'bg-teal-100/70 text-teal-800 border-teal-200'],
                ] as const).map(([view, title, Icon, tone, iconTone, pill]) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setCurrentView(view)}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm text-right flex flex-col gap-3 hover:-translate-y-1 hover:shadow-md hover:border-teal-200 transition-all cursor-pointer"
                    data-tone={tone}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 ${iconTone}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{title}</div>
                      </div>
                    </div>
                    <span className="self-end text-[11px] font-bold text-teal-700 whitespace-nowrap">
                      ورود به بخش ←
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ۴. آخرین جلسه‌ی هر کلاس */}
            <TeacherClassesSummary classes={classes} sessions={sessions} />

          </div>
        )}

        {/* ========================================================================= */}
        {/* حالت ۲: کلاس‌ها (currentView === 'classes') */}
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
            onOpenNewClass={onOpenNewClass || (() => setIsAddClassModalOpen(true))}
            onOpenClassDetail={onOpenClassDetail || ((cls) => {})}
            onOpenNewAttendance={onOpenNewAttendance || (() => {})}
            onOpenMonthlySummary={onOpenMonthlySummary || (() => {})}
            onOpenAcademicGrades={(classId) => {
              if (classId) setSelectedClassId(classId);
              setCurrentView('grades');
            }}
            onSelectStudent={(stu) => onSelectStudent(stu, 'grades')}
            onEditClass={(cls) => setClassToEdit(cls)}
          />
        )}

        {/* ========================================================================= */}
        {/* حالت ۳: دروس و زنگ‌ها (currentView === 'subjects') */}
        {/* ========================================================================= */}
        {currentView === 'subjects' && (
          <AdminSubjectsWorkspace
            onBack={() => setCurrentView(null)}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          />
        )}

        {/* ========================================================================= */}
        {/* حالت ۴: دبیران و اساتید (currentView === 'teachers') */}
        {/* ========================================================================= */}
        {currentView === 'teachers' && (
          <AdminTeachersWorkspace
            allTeachers={allTeachers}
            classes={classes}
            onBack={() => setCurrentView(null)}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
            onOpenNewTeacher={onOpenNewTeacher || (() => setIsAddTeacherModalOpen(true))}
            onSelectTeacherForProfile={onSelectTeacherForProfile || ((t) => {
              setSelectedTeacher(t);
              setIsTeacherProfileOpen(true);
            })}
            onEditTeacher={(t) => {
              setTeacherToEdit(t);
              setIsEditTeacherModalOpen(true);
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* حالت ۵: کارپوشه ثبت نمره (currentView === 'grades') */}
        {/* ========================================================================= */}
        {currentView === 'grades' && (
          <div className="space-y-5 animate-in fade-in" dir="rtl">
            
            {/* هدر فشرده */}
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => setCurrentView(null)} aria-label="بازگشت به پیشخوان" className="w-11 h-11 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer">
                <ArrowRight className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-black text-slate-900 flex items-center gap-2 truncate">
                  <Award className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span className="truncate">ثبت نمرات ماهانه</span>
                </h1>
                <span className="text-[11px] font-bold text-slate-500">سال تحصیلی {getActiveAcademicYear()}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsGradePeriodsOpen(true)}
                className="h-11 px-3 shrink-0 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>مدیریت ماه‌ها</span>
              </button>
              <button type="button" onClick={() => setIsMobileSidebarOpen(true)} aria-label="باز کردن منو" className="lg:hidden w-11 h-11 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center cursor-pointer">
                <Menu className="w-5 h-5" />
              </button>
            </div>

            {/* نوار خلاصه‌ی چسبان: فیلترها جمع‌شونده‌اند (پیش‌فرض بسته) */}
            <div className="sticky z-20 -mx-4 px-4 py-2 bg-slate-50/85 backdrop-blur-md border-b border-slate-200/60" style={{ top: gradesStickyTop }}>
              <button
                type="button"
                onClick={() => setGradesFiltersOpen((v) => !v)}
                aria-expanded={gradesFiltersOpen}
                aria-controls="grades-filters-panel"
                className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer"
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${gradesPeriodOpen ? 'bg-emerald-500' : 'bg-slate-300'}`} aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5 truncate"><CalendarCheck className="w-4 h-4 text-emerald-700 shrink-0" />{gradesMonthName}</span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1.5 truncate min-w-0"><School className="w-4 h-4 text-slate-500 shrink-0" /><span className="truncate">کلاس {currentClass?.name || '—'}</span></span>
                <ChevronDown className={`w-4 h-4 mr-auto shrink-0 text-slate-400 transition-transform duration-200 ${gradesFiltersOpen ? 'rotate-180' : ''}`} />
              </button>
              <div id="grades-filters-panel" className={`grid transition-[grid-template-rows] duration-300 ${gradesFiltersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 pt-2">
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      aria-label="کلاس"
                      tabIndex={gradesFiltersOpen ? 0 : -1}
                      className="flex-1 min-w-0 h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
                    >
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div className="relative flex-1 min-w-0">
                      <span
                        className={`absolute right-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${gradesPeriodOpen ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        title={gradesPeriodOpen ? 'ثبت نمره‌ی این ماه باز است' : 'ثبت نمره‌ی این ماه بسته است'}
                        aria-hidden="true"
                      />
                      <select
                        value={gradesPeriod}
                        onChange={(e) => setGradesPeriod(e.target.value as MonthlyContinuousKey)}
                        aria-label={`ماه (${gradesPeriodOpen ? 'باز' : 'بسته'})`}
                        tabIndex={gradesFiltersOpen ? 0 : -1}
                        className="w-full h-11 bg-white border border-slate-200 rounded-xl pr-8 pl-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
                      >
                        {SCORE_COLUMNS.map((m) => <option key={m.key} value={m.key}>{m.monthName}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* دروس بدون نمره */}
            <UngradedSubjectsPanel
              classId={selectedClassId}
              period={gradesPeriod}
              onPick={(classId, subjectId) => {
                setSelectedClassId(classId);
                setSelectedSubjectId(subjectId);
                window.setTimeout(() => document.getElementById('educational-grade-book')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              }}
            />

            {/* ۳. ثبت نمره‌ی ماه‌به‌ماه: با باز شدن هر ماه فقط یک نمره ثبت می‌شود */}
            {currentClass && (
              <div id="educational-grade-book" className="scroll-mt-4">
                <ClassMonthlyGradesSection
                  key={`${currentClass.id}-${selectedSubjectId}`}
                  classData={currentClass}
                  initialSubjectId={selectedSubjectId}
                  onSelectStudent={(stu) => onSelectStudent(stu, 'grades')}
                />
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {currentView === 'grey_list' && (
          <div className="space-y-3">
            <button type="button" onClick={() => setCurrentView(null)} className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">← بازگشت به داشبورد</button>
            <GreyListWorkspace onSelectStudent={(stu) => onSelectStudent(stu, 'grades')} />
          </div>
        )}

        {currentView === 'homework_followup' && (
          <div className="space-y-3">
            <HomeworkFollowUpReport onSelectStudent={(stu) => onSelectStudent(stu)} onBack={() => setCurrentView(null)} />
          </div>
        )}

        {currentView === 'announcements' && (
          <AnnouncementsManagement
            onBack={() => setCurrentView(null)}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          />
        )}

        {currentView === 'lesson_plans' && currentUser.role !== 'vice_educational' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-600" dir="rtl">بررسی و تأیید طرح درس اساتید فقط با معاون آموزشی است.</div>
        )}

        {currentView === 'lesson_plans' && currentUser.role === 'vice_educational' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3" dir="rtl">
              <button
                onClick={() => setCurrentView(null)}
                className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 cursor-pointer"
                aria-label="بازگشت"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-extrabold text-slate-900 flex-1">طرح درس اساتید</h1>
            </div>
            <LessonPlansReview />
          </div>
        )}

        {currentView === 'worksheets' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3" dir="rtl">
              <button
                onClick={() => setCurrentView(null)}
                className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 cursor-pointer"
                aria-label="بازگشت"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-extrabold text-slate-900 flex-1">کاربرگ</h1>
            </div>
            <WorksheetsWorkspace />
          </div>
        )}

        {currentView === 'teacher_evaluation' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3" dir="rtl">
              <button
                onClick={() => setCurrentView(null)}
                className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 cursor-pointer"
                aria-label="بازگشت"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-extrabold text-slate-900 flex-1">ارزیابی اساتید</h1>
            </div>
            <TeacherEvaluationSection mode="evaluations" />
          </div>
        )}

        {/* آزمون جامع (currentView === 'comprehensive_exam') */}
        {currentView === 'comprehensive_exam' && (
          <ComprehensiveExamManagement
            onBack={() => setCurrentView(null)}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          />
        )}

        {/* حالت ۶: کارنامه و سوابق تحصیلی (currentView === 'report_cards') */}
        {/* ========================================================================= */}
        {currentView === 'report_cards' && (
          <div className="space-y-5 animate-in fade-in" dir="rtl">
            
            {/* ۱. هدر کارنامه */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
                    <span>پیشخوان اصلی</span>
                    <span>/</span>
                    <span className="text-teal-800">کارنامه و سوابق تحصیلی</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
                    <FileText className="w-6 h-6 text-teal-800" />
                    <span>کارنامه و پرونده آموزشی دانش‌آموزان</span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    مشاهده معدل کل، ریزنمرات دروس، صدور کارنامه رسمی، چاپ و خروجی اکسل.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="lg:hidden px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
                    title="باز کردن نوار کناری"
                  >
                    <Menu className="w-4 h-4 text-slate-700" />
                    <span>منو</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportReportCardsExcel(reportCardClassId)}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>خروجی اکسل کارنامه‌ها</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentView(null)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>بازگشت به پیشخوان</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ۲. فیلتر کلاس و جستجوی دانش‌آموز */}
              <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap pb-1">
                  <button
                    type="button"
                    onClick={() => setReportCardClassId('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                      reportCardClassId === 'all'
                        ? 'bg-teal-800 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    همه کلاس‌ها ({toPersianDigits(students.length)})
                  </button>
                  {classes.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setReportCardClassId(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                        reportCardClassId === c.id
                          ? 'bg-teal-800 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                <select
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value as ReportMonth)}
                  aria-label="ماه کارنامه"
                  className="min-h-[40px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-700 cursor-pointer"
                >
                  <option value="all">میانگین آزمون‌های جامع</option>
                  {EXAM_MONTHS.map((m) => <option key={m.key} value={m.key}>{`آزمون جامع ${m.monthName}`}</option>)}
                </select>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="جستجوی دانش‌آموز..."
                    value={reportCardSearch}
                    onChange={(e) => setReportCardSearch(e.target.value)}
                    className="pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-700 w-full sm:w-60"
                  />
                </div>
              </div>
            </div>

            {/* ۳. لیست کارنامه‌های دانش‌آموزان */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studentsAcademicData
                .filter(item => {
                  if (reportCardClassId !== 'all' && item.classId !== reportCardClassId) return false;
                  if (!reportCardSearch) return true;
                  const q = reportCardSearch.trim().toLowerCase();
                  const name = `${studentFullName(item.student)}`.toLowerCase();
                  const code = item.student.nationalId || item.student.studentCode || '';
                  return name.includes(q) || code.includes(q);
                })
                .map(item => {
                  const hasGpa = item.gpa !== undefined;
                  const isExcellent = hasGpa && item.gpa! >= 17;
                  const isWeak = hasGpa && item.gpa! < 12;

                  return (
                    <div
                      key={item.student.id}
                      className="group bg-white rounded-3xl p-5 border border-slate-200/70 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-teal-300 transition-all duration-200 flex flex-col gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-500 text-white flex items-center justify-center font-extrabold text-lg shrink-0 shadow-sm">
                          {item.student.firstName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onSelectStudent(item.student, 'grades')}
                            className="block max-w-full truncate font-extrabold text-slate-900 hover:text-teal-800 transition text-right text-[15px] leading-7 cursor-pointer"
                          >
                            {studentFullName(item.student)}
                          </button>
                          <div className="text-xs text-slate-500 leading-6">
                            کلاس {item.className}
                          </div>
                        </div>
                        {hasGpa && (
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                            isExcellent
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                              : isWeak
                                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                                : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                          }`}>
                            {isExcellent ? 'ممتاز' : isWeak ? 'نیازمند تلاش' : 'عادی'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                          <div className="text-[11px] text-slate-500 mb-1">معدل آزمون جامع</div>
                          <div className={`inline-flex items-center justify-center min-w-[3rem] text-lg font-black tabular-nums px-3 py-0.5 rounded-xl ${scorePillClass(hasGpa ? item.gpa! : null)}`}>
                            {hasGpa ? toPersianDigits(item.gpa!) : '—'}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                          <div className="text-[11px] text-slate-500 mb-1">دروس آزمون جامع</div>
                          <div className="text-lg font-black text-slate-800 tabular-nums">
                            {toPersianDigits(item.gradesCount)} <span className="text-xs font-semibold text-slate-500">درس</span>
                          </div>
                        </div>
                      </div>

                      {item.weakSubjects.length > 0 && (
                        <div className="text-xs text-rose-700 bg-rose-50 rounded-xl px-3 py-2 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">افت در: {item.weakSubjects.join('، ')}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectStudent(item.student, 'grades')}
                        className="mt-auto w-full py-2.5 px-4 bg-teal-800 hover:bg-teal-900 text-white rounded-2xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span>مشاهده کارنامه رسمی</span>
                        <ChevronLeft className="w-4 h-4 opacity-70 group-hover:-translate-x-0.5 transition" />
                      </button>
                    </div>
                  );
                })}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* حالت ۷: گزارش‌های آموزشی (currentView === 'reports') */}
        {/* ========================================================================= */}
        {currentView === 'reports' && (
          <div className="space-y-6">
          <AdminReportsWorkspace
            classes={classes}
            students={students}
            sessions={sessions}
            teachers={allTeachers}
            onBack={() => setCurrentView(null)}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
            onOpenAcademicGrades={() => setCurrentView('grades')}
            onViewWarnings={() => setCurrentView('warnings')}
          />
          <ExamEducationalReport onSelectStudent={(stu) => onSelectStudent(stu, 'grades')} />
          <TermComprehensiveReport onSelectStudent={(stu) => onSelectStudent(stu, 'grades')} />
          <SubjectClassAnalysis />
          </div>
        )}

        {/* ========================================================================= */}
        {/* حالت ۸: دانش‌آموزان نیازمند پیگیری آموزشی (currentView === 'warnings') */}
        {/* ========================================================================= */}
        {currentView === 'warnings' && (
          <div className="space-y-5 animate-in fade-in" dir="rtl">
            
            {/* ۱. هدر پیگیری آموزشی */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
                    <span>پیشخوان اصلی</span>
                    <span>/</span>
                    <span className="text-rose-700">هشدارهای تحصیلی و پیگیری نمرات</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
                    <AlertTriangle className="w-6 h-6 text-rose-700" />
                    <span>دانش‌آموزان نیازمند توجه و پیگیری آموزشی</span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    شناسایی دانش‌آموزان دارای نقص آموزشی از هر جهت: نمره (مستمر، افت، آزمون جامع)، تکلیف (مثلاً ۳ بار انجام‌نشده در یک ماه برای هر درس)، کاربرگ (دو هفته متوالی) و غیبت، تأخیر یا اخطار کلاسی. هرچه انواع مشکل بیشتر، اولویت بالاتر.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="lg:hidden px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
                    title="باز کردن نوار کناری"
                  >
                    <Menu className="w-4 h-4 text-slate-700" />
                    <span>منو</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCriteriaOpen(true)}
                    className="min-h-11 px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="تعیین ملاک‌های نمایش دانش‌آموزان در این لیست"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>پیشرفته</span>
                    {!isDefaultFollowUpConfig(followUpConfig) && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px]">سفارشی</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClassId(classes[0]?.id || '');
                      setCurrentView('grades');
                    }}
                    className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Award className="w-4 h-4" />
                    <span>ورود به کارپوشه ثبت نمره</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentView(null)}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>بازگشت به پیشخوان</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ۲. فیلترها */}
              <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">فیلتر کلاس:</span>
                  <select
                    value={warningClassFilter}
                    onChange={(e) => setWarningClassFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-700 cursor-pointer"
                  >
                    <option value="all">همه کلاس‌ها</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="جستجوی نام یا تلفن ولی..."
                    value={warningSearch}
                    onChange={(e) => setWarningSearch(e.target.value)}
                    className="pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-700 w-full sm:w-60"
                  />
                </div>
              </div>

              {/* نوع مشکل و موارد حل‌شده */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs font-bold">
                {(['all', 'grades', 'homework', 'worksheet', 'attendance'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setWarningGroup(g)}
                    aria-pressed={warningGroup === g}
                    className={`min-h-[40px] px-3.5 rounded-full border cursor-pointer transition ${warningGroup === g ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {g === 'all' ? 'همه موارد' : FOLLOW_UP_GROUP_LABEL[g]}
                  </button>
                ))}
                <label className="mr-auto inline-flex items-center gap-1.5 min-h-[40px] text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="w-4 h-4" />
                  نمایش موارد حل‌شده
                </label>
              </div>
            </div>

            {criteriaOpen && <FollowUpCriteriaModal config={followUpConfig} onSave={saveFollowUpConfig} onClose={() => setCriteriaOpen(false)} />}

            {/* ۳. جدول موارد پیگیری */}
            <AcademicFollowUpTable
              items={academicWarningStudents.filter((item) => {
                if (warningClassFilter !== 'all' && item.classId !== warningClassFilter) return false;
                if (!showResolved && item.followRecord?.status === 'resolved') return false;
                if (warningGroup !== 'all' && !item.followUps.some((f) => f.group === warningGroup)) return false;
                if (!warningSearch) return true;
                const q = warningSearch.trim().toLowerCase();
                return `${studentFullName(item.student)}`.toLowerCase().includes(q) || (item.student.parentPhone || '').includes(q);
              })}
              onOpenReportCard={(stu) => onSelectStudent(stu, 'grades')}
              onSetFollowUp={setAcademicFollowUp}
              greySentId={(stu) => greyThisMonth.get(stu.id)?.id}
              onSendGrey={(item) => {
                sendToGreyList(item.student, buildGreySnapshot(academicGrades.filter((g) => g.studentId === item.student.id), item.followUps), greyMonth);
                showToast(`«${studentFullName(item.student)}» به لیست خاکستری مربی فرستاده شد.`, 'success');
              }}
              onWithdrawGrey={withdrawFromGreyList}
            />

          </div>
        )}

        {/* ========================================================================= */}
        {/* حالت ۹: وضعیت تحصیلی / دانش‌آموزان (currentView === 'students') */}
        {/* ========================================================================= */}
        {currentView === 'students' && (
          <AdminStudentsWorkspace
            students={students}
            classes={classes}
            sessions={sessions}
            morningDelays={morningDelays}
            onBack={() => setCurrentView(null)}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
            onSelectStudent={(stu) => onSelectStudent(stu, 'grades')}
            onOpenQuickAddStudent={() => setIsQuickAddStudentOpen(true)}
          />
        )}

        {/* ========================================================================= */}
        {/* حالت ۱۰: حضور و غیاب کلاسی (currentView === 'attendance') */}
        {/* ========================================================================= */}
        {currentView === 'attendance' && (
          <AdminAttendanceWorkspace
            sessions={sessions}
            classes={classes}
            onBack={() => setCurrentView(null)}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
            onOpenNewAttendance={onOpenNewAttendance || (() => {})}
            showMorning={false}
          />
        )}

        {/* ========================================================================= */}
        {/* حالت ۱۱: تنظیمات پایه آموزشی (currentView === 'settings') */}
        {/* ========================================================================= */}
        {currentView === 'settings' && (
          <AdminSettingsWorkspace
            onBack={() => setCurrentView(null)}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          />
        )}

      </div>

      {/* مدال نمودار رشد دانش‌آموز */}
      {selectedStudentForChart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-bold text-sm">
                نمودار رشد و پیشرفت تحصیلی • {studentFullName(selectedStudentForChart)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedStudentForChart(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <StudentGrowthChart
                grades={academicGrades.filter(g => g.studentId === selectedStudentForChart.id)}
                studentName={`${studentFullName(selectedStudentForChart)}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* مدال‌های اختصاصی ایجاد و ویرایش کلاس و معلم */}
      <AddClassModal
        isOpen={isAddClassModalOpen}
        onClose={() => setIsAddClassModalOpen(false)}
      />

      {classToEdit && (
        <EditClassModal
          isOpen={!!classToEdit}
          onClose={() => setClassToEdit(null)}
          schoolClass={classToEdit}
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

      {selectedTeacher && (
        <TeacherProfileModal
          isOpen={isTeacherProfileOpen}
          onClose={() => {
            setIsTeacherProfileOpen(false);
            setSelectedTeacher(null);
          }}
          teacher={selectedTeacher}
          onEdit={(t) => {
            setIsTeacherProfileOpen(false);
            setSelectedTeacher(null);
            setTeacherToEdit(t);
            setIsEditTeacherModalOpen(true);
          }}
        />
      )}

      <QuickAddStudentModal
        isOpen={isQuickAddStudentOpen}
        onClose={() => setIsQuickAddStudentOpen(false)}
      />

      <GradePeriodsModal isOpen={isGradePeriodsOpen} onClose={() => setIsGradePeriodsOpen(false)} />
    </div>
  );
};
