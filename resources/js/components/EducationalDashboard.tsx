import { subjectAppliesToClass } from '../utils/courseAssignments';
import { useScrollTop } from '../utils/useScrollTop';
import { AccessDeniedNotice } from './AccessDeniedNotice';
import { canAccessSection } from '../utils/permissions';
import React, { useState, useMemo, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student, StudentAcademicGrade, AcademicSubject, User } from '../types';
import { toPersianDigits, toEnglishDigits, getTodayShamsi } from '../utils/persianDate';
import { calculateAnnualScore, analyzeSubjectGrade } from '../utils/academicAnalysis';
import { StudentGrowthChart } from './StudentGrowthChart';
import { TeacherEvaluationSection } from './TeacherEvaluationSection';
import { AnnouncementsManagement } from './AnnouncementsManagement';
import { TeacherActivitiesReport } from './TeacherActivitiesReport';
import { WorksheetsWorkspace } from './WorksheetsWorkspace';
import { WorksheetAlertsCard } from './WorksheetAlertsCard';
import { GradePeriodsModal } from './GradePeriodsModal';
import { scorePillClass } from '../utils/gradePeriods';
import { ComprehensiveExamManagement } from './ComprehensiveExamManagement';
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
  PhoneCall,
  Calendar,
  AlertTriangle,
  X,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MobileBottomNav } from './MobileBottomNav';
import { educationalMobileNav, HOME } from './mobileNavConfigs';
import { studentFullName } from '../utils/studentName';

interface EducationalDashboardProps {
  onSelectStudent: (student: Student, initialTab?: 'overview' | 'info' | 'attendance' | 'discipline' | 'grades') => void;
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

  // وضعیت‌های بخش هشدارهای آموزشی
  const [warningClassFilter, setWarningClassFilter] = useState<string>('all');
  const [warningSearch, setWarningSearch] = useState('');

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

  // حالت پیش‌نویس موقت نمرات
  const [draftGrades, setDraftGrades] = useState<Record<string, {
    c1?: string;
    f1?: string;
    c2?: string;
    f2?: string;
    notes?: string;
  }>>({});

  // به‌روزرسانی پیش‌نویس نمرات هنگام تغییر کلاس یا درس
  React.useEffect(() => {
    if (!selectedClassId || !selectedSubjectId) return;

    const classStudents = students.filter(s => s.classId === selectedClassId);
    const draft: Record<string, { c1?: string; f1?: string; c2?: string; f2?: string; notes?: string }> = {};

    classStudents.forEach(stu => {
      const existing = academicGrades.find(
        g => g.studentId === stu.id && g.subjectId === selectedSubjectId
      );
      if (existing) {
        draft[stu.id] = {
          c1: existing.term1Continuous !== undefined ? existing.term1Continuous.toString() : '',
          f1: existing.term1Final !== undefined ? existing.term1Final.toString() : '',
          c2: existing.term2Continuous !== undefined ? existing.term2Continuous.toString() : '',
          f2: existing.term2Final !== undefined ? existing.term2Final.toString() : '',
          notes: existing.notes || '',
        };
      } else {
        draft[stu.id] = { c1: '', f1: '', c2: '', f2: '', notes: '' };
      }
    });

    setDraftGrades(draft);
  }, [selectedClassId, selectedSubjectId, students, academicGrades]);

  const currentClass = classes.find(c => c.id === selectedClassId);
  const currentSubject = academicSubjects.find(s => s.id === selectedSubjectId);
  const classStudents = students.filter(s => s.classId === selectedClassId);

