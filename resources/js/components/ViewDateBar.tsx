import React, { useState } from 'react';
import { CalendarClock, Eye, RotateCcw } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import {
  dateToShamsiString,
  formatShamsiWithWeekday,
  getRealTodayShamsiString,
  shamsiStringToDate,
  toPersianDigits,
} from '../utils/persianDate';

const daysAgo = (n: number): string => {
  const d = shamsiStringToDate(getRealTodayShamsiString());
  d.setDate(d.getDate() - n);
  return dateToShamsiString(d);
};

const QUICK: [string, number][] = [
  ['دیروز', 1],
  ['۳ روز پیش', 3],
  ['۷ روز پیش', 7],
];

/**
 * مشاهده‌ی اطلاعات روزهای گذشته: با انتخاب یک روز، همه‌ی بخش‌ها (غیبت، تأخیر، جلسات، کاربرگ و…) همان روز را «امروز» می‌گیرند.
 * این حالت فقط‌مشاهده است و چیزی در سامانه ذخیره نمی‌شود.
 */
export const ViewDateBar: React.FC = () => {
  const { viewDate, changeViewDate } = useSchool();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (value: string | null) => {
    if (busy) return;
    setBusy(true);
    const ok = await changeViewDate(value);
    setBusy(false);
    if (ok) setText('');
  };

  const onType = (v: string) => {
    setText(v);
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(v)) void go(v);
  };

  const picker = (
    <ShamsiDatePicker
      value={text}
      onChange={onType}
      fallbackDate={viewDate ?? undefined}
      placeholder="انتخاب روز…"
      className="w-28 text-xs bg-white border border-slate-300 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-teal-600 font-mono text-center cursor-pointer"
    />
  );

  if (viewDate) {
    return (
      <div role="status" className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 px-4 sm:px-6 lg:px-8 py-2.5 bg-amber-100 border-y border-amber-300 text-amber-950" dir="rtl">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2 text-xs font-extrabold">
            <Eye className="w-4 h-4 shrink-0" />
            <span>نمایش اطلاعات روز {toPersianDigits(formatShamsiWithWeekday(viewDate))}</span>
            <span className="font-bold text-amber-800">— فقط مشاهده؛ تغییرات ذخیره نمی‌شود.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mr-auto">
            {picker}
            <button
              type="button"
              disabled={busy}
              onClick={() => go(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              بازگشت به امروز
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 mb-3" dir="rtl">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
        <CalendarClock className="w-3.5 h-3.5" />
        مشاهده‌ی اطلاعات روز دیگر:
      </span>
      {QUICK.map(([label, n]) => (
        <button
          key={n}
          type="button"
          disabled={busy}
          onClick={() => go(daysAgo(n))}
          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-600 cursor-pointer disabled:opacity-60"
        >
          {label}
        </button>
      ))}
      {picker}
    </div>
  );
};
