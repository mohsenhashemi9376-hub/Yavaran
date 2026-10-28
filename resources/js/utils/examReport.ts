import {
  ComprehensiveExamRecord,
  EXAM_SUBJECTS,
  ExamSubjectKey,
  MONTHLY_EVALUATION_PERIODS,
  MonthlyContinuousKey,
  SchoolClass,
  Student,
} from '../types';
import { compareByLastName } from './morningAttendance';

/** ماه‌های ثبت آزمون جامع (همان ماه‌های دفتر نمرات) */
/** ماه‌های مستمر دفتر نمرات */
export const FINAL_KEYS: MonthlyContinuousKey[] = ['term1Final', 'term2Final'];
export const isFinalKey = (k: string): boolean => (FINAL_KEYS as string[]).includes(k);
/** همه‌ی ستون‌های نمره به ترتیب: مستمر هر ماه و دو پایانی (monthName = عنوان ستون) */
export const SCORE_COLUMNS = MONTHLY_EVALUATION_PERIODS;
/** فقط مستمرهای ماهانه (هفت ماه)؛ میانگین مستمر از همین‌ها حساب می‌شود */
export const CONTINUOUS_MONTHS = MONTHLY_EVALUATION_PERIODS.filter((p) => !isFinalKey(p.key));
/** ماه‌هایی که آزمون جامع برگزار می‌شود */
export const EXAM_MONTH_KEYS: MonthlyContinuousKey[] = ['mehrContinuous', 'abanContinuous', 'azarContinuous', 'bahmanContinuous', 'farvardinContinuous', 'ordibeheshtContinuous'];
export const EXAM_MONTHS = CONTINUOUS_MONTHS.filter((p) => EXAM_MONTH_KEYS.includes(p.key));
export type ExamMonth = MonthlyContinuousKey | 'legacy' | 'all';
export const examMonthLabel = (m: ExamMonth): string =>
  m === 'legacy' ? 'ثبت قبلی (بدون ماه)' : m === 'all' ? 'میانگین همه‌ی آزمون‌ها' : SCORE_COLUMNS.find((x) => x.key === m)?.monthName ?? m;

/** حد «ضعیف» (۶۰٪ نمره) روی مقیاس ۲۰ برای فهرست دانش‌آموزان ضعیف */
export const EXAM_WEAK_BELOW = 12;
/** حد «ممتاز» (۸۰٪ نمره) روی مقیاس ۲۰ */
export const EXAM_EXCELLENT_FROM = 16;

export type ExamScores = Record<string, Partial<Record<ExamSubjectKey, number>>>;

const num = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
export const mean = (xs: number[]): number | undefined => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
export const round2 = (n: number) => Math.round(n * 100) / 100;

const hasAny = (scores?: ExamScores) => Boolean(scores && Object.values(scores).some((s) => Object.values(s).some(num)));

/** نمرات یک ماه (یا «legacy») از رکورد کلاس */
export function examScoresOf(record: ComprehensiveExamRecord | undefined, month: Exclude<ExamMonth, 'all'>): ExamScores {
  if (!record) return {};
  return (month === 'legacy' ? record.scores : record.monthly?.[month]) || {};
}

/** بارم پیش‌فرض هر درس آزمون جامع */
export const EXAM_DEFAULT_MAX = 20;

/** بارم (نمره‌ی کل) یک درس در یک ماه؛ بدون تنظیم معاونت ۲۰ است */
export function examMaxOf(record: ComprehensiveExamRecord | undefined, month: ExamMonth, subject: ExamSubjectKey): number {
  if (!month || month === 'all' || month === 'legacy') return EXAM_DEFAULT_MAX;
  const v = record?.monthlyMax?.[month]?.[subject];
  return typeof v === 'number' && v > 0 ? v : EXAM_DEFAULT_MAX;
}

/** نمره‌ی خام را به مقیاس ۲۰ می‌برد تا معدل و تحلیل‌ها بین دروس با بارم متفاوت یکسان بماند */
export const examNormalize = (score: number, max: number): number => (max === EXAM_DEFAULT_MAX ? score : round2((score / max) * EXAM_DEFAULT_MAX));

