import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

export interface TrendDetailRow {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  badge?: string;
}

/** جزئیات پشت هر کادر آماری داشبورد (۱۴ روز اخیر) */
export const TrendDetailModal: React.FC<{
  title: string;
  hint?: string;
  rows: TrendDetailRow[];
  onClose: () => void;
  onRowClick?: (id: string) => void;
}> = ({ title, hint = '۱۴ روز اخیر', rows, onClose, onRowClick }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-slate-900/40 flex items-end sm:items-center justify-center sm:p-4" dir="rtl" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
            <div className="text-[11px] text-slate-400 mt-0.5">{toPersianDigits(hint)} • {toPersianDigits(rows.length)} مورد</div>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن" className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-1.5">
          {rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">موردی ثبت نشده است.</div>
          ) : (
            rows.map((r) => {
              const body = (
                <>
                  <div className="min-w-0 text-right">
                    <div className="text-xs font-extrabold text-slate-800 truncate">{r.title}</div>
                    {r.subtitle && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{r.subtitle}</div>}
                  </div>
                  <div className="shrink-0 flex items-center gap-2 text-[11px]">
                    {r.badge && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">{r.badge}</span>}
                    <span className="text-slate-400 tabular-nums">{r.date ? toPersianDigits(r.date) : ''}</span>
                  </div>
                </>
              );
              const cls = 'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50';
              return onRowClick ? (
                <button key={r.id} type="button" onClick={() => onRowClick(r.id)} className={`${cls} hover:bg-slate-100 cursor-pointer`}>{body}</button>
              ) : (
                <div key={r.id} className={cls}>{body}</div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
