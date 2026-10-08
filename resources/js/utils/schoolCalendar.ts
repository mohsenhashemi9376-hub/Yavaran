import { SchoolHoliday } from '../types';
import { getTodayShamsi, shamsiStringToDate, toEnglishDigits } from './persianDate';

export type ClosedReason = 'friday' | 'holiday';

/** «۱۴۰۵/۷/۴» ← «1405/07/04» */
export const normalizeShamsi = (date: string): string => {
  const m = toEnglishDigits((date || '').trim()).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  return m ? `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}` : toEnglishDigits((date || '').trim());
};

export const isFridayShamsi = (date: string): boolean => {
  const n = normalizeShamsi(date);
  return /^\d{4}\/\d{2}\/\d{2}$/.test(n) && shamsiStringToDate(n).getDay() === 5;
};

/** جمعه یا تعطیلی اعلام‌شده؛ null = روز درسی */
export const closedReasonOf = (date: string, holidays: Pick<SchoolHoliday, 'date'>[]): ClosedReason | null => {
  const n = normalizeShamsi(date);
  if (isFridayShamsi(n)) return 'friday';
  return holidays.some((h) => normalizeShamsi(h.date) === n) ? 'holiday' : null;
};

export const closedReasonMessage = (reason: ClosedReason | null, title?: string | null): string =>
  reason === 'friday'
    ? 'جمعه روز درسی نیست؛ حضور و غیاب امروز بسته است.'
    : reason === 'holiday'
      ? `امروز تعطیل اعلام شده است${title ? ` (${title})` : ''}؛ حضور و غیاب بسته است و در محاسبات نمی‌آید.`
      : '';

export const todayShamsi = (): string => getTodayShamsi().formattedDate;
