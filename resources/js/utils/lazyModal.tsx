import React, { Component, ComponentType, ReactNode, lazy, Suspense, useState } from 'react';
import { retryImport } from './retryImport';

/**
 * مرز خطای اختصاصی هر پنجره: خطا در یک پنجره (مثلاً پرونده‌ی دانش‌آموز) نباید پنجره‌های دیگر — مثل جستجو — را برای همیشه از کار بیندازد.
 * با هر بار باز شدن دوباره‌ی پنجره، وضعیت خطا پاک می‌شود.
 */
class ModalBoundary extends Component<
  { isOpen: boolean; onClose?: () => void; children: ReactNode },
  { failed: boolean; wasOpen: boolean }
> {
  state = { failed: false, wasOpen: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: { isOpen: boolean }, state: { failed: boolean; wasOpen: boolean }) {
    if (props.isOpen && !state.wasOpen) return { failed: false, wasOpen: true };
    if (!props.isOpen && state.wasOpen) return { wasOpen: false };
    return null;
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (!this.props.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-900/40 p-4" dir="rtl" role="alert">
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-extrabold text-slate-800">این پنجره با مشکل مواجه شد</p>
          <p className="mt-1 text-xs leading-6 text-slate-500">بستن را بزنید و دوباره امتحان کنید؛ سایر بخش‌ها کار می‌کنند.</p>
          <button
            type="button"
            onClick={() => this.props.onClose?.()}
            className="mt-4 min-h-11 w-full rounded-xl bg-slate-900 text-sm font-bold text-white active:bg-slate-700"
          >
            بستن
          </button>
        </div>
      </div>
    );
  }
}

/**
 * بارگذاری تنبل پنجره‌های بازشو: کد پنجره فقط هنگام اولین باز شدن دریافت می‌شود
 * و پس از آن (برای حفظ وضعیت و انیمیشن بستن) نصب می‌ماند. این کار حجم اولیه‌ی برنامه را کم و باز شدن آن را سریع‌تر می‌کند.
 */
export function lazyModal<C extends ComponentType<any>>(loader: () => Promise<{ default: C }>): C {
  const Inner = lazy(() => retryImport(loader)) as unknown as ComponentType<any>;
  const Wrapper = (props: { isOpen: boolean; onClose?: () => void }) => {
    const [seen, setSeen] = useState(props.isOpen);
    if (props.isOpen && !seen) setSeen(true);
    if (!seen) return null;
    return (
      <ModalBoundary isOpen={props.isOpen} onClose={props.onClose}>
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
      </ModalBoundary>
    );
  };
  return Wrapper as unknown as C;
}
