import { useLayoutEffect } from 'react';

/** با تغییر صفحه/بخش، صفحه از بالای بالا شروع می‌شود (نه از میانه). */
export function useScrollTop(...deps: unknown[]): void {
  useLayoutEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {
      /* محیط بدون window */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
