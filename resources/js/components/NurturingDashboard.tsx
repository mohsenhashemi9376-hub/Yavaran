import { AccessDeniedNotice } from './AccessDeniedNotice';
import { useScrollTop } from '../utils/useScrollTop';
import { canAccessSection } from '../utils/permissions';
import React, { useState, useEffect, useMemo } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';
import { 
  Student, 
  SchoolClass, 
  StudentObservation, 
  NurturingSectionKey, 
  DossierSectionEntry, 
  ObservationCategory,
  StudentNurturingDossier,
  CoachGrowthEvaluation,
  GrowthEvaluationCriteria,
  QualitativeRating,
  User
} from '../types';
import { CoachAcademicDisciplineView } from './CoachAcademicDisciplineView';
import { TaughtLessonsView } from './TaughtLessonsView';
import { WorksheetsWorkspace } from './WorksheetsWorkspace';
import { NurturingAuditLog } from './NurturingAuditLog';
import { TwoFactorRequiredBanner } from './TwoFactorRequiredBanner';
import { NurturingSidebarNav, NurturingViewType } from './NurturingSidebarNav';
import { AdminCoachesWorkspace } from './AdminCoachesWorkspace';
import { CoachProfileModal } from './CoachProfileModal';
import { AddCoachModal } from './AddCoachModal';
import { MentorMessagesSection } from './MentorMessages';
import { EditCoachModal } from './EditCoachModal';
import { toPersianDigits, getTodayShamsi, getNowShamsi, parseShamsiDateTime } from '../utils/persianDate';
import { getUserGreeting } from '../utils/userRoles';
import { 
  HeartHandshake, 
  Eye, 
  FolderHeart, 
  Brain, 
  Lock, 
  Users, 
  Sparkles, 
  TrendingUp, 
  Coffee, 
  Mic, 
  ClipboardCheck, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Tag, 
  MapPin, 
  Edit3, 
  Trash2, 
  X, 
  Save, 
  Check, 
  FileText, 
  Printer, 
  AlertCircle, 
  ChevronLeft, 
  Smile, 
  ShieldAlert,
  ArrowRight,
  Clock,
  Sparkle,
  Award,
  BookOpen,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  Compass,
  Menu,
  ArrowLeft,
  Star,
  BarChart3,
  Activity,
  CheckCircle,
  Settings,
  LayoutDashboard,
  RotateCcw,
  NotebookPen,
} from 'lucide-react';
import { EmptyState } from './EmptyState';
import { MobileBottomNav } from './MobileBottomNav';
import { nurturingMobileNav, HOME } from './mobileNavConfigs';
import { studentFullName } from '../utils/studentName';

interface NurturingDashboardProps {
  onOpenClassDetail?: (cls: SchoolClass) => void;
  onSelectStudent?: (student: Student, defaultTab?: 'overview' | 'info' | 'attendance' | 'discipline' | 'grades') => void;
}