/** آیا دانش‌آموز در آزمون جامع این ماه غایب ثبت شده است؟ */
export const isExamAbsent = (record: ComprehensiveExamRecord | undefined, studentId: string, month: ExamMonth): boolean =>
  month !== 'all' && month !== 'legacy' && Boolean(record?.monthlyAbsent?.[month]?.[studentId]);

/** ماه‌هایی که دست‌کم یک نمره دارند، به ترتیب سال (سوابق بدون ماه آخر) */
export function examMonthsWithData(record?: ComprehensiveExamRecord): Exclude<ExamMonth, 'all'>[] {
  if (!record) return [];
  const months: Exclude<ExamMonth, 'all'>[] = EXAM_MONTHS.map((m) => m.key).filter((k) => hasAny(record.monthly?.[k]));
  if (hasAny(record.scores)) months.push('legacy');
  return months;
}

export const defaultExamMonth = (record?: ComprehensiveExamRecord): Exclude<ExamMonth, 'all'> => {
  const months = examMonthsWithData(record).filter((m) => m !== 'legacy');
  return months.length ? months[months.length - 1] : 'mehrContinuous';
};

const allSubjectKeys = EXAM_SUBJECTS.map((x) => x.key);

/** دروس فعال یک ماه؛ بدون ماه (یا «همه»): اجتماع دروس فعالِ ماه‌های دارای نمره */
export const activeExamSubjects = (record?: ComprehensiveExamRecord, month?: ExamMonth) => {
  const fallback = record?.activeSubjects?.length ? record.activeSubjects : allSubjectKeys;
  let keys: ExamSubjectKey[];
  if (month && month !== 'all' && month !== 'legacy') keys = record?.monthlyActive?.[month] ?? fallback;
  else if (month === 'all') {
    const months = examMonthsWithData(record).filter((m) => m !== 'legacy') as MonthlyContinuousKey[];
    const union = new Set<ExamSubjectKey>(months.flatMap((m) => record?.monthlyActive?.[m] ?? fallback));
    keys = union.size && !examMonthsWithData(record).includes('legacy') ? Array.from(union) : fallback.concat(Array.from(union));
  } else keys = fallback;
  return EXAM_SUBJECTS.filter((s) => keys.includes(s.key));
};

/** نمره‌ی یک دانش‌آموز در یک درس؛ برای «همه»، میانگین ماه‌هایی که نمره دارد */
export function examSubjectScore(record: ComprehensiveExamRecord | undefined, studentId: string, subject: ExamSubjectKey, month: ExamMonth): number | undefined {
  const scaled = (m: Exclude<ExamMonth, 'all'>) => {
    const v = examScoresOf(record, m)[studentId]?.[subject];
    return num(v) ? examNormalize(v, examMaxOf(record, m, subject)) : undefined;
  };
  if (month !== 'all') return scaled(month);
  return mean(examMonthsWithData(record).map(scaled).filter(num));
}

/** معدل آزمون جامع یک دانش‌آموز (ماه مشخص یا میانگین همه‌ی ماه‌ها) به‌همراه نمره‌ی هر درس؛ معدل کلاس و دانش‌آموز بر مبنای آزمون جامع حساب می‌شود، نه مستمر */
export function studentExamSummary(record: ComprehensiveExamRecord | undefined, studentId: string, month: ExamMonth): { gpa?: number; scores: Partial<Record<ExamSubjectKey, number>> } {
  const scores: Partial<Record<ExamSubjectKey, number>> = {};
  activeExamSubjects(record, month).forEach((s) => {
    const v = examSubjectScore(record, studentId, s.key, month);
    if (v !== undefined) scores[s.key] = v;
  });
  return { gpa: mean(Object.values(scores).filter(num)), scores };
}

export interface ExamRow {
  student: Student;
  scores: Partial<Record<ExamSubjectKey, number>>;
  avg?: number;
  rank?: number;
}

export interface ClassExamAnalysis {
  subjects: { key: ExamSubjectKey; label: string }[];
  rows: ExamRow[];
  subjectAverages: Record<string, number | undefined>;
  classAverage?: number;
  /** برترین‌ها (در صورت برابری چند نفر) */
  top: ExamRow[];
  weak: ExamRow[];
  hasData: boolean;
}

