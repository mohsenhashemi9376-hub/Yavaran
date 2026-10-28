// ابزارهای مشترک صفحه‌های Blade + Alpine.js (CSRF/XSRF، درخواست JSON، ارقام فارسی)
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const toFa = (v) => String(v).replace(/\d/g, (d) => FA_DIGITS[d]);

const readXsrf = () => {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};

const FA = /[\u0600-\u06FF]/;

const statusMessage = (status) => {
  if (status === 403) return 'شما مجوز انجام این کار را ندارید.';
  if (status === 429) return 'تعداد درخواست‌ها زیاد است؛ لحظاتی بعد دوباره تلاش کنید.';
  if (status >= 500) return 'خطای سرور رخ داد. چند لحظه بعد دوباره تلاش کنید.';
  return 'خطا در ارتباط با سرور.';
};

export const request = async (url, options = {}) => {
  let res;
  try {
    res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': readXsrf(),
    },
  });
  } catch {
    throw new Error('ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.');
  }
  if (res.status === 401 || res.status === 419) {
    window.location.assign('/');
    throw new Error('auth');
  }
  const body = await res.json().catch(() => ({}));
  // پیام‌های انگلیسی پیش‌فرض فریم‌ورک (مثل «Server Error») هرگز نمایش داده نمی‌شوند
  if (!res.ok) throw new Error(typeof body.message === 'string' && FA.test(body.message) && res.status < 500 ? body.message : statusMessage(res.status));
  return body;
};