  // فیلتر دانش‌آموزان در جدول ثبت نمره
  const filteredStudents = classStudents.filter(s => {
    const fullName = `${studentFullName(s)}`.toLowerCase();
    const code = s.studentCode?.toLowerCase() || '';
    const matchSearch = !searchQuery || fullName.includes(searchQuery.toLowerCase()) || code.includes(searchQuery);
    if (!matchSearch) return false;

    const draft = draftGrades[s.id] || {};
    const c1 = draft.c1 ? parseFloat(draft.c1) : undefined;
    const f1 = draft.f1 ? parseFloat(draft.f1) : undefined;
    const c2 = draft.c2 ? parseFloat(draft.c2) : undefined;
    const f2 = draft.f2 ? parseFloat(draft.f2) : undefined;
    const annual = calculateAnnualScore(c1, f1, c2, f2);

    if (statusFilter === 'excellent') return annual !== undefined && annual >= 17;
    if (statusFilter === 'normal') return annual !== undefined && annual >= 12 && annual < 17;
    if (statusFilter === 'weak') return annual !== undefined && annual < 12;
    if (statusFilter === 'ungraded') return c1 === undefined && f1 === undefined && c2 === undefined && f2 === undefined;

    return true;
  });

  const handleScoreChange = (
    studentId: string, 
    field: 'c1' | 'f1' | 'c2' | 'f2' | 'notes', 
    rawVal: string
  ) => {
    const val = toEnglishDigits(rawVal);
    if (field !== 'notes' && val !== '') {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0 || num > 20) return;
    }

    setDraftGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: val,
      }
    }));
  };

  const handleSaveGrades = () => {
    if (!selectedClassId || !selectedSubjectId || !currentSubject) return;

    const gradesToSave: StudentAcademicGrade[] = classStudents.map(stu => {
      const draft = draftGrades[stu.id] || {};
      const c1 = draft.c1 && draft.c1.trim() !== '' ? parseFloat(draft.c1) : undefined;
      const f1 = draft.f1 && draft.f1.trim() !== '' ? parseFloat(draft.f1) : undefined;
      const c2 = draft.c2 && draft.c2.trim() !== '' ? parseFloat(draft.c2) : undefined;
      const f2 = draft.f2 && draft.f2.trim() !== '' ? parseFloat(draft.f2) : undefined;

      const existing = academicGrades.find(
        g => g.studentId === stu.id && g.subjectId === selectedSubjectId
      );

      return {
        id: existing ? existing.id : `grd-${stu.id}-${selectedSubjectId}`,
        studentId: stu.id,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        subjectName: currentSubject.name,
        term1Continuous: c1,
        term1Final: f1,
        term2Continuous: c2,
        term2Final: f2,
        notes: draft.notes,
        teacherName: currentSubject.defaultTeacherName,
        updatedAt: new Date().toISOString(),
      };
    });

    saveBatchAcademicGrades(gradesToSave);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  // محاسبات آماری آموزشی کل مدرسه
  let schoolTotalStudents = students.length;
  let totalGradesRecorded = academicGrades.length;
  let passedCount = 0;
  let excellentCount = 0;
  let needHelpCount = 0;

  academicGrades.forEach(g => {
    const ann = calculateAnnualScore(g.term1Continuous, g.term1Final, g.term2Continuous, g.term2Final);
    if (ann !== undefined) {
      if (ann >= 10) passedCount++;
      if (ann >= 17) excellentCount++;
      if (ann < 12) needHelpCount++;
    }
  });

  // نمرات ثبت‌نشده: فقط بازه‌های فعال‌شده توسط معاون آموزش مبنای محاسبه‌اند
  // = [مجموع دانش‌آموزان هر درس × بازه‌های فعال] − [نمرات ثبت‌شده همان بازه‌ها]
  const activeGradePeriods = gradePeriods.filter((p) => p.isActive);
  const { totalUngradedGrades } = useMemo(() => {
    if (activeGradePeriods.length === 0) return { totalUngradedGrades: 0 };
    const subjectClassIds = new Map<string, Set<string>>();
    academicSubjects.forEach((sub) => {
      subjectClassIds.set(sub.id, new Set(classes.filter((c) => subjectAppliesToClass(sub, c)).map((c) => c.id)));
    });
    let expected = 0;
    academicSubjects.forEach((sub) => {
      const ids = subjectClassIds.get(sub.id)!;
      expected += students.filter((st) => ids.has(st.classId)).length * activeGradePeriods.length;
    });
    const studentClass = new Map(students.map((st) => [st.id, st.classId]));
    let recorded = 0;
    academicGrades.forEach((g) => {
      const classId = studentClass.get(g.studentId);
      if (!classId || !subjectClassIds.get(g.subjectId)?.has(classId)) return;
      activeGradePeriods.forEach((p) => {
        const v = g[p.code];
        if (typeof v === 'number' && !Number.isNaN(v)) recorded++;
      });
    });
    return { totalUngradedGrades: Math.max(0, expected - recorded) };
  }, [activeGradePeriods, academicSubjects, classes, students, academicGrades]);
  const [isGradePeriodsOpen, setIsGradePeriodsOpen] = useState(false);

  // معدل کل مدرسه
  let schoolGradeSum = 0;
  let schoolGradeCount = 0;
  academicGrades.forEach(g => {
    if (g.term1Continuous !== undefined) {
      schoolGradeSum += g.term1Continuous;
      schoolGradeCount++;
    }
  });
  const schoolAverageGrade = schoolGradeCount > 0 ? (schoolGradeSum / schoolGradeCount).toFixed(1) : '۱۸.۴';

  // محاسبه معدل تحصیلی هر دانش‌آموز جهت کارنامه و پیگیری
  const studentsAcademicData = useMemo(() => {
    return students.map(stu => {
      const studentClass = classes.find(c => c.id === stu.classId);
      const stuGrades = academicGrades.filter(g => g.studentId === stu.id);
      
      let sum = 0;
      let totalWeight = 0;
      let weakSubjects: string[] = [];

      stuGrades.forEach(g => {
        const ann = calculateAnnualScore(g.term1Continuous, g.term1Final, g.term2Continuous, g.term2Final);
        const coeff = 1;
        if (ann !== undefined) {
          sum += ann * coeff;
          totalWeight += coeff;
          if (ann < 12) {
            weakSubjects.push(g.subjectName);
          }
        }
      });

      const gpa = totalWeight > 0 ? (sum / totalWeight) : undefined;

      return {
        student: stu,
        className: studentClass?.name || 'نامشخص',
        classId: stu.classId,
        gpa: gpa !== undefined ? Number(gpa.toFixed(2)) : undefined,
        gradesCount: stuGrades.length,
        weakSubjects,
        hasWarning: gpa !== undefined ? gpa < 12 : false,
      };
    });
  }, [students, classes, academicGrades]);

  // لیست دانش‌آموزان نیازمند پیگیری آموزشی
  const academicWarningStudents = useMemo(() => {
    return studentsAcademicData.filter(s => s.hasWarning || s.weakSubjects.length > 0);
  }, [studentsAcademicData]);

  // خروجی اکسل کارپوشه کلاسی
  const handleExportClassExcel = () => {
    if (!currentClass || !currentSubject) return;

    const data = filteredStudents.map((s, idx) => {
      const draft = draftGrades[s.id] || {};
      const c1 = draft.c1 ? parseFloat(draft.c1) : undefined;
      const f1 = draft.f1 ? parseFloat(draft.f1) : undefined;
      const c2 = draft.c2 ? parseFloat(draft.c2) : undefined;
      const f2 = draft.f2 ? parseFloat(draft.f2) : undefined;
      const ann = calculateAnnualScore(c1, f1, c2, f2);

      return {
        'ردیف': idx + 1,
        'کد دانش‌آموز': s.studentCode || '',
        'نام': s.firstName,
        'نام خانوادگی': s.lastName,
        'کلاس': currentClass.name,
        'درس': currentSubject.name,
        'مستمر نوبت اول': draft.c1 || '',
        'پایانی نوبت اول': draft.f1 || '',
        'مستمر نوبت دوم': draft.c2 || '',
        'پایانی نوبت دوم': draft.f2 || '',
        'نمره سالانه': ann !== undefined ? ann : 'ثبت نشده',
        'وضعیت': ann === undefined ? 'ثبت نشده' : ann >= 10 ? 'قبول' : 'تجدید',
        'ملاحظات': draft.notes || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ریز نمرات');
    XLSX.writeFile(workbook, `ریز_نمرات_${currentSubject.name}_${currentClass.name}_مدرسه_یاوران_ولایت.xlsx`);
  };

  // خروجی اکسل کلی مدرسه
  const handleExportSchoolExcel = () => {
    const data: any[] = [];
    classes.forEach(c => {
      const clsStudents = students.filter(s => s.classId === c.id);
      clsStudents.forEach(stu => {
        academicSubjects.forEach(sub => {
          const g = academicGrades.find(grd => grd.studentId === stu.id && grd.subjectId === sub.id);
          const ann = g ? calculateAnnualScore(g.term1Continuous, g.term1Final, g.term2Continuous, g.term2Final) : undefined;
          data.push({
            'کلاس': c.name,
            'نام دانش‌آموز': `${studentFullName(stu)}`,
            'کد ملی / دانش‌آموزی': stu.nationalId || stu.studentCode || '-',
            'نام درس': sub.name,
            'مستمر ۱': g?.term1Continuous !== undefined ? g.term1Continuous : '',
            'پایانی ۱': g?.term1Final !== undefined ? g.term1Final : '',
            'مستمر ۲': g?.term2Continuous !== undefined ? g.term2Continuous : '',
            'پایانی ۲': g?.term2Final !== undefined ? g.term2Final : '',
            'نمره سالانه': ann !== undefined ? ann : 'ثبت نشده',
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
      'معدل کل': item.gpa !== undefined ? item.gpa : 'محاسبه نشده',
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
      <div className="hidden lg:block shrink-0 sticky top-20 z-20">
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
            warnings: academicWarningStudents.length,
            students: students.length,
            attendanceSessions: sessions.length,
          }}
        />
      </div>

      {/* نوار ناوبری پایین (فقط موبایل) */}
      {(() => {
        const nav = educationalMobileNav({ warnings: academicWarningStudents.length });
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
          warnings: academicWarningStudents.length,
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
        {currentView === null && (
          <div className="space-y-6 animate-in fade-in" id="educational-dashboard-home">
            
            {/* ۱. هدر پیشخوان معاونت آموزشی */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-lg sm:text-xl font-black text-slate-900">
                      سلام، {currentUser?.name || 'معاون آموزشی گرامی'}
                    </h1>
                    <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-gradient-to-l from-emerald-50 to-teal-50 text-teal-800 border border-teal-200/80 shadow-2xs whitespace-nowrap">
                      معاونت آموزشی
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 flex-wrap">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>امروز: {todayInfo.dayOfWeek}، {todayInfo.displayDate}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500">مرکز مدیریت امور درسی و ارزیابی آموزشی</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
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
            </div>

            {/* ۲. خلاصه وضعیت آماری با داده‌های واقعی */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {([
                ['classes', 'کلاس‌ها', toPersianDigits(classes.length), 'مشاهده کلاس‌ها', School, 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950', 'text-emerald-600'],
                ['subjects', 'برنامه دروس', toPersianDigits(academicSubjects.length), 'تنظیم زنگ‌ها', BookOpen, 'bg-sky-50/70 border-sky-200/80 text-sky-950', 'text-sky-600'],
                ['teachers', 'کادر اساتید', toPersianDigits(allTeachers.length), 'لیست دبیران', GraduationCap, 'bg-purple-50/70 border-purple-200/80 text-purple-950', 'text-purple-600'],
                ['reports', 'معدل کل', toPersianDigits(schoolAverageGrade), 'گزارش آماری', BarChart3, 'bg-teal-50/70 border-teal-200/80 text-teal-950', 'text-teal-600'],
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
                ['warnings', 'نیازمند پیگیری', toPersianDigits(academicWarningStudents.length), 'رسیدگی فوری', AlertTriangle, 'bg-rose-50/70 border-rose-200/80 text-rose-950', 'text-rose-600'],
              ] as const).map(([view, label, value, hint, Icon, tone, iconTone]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => (view === 'grades' && activeGradePeriods.length === 0 ? setIsGradePeriodsOpen(true) : setCurrentView(view))}
                  className={`p-3.5 rounded-2xl border shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all text-right cursor-pointer ${tone}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold opacity-80 whitespace-nowrap">{label}</span>
                    <div className={`bg-white shadow-xs rounded-xl p-2 ${iconTone}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <div className="text-2xl font-black font-mono tabular-nums mt-2">{value}</div>
                  <div className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1 whitespace-nowrap">
                    <span>{hint}</span>
                    <ChevronLeft className="w-3 h-3" />
                  </div>
                </button>
              ))}
            </div>

            {/* ۲/۱. هشدار کاربرگ هفتگی */}
            {canAccessSection(currentUser, 'worksheets') && <WorksheetAlertsCard onOpen={() => setCurrentView('worksheets')} />}

            {/* ۳. مسیرهای کار روزمره */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <h2 className="text-sm font-bold text-slate-800 mb-3.5">
                مسیرهای کار روزمره معاونت آموزشی
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                    className={`p-4 rounded-2xl border text-right flex flex-col gap-3 hover:-translate-y-1 hover:shadow-md transition-all cursor-pointer ${tone}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 ${iconTone}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{title}</div>
                      </div>
                    </div>
                    <span className={`self-end px-3 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${pill}`}>
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
            
            {/* ۱. هدر کارپوشه ثبت نمرات با طراحی هماهنگ */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
                    <span>پیشخوان اصلی</span>
                    <span>/</span>
                    <span className="text-teal-800">کارپوشه ثبت نمرات مستمر و پایانی</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
                    <Award className="w-6 h-6 text-teal-800" />
                    <span>ثبت نمرات ۴ نوبته دانش‌آموزان</span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    ورود نمرات با جدول تعاملی، محاسبات خودکار سالانه، خروجی اکسل و فیلترهای نمره‌ای.
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
                    onClick={handleSaveGrades}
                    className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>ذخیره نمرات کلاس</span>
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

              {/* ۲. سلکتور کلاس و درس */}
              <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* انتخاب کلاس */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">کلاس:</span>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-700 cursor-pointer"
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* انتخاب درس */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">درس:</span>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-700 cursor-pointer"
                    >
                      {classSubjects.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* جستجوی نام دانش‌آموز */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="جستجوی دانش‌آموز..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-700 w-44"
                    />
                  </div>

                  {/* خروجی اکسل نمرات کلاس */}
                  <button
                    type="button"
                    onClick={handleExportClassExcel}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="دریافت فایل اکسل ریز نمرات این کلاس"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>خروجی اکسل</span>
                  </button>
                </div>
              </div>
            </div>

            {/* اعلان ذخیره موفق */}
            {isSavedToast && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>نمرات با موفقیت در پایگاه داده ثبت و به‌روزرسانی شد.</span>
              </div>
            )}

            {/* ۳. جدول تعاملی ثبت نمرات کلاسی */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">
                    لیست نمرات کلاس {currentClass?.name} • درس {currentSubject?.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({toPersianDigits(filteredStudents.length)} دانش‌آموز)
                  </span>
                </div>

                {/* فیلترهای نمره‌ای */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      statusFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    همه
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('excellent')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      statusFilter === 'excellent' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ممتاز (بالای ۱۷)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('weak')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      statusFilter === 'weak' ? 'bg-rose-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    نیازمند تلاش (زیر ۱۲)
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-bold bg-white">
                      <th className="p-3 w-12 text-center border-l border-slate-100">ردیف</th>
                      <th className="p-3 border-l border-slate-200">مشخصات دانش‌آموز</th>
                      <th className="p-2.5 text-center w-28 bg-sky-50/70 text-sky-900 border-x border-sky-100">مستمر نوبت ۱</th>
                      <th className="p-2.5 text-center w-28 bg-sky-50/70 text-sky-900 border-x border-sky-100">پایانی نوبت ۱</th>
                      <th className="p-2.5 text-center w-28 bg-indigo-50/60 text-indigo-900 border-x border-indigo-100">مستمر نوبت ۲</th>
                      <th className="p-2.5 text-center w-28 bg-indigo-50/60 text-indigo-900 border-x border-indigo-100">پایانی نوبت ۲</th>
                      <th className="p-2.5 text-center w-24 bg-emerald-50/80 text-emerald-900 font-black border-x border-emerald-100">نمره سالانه</th>
                      <th className="p-3 text-center w-24">وضعیت</th>
                      <th className="p-3 text-left w-20">نمودار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400">
                          دانش‌آموزی با این مشخصات یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((stu, idx) => {
                        const draft = draftGrades[stu.id] || {};
                        const c1 = draft.c1 ? parseFloat(draft.c1) : undefined;
                        const f1 = draft.f1 ? parseFloat(draft.f1) : undefined;
                        const c2 = draft.c2 ? parseFloat(draft.c2) : undefined;
                        const f2 = draft.f2 ? parseFloat(draft.f2) : undefined;
                        const ann = calculateAnnualScore(c1, f1, c2, f2);

                        return (
                          <tr key={stu.id} className="hover:bg-slate-50/70 transition-colors duration-200">
                            <td className="p-3 text-center text-slate-400 font-mono">
                              {toPersianDigits(idx + 1)}
                            </td>
                            <td className="p-3 bg-white border-l border-slate-200">
                              <button
                                type="button"
                                onClick={() => onSelectStudent(stu, 'grades')}
                                className="font-bold text-slate-900 hover:text-teal-800 hover:underline transition text-right cursor-pointer"
                              >
                                {studentFullName(stu)}
                              </button>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {stu.studentCode || stu.nationalId || ''}
                              </div>
                            </td>
                            
                            {/* مستمر نوبت ۱ */}
                            <td className="p-2 text-center bg-sky-50/40 border-x border-sky-100">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={toPersianDigits(draft.c1 ?? '')}
                                onChange={(e) => handleScoreChange(stu.id, 'c1', e.target.value)}
                                placeholder="-"
                                className="w-16 px-2 py-1.5 text-center bg-white/90 border-sky-200 rounded-xl font-extrabold text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white"
                              />
                            </td>

                            {/* پایانی نوبت ۱ */}
                            <td className="p-2 text-center bg-sky-50/40 border-x border-sky-100">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={toPersianDigits(draft.f1 ?? '')}
                                onChange={(e) => handleScoreChange(stu.id, 'f1', e.target.value)}
                                placeholder="-"
                                className="w-16 px-2 py-1.5 text-center bg-white/90 border-sky-200 rounded-xl font-extrabold text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white"
                              />
                            </td>

                            {/* مستمر نوبت ۲ */}
                            <td className="p-2 text-center bg-indigo-50/30 border-x border-indigo-100">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={toPersianDigits(draft.c2 ?? '')}
                                onChange={(e) => handleScoreChange(stu.id, 'c2', e.target.value)}
                                placeholder="-"
                                className="w-16 px-2 py-1.5 text-center bg-white/90 border-indigo-200 rounded-xl font-extrabold text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white"
                              />
                            </td>

                            {/* پایانی نوبت ۲ */}
                            <td className="p-2 text-center bg-indigo-50/30 border-x border-indigo-100">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={toPersianDigits(draft.f2 ?? '')}
                                onChange={(e) => handleScoreChange(stu.id, 'f2', e.target.value)}
                                placeholder="-"
                                className="w-16 px-2 py-1.5 text-center bg-white/90 border-indigo-200 rounded-xl font-extrabold text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white"
                              />
                            </td>

                            {/* نمره سالانه محاسبه شده */}
                            <td className="p-2 text-center font-black text-base bg-emerald-50/60 border-x border-emerald-100">
                              {ann !== undefined ? (
                                <span className={
                                  ann >= 17 ? 'text-emerald-700' :
                                  ann >= 12 ? 'text-slate-800' : 'text-rose-700'
                                }>
                                  {toPersianDigits(ann)}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>

                            {/* وضعیت قبولی */}
                            <td className="p-3 text-center">
                              {ann !== undefined ? (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  ann >= 10 
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}>
                                  {ann >= 10 ? 'قبول' : 'تجدید'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">ثبت نشده</span>
                              )}
                            </td>

                            {/* دکمه مشاهده روند رشد */}
                            <td className="p-3 text-left">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentForChart(stu)}
                                className="p-1.5 text-slate-400 hover:text-teal-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="مشاهده نمودار پیشرفت"
                              >
                                <BarChart3 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {currentView === 'activities' && (
          <TeacherActivitiesReport
            onBack={() => setCurrentView(null)}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          />
        )}

        {currentView === 'announcements' && (
          <AnnouncementsManagement
            onBack={() => setCurrentView(null)}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          />
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
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                          <div className="text-[11px] text-slate-500 mb-1">معدل محاسبه‌شده</div>
                          <div className={`inline-flex items-center justify-center min-w-[3rem] text-lg font-black tabular-nums px-3 py-0.5 rounded-xl ${scorePillClass(hasGpa ? item.gpa! : null)}`}>
                            {hasGpa ? toPersianDigits(item.gpa!) : '—'}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                          <div className="text-[11px] text-slate-500 mb-1">دروس ثبت‌شده</div>
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
                    شناسایی دانش‌آموزان دارای افت معدل (زیر ۱۲) یا تجدیدی جهت هماهنگی با اولیا و دبیران مربوطه.
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
            </div>

            {/* ۳. جدول موارد پیگیری */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50/70">
                      <th className="p-3 w-12 text-center">ردیف</th>
                      <th className="p-3">دانش‌آموز</th>
                      <th className="p-3">کلاس</th>
                      <th className="p-3 text-center">معدل کل</th>
                      <th className="p-3">دروس نیازمند تقویت</th>
                      <th className="p-3">شماره ولی</th>
                      <th className="p-3 text-left">اقدام فوری</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {academicWarningStudents
                      .filter(item => {
                        if (warningClassFilter !== 'all' && item.classId !== warningClassFilter) return false;
                        if (!warningSearch) return true;
                        const q = warningSearch.trim().toLowerCase();
                        const name = `${studentFullName(item.student)}`.toLowerCase();
                        return name.includes(q) || item.student.parentPhone.includes(q);
                      })
                      .map((item, idx) => (
                        <tr key={item.student.id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3 text-center text-slate-400 font-mono">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            <button
                              type="button"
                              onClick={() => onSelectStudent(item.student, 'grades')}
                              className="hover:text-teal-800 hover:underline transition cursor-pointer"
                            >
                              {studentFullName(item.student)}
                            </button>
                          </td>
                          <td className="p-3 text-slate-600">
                            کلاس {item.className}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block font-mono font-black text-sm px-3 py-1 rounded-xl whitespace-nowrap ${scorePillClass(item.gpa ?? null)}`}>
                              {item.gpa !== undefined ? toPersianDigits(item.gpa) : '—'}
                            </span>
                          </td>
                          <td className="p-3 text-rose-700 font-semibold">
                            {item.weakSubjects.length > 0 ? item.weakSubjects.join('، ') : 'معدل کمتر از ۱۲'}
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {item.student.parentPhone}
                          </td>
                          <td className="p-3 text-left">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.student.parentPhone && (
                                <a
                                  href={`tel:${item.student.parentPhone}`}
                                  className="p-1.5 text-slate-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition border border-slate-200"
                                  title="تماس با ولی"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => onSelectStudent(item.student, 'grades')}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="w-3 h-3" />
                                <span>کارنامه</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

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
