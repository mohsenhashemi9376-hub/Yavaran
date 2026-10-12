import { getTodayShamsi, toEnglishDigits } from './persianDate';
import { normalizeShamsi } from './schoolCalendar';

const PLACEHOLDER_NATIONAL_IDS = new Set(['0000000000']);

/** کد ملی ۱۰ رقمی با رقم کنترل؛ مقدار خالی یا مقدار پیش‌فرض (۰۰۰۰۰۰۰۰۰۰) بررسی نمی‌شود */
export const nationalIdError = (value: string): string | null => {
  const v = toEnglishDigits((value || '').trim());
  if (!v || PLACEHOLDER_NATIONAL_IDS.has(v)) return null;
  if (!/^\d{10}$/.test(v)) return 'کد ملی باید ۱۰ رقم باشد.';
  if (/^(\d)\1{9}$/.test(v)) return 'کد ملی وارد شده معتبر نیست.';
  const sum = v.slice(0, 9).split('').reduce((s, d, i) => s + Number(d) * (10 - i), 0);
  const r = sum % 11;
  const check = Number(v[9]);
  return (r < 2 ? check === r : check === 11 - r) ? null : 'کد ملی وارد شده معتبر نیست (رقم کنترل اشتباه است).';
};

/** شماره موبایل (۰۹…) یا تلفن ثابت با کد شهر (۱۱ رقم)؛ مقدار خالی مجاز است */
export const phoneError = (value: string): string | null => {
  const v = toEnglishDigits((value || '').trim()).replace(/[\s-]/g, '');
  if (!v) return null;
  if (!/^0\d{10}$/.test(v)) return 'شماره تماس باید ۱۱ رقم و با صفر شروع شود (مثلاً ۰۹۱۲۱۲۳۴۵۶۷).';
  return null;
};

/** تاریخ شمسی آینده (بعد از امروز) */
export const isFutureShamsi = (date: string): boolean => {
  const n = normalizeShamsi(date);
  return /^\d{4}\/\d{2}\/\d{2}$/.test(n) && n > getTodayShamsi().formattedDate;
};

export const FUTURE_DATE_MESSAGE = 'تاریخ آینده قابل ثبت نیست.';