const RATING_INFO: Record<QualitativeRating, { label: string; bg: string; text: string; border: string; icon: string; color: string }> = {
  excellent: { 
    label: 'عالی و الگو', 
    bg: 'bg-emerald-100', 
    text: 'text-emerald-800', 
    border: 'border-emerald-300',
    icon: '🌟',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  very_good: { 
    label: 'خیلی خوب و پیشرو', 
    bg: 'bg-teal-100', 
    text: 'text-teal-800', 
    border: 'border-teal-300',
    icon: '✨',
    color: 'bg-teal-100 text-teal-800 border-teal-300'
  },
  good: { 
    label: 'خوب و مستعد', 
    bg: 'bg-amber-100', 
    text: 'text-amber-800', 
    border: 'border-amber-300',
    icon: '🌱',
    color: 'bg-amber-100 text-amber-800 border-amber-300'
  },
  needs_improvement: { 
    label: 'نیازمند هدایت و تمرین', 
    bg: 'bg-rose-100', 
    text: 'text-rose-800', 
    border: 'border-rose-300',
    icon: '🎯',
    color: 'bg-rose-100 text-rose-800 border-rose-300'
  },
};

const CRITERIA_DEFINITIONS: { key: keyof GrowthEvaluationCriteria; label: string; desc: string }[] = [
  { key: 'responsibility', label: 'مسئولیت‌پذیری و نظم فردی', desc: 'انجام وظایف محوله، وقت‌شناسی و انضباط فردی' },
  { key: 'teamwork', label: 'روحیه کار گروهی و تشکیلاتی', desc: 'همکاری مؤثر، گذشت و مشارکت در کارهای جمعی' },
  { key: 'moralSpiritual', label: 'پایبندی اخلاقی، معنوی و ولایی', desc: 'صداقت، امانتداری، احترام و باورهای ارزشی' },
  { key: 'problemSolving', label: 'بینش فکری، تفکر نقاد و حل مسئله', desc: 'عمق نگاه، خلاقیت، تعقل و قدرت استدلال' },
  { key: 'socialEtiquette', label: 'ادب و تعامل با همسالان و کادر', desc: 'حرمت‌گذاری، خوش‌خلقی و کنترل هیجانات' },
  { key: 'academicMotivation', label: 'انگیزش، پشتکار و نگرش تحصیلی', desc: 'تلاش مستمر، پیگیری یادگیری و شوق دانستن' },
];

const SECTION_CONFIGS: Record<NurturingSectionKey, {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgLight: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
}> = {
  thinkingPoints: {
    title: 'نقاط تفکری',
    subtitle: 'طرز فکر، باورها، نوع نگرش، بینش فردی و پرسش‌های فکری دانش‌آموز',
    icon: Brain,
    color: 'text-indigo-600',
    bgLight: 'bg-indigo-50/60',
    borderColor: 'border-indigo-200',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
  },
  privateSessions: {
    title: 'جلسات خصوصی',
    subtitle: 'مشاوره‌های فردی، خلوت‌های تربیتی، دغدغه‌ها و رازهای شخصی',
    icon: Lock,
    color: 'text-rose-600',
    bgLight: 'bg-rose-50/60',
    borderColor: 'border-rose-200',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
  },
  parentInterviews: {
    title: 'مصاحبه والدین',
    subtitle: 'گفت‌وگو با پدر و مادر، محیط تربیتی خانواده و هماهنگی‌ها',
    icon: Users,
    color: 'text-amber-600',
    bgLight: 'bg-amber-50/60',
    borderColor: 'border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
  },
  temperament: {
    title: 'مزاج شناسی',
    subtitle: 'بررسی طبایع ۴گانه، خصوصیات خلقی، ویژگی‌های جسمانی و توصیه‌های طبع',
    icon: Sparkles,
    color: 'text-emerald-600',
    bgLight: 'bg-emerald-50/60',
    borderColor: 'border-emerald-200',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
  },
  growthPath: {
    title: 'مسیر رشد',
    subtitle: 'نقشه راه فردی، اهداف خودسازی، افق رشد اخلاقی و مهارتی',
    icon: TrendingUp,
    color: 'text-teal-600',
    bgLight: 'bg-teal-50/60',
    borderColor: 'border-teal-200',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
  },
  lifestyle: {
    title: 'سبک زندگی',
    subtitle: 'نظم و انضباط فردی، خواب، تغذیه، فضای مجازی، ورزش و عادات روزمره',
    icon: Coffee,
    color: 'text-orange-600',
    bgLight: 'bg-orange-50/60',
    borderColor: 'border-orange-200',
    badgeBg: 'bg-orange-100',
    badgeText: 'text-orange-800',
  },
  interviews: {
    title: 'مصاحبه‌ها',
    subtitle: 'مصاحبه‌های ورودی، ارزیابی‌های دوره‌ای و جلسات ارزیابی شخصیتی',
    icon: Mic,
    color: 'text-sky-600',
    bgLight: 'bg-sky-50/60',
    borderColor: 'border-sky-200',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
  },
  nurturingSummary: {
    title: 'جمعبندی تربیتی',
    subtitle: 'ارزیابی جامع کلی، نقاط قوت، استراتژی و توصیه‌های نهایی به کادر و اولیا',
    icon: ClipboardCheck,
    color: 'text-purple-600',
    bgLight: 'bg-purple-50/60',
    borderColor: 'border-purple-200',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
  },
};

const OBSERVATION_CATEGORIES: { key: ObservationCategory; label: string; color: string }[] = [
  { key: 'behavioral', label: 'رفتاری و انضباطی', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { key: 'social', label: 'اجتماعی و ارتباط با همسالان', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  { key: 'emotional', label: 'عاطفی و مدیریت هیجانات', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { key: 'moral', label: 'اخلاقی، ارزشی و دینی', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { key: 'learning_attitude', label: 'نگرش و انگیزش تحصیلی', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { key: 'family', label: 'مسائل خانوادگی', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { key: 'other', label: 'سایر ملاحظات', color: 'bg-slate-100 text-slate-800 border-slate-200' },
];

// دوره‌های ارزیابی رشدی بر اساس سال تحصیلی جاری (به‌صورت خودکار)
const getEvaluationPeriodOptions = (): string[] => {
  const start = getAcademicYearStart(getActiveAcademicYear());
  const y1 = toPersianDigits(start);
  const y2 = toPersianDigits(start + 1);
  return [
    `فصل پاییز (آبان ${y1})`,
    `نیمسال اول (دی ${y1})`,
    `فصل زمستان (بهمن ${y1})`,
    `فصل بهار (اردیبهشت ${y2})`,
  ];
};

const getDefaultEvaluationPeriod = (): string => {
  const month = getTodayShamsi().month;
  const options = getEvaluationPeriodOptions();
  if (month === 7 || month === 8) return options[0];
  if (month === 9 || month === 10) return options[1];
  if (month === 11 || month === 12) return options[2];
  if (month >= 1 && month <= 3) return options[3];
  return options[0];
};

export const NurturingDashboard: React.FC<NurturingDashboardProps> = ({ 
  onOpenClassDetail,
  onSelectStudent
}) => {
  const { 
    students: schoolStudents, 
    classes, 
    observations: schoolObservations, 
    nurturingDossiers, 
    coachEvaluations: schoolCoachEvaluations,
    saveCoachEvaluation,
    deleteCoachEvaluation,
    getStudentCoachEvaluations,
    addStudentObservation, 
    updateStudentObservation, 
    deleteStudentObservation,
    saveDossierSectionEntry,
    deleteDossierSectionEntry,
    updateTemperamentOverview,
    updateNurturingSummaryOverview,
    getStudentNurturingDossier,
    currentUser,
    isNurturingVice,
    isCoach,
    isAdmin,
    nurturingClasses,
    allCoaches,
    allUsers,
    nurturingLocked,
    showToast, showConfirm
  } = useSchool();

  const todayInfo = getTodayShamsi();
  const userGreeting = getUserGreeting(currentUser);
  
  // Dedicated professional sidebar navigation state
  const [rawView, setCurrentView] = useState<NurturingViewType>(null);
  const deniedView = rawView && !canAccessSection(currentUser, rawView);
  const currentView = deniedView ? null : rawView;
  useScrollTop(currentView);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Coach profile and edit modal states
  const [selectedCoach, setSelectedCoach] = useState<User | null>(null);
  const [isCoachProfileOpen, setIsCoachProfileOpen] = useState(false);
  const [isEditCoachOpen, setIsEditCoachOpen] = useState(false);
  const [isAddCoachOpen, setIsAddCoachOpen] = useState(false);

  // Close mobile drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidebarOpen]);
  
  // Search and class filtering
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('all');

  // Observation Modal state
  const [selectedStudentForObs, setSelectedStudentForObs] = useState<Student | null>(null);
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);
  const [obsTitle, setObsTitle] = useState('');
  const [obsCategory, setObsCategory] = useState<ObservationCategory>('behavioral');
  const [obsContent, setObsContent] = useState('');
  const [obsDate, setObsDate] = useState(() => getNowShamsi().date);
  const [obsTime, setObsTime] = useState(() => getNowShamsi().time);
  // تاریخ و ساعت به‌طور پیش‌فرض خودکار از ساعت سامانه گرفته می‌شود؛ با ویرایش دستی، مقدار واردشده حفظ می‌شود
  const [obsDateManual, setObsDateManual] = useState(false);
  const [obsLocation, setObsLocation] = useState('کلاس درس');
  const [obsTagsInput, setObsTagsInput] = useState('');
  const [editingObsId, setEditingObsId] = useState<string | null>(null);

  // Coach Evaluation Modal State
  const [isCoachEvalModalOpen, setIsCoachEvalModalOpen] = useState(false);
  const [editingCoachEvalId, setEditingCoachEvalId] = useState<string | null>(null);
  const [evalStudentId, setEvalStudentId] = useState<string>('');
  const [evalPeriod, setEvalPeriod] = useState<string>(getDefaultEvaluationPeriod());
  const [evalDate, setEvalDate] = useState<string>(todayInfo.formattedDate);
  const [evalCriteria, setEvalCriteria] = useState<GrowthEvaluationCriteria>({
    responsibility: 'very_good',
    teamwork: 'very_good',
    moralSpiritual: 'excellent',
    problemSolving: 'good',
    socialEtiquette: 'very_good',
    academicMotivation: 'very_good',
  });
  const [evalStrengths, setEvalStrengths] = useState<string>('');
  const [evalGrowthRecommendations, setEvalGrowthRecommendations] = useState<string>('');
  const [evalNotes, setEvalNotes] = useState<string>('');
  const [evalOverallRating, setEvalOverallRating] = useState<QualitativeRating>('very_good');

  // Dossier View state
  const [selectedDossierStudent, setSelectedDossierStudent] = useState<Student | null>(null);
  const [activeSectionModal, setActiveSectionModal] = useState<NurturingSectionKey | null>(null);

  // Section Entry Edit state
  const [sectionEntryTitle, setSectionEntryTitle] = useState('');
  const [sectionEntryContent, setSectionEntryContent] = useState('');
  const [sectionEntryDate, setSectionEntryDate] = useState(todayInfo.formattedDate);
  const [sectionEntryTags, setSectionEntryTags] = useState('');
  const [sectionEntryKeyTakeaways, setSectionEntryKeyTakeaways] = useState('');
  const [editingSectionEntryId, setEditingSectionEntryId] = useState<string | null>(null);

  // Temperament specific overview inputs
  const [tempType, setTempType] = useState('دموی - صفراوی');
  const [tempPhysical, setTempPhysical] = useState('');
  const [tempBehavioral, setTempBehavioral] = useState('');

  // Nurturing summary specific overview inputs
  const [summaryOverall, setSummaryOverall] = useState('');
  const [summaryStrengths, setSummaryStrengths] = useState('');
  const [summaryGrowth, setSummaryGrowth] = useState('');

  // Filtered classes (considering coach assignment if applicable)
  // مربی فقط کلاس‌های خودش را می‌بیند (حتی اگر کلاسی نداشته باشد، به کل مدرسه دسترسی پیدا نمی‌کند)
  const availableClasses = useMemo(() => {
    if (isCoach) return nurturingClasses || [];
    return classes;
  }, [isCoach, nurturingClasses, classes]);

  const allowedClassIds = useMemo(() => new Set(availableClasses.map((c) => c.id)), [availableClasses]);

  // دانش‌آموزان، مشاهدات و ارزیابی‌های مجاز (برای مدیر/معاون: کل مدرسه)
  const students = useMemo(
    () => (isCoach ? schoolStudents.filter((s) => allowedClassIds.has(s.classId)) : schoolStudents),
    [isCoach, schoolStudents, allowedClassIds]
  );
  const scopedStudentIds = useMemo(() => new Set(students.map((s) => s.id)), [students]);
  const observations = useMemo(
    () => (isCoach ? schoolObservations.filter((o) => scopedStudentIds.has(o.studentId)) : schoolObservations),
    [isCoach, schoolObservations, scopedStudentIds]
  );
  const coachEvaluations = useMemo(
    () => (isCoach ? schoolCoachEvaluations.filter((e) => scopedStudentIds.has(e.studentId)) : schoolCoachEvaluations),
    [isCoach, schoolCoachEvaluations, scopedStudentIds]
  );

  // مربی با یک کلاس: همان کلاس به‌صورت پیش‌فرض انتخاب می‌شود
  useEffect(() => {
    if (isCoach && availableClasses.length === 1 && selectedClassId !== availableClasses[0].id) {
      setSelectedClassId(availableClasses[0].id);
    } else if (isCoach && selectedClassId !== 'all' && !allowedClassIds.has(selectedClassId)) {
      setSelectedClassId('all');
    }
  }, [isCoach, availableClasses, allowedClassIds, selectedClassId]);

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {

      const matchClass = selectedClassId === 'all' || s.classId === selectedClassId;
      const fullName = `${studentFullName(s)}`.toLowerCase();
      const matchSearch = 
        !searchTerm.trim() ||
        fullName.includes(searchTerm.toLowerCase()) ||
        s.studentCode.includes(searchTerm) ||
        s.nationalId.includes(searchTerm);
      return matchClass && matchSearch;
    });
  }, [students, selectedClassId, searchTerm]);

  // Filtered Coach Evaluations
  const filteredCoachEvaluations = useMemo(() => {
    return coachEvaluations.filter((ev) => {
      const student = students.find((s) => s.id === ev.studentId);
      if (!student) return false;

      const matchClass = selectedClassId === 'all' || student.classId === selectedClassId;
      const matchPeriod = selectedPeriodFilter === 'all' || ev.period === selectedPeriodFilter;
      const fullName = `${studentFullName(student)}`.toLowerCase();
      const matchSearch = 
        !searchTerm.trim() ||
        fullName.includes(searchTerm.toLowerCase()) ||
        student.studentCode.includes(searchTerm) ||
        ev.coachName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ev.strengths || []).some((st) => st.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ev.growthRecommendations || []).some((gr) => gr.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchClass && matchPeriod && matchSearch;
    });
  }, [coachEvaluations, students, selectedClassId, selectedPeriodFilter, searchTerm]);

  // Open Coach Evaluation Modal (New)
  const handleOpenNewCoachEval = (student?: Student) => {
    const targetStudentId = student ? student.id : (filteredStudents[0]?.id || students[0]?.id || '');
    setEditingCoachEvalId(null);
    setEvalStudentId(targetStudentId);
    setEvalPeriod(getDefaultEvaluationPeriod());
    setEvalDate(todayInfo.formattedDate);
    setEvalCriteria({
      responsibility: 'very_good',
      teamwork: 'very_good',
      moralSpiritual: 'excellent',
      problemSolving: 'good',
      socialEtiquette: 'very_good',
      academicMotivation: 'very_good',
    });
    setEvalStrengths('');
    setEvalGrowthRecommendations('');
    setEvalNotes('');
    setEvalOverallRating('very_good');
    setIsCoachEvalModalOpen(true);
  };

  // Open Coach Evaluation Modal (Edit)
  const handleEditCoachEval = (ev: CoachGrowthEvaluation) => {
    setEditingCoachEvalId(ev.id);
    setEvalStudentId(ev.studentId);
    setEvalPeriod(ev.period);
    setEvalDate(ev.date);
    setEvalCriteria({ ...ev.criteria });
    setEvalStrengths((ev.strengths || []).join('\n'));
    setEvalGrowthRecommendations((ev.growthRecommendations || []).join('\n'));
    setEvalNotes(ev.notes || '');
    setEvalOverallRating(ev.overallRating || 'very_good');
    setIsCoachEvalModalOpen(true);
  };

  // Save Coach Evaluation
  const handleSaveCoachEval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalStudentId) {
      showToast('لطفاً دانش‌آموز مورد نظر را انتخاب فرمایید.', 'error');
      return;
    }

    const strengthsList = evalStrengths.split('\n').map((s) => s.trim()).filter(Boolean);
    const growthList = evalGrowthRecommendations.split('\n').map((s) => s.trim()).filter(Boolean);

    saveCoachEvaluation({
      id: editingCoachEvalId || undefined,
      studentId: evalStudentId,
      coachId: currentUser.id,
      coachName: currentUser.name || 'مربی یاوران ولایت',
      date: evalDate,
      period: evalPeriod,
      criteria: evalCriteria,
      strengths: strengthsList,
      growthRecommendations: growthList,
      notes: evalNotes.trim(),
      overallRating: evalOverallRating,
    });

    setIsCoachEvalModalOpen(false);
  };

  // Statistics
  const totalObservationsCount = observations.length;
  const studentsWithDossierCount = Object.keys(nurturingDossiers).filter(
    (id) => !isCoach || scopedStudentIds.has(id)
  ).length;

  // Students requiring attention / guidance in nurturing
  const attentionNeededStudents = useMemo(() => {
    return filteredStudents.filter((student) => {
      // Check coach evaluations for this student
      const evals = coachEvaluations.filter((ev) => ev.studentId === student.id);
      const hasImprovementNeeded = evals.some(
        (ev) =>
          ev.overallRating === 'needs_improvement' ||
          Object.values(ev.criteria || {}).some((v) => v === 'needs_improvement')
      );
      // Check for emotional or family concerns in observations
      const stuObs = observations.filter((o) => o.studentId === student.id);
      const hasEmotionalOrFamilyConcerns = stuObs.some(
        (o) => o.category === 'emotional' || o.category === 'family'
      );
      // Low discipline
      const hasLowDiscipline = student.disciplineScore < 18;
      return hasImprovementNeeded || hasEmotionalOrFamilyConcerns || hasLowDiscipline;
    });
  }, [filteredStudents, coachEvaluations, observations]);

  // Overall points / praises count
  const totalEncouragementPoints = useMemo(() => {
    let count = 0;
    coachEvaluations.forEach((ev) => {
      if (ev.overallRating === 'excellent') count += 3;
      else if (ev.overallRating === 'very_good') count += 2;
      else if (ev.overallRating === 'good') count += 1;
    });
    return count;
  }, [coachEvaluations]);

  /** تاریخ و ساعت را دوباره از ساعت سامانه می‌گیرد (حالت خودکار) */
  const resetObsDateTimeToNow = () => {
    const now = getNowShamsi();
    setObsDate(now.date);
    setObsTime(now.time);
    setObsDateManual(false);
  };

  // Handle open observation modal for a student
  const handleOpenStudentObs = (student: Student) => {
    setSelectedStudentForObs(student);
    setObsTitle('');
    setObsCategory('behavioral');
    setObsContent('');
    resetObsDateTimeToNow();
    setObsLocation('کلاس درس');
    setObsTagsInput('');
    setEditingObsId(null);
    setIsObsModalOpen(true);
  };

  // Handle save new or edited observation
  const handleSaveObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForObs || !obsContent.trim()) {
      showToast('لطفاً متن یادداشت مشاهده‌گری را وارد نمایید.', 'error');
      return;
    }

    // خودکار: لحظه‌ی ثبت از ساعت سامانه؛ دستی: مقدار واردشده (پس از اعتبارسنجی)
    const when = obsDateManual || editingObsId ? parseShamsiDateTime(obsDate, obsTime) : getNowShamsi();
    if (!when) {
      showToast('تاریخ (مثل 1404/08/20) یا ساعت (مثل 10:30) معتبر نیست. می‌توانید دکمه‌ی «اکنون» را بزنید.', 'error');
      return;
    }

    const catObj = OBSERVATION_CATEGORIES.find((c) => c.key === obsCategory);
    const tags = obsTagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (editingObsId) {
      updateStudentObservation(editingObsId, {
        title: obsTitle.trim() || 'مشاهده رفتاری',
        category: obsCategory,
        categoryLabel: catObj?.label || 'رفتاری',
        content: obsContent.trim(),
        date: when.date,
        time: when.time,
        location: obsLocation.trim() || 'مدرسه',
        tags,
      });
      setEditingObsId(null);
    } else {
      addStudentObservation({
        studentId: selectedStudentForObs.id,
        title: obsTitle.trim() || 'مشاهده رفتاری',
        category: obsCategory,
        categoryLabel: catObj?.label || 'رفتاری',
        content: obsContent.trim(),
        date: when.date,
        time: when.time,
        location: obsLocation.trim() || 'مدرسه',
        tags,
        recordedBy: currentUser.name || 'معاون تربیتی',
      });
      if (nurturingLocked) {
        showToast('مشاهده‌گری ثبت شد. پس از فعال‌سازی ورود دومرحله‌ای قابل مشاهده است.', 'success');
      }
    }

    resetObsDateTimeToNow();

    setObsTitle('');
    setObsContent('');
    setObsTagsInput('');
  };

  // Edit existing observation item
  const handleEditObservation = (obs: StudentObservation) => {
    setEditingObsId(obs.id);
    setObsTitle(obs.title);
    setObsCategory(obs.category);
    setObsContent(obs.content);
    setObsDate(obs.date);
    setObsTime(obs.time || '10:00');
    setObsDateManual(true);
    setObsLocation(obs.location || 'کلاس درس');
    setObsTagsInput((obs.tags || []).join(', '));
  };

  // Handle Open Dossier Section Box
  const handleOpenSectionModal = (sectionKey: NurturingSectionKey) => {
    if (!selectedDossierStudent) return;
    setActiveSectionModal(sectionKey);
    setSectionEntryTitle('');
    setSectionEntryContent('');
    setSectionEntryDate(todayInfo.formattedDate);
    setSectionEntryTags('');
    setSectionEntryKeyTakeaways('');
    setEditingSectionEntryId(null);

    const dossier = getStudentNurturingDossier(selectedDossierStudent.id);
    if (sectionKey === 'temperament') {
      setTempType(dossier.temperament?.dominantType || 'دموی - صفراوی');
      setTempPhysical(dossier.temperament?.physicalTraits || '');
      setTempBehavioral(dossier.temperament?.behavioralTraits || '');
    } else if (sectionKey === 'nurturingSummary') {
      setSummaryOverall(dossier.nurturingSummary?.overallSummary || '');
      setSummaryStrengths((dossier.nurturingSummary?.strengths || []).join('\n'));
      setSummaryGrowth((dossier.nurturingSummary?.growthOpportunities || []).join('\n'));
    }
  };

  // Handle Save Dossier Section Entry
  const handleSaveSectionEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDossierStudent || !activeSectionModal || !sectionEntryContent.trim()) {
      showToast('لطفاً متن یادداشت را وارد فرمایید.', 'error');
      return;
    }

    const tags = sectionEntryTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const keyTakeaways = sectionEntryKeyTakeaways
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    saveDossierSectionEntry(selectedDossierStudent.id, activeSectionModal, {
      id: editingSectionEntryId || undefined,
      title: sectionEntryTitle.trim() || `یادداشت ${SECTION_CONFIGS[activeSectionModal].title}`,
      content: sectionEntryContent.trim(),
      date: sectionEntryDate,
      tags,
      keyTakeaways,
      recordedBy: currentUser.name,
    });

    setSectionEntryTitle('');
    setSectionEntryContent('');
    setSectionEntryTags('');
    setSectionEntryKeyTakeaways('');
    setEditingSectionEntryId(null);
  };

  const handleEditSectionEntry = (entry: DossierSectionEntry) => {
    setEditingSectionEntryId(entry.id);
    setSectionEntryTitle(entry.title);
    setSectionEntryContent(entry.content);
    setSectionEntryDate(entry.date);
    setSectionEntryTags((entry.tags || []).join(', '));
    setSectionEntryKeyTakeaways((entry.keyTakeaways || []).join('\n'));
  };

  const handleSaveTemperamentOverview = () => {
    if (!selectedDossierStudent) return;
    updateTemperamentOverview(selectedDossierStudent.id, tempType, tempPhysical, tempBehavioral);
    showToast('اطلاعات تحلیل مزاج با موفقیت ثبت گردید.', 'success');
  };

  const handleSaveSummaryOverview = () => {
    if (!selectedDossierStudent) return;
    const strList = summaryStrengths.split('\n').map((s) => s.trim()).filter(Boolean);
    const grList = summaryGrowth.split('\n').map((s) => s.trim()).filter(Boolean);
    updateNurturingSummaryOverview(selectedDossierStudent.id, summaryOverall, strList, grList);
    showToast('جمعبندی و راهبردهای کلی پرونده تربیتی ذخیره شد.', 'success');
  };

  // Student class helper
  const getStudentClassName = (classId: string) => {
    return classes.find((c) => c.id === classId)?.name || 'کلاس نامشخص';
  };

  // Privacy Protection Boundary: Ensure Admin or other roles cannot view private counseling & behavioral observations
  if (!isNurturingVice && !isCoach) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
        <div className="bg-white border-2 border-rose-200 rounded-3xl p-8 text-center shadow-lg space-y-6 relative overflow-hidden">
          <div className="w-20 h-20 bg-rose-100 text-rose-700 rounded-3xl flex items-center justify-center mx-auto border border-rose-300 shadow-inner">
            <Lock className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold">
              حریم خصوصی و تفکیک دسترسی سازمانی
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              دسترسی محدود: پنل محرمانه معاونت تربیتی و مربیان یاوران ولایت
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl mx-auto">
              طبق مقررات مدرسه یاوران ولایت، پرونده‌های مشاوره‌ای، جلسات خصوصی، مشاهدات رفتاری و ارزیابی‌های رشدی دانش‌آموزان به دلیل حفظ اسرار و حریم خصوصی در دسترس مدیر یا کادر اجرایی/آموزشی قرار ندارد و صرفاً برای معاونت تربیتی و مربیان تعریف شده است.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 max-w-lg mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="text-right">حساب فعلی شما: <strong>{currentUser.name}</strong> ({currentUser.roleTitle})</span>
            </div>
            <span className="px-2 py-1 bg-rose-50 text-rose-700 rounded-md font-bold text-[11px]">غیرمجاز</span>
          </div>

        </div>
      </div>
    );
  }

  const handleSidebarSelectStudent = (student: Student) => {
    setSelectedDossierStudent(student);
    setCurrentView('dossier');
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6 relative" dir="rtl">
      {/* سایدبار در حالت دسکتاپ (Docked Sidebar) */}
      <div className="hidden lg:block shrink-0 sticky top-20 z-20">
        <NurturingSidebarNav
          variant="docked"
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          isOpen={true}
          onClose={() => {}}
          activeView={currentView}
          onSelectView={(view) => {
            setCurrentView(view);
            if (view !== 'dossier') {
              setSelectedDossierStudent(null);
            }
          }}
          onOpenSettings={() => setCurrentView('settings')}
          counts={{
            observations: totalObservationsCount,
            dossiers: studentsWithDossierCount,
            evaluations: coachEvaluations.length,
            coaches: allCoaches.length,
            attentionNeeded: attentionNeededStudents.length,
          }}
          canManageCoaches={isAdmin || isNurturingVice}
          students={students}
          classes={availableClasses}
          observations={observations}
          onSelectStudent={handleSidebarSelectStudent}
        />
      </div>

      {/* سایدبار در حالت موبایل و تبلت (Drawer) */}
      {/* نوار ناوبری پایین (فقط موبایل) */}
      {(() => {
        const nav = nurturingMobileNav(currentUser.role === 'vice_nurturing');
        return (
          <MobileBottomNav
            items={nav.primary}
            moreItems={nav.more}
            activeId={currentView === null || currentView === 'dashboard' ? HOME : currentView}
            onSelect={(id) => {
              setCurrentView(id === HOME ? 'dashboard' : (id as NurturingViewType));
              if (id !== 'dossier') setSelectedDossierStudent(null);
            }}
          />
        );
      })()}

      <NurturingSidebarNav
        variant="drawer"
        isCollapsed={false}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        activeView={currentView}
        onSelectView={(view) => {
          setCurrentView(view);
          setIsMobileSidebarOpen(false);
          if (view !== 'dossier') {
            setSelectedDossierStudent(null);
          }
        }}
        onOpenSettings={() => {
          setCurrentView('settings');
          setIsMobileSidebarOpen(false);
        }}
        counts={{
          observations: totalObservationsCount,
          dossiers: studentsWithDossierCount,
          evaluations: coachEvaluations.length,
          coaches: allCoaches.length,
          attentionNeeded: attentionNeededStudents.length,
        }}
        canManageCoaches={isAdmin || isNurturingVice}
        students={students}
        classes={availableClasses}
        observations={observations}
        onSelectStudent={handleSidebarSelectStudent}
      />

      {/* فضای اصلی محتوا */}
      <div className="flex-1 w-full min-w-0 space-y-6 pb-12">
        {/* Top Banner with Confidentiality & Role identity */}
        {deniedView && <AccessDeniedNotice onClose={() => setCurrentView(null)} />}
        <TwoFactorRequiredBanner />
        {(currentView === null || currentView === 'dashboard') && (
          <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-emerald-800/40 relative overflow-hidden">
            <div className="absolute left-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-bold text-emerald-200">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{userGreeting.greeting} • {userGreeting.roleLabel}</span>
                  </div>
                  <span className="text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full text-slate-200 font-mono">
                    {todayInfo.formattedDate}
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5">
                  <HeartHandshake className="w-7 h-7 text-emerald-400" />
                  <span>سامانه مشاهده‌گری رفتاری و پرونده تربیتی دانش‌آموزان</span>
                </h1>
                <p className="text-xs text-emerald-200 max-w-2xl leading-relaxed">
                  ثبت و ارزیابی عمیق مشاهدات روزمره، نقاط تفکری، جلسات مشاوره خصوصی، مصاحبه والدین، مزاج‌شناسی، سبک زندگی و ترسیم مسیر رشد فردی.
                </p>
              </div>

              {/* Mobile Drawer Button & Metrics */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  id="btn-mobile-nurturing-sidebar-toggle"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2 cursor-pointer"
                  title="باز کردن نوار کناری"
                  aria-label="باز کردن نوار کناری"
                >
                  <Menu className="w-4 h-4" />
                  <span>منوی ناوبری</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('dossier');
                    setSelectedDossierStudent(null);
                  }}
                  className="bg-white/10 hover:bg-white/15 backdrop-blur-xs border border-white/15 rounded-2xl p-3 text-center min-w-[80px] transition cursor-pointer"
                  title="مشاهده پرونده‌های تربیتی"
                >
                  <div className="text-lg font-black text-emerald-300">{toPersianDigits(filteredStudents.length)}</div>
                  <div className="text-[10px] text-slate-300 font-medium">دانش‌آموزان</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView('observation');
                    setSelectedDossierStudent(null);
                  }}
                  className="bg-white/10 hover:bg-white/15 backdrop-blur-xs border border-white/15 rounded-2xl p-3 text-center min-w-[80px] transition cursor-pointer"
                  title="مشاهده مشاهدات رفتاری"
                >
                  <div className="text-lg font-black text-amber-300">{toPersianDigits(totalObservationsCount)}</div>
                  <div className="text-[10px] text-slate-300 font-medium">مشاهدات</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Breadcrumb Header when in Sub-Desks */}
        {currentView !== null && currentView !== 'dashboard' && currentView !== 'dossier' && (
          <div className="bg-white rounded-2xl px-4 py-2.5 border border-slate-200 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCurrentView(null)}
                className="text-slate-500 hover:text-emerald-800 transition flex items-center gap-1 cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-600" />
                <span>داشبورد اصلی</span>
              </button>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-900 font-black">
                {currentView === 'observation' && 'مشاهده‌گری رفتاری'}
                {currentView === 'coachEvaluations' && 'ارزیابی رشد و تعالی'}
                {currentView === 'coaches' && 'مربیان تربیتی یاوران ولایت'}
                {currentView === 'attention' && 'موارد نیازمند توجه و پیگیری'}
                {currentView === 'reports' && 'گزارش‌های تحلیلی رشد'}
                {currentView === 'settings' && 'تنظیمات و شاخص‌های تربیتی'}
                {currentView === 'academic_and_discipline' && 'آموزش و انضباط کلاس‌ها'}
                {currentView === 'taught_lessons' && 'درس‌های تدریس‌شده و تکالیف'}
                {currentView === 'worksheets' && 'کاربرگ هفتگی'}
                {currentView === 'audit' && 'گزارش دسترسی‌ها'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setCurrentView(null)}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>بازگشت به داشبورد</span>
            </button>
          </div>
        )}

        {/* Search & Class Filter Bar (for Observation and CoachEvaluations) */}
        {(currentView === 'observation' || currentView === 'coachEvaluations') && (
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجوی نام دانش‌آموز، کد ملی، مربی یا برچسب..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                فیلتر کلاس:
              </span>
              {!(isCoach && availableClasses.length === 1) && (
                <button
                  onClick={() => setSelectedClassId('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                    selectedClassId === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  همه کلاس‌ها ({toPersianDigits(filteredStudents.length)})
                </button>
              )}
              {availableClasses.map((cls) => {
                const count = students.filter((s) => s.classId === cls.id).length;
                const isSelected = selectedClassId === cls.id;
                return (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cls.name} ({toPersianDigits(count)})
                  </button>
                );
              })}
            </div>
          </div>
        )}

      {/* ========================================================================= */}
      {/* OVERVIEW: وضعیت تربیتی (۴ کارت ساده، کارهای سریع، موارد نیازمند توجه) */}
      {/* ========================================================================= */}
      {(currentView === null || currentView === 'dashboard') && (
        <div className="space-y-6 animate-in fade-in">
          <MentorMessagesSection />

          {/* ۴ کارت اصلی وضعیت تربیتی */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* کارت ۱: فعالیتهای تربیتی */}
            <button
              type="button"
              onClick={() => setCurrentView('observation')}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-500/50 shadow-xs hover:shadow-md transition text-right flex items-center justify-between group cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-slate-500 group-hover:text-emerald-700 transition">فعالیت‌های تربیتی</span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {toPersianDigits(totalObservationsCount)}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  مشاهدات رفتاری ثبت‌شده
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition">
                <HeartHandshake className="w-6 h-6" />
              </div>
            </button>

            {/* کارت ۲: وضعیت دانش‌آموزان */}
            <button
              type="button"
              onClick={() => setCurrentView('dossier')}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-teal-500/50 shadow-xs hover:shadow-md transition text-right flex items-center justify-between group cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-slate-500 group-hover:text-teal-700 transition">وضعیت دانش‌آموزان</span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {toPersianDigits(filteredStudents.length)}
                </div>
                <div className="text-[11px] text-teal-700 font-medium mt-0.5">
                  تحت پوشش مربیان و پرونده‌ها
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center group-hover:scale-105 transition">
                <Users className="w-6 h-6" />
              </div>
            </button>

            {/* کارت ۳: امتیازها */}
            <button
              type="button"
              onClick={() => setCurrentView('coachEvaluations')}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-amber-500/50 shadow-xs hover:shadow-md transition text-right flex items-center justify-between group cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-slate-500 group-hover:text-amber-700 transition">امتیازها و ارزیابی‌ها</span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {toPersianDigits(coachEvaluations.length)}
                </div>
                <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                  {toPersianDigits(totalEncouragementPoints)} امتیاز تشویقی ثبت‌شده
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center group-hover:scale-105 transition">
                <Star className="w-6 h-6" />
              </div>
            </button>

            {/* کارت ۴: موارد نیازمند توجه */}
            <button
              type="button"
              onClick={() => setCurrentView('attention')}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-rose-500/50 shadow-xs hover:shadow-md transition text-right flex items-center justify-between group cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-slate-500 group-hover:text-rose-700 transition">موارد نیازمند توجه</span>
                <div className="text-2xl font-black text-rose-700 mt-1">
                  {toPersianDigits(attentionNeededStudents.length)}
                </div>
                <div className="text-[11px] text-rose-600 font-medium mt-0.5">
                  نیازمند پیگیری و هدایت
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center group-hover:scale-105 transition">
                <AlertCircle className="w-6 h-6" />
              </div>
            </button>
          </div>

          {/* بخش کارهای سریع (Quick Actions) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>کارهای سریع</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (filteredStudents.length > 0) {
                    handleOpenStudentObs(filteredStudents[0]);
                  }
                }}
                className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 text-right transition group cursor-pointer"
              >
                <div className="flex items-center gap-2 font-bold text-xs text-emerald-900 group-hover:text-emerald-950">
                  <Plus className="w-4 h-4 text-emerald-700" />
                  <span>ثبت فعالیت / مشاهده‌گری</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  ثبت بازخورد رفتاری، عاطفی و عملکرد فردی
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleOpenNewCoachEval()}
                className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/60 hover:bg-teal-100/70 text-right transition group cursor-pointer"
              >
                <div className="flex items-center gap-2 font-bold text-xs text-teal-900 group-hover:text-teal-950">
                  <Award className="w-4 h-4 text-teal-700" />
                  <span>ثبت امتیاز و ارزیابی رشد</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  ارزیابی شاخص‌های شش‌گانه رشد دانش‌آموز
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('dossier')}
                className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100/70 text-right transition group cursor-pointer"
              >
                <div className="flex items-center gap-2 font-bold text-xs text-purple-900 group-hover:text-purple-950">
                  <FolderHeart className="w-4 h-4 text-purple-700" />
                  <span>مشاهده پرونده تربیتی</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  ۸ بخش جامع (مشاوره، مزاج، خانواده و...)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('academic_and_discipline')}
                className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/70 text-right transition group cursor-pointer"
              >
                <div className="flex items-center gap-2 font-bold text-xs text-indigo-900 group-hover:text-indigo-950">
                  <BookOpen className="w-4 h-4 text-indigo-700" />
                  <span>آموزش و انضباط کلاس‌ها</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  نمای یکپارچه کارنامه، غیبت‌ها و نمرات
                </p>
              </button>
            </div>
          </div>

          {/* بخش موارد نیازمند توجه (Attention Required) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  موارد نیازمند توجه و راهنمایی تربیتی
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCurrentView('attention')}
                className="text-xs font-bold text-rose-700 hover:text-rose-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>مشاهده تمام موارد ({toPersianDigits(attentionNeededStudents.length)})</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {attentionNeededStudents.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center text-xs text-emerald-800 font-bold">
                ✓ کلیه دانش‌آموزان در وضعیت مطلوب تربیتی و رشدی قرار دارند.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {attentionNeededStudents.slice(0, 6).map((student) => {
                  const studentClass = classes.find((c) => c.id === student.classId);
                  const stuObs = observations.filter((o) => o.studentId === student.id);
                  const lastObs = stuObs[stuObs.length - 1];

                  return (
                    <div
                      key={student.id}
                      className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-slate-900 text-xs">
                          {studentFullName(student)}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                          کلاس {studentClass?.name || '-'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 space-y-1">
                        <div>نمره انضباط: <span className="font-mono font-bold text-slate-900">{toPersianDigits(student.disciplineScore)}</span></div>
                        {lastObs && (
                          <div className="line-clamp-1 text-slate-500">
                            آخرین مشاهده: {lastObs.title || lastObs.content}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-rose-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDossierStudent(student);
                            setCurrentView('dossier');
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-white text-purple-700 hover:bg-purple-50 border border-purple-200 rounded-lg transition cursor-pointer"
                        >
                          پرونده تربیتی
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenStudentObs(student)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition cursor-pointer"
                        >
                          ثبت اقدام
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {currentView === 'academic_and_discipline' && (
        <CoachAcademicDisciplineView onOpenClassDetail={onOpenClassDetail} />
      )}
      {currentView === 'taught_lessons' && <TaughtLessonsView />}
      {currentView === 'worksheets' && <WorksheetsWorkspace />}
      {currentView === 'audit' && currentUser.role === 'vice_nurturing' && <NurturingAuditLog />}

      {/* ========================================================================= */}
      {/* SECTION 1: «مشاهده‌گری» (Observation Desk) */}
      {/* ========================================================================= */}
      {currentView === 'observation' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-emerald-600" />
                <span>فهرست دانش‌آموزان جهت مشاهده‌گری و ثبت یادداشت‌های رفتاری</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                روی نام هر دانش‌آموز کلیک کنید تا کادر ثبت مشاهدات و سوابق رفتاری باز شود.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              نمایش {toPersianDigits(filteredStudents.length)} دانش‌آموز
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredStudents.map((student) => {
              const studentObs = observations.filter((o) => o.studentId === student.id);
              const latestObs = studentObs[0];

              return (
                <div
                  key={student.id}
                  onClick={() => handleOpenStudentObs(student)}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-500/70 p-4.5 shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black text-sm group-hover:scale-105 transition">
                        {student.firstName[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                          {studentFullName(student)}
                        </h3>
                        <div className="text-[11px] text-slate-500">
                          {getStudentClassName(student.classId)}
                        </div>
                      </div>
                    </div>

                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      studentObs.length > 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      {studentObs.length > 0 ? `${toPersianDigits(studentObs.length)} مشاهده` : 'بدون مشاهده'}
                    </span>
                  </div>

                  {/* Latest Observation snippet */}
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-xs text-slate-600 min-h-[58px] flex flex-col justify-center">
                    {latestObs ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                          <span>آخرین: {latestObs.title}</span>
                          <span dir="ltr">{latestObs.date}</span>
                        </div>
                        <p className="text-[11px] text-slate-700 line-clamp-1">
                          {latestObs.content}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic text-center">
                        هنوز مشاهده‌ای ثبت نشده است (کلیک برای یادداشت)
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600 group-hover:text-emerald-700">
                    <span className="flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>ثبت و مشاهده یادداشت‌ها</span>
                    </span>
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: «پرونده تربیتی دانش‌آموزان» (Clean, Purposeful, Fast Access) */}
      {/* ========================================================================= */}
      {currentView === 'dossier' && !selectedDossierStudent && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Header: Compact, purposeful, and uncluttered */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                <button
                  type="button"
                  onClick={() => setCurrentView(null)}
                  className="hover:text-emerald-700 transition cursor-pointer flex items-center gap-1"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>داشبورد</span>
                </button>
                <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-900 font-black">پرونده تربیتی دانش‌آموزان</span>
              </div>

              {/* Actions: Mobile Menu Toggle & Return to Dashboard */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-mobile-sidebar-toggle-dossier"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="منوی ناوبری"
                >
                  <Menu className="w-3.5 h-3.5" />
                  <span>منو</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentView(null)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>بازگشت به داشبورد</span>
                </button>
              </div>
            </div>

            {/* Title & Subtitle with student count */}
            <div className="pt-3">
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg md:text-xl font-black text-slate-900">
                  پرونده تربیتی دانش‌آموزان
                </h1>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  {toPersianDigits(filteredStudents.length)} دانش‌آموز
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                دانش‌آموز را انتخاب کنید تا پرونده تربیتی او را ببینید.
              </p>
            </div>
          </div>

          {/* Search & Class Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 md:p-4 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="dossier-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجوی نام دانش‌آموز..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-9 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full transition cursor-pointer"
                  title="پاک کردن جستجو"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Class Filter Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="dossier-class-filter" className="text-xs font-bold text-slate-600 shrink-0">
                کلاس:
              </label>
              <select
                id="dossier-class-filter"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition cursor-pointer text-slate-800"
              >
                {!(isCoach && availableClasses.length === 1) && (
                  <option value="all">همه کلاس‌ها ({toPersianDigits(students.length)})</option>
                )}
                {availableClasses.map((cls) => {
                  const count = students.filter((s) => s.classId === cls.id).length;
                  return (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({toPersianDigits(count)})
                    </option>
                  );
                })}
              </select>

              {/* Reset Filters button if any filter is active */}
              {(searchTerm.trim() !== '' || (selectedClassId !== 'all' && !(isCoach && availableClasses.length === 1))) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedClassId(isCoach && availableClasses.length === 1 ? availableClasses[0].id : 'all');
                  }}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                  title="پاک کردن فیلترها"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">پاک کردن فیلترها</span>
                </button>
              )}
            </div>
          </div>

          {/* Student Cards Grid */}
          {filteredStudents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredStudents.map((student) => {
                const dossier = nurturingDossiers[student.id];
                const sectionsFilledCount = dossier ? (
                  (dossier.thinkingPoints.length > 0 ? 1 : 0) +
                  (dossier.privateSessions.length > 0 ? 1 : 0) +
                  (dossier.parentInterviews.length > 0 ? 1 : 0) +
                  (dossier.temperament.dominantType || dossier.temperament.entries.length > 0 ? 1 : 0) +
                  (dossier.growthPath.length > 0 ? 1 : 0) +
                  (dossier.lifestyle.length > 0 ? 1 : 0) +
                  (dossier.interviews.length > 0 ? 1 : 0) +
                  (dossier.nurturingSummary.overallSummary || dossier.nurturingSummary.entries.length > 0 ? 1 : 0)
                ) : 0;

                const isComplete = sectionsFilledCount === 8;

                return (
                  <div
                    key={student.id}
                    id={`dossier-card-${student.id}`}
                    onClick={() => setSelectedDossierStudent(student)}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-purple-400 hover:bg-slate-50/60 p-4 shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 group"
                  >
                    {/* Student Name & Class */}
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-purple-700 transition">
                        {studentFullName(student)}
                      </h3>
                      <div className="text-xs text-slate-500 mt-1 font-medium">
                        {getStudentClassName(student.classId)}
                      </div>
                    </div>

                    {/* Dossier Completion Status */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">تکمیل پرونده:</span>
                      {isComplete ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          کامل
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          ناقص
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              {selectedClassId !== 'all' && students.filter((s) => s.classId === selectedClassId).length === 0 ? (
                <>
                  <h3 className="text-sm font-bold text-slate-800">
                    دانش‌آموزی در این کلاس ثبت نشده است.
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedClassId('all')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <span>نمایش همه کلاس‌ها</span>
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-bold text-slate-800">
                    دانش‌آموزی پیدا نشد
                  </h3>
                  <p className="text-xs text-slate-500">
                    نام دیگری را جستجو کنید یا کلاس دیگری را انتخاب کنید.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedClassId('all');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold border border-purple-200 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>پاک کردن فیلترها</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DOSSIER DETAIL: 8 INTERACTIVE CARDS FOR SELECTED STUDENT */}
      {/* ========================================================================= */}
      {currentView === 'dossier' && selectedDossierStudent && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Back and Student Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedDossierStudent(null)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold text-xs"
              >
                <ArrowRight className="w-4 h-4" />
                <span>بازگشت به لیست دانش‌آموزان</span>
              </button>

              <div className="h-8 w-px bg-slate-200 hidden md:block" />

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-slate-900">
                    پرونده تربیتی: {studentFullName(selectedDossierStudent)}
                  </h2>
                  <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200">
                    {getStudentClassName(selectedDossierStudent.classId)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  کد ملی: <span className="font-mono font-bold text-slate-700">{selectedDossierStudent.nationalId}</span> | شماره دانش‌آموزی: <span className="font-mono font-bold text-slate-700">{selectedDossierStudent.studentCode}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>چاپ پرونده</span>
              </button>
            </div>
          </div>

          {/* 8 Specific Boxes Requested by the User */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(SECTION_CONFIGS) as NurturingSectionKey[]).map((sectionKey) => {
              const cfg = SECTION_CONFIGS[sectionKey];
              const IconComp = cfg.icon;
              const dossier = getStudentNurturingDossier(selectedDossierStudent.id);

              let entryCount = 0;
              let previewSnippet = '';

              if (sectionKey === 'temperament') {
                entryCount = dossier.temperament?.entries?.length || 0;
                previewSnippet = dossier.temperament?.dominantType 
                  ? `طبع: ${dossier.temperament.dominantType}` 
                  : 'طبع ثبت نشده است';
              } else if (sectionKey === 'nurturingSummary') {
                entryCount = dossier.nurturingSummary?.entries?.length || 0;
                previewSnippet = dossier.nurturingSummary?.overallSummary || 'جمعبندی کلی ثبت نشده است';
              } else {
                const list = (dossier[sectionKey] as DossierSectionEntry[]) || [];
                entryCount = list.length;
                previewSnippet = list[0]?.title || 'یادداشتی درج نشده است';
              }

              return (
                <div
                  key={sectionKey}
                  onClick={() => handleOpenSectionModal(sectionKey)}
                  className={`bg-white rounded-2xl border ${cfg.borderColor} p-5 shadow-xs hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 group hover:-translate-y-1`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-2xl ${cfg.bgLight} border ${cfg.borderColor} flex items-center justify-center ${cfg.color} group-hover:scale-110 transition`}>
                        <IconComp className="w-6 h-6" />
                      </div>
                      <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                        {entryCount > 0 ? `${toPersianDigits(entryCount)} یادداشت` : 'خالی'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-black text-slate-900 text-base group-hover:text-emerald-800 transition flex items-center justify-between">
                        <span>{cfg.title}</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                        {cfg.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[11px] text-slate-700 min-h-[45px] flex items-center justify-between">
                    <span className="line-clamp-1 font-medium">{previewSnippet}</span>
                    <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-slate-800 group-hover:-translate-x-1 transition shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: OBSERVATION FORM & LOGS FOR A STUDENT */}
      {/* ========================================================================= */}
      {isObsModalOpen && selectedStudentForObs && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    مشاهده‌گری رفتاری: {studentFullName(selectedStudentForObs)}
                  </h3>
                  <p className="text-xs text-emerald-300">
                    {getStudentClassName(selectedStudentForObs.classId)} | ثبت یادداشت‌های تربیتی
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsObsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Form to add or edit observation */}
              <form onSubmit={handleSaveObservation} className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4.5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-emerald-600" />
                    <span>{editingObsId ? 'ویرایش مشاهده' : 'ثبت مشاهده جدید'}</span>
                  </span>
                  {editingObsId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingObsId(null);
                        setObsTitle('');
                        setObsContent('');
                        setObsTagsInput('');
                      }}
                      className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      عنوان یا محور مشاهده <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={obsTitle}
                      onChange={(e) => setObsTitle(e.target.value)}
                      placeholder="مثال: تعامل با همکلاسی‌ها در زنگ تفریح"
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      دسته‌بندی مشاهده
                    </label>
                    <select
                      value={obsCategory}
                      onChange={(e) => setObsCategory(e.target.value as ObservationCategory)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {OBSERVATION_CATEGORIES.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">تاریخ</label>
                    <input
                      type="text"
                      value={obsDate}
                      onChange={(e) => {
                        setObsDate(e.target.value);
                        setObsDateManual(true);
                      }}
                      placeholder="1404/08/20"
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ساعت</label>
                    <input
                      type="text"
                      value={obsTime}
                      onChange={(e) => {
                        setObsTime(e.target.value);
                        setObsDateManual(true);
                      }}
                      placeholder="10:15"
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">مکان مشاهده</label>
                    <input
                      type="text"
                      value={obsLocation}
                      onChange={(e) => setObsLocation(e.target.value)}
                      placeholder="کلاس، حیاط، نمازخانه..."
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] -mt-1">
                  <span className={obsDateManual ? 'text-amber-700 font-bold' : 'text-emerald-700 font-bold'}>
                    {obsDateManual ? 'تاریخ و ساعت: دستی' : 'تاریخ و ساعت: خودکار از ساعت سامانه'}
                  </span>
                  {(obsDateManual || !editingObsId) && (
                    <button
                      type="button"
                      onClick={resetObsDateTimeToNow}
                      className="text-teal-700 hover:underline font-bold cursor-pointer"
                    >
                      اکنون (بازگشت به خودکار)
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    متن مشروح مشاهده‌گری <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={obsContent}
                    onChange={(e) => setObsContent(e.target.value)}
                    placeholder="رفتار، گفتار، واکنش هیجانی و جزئیات مشاهده شده را بنویسید..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    برچسب‌های کلیدی (با کاما جدا کنید)
                  </label>
                  <input
                    type="text"
                    value={obsTagsInput}
                    onChange={(e) => setObsTagsInput(e.target.value)}
                    placeholder="همدلی، مسئولیت‌پذیری، اضطراب، تمرکز..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-1.5 outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingObsId ? 'ذخیره تغییرات' : 'ثبت مشاهده'}</span>
                  </button>
                </div>
              </form>

              {/* Observation History Logs */}
              {nurturingLocked ? (
                <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
                  <div className="font-black mb-1">سوابق مشاهده‌گری نمایش داده نمی‌شود</div>
                  شما می‌توانید مشاهده‌گری جدید ثبت کنید، اما تا زمانی که ورود دومرحله‌ای حساب شما فعال نشده، هیچ سابقه‌ای (حتی مشاهده‌گری‌های خودتان) نمایش داده نمی‌شود.
                </div>
              ) : (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 flex items-center justify-between">
                  <span>سوابق و مشاهدات قبلی این دانش‌آموز:</span>
                  <span className="text-slate-400 font-normal">
                    {toPersianDigits(observations.filter((o) => o.studentId === selectedStudentForObs.id).length)} مورد
                  </span>
                </h4>

                <div className="space-y-2.5">
                  {observations.filter((o) => o.studentId === selectedStudentForObs.id).length === 0 ? (
                    <EmptyState
                      icon={NotebookPen}
                      title="هنوز مشاهده‌ای ثبت نشده است"
                      description="اولین مشاهده‌ی رفتاری این دانش‌آموز را از بالای همین پنجره ثبت کنید."
                    />
                  ) : (
                    observations
                      .filter((o) => o.studentId === selectedStudentForObs.id)
                      .map((obs) => {
                        const catObj = OBSERVATION_CATEGORIES.find((c) => c.key === obs.category);
                        return (
                          <div
                            key={obs.id}
                            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2 hover:border-emerald-300 transition"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs">{obs.title}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catObj?.color || 'bg-slate-100 text-slate-800'}`}>
                                  {catObj?.label || 'عمومی'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {obs.authorRole === 'coach' && currentUser.role === 'vice_nurturing' && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 whitespace-nowrap">
                                    ثبت‌شده توسط مربی
                                  </span>
                                )}
                                {(obs.authorId === currentUser.id || (!obs.authorId && currentUser.role === 'vice_nurturing')) && (<>
                                <button
                                  type="button"
                                  onClick={() => handleEditObservation(obs)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                  title="ویرایش"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    showConfirm({
                                      title: 'حذف شود؟',
                                      message: 'آیا از حذف این مشاهده اطمینان دارید؟',
                                      confirmLabel: 'بله، حذف شود',
                                      cancelLabel: 'انصراف',
                                      isDangerous: true,
                                      onConfirm: () => {
                                      deleteStudentObservation(obs.id);
                                    
                                      },
                                    });
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                  title="حذف"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                </>)}
                              </div>
                            </div>

                            <p className="text-xs text-slate-700 leading-relaxed">
                              {obs.content}
                            </p>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  <span dir="ltr">{obs.date}</span>
                                </span>
                                {obs.time && <span dir="ltr">ساعت {obs.time}</span>}
                                {obs.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    <span>{obs.location}</span>
                                  </span>
                                )}
                              </div>
                              <span>ثبت: {obs.recordedBy}</span>
                            </div>

                            {obs.tags && obs.tags.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap pt-1">
                                {obs.tags.map((t, idx) => (
                                  <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: «ارزیابی‌های رشدی-تربیتی مربیان یاوران ولایت» (Coach Growth Evaluations) */}
      {/* ========================================================================= */}
      {currentView === 'coachEvaluations' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-teal-700" />
                <span>ارزیابی‌های رشدی و تعالی تربیتی (مربیان یاوران ولایت)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                ثبت ارزیابی کیفی شش‌محوره، کشف استعدادها، نقاط قوت و ترسیم گام‌های ارتقای فردی توسط مربیان پایه و یاوران ولایت.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Period Filter */}
              <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-600">دوره:</span>
                <select
                  value={selectedPeriodFilter}
                  onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 outline-none text-xs"
                >
                  <option value="all">تمام دوره‌های ارزیابی</option>
                  {getEvaluationPeriodOptions().map((period) => (
                    <option key={period} value={period}>{period}</option>
                  ))}
                </select>
              </div>

              {/* Add New Coach Evaluation Button */}
              <button
                onClick={() => handleOpenNewCoachEval()}
                className="px-4 py-2.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت ارزیابی رشدی جدید</span>
              </button>
            </div>
          </div>

          {/* Evaluations Grid / List */}
          {filteredCoachEvaluations.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 space-y-4">
              <div className="w-16 h-16 bg-teal-50 text-teal-700 rounded-2xl flex items-center justify-center mx-auto border border-teal-200">
                <Award className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-sm">ارزیابی رشدی با مشخصات انتخابی یافت نشد</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  مربیان محترم می‌توانند با فشردن دکمه زیر، ارزیابی کیفی، نقاط قوت و مسیر تعالی دانش‌آموزان را ثبت نمایند.
                </p>
              </div>
              <button
                onClick={() => handleOpenNewCoachEval()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-teal-900 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت اولین ارزیابی برای دانش‌آموز</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredCoachEvaluations.map((ev) => {
                const student = students.find((s) => s.id === ev.studentId);
                if (!student) return null;
                const overallRatingCfg = RATING_INFO[ev.overallRating || 'very_good'];

                return (
                  <div
                    key={ev.id}
                    className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs hover:shadow-md hover:border-teal-300 transition flex flex-col justify-between space-y-4"
                  >
                    {/* Top Row: Student info, period, rating */}
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center font-black text-sm shrink-0">
                          {student.firstName[0]} {student.lastName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-black text-slate-900 text-sm">
                              {studentFullName(student)}
                            </h3>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                              {getStudentClassName(student.classId)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span>کد ملی: <span className="font-mono">{student.nationalId}</span></span>
                            <span>•</span>
                            <span className="text-teal-700 font-medium">مربی: {ev.coachName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-left shrink-0 space-y-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border ${overallRatingCfg.color}`}>
                          <span>{overallRatingCfg.icon}</span>
                          <span>{overallRatingCfg.label}</span>
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono text-right" dir="ltr">
                          {ev.date}
                        </div>
                      </div>
                    </div>

                    {/* Period Banner */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs text-slate-600">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-teal-600" />
                        <span>دوره ارزیابی: {ev.period}</span>
                      </span>
                      <span className="text-[11px] text-slate-500">ارزیابی شش‌محوره تربیتی</span>
                    </div>

                    {/* 6 Criteria Badges Grid */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-700 block">نمرات کیفی محورهای شش‌گانه رشد:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {CRITERIA_DEFINITIONS.map((crit) => {
                          const ratingVal = ev.criteria[crit.key] || 'good';
                          const rCfg = RATING_INFO[ratingVal];
                          return (
                            <div
                              key={crit.key}
                              className="bg-slate-50 border border-slate-200/70 rounded-xl p-2 text-right space-y-0.5"
                            >
                              <div className="text-[10px] text-slate-500 font-bold truncate" title={crit.label}>
                                {crit.label}
                              </div>
                              <div className={`text-[10px] font-black inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${rCfg.color}`}>
                                <span>{rCfg.icon}</span>
                                <span>{rCfg.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Strengths */}
                    {ev.strengths && ev.strengths.length > 0 && (
                      <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-3 space-y-1.5">
                        <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>نقاط قوت و استعدادهای بارز:</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ev.strengths.map((str, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] bg-white border border-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-lg font-medium shadow-2xs"
                            >
                              {str}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Growth Path Recommendations */}
                    {ev.growthRecommendations && ev.growthRecommendations.length > 0 && (
                      <div className="bg-teal-50/60 border border-teal-200/60 rounded-2xl p-3 space-y-1.5">
                        <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-teal-600" />
                          <span>توصیه‌های مربی برای مسیر رشد و تعالی:</span>
                        </span>
                        <ul className="list-disc list-inside text-xs text-teal-900 space-y-0.5 leading-relaxed">
                          {ev.growthRecommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Notes if any */}
                    {ev.notes && (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        <span className="font-bold text-slate-900 block mb-1">یادداشت و مشاهدات مربی:</span>
                        {ev.notes}
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedDossierStudent(student);
                          setCurrentView('dossier');
                        }}
                        className="text-xs font-bold text-purple-700 hover:text-purple-900 hover:bg-purple-50 px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                      >
                        <FolderHeart className="w-3.5 h-3.5" />
                        <span>مشاهده کامل پرونده تربیتی</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditCoachEval(ev)}
                          className="p-1.5 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-xl transition cursor-pointer"
                          title="ویرایش ارزیابی"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            showConfirm({
                              title: 'حذف شود؟',
                              message: `آیا از حذف ارزیابی رشدی «${studentFullName(student)}» در دوره ${ev.period} اطمینان دارید؟`,
                              confirmLabel: 'بله، حذف شود',
                              cancelLabel: 'انصراف',
                              isDangerous: true,
                              onConfirm: () => {
                              deleteCoachEvaluation(ev.id);
                            
                              },
                            });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="حذف ارزیابی"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FOCUSED WRITING & EDITING BOX FOR ANY OF THE 8 DOSSIER SECTIONS */}
      {/* ========================================================================= */}
      {activeSectionModal && selectedDossierStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            {(() => {
              const cfg = SECTION_CONFIGS[activeSectionModal];
              const IconComp = cfg.icon;
              return (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl ${cfg.bgLight} border ${cfg.borderColor} flex items-center justify-center ${cfg.color}`}>
                      <IconComp className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white">{cfg.title}</h3>
                        <span className="text-xs text-indigo-300 font-bold">
                          ({studentFullName(selectedDossierStudent)})
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{cfg.subtitle}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSectionModal(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              );
            })()}

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Special Overview Editor for Temperament (مزاج‌شناسی) */}
              {activeSectionModal === 'temperament' && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4.5 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>تحلیل طبع و ویژگی‌های کلی مزاج دانش‌آموز:</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        طبع غالب (دموی، صفراوی، بلغمی، سوداوی...)
                      </label>
                      <select
                        value={tempType}
                        onChange={(e) => setTempType(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none font-bold text-slate-900"
                      >
                        <option value="دموی (گرم و تر)">دموی (گرم و تر - پرانرژی، اجتماعی و پیشگام)</option>
                        <option value="صفراوی (گرم و خشک)">صفراوی (گرم و خشک - تیزهوش، سریع و حساس)</option>
                        <option value="بلغمی (سرد و تر)">بلغمی (سرد و تر - صبور، آرام و تامل‌گرا)</option>
                        <option value="سوداوی (سرد و خشک)">سوداوی (سرد و خشک - دقیق، منظم و تحلیل‌گر)</option>
                        <option value="دموی - صفراوی">دموی - صفراوی (مرکب گرم)</option>
                        <option value="بلغمی - سوداوی">بلغمی - سوداوی (مرکب سرد)</option>
                        <option value="معتدل">طبع معتدل</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        ویژگی‌های بارز بدنی / جسمانی
                      </label>
                      <input
                        type="text"
                        value={tempPhysical}
                        onChange={(e) => setTempPhysical(e.target.value)}
                        placeholder="مثلاً: قامت کشیده، حرارت بالا، پوست روشن..."
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ویژگی‌های رفتاری و توصیه‌های تدبیر طبع
                    </label>
                    <textarea
                      rows={2}
                      value={tempBehavioral}
                      onChange={(e) => setTempBehavioral(e.target.value)}
                      placeholder="توصیه‌های خواب، تغذیه، نحوه مواجهه در کلاس متناسب با طبع دانش‌آموز..."
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 outline-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveTemperamentOverview}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>ذخیره تحلیل طبع</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Special Overview Editor for Nurturing Summary (جمعبندی تربیتی) */}
              {activeSectionModal === 'nurturingSummary' && (
                <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4.5 space-y-3">
                  <h4 className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-purple-600" />
                    <span>ارزیابی جامع و راهبردهای کلان تربیتی:</span>
                  </h4>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      جمعبندی کلی وضعیت تربیتی و شخصیتی دانش‌آموز
                    </label>
                    <textarea
                      rows={3}
                      value={summaryOverall}
                      onChange={(e) => setSummaryOverall(e.target.value)}
                      placeholder="چکیده جامع از وضعیت اخلاقی، انگیزشی، رشد معنوی، تعاملات و نیازهای دانش‌آموز..."
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 outline-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        نقاط قوت کلیدی (هر سطر یک مورد)
                      </label>
                      <textarea
                        rows={3}
                        value={summaryStrengths}
                        onChange={(e) => setSummaryStrengths(e.target.value)}
                        placeholder="اخلاق‌مداری&#10;مسئولیت‌پذیری&#10;خلاقیت"
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        محورهای نیازمند توجه و تقویت (هر سطر یک مورد)
                      </label>
                      <textarea
                        rows={3}
                        value={summaryGrowth}
                        onChange={(e) => setSummaryGrowth(e.target.value)}
                        placeholder="مدیریت استرس&#10;نظم در خواب&#10;صبر در کار تیمی"
                        className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveSummaryOverview}
                      className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>ذخیره جمعبندی راهبردی</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Form to write a new entry in this section */}
              <form onSubmit={handleSaveSectionEntry} className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-slate-600" />
                    <span>
                      {editingSectionEntryId ? `ویرایش یادداشت ${SECTION_CONFIGS[activeSectionModal].title}` : `افزودن یادداشت جدید در بخش «${SECTION_CONFIGS[activeSectionModal].title}»`}
                    </span>
                  </span>
                  {editingSectionEntryId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSectionEntryId(null);
                        setSectionEntryTitle('');
                        setSectionEntryContent('');
                        setSectionEntryTags('');
                        setSectionEntryKeyTakeaways('');
                      }}
                      className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      عنوان یا محور یادداشت <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={sectionEntryTitle}
                      onChange={(e) => setSectionEntryTitle(e.target.value)}
                      placeholder={`مثلاً: بررسی ${SECTION_CONFIGS[activeSectionModal].title}...`}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">تاریخ یادداشت</label>
                    <input
                      type="text"
                      value={sectionEntryDate}
                      onChange={(e) => setSectionEntryDate(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    متن تفصیلی یادداشت <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={sectionEntryContent}
                    onChange={(e) => setSectionEntryContent(e.target.value)}
                    placeholder="مشروح نکات، مشاهدات، گفت‌وگوها، تحلیل‌ها و تصمیمات تربیتی را اینجا یادداشت کنید..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      نکات کلیدی / توصیه‌ها (هر خط یک مورد)
                    </label>
                    <textarea
                      rows={2}
                      value={sectionEntryKeyTakeaways}
                      onChange={(e) => setSectionEntryKeyTakeaways(e.target.value)}
                      placeholder="پیگیری در جلسه بعد&#10;هماهنگی با دبیر ریاضی"
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2.5 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      برچسب‌های موضوعی (با کاما جدا کنید)
                    </label>
                    <input
                      type="text"
                      value={sectionEntryTags}
                      onChange={(e) => setSectionEntryTags(e.target.value)}
                      placeholder="انگیزش، تفکر نقادانه، خانواده..."
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingSectionEntryId ? 'ذخیره ویرایش' : 'ثبت در پرونده تربیتی'}</span>
                  </button>
                </div>
              </form>

              {/* History Entries for this section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900">
                  یادداشت‌های ثبت‌شده در این بخش:
                </h4>

                {(() => {
                  const dossier = getStudentNurturingDossier(selectedDossierStudent.id);
                  let entriesList: DossierSectionEntry[] = [];
                  if (activeSectionModal === 'temperament') {
                    entriesList = dossier.temperament?.entries || [];
                  } else if (activeSectionModal === 'nurturingSummary') {
                    entriesList = dossier.nurturingSummary?.entries || [];
                  } else {
                    entriesList = (dossier[activeSectionModal] as DossierSectionEntry[]) || [];
                  }

                  if (entriesList.length === 0) {
                    return (
                      <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        هنوز یادداشتی در این بخش ثبت نگردیده است.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {entriesList.map((entry) => (
                        <div
                          key={entry.id}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2 hover:border-indigo-300 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{entry.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                                {entry.date}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditSectionEntry(entry)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                title="ویرایش"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  showConfirm({
                                    title: 'حذف شود؟',
                                    message: 'آیا از حذف این یادداشت اطمینان دارید؟',
                                    confirmLabel: 'بله، حذف شود',
                                    cancelLabel: 'انصراف',
                                    isDangerous: true,
                                    onConfirm: () => {
                                    deleteDossierSectionEntry(selectedDossierStudent.id, activeSectionModal, entry.id);
                                  
                                    },
                                  });
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {entry.content}
                          </p>

                          {entry.keyTakeaways && entry.keyTakeaways.length > 0 && (
                            <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-2 text-[11px] text-amber-900 space-y-1">
                              <span className="font-bold">نکات کلیدی و توصیه‌ها:</span>
                              <ul className="list-disc list-inside space-y-0.5">
                                {entry.keyTakeaways.map((k, idx) => (
                                  <li key={idx}>{k}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-1">
                              {entry.tags.map((t, idx) => (
                                <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: «مربیان تربیتی یاوران ولایت» (Coaches Management Desk) */}
      {/* ========================================================================= */}
      {currentView === 'coaches' && (
        <AdminCoachesWorkspace
          allCoaches={allCoaches}
          classes={classes}
          onBack={() => setCurrentView(null)}
          onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenNewCoach={() => setIsAddCoachOpen(true)}
          onSelectCoachForProfile={(coach) => {
            setSelectedCoach(coach);
            setIsCoachProfileOpen(true);
          }}
          onEditCoach={(coach) => {
            setSelectedCoach(coach);
            setIsEditCoachOpen(true);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: «موارد نیازمند توجه» (Attention Required Desk) */}
      {/* ========================================================================= */}
      {currentView === 'attention' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  میز پیگیری موارد نیازمند توجه و راهنمایی تربیتی
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  دانش‌آموزان با افت انضباطی یا رفتاری نیازمند مداخله و حمایت تربیتی
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-800 bg-rose-50 px-3.5 py-1.5 rounded-xl border border-rose-200">
                {toPersianDigits(attentionNeededStudents.length)} دانش‌آموز نیازمند پیگیری
              </span>
            </div>
          </div>

          {attentionNeededStudents.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-slate-900 text-sm">
                وضعیت تمام دانش‌آموزان مطلوب است
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                در حال حاضر هیچ دانش‌آموزی با نمره انضباط زیر ۱۸ یا هشدار رفتاری بحرانی در سامانه وجود ندارد.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attentionNeededStudents.map((student) => {
                const studentClass = classes.find((c) => c.id === student.classId);
                const stuObs = observations.filter((o) => o.studentId === student.id);
                const lastObs = stuObs[stuObs.length - 1];

                return (
                  <div
                    key={student.id}
                    className="bg-white rounded-2xl p-4.5 border border-rose-200 shadow-xs hover:shadow-md transition space-y-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-rose-100/80 text-rose-900 font-black text-sm flex items-center justify-center">
                            {student.firstName[0]}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">
                              {studentFullName(student)}
                            </h4>
                            <div className="text-[11px] text-slate-500">
                              کلاس {studentClass?.name || '-'} • کد: {student.studentCode}
                            </div>
                          </div>
                        </div>

                        <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl border ${
                          student.disciplineScore < 15
                            ? 'bg-rose-100 text-rose-900 border-rose-300'
                            : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}>
                          انضباط: {toPersianDigits(student.disciplineScore)}
                        </span>
                      </div>

                      {lastObs ? (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-bold text-slate-600">آخرین مشاهده ({lastObs.date}):</span>
                            <span>{lastObs.category}</span>
                          </div>
                          <p className="line-clamp-2 text-slate-700">{lastObs.title || lastObs.content}</p>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 italic">
                          افت انضباطی ثبت شده در سامانه (مشاهده مستمر کلاسی ندارد)
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDossierStudent(student);
                          setCurrentView('dossier');
                        }}
                        className="flex-1 py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <FolderHeart className="w-3.5 h-3.5" />
                        <span>پرونده تربیتی</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStudentObs(student)}
                        className="flex-1 py-1.5 px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ثبت اقدام</span>
                      </button>
                      {onSelectStudent && (
                        <button
                          type="button"
                          onClick={() => onSelectStudent(student)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
                          title="مشاهده پروفایل جامع دانش‌آموز"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: «گزارش‌های رشد» (Analytical Growth Reports) */}
      {/* ========================================================================= */}
      {currentView === 'reports' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  گزارش‌های تحلیلی رشد و تعالی تربیتی
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تحلیل آماری مشاهدات، ارزیابی‌های کیفی شش‌گانه مربیان و پوشش پرونده‌ها
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>چاپ گزارش</span>
              </button>
            </div>
          </div>

          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
              <div className="text-xs text-slate-500 font-bold">کل مشاهدات</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{toPersianDigits(totalObservationsCount)}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
              <div className="text-xs text-slate-500 font-bold">پرونده‌های فعال</div>
              <div className="text-2xl font-black text-purple-700 mt-1">{toPersianDigits(studentsWithDossierCount)}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
              <div className="text-xs text-slate-500 font-bold">ارزیابی‌های مربیان</div>
              <div className="text-2xl font-black text-teal-700 mt-1">{toPersianDigits(coachEvaluations.length)}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
              <div className="text-xs text-slate-500 font-bold">مربیان فعال</div>
              <div className="text-2xl font-black text-amber-700 mt-1">{toPersianDigits(allCoaches.length)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: توزیع مشاهدات بر اساس دسته‌بندی */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>توزیع مشاهدات رفتاری بر اساس حوزه‌ها</span>
              </h3>
              <div className="space-y-3 pt-1">
                {OBSERVATION_CATEGORIES.map((cat) => {
                  const count = observations.filter((o) => o.category === cat.key).length;
                  const percent = observations.length > 0 ? Math.round((count / observations.length) * 100) : 0;
                  return (
                    <div key={cat.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium">{cat.label}</span>
                        <span className="font-mono font-bold text-slate-800">
                          {toPersianDigits(count)} مورد ({toPersianDigits(percent)}٪)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: توزیع رتبه‌های کیفی ارزیابی‌های رشد */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-teal-600" />
                <span>توزیع رتبه‌های کیفی ارزیابی‌های رشدی</span>
              </h3>
              <div className="space-y-3 pt-1">
                {(Object.keys(RATING_INFO) as QualitativeRating[]).map((ratingKey) => {
                  const rInfo = RATING_INFO[ratingKey];
                  if (!rInfo) return null;
                  const count = coachEvaluations.filter((e) => e.overallRating === ratingKey).length;
                  const percent = coachEvaluations.length > 0 ? Math.round((count / coachEvaluations.length) * 100) : 0;
                  return (
                    <div key={ratingKey} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium flex items-center gap-1.5">
                          <span>{rInfo.icon}</span>
                          <span>{rInfo.label}</span>
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {toPersianDigits(count)} ({toPersianDigits(percent)}٪)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-600 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Class-by-Class Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-900">
              وضعیت مشارکت تربیتی به تفکیک کلاس‌ها
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-3">کلاس</th>
                    <th className="p-3">تعداد دانش‌آموز</th>
                    <th className="p-3">مشاهدات ثبت‌شده</th>
                    <th className="p-3">ارزیابی‌های رشدی</th>
                    <th className="p-3">میانگین انضباط</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {availableClasses.map((cls) => {
                    const clsStudents = students.filter((s) => s.classId === cls.id);
                    const clsObsCount = observations.filter((o) => clsStudents.some((s) => s.id === o.studentId)).length;
                    const clsEvalsCount = coachEvaluations.filter((e) => clsStudents.some((s) => s.id === e.studentId)).length;
                    const avgDiscipline = clsStudents.length > 0 
                      ? (clsStudents.reduce((acc, s) => acc + (s.disciplineScore || 20), 0) / clsStudents.length).toFixed(1)
                      : '20';

                    return (
                      <tr key={cls.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-3 font-bold text-slate-900">{cls.name}</td>
                        <td className="p-3 font-mono">{toPersianDigits(clsStudents.length)}</td>
                        <td className="p-3 font-mono text-emerald-700 font-bold">{toPersianDigits(clsObsCount)}</td>
                        <td className="p-3 font-mono text-teal-700 font-bold">{toPersianDigits(clsEvalsCount)}</td>
                        <td className="p-3 font-mono text-slate-800 font-bold">{toPersianDigits(avgDiscipline)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 7: «تنظیمات و شاخص‌ها» (Settings & Framework) */}
      {/* ========================================================================= */}
      {currentView === 'settings' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  تنظیمات و شاخص‌های سامانه تربیتی
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  تعاریف شاخص‌های شش‌گانه، مقیاس‌های ارزیابی مربیان و دسته‌بندی‌های مشاهده‌گری
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: شاخص‌های شش‌گانه رشد و تعالی */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>شاخص‌های شش‌گانه رشد و تعالی دانش‌آموز (طرح یاوران ولایت)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CRITERIA_DEFINITIONS.map((crit) => (
                <div
                  key={crit.key}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5"
                >
                  <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>{crit.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pr-4">
                    {crit.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: مقیاس‌های ارزیابی کیفی */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-teal-600" />
              <span>مقیاس‌های توصیفی و کیفی ارزیابی</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.entries(RATING_INFO) as [QualitativeRating, typeof RATING_INFO[QualitativeRating]][]).map(([key, info]) => (
                <div
                  key={key}
                  className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{info.icon}</span>
                    <span className="text-xs font-bold text-slate-900">{info.label}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${info.color}`}>
                    {key}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: دسته‌بندی‌های مشاهدات رفتاری */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-600" />
              <span>دسته‌بندی‌های معتبر مشاهدات رفتاری</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {OBSERVATION_CATEGORIES.map((cat) => (
                <div
                  key={cat.key}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center ${cat.color}`}
                >
                  {cat.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: COACH GROWTH EVALUATION MODAL (MODAL FOR YAVARAN-E VELAYAT COACHES) */}
      {/* ========================================================================= */}
      {isCoachEvalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-teal-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-800/60 border border-teal-500/40 flex items-center justify-center text-teal-300">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {editingCoachEvalId ? 'ویرایش ارزیابی رشدی-تربیتی' : 'ثبت ارزیابی رشدی-تربیتی جدید (مربیان یاوران ولایت)'}
                  </h3>
                  <p className="text-xs text-teal-200/80 mt-0.5">
                    ارزیابی کیفی، کشف استعدادها و ترسیم مسیر ارتقای شخصیتی و معنوی دانش‌آموز
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCoachEvalModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCoachEval} className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
              {/* Row 1: Student selection, period, date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    انتخاب دانش‌آموز <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={evalStudentId}
                    onChange={(e) => setEvalStudentId(e.target.value)}
                    disabled={!!editingCoachEvalId}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 outline-none font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100"
                  >
                    <option value="">-- انتخاب دانش‌آموز --</option>
                    {filteredStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {studentFullName(s)} ({getStudentClassName(s.classId)}) - کدملی: {s.nationalId}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    دوره ارزیابی <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={evalPeriod}
                    onChange={(e) => setEvalPeriod(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 outline-none font-bold text-slate-900 focus:ring-2 focus:ring-teal-500"
                  >
                    {getEvaluationPeriodOptions().map((period) => (
                      <option key={period} value={period}>{period}</option>
                    ))}
                    <option value="ارزیابی ویژه ماهانه">ارزیابی ویژه ماهانه</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تاریخ ثبت ارزیابی
                  </label>
                  <input
                    type="text"
                    value={evalDate}
                    onChange={(e) => setEvalDate(e.target.value)}
                    placeholder="۱۴۰۴/۰۸/۱۵"
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 outline-none font-mono text-slate-900 focus:ring-2 focus:ring-teal-500 text-center"
                  />
                </div>
              </div>

              {/* Row 2: 6 Growth Criteria Ratings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    <span>ارزیابی کیفی محورهای شش‌گانه تربیتی و رشد:</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">برای هر شاخص یکی از ۴ رتبه کیفی را انتخاب فرمایید</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {CRITERIA_DEFINITIONS.map((crit) => {
                    const currentRating = evalCriteria[crit.key];
                    return (
                      <div
                        key={crit.key}
                        className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-2xs hover:border-teal-300 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{crit.label}</span>
                          <span className="text-[10px] text-slate-400">{crit.desc}</span>
                        </div>

                        {/* Rating buttons */}
                        <div className="grid grid-cols-4 gap-1.5">
                          {(Object.keys(RATING_INFO) as QualitativeRating[]).map((rKey) => {
                            const rCfg = RATING_INFO[rKey];
                            const isSelected = currentRating === rKey;
                            return (
                              <button
                                key={rKey}
                                type="button"
                                onClick={() => {
                                  setEvalCriteria((prev) => ({
                                    ...prev,
                                    [crit.key]: rKey,
                                  }));
                                }}
                                className={`py-1.5 px-1 rounded-xl text-[10px] font-black transition border flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                                  isSelected
                                    ? `${rCfg.color} shadow-xs ring-2 ring-teal-500/50 scale-[1.02]`
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span className="text-xs">{rCfg.icon}</span>
                                <span>{rCfg.label.split(' ')[0]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Overall Qualitative Rating */}
              <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-4 space-y-2.5">
                <label className="block text-xs font-bold text-teal-950">
                  جمع‌بندی و ارزیابی کیفی کلی دانش‌آموز در این دوره:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(RATING_INFO) as QualitativeRating[]).map((rKey) => {
                    const rCfg = RATING_INFO[rKey];
                    const isSelected = evalOverallRating === rKey;
                    return (
                      <button
                        key={rKey}
                        type="button"
                        onClick={() => setEvalOverallRating(rKey)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition border flex items-center justify-center gap-2 cursor-pointer ${
                          isSelected
                            ? `${rCfg.color} shadow-sm ring-2 ring-teal-600 scale-[1.02]`
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{rCfg.icon}</span>
                        <span>{rCfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Strengths & Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نقاط قوت بارز، فضایل و استعدادها (هر سطر یک مورد)
                  </label>
                  <textarea
                    rows={3}
                    value={evalStrengths}
                    onChange={(e) => setEvalStrengths(e.target.value)}
                    placeholder="مثال:&#10;اهتمام به نماز اول وقت و برنامه‌های معنوی&#10;مسئولیت‌پذیری بالا در اجرای فعالیت‌های گروهی&#10;خلق‌وخوی صبورانه و احترام به مربیان"
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    توصیه‌های مربی برای مسیر رشد و تعالی (هر سطر یک مورد)
                  </label>
                  <textarea
                    rows={3}
                    value={evalGrowthRecommendations}
                    onChange={(e) => setEvalGrowthRecommendations(e.target.value)}
                    placeholder="مثال:&#10;تقویت فن بیان و مهارت ارائه در جمع&#10;تمرین مدیریت زمان و اولویت‌بندی در تکالیف&#10;مشارکت در حلقه‌های مطالعاتی و کتابخوانی"
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500 leading-relaxed"
                  />
                </div>
              </div>

              {/* Row 5: Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  مشاهدات مربی، گفت‌وگوهای صورت‌گرفته و یادداشت تکمیلی
                </label>
                <textarea
                  rows={3}
                  value={evalNotes}
                  onChange={(e) => setEvalNotes(e.target.value)}
                  placeholder="ثبت هرگونه نکته رفتاری، گفت‌وگوی چهره‌به‌چهره، هماهنگی با خانواده یا پیگیری‌های بعدی..."
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-teal-500 leading-relaxed"
                />
              </div>

              {/* Form Footer Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsCoachEvalModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingCoachEvalId ? 'ذخیره تغییرات ارزیابی' : 'ثبت و پیوست به پرونده تربیتی'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>

      {/* ========================================================================= */}
      {/* COACHES PROFILE & EDIT MODALS */}
      {/* ========================================================================= */}
      <CoachProfileModal
        isOpen={isCoachProfileOpen}
        onClose={() => setIsCoachProfileOpen(false)}
        coach={selectedCoach}
        onEdit={(coach) => {
          setSelectedCoach(coach);
          setIsCoachProfileOpen(false);
          setIsEditCoachOpen(true);
        }}
        onSelectStudent={(studentId) => {
          const stu = students.find((s) => s.id === studentId);
          if (stu) {
            setSelectedDossierStudent(stu);
            setCurrentView('dossier');
            setIsCoachProfileOpen(false);
          }
        }}
      />

      <AddCoachModal
        isOpen={isAddCoachOpen}
        onClose={() => setIsAddCoachOpen(false)}
      />

      <EditCoachModal
        isOpen={isEditCoachOpen}
        onClose={() => setIsEditCoachOpen(false)}
        coach={selectedCoach}
      />
    </div>
  );
};
