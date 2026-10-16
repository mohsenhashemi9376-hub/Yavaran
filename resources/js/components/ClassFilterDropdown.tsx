import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

export interface ClassFilterOption {
  id: string;
  name: string;
  count: number;
}

interface Props {
  options: ClassFilterOption[];
  /** 'all' یا شناسه‌ی کلاس */
  value: string;
  onChange: (id: string) => void;
  /** تعداد کل برای گزینه‌ی «همه کلاس‌ها»؛ undefined = گزینه‌ی همه نمایش داده نمی‌شود */
  totalCount?: number;
  className?: string;
}

/** دراپ‌داون فشرده‌ی کلاس با جستجوی آنی داخل منو (مناسب لمس موبایل) */
export const ClassFilterDropdown: React.FC<Props> = ({ options, value, onChange, totalCount, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showAll = totalCount !== undefined;
  const current = options.find((o) => o.id === value);
  const label = value === 'all' || !current
    ? `همه کلاس‌ها (${toPersianDigits(totalCount ?? 0)})`
    : `${current.name} (${toPersianDigits(current.count)})`;

  const filtered = useMemo(() => {
    const t = q.trim();
    return t ? options.filter((o) => o.name.includes(t)) : options;
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const row = (id: string, text: string, selected: boolean) => (
    <li key={id} role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={() => pick(id)}
        className={`w-full !min-h-11 flex items-center justify-between gap-2 px-3 py-2 text-right text-xs cursor-pointer ${
          selected ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700 active:bg-slate-50'
        }`}
      >
        <span className="truncate">{text}</span>
        {selected && <Check className="w-4 h-4 shrink-0" />}
      </button>
    </li>
  );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="!min-h-0 h-11 max-w-[11rem] inline-flex items-center gap-1.5 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 cursor-pointer active:bg-slate-50"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-30 w-60 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="relative p-2 border-b border-slate-100">
            <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی کلاس..."
              className="w-full h-10 text-xs bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-lg pr-8 pl-2 outline-none [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto overscroll-contain divide-y divide-slate-50">
            {showAll && !q.trim() && row('all', `همه کلاس‌ها (${toPersianDigits(totalCount ?? 0)})`, value === 'all')}
            {filtered.map((o) => row(o.id, `${o.name} (${toPersianDigits(o.count)})`, value === o.id))}
            {filtered.length === 0 && <li className="py-5 text-center text-xs text-slate-400">کلاسی یافت نشد.</li>}
          </ul>
        </div>
      )}
    </div>
  );
};
