import { LessonPlan, LessonScenarioStep } from '../types';
import { TEACHING_METHOD_NAMES } from './teachingMethods';
import { getActiveAcademicYear, getTodayShamsi, toEnglishDigits } from './persianDate';

/** ملاک‌های انتخاب روش تدریس در فرم سنتی مدرسه */
export const METHOD_CRITERIA = ['موضوع', 'مخاطب', 'امکانات', 'روش تربیتی'];
export const METHOD_OPTIONS = TEACHING_METHOD_NAMES;
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

/** مدت کل کلاس (دقیقه) برای ماشین‌حساب زمان سناریو */
export const CLASS_MINUTES = 75;

/** افعال حرکتی هرم بلوم برای هر حوزه‌ی هدف */
export const BLOOM_VERBS = {
  cognitive: ['تعریف کند', 'توضیح دهد', 'مثال بزند', 'مقایسه کند', 'طبقه‌بندی کند', 'تحلیل کند', 'ارزیابی کند', 'طراحی کند'],
  affective: ['بپذیرد', 'علاقه نشان دهد', 'احترام بگذارد', 'همکاری کند', 'قدردانی کند', 'ارزش قائل شود', 'به اشتراک بگذارد'],
  psychomotor: ['اجرا کند', 'رسم کند', 'اندازه بگیرد', 'بسازد', 'به کار ببرد', 'تمرین کند', 'مرتب کند'],
};

/** بانک ایده‌های شروع کلاس (ایجاد انگیزه) */
export const HOOK_IDEAS = [
  'یک شیء نامربوط (مثلاً یک کفش یا یک سنگ) را وارد کلاس کنید و بپرسید: «به نظرتان این چه ربطی به درس امروز دارد؟»',
  'یک صدای عجیب (باران، قدم‌های سنگین، زنگ قدیمی) را پخش کنید و از بچه‌ها بخواهید حدس بزنند و داستانی برایش بسازند.',
  'یک معمای بی‌جواب روی تخته بنویسید و بگویید پاسخ آن تا پایان کلاس پیدا می‌شود.',
  'با یک عکس نیمه‌پنهان یا مبهم شروع کنید و از بچه‌ها بخواهید فقط با سؤال بله/خیر بفهمند چیست.',
  'یک جمله‌ی عجیب و غلط بگویید («امروز خورشید از غرب طلوع کرد!») و بپرسید چه چیزی اشتباه است.',
  'دو گزینه روی تخته بنویسید و کلاس را به «موافق» و «مخالف» تقسیم کنید؛ هر طرف یک دلیل بگوید.',
  'یک کیسه‌ی مرموز با یک شیء داخلش بیاورید و با سه سرنخ از بچه‌ها بخواهید آن را حدس بزنند.',
  'یک عدد یا کلمه‌ی کلیدی بزرگ روی تخته بنویسید و بپرسید: «امروز این عدد/کلمه چه نقشی دارد؟»',
  'یک خبر یا اتفاق تازه از زندگی روزمره تعریف کنید که به مفهوم درس مربوط است.',
  'یک سؤال «اگر … چه می‌شد؟» بپرسید (مثلاً: اگر گرانش نبود…) و چند پاسخ جالب بشنوید.',
  'چند ثانیه سکوت کنید، یک کلمه‌ی درس را روی تخته بنویسید و بگذارید بچه‌ها بی‌صدا ذهن‌شان را حرکت دهند.',
  'یک چالش ۶۰ ثانیه‌ای بدهید: «در یک دقیقه چند مثال از … پیدا می‌کنید؟»',
];

/** راهکارهای اختلاف سطح */
export const DIFFERENTIATION = {
  fast: ['حل معمای اکسترا', 'طراحی سؤال برای بقیه‌ی کلاس', 'نقش معلم‌یار برای هم‌گروهی', 'تمرین چالشی سطح بالاتر', 'پروژه‌ی تکمیلی کوتاه'],
  needs: ['همتاآموزی با دانش‌آموز مسلط', 'فلش‌کارت مرور', 'تمرین پلکانی (آسان به سخت)', 'نمونه‌ی حل‌شده‌ی گام‌به‌گام', 'توضیح تکمیلی فردی در زنگ تفریح', 'استفاده از تصویر و مدل ملموس'],
};

/** چالش‌های پرتکرار تدریس و پیشنهاد جلسه‌ی بعد */
export const REFLECTION_CHALLENGES: { tag: string; advice: string }[] = [
  { tag: 'زمان کم آوردم', advice: 'استفاده از کلاس معکوس: بخش توضیحی را به‌صورت متن یا فیلم کوتاه در خانه بدهید و زمان کلاس را به تمرین و فعالیت اختصاص دهید. زمان هر گام را هم کوتاه‌تر برنامه‌ریزی کنید.' },
  { tag: 'بچه‌ها خسته شدند', advice: 'هر ۱۵ تا ۲۰ دقیقه فعالیت را عوض کنید (بحث دو‌نفره، حرکت کوتاه، پرسش‌ و پاسخ سریع) و یک گام فعال یا بازی کوتاه در میانه‌ی کلاس بگذارید.' },
  { tag: 'مشارکت پایین بود', advice: 'از فعالیت دو‌نفره (فکر کن، جفت شو، بگو) و برگه‌ی پاسخ گروهی استفاده کنید؛ سؤال‌ها را باز و بدون ترس از اشتباه بپرسید و مشارکت را تشویق کنید.' },
  { tag: 'سطح بچه‌ها متفاوت بود', advice: 'تمرین‌ها را در سه سطح (پایه، متوسط، چالشی) آماده کنید و از همتاآموزی بهره بگیرید.' },
  { tag: 'نظم کلاس به هم خورد', advice: 'قواعد فعالیت‌ها و زمان هر گام را از ابتدا شفاف اعلام کنید و برای انتقال بین گام‌ها یک علامت ثابت (مثلاً شمارش معکوس) داشته باشید.' },
  { tag: 'وسایل آماده نبود', advice: 'یک فهرست وسایل را از شب قبل چک کنید و برای هر وسیله جایگزین ساده‌ای (تخته، کارت دست‌ساز) در نظر بگیرید.' },
];
