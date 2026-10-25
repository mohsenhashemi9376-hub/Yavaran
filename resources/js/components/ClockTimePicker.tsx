import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clock, Minus, Plus, X } from 'lucide-react';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';

const pad = (n: number) => String(n).padStart(2, '0');

/** «HH:mm» ← {h, m}؛ نامعتبر = null */
const parse = (text: string): { h: number; m: number } | null => {
  const hit = /^(\d{1,2}):(\d{2})$/.exec(toEnglishDigits(text || '').trim());
  if (!hit) return null;
  const [h, m] = [Number(hit[1]), Number(hit[2])];
  return h <= 23 && m <= 59 ? { h, m } : null;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/**
 * فیلد ساعت: با لمس فیلد، پنجره‌ی ساعت‌شمار زیبا باز می‌شود (ساعت و دقیقه جدا، قالب ۲۴ساعته).
 * مقدار همیشه به‌صورت «HH:mm» (ارقام لاتین) به onChange می‌رسد.
 */
export const ClockTimePicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}> = ({ value, onChange, label = 'انتخاب ساعت', placeholder = '--:--', className, disabled, id }) => {
  const [open, setOpen] = useState(false);
  const current = parse(value);
  const [draft, setDraft] = useState(current ?? { h: 7, m: 0 });

  useEffect(() => {
    if (open) setDraft(parse(value) ?? { h: 7, m: 0 });
    // فقط هنگام باز شدن پنجره، پیش‌نویس را با مقدار فعلی هماهنگ می‌کنیم
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const stepMinute = (delta: number) =>
    setDraft((d) => {
      const total = (d.h * 60 + d.m + delta + 1440) % 1440;
      return { h: Math.floor(total / 60), m: total % 60 };
    });

  const confirm = () => {
    onChange(`${pad(draft.h)}:${pad(draft.m)}`);
    setOpen(false);
  };

  const now = () => {
    const d = new Date();
    setDraft({ h: d.getHours(), m: d.getMinutes() });
  };

  return (
    <>
      <button
        type="button"
        id={id}
        dir="ltr"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`${className ?? ''} inline-flex items-center justify-center gap-1.5 tabular-nums cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <Clock className="w-3.5 h-3.5 shrink-0 text-teal-600" />
        <span>{current ? toPersianDigits(`${pad(current.h)}:${pad(current.m)}`) : placeholder}</span>
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-xs grid place-items-center p-5"
            onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              role="dialog"
              aria-label={label}
              dir="rtl"
              style={{ fontFamily: 'inherit' }}
              className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            >
              <div className="relative bg-gradient-to-br from-teal-700 to-emerald-800 text-white px-5 pt-4 pb-5">
                <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="absolute left-3 top-3 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-100">
                  <Clock className="w-4 h-4" /> {label}
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 text-5xl font-black tabular-nums" dir="ltr">
                  <span>{toPersianDigits(pad(draft.h))}</span>
                  <span className="opacity-60 pb-1">:</span>
                  <span>{toPersianDigits(pad(draft.m))}</span>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <div className="text-[11px] font-bold text-slate-400 mb-1.5">ساعت</div>
                  <div className="grid grid-cols-6 gap-1.5" dir="ltr">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, h }))}
                        className={`h-10 rounded-xl text-sm font-bold tabular-nums cursor-pointer transition ${
                          draft.h === h ? 'bg-teal-700 text-white shadow-sm' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {toPersianDigits(pad(h))}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold text-slate-400 mb-1.5">دقیقه</div>
                  <div className="grid grid-cols-6 gap-1.5" dir="ltr">
                    {MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, m }))}
                        className={`h-10 rounded-xl text-sm font-bold tabular-nums cursor-pointer transition ${
                          draft.m === m ? 'bg-teal-700 text-white shadow-sm' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {toPersianDigits(pad(m))}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-3" dir="ltr">
                    <button type="button" onClick={() => stepMinute(-1)} aria-label="یک دقیقه کمتر" className="w-11 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-bold text-slate-400">تنظیم دقیق (۱ دقیقه)</span>
                    <button type="button" onClick={() => stepMinute(1)} aria-label="یک دقیقه بیشتر" className="w-11 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={confirm} className="flex-1 h-12 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer">
                    <Check className="w-4 h-4" /> تأیید
                  </button>
                  <button type="button" onClick={now} className="h-12 px-5 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-sm font-bold cursor-pointer">
                    اکنون
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
