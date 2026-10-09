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
};

export function enableResponsiveTables(): void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  let scheduled = false;
  const run = () => {
    scheduled = false;
    document.querySelectorAll('table').forEach((t) => process(t as HTMLTableElement));
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}
