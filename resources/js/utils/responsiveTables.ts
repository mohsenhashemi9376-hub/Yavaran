/**
 * جدول‌ها در موبایل: به‌جای اسکرول افقی، هر ردیف به یک کارت تبدیل می‌شود و عنوان ستون کنار هر مقدار می‌آید.
 * این‌جا فقط به هر سلول data-label (متن سرستون) اضافه می‌شود؛ چیدمان کارتی با CSS (index.css) انجام می‌شود.
 *
 * جدول‌های خیلی عریض (بیش از ۱۰ ستون)، جدول‌های با سرستون چندردیفه و جدول‌هایی با کلاس `yv-keep-table`
 * همان‌طور اسکرول‌پذیر می‌مانند.
 */
const MAX_COLUMNS = 10;

const textOf = (el: Element) => (el.textContent || '').replace(/\s+/g, ' ').trim();

const process = (table: HTMLTableElement) => {
  if (table.classList.contains('yv-keep-table')) return;
  const headRows = table.tHead ? Array.from(table.tHead.rows) : [];
  if (headRows.length !== 1) return;
  const headers = Array.from(headRows[0].cells);
  if (headers.length === 0 || headers.length > MAX_COLUMNS) return;
  if (headers.some((h) => h.colSpan > 1)) return;

  const labels = headers.map(textOf);
  for (const body of Array.from(table.tBodies)) {
    for (const row of Array.from(body.rows)) {
      const cells = Array.from(row.cells);
      const single = cells.length === 1 && cells[0].colSpan > 1; // ردیف «موردی یافت نشد»
      cells.forEach((cell, i) => {
        const label = single ? '' : labels[i] || '';
        if (cell.getAttribute('data-label') !== label) {
          if (label) cell.setAttribute('data-label', label);
          else cell.removeAttribute('data-label');
        }
      });
    }
  }
  if (!table.hasAttribute('data-stack')) table.setAttribute('data-stack', '');
  // جدول‌های پرستون (مثل ثبت نمرات): مقادیر دو‌به‌دو کنار هم تا کارت‌ها خیلی بلند نشوند
  const dense = headers.length >= 7;
  if (dense !== table.hasAttribute('data-dense')) table.toggleAttribute('data-dense', dense);
};

/**
 * موبایل: هدر صفحه‌های داخلی فشرده می‌شود —
 * دکمه‌های «بازگشت به …» و «منو» فقط آیکن می‌مانند و مسیر «پیشخوان اصلی / …» پنهان می‌شود (CSS در index.css).
 */
const compactHeaders = () => {
  document.querySelectorAll('button').forEach((b) => {
    const txt = textOf(b);
    const sidebar = b.getAttribute('aria-label') === 'باز کردن نوار کناری';
    const back = txt.startsWith('بازگشت به');
    if ((sidebar || back) && !b.hasAttribute('data-compact')) {
      if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', txt || 'بازگشت');
      b.setAttribute('data-compact', '');
    }
  });
  document.querySelectorAll('main div').forEach((d) => {
    if (d.hasAttribute('data-crumb') || d.children.length > 4) return;
    const t = textOf(d);
    if (t.length < 70 && t.startsWith('پیشخوان اصلی')) d.setAttribute('data-crumb', '');
  });
};

export function enableResponsiveTables(): void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  let scheduled = false;
  const run = () => {
    scheduled = false;
    document.querySelectorAll('table').forEach((t) => process(t as HTMLTableElement));
    compactHeaders();
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}
