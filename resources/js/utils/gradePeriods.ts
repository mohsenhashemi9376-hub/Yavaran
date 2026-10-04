import { GradePeriod, MONTHLY_EVALUATION_PERIODS, MonthlyContinuousKey } from '../types';

/** عنوان فارسی هر بازه ثبت نمره */
export const GRADE_PERIOD_NAMES: Record<MonthlyContinuousKey, string> = {
  mehrContinuous: 'مستمر مهر',
  abanContinuous: 'مستمر آبان',
  azarContinuous: 'مستمر آذر',
  term1Continuous: 'مستمر دی',
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
      deadline: rec?.deadline,
    };
  });
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
