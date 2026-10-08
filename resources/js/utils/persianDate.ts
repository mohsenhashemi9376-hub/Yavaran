import * as jalaali from 'jalaali-js';

export const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const PERSIAN_WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
  'شنبه',
];

export const toPersianDigits = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null) return '';
  const str = String(num);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (w) => persianDigits[+w]);
};

export const toEnglishDigits = (str: string): string => {
  if (!str) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(persianDigits[i], 'g'), String(i));
    result = result.replace(new RegExp(arabicDigits[i], 'g'), String(i));
  }
  return result;
};

// ------------------------------------------------------------------
// ساعت رسمی سامانه: همیشه به وقت تهران (UTC+03:30) و هماهنگ با ساعت سرور،
// مستقل از منطقه زمانی یا ساعت نادرست دستگاه کاربر
// ------------------------------------------------------------------
const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;
let serverClockOffsetMs = 0;

/** ثبت ساعت دقیق سرور (میلی‌ثانیه UTC) برای اصلاح ساعت نادرست دستگاه */
export const setServerClock = (serverEpochMs: number): void => {
  if (Number.isFinite(serverEpochMs) && serverEpochMs > 0) {
    serverClockOffsetMs = serverEpochMs - Date.now();
  }
};

/** زمان فعلی به وقت تهران؛ مقادیر getHours/getDate/getDay معادل ساعت رسمی ایران هستند */
export const tehranNow = (): Date => {
  const t = new Date(Date.now() + serverClockOffsetMs + TEHRAN_OFFSET_MS);
  return new Date(
    t.getUTCFullYear(),
    t.getUTCMonth(),
    t.getUTCDate(),
    t.getUTCHours(),
    t.getUTCMinutes(),
    t.getUTCSeconds(),
    t.getUTCMilliseconds()
  );
};

/**
 * سال تحصیلی جاری بر اساس تاریخ امروز (سال تحصیلی از اول مهر آغاز می‌شود)
 * خروجی نمونه: «۱۴۰۵-۱۴۰۶»
 */
export const getCurrentAcademicYear = (): string => {
  const now = tehranNow();
  const j = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const startYear = j.jm >= 7 ? j.jy : j.jy - 1;
  return toPersianDigits(`${startYear}-${startYear + 1}`);
};

let activeAcademicYear = '';

/** ثبت سال تحصیلی تنظیم‌شده در سامانه (توسط کانتکست) */
export const setActiveAcademicYear = (academicYear?: string): void => {
  activeAcademicYear = (academicYear || '').trim();
};

/** سال تحصیلی فعال سامانه (تنظیمات مدرسه یا محاسبه خودکار از تاریخ امروز) */
export const getActiveAcademicYear = (): string => toPersianDigits(activeAcademicYear || getCurrentAcademicYear());

/** سال شروع سال تحصیلی (عدد) از روی متن سال تحصیلی مانند «۱۴۰۵-۱۴۰۶» */
export const getAcademicYearStart = (academicYear?: string): number => {
  const match = toEnglishDigits(academicYear || '').match(/(\d{4})/);
  if (match) return Number(match[1]);
  return Number(toEnglishDigits(getCurrentAcademicYear()).slice(0, 4));
};

/**
 * Returns today's Shamsi date in formatted object
 */
export const getTodayShamsi = () => {
  const now = tehranNow();
  const j = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const dayOfWeekIndex = now.getDay(); // 0 = Sunday
  const dayOfWeek = PERSIAN_WEEKDAYS[dayOfWeekIndex];

  const formattedDate = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
  const displayDate = `${toPersianDigits(j.jd)} ${PERSIAN_MONTHS[j.jm - 1]} ${toPersianDigits(j.jy)}`;

  return {
    year: j.jy,
    month: j.jm,
    day: j.jd,
    monthName: PERSIAN_MONTHS[j.jm - 1],
    dayOfWeek,
    formattedDate,
    displayDate,
  };
};

/** تاریخ شمسی و ساعت فعلی از ساعت رسمی سامانه (وقت تهران، هماهنگ با سرور): «1404/08/20» و «10:30» */
export const getNowShamsi = (): { date: string; time: string } => {
  const now = tehranNow();
  return {
    date: getTodayShamsi().formattedDate,
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
  };
};

/** بررسی تاریخ شمسی «YYYY/MM/DD» و ساعت «HH:MM» واردشده (ارقام فارسی هم پذیرفته می‌شود)؛ مقدار استاندارد یا null */
export const parseShamsiDateTime = (date: string, time: string): { date: string; time: string } | null => {
  const d = toEnglishDigits(date).trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  const t = toEnglishDigits(time).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!d || !t) return null;
  const [y, m, day, h, min] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  if (m < 1 || m > 12 || day < 1 || day > 31 || h > 23 || min > 59) return null;
  return {
    date: `${y}/${String(m).padStart(2, '0')}/${String(day).padStart(2, '0')}`,
    time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
  };
};

/**
 * Format any Shamsi YYYY/MM/DD to full readable Persian string
 */
export const formatShamsiDisplay = (shamsiDate: string): string => {
  if (!shamsiDate) return '';
  const parts = shamsiDate.split('/').map(Number);
  if (parts.length !== 3) return shamsiDate;
  const [y, m, d] = parts;
  const monthName = PERSIAN_MONTHS[m - 1] || '';
  return `${toPersianDigits(d)} ${monthName} ${toPersianDigits(y)}`;
};

