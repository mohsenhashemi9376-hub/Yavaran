import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  iconRight?: React.ReactNode;
  iconLeft?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  hasError = false,
  iconRight,
  iconLeft,
  className = '',
  disabled,
  ...props
}, ref) => {
  return (
    <div className="relative w-full flex items-center">
      {iconRight && (
        <div className="absolute right-3.5 flex items-center pointer-events-none text-slate-400">
          {iconRight}
        </div>
      )}
      <input
        ref={ref}
        disabled={disabled}
        className={`
          w-full h-10 sm:h-11 text-xs sm:text-sm rounded-xl transition bg-slate-50 hover:bg-white focus:bg-white text-slate-900 placeholder:text-slate-400
          disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed
          ${iconRight ? 'pr-10' : 'pr-3.5'}
          ${iconLeft ? 'pl-10' : 'pl-3.5'}
          ${
            hasError
              ? 'border border-rose-300 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/20'
              : 'border border-slate-200/90 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20'
          }
          ${className}
        `}
        {...props}
      />
      {iconLeft && (
        <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
          {iconLeft}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';
