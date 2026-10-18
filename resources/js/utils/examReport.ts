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
export const EXAM_MONTHS = MONTHLY_EVALUATION_PERIODS.filter((p) => !['term1Final', 'term2Continuous'].includes(p.key));
export type ExamMonth = MonthlyContinuousKey | 'legacy' | 'all';
export const examMonthLabel = (m: ExamMonth): string =>
  m === 'legacy' ? 'ثبت قبلی (بدون ماه)' : m === 'all' ? 'میانگین همه‌ی آزمون‌ها' : EXAM_MONTHS.find((x) => x.key === m)?.monthName ?? m;

/** حد «ضعیف» برای فهرست دانش‌آموزان ضعیف */
export const EXAM_WEAK_BELOW = 12;

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

export const activeExamSubjects = (record?: ComprehensiveExamRecord) =>
  EXAM_SUBJECTS.filter((s) => (record?.activeSubjects?.length ? record.activeSubjects : EXAM_SUBJECTS.map((x) => x.key)).includes(s.key));

/** نمره‌ی یک دانش‌آموز در یک درس؛ برای «همه»، میانگین ماه‌هایی که نمره دارد */
export function examSubjectScore(record: ComprehensiveExamRecord | undefined, studentId: string, subject: ExamSubjectKey, month: ExamMonth): number | undefined {
  if (month !== 'all') {
    const v = examScoresOf(record, month)[studentId]?.[subject];
    return num(v) ? v : undefined;
  }
  return mean(examMonthsWithData(record).map((m) => examScoresOf(record, m)[studentId]?.[subject]).filter(num));
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
  const subjects = activeExamSubjects(record);
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
  const subjects = activeExamSubjects(record);
  return examMonthsWithData(record)
    .filter((m) => m !== 'legacy')
    .map((month) => {
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
