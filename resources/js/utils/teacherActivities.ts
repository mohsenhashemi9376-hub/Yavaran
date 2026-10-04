import { getActiveAcademicYear, getAcademicYearStart, getTodayShamsi, PERSIAN_MONTHS, toEnglishDigits, toPersianDigits } from './persianDate';

/** ماه‌های سال تحصیلی به ترتیب مهر … شهریور؛ سال هر ماه از سال شروع تحصیلی محاسبه می‌شود */
export function academicMonths(): { month: number; year: number; label: string; key: string }[] {
  const start = getAcademicYearStart(getActiveAcademicYear());
  return [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6].map((m) => {
    const year = m >= 7 ? start : start + 1;
    return { month: m, year, label: PERSIAN_MONTHS[m - 1], key: `${year}/${String(m).padStart(2, '0')}` };
  });
}

/** ماه جاری به‌صورت کلید «1405/07» */
export function currentMonthKey(): string {
  const t = getTodayShamsi();
  return `${t.year}/${String(t.month).padStart(2, '0')}`;
}

/** کلید ماه «1405/07» از تاریخ «1405/07/12» (ارقام فارسی هم پذیرفته می‌شود) */
export function monthKeyOf(date: string): string {
  return toEnglishDigits(date).split('/').slice(0, 2).map((p, i) => (i === 1 ? p.padStart(2, '0') : p)).join('/');
}

/** تبدیل ورودی کاربر به ساعت اعشاری؛ null برای ورودی نامعتبر */
export function parseHours(raw: string): number | null {
  const n = Number(toEnglishDigits(raw).replace(/[٫,،]/g, '.').trim());
  if (!Number.isFinite(n) || n <= 0 || n > 24) return null;
  return Math.round(n * 100) / 100;
}

/** «۱۸٫۵» (اعداد فارسی با ممیز فارسی) */
export function formatHours(h: number): string {
  return toPersianDigits(String(Math.round(h * 100) / 100)).replace('.', '٫');
}
