import React, { useMemo } from 'react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { sessionTrends } from '../utils/trends';
import { TrendTile } from './Sparkline';

/** روند ۱۴ روز اخیر جلسات ثبت‌شده و تکالیف داده‌شده (نمودار کوچک) برای صفحه‌ی اصلی معاون آموزشی */
export const ClassActivityTrends: React.FC = () => {
  const { sessions } = useSchool();
  const t = useMemo(() => sessionTrends(sessions, 14), [sessions]);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const homeworkShare = sum(t.sessions) > 0 ? Math.round((sum(t.homework) / sum(t.sessions)) * 100) : 0;
  return (
    <div data-stagger className="grid grid-cols-2 sm:grid-cols-3 gap-3 [&>*:nth-child(3)]:col-span-2 sm:[&>*:nth-child(3)]:col-span-1">
      <TrendTile label="جلسات ثبت‌شده" total={toPersianDigits(sum(t.sessions))} hint="۱۴ روز اخیر" values={t.sessions} color="#0f766e" />
      <TrendTile label="جلسات دارای تکلیف" total={toPersianDigits(sum(t.homework))} hint="۱۴ روز اخیر" values={t.homework} color="#d97706" />
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col justify-between">
        <div className="text-xs font-bold text-slate-500">سهم جلسات دارای تکلیف</div>
        <div className="text-2xl font-black text-slate-900 mt-1">{toPersianDigits(homeworkShare)}٪</div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-3">
          <div className="h-full rounded-full bg-amber-500 transition-all duration-700" style={{ width: `${homeworkShare}%` }} />
        </div>
        <div className="text-[11px] text-slate-400 mt-2">از جلسات ۱۴ روز اخیر</div>
      </div>
    </div>
  );
};
