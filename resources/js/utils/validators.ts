import { getTodayShamsi, toEnglishDigits } from './persianDate';
import { normalizeShamsi } from './schoolCalendar';

const PLACEHOLDER_NATIONAL_IDS = new Set(['0000000000']);

/** کد ملی ساختگی که سامانه پیش‌تر خودکار می‌ساخت (۰۰۰۰۰۰۰۰۰۰ یا «۰۰» + کد ۸ رقمی تصادفی که همان کد سناد ساختگی بود) ← خالی حساب می‌شود */
export const realNationalId = (nationalId?: string, studentCode?: string): string => {
  const v = toEnglishDigits((nationalId || '').trim());
  if (!v || PLACEHOLDER_NATIONAL_IDS.has(v)) return '';
  const code = toEnglishDigits((studentCode || '').trim());
  return /^\d{8}$/.test(code) && v === `00${code}` ? '' : (nationalId || '').trim();
};

/** کد ملی هیچ محدودیتی ندارد (تعداد رقم و رقم کنترل بررسی نمی‌شود)؛ تابع برای سازگاری با فراخوانی‌های فعلی باقی مانده است */
export const nationalIdError = (_value: string): string | null => null;

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
