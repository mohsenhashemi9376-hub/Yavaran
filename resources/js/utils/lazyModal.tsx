import React, { ComponentType, lazy, Suspense, useState } from 'react';

/**
 * بارگذاری تنبل پنجره‌های بازشو: کد پنجره فقط هنگام اولین باز شدن دریافت می‌شود
 * و پس از آن (برای حفظ وضعیت و انیمیشن بستن) نصب می‌ماند. این کار حجم اولیه‌ی برنامه را کم و باز شدن آن را سریع‌تر می‌کند.
 */
export function lazyModal<C extends ComponentType<any>>(loader: () => Promise<{ default: C }>): C {
  const Inner = lazy(loader) as unknown as ComponentType<any>;
  const Wrapper = (props: { isOpen: boolean }) => {
    const [seen, setSeen] = useState(props.isOpen);
    if (props.isOpen && !seen) setSeen(true);
    if (!seen) return null;
    return (
      <Suspense
        fallback={
          props.isOpen ? (
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/40" role="status" aria-label="در حال بارگذاری">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/40 border-t-white" />
            </div>
          ) : null
        }
      >
        <Inner {...props} />
      </Suspense>
    );
  };
  return Wrapper as unknown as C;
}
