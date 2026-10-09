import React from 'react';
import { ArrowRight, Menu } from 'lucide-react';
import { Button } from './Button';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  onBack?: () => void;
  /** دکمهٔ «منو» در موبایل برای باز کردن نوار کناری */
  onOpenSidebar?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  icon,
  onBack,
  onOpenSidebar,
  backLabel = 'بازگشت به پیشخوان',
  actions,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 mb-6 ${className}`}>
      <div className="flex items-center gap-3">
        {onBack && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            icon={<ArrowRight className="w-4 h-4" />}
            title={backLabel}
            aria-label={backLabel}
            className="shrink-0"
          >
            <span className="hidden sm:inline">{backLabel}</span>
          </Button>
        )}

        {icon && (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-700 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-700/20">
            {icon}
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-normal">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {(actions || onOpenSidebar) && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
          {onOpenSidebar && (
            <Button variant="secondary" size="sm" onClick={onOpenSidebar} icon={<Menu className="w-4 h-4" />} className="lg:hidden" aria-label="باز کردن منو">
              منو
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
