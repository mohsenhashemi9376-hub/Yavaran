import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface FormFieldProps {
  id?: string;
  label?: string;
  required?: boolean;
  helpText?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required = false,
  helpText,
  error,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-bold text-slate-700 select-none"
        >
          {label}
          {required && <span className="text-rose-600 mr-1">*</span>}
        </label>
      )}

      {children}

      {error ? (
        <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1 animate-in fade-in" role="alert">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : helpText ? (
        <p className="text-[11px] text-slate-500 mt-1 leading-normal">
          {helpText}
        </p>
      ) : null}
    </div>
  );
};
