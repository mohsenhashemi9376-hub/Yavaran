import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Clock } from 'lucide-react';
import { apiRequest } from '../lib/serverSync';
import { getTodayShamsi, tehranNow, toPersianDigits } from '../utils/persianDate';

type Entry = { in?: string | null; out?: string | null; in2?: string | null; out2?: string | null; tags?: string[]; otherText?: string };
type TimesheetPayload = { entries?: Record<string, Entry> | []; selfEvaluation?: Record<string, unknown> | [] };

const MONTH_KEYS: Record<number, string> = { 7: 'mehr', 8: 'aban', 9: 'azar', 10: 'dey', 11: 'bahman', 12: 'esfand', 1: 'farvardin', 2: 'ordibehesht', 3: 'khordad' };

/** کلید ماه کاری (۲۶ ماه قبل تا ۲۵ همان ماه)؛ بیرون از سال تحصیلی ۱۴۰۵-۱۴۰۶ ⇒ null */
const workMonthKey = (y: number, m: number, d: number): string | null => {
  const jm = d >= 26 ? (m === 12 ? 1 : m + 1) : m;
  const jy = d >= 26 && m === 12 ? y + 1 : y;
  if (jm === 7 && d >= 26) return null; // مهر فقط ۱ تا ۲۵ مهر است
  const ok = (jm >= 7 && jy === 1405) || (jm <= 3 && jy === 1406);
  return ok ? MONTH_KEYS[jm] ?? null : null;
};

