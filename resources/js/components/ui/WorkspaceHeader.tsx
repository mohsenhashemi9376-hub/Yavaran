import React from 'react';
import { ChevronLeft, Menu } from 'lucide-react';

/**
 * قالب مشترک سربرگ صفحه‌های پنل‌ها (کلاس‌ها، دانش‌آموزان، حضور و غیاب، امانات و …).
 * ترتیب ثابت: مسیر (داشبورد / بخش / صفحه) ← آیکون و عنوان و شمارنده ← توضیح؛
 * سمت چپ: دکمه‌های همان صفحه ← «منو» (فقط موبایل) ← «بازگشت به داشبورد».
 */

export interface WorkspaceTitleBarProps {
  title: string;
  icon: React.ElementType;
  /** گروه منوی کناری که صفحه زیر آن است (مثلاً «امور روزانه»)؛ در مسیر بالای عنوان نمایش داده می‌شود */
  section?: string;
  /** شمارنده یا برچسب کنار عنوان (مثلاً «۱۲ کلاس») */
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** دکمه‌های اختصاصی صفحه (از HeaderAction استفاده کنید) */
  actions?: React.ReactNode;
  /** نبودن onBack یعنی صفحه داخل پنلی نمایش داده می‌شود که خودش مسیر و بازگشت دارد */
  onBack?: () => void;
  onOpenSidebar?: () => void;
}

export const WorkspaceTitleBar: React.FC<WorkspaceTitleBarProps> = ({
  title,
  icon: Icon,
  section,
  badge,
  subtitle,
  actions,
  onBack,
  onOpenSidebar,
}) => (
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
    <div className="flex items-start gap-3 min-w-0">
      <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-700 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-teal-700/20">
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        {onBack && (
          <nav aria-label="مسیر" className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-0.5">
            <button type="button" onClick={onBack} className="hover:text-teal-800 cursor-pointer transition">
              داشبورد
            </button>
            {section && (
              <>
                <ChevronLeft className="w-3 h-3" />
                <span>{section}</span>
              </>
            )}
            <ChevronLeft className="w-3 h-3" />
            <span className="text-teal-800">{title}</span>
          </nav>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{title}</h1>
          {badge !== undefined && badge !== null && badge !== false && (
            <span className="text-[11px] font-bold bg-teal-50 text-teal-800 px-2.5 py-1 rounded-full border border-teal-200">{badge}</span>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-1 leading-6">{subtitle}</p>}
      </div>
    </div>

    {(actions || onOpenSidebar || onBack) && (
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {actions}
        {onOpenSidebar && (
          // روی موبایل (responsiveTables) فقط آیکون می‌ماند؛ برچسب برای صفحه‌خوان حفظ می‌شود
          <HeaderAction icon={Menu} label="منو" onClick={onOpenSidebar} className="lg:hidden" aria-label="باز کردن نوار کناری" />
        )}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="بازگشت به داشبورد"
            className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>بازگشت به داشبورد</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>
    )}
  </div>
);

export interface HeaderActionProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon?: React.ElementType;
  label: React.ReactNode;
  /** primary: کار اصلی صفحه (افزودن، ثبت)؛ secondary: کارهای جانبی (خروجی اکسل، چاپ) */
  variant?: 'primary' | 'secondary';
  /** رنگ آیکون در حالت secondary (مثلاً text-emerald-700 برای اکسل) */
  iconClassName?: string;
}

/** دکمه‌ی یکدست سربرگ صفحه */
export const HeaderAction: React.FC<HeaderActionProps> = ({
  icon: Icon,
  label,
  variant = 'secondary',
  iconClassName,
  className = '',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={`h-9 px-3.5 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
      variant === 'primary'
        ? 'bg-teal-800 hover:bg-teal-900 text-white shadow-xs'
        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
    } ${className}`}
    {...props}
  >
    {Icon && <Icon className={`w-4 h-4 ${variant === 'secondary' ? iconClassName ?? 'text-slate-600' : ''}`} />}
    <span>{label}</span>
  </button>
);

export interface WorkspaceHeaderProps extends WorkspaceTitleBarProps {
  /** محتوای زیر عنوان داخل همان کارت (جستجو، فیلترها، آمار) */
  children?: React.ReactNode;
}

/** کارت سربرگ کامل: عنوان + (اختیاری) جستجو/فیلتر/آمار زیر آن با جداکننده */
export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({ children, ...bar }) => (
  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
    <WorkspaceTitleBar {...bar} />
    {children && <div className="pt-4 border-t border-slate-100">{children}</div>}
  </div>
);
