import React from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { DEFAULT_ENTRY_TIME } from '../utils/morningAttendance';
import { toPersianDigits } from '../utils/persianDate';
import { ClockTimePicker } from './ClockTimePicker';

/**
 * ساعت ورود به مدرسه در یک روز: پیش‌فرض ۰۷:۰۰ است و مدیر یا معاون انضباطی می‌تواند برای همان روز تغییرش دهد؛
 * ورود پس از این ساعت (همان روز) تأخیر حساب می‌شود. سایر نقش‌ها فقط ساعت را می‌بینند.
 */
export const EntryTimeControl: React.FC<{ date: string; className?: string }> = ({ date, className = '' }) => {
  const { currentUser, entryTimeFor, setEntryTime, showToast } = useSchool();
  const canManage = currentUser.role === 'admin' || currentUser.role === 'vice_disciplinary';
  const time = entryTimeFor(date);
  const isCustom = time !== DEFAULT_ENTRY_TIME;

  return (
    <div className={`flex items-center gap-2.5 flex-wrap rounded-2xl border px-3.5 py-3 ${isCustom ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-slate-50'} ${className}`} dir="rtl">
      <Clock className={`w-4 h-4 shrink-0 ${isCustom ? 'text-amber-700' : 'text-slate-500'}`} />
      <div className="min-w-0">
        <div className="text-xs font-extrabold text-slate-800">ساعت ورود به مدرسه{isCustom ? ' (تعیین‌شده برای این روز)' : ''}</div>
        <div className="text-[11px] text-slate-500 leading-5">ورود پس از {toPersianDigits(time)} در همین روز تأخیر حساب می‌شود.</div>
      </div>
      {canManage ? (
        <div className="mr-auto flex items-center gap-2">
          <ClockTimePicker
            label="ساعت ورود به مدرسه"
            value={time}
            onChange={(v) => v && setEntryTime(date, v)}
            className="h-11 w-28 text-base font-extrabold bg-white rounded-xl text-slate-900 border border-slate-200 hover:border-emerald-400 transition"
          />
          {isCustom && (
            <button
              type="button"
              onClick={() => {
                setEntryTime(date, null);
                showToast(`ساعت ورود به حالت پیش‌فرض (${toPersianDigits(DEFAULT_ENTRY_TIME)}) برگشت.`, 'info');
              }}
              className="h-11 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              پیش‌فرض
            </button>
          )}
        </div>
      ) : (
        <span className="mr-auto text-base font-black text-slate-900" dir="ltr">{toPersianDigits(time)}</span>
      )}
    </div>
  );
};
