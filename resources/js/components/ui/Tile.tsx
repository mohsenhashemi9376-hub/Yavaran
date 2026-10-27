import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { Sparkline } from '../Sparkline';

export const TONES = {
  emerald: { box: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white/70', icon: 'bg-white/80 text-emerald-600', hint: 'text-emerald-700', line: '#059669' },
  sky: { box: 'border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white/70', icon: 'bg-white/80 text-sky-600', hint: 'text-sky-700', line: '#0284c7' },
  teal: { box: 'border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-white/70', icon: 'bg-white/80 text-teal-600', hint: 'text-teal-700', line: '#0f766e' },
  amber: { box: 'border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white/70', icon: 'bg-white/80 text-amber-600', hint: 'text-amber-700', line: '#d97706' },
  violet: { box: 'border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white/70', icon: 'bg-white/80 text-violet-600', hint: 'text-violet-700', line: '#7c3aed' },
  rose: { box: 'border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white/70', icon: 'bg-white/80 text-rose-600', hint: 'text-rose-700', line: '#e11d48' },
  indigo: { box: 'border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-white/70', icon: 'bg-white/80 text-indigo-600', hint: 'text-indigo-700', line: '#4f46e5' },
  slate: { box: 'border-slate-300/80 bg-gradient-to-br from-slate-100/90 to-white/70', icon: 'bg-white/80 text-slate-600', hint: 'text-slate-600', line: '#475569' },
} as const;

interface TileProps {
  tone: keyof typeof TONES;
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
  badge?: string;
  spark?: number[];
}

/** کاشی شیشه‌ای رنگی: عنوان، عدد درشت و لینک کوچک (هم‌سبک پنل معاون آموزشی) */
export const Tile: React.FC<TileProps> = ({ tone, label, value, hint, icon, onClick, badge, spark }) => {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[7.5rem] p-4 rounded-2xl border shadow-sm backdrop-blur-sm text-right flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer ${t.box}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-600">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.icon}`}>{icon}</span>
      </div>
      <div className="text-2xl font-black text-slate-900 tabular-nums mt-2">{value}</div>
      {spark ? (
        <div className="mt-1"><Sparkline values={spark} color={t.line} height={30} /></div>
      ) : null}
      {badge ? (
        <span className="mt-auto pt-1 self-start inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800 whitespace-nowrap">
          {badge}<ChevronLeft className="w-3 h-3" />
        </span>
      ) : (
        <span className={`mt-auto pt-1 text-xs font-medium flex items-center gap-1 ${t.hint}`}>
          <span className="truncate">{hint}</span><ChevronLeft className="w-3 h-3 shrink-0" />
        </span>
      )}
    </button>
  );
};
