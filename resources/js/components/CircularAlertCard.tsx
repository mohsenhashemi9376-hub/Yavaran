import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Megaphone, Paperclip, X } from 'lucide-react';
import { SchoolAnnouncement } from '../types';
import { dateToShamsiString, toPersianDigits } from '../utils/persianDate';

interface Props {
  /** بخشنامه خوانده‌نشده‌ای که اکنون نمایش داده می‌شود (null = چیزی نمایش داده نمی‌شود) */
  announcement: SchoolAnnouncement | null;
  /** شماره این بخشنامه در میان خوانده‌نشده‌ها و تعداد کل (برای نشانگر «۱ از ۳») */
  position: { index: number; total: number };
  /** «متوجه شدم» — بخشنامه از اعلان‌های خوانده‌نشده برداشته می‌شود */
  onAcknowledge: (a: SchoolAnnouncement) => void;
  /** بستن موقت (در همین نشست؛ خوانده‌شدن ثبت نمی‌شود) */
  onDismiss: () => void;
}

const PRIORITY = {
  urgent: { label: 'فوری', badge: 'bg-rose-100 text-rose-700 border-rose-200', ring: 'from-rose-500 to-orange-400', icon: 'bg-rose-50 text-rose-600' },
  important: { label: 'مهم', badge: 'bg-amber-100 text-amber-800 border-amber-200', ring: 'from-amber-500 to-yellow-400', icon: 'bg-amber-50 text-amber-600' },
  normal: { label: 'بخشنامه', badge: 'bg-violet-100 text-violet-800 border-violet-200', ring: 'from-violet-600 to-indigo-400', icon: 'bg-violet-50 text-violet-600' },
} as const;

/** کادر کوچک وسط صفحه برای نمایش بخشنامه‌ی جدید هنگام ورود استاد به پنل */
export const CircularAlertCard: React.FC<Props> = ({ announcement, position, onAcknowledge, onDismiss }) => {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setExpanded(false), [announcement?.id]);

  useEffect(() => {
    if (!announcement) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDismiss();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [announcement, onDismiss]);

  if (!announcement) return null;

  const p = PRIORITY[announcement.priority as keyof typeof PRIORITY] || PRIORITY.normal;
  let issued = announcement.date;
  if (announcement.createdAt) {
    const d = new Date(announcement.createdAt);
    if (!isNaN(d.getTime())) issued = dateToShamsiString(d);
  }
  const long = announcement.content.length > 160 || announcement.content.split('\n').length > 3;
  const attachments = announcement.attachments || [];

  return (
    <div
      className="fixed inset-0 z-[95] bg-slate-900/45 backdrop-blur-[3px] flex items-center justify-center p-4 animate-in fade-in duration-200"
      dir="rtl"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="circular-alert-title"
    >
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-300">
        <div className={`h-1.5 bg-gradient-to-l ${p.ring}`} />

        <button
          type="button"
          onClick={onDismiss}
          aria-label="بستن موقت"
          title="بستن (بعداً یادآوری می‌شود)"
          className="absolute top-4 left-3 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-5 pt-5 pb-4 text-center">
          <div className="relative w-14 h-14 mx-auto">
            <span className={`absolute inset-0 rounded-2xl ${p.icon} animate-ping opacity-30`} />
            <div className={`relative w-14 h-14 rounded-2xl ${p.icon} flex items-center justify-center shadow-inner`}>
              <Megaphone className="w-7 h-7" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${p.badge}`}>{p.label}</span>
            <span className="text-[11px] text-slate-400">{toPersianDigits(issued)}</span>
            {position.total > 1 && (
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                {toPersianDigits(position.index)} از {toPersianDigits(position.total)}
              </span>
            )}
          </div>

          <h3 id="circular-alert-title" className="mt-2.5 text-base font-extrabold text-slate-900 leading-snug">
            {announcement.title}
          </h3>

          <div
            className={`mt-2 text-[13px] leading-7 text-slate-600 whitespace-pre-line break-words text-right ${
              expanded ? 'max-h-52 overflow-y-auto pr-1' : 'line-clamp-3'
            }`}
          >
            {announcement.content}
          </div>

          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 text-[12px] font-bold text-violet-700 hover:text-violet-900 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{expanded ? 'نمایش کمتر' : 'مشاهده متن کامل'}</span>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {expanded && attachments.length > 0 && (
            <div className="mt-2 space-y-1.5 text-right">
              {attachments.map((f, i) => (
                <a
                  key={i}
                  href={f.dataUrl}
                  download={f.name}
                  className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2"
                >
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </a>
              ))}
            </div>
          )}

          <div className="mt-2 text-[11px] text-slate-400">{announcement.authorName || announcement.author || 'معاونت آموزش'}</div>
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={() => onAcknowledge(announcement)}
            autoFocus
            className="w-full h-12 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>متوجه شدم</span>
          </button>
        </div>
      </div>
    </div>
  );
};
