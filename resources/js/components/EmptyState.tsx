import React from 'react';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  /** دکمه اقدام اختیاری (مثلاً «ثبت اولین جلسه») */
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'teal' | 'emerald' | 'amber';
  className?: string;
}

/** وضعیت خالی دوستانه: آیکن، تیتر، توضیح کوتاه و (در صورت نیاز) یک دکمه اقدام */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'teal',
  className = '',
}) => (
  <div className={`yv-empty yv-empty--${tone} ${className}`} dir="rtl">
    <div className="yv-empty__icon" aria-hidden="true">
      <Icon className="w-6 h-6" />
    </div>
    <h4 className="yv-empty__title">{title}</h4>
    {description && <p className="yv-empty__desc">{description}</p>}
    {actionLabel && onAction && (
      <button type="button" onClick={onAction} className="yv-btn-primary yv-empty__action">
        {actionLabel}
      </button>
    )}
  </div>
);
