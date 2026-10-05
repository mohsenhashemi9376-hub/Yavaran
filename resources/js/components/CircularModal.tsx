import React, { useEffect } from 'react';
import { Bell, CheckCircle2, Paperclip, X } from 'lucide-react';
import { SchoolAnnouncement } from '../types';
import { dateToShamsiString, toPersianDigits } from '../utils/persianDate';

interface Props {
  announcement: SchoolAnnouncement | null;
  /** «متوجه شدم» — ثبت خوانده‌شدن */
  onAcknowledge?: (a: SchoolAnnouncement) => void;
  onClose: () => void;
}

/** مودال رسمی نمایش بخشنامه / اطلاعیه معاونت آموزش (وسط‌چین، با اسکرول داخلی متن) */
export const CircularModal: React.FC<Props> = ({ announcement, onAcknowledge, onClose }) => {
  useEffect(() => {
    if (!announcement) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [announcement, onClose]);

  if (!announcement) return null;

  let issued = '';
  if (announcement.createdAt) {
    const d = new Date(announcement.createdAt);
    if (!isNaN(d.getTime())) {
      issued = `${dateToShamsiString(d)} • ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  if (!issued) issued = announcement.date;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[90] flex items-center justify-center p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-violet-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-violet-50/80 border-b border-violet-100 p-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white text-violet-600 shadow-sm flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-200 text-[11px] font-bold whitespace-nowrap">
                اطلاعیه رسمی معاونت آموزش
              </span>
              <div className="text-[11px] text-slate-500 mt-1 whitespace-nowrap">{toPersianDigits(issued)}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="w-9 h-9 rounded-full hover:bg-white/80 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto min-h-0 flex-1">
          <h3 className="text-slate-900 font-bold text-lg mb-2">{announcement.title}</h3>
          <div className="max-h-64 overflow-y-auto pr-1 leading-relaxed text-slate-700 text-sm md:text-base whitespace-pre-line break-words">
            {announcement.content}
          </div>
          {(announcement.attachments || []).length > 0 && (
            <div className="mt-3 space-y-2">
              {(announcement.attachments || []).map((f, i) => (
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
          <div className="text-[11px] text-slate-400 mt-3">{announcement.authorName || announcement.author || 'معاونت آموزش'}</div>
        </div>

        <div className="p-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={() => {
              onAcknowledge?.(announcement);
              onClose();
            }}
            className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>متوجه شدم</span>
          </button>
        </div>
      </div>
    </div>
  );
};
