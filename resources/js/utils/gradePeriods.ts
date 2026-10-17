import { AcademicSubject, GradePeriod, MONTHLY_EVALUATION_PERIODS, MonthlyContinuousKey, SchoolClass, Student, StudentAcademicGrade } from '../types';
import { subjectAppliesToClass } from './courseAssignments';

/** عنوان فارسی هر بازه ثبت نمره */
export const GRADE_PERIOD_NAMES: Record<MonthlyContinuousKey, string> = {
  mehrContinuous: 'مستمر مهر',
  abanContinuous: 'مستمر آبان',
  azarContinuous: 'مستمر آذر',
  term1Continuous: 'نوبت اول (دی)',
  term1Final: 'پایانی نوبت اول (دی)',
  bahmanContinuous: 'مستمر بهمن',
  esfandContinuous: 'مستمر اسفند',
  farvardinContinuous: 'مستمر فروردین',
  ordibeheshtContinuous: 'مستمر اردیبهشت',
  term2Continuous: 'مستمر ترم دوم (خرداد)',
  term2Final: 'پایانی نوبت دوم (خرداد)',
};

/** فهرست کامل بازه‌ها؛ بازه‌ای که هنوز رکوردی ندارد «غیرفعال» فرض می‌شود */
export function buildGradePeriodList(stored: GradePeriod[]): GradePeriod[] {
  const byCode = new Map(stored.map((p) => [p.code || p.id, p]));
  return MONTHLY_EVALUATION_PERIODS.map((p) => {
    const rec = byCode.get(p.key);
    return {
      id: p.key,
      code: p.key,
      name: GRADE_PERIOD_NAMES[p.key],
      isActive: Boolean(rec?.isActive),
      openSubjectIds: Array.isArray(rec?.openSubjectIds) ? rec!.openSubjectIds : null,
      deadline: rec?.deadline,
    };
  });
}

/** آیا ثبت نمره‌ی این بازه برای درس مشخص باز است؟ (بدون درس: آیا برای دست‌کم یک درس باز است) */
export function isPeriodOpenForSubject(period: GradePeriod | undefined, subjectId?: string): boolean {
  if (!period?.isActive) return false;
  if (!Array.isArray(period.openSubjectIds)) return true;
  return subjectId ? period.openSubjectIds.includes(subjectId) : period.openSubjectIds.length > 0;
}

/** شناسه‌ی دروسی که این بازه برایشان باز است */
export function openSubjectIdsOf(period: GradePeriod, subjects: AcademicSubject[]): string[] {
  return subjects.filter((s) => isPeriodOpenForSubject(period, s.id)).map((s) => s.id);
}

export interface PeriodUngradedStats {
  /** نمره‌ی ثبت‌نشده در دروسِ بازشده‌ی این بازه */
  missing: number;
  expected: number;
  /** دروس باز که هنوز دست‌کم یک نمره‌ی ثبت‌نشده دارند: subjectId ← تعداد */
  bySubject: Map<string, number>;
}

/**
 * آمار نمره‌های ثبت‌نشده‌ی یک بازه: فقط دروسی که نمره‌ی این بازه برایشان باز شده است.
 * هر درس برای دانش‌آموزان کلاس‌هایی که درس برایشان تعریف شده انتظار نمره دارد.
 */
export function periodUngradedStats(
  period: GradePeriod,
  subjects: AcademicSubject[],
  classes: SchoolClass[],
  students: Student[],
  grades: StudentAcademicGrade[],
): PeriodUngradedStats {
  const stats: PeriodUngradedStats = { missing: 0, expected: 0, bySubject: new Map() };
  if (!period.isActive) return stats;
  const classOf = new Map(students.map((s) => [s.id, s.classId]));
  for (const sub of subjects) {
    if (!isPeriodOpenForSubject(period, sub.id)) continue;
    const classIds = new Set(classes.filter((c) => !c.isWorkshop && subjectAppliesToClass(sub, c)).map((c) => c.id));
    const expectedIds = new Set(students.filter((s) => classIds.has(s.classId)).map((s) => s.id));
    let recorded = 0;
    for (const g of grades) {
      if (g.subjectId !== sub.id || !expectedIds.has(g.studentId) || !classIds.has(classOf.get(g.studentId) || '')) continue;
      const v = g[period.code];
      if (typeof v === 'number' && !Number.isNaN(v)) recorded++;
    }
    const miss = Math.max(0, expectedIds.size - recorded);
    stats.expected += expectedIds.size;
    stats.missing += miss;
    if (miss > 0) stats.bySubject.set(sub.id, miss);
  }
  return stats;
}

/** رنگ پاستلی کپسول نمره: عالی ۱۸+، خوب ۱۵+، متوسط ۱۲+، نیازمند تلاش زیر ۱۲ */
export function scorePillClass(score: number | undefined | null): string {
  if (score === undefined || score === null || Number.isNaN(score)) {
    return 'bg-slate-100/70 border border-slate-200/70 text-slate-400';
  }
  if (score >= 18) return 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold';
  if (score >= 15) return 'bg-sky-50 text-sky-900 border border-sky-200 font-medium';
  if (score >= 12) return 'bg-amber-50 text-amber-900 border border-amber-200';
  return 'bg-rose-50 text-rose-900 border border-rose-200 font-semibold';
}

export function scoreLabel(score: number): string {
  if (score >= 18) return 'عالی';
  if (score >= 15) return 'خوب';
  if (score >= 12) return 'متوسط';
  return 'نیازمند تلاش';
}

/** رنگ پاستلی اختصاصی هر درس برای هدر ستون / کپسول */
export function subjectPillClass(name: string): string {
  const n = (name || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  if (n.includes('ریاضی')) return 'bg-sky-50 text-sky-800 border border-sky-200/80';
  if (n.includes('علوم')) return 'bg-emerald-50 text-emerald-800 border border-emerald-200/80';
  if (n.includes('فارسی') || n.includes('نگارش')) return 'bg-amber-50 text-amber-800 border border-amber-200/80';
  if (n.includes('انگلیسی') || n.includes('زبان')) return 'bg-violet-50 text-violet-800 border border-violet-200/80';
  if (n.includes('عربی')) return 'bg-teal-50 text-teal-800 border border-teal-200/80';
  if (n.includes('اجتماعی') || n.includes('مطالعات')) return 'bg-orange-50 text-orange-800 border border-orange-200/80';
  if (n.includes('قرآن') || n.includes('پیام') || n.includes('دینی')) return 'bg-indigo-50 text-indigo-800 border border-indigo-200/80';
  return 'bg-slate-50 text-slate-700 border border-slate-200/80';
}
