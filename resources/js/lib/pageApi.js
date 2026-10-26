// ابزارهای مشترک صفحه‌های Blade + Alpine.js (CSRF/XSRF، درخواست JSON، ارقام فارسی)
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const toFa = (v) => String(v).replace(/\d/g, (d) => FA_DIGITS[d]);

const readXsrf = () => {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};

export const request = async (url, options = {}) => {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': readXsrf(),
    },
  });
  if (res.status === 401 || res.status === 419) {
    window.location.assign('/');
    throw new Error('auth');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || 'خطا در ارتباط با سرور.');
  return body;
};
