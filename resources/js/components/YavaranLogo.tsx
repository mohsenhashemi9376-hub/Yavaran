import React from 'react';

export interface YavaranLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  alt?: string;
  /** emblem: فقط آرم (پیش‌فرض) • full: آرم همراه با نوشتهٔ رسمی «مجتمع تربیتی آموزشی یاوران ولایت ۱۳۹۱» */
  variant?: 'emblem' | 'full';
  /** سازگاری با کدهای قدیمی (آرم همیشه با تگ img نمایش داده می‌شود) */
  useImageTag?: boolean;
}

const SIZE = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10 sm:w-11 sm:h-11',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

/** آرم رسمی مجتمع (فایل‌های public/brand). نسخهٔ full برای صفحهٔ ورود و بارگذاری استفاده می‌شود. */
export const YavaranLogo: React.FC<YavaranLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  alt = 'آرم مجتمع تربیتی آموزشی یاوران ولایت',
  variant = 'emblem',
}) => {
  if (variant === 'full') {
    const width = { xs: 'w-16', sm: 'w-20', md: 'w-28', lg: 'w-36', xl: 'w-44' }[size];
    return (
      <img
        src="/brand/logo-full.png"
        alt={alt}
        width={789}
        height={1266}
        decoding="async"
        draggable={false}
        className={`${width} h-auto select-none object-contain ${className}`}
      />
    );
  }

  const src = size === 'xs' || size === 'sm' ? '/brand/emblem-96.png' : size === 'md' || size === 'lg' ? '/brand/emblem-192.png' : '/brand/emblem.png';
  return (
    <div className={`inline-flex items-center gap-3 shrink-0 ${className}`}>
      <div className={`relative ${SIZE[size]} shrink-0 flex items-center justify-center select-none`} title={alt}>
        <img src={src} alt={alt} decoding="async" draggable={false} className="w-full h-full object-contain" />
      </div>

      {showText && (
        <div className="text-right">
          <div className="text-[10px] text-emerald-800 font-semibold tracking-wide">مجتمع تربیتی آموزشی</div>
          <div className="text-base font-black text-slate-900 leading-tight">یاوران ولایت</div>
          <div className="text-[9px] text-slate-500">تأسیس ۱۳۹۱</div>
        </div>
      )}
    </div>
  );
};
