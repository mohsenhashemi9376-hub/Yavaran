import React from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  value: string;
  onChangeValue: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeValue,
  onClear,
  placeholder = 'جستجو...',
  size = 'md',
  className = '',
  disabled,
  ...props
}) => {
  const sizeStyles = {
    sm: 'h-8 text-xs pr-8 pl-7',
    md: 'h-10 text-xs sm:text-sm pr-9 pl-8',
    lg: 'h-12 text-sm sm:text-base pr-10 pl-9',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  const handleClear = () => {
    onChangeValue('');
    if (onClear) onClear();
  };

  return (
    <div className="relative w-full">
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <Search className={iconSizes} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`
          w-full rounded-xl transition bg-slate-50 hover:bg-white focus:bg-white text-slate-900 border border-slate-200/90
          focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 placeholder:text-slate-400
          disabled:opacity-60 disabled:cursor-not-allowed
          ${sizeStyles}
          ${className}
        `}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/50 transition cursor-pointer"
          title="پاک کردن متن"
          aria-label="پاک کردن متن"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
