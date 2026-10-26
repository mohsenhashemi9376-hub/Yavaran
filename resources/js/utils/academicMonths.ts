import { getActiveAcademicYear, getAcademicYearStart, getTodayShamsi, PERSIAN_MONTHS } from './persianDate';

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
