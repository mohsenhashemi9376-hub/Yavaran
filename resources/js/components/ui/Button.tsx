import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'right',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all select-none cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none rounded-xl';

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-xs sm:text-sm gap-2',
    lg: 'h-12 px-5 text-sm sm:text-base gap-2.5',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white shadow-xs focus-visible:ring-teal-700',
    secondary: 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200/90 shadow-2xs hover:border-slate-300 focus-visible:ring-slate-400',
    destructive: 'bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white shadow-xs focus-visible:ring-rose-600',
    ghost: 'bg-transparent hover:bg-slate-100 active:bg-slate-200/70 text-slate-700 hover:text-slate-900 focus-visible:ring-slate-400',
    outline: 'bg-transparent hover:bg-teal-50/70 active:bg-teal-100/60 text-teal-800 border border-teal-300 hover:border-teal-400 focus-visible:ring-teal-700',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading && (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      )}
      {!isLoading && icon && iconPosition === 'right' && (
        <span className="shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!isLoading && icon && iconPosition === 'left' && (
        <span className="shrink-0">{icon}</span>
      )}
    </button>
  );
};
