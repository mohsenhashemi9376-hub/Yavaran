import { LessonPlan, LessonScenarioStep } from '../types';
import { getActiveAcademicYear, getTodayShamsi, toEnglishDigits } from './persianDate';

/** ملاک‌های انتخاب روش تدریس در فرم سنتی مدرسه */
export const METHOD_CRITERIA = ['موضوع', 'مخاطب', 'امکانات', 'روش تربیتی'];
export const METHOD_OPTIONS = ['سخنرانی', 'پرسش و پاسخ', 'بحث گروهی', 'ایفای نقش', 'حل مسئله', 'اکتشافی', 'داستان‌گویی', 'یادگیری مشارکتی', 'نمایشی/آزمایشی', 'مطالعه‌ی موردی', 'کارگاهی', 'بازی آموزشی'];
export const TECHNIQUE_OPTIONS = ['طوفان فکری', 'نقشه‌ی مفهومی', 'گروه‌بندی', 'جیگساو', 'کارت‌های مرور', 'تحلیل تصویر', 'پرسش‌گری', 'خلاصه‌نویسی', 'مسابقه‌ی کلاسی'];
export const TOOL_OPTIONS = ['تخته و ماژیک', 'پروژکتور', 'کتاب درسی', 'برگه‌ی کار', 'فیلم/انیمیشن', 'لپ‌تاپ', 'کارت‌های تصویری', 'وسایل آزمایشگاهی', 'نقشه/پوستر', 'بلندگو'];

export const newScenarioStep = (): LessonScenarioStep => ({
  id: `st-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  description: '',
  minutes: '',
  teacherActivity: '',
  studentActivity: '',
});

export const emptyLessonPlan = (teacherId: string, init: Partial<LessonPlan> = {}): LessonPlan => ({
  id: `lp-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  teacherId,
  classId: '',
  date: getTodayShamsi().formattedDate,
  academicYear: getActiveAcademicYear(),
  status: 'draft',
  subject: '',
  mainTopic: '',
  subTopic: '',
  source: '',
  grade: '',
  className: '',
  studentCount: '',
  scope: '',
  methodCriteria: [],
  methods: [],
  techniques: [],
  tools: [],
  objectives: { psychomotor: [''], affective: [''], cognitive: [''] },
  scenario: [newScenarioStep()],
  evaluation: { initial: '', process: '', final: '' },
  checklist: { motivation: '', prior: '', alignment: '', summary: '', differences: '', engagement: '', homework: '' },
  reflection: '',
  review: null,
  ...init,
});

/** پر کردن مقادیر خالی/ناقص طرح‌های قدیمی (سازگاری با داده‌ی ذخیره‌شده) */
export const normalizeLessonPlan = (p: LessonPlan): LessonPlan => ({
  ...emptyLessonPlan(p.teacherId),
  ...p,
  objectives: { psychomotor: p.objectives?.psychomotor?.length ? p.objectives.psychomotor : [''], affective: p.objectives?.affective?.length ? p.objectives.affective : [''], cognitive: p.objectives?.cognitive?.length ? p.objectives.cognitive : [''] },
  scenario: p.scenario?.length ? p.scenario : [newScenarioStep()],
  evaluation: { initial: '', process: '', final: '', ...(p.evaluation || {}) },
  checklist: { motivation: '', prior: '', alignment: '', summary: '', differences: '', engagement: '', homework: '', ...(p.checklist || {}) },
});

export const totalMinutes = (steps: LessonScenarioStep[]): number =>
  steps.reduce((n, s) => n + (Number(toEnglishDigits(s.minutes || '0').replace(/[^0-9]/g, '')) || 0), 0);

export const STATUS_LABEL: Record<LessonPlan['status'], string> = { draft: 'پیش‌نویس', submitted: 'در انتظار بررسی', approved: 'تأییدشده' };

/** نام ماه شمسی از تاریخ «۱۴۰۵/۰۸/۰۵» (۱ تا ۱۲) */
export const monthOfDate = (date: string): number => Number(toEnglishDigits(date || '').split('/')[1]) || 0;