const toMin = (t?: string | null) => (t && /^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
const span = (a?: string | null, b?: string | null) => {
  const x = toMin(a); const y = toMin(b);
  return x === null || y === null || y <= x ? 0 : y - x;
};

type Step = 'in' | 'out' | 'in2' | 'out2' | 'done';
const stepOf = (e: Entry): Step => (e.out2 ? 'done' : e.in2 ? 'out2' : e.out ? 'in2' : e.in ? 'out' : 'in');
const LABEL: Record<Step, string> = { in: 'ثبت ورود', out: 'ثبت خروج', in2: 'ثبت ورود دوم', out2: 'ثبت خروج دوم', done: 'پایان روز' };

const PUNCH_EVENT = 'yv-teacher-punch';

/** منطق مشترک ثبت ورود/خروج؛ دکمه‌ی هدر و کاشی ساعت کاری با رویداد همگام می‌مانند */
export const useTeacherPunch = () => {
  const today = getTodayShamsi();
  const monthKey = useMemo(() => workMonthKey(today.year, today.month, today.day), [today.year, today.month, today.day]);
  const isFriday = today.dayOfWeek === 'جمعه';
  const [entry, setEntry] = useState<Entry>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (): Promise<TimesheetPayload | null> => {
    if (!monthKey) return null;
    return apiRequest<TimesheetPayload>('GET', `/api/teacher-timesheet?month=${monthKey}`);
  }, [monthKey]);

  useEffect(() => {
    let alive = true;
    load().then((d) => { if (alive && d) setEntry((d.entries as Record<string, Entry>)?.[today.formattedDate] || {}); }).catch(() => undefined);
    const onSync = (ev: Event) => setEntry((ev as CustomEvent<Entry>).detail || {});
    window.addEventListener(PUNCH_EVENT, onSync);
    return () => { alive = false; window.removeEventListener(PUNCH_EVENT, onSync); };
  }, [load, today.formattedDate]);

  const step = stepOf(entry);
  const minutes = span(entry.in, entry.out) + span(entry.in2, entry.out2);
  const hoursText = minutes ? toPersianDigits((Math.round((minutes / 60) * 100) / 100).toString()).replace('.', '٫') : '—';
  const disabled = busy || !monthKey || isFriday || step === 'done';

  const punch = async () => {
    if (disabled || !monthKey) return;
    setBusy(true);
    setError('');
    try {
      const fresh = (await load()) || {};
      const entries = { ...((Array.isArray(fresh.entries) ? {} : fresh.entries) || {}) } as Record<string, Entry>;
      const e: Entry = { ...(entries[today.formattedDate] || {}) };
      const now = tehranNow();
      const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const m = toMin(hm) ?? 0;
      const s = stepOf(e);
      if (s === 'in') { e.in = hm; if (!e.tags || e.tags.length === 0) e.tags = ['teaching']; }
      else if (s === 'out') { if (m <= (toMin(e.in) ?? 0)) throw new Error('خروج باید دست‌کم یک دقیقه بعد از ورود باشد.'); e.out = hm; }
      else if (s === 'in2') { if (m < (toMin(e.out) ?? 0)) throw new Error('ورود دوم باید بعد از خروج اول باشد.'); e.in2 = hm; }
      else if (s === 'out2') { if (m <= (toMin(e.in2) ?? 0)) throw new Error('خروج دوم باید دست‌کم یک دقیقه بعد از ورود دوم باشد.'); e.out2 = hm; }
      else return;
      entries[today.formattedDate] = e;
      await apiRequest('POST', '/api/teacher-timesheet', {
        month: monthKey,
        entries,
        selfEvaluation: Array.isArray(fresh.selfEvaluation) ? {} : fresh.selfEvaluation || {},
      });
      setEntry(e);
      window.dispatchEvent(new CustomEvent(PUNCH_EVENT, { detail: e }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت انجام نشد. دوباره تلاش کنید.');
    } finally {
      setBusy(false);
    }
  };

  const working = step === 'out' || step === 'out2';
  const hint = isFriday ? 'امروز تعطیل است' : !monthKey ? 'خارج از سال تحصیلی' : step === 'done' ? 'خسته نباشید ✓' : working ? `ورود: ${toPersianDigits((step === 'out' ? entry.in : entry.in2) || '')}` : `جمع امروز: ${hoursText} ساعت`;
  return { step, busy, disabled, working, error, hint, hoursText, punch };
};

/** دکمه‌ی ورود/خروج زیر نام دبیر در هدر داشبورد: ورود اول ← خروج اول ← ورود دوم ← خروج دوم */
export const TeacherPunchButton: React.FC = () => {
  const { step, busy, disabled, working, error, hint, punch } = useTeacherPunch();
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={punch}
        disabled={disabled}
        className={`min-h-12 w-full rounded-xl text-sm font-extrabold text-white inline-flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${working ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-700 hover:bg-emerald-800'}`}
      >
        <Clock className="w-4 h-4" />
        {busy ? 'در حال ثبت…' : LABEL[step]}
      </button>
      {(error || step !== 'in') && <p className={`text-[11px] text-center ${error ? 'text-rose-600' : 'text-slate-500'}`}>{error || hint}</p>}
    </div>
  );
};

interface Props { onOpenTimesheet: () => void }

/** کاشی «ساعت کاری» در داشبورد دبیر: فقط جمع امروز و ورود به برگه؛ ثبت ورود/خروج از دکمه‌ی هدر انجام می‌شود */
export const TeacherPunchTile: React.FC<Props> = ({ onOpenTimesheet }) => {
  const { hoursText } = useTeacherPunch();
  return (
    <button type="button" onClick={onOpenTimesheet} className="min-h-[7.5rem] p-4 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white/70 shadow-sm backdrop-blur-sm text-right flex flex-col cursor-pointer">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-xs font-bold text-slate-600">ساعت کاری</span>
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-white/80 text-amber-600"><Clock className="w-4 h-4" /></span>
      </div>
      <span className="mt-2 text-2xl font-black text-slate-900">{hoursText}</span>
      <span className="mt-auto pt-1.5 text-xs font-medium text-amber-700 flex items-center gap-1">
        <span className="truncate">جمع امروز (ساعت)</span><ChevronLeft className="w-3 h-3 shrink-0" />
      </span>
    </button>
  );
};
