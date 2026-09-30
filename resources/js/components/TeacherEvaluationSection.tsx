import React, { useState } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';
import { 
  TeacherEvaluation, 
  TeacherEvaluationCriteria, 
  SchoolAnnouncement, 
  QualitativeRating 
} from '../types';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';
import { 
  Award, 
  Star, 
  CheckCircle2, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  FileSpreadsheet, 
  TrendingUp, 
  UserCheck, 
  BookOpen, 
  MessageSquare, 
  Calendar, 
  Sparkles,
  Printer,
  ChevronDown,
  Info,
  ShieldCheck,
  Send,
  Bell,
  Check,
  Eye,
  X,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Qualitative Rating Configs
export const QUALITATIVE_RATING_MAP: Record<QualitativeRating, {
  label: string;
  badgeClass: string;
  colorClass: string;
  score: number;
  bgLight: string;
  borderClass: string;
}> = {
  excellent: {
    label: 'عالی و الگو',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    colorClass: 'text-emerald-700',
    score: 20,
    bgLight: 'bg-emerald-50',
    borderClass: 'border-emerald-200'
  },
  very_good: {
    label: 'خیلی خوب',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    colorClass: 'text-blue-700',
    score: 18,
    bgLight: 'bg-blue-50',
    borderClass: 'border-blue-200'
  },
  good: {
    label: 'خوب و شایسته',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    colorClass: 'text-amber-700',
    score: 15,
    bgLight: 'bg-amber-50',
    borderClass: 'border-amber-200'
  },
  needs_improvement: {
    label: 'نیازمند ارتقاء',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    colorClass: 'text-rose-700',
    score: 12,
    bgLight: 'bg-rose-50',
    borderClass: 'border-rose-200'
  },
};

const CRITERIA_DEFINITIONS = [
  {
    key: 'lessonPlanning' as const,
    title: '۱. طرح درس سالانه، روزانه و بودجه‌بندی تدریس',
    description: 'تنظیم دقیق سرفصل‌ها، تطبیق با تقویم آموزشی و هدف‌گذاری یادگیری'
  },
  {
    key: 'teachingQuality' as const,
    title: '۲. کیفیت تدریس، تسلط علمی و تعامل کلاسی',
    description: 'شیوه بیان، پاسخگویی به سوالات، ایجاد انگیزه و فعال‌سازی دانش‌آموزان'
  },
  {
    key: 'punctualityAndDiscipline' as const,
    title: '۳. نظم حضور، شروع به موقع کلاس و مدیریت زمان',
    description: 'ورود قبل از زنگ، رعایت انضباط اداری و بهره‌برداری مفید از ۹۰ دقیقه'
  },
  {
    key: 'continuousAssessment' as const,
    title: '۴. ارزشیابی‌های مستمر و ثبت به موقع نمرات',
    description: 'برگزاری کوئیزهای دوره‌ای، تصحیح تکالیف و درج نمرات در سامانه مدرسه'
  },
  {
    key: 'parentAndSchoolCommunication' as const,
    title: '۵. ارتباط با اولیا، پاسخگویی و هماهنگی با معاونت',
    description: 'تعامل با خانواده‌ها، ارائه بازخورد تربیتی و هماهنگی با کادر مدرسه'
  }
];

export const TeacherEvaluationSection: React.FC = () => {
  const { 
    allTeachers, 
    teacherEvaluations = [], 
    schoolAnnouncements = [],
    saveTeacherEvaluation, 
    deleteTeacherEvaluation,
    addSchoolAnnouncement,
    deleteSchoolAnnouncement,
    currentUser
  } = useSchool();

  const teachers = allTeachers || [];
  const safeTeacherEvaluations = teacherEvaluations || [];
  const safeSchoolAnnouncements = schoolAnnouncements || [];

  const [searchTerm, setSearchTerm] = useState('');
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [inspectTeacherEvaluation, setInspectTeacherEvaluation] = useState<TeacherEvaluation | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'evaluations' | 'announcements'>('evaluations');

  // Evaluation Form State (Qualitative)
  const [evalFormTeacherId, setEvalFormTeacherId] = useState<string>('');
  const [evalFormAcademicYear, setEvalFormAcademicYear] = useState<string>(getActiveAcademicYear());
  const [evalFormTerm, setEvalFormTerm] = useState<'term1' | 'term2' | 'annual'>('annual');
  
  const [evalFormRatings, setEvalFormRatings] = useState<Record<string, QualitativeRating>>({
    lessonPlanning: 'excellent',
    teachingQuality: 'very_good',
    punctualityAndDiscipline: 'excellent',
    continuousAssessment: 'very_good',
    parentAndSchoolCommunication: 'very_good',
  });

  const [evalFormComments, setEvalFormComments] = useState<Record<string, string>>({
    lessonPlanning: '',
    teachingQuality: '',
    punctualityAndDiscipline: '',
    continuousAssessment: '',
    parentAndSchoolCommunication: '',
  });

  const [evalFormOverallRating, setEvalFormOverallRating] = useState<QualitativeRating>('very_good');
  const [evalFormStrengths, setEvalFormStrengths] = useState<string>('');
  const [evalFormImprovements, setEvalFormImprovements] = useState<string>('');
  const [evalFormGeneralNotes, setEvalFormGeneralNotes] = useState<string>('');

  // Announcement Form State
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementTarget, setAnnouncementTarget] = useState<'all_teachers' | 'coaches' | 'everyone'>('all_teachers');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'important' | 'urgent'>('normal');

  const todayInfo = getTodayShamsi();

  // Helper to extract qualitative rating from evaluation item
  const getCriterionRating = (val: any): QualitativeRating => {
    if (val === 'excellent' || val === 'very_good' || val === 'good' || val === 'needs_improvement') {
      return val;
    }
    if (typeof val === 'object' && val?.rating) {
      return val.rating;
    }
    if (typeof val === 'number') {
      if (val >= 19) return 'excellent';
      if (val >= 16) return 'very_good';
      if (val >= 13) return 'good';
      return 'needs_improvement';
    }
    return 'very_good';
  };

  const getCriterionComment = (criteria: TeacherEvaluationCriteria | undefined, key: string): string => {
    if (!criteria) return '';
    if (criteria.criteriaComments && criteria.criteriaComments[key]) {
      return criteria.criteriaComments[key];
    }
    const val = (criteria as any)[key];
    if (typeof val === 'object' && val?.comment) {
      return val.comment;
    }
    return '';
  };

  const formatTextContent = (val: string[] | string | undefined | null, defaultText: string = '-'): string => {
    if (!val) return defaultText;
    if (Array.isArray(val)) return val.join(' • ');
    return val;
  };

  // Filtered Teachers
  const filteredTeachers = teachers.filter((t) => {
    const term = searchTerm.toLowerCase();
    return (
      t.name.toLowerCase().includes(term) ||
      (t.subject || '').toLowerCase().includes(term) ||
      t.username.toLowerCase().includes(term)
    );
  });

  const handleOpenNewEvaluation = (teacherId?: string) => {
    const targetId = teacherId || (teachers[0]?.id || '');
    setEvalFormTeacherId(targetId);
    
    // Check if existing evaluation exists
    const existing = safeTeacherEvaluations.find(e => e.teacherId === targetId);
    if (existing) {
      setEvalFormAcademicYear(existing.academicYear || getActiveAcademicYear());
      setEvalFormTerm(existing.term || 'annual');
      
      setEvalFormRatings({
        lessonPlanning: getCriterionRating(existing.criteria.lessonPlanning),
        teachingQuality: getCriterionRating(existing.criteria.teachingQuality),
        punctualityAndDiscipline: getCriterionRating(existing.criteria.punctualityAndDiscipline ?? existing.criteria.punctuality),
        continuousAssessment: getCriterionRating(existing.criteria.continuousAssessment ?? existing.criteria.academicFollowUp),
        parentAndSchoolCommunication: getCriterionRating(existing.criteria.parentAndSchoolCommunication ?? existing.criteria.studentSatisfaction),
      });

      setEvalFormComments({
        lessonPlanning: getCriterionComment(existing.criteria, 'lessonPlanning'),
        teachingQuality: getCriterionComment(existing.criteria, 'teachingQuality'),
        punctualityAndDiscipline: getCriterionComment(existing.criteria, 'punctualityAndDiscipline'),
        continuousAssessment: getCriterionComment(existing.criteria, 'continuousAssessment'),
        parentAndSchoolCommunication: getCriterionComment(existing.criteria, 'parentAndSchoolCommunication'),
      });

      setEvalFormOverallRating(existing.overallRating || 'very_good');
      setEvalFormStrengths(formatTextContent(existing.strengths, ''));
      setEvalFormImprovements(formatTextContent(existing.areasForImprovement || existing.growthRecommendations, ''));
      setEvalFormGeneralNotes(existing.generalNotes || '');
    } else {
      setEvalFormAcademicYear(getActiveAcademicYear());
      setEvalFormTerm('annual');
      setEvalFormRatings({
        lessonPlanning: 'excellent',
        teachingQuality: 'very_good',
        punctualityAndDiscipline: 'excellent',
        continuousAssessment: 'very_good',
        parentAndSchoolCommunication: 'very_good',
      });
      setEvalFormComments({
        lessonPlanning: '',
        teachingQuality: '',
        punctualityAndDiscipline: '',
        continuousAssessment: '',
        parentAndSchoolCommunication: '',
      });
      setEvalFormOverallRating('very_good');
      setEvalFormStrengths('');
      setEvalFormImprovements('');
      setEvalFormGeneralNotes('');
    }
    setIsEvaluationModalOpen(true);
  };

  const handleSaveEvaluationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetTeacher = teachers.find(t => t.id === evalFormTeacherId);
    if (!targetTeacher) return;

    // Convert qualitative ratings to composite numerical equivalent for compatibility
    const scores = (Object.values(evalFormRatings) as QualitativeRating[]).map(r => QUALITATIVE_RATING_MAP[r]?.score || 18);
    const avgScore = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));

    const evaluationData: TeacherEvaluation = {
      id: `eval-${evalFormTeacherId}-${evalFormTerm}-${Date.now()}`,
      teacherId: evalFormTeacherId,
      teacherName: targetTeacher.name,
      evaluatorName: currentUser.name || 'مهندس کاظمی (معاونت آموزش)',
      date: todayInfo.displayDate,
      academicYear: evalFormAcademicYear,
      term: evalFormTerm,
      criteria: {
        lessonPlanning: { rating: evalFormRatings.lessonPlanning, comment: evalFormComments.lessonPlanning },
        teachingQuality: { rating: evalFormRatings.teachingQuality, comment: evalFormComments.teachingQuality },
        punctualityAndDiscipline: { rating: evalFormRatings.punctualityAndDiscipline, comment: evalFormComments.punctualityAndDiscipline },
        continuousAssessment: { rating: evalFormRatings.continuousAssessment, comment: evalFormComments.continuousAssessment },
        parentAndSchoolCommunication: { rating: evalFormRatings.parentAndSchoolCommunication, comment: evalFormComments.parentAndSchoolCommunication },
        criteriaComments: evalFormComments,
      },
      overallRating: evalFormOverallRating,
      overallScore: avgScore,
      strengths: evalFormStrengths,
      areasForImprovement: evalFormImprovements,
      generalNotes: evalFormGeneralNotes,
      updatedAt: new Date().toISOString(),
    };

    saveTeacherEvaluation(evaluationData);
    setIsEvaluationModalOpen(false);
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) return;

    const newAnn: SchoolAnnouncement = {
      id: `ann-${Date.now()}`,
      title: announcementTitle.trim(),
      content: announcementContent.trim(),
      author: currentUser.name || 'معاونت آموزش',
      authorName: currentUser.name || 'معاونت آموزش',
      date: todayInfo.displayDate,
      targetRole: announcementTarget,
      priority: announcementPriority,
    };

    addSchoolAnnouncement(newAnn);
    setAnnouncementTitle('');
    setAnnouncementContent('');
    setIsAnnouncementModalOpen(false);
  };

  // Export qualitative evaluations with criteria comments to Excel
  const handleExportEvaluationsExcel = () => {
    const data = teachers.map((t, idx) => {
      const evalItem = safeTeacherEvaluations.find(e => e.teacherId === t.id);
      
      const lpRating = evalItem ? QUALITATIVE_RATING_MAP[getCriterionRating(evalItem.criteria.lessonPlanning)]?.label : 'ثبت نشده';
      const lpNote = evalItem ? getCriterionComment(evalItem.criteria, 'lessonPlanning') : '';

      const tqRating = evalItem ? QUALITATIVE_RATING_MAP[getCriterionRating(evalItem.criteria.teachingQuality)]?.label : 'ثبت نشده';
      const tqNote = evalItem ? getCriterionComment(evalItem.criteria, 'teachingQuality') : '';

      const pdRating = evalItem ? QUALITATIVE_RATING_MAP[getCriterionRating(evalItem.criteria.punctualityAndDiscipline ?? evalItem.criteria.punctuality)]?.label : 'ثبت نشده';
      const pdNote = evalItem ? getCriterionComment(evalItem.criteria, 'punctualityAndDiscipline') : '';

      const caRating = evalItem ? QUALITATIVE_RATING_MAP[getCriterionRating(evalItem.criteria.continuousAssessment ?? evalItem.criteria.academicFollowUp)]?.label : 'ثبت نشده';
      const caNote = evalItem ? getCriterionComment(evalItem.criteria, 'continuousAssessment') : '';

      const cmRating = evalItem ? QUALITATIVE_RATING_MAP[getCriterionRating(evalItem.criteria.parentAndSchoolCommunication ?? evalItem.criteria.studentSatisfaction)]?.label : 'ثبت نشده';
      const cmNote = evalItem ? getCriterionComment(evalItem.criteria, 'parentAndSchoolCommunication') : '';

      const overall = evalItem?.overallRating ? QUALITATIVE_RATING_MAP[evalItem.overallRating]?.label : (evalItem ? 'خیلی خوب' : 'ثبت نشده');

      return {
        'ردیف': idx + 1,
        'نام و نام خانوادگی دبیر': t.name,
        'درس تخصصی': t.subject || '-',
        'رتبه کلی ارزیابی': overall,
        'طرح درس و بودجه‌بندی': lpRating,
        'توضیحات طرح درس': lpNote,
        'کیفیت تدریس و تفهیم': tqRating,
        'توضیحات تدریس': tqNote,
        'نظم و مدیریت زمان': pdRating,
        'توضیحات نظم': pdNote,
        'ارزشیابی مستمر و ثبت نمرات': caRating,
        'توضیحات ارزشیابی': caNote,
        'ارتباط با اولیا و هماهنگی': cmRating,
        'توضیحات تعامل': cmNote,
        'نقاط قوت بارز': formatTextContent(evalItem?.strengths, '-'),
        'محورهای ارتقاء': formatTextContent(evalItem?.areasForImprovement || evalItem?.growthRecommendations, '-'),
        'یادداشت جامع معاونت': evalItem?.generalNotes || '-',
        'تاریخ ارزیابی': evalItem?.date || '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ارزیابی_کیفی_معلمان');
    XLSX.writeFile(workbook, `ارزیابی_کیفی_دبیران_یاوران_ولایت_${todayInfo.formattedDate.replace(/\//g, '-')}.xlsx`);
  };

  const totalEvaluated = teachers.filter(t => safeTeacherEvaluations.some(e => e.teacherId === t.id)).length;

  return (
    <div className="space-y-6 font-['Vazirmatn',sans-serif]">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-blue-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-blue-500/20 text-blue-300 rounded-2xl border border-blue-400/30">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">
                  سامانه «ارتباط و ارتقاء» • ارزیابی کیفی عملکرد معلمان
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-400/30 font-bold">
                  ارزیابی کیفی توصیفی
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5 leading-relaxed">
                سنجش کیفی ۵ شاخص استاندارد آموزشی همراه با بازخورد تفصیلی، نقاط قوت، محورهای توانمندسازی و ارسال اطلاعیه‌های عمومی برای دبیران
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={() => setIsAnnouncementModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Bell className="w-4 h-4" />
            <span>ثبت اطلاعیه عمومی جدید</span>
          </button>

          <button
            onClick={handleExportEvaluationsExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی اکسل ارزیابی‌ها</span>
          </button>

          <button
            onClick={() => handleOpenNewEvaluation()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت ارزیابی کیفی دبیر</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>کل کادر آموزشی و دبیران</span>
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {toPersianDigits(teachers.length)} نفر
          </div>
          <div className="text-[11px] text-slate-400">دبیران مجتمع یاوران ولایت</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>ارزیابی‌های تکمیل‌شده</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {toPersianDigits(totalEvaluated)} نفر
          </div>
          <div className="text-[11px] text-emerald-600">پوشش {toPersianDigits(Math.round((totalEvaluated / (teachers.length || 1)) * 100))}% دبیران</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>مدل سنجش عملکرد</span>
            <Star className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-black text-amber-600 mt-1">
            کیفی توصیفی (۴ سطحی)
          </div>
          <div className="text-[11px] text-amber-600">همراه با ثبت یادداشت و بازخورد</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>اطلاعیه‌های ابلاغ شده</span>
            <Bell className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700 font-mono">
            {toPersianDigits(safeSchoolAnnouncements.length)} مورد
          </div>
          <div className="text-[11px] text-indigo-600">قابل مشاهده در پنل کلیه دبیران</div>
        </div>
      </div>

      {/* Sub-Tabs: Evaluations vs Announcements */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/80 rounded-2xl border border-slate-300/80">
        <button
          onClick={() => setActiveSubTab('evaluations')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'evaluations'
              ? 'bg-white text-blue-950 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Award className="w-4 h-4 text-blue-600" />
          <span>جدول سنجش و ارزیابی کیفی دبیران</span>
          <span className="text-xs bg-blue-50 text-blue-800 font-mono px-2 py-0.5 rounded-md">
            {toPersianDigits(teachers.length)}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('announcements')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'announcements'
              ? 'bg-white text-indigo-950 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Bell className="w-4 h-4 text-indigo-600" />
          <span>بخشنامه‌ها و پیام‌های عمومی برای معلمان</span>
          <span className="text-xs bg-indigo-50 text-indigo-800 font-mono px-2 py-0.5 rounded-md">
            {toPersianDigits(safeSchoolAnnouncements.length)}
          </span>
        </button>
      </div>

      {/* VIEW 1: Qualitative Evaluations Table */}
      {activeSubTab === 'evaluations' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          
          {/* Search bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجوی نام دبیر، درس یا نام کاربری..."
                className="w-full text-xs bg-white border border-slate-200 rounded-xl pr-9 pl-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Qualitative Rating Legend */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="text-slate-500 font-bold">راهنمای سطوح کیفی:</span>
              {(Object.keys(QUALITATIVE_RATING_MAP) as QualitativeRating[]).map((key) => {
                const cfg = QUALITATIVE_RATING_MAP[key];
                return (
                  <span key={key} className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold ${cfg.badgeClass}`}>
                    {cfg.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Teachers Qualitative Evaluation Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 text-slate-600 text-[11px] font-bold border-b border-slate-200">
                  <th className="py-3 px-3 text-center w-12">ردیف</th>
                  <th className="py-3 px-4">مشخصات دبیر</th>
                  <th className="py-3 px-3">درس تدریس</th>
                  <th className="py-3 px-3 text-center">طرح درس و بودجه‌بندی</th>
                  <th className="py-3 px-3 text-center">کیفیت تدریس</th>
                  <th className="py-3 px-3 text-center">نظم و مدیریت زمان</th>
                  <th className="py-3 px-3 text-center">ارزشیابی مستمر</th>
                  <th className="py-3 px-3 text-center">ارتباط با اولیا</th>
                  <th className="py-3 px-3 text-center">ارزیابی کلی</th>
                  <th className="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((teacher, idx) => {
                  const evalItem = safeTeacherEvaluations.find(e => e.teacherId === teacher.id);
                  const isEvaluated = !!evalItem;

                  const lpRating = evalItem ? getCriterionRating(evalItem.criteria.lessonPlanning) : null;
                  const tqRating = evalItem ? getCriterionRating(evalItem.criteria.teachingQuality) : null;
                  const pdRating = evalItem ? getCriterionRating(evalItem.criteria.punctualityAndDiscipline ?? evalItem.criteria.punctuality) : null;
                  const caRating = evalItem ? getCriterionRating(evalItem.criteria.continuousAssessment ?? evalItem.criteria.academicFollowUp) : null;
                  const cmRating = evalItem ? getCriterionRating(evalItem.criteria.parentAndSchoolCommunication ?? evalItem.criteria.studentSatisfaction) : null;
                  const overallRating = evalItem?.overallRating || (evalItem ? 'very_good' : null);

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-3 text-center font-mono text-slate-400">
                        {toPersianDigits(idx + 1)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {teacher.name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{teacher.name}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium text-[11px]">
                          {teacher.subject || 'عمومی'}
                        </span>
                      </td>

                      {/* Criteria 1 */}
                      <td className="py-3.5 px-3 text-center">
                        {lpRating ? (
                          <span className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] font-bold ${QUALITATIVE_RATING_MAP[lpRating].badgeClass}`}>
                            {QUALITATIVE_RATING_MAP[lpRating].label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Criteria 2 */}
                      <td className="py-3.5 px-3 text-center">
                        {tqRating ? (
                          <span className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] font-bold ${QUALITATIVE_RATING_MAP[tqRating].badgeClass}`}>
                            {QUALITATIVE_RATING_MAP[tqRating].label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Criteria 3 */}
                      <td className="py-3.5 px-3 text-center">
                        {pdRating ? (
                          <span className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] font-bold ${QUALITATIVE_RATING_MAP[pdRating].badgeClass}`}>
                            {QUALITATIVE_RATING_MAP[pdRating].label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Criteria 4 */}
                      <td className="py-3.5 px-3 text-center">
                        {caRating ? (
                          <span className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] font-bold ${QUALITATIVE_RATING_MAP[caRating].badgeClass}`}>
                            {QUALITATIVE_RATING_MAP[caRating].label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Criteria 5 */}
                      <td className="py-3.5 px-3 text-center">
                        {cmRating ? (
                          <span className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] font-bold ${QUALITATIVE_RATING_MAP[cmRating].badgeClass}`}>
                            {QUALITATIVE_RATING_MAP[cmRating].label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Overall Rating */}
                      <td className="py-3.5 px-3 text-center">
                        {overallRating ? (
                          <span className={`inline-block px-2.5 py-1 rounded-xl border text-xs font-black shadow-2xs ${QUALITATIVE_RATING_MAP[overallRating].badgeClass}`}>
                            {QUALITATIVE_RATING_MAP[overallRating].label}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">ثبت نشده</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isEvaluated && (
                            <button
                              onClick={() => setInspectTeacherEvaluation(evalItem)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition cursor-pointer"
                              title="مشاهده کارنامه کیفی"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenNewEvaluation(teacher.id)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                            <span>{isEvaluated ? 'ویرایش' : 'ثبت سنجش'}</span>
                          </button>

                          {isEvaluated && (
                            <button
                              onClick={() => {
                                if (confirm(`آیا از حذف ارزیابی ${teacher.name} اطمینان دارید؟`)) {
                                  deleteTeacherEvaluation(evalItem.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              title="حذف ارزیابی"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* VIEW 2: School Announcements */}
      {activeSubTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <span>لیست اطلاعیه‌ها و پیام‌های عمومی ابلاغ‌شده به پنل معلمان</span>
            </h3>

            <button
              onClick={() => setIsAnnouncementModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>ایجاد اطلاعیه جدید</span>
            </button>
          </div>

          {safeSchoolAnnouncements.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-xs text-slate-500 text-xs">
              هیچ اطلاعیه یا پیامی تاکنون ثبت نشده است.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {safeSchoolAnnouncements.map((ann) => (
                <div key={ann.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3 relative hover:border-indigo-300 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        ann.priority === 'urgent' ? 'bg-rose-100 text-rose-800' :
                        ann.priority === 'important' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {ann.priority === 'urgent' ? 'فوری' : ann.priority === 'important' ? 'مهم' : 'عادی'}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">{ann.title}</h4>
                    </div>

                    <button
                      onClick={() => {
                        if (confirm('آیا از حذف این اطلاعیه اطمینان دارید؟')) {
                          deleteSchoolAnnouncement(ann.id);
                        }
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer transition"
                      title="حذف اطلاعیه"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed text-justify whitespace-pre-line">
                    {ann.content}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    <span>صادرکننده: {ann.authorName || ann.author || 'معاونت آموزش'}</span>
                    <span className="font-mono">{ann.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Qualitative Evaluation Form Modal */}
      {isEvaluationModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden font-['Vazirmatn',sans-serif]">
            
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Award className="w-6 h-6 text-amber-300" />
                <div>
                  <h3 className="text-base font-bold">
                    فرم ارزیابی کیفی عملکرد و مهارت‌های تدریس دبیر
                  </h3>
                  <p className="text-xs text-blue-200">سنجش توصیفی ۵ شاخص همراه با ثبت توضیحات و بازخورد اختصاصی</p>
                </div>
              </div>
              <button
                onClick={() => setIsEvaluationModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvaluationSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">انتخاب دبیر محترم:</label>
                  <select
                    value={evalFormTeacherId}
                    onChange={(e) => setEvalFormTeacherId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subject || 'عمومی'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">دوره ارزیابی کیفی:</label>
                  <select
                    value={evalFormTerm}
                    onChange={(e) => setEvalFormTerm(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="term1">نوبت اول (نیمسال اول)</option>
                    <option value="term2">نوبت دوم (نیمسال دوم)</option>
                    <option value="annual">ارزیابی جامع سالانه</option>
                  </select>
                </div>
              </div>

              {/* 5 Qualitative Criteria with Description Textareas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-500" />
                    <span>شاخص‌های پنج‌گانه ارزیابی کیفی همراه با توضیحات:</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">انتخاب یکی از ۴ سطح کیفی + ثبت بازخورد</span>
                </div>

                {CRITERIA_DEFINITIONS.map((crit, idx) => {
                  const currentRating = evalFormRatings[crit.key] || 'very_good';
                  const currentComment = evalFormComments[crit.key] || '';

                  return (
                    <div key={crit.key} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">{crit.title}</span>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${QUALITATIVE_RATING_MAP[currentRating].badgeClass}`}>
                            سطح: {QUALITATIVE_RATING_MAP[currentRating].label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{crit.description}</p>
                      </div>

                      {/* 4 Qualitative Radio Buttons / Chips */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(Object.keys(QUALITATIVE_RATING_MAP) as QualitativeRating[]).map((ratingKey) => {
                          const ratingCfg = QUALITATIVE_RATING_MAP[ratingKey];
                          const isSelected = currentRating === ratingKey;

                          return (
                            <button
                              key={ratingKey}
                              type="button"
                              onClick={() => {
                                setEvalFormRatings(prev => ({ ...prev, [crit.key]: ratingKey }));
                              }}
                              className={`py-2 px-2.5 rounded-xl border font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                                isSelected
                                  ? `${ratingCfg.badgeClass} ring-2 ring-blue-500/40 shadow-xs`
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              <span>{ratingCfg.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Criterion Specific Description */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          توضیحات و بازخورد اختصاصی معاونت برای این شاخص:
                        </label>
                        <input
                          type="text"
                          value={currentComment}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEvalFormComments(prev => ({ ...prev, [crit.key]: val }));
                          }}
                          placeholder={`نکات تفصیلی، شواهد و بازخورد مربوط به ${crit.title.split('.')[1]}...`}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Overall Qualitative Rating */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-2.5">
                <label className="block font-bold text-blue-900 text-xs">
                  سطح ارزیابی و رتبه‌بندی کیفی کل دبیر:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(QUALITATIVE_RATING_MAP) as QualitativeRating[]).map((ratingKey) => {
                    const ratingCfg = QUALITATIVE_RATING_MAP[ratingKey];
                    const isSelected = evalFormOverallRating === ratingKey;

                    return (
                      <button
                        key={ratingKey}
                        type="button"
                        onClick={() => setEvalFormOverallRating(ratingKey)}
                        className={`py-2.5 px-3 rounded-xl border font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? `${ratingCfg.badgeClass} ring-2 ring-blue-600 shadow-xs`
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-white/80'
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                        <span>{ratingCfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strengths */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">نقاط قوت و برجستگی‌های تدریس دبیر:</label>
                <textarea
                  value={evalFormStrengths}
                  onChange={(e) => setEvalFormStrengths(e.target.value)}
                  placeholder="مثال: تسلط عالی بر مباحث کنکوری و کتاب درسی، ایجاد انگیزه و نظم قوی در کلاس، هماهنگی کامل با برنامه آموزشی..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Improvements */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">محورها و توصیه‌های ارتقای کیفیت تدریس:</label>
                <textarea
                  value={evalFormImprovements}
                  onChange={(e) => setEvalFormImprovements(e.target.value)}
                  placeholder="مثال: تسریع در ثبت نمرات مستمر ماهانه در سامانه، برگزاری جلسات رفع اشکال برای دانش‌آموزان نیازمند توجه..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* General Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">یادداشت و رهنمودهای جامع معاونت آموزشی:</label>
                <textarea
                  value={evalFormGeneralNotes}
                  onChange={(e) => setEvalFormGeneralNotes(e.target.value)}
                  placeholder="نکات تکمیلی، تقدیر رسمی یا برنامه‌ریزی جهت کارگاه‌های توانمندسازی..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEvaluationModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-2"
                >
                  <Award className="w-4 h-4" />
                  <span>ذخیره و ثبت رسمی ارزیابی کیفی دبیر</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Inspect Qualitative Evaluation Dossier */}
      {inspectTeacherEvaluation && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden font-['Vazirmatn',sans-serif]">
            
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-amber-300">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold">کارنامه ارزیابی کیفی: {inspectTeacherEvaluation.teacherName}</h3>
                  <span className="text-xs text-slate-300 font-mono">
                    تاریخ ثبت: {inspectTeacherEvaluation.date} • ارزیاب: {inspectTeacherEvaluation.evaluatorName}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setInspectTeacherEvaluation(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              
              {/* Overall Rating Banner */}
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-indigo-700 block">سطح ارزیابی کلی دبیر:</span>
                  <span className="text-sm font-black text-indigo-950 mt-0.5 block">
                    {QUALITATIVE_RATING_MAP[inspectTeacherEvaluation.overallRating || 'very_good']?.label}
                  </span>
                </div>
                <span className={`px-3 py-1.5 rounded-xl border font-black text-xs ${QUALITATIVE_RATING_MAP[inspectTeacherEvaluation.overallRating || 'very_good']?.badgeClass}`}>
                  {QUALITATIVE_RATING_MAP[inspectTeacherEvaluation.overallRating || 'very_good']?.label}
                </span>
              </div>

              {/* 5 Qualitative Criteria & Comments */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-slate-800 text-xs">ریز رتبه‌های کیفی و توضیحات شاخص‌ها:</h4>
                {CRITERIA_DEFINITIONS.map(crit => {
                  const rating = getCriterionRating((inspectTeacherEvaluation.criteria as any)[crit.key]);
                  const comment = getCriterionComment(inspectTeacherEvaluation.criteria, crit.key);
                  const ratingCfg = QUALITATIVE_RATING_MAP[rating];

                  return (
                    <div key={crit.key} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{crit.title}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${ratingCfg.badgeClass}`}>
                          {ratingCfg.label}
                        </span>
                      </div>
                      {comment ? (
                        <p className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200">
                          <strong>توضیحات: </strong>{comment}
                        </p>
                      ) : (
                        <span className="text-[10px] text-slate-400">توضیحات تکمیلی ثبت نشده است.</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Strengths */}
              {inspectTeacherEvaluation.strengths && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-1">
                  <h5 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>نقاط قوت بارز دبیر:</span>
                  </h5>
                  <p className="text-emerald-800 leading-relaxed">
                    {formatTextContent(inspectTeacherEvaluation.strengths)}
                  </p>
                </div>
              )}

              {/* Improvements */}
              {(inspectTeacherEvaluation.areasForImprovement || inspectTeacherEvaluation.growthRecommendations) && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl space-y-1">
                  <h5 className="font-bold text-blue-900 text-xs flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span>محورها و توصیه‌های ارتقاء:</span>
                  </h5>
                  <p className="text-blue-800 leading-relaxed">
                    {formatTextContent(inspectTeacherEvaluation.areasForImprovement || inspectTeacherEvaluation.growthRecommendations)}
                  </p>
                </div>
              )}

              {/* General Notes */}
              {inspectTeacherEvaluation.generalNotes && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-1">
                  <h5 className="font-bold text-slate-900 text-xs">یادداشت جامع معاونت آموزشی:</h5>
                  <p className="text-slate-700 leading-relaxed">
                    {inspectTeacherEvaluation.generalNotes}
                  </p>
                </div>
              )}

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                onClick={() => setInspectTeacherEvaluation(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                بستن
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal 3: New School Announcement Modal */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden font-['Vazirmatn',sans-serif]">
            
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-300" />
                <h3 className="text-base font-bold">ابلاغ اطلاعیه و بخشنامه جدید به معلمان</h3>
              </div>
              <button
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="text-slate-300 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان بخشنامه یا اطلاعیه:</label>
                <input
                  type="text"
                  required
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="مثال: دستورالعمل ثبت نمرات مستمر آبان‌ماه و برنامه جلسات هم‌اندیشی..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اولویت اطلاعیه:</label>
                  <select
                    value={announcementPriority}
                    onChange={(e) => setAnnouncementPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="normal">عادی</option>
                    <option value="important">مهم</option>
                    <option value="urgent">فوری و ضروری</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">مخاطبان هدف:</label>
                  <select
                    value={announcementTarget}
                    onChange={(e) => setAnnouncementTarget(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all_teachers">کلیه دبیران و اساتید</option>
                    <option value="coaches">مربیان یاوران ولایت</option>
                    <option value="everyone">تمام کادر مدرسه</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">متن کامل اطلاعیه:</label>
                <textarea
                  required
                  rows={4}
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  placeholder="متن کامل بخشنامه یا پیام آموزشی معاونت را در این قسمت وارد فرمایید..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>انتشار و ابلاغ اطلاعیه</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
