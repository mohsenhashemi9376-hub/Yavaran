import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  children,
  className = '',
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; dot: string }> = {
    success: {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      dot: 'bg-emerald-600',
    },
    warning: {
      bg: 'bg-amber-50 text-amber-900 border-amber-200/80',
      dot: 'bg-amber-600',
    },
    danger: {
      bg: 'bg-rose-50 text-rose-900 border-rose-200/80',
      dot: 'bg-rose-600',
    },
    info: {
      bg: 'bg-teal-50 text-teal-900 border-teal-200/80',
      dot: 'bg-teal-700',
    },
    neutral: {
      bg: 'bg-slate-100 text-slate-700 border-slate-200/80',
      dot: 'bg-slate-400',
    },
  };

  const sizeStyles: Record<BadgeSize, string> = {
    sm: 'text-[10px] px-2 py-0.5 rounded-md gap-1',
    md: 'text-[11px] font-bold px-2.5 py-0.5 rounded-lg gap-1.5',
  };

  const current = variantStyles[variant];

  return (
    <span
      className={`
        inline-flex items-center font-bold border select-none whitespace-nowrap leading-none
        ${current.bg}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} />}
      <span>{children}</span>
    </span>
  );
};
