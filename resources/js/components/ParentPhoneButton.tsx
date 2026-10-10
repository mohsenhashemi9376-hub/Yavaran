import React, { useState } from 'react';
import { Phone, Copy, Check, X } from 'lucide-react';
import { Student } from '../types';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';

/** شمارهٔ تماس پدر/ولی دانش‌آموز؛ فقط وقتی ثبت شده باشد نمایش داده می‌شود */
export const parentPhoneOf = (s: Pick<Student, 'parentPhone' | 'fatherPhone'>): string =>
  toEnglishDigits((s.parentPhone || s.fatherPhone || '').trim());

interface Props {
  student: Student;
  /** compact: فقط آیکن کوچک (مثلاً کنار نام در جدول) */
  compact?: boolean;
}

/**
 * دکمهٔ آیکن تلفن: با لمس، شمارهٔ پدر را همراه با دکمه‌های «تماس» و «کپی» نشان می‌دهد.
 * لمس آن هیچ‌کدام از عملیات کارت (حاضر/غایب) را فعال نمی‌کند.
 */
export const ParentPhoneButton: React.FC<Props> = ({ student, compact = false }) => {
  const phone = parentPhoneOf(student);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!phone) return null;

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* مرورگر اجازه‌ی کپی نداد */
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-expanded={open}
        aria-label={`شماره تماس پدر ${student.firstName || ''}`}
        title="شماره تماس پدر"
        style={{ minHeight: 0 }}
        className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} shrink-0 rounded-full flex items-center justify-center border transition cursor-pointer ${
          open ? 'bg-teal-700 text-white border-teal-700' : 'bg-white/80 text-teal-700 border-teal-200 hover:bg-teal-50'
        }`}
      >
        {open ? <X className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <span className="inline-flex w-max max-w-[86vw] items-center gap-1.5 whitespace-nowrap bg-white border border-teal-200 rounded-2xl pl-1.5 pr-3 py-1 shadow-sm animate-in fade-in text-slate-800">
          <span className="text-[10px] font-bold text-slate-400 max-w-[5.5rem] truncate">{student.fatherName ? `پدر (${student.fatherName})` : 'پدر'}</span>
          <a href={`tel:${phone}`} dir="ltr" className="text-sm font-black text-slate-900 tracking-wide" aria-label={`تماس با ${phone}`}>
            {toPersianDigits(phone)}
          </a>
          <a href={`tel:${phone}`} style={{ minHeight: 0 }} className="h-7 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1">
            <Phone className="w-3 h-3" /> تماس
          </a>
          <button type="button" onClick={copy} aria-label="کپی شماره" style={{ minHeight: 0 }} className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </span>
      )}
    </span>
  );
};