/** «شنبه ۱۱ مهر ۱۴۰۵» — روز هفته + تاریخ کامل با اعداد فارسی */
export const formatShamsiWithWeekday = (shamsiDate: string): string => {
  if (!shamsiDate) return '';
  const english = toEnglishDigits(shamsiDate);
  const weekday = getDayOfWeekFromShamsi(english);
  const display = formatShamsiDisplay(english);
  return weekday === 'نامشخص' ? display : `${weekday} ${display}`;
};

/**
 * Get Day of Week from Shamsi date
 */
export const getDayOfWeekFromShamsi = (shamsiDate: string): string => {
  try {
    const parts = shamsiDate.split('/').map(Number);
    if (parts.length !== 3) return 'نامشخص';
    const [jy, jm, jd] = parts;
    const g = jalaali.toGregorian(jy, jm, jd);
    const date = new Date(g.gy, g.gm - 1, g.gd);
    return PERSIAN_WEEKDAYS[date.getDay()];
  } catch {
    return 'نامشخص';
  }
};

/**
 * Parse Shamsi date into components
 */
export const parseShamsi = (shamsiDate: string) => {
  const parts = shamsiDate.split('/').map(Number);
  return {
    year: parts[0] || jalaali.toJalaali(tehranNow()).jy,
    month: parts[1] || 1,
    day: parts[2] || 1,
    monthName: PERSIAN_MONTHS[(parts[1] || 1) - 1],
  };
};

/**
 * Get list of days in a Shamsi month
 */
export const getDaysInShamsiMonth = (year: number, month: number): number => {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return jalaali.isLeapJalaaliYear(year) ? 30 : 29;
};

/**
 * Convert Gregorian Date to Shamsi string YYYY/MM/DD
 */
export const dateToShamsiString = (date: Date): string => {
  const j = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
};

/**
 * Convert Shamsi string YYYY/MM/DD to Gregorian Date object
 */
export const shamsiStringToDate = (shamsiDate: string): Date => {
  try {
    const parts = shamsiDate.split('/').map(Number);
    const jy = parts[0] || jalaali.toJalaali(tehranNow()).jy;
    const jm = parts[1] || 1;
    const jd = parts[2] || 1;
    const g = jalaali.toGregorian(jy, jm, jd);
    return new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0);
  } catch {
    return tehranNow();
  }
};

/**
 * Returns the Shamsi week range (Saturday to Wednesday/Thursday) containing a Shamsi date
 */
const computeWeekBounds = (shamsiDate: string) => {
  const date = shamsiStringToDate(shamsiDate);
  const dayIndex = date.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  // In Iran: Sat is 0, Sun is 1, Mon is 2, Tue is 3, Wed is 4, Thu is 5, Fri is 6
  const diffToSaturday = dayIndex === 6 ? 0 : (dayIndex + 1);

  const saturday = new Date(date);
  saturday.setDate(date.getDate() - diffToSaturday);

  const wednesday = new Date(saturday);
  wednesday.setDate(saturday.getDate() + 4);

  const friday = new Date(saturday);
  friday.setDate(saturday.getDate() + 6);

  return {
    satStr: dateToShamsiString(saturday),
    wedStr: dateToShamsiString(wednesday),
    friStr: dateToShamsiString(friday),
  };
};

export const getShamsiWeekRange = (shamsiDate: string) => {
  const { satStr, wedStr, friStr } = computeWeekBounds(shamsiDate);

  const satParts = parseShamsi(satStr);
  const wedParts = parseShamsi(wedStr);

  const title = satParts.month === wedParts.month 
    ? `${toPersianDigits(satParts.day)} الی ${toPersianDigits(wedParts.day)} ${wedParts.monthName}`
    : `${toPersianDigits(satParts.day)} ${satParts.monthName} الی ${toPersianDigits(wedParts.day)} ${wedParts.monthName}`;

  return {
    startDate: satStr,
    endDate: wedStr,
    endOfWeekDate: friStr,
    title,
    isCurrentWeek: isDateInCurrentWeek(satStr),
  };
};

/**
 * Checks if a given Shamsi date falls within the current Gregorian/Shamsi week
 */
export const isDateInCurrentWeek = (shamsiDate: string): boolean => {
  const today = getTodayShamsi();
  const currentWeek = computeWeekBounds(today.formattedDate);
  return shamsiDate >= currentWeek.satStr && shamsiDate <= currentWeek.friStr;
};

/**
 * Generate recent Shamsi weeks for filter dropdowns
 */
export const getRecentShamsiWeeks = (count: number = 6) => {
  const today = getTodayShamsi();
  const todayDate = shamsiStringToDate(today.formattedDate);
  const weeks = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - (i * 7));
    const shamsiStr = dateToShamsiString(d);
    const range = getShamsiWeekRange(shamsiStr);
    
    // Avoid duplicate weeks
    if (!weeks.some(w => w.startDate === range.startDate)) {
      weeks.push({
        id: `week-${range.startDate}`,
        index: i,
        label: i === 0 ? `هفته جاری (${range.title})` : i === 1 ? `هفته گذشته (${range.title})` : `هفته ${range.title}`,
        ...range
      });
    }
  }

  return weeks;
};
