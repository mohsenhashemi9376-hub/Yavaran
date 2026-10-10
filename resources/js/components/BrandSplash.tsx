import React from 'react';

interface BrandSplashProps {
  /** offline: اتصال به سرور برقرار نشده؛ دکمهٔ «تلاش مجدد» نمایش داده می‌شود */
  offline?: boolean;
  onRetry?: () => void;
}

/**
 * صفحهٔ شروع برنامه با آرم رسمی؛ همان ظاهر صفحهٔ شروع پیش از بارگذاری جاوااسکریپت (app.blade.php) تا انتقال بی‌پرش باشد.
 * استایل‌ها (.yv-boot) به‌صورت درون‌خطی در app.blade.php تعریف شده‌اند.
 */
export const BrandSplash: React.FC<BrandSplashProps> = ({ offline = false, onRetry }) => (
  <div className="yv-boot" role="status" aria-live="polite" aria-label={offline ? 'ارتباط با سرور برقرار نشد' : 'در حال آماده‌سازی'}>
    <div className="yv-boot__halo" aria-hidden="true" />
    <img className="yv-boot__logo" src="/brand/logo-full.png" width={741} height={1219} alt="آرم مجتمع تربیتی آموزشی یاوران ولایت" decoding="async" />
    {offline ? (
      <>
        <div className="yv-boot__hint">ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.</div>
        <button type="button" className="yv-boot__btn" onClick={onRetry}>تلاش مجدد</button>
      </>
    ) : (
      <>
        <div className="yv-boot__bar" aria-hidden="true"><i /></div>
        <div className="yv-boot__hint">در حال آماده‌سازی سامانه…</div>
      </>
    )}
    <div className="yv-boot__foot">سامانه مدیریت آموزشی، انضباطی و تربیتی</div>
  </div>
);
