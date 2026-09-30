import React from 'react';
import { useSchool } from '../context/SchoolContext';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { YavaranLogo } from './YavaranLogo';

export interface SchoolBrandProps {
  onClick?: () => void;
  showAcademicYear?: boolean;
  showDate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  customSchoolName?: string;
  compactOnMobile?: boolean;
}

export const SchoolBrand: React.FC<SchoolBrandProps> = ({
  onClick,
  showAcademicYear = true,
  showDate = true,
  size = 'md',
  className = '',
  customSchoolName,
  compactOnMobile = true,
}) => {
  const { schoolSettings } = useSchool();
  const todayInfo = getTodayShamsi();
  const schoolName = customSchoolName || schoolSettings.schoolName || 'مجتمع تربیتی آموزشی یاوران ولایت';
  const academicYear = schoolSettings.academicYear || '۱۴۰۴-۱۴۰۵';

  const logoSizes = {
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'lg' as const,
  };

  const isInteractive = Boolean(onClick);

  return (
    <div
      id="school-brand-header"
      onClick={onClick}
      onKeyDown={(e) => {
        if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      tabIndex={isInteractive ? 0 : undefined}
      role={isInteractive ? 'button' : undefined}
      aria-label={`${schoolName} - سال تحصیلی ${toPersianDigits(academicYear)}`}
      title={isInteractive ? 'بازگشت به پیشخوان و صفحه اصلی سامانه' : schoolName}
      className={`flex items-center gap-2.5 sm:gap-3 shrink-0 select-none ${
        isInteractive 
          ? 'cursor-pointer group hover:opacity-95 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/50 rounded-xl p-1 -m-1' 
          : ''
      } ${className}`}
      dir="rtl"
    >
      {/* 1. School Emblem (Logo) */}
      <div className="shrink-0 flex items-center justify-center">
        <YavaranLogo 
          size={logoSizes[size]} 
          alt={`آرم رسمی ${schoolName}`}
          className={isInteractive ? 'group-hover:scale-[1.03] transition-transform duration-200' : ''}
        />
      </div>

      {/* 2. School Name & Academic Year Information */}
      <div className="text-right flex flex-col justify-center min-w-0">
        <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-900 leading-tight tracking-tight truncate">
          {schoolName}
        </h1>

        {showAcademicYear && (
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5 leading-none">
            <span className="whitespace-nowrap">
              سال تحصیلی {toPersianDigits(academicYear)}
            </span>
            {showDate && (
              <>
                <span className="hidden md:inline text-slate-300">•</span>
                <span className="hidden md:inline text-slate-400 truncate">
                  {todayInfo.dayOfWeek}، {todayInfo.displayDate}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
