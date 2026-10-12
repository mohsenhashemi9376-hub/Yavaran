import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  PERSIAN_MONTHS,
  getDaysInShamsiMonth,
  getTodayShamsi,
  shamsiStringToDate,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/persianDate';

const WEEK_HEAD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; // از شنبه تا جمعه

const pad = (n: number) => String(n).padStart(2, '0');

/** «۱۴۰۵/۷/۹» ← {y, m, d}؛ نامعتبر = null */
const parse = (text: string): { y: number; m: number; d: number } | null => {
  const hit = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(toEnglishDigits(text || '').trim());
  if (!hit) return null;
  const [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  return m >= 1 && m <= 12 && d >= 1 && d <= getDaysInShamsiMonth(y, m) ? { y, m, d } : null;
};

/**
 * فیلد تاریخ شمسی: با کلیک (یا فوکوس) روی فیلد، تقویم شمسی باز می‌شود؛ تایپ دستی هم همچنان ممکن است.
 * مقدار همیشه به‌صورت «YYYY/MM/DD» (ارقام لاتین) به onChange می‌رسد.
 */
export const ShamsiDatePicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
  /** تاریخی که اگر مقدار خالی بود، تقویم روی ماه آن باز می‌شود (پیش‌فرض: امروز) */
  fallbackDate?: string;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, fallbackDate, placeholder = '1405/07/19', className }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const today = useMemo(() => getTodayShamsi().formattedDate, []);
  const selected = parse(value);
  const base = selected ?? parse(fallbackDate || '') ?? parse(today) ?? { y: 1405, m: 1, d: 1 };
  const [view, setView] = useState({ y: base.y, m: base.m });

  useEffect(() => {
    if (open) setView({ y: base.y, m: base.m });
    // فقط هنگام باز شدن تقویم، ماه نمایش داده‌شده را با مقدار فعلی هماهنگ می‌کنیم
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const days = getDaysInShamsiMonth(view.y, view.m);
  // JS: یکشنبه=۰ … شنبه=۶ ← ستون شنبه‌محور
  const offset = (shamsiStringToDate(`${view.y}/${pad(view.m)}/01`).getDay() + 1) % 7;
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  const shift = (delta: number) =>
    setView((v) => {
      const idx = v.y * 12 + (v.m - 1) + delta;
      return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
    });

  const pick = (d: number) => {
    onChange(`${view.y}/${pad(view.m)}/${pad(d)}`);
    setOpen(false);
  };

  const todayParts = parse(today);

  return (
    <div ref={rootRef} className="relative inline-block">
      <input
        dir="ltr"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(toEnglishDigits(e.target.value))}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
      />
      {open && (
        <div
          role="dialog"
          aria-label="تقویم شمسی"
          dir="rtl"
          className="absolute z-[95] mt-2 right-0 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shift(-1)} aria-label="ماه قبل" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-xs font-extrabold text-slate-800">
              {PERSIAN_MONTHS[view.m - 1]} {toPersianDigits(view.y)}
            </div>
            <button type="button" onClick={() => shift(1)} aria-label="ماه بعد" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK_HEAD.map((w, i) => (
              <div key={w} className={`text-[10px] font-bold py-1 ${i === 6 ? 'text-rose-500' : 'text-slate-400'}`}>{w}</div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;
              const isSel = !!selected && selected.y === view.y && selected.m === view.m && selected.d === d;
              const isToday = !!todayParts && todayParts.y === view.y && todayParts.m === view.m && todayParts.d === d;
              const isFriday = (offset + d - 1) % 7 === 6;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(d)}
                  className={`h-8 rounded-lg text-xs font-bold tabular-nums cursor-pointer transition ${
                    isSel
                      ? 'bg-teal-700 text-white'
                      : isToday
                        ? 'border border-teal-500 text-teal-800 hover:bg-teal-50'
                        : isFriday
                          ? 'text-rose-600 hover:bg-rose-50'
                          : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {toPersianDigits(d)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => todayParts && (setView({ y: todayParts.y, m: todayParts.m }), pick(todayParts.d))}
            className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-bold text-teal-800 hover:bg-teal-50 cursor-pointer"
          >
            امروز
          </button>
        </div>
      )}
    </div>
  );
};
