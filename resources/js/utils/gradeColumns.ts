import { MonthlyPeriodInfo } from '../types';
import { isFinalKey } from './examReport';

/** رنگ سربرگ ستون نمره: مستمرهای نیمسال اول (کهربایی)، نیمسال دوم (سبز) و دو پایانی (بنفش‌آبی) — یکسان در ثبت نمره و کارنامه‌ی دانش‌آموز */
export const columnTone = (p: Pick<MonthlyPeriodInfo, 'key' | 'term'>): string =>
  isFinalKey(p.key) ? 'bg-indigo-100/80 text-indigo-900' : p.term === 1 ? 'bg-amber-50/80' : 'bg-emerald-50/80';

/** میانگین مستمر: فقط ماه‌های مستمر؛ دو پایانی در میانگین نمی‌آیند */
export const continuousAverage = (entries: { key: string; value: number | undefined }[]): number | undefined => {
  const nums = entries.filter((e) => !isFinalKey(e.key) && typeof e.value === 'number' && !Number.isNaN(e.value)).map((e) => e.value as number);
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : undefined;
};
