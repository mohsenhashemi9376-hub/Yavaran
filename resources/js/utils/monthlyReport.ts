import { StudentAcademicGrade } from '../types';
import { CONTINUOUS_MONTHS, SCORE_COLUMNS, mean, round2 } from './examReport';
import { MonthlyContinuousKey } from '../types';

export type ReportMonth = MonthlyContinuousKey | 'all';

const num = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);

/** نمره‌ی یک درس در ماه (یا پایانی) انتخابی؛ برای «همه»، میانگین مستمر ماه‌های ثبت‌شده */
export function gradeScoreForMonth(g: StudentAcademicGrade, month: ReportMonth): number | undefined {
  if (month !== 'all') return num(g[month]) ? (g[month] as number) : undefined;
  return mean(CONTINUOUS_MONTHS.map((m) => g[m.key]).filter(num));
}

export interface MonthlyRow {
  subjectId: string;
  subjectName: string;
  teacherName?: string;
  months: { key: MonthlyContinuousKey; label: string; score?: number }[];
  /** نمره‌ی ماه انتخابی (یا میانگین ماه‌ها برای «همه») */
  value?: number;
}

/** کارنامه‌ی تفکیکی دروس: نمره‌ی هر ماه جداگانه + نمره‌ی ماه انتخابی */
export function buildMonthlyRows(grades: StudentAcademicGrade[], month: ReportMonth): MonthlyRow[] {
  return grades.map((g) => ({
    subjectId: g.subjectId,
    subjectName: g.subjectName,
    teacherName: g.teacherName,
    months: SCORE_COLUMNS.map((m) => ({ key: m.key, label: m.monthName, score: num(g[m.key]) ? (g[m.key] as number) : undefined })),
    value: gradeScoreForMonth(g, month) === undefined ? undefined : round2(gradeScoreForMonth(g, month) as number),
  }));
}

/** معدل: میانگین نمره‌ی دروس در ستون انتخابی (یا میانگین مستمر) */
export function monthlyGpa(grades: StudentAcademicGrade[], month: ReportMonth): number | undefined {
  const v = mean(grades.map((g) => gradeScoreForMonth(g, month)).filter(num));
  return v === undefined ? undefined : round2(v);
}
