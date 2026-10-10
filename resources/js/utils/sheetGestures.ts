/**
 * موبایل: برگه‌های پایین‌آمده (مودال‌ها) را می‌توان با کشیدن دستگیرهٔ بالای برگه به پایین بست،
 * مثل اپلیکیشن‌های بومی. فقط وقتی کشیدن از ۵۶ پیکسل بالای برگه شروع شود فعال است تا اسکرول داخل برگه مختل نشود.
 */
const SHEET = '.fixed.inset-0.items-center.justify-center > div, .fixed.inset-0.items-end.justify-center > div';
const GRAB_ZONE = 56;
const CLOSE_DISTANCE = 110;

const isMobile = () => window.matchMedia('(max-width: 767.98px)').matches;

export function enableSheetGestures(): void {
  if (typeof window === 'undefined') return;
  let sheet: HTMLElement | null = null;
  let startY = 0;
  let startT = 0;
  let dy = 0;

  const close = (el: HTMLElement) => {
    const overlay = el.parentElement;
    if (!overlay) return;
    el.style.transition = 'transform 0.2s ease-out';
    el.style.transform = 'translateY(100%)';
    window.setTimeout(() => {
      // مودال‌های باز و بسته‌شونده با کلیک یا فشردن بیرون از برگه
      ['mousedown', 'mouseup', 'click'].forEach((type) => overlay.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })));
      // اگر مودال بستنی نبود، برگه به جای اول برمی‌گردد
      window.setTimeout(() => {
        if (el.isConnected) {
          el.style.transition = 'transform 0.2s ease-out';
          el.style.transform = '';
        }
      }, 250);
    }, 200);
  };

  document.addEventListener('touchstart', (e) => {
    if (!isMobile() || e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    const el = target?.closest?.(SHEET) as HTMLElement | null;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (e.touches[0].clientY - top > GRAB_ZONE) return;
    sheet = el;
    startY = e.touches[0].clientY;
    startT = Date.now();
    dy = 0;
    el.style.transition = 'none';
    el.style.animation = 'none'; // انیمیشن ورود، transform دستی را بازنویسی نکند
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!sheet) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  const end = () => {
    if (!sheet) return;
    const el = sheet;
    sheet = null;
    const fast = dy / Math.max(1, Date.now() - startT) > 0.6;
    if (dy > CLOSE_DISTANCE || (fast && dy > 40)) {
      close(el);
    } else {
      el.style.transition = 'transform 0.2s ease-out';
      el.style.transform = '';
    }
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}

/** لرزش کوتاه (فقط اندروید/مرورگرهای پشتیبان) برای حس لمسی هنگام زدن تب‌ها */
export function tapFeedback(ms = 8): void {
  try { navigator.vibrate?.(ms); } catch { /* پشتیبانی نمی‌شود */ }
}