export function analyzeClassExam(record: ComprehensiveExamRecord | undefined, classStudents: Student[], month: ExamMonth): ClassExamAnalysis {
  const subjects = activeExamSubjects(record, month);
  const rows: ExamRow[] = classStudents.slice().sort(compareByLastName).map((student) => {
    const scores: ExamRow['scores'] = {};
    subjects.forEach((s) => {
      const v = examSubjectScore(record, student.id, s.key, month);
      if (v !== undefined) scores[s.key] = v;
    });
    return { student, scores, avg: mean(Object.values(scores).filter(num)) };
  });
  const ranked = rows.filter((r) => r.avg !== undefined).sort((a, b) => (b.avg as number) - (a.avg as number));
  ranked.forEach((r, i) => { r.rank = i > 0 && ranked[i - 1].avg === r.avg ? ranked[i - 1].rank : i + 1; });
  const subjectAverages: ClassExamAnalysis['subjectAverages'] = {};
  subjects.forEach((s) => { subjectAverages[s.key] = mean(rows.map((r) => r.scores[s.key]).filter(num)); });
  const top = ranked.length ? ranked.filter((r) => r.avg === ranked[0].avg) : [];
  return {
    subjects,
    rows,
    subjectAverages,
    classAverage: mean(ranked.map((r) => r.avg as number)),
    top,
    weak: ranked.filter((r) => (r.avg as number) < EXAM_WEAK_BELOW).reverse(),
    hasData: ranked.length > 0,
  };
}

/** معدل آزمون جامع یک کلاس در کل سال (برای نمایش در فهرست کلاس‌ها) */
export function classExamAverage(record: ComprehensiveExamRecord | undefined, cls: SchoolClass, students: Student[]): number | undefined {
  return analyzeClassExam(record, students.filter((s) => s.classId === cls.id), 'all').classAverage;
}

export interface ExamTimelinePoint {
  month: Exclude<ExamMonth, 'all'>;
  label: string;
  avg?: number;
  classAvg?: number;
  bySubject: Partial<Record<ExamSubjectKey, number>>;
}

/** روند ماهانه‌ی آزمون جامع یک دانش‌آموز، همراه با میانگین کلاس برای مقایسه */
export function studentExamTimeline(record: ComprehensiveExamRecord | undefined, classStudents: Student[], studentId: string): ExamTimelinePoint[] {
  return examMonthsWithData(record)
    .filter((m) => m !== 'legacy')
    .map((month) => {
      const subjects = activeExamSubjects(record, month);
      const bySubject: ExamTimelinePoint['bySubject'] = {};
      subjects.forEach((s) => {
        const v = examSubjectScore(record, studentId, s.key, month);
        if (v !== undefined) bySubject[s.key] = v;
      });
      const classAvg = analyzeClassExam(record, classStudents, month).classAverage;
      return { month, label: examMonthLabel(month), avg: mean(Object.values(bySubject).filter(num)), classAvg, bySubject };
    })
    .filter((p) => p.avg !== undefined);
}

/** انحراف معیار جامعه؛ نشان می‌دهد نمرات چقدر پراکنده‌اند */
export const stdDev = (xs: number[]): number | undefined => {
  const m = mean(xs);
  return m === undefined ? undefined : Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

/** درصد نمایشی از نمره روی مقیاس ۲۰ */
export const examPercent = (score: number): number => score * 5;
/** نمایش فارسی درصد نمره (ورودی روی مقیاس ۲۰)؛ مثلاً ۱۶ ← «۸۰٪» */
export const faExamPct = (n?: number | null): string =>
  n === undefined || n === null ? '—' : `${String(round2(examPercent(n))).replace('.', '٫').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])}٪`;

/** تعداد نمرات در هر گروه: ممتاز (۱۷ به بالا) / متوسط (۱۰ تا ۱۷) / ضعیف (زیر ۱۰) */
export const bandCounts = (xs: number[]): Record<'excellent' | 'good' | 'weak', number> => ({
  excellent: xs.filter((v) => v >= 17).length,
  good: xs.filter((v) => v >= 10 && v < 17).length,
  weak: xs.filter((v) => v < 10).length,
});
