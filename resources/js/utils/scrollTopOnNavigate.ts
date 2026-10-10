/**
 * هر بار که با لمس یک گزینه، «صفحه»ی جدیدی باز شود (عنوان اصلی صفحه یا تب انتخاب‌شده عوض شود)،
 * صفحه از بالای بالا نمایش داده می‌شود. این مکانیزم برای همهٔ پنل‌ها و نقش‌ها یکسان است و به تک‌تک
 * صفحه‌ها وابسته نیست. باز و بسته شدن مودال‌ها صفحهٔ پشت را جابه‌جا نمی‌کند.
 */
const INTENT_WINDOW_MS = 900;

const text = (el: Element | null) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

/** امضای صفحه‌ی فعلی: عنوان اصلی + تب‌های انتخاب‌شده + شناسه‌ی ریشهٔ نمایش */
function signature(): string {
  const main = document.querySelector('main');
  if (!main) return '';
  const h1 = text(main.querySelector('h1'));
  const h2 = h1 ? '' : text(main.querySelector('h2'));
  const tabs = Array.from(main.querySelectorAll('[role="tab"][aria-selected="true"]')).map(text).join('|');
  const root = main.querySelector('[id$="-dashboard-home"], #admin-main-dashboard-view')?.id || '';
  const nav = Array.from(document.querySelectorAll('nav.yv-bottom-nav [aria-current="page"], aside [aria-current="page"]')).map(text).join('|');
  return `${h1}§${h2}§${tabs}§${root}§${nav}`;
}

const toTop = () => {
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelector('main')?.scrollTo?.({ top: 0 });
  } catch {
    /* محیط بدون window */
  }
};

export function enableScrollTopOnNavigate(): void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  let lastIntent = 0;
  let last = '';
  let pending = false;

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest?.('button, a, [role="tab"], [role="button"], [role="menuitem"]')) lastIntent = Date.now();
  }, true);

  const check = () => {
    pending = false;
    const sig = signature();
    if (sig && last && sig !== last && Date.now() - lastIntent < INTENT_WINDOW_MS) toTop();
    if (sig) last = sig;
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => requestAnimationFrame(check));
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
}
