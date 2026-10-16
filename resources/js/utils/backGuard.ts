/**
 * دکمه‌ی برگشت گوشی (موبایل و PWA):
 *  ۱) اگر مودال/باتم‌شیتی باز باشد، فقط همان بسته می‌شود.
 *  ۲) اگر کاربر داخل یک بخش فرعی باشد، به «داشبورد» برمی‌گردد.
 *  ۳) در داشبورد اولین فشردن فقط پیام می‌دهد و فقط اگر ظرف ۲ ثانیه دوباره فشرده شود، خروج مجاز است.
 *
 * یک ورودی نگهبان (guard) روی پشته‌ی history بالای ورودی اصلی نگه داشته می‌شود؛ هر بار که برگشت آن را مصرف کند دوباره گذاشته می‌شود.
 * برنامه‌ی React روتر مبتنی بر history ندارد، پس تداخلی پیش نمی‌آید. وابسته به Alpine.js نیست و خودش را در main.tsx نصب می‌کند.
 */
const OVERLAY = '.fixed.inset-0:not(.bg-transparent), [aria-modal="true"]';
const EXIT_WINDOW_MS = 2000;
const TOAST_ID = 'yv-back-toast';

let armed = false;
let exiting = false;
let lastBackAt = 0;
let toastTimer = 0;

const isTouchOrStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  window.matchMedia('(pointer: coarse)').matches ||
  window.matchMedia('(max-width: 767.98px)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

const topOverlay = (): HTMLElement | null => {
  const all = document.querySelectorAll<HTMLElement>(OVERLAY);
  return all.length ? all[all.length - 1] : null;
};

const closeOverlay = (el: HTMLElement) => {
  const esc = (target: EventTarget) =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
  esc(document);
  esc(window);
  // مودال‌هایی که Esc را نمی‌شنوند: کلیک روی پس‌زمینه (مثل بستن با لمس بیرون از برگه)
  window.setTimeout(() => {
    if (!el.isConnected) return;
    ['mousedown', 'mouseup', 'click'].forEach((type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })));
  }, 120);
};

const showToast = (text: string) => {
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOAST_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('dir', 'rtl');
    el.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(5.5rem + env(safe-area-inset-bottom,0px));z-index:2147483000;' +
      'background:rgba(15,23,42,.92);color:#fff;padding:.6rem 1.1rem;border-radius:9999px;font:700 .8rem/1.4 Vazirmatn,system-ui,sans-serif;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none;max-width:90vw;text-align:center;transition:opacity .2s;';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { if (el) el.style.opacity = '0'; }, EXIT_WINDOW_MS);
};

/** اگر در بخش فرعی هستیم، ناوبری پایین موبایل (اولین مورد = داشبورد) را به داشبورد برمی‌گرداند */
const goHomeIfElsewhere = (): boolean => {
  const buttons = document.querySelectorAll<HTMLButtonElement>('nav.yv-bottom-nav > button');
  const home = buttons[0];
  if (!home || home.getClientRects().length === 0) return false;
  if (home.getAttribute('aria-current') === 'page') return false;
  home.click();
  return true;
};

const arm = () => {
  if (armed) return;
  history.pushState({ yvGuard: true }, '');
  armed = true;
};

const onPopState = () => {
  if (exiting) return;
  armed = false;

  const overlay = topOverlay();
  if (overlay) {
    closeOverlay(overlay);
    arm();
    return;
  }
  if (goHomeIfElsewhere()) {
    arm();
    return;
  }

  const now = Date.now();
  if (now - lastBackAt <= EXIT_WINDOW_MS) {
    // دومین فشردن در بازه‌ی مجاز: خروج
    exiting = true;
    history.back();
    return;
  }
  lastBackAt = now;
  showToast('برای خروج، دوباره دکمه بازگشت را بزنید');
  arm();
};

export function enableBackGuard(): void {
  if (typeof window === 'undefined' || !isTouchOrStandalone()) return;
  window.addEventListener('popstate', onPopState);
  // مرورگرها ورودی‌هایی را که بدون تعامل کاربر اضافه شده‌اند در برگشت رد می‌کنند؛ پس بعد از اولین لمس نصب می‌شود
  const first = () => {
    arm();
    window.removeEventListener('pointerdown', first, true);
    window.removeEventListener('keydown', first, true);
  };
  window.addEventListener('pointerdown', first, true);
  window.addEventListener('keydown', first, true);
}
