import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
  hasError?: boolean;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  options = [],
  hasError = false,
  placeholder,
  className = '',
  disabled,
  children,
  ...props
}, ref) => {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        disabled={disabled}
        className={`
          w-full h-10 sm:h-11 text-xs sm:text-sm rounded-xl transition bg-slate-50 hover:bg-white focus:bg-white text-slate-900 appearance-none pr-3.5 pl-9
          disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer
          ${
            hasError
              ? 'border border-rose-300 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 bg-rose-50/20'
              : 'border border-slate-200/90 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20'
          }
          ${className}
        `}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children ? (
          children
        ) : (
          options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))
        )}
      </select>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <ChevronDown className="w-4 h-4" />
      </div>
    </div>
  );
});

Select.displayName = 'Select';
