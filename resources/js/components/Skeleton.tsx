import React from 'react';

/** بلوک اسکلت بارگذاری با درخشش ملایم (در حالت «کاهش حرکت» ثابت می‌ماند) */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`yv-skeleton ${className}`} aria-hidden="true" />
);

/** اسکلت صفحه‌ی داشبورد تا رسیدن داده‌ها از سرور */
export const DashboardSkeleton: React.FC = () => (
  <div className="w-full max-w-5xl mx-auto space-y-4 p-4" role="status" aria-label="در حال بارگذاری" dir="rtl">
    <Skeleton className="h-24 rounded-2xl" />
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
    <Skeleton className="h-56 rounded-2xl" />
  </div>
);
