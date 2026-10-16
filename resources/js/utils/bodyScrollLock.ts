/**
 * قفل اسکرول صفحه‌ی پس‌زمینه تا زمانی که مودال یا باتم‌شیت باز است.
 * به‌جای تغییر تک‌تک مودال‌ها، وجود لایه‌ی تمام‌صفحه (fixed inset-0) یا aria-modal را در DOM رصد می‌کند؛
 * پس مودال‌های تودرتو هم درست کار می‌کنند و قفل فقط با بسته‌شدن آخرین لایه آزاد می‌شود.
 * از روش position:fixed استفاده می‌شود چون در iOS Safari تنها راه مطمئن است؛ موقعیت اسکرول بعد از بسته‌شدن برمی‌گردد.
 */
const OVERLAY = '.fixed.inset-0:not(.bg-transparent), [aria-modal="true"]';

let locked = false;
let savedY = 0;
let raf = 0;

const lock = () => {
  const { body, documentElement: html } = document;
  savedY = window.scrollY;
  const scrollbar = window.innerWidth - html.clientWidth;
  body.style.position = 'fixed';
  body.style.top = `-${savedY}px`;
  body.style.insetInline = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  if (scrollbar > 0) body.style.paddingInlineEnd = `${scrollbar}px`;
  html.style.overscrollBehavior = 'none';
  locked = true;
};

const unlock = () => {
  const { body, documentElement: html } = document;
  body.style.position = '';
  body.style.top = '';
  body.style.insetInline = '';
  body.style.width = '';
  body.style.overflow = '';
  body.style.paddingInlineEnd = '';
  html.style.overscrollBehavior = '';
  window.scrollTo(0, savedY);
  locked = false;
};

const sync = () => {
  raf = 0;
  const open = !!document.querySelector(OVERLAY);
  if (open && !locked) lock();
  else if (!open && locked) unlock();
};

export function enableBodyScrollLock(): void {
  if (typeof document === 'undefined') return;
  new MutationObserver(() => {
    if (!raf) raf = requestAnimationFrame(sync);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-modal'] });
  sync();
}
