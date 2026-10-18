import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ChevronLeft, X } from 'lucide-react';
import { getShamsiWeekRange, toPersianDigits } from '../utils/persianDate';
import { weekStartOf } from '../utils/worksheets';

export interface DigestEntry {
  id: string;
  name: string;
  className: string;
  priority: number;
}

interface Stored {
  week: string;
  ids: string[];
  prevIds: string[] | null;
  dismissed: boolean;
}

const keyOf = (userId: string) => `yavaran:fu-digest:${userId}`;

const read = (userId: string): Stored | null => {
  try {
    const raw = window.localStorage.getItem(keyOf(userId));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
};
const write = (userId: string, value: Stored) => {
  try { window.localStorage.setItem(keyOf(userId), JSON.stringify(value)); } catch { /* ignore */ }
};

interface Props {
  userId: string;
  entries: DigestEntry[];
  /** دانش‌آموزان فهرست که این ماه هنوز به لیست خاکستری فرستاده نشده‌اند */
  unsentIds: Set<string>;
  ready: boolean;
  onOpenList: () => void;
}

/**
 * خلاصه‌ی هفتگی «نیازمند پیگیری آموزشی» برای معاونت آموزش: با شروع هر هفته خودکار نمایش داده می‌شود
 * (تعداد، تازه‌واردها و خارج‌شدگان نسبت به هفته‌ی قبل، موارد فوری و ارسال‌نشده به لیست خاکستری).
 */
export const WeeklyFollowUpDigest: React.FC<Props> = ({ userId, entries, unsentIds, ready, onOpenList }) => {
  const week = weekStartOf();
  const [state, setState] = useState<Stored | null>(null);

  // عکس ابتدای هفته: یک‌بار در هر هفته، پس از بارگذاری داده‌ها
  useEffect(() => {
    if (!ready || !userId) return;
    const stored = read(userId);
    if (stored && stored.week === week) {
      setState(stored);
      return;
    }
    const next: Stored = { week, ids: entries.map((e) => e.id), prevIds: stored ? stored.ids : null, dismissed: false };
    write(userId, next);
    setState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, week]);

  const summary = useMemo(() => {
    if (!state) return null;
    const current = new Set(entries.map((e) => e.id));
    const prev = state.prevIds ? new Set(state.prevIds) : null;
    return {
      total: entries.length,
      added: prev ? entries.filter((e) => !prev.has(e.id)) : [],
      left: prev ? Array.from(prev).filter((id) => !current.has(id)).length : 0,
      urgent: entries.filter((e) => e.priority >= 4),
      unsent: entries.filter((e) => unsentIds.has(e.id)).length,
      hasPrev: Boolean(prev),
    };
  }, [state, entries, unsentIds]);

  if (!state || state.dismissed || !summary || summary.total === 0) return null;

  const dismiss = () => {
    const next = { ...state, dismissed: true };
    write(userId, next);
    setState(next);
  };
  const range = getShamsiWeekRange(week);

  return (
    <section className="bg-gradient-to-l from-emerald-50 to-white rounded-2xl border border-emerald-200 shadow-sm p-4 sm:p-5 space-y-3" dir="rtl" aria-label="خلاصه هفتگی پیگیری آموزشی">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><CalendarCheck className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-900">خلاصه‌ی هفتگی پیگیری آموزشی</h3>
          <p className="text-xs text-slate-500 mt-0.5">{toPersianDigits(range.title)}</p>
        </div>
        <button type="button" onClick={dismiss} aria-label="بستن خلاصه‌ی این هفته" className="w-10 h-10 rounded-full hover:bg-white text-slate-400 flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'در لیست', value: summary.total, tone: 'bg-white text-slate-900' },
          { label: 'فوری (۴ مورد یا بیشتر)', value: summary.urgent.length, tone: summary.urgent.length ? 'bg-rose-50 text-rose-800' : 'bg-white text-slate-900' },
          { label: summary.hasPrev ? 'تازه وارد این هفته' : 'تازه وارد', value: summary.hasPrev ? summary.added.length : null, tone: 'bg-amber-50 text-amber-800' },
          { label: 'ارسال‌نشده به لیست خاکستری', value: summary.unsent, tone: summary.unsent ? 'bg-orange-50 text-orange-800' : 'bg-white text-slate-900' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-slate-100 px-3 py-2.5 ${s.tone}`}>
            <div className="text-[11px] font-bold opacity-75 leading-4">{s.label}</div>
            <div className="text-2xl font-black leading-8">{s.value === null ? '—' : toPersianDigits(s.value)}</div>
          </div>
        ))}
      </div>

      {summary.hasPrev && summary.left > 0 && <div className="text-xs font-bold text-emerald-700">{toPersianDigits(summary.left)} دانش‌آموز نسبت به هفته‌ی قبل از لیست خارج شده‌اند.</div>}

      {summary.urgent.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.urgent.slice(0, 6).map((e) => (
            <span key={e.id} className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-[12px] font-bold text-rose-800">{e.name} <span className="opacity-60">{e.className}</span></span>
          ))}
          {summary.urgent.length > 6 && <span className="px-2.5 py-1 text-[12px] font-bold text-slate-500">+{toPersianDigits(summary.urgent.length - 6)} نفر دیگر</span>}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onOpenList} className="flex-1 min-h-[44px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm">
          مشاهده و ارسال به لیست خاکستری <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={dismiss} className="min-h-[44px] px-4 rounded-2xl border border-slate-200 bg-white text-slate-600 text-sm font-bold cursor-pointer">متوجه شدم</button>
      </div>
    </section>
  );
};
