import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, LogIn, LogOut, Plus, Star, X } from 'lucide-react';
import { apiRequest } from '../lib/serverSync';
import { getRealTodayShamsiString, tehranNow, toPersianDigits } from '../utils/persianDate';
import { ClockTimePicker } from './ClockTimePicker';

type Day = { date: string; g: string; label: string; weekday: string; off: boolean };
type Month = { key: string; label: string; days: Day[] };
type Axis = { id: string; title: string };
type Config = { academicYear: string; months: Month[]; axes: Axis[]; tags: Record<string, string> };
type Entry = { in?: string | null; out?: string | null; in2?: string | null; out2?: string | null; tags?: string[]; otherText?: string };
type Entries = Record<string, Entry>;
type Evaluation = { scores?: Record<string, number>; extraNote?: string };
type Payload = { entries?: Entries | []; selfEvaluation?: Evaluation | []; customAxes?: Axis[] };
const CUSTOM_IDS = ['c1', 'c2', 'c3', 'c4'];
type Tab = 'timesheet' | 'evaluation';
type Step = 'in' | 'out' | 'in2' | 'out2' | 'done';

const pad = (n: number) => String(n).padStart(2, '0');
const fa = (v: string | number) => toPersianDigits(v);
const toMin = (t?: string | null) => (t && /^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
const span = (a?: string | null, b?: string | null) => {
  const x = toMin(a);
  const y = toMin(b);
  return x === null || y === null || y <= x ? null : y - x;
};
const dayMinutes = (e?: Entry) => {
  const a = span(e?.in, e?.out);
  const b = span(e?.in2, e?.out2);
  return a === null && b === null ? null : (a || 0) + (b || 0);
};
const hoursText = (min: number | null) => (min === null ? '—' : fa((Math.round((min / 60) * 100) / 100).toString()).replace('.', '٫'));
const isInvalid = (e?: Entry) => {
  if (!e) return false;
  const bad = (x?: string | null, y?: string | null) => toMin(x) !== null && toMin(y) !== null && (toMin(y) as number) <= (toMin(x) as number);
  const overlap = toMin(e.out) !== null && toMin(e.in2) !== null && (toMin(e.in2) as number) < (toMin(e.out) as number);
  return bad(e.in, e.out) || bad(e.in2, e.out2) || overlap;
};
const stepOf = (e: Entry): Step => (e.out2 ? 'done' : e.in2 ? 'out2' : e.out ? 'in2' : e.in ? 'out' : 'in');
const PUNCH_LABEL: Record<Step, string> = { in: 'ثبت ورود به مدرسه', out: 'ثبت خروج', in2: 'ثبت ورود دوم', out2: 'ثبت خروج دوم', done: 'پایان روز' };
const FIELDS: { id: 'in' | 'out' | 'in2' | 'out2'; label: string }[] = [
  { id: 'in', label: 'ورود' }, { id: 'out', label: 'خروج' }, { id: 'in2', label: 'ورود دوم' }, { id: 'out2', label: 'خروج دوم' },
];

const currentHM = () => {
  const n = tehranNow();
  return `${pad(n.getHours())}:${pad(n.getMinutes())}`;
};

/** ساعت کاری و خودارزیابی ماهانه‌ی اساتید داخل پنل (جایگزین صفحهٔ جداگانهٔ Blade) */
export const TimesheetWorkspace: React.FC = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [monthKey, setMonthKey] = useState('');
  const [entries, setEntries] = useState<Entries>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [extraNote, setExtraNote] = useState('');
  const [customAxes, setCustomAxes] = useState<Axis[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [tab, setTab] = useState<Tab>('timesheet');
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [punchError, setPunchError] = useState('');
  const [, setTick] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef({ monthKey, entries, scores, extraNote, customAxes });
  latest.current = { monthKey, entries, scores, extraNote, customAxes };

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const todayShamsi = getRealTodayShamsiString();
  const now = tehranNow();
  const todayG = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const month = useMemo(() => config?.months.find((m) => m.key === monthKey), [config, monthKey]);
  const todayMonth = useMemo(() => config?.months.find((m) => m.days.some((d) => d.g === todayG)), [config, todayG]);
  const todayDay = month?.days.find((d) => d.g === todayG);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    try {
      const d = await apiRequest<Payload>('GET', `/api/teacher-timesheet?month=${encodeURIComponent(key)}`);
      setEntries(Array.isArray(d.entries) ? {} : d.entries || {});
      const ev = (Array.isArray(d.selfEvaluation) ? {} : d.selfEvaluation || {}) as Evaluation;
      setScores(ev.scores || {});
      setExtraNote(ev.extraNote || '');
      setCustomAxes(Array.isArray(d.customAxes) ? d.customAxes : []);
      setNewTitle('');
      setDirty(false);
      setStatus('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری انجام نشد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    apiRequest<Config>('GET', '/api/teacher-timesheet/config')
      .then((c) => {
        if (!alive) return;
        setConfig(c);
        const hit = c.months.find((m) => m.days.some((d) => d.g === todayG));
        const key = (hit || (todayG < c.months[0].days[0].g ? c.months[0] : c.months[c.months.length - 1])).key;
        setMonthKey(key);
      })
      .catch((err) => { if (alive) { setError(err instanceof Error ? err.message : 'بارگذاری انجام نشد.'); setLoading(false); } });
    return () => { alive = false; };
    // فقط یک بار هنگام باز شدن بخش
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (monthKey) void load(monthKey); }, [monthKey, load]);

  const isOpen = (d: Day) => !d.off && d.g <= todayG;

  const save = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(timer.current);
    const cur = latest.current;
    if (!cur.monthKey || !config) return true;
    const month = config.months.find((m) => m.key === cur.monthKey);
    if (!month) return true;
    setSaving(true);
    setError('');
    try {
      const out: Entries = {};
      for (const d of month.days) {
        const e = cur.entries[d.date];
        if (!e || !isOpen(d)) continue;
        if (e.in || e.out || e.in2 || e.out2 || (e.tags || []).length) {
          const tags = e.tags || [];
          out[d.date] = { in: e.in || null, out: e.out || null, in2: e.in2 || null, out2: e.out2 || null, tags, otherText: tags.includes('other') ? (e.otherText || '').trim() : '' };
        }
      }
      await apiRequest('POST', '/api/teacher-timesheet', { month: cur.monthKey, entries: out, selfEvaluation: { scores: cur.scores, extraNote: cur.extraNote, customAxes: cur.customAxes.map((a) => ({ id: a.id, title: a.title.trim() })) } });
      setDirty(false);
      setStatus('ذخیره شد ✓');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره انجام نشد. دوباره تلاش کنید.');
      return false;
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, todayG]);

  const touch = () => {
    setDirty(true);
    setStatus('');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), 1500);
  };

  // ذخیرهٔ خودکار هنگام خروج از بخش
  const saveRef = useRef(save);
  saveRef.current = save;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => () => { window.clearTimeout(timer.current); if (dirtyRef.current) void saveRef.current(); }, []);

  const patchEntry = (date: string, patch: Partial<Entry>) => {
    setEntries((prev) => ({ ...prev, [date]: { ...(prev[date] || {}), ...patch } }));
    touch();
  };

  const toggleTag = (date: string, key: string) => {
    const cur = entries[date]?.tags || [];
    patchEntry(date, { tags: cur.includes(key) ? cur.filter((t) => t !== key) : [...cur, key] });
  };

  const changeMonth = async (key: string) => {
    if (dirty) await save();
    setMonthKey(key);
  };

  // ---------- ثبت سریع ----------
  const todayEntry = (todayDay && entries[todayDay.date]) || {};
  const step = stepOf(todayEntry);
  const working = step === 'out' || step === 'out2';
  const canPunch = Boolean(todayDay) && !todayDay?.off && !loading && step !== 'done';

  const punch = async () => {
    if (!todayDay || !canPunch) return;
    setPunchError('');
    const e: Entry = { ...(entries[todayDay.date] || {}) };
    const hm = currentHM();
    const m = toMin(hm) ?? 0;
    const s = stepOf(e);
    if (s === 'in') { e.in = hm; if (!e.tags || e.tags.length === 0) e.tags = ['teaching']; }
    else if (s === 'out') { if (m <= (toMin(e.in) ?? 0)) return setPunchError('خروج باید دست‌کم یک دقیقه بعد از ورود باشد.'); e.out = hm; }
    else if (s === 'in2') { if (m < (toMin(e.out) ?? 0)) return setPunchError('ورود دوم باید بعد از خروج اول باشد.'); e.in2 = hm; }
    else if (s === 'out2') { if (m <= (toMin(e.in2) ?? 0)) return setPunchError('خروج دوم باید دست‌کم یک دقیقه بعد از ورود دوم باشد.'); e.out2 = hm; }
    else return;
    latest.current = { ...latest.current, entries: { ...latest.current.entries, [todayDay.date]: e } };
    setEntries(latest.current.entries);
    await save();
  };

  // ---------- آمار ----------
  const days = month?.days || [];
  const totalMin = days.reduce((sum, d) => sum + (dayMinutes(entries[d.date]) || 0), 0);
  const filled = days.filter((d) => dayMinutes(entries[d.date]) !== null).length;
  const openCount = days.filter(isOpen).length;
  const allAxes = [...(config?.axes || []), ...customAxes];
  const totalScore = allAxes.reduce((s, a) => s + (scores[a.id] || 0), 0);
  const atLimit = customAxes.length >= CUSTOM_IDS.length;
  const addCustom = () => {
    const title = newTitle.trim();
    const id = CUSTOM_IDS.find((c) => !customAxes.some((a) => a.id === c));
    if (title.length < 2 || !id) return;
    setCustomAxes((p) => [...p, { id, title }]);
    setNewTitle('');
    touch();
  };
  const removeCustom = (id: string) => {
    setCustomAxes((p) => p.filter((a) => a.id !== id));
    setScores((p) => { const { [id]: _drop, ...rest } = p; return rest; });
    touch();
  };

  const ringSeconds = now.getSeconds();
  const sessions = [
    todayEntry.in ? { label: 'نوبت اول', a: todayEntry.in, b: todayEntry.out } : null,
    todayEntry.in2 ? { label: 'نوبت دوم', a: todayEntry.in2, b: todayEntry.out2 } : null,
  ].filter(Boolean) as { label: string; a: string; b?: string | null }[];

  const hint = !config ? '' : !todayMonth ? 'امروز در بازهٔ سال تحصیلی نیست.' : todayDay?.off ? 'امروز تعطیل است.' : !todayDay ? 'ماه امروز را از فهرست انتخاب کنید.' : '';

  if (!config) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-sm">{error || 'در حال بارگذاری…'}</div>;
  }

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* ثبت سریع ورود و خروج */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 p-5 text-white shadow-sm" aria-label="ثبت ورود و خروج">
        <div className="pointer-events-none absolute -start-10 -top-10 h-48 w-48 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:gap-8">
          <div className="flex items-center gap-4 md:shrink-0">
            <div className="relative h-24 w-24 shrink-0">
              <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(51 65 85)" strokeWidth="5" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(52 211 153)" strokeWidth="5" strokeLinecap="round" strokeDasharray="276.5" strokeDashoffset={276.5 * (1 - ringSeconds / 60)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold tabular-nums">{fa(pad(ringSeconds))}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-emerald-300">{todayDay ? `${todayDay.weekday} ${todayDay.label}` : fa(todayShamsi)}</p>
              <p className="text-4xl font-extrabold leading-tight tabular-nums" dir="ltr">{fa(currentHM())}</p>
              <p className="text-xs font-medium text-slate-400">ساعت اکنون (به وقت تهران)</p>
            </div>
          </div>

          {sessions.length > 0 && (
            <div className="min-w-0 flex-1">
              <ul className="space-y-1.5">
                {sessions.map((s) => (
                  <li key={s.label} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm">
                    <span className="font-bold text-emerald-200">{s.label}</span>
                    <span className="font-extrabold tabular-nums">ورود {fa(s.a)} · خروج {s.b ? fa(s.b) : '…'}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-300">جمع امروز: <span className="font-extrabold text-white">{hoursText(dayMinutes(todayEntry))}</span> ساعت</p>
            </div>
          )}

          <div className="md:ms-auto md:w-72 md:shrink-0">
            {step !== 'done' ? (
              <button
                type="button"
                onClick={punch}
                disabled={!canPunch || saving}
                className={`flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl px-4 text-lg font-extrabold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40 ${working ? 'bg-rose-500 shadow-rose-900/30' : 'bg-emerald-500 shadow-emerald-900/30'}`}
              >
                {working ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
                {saving ? 'در حال ثبت…' : PUNCH_LABEL[step]}
              </button>
            ) : (
              <div className="rounded-2xl bg-white/10 p-4 text-center text-base font-extrabold text-emerald-300">خسته نباشید، امروز دو نوبت ثبت شد ✓</div>
            )}
            {(punchError || hint) && (
              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <span className={punchError ? 'font-bold text-rose-300' : 'text-slate-300'}>{punchError || hint}</span>
                {!todayDay && todayMonth && (
                  <button type="button" onClick={() => void changeMonth(todayMonth.key)} className="min-h-11 shrink-0 rounded-xl bg-slate-700 px-3 font-bold text-white active:bg-slate-600">رفتن به ماه امروز</button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ماه کاری + تب‌ها */}
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
          {([['timesheet', 'ثبت ساعات کاری', Clock], ['evaluation', 'خودارزیابی ماهانه', Star]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-12 rounded-xl px-2 text-sm font-extrabold transition flex items-center justify-center gap-1.5 ${tab === id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="ts-month" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-500"><CalendarDays className="h-3.5 w-3.5" />ماه کاری</label>
          <select id="ts-month" value={monthKey} onChange={(e) => void changeMonth(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200">
            {config.months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
      </section>

      {/* آمار ماه */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-600 p-4 text-white shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-emerald-100">مجموع ساعات کاری این ماه</p>
            <p className="mt-1 text-3xl font-extrabold leading-none">{hoursText(totalMin || null)} <span className="text-base font-bold text-emerald-100">ساعت</span></p>
          </div>
          <dl className="flex gap-4 text-center text-xs">
            <div><dt className="text-emerald-100">روز ثبت‌شده</dt><dd className="mt-1 text-base font-extrabold">{fa(filled)} / {fa(openCount)}</dd></div>
            <div><dt className="text-emerald-100">میانگین روزانه</dt><dd className="mt-1 text-base font-extrabold">{filled ? hoursText(totalMin / filled) : '—'}</dd></div>
          </dl>
        </div>
      </section>

      {(error || loading) && (
        <p className={`text-center text-sm font-bold ${error ? 'text-rose-600' : 'text-slate-500'}`}>{error || 'در حال بارگذاری…'}</p>
      )}

      {/* ثبت ساعات کاری */}
      {tab === 'timesheet' && !loading && (
        <section className="space-y-3" aria-label="ثبت ساعات کاری">
          {days.map((day) => {
            const e = entries[day.date] || {};
            const open = isOpen(day);
            const minutes = dayMinutes(e);
            const invalid = isInvalid(e);
            const isToday = day.g === todayG;
            const showSecond = Boolean(e.in2 || e.out2 || (e.in && e.out));
            const tone = day.off ? 'border-slate-200 bg-slate-100 opacity-60 grayscale'
              : !open ? 'border-slate-200 bg-slate-50 opacity-50'
              : isToday ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
              : invalid ? 'border-rose-300 bg-rose-50'
              : minutes !== null ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-white';
            const badge = invalid ? 'bg-rose-100 text-rose-700' : minutes !== null ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400';
            return (
              <article key={day.date} className={`flex flex-col gap-3 rounded-2xl border p-3 shadow-sm md:flex-row md:items-center md:gap-4 md:p-4 ${tone}`}>
                <div className="flex items-center justify-between gap-2 md:w-28 md:shrink-0 md:flex-col md:items-start md:justify-center">
                  <div>
                    <p className="text-sm font-extrabold text-slate-800">
                      {day.label}
                      {isToday && <span className="ms-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">امروز</span>}
                    </p>
                    <p className="text-xs font-medium text-slate-500">{day.weekday}{day.off ? ' · تعطیل' : !open ? ' · روز آینده' : ''}</p>
                  </div>
                  {open && <span className={`min-w-20 rounded-full px-3 py-1.5 text-center text-sm font-extrabold md:hidden ${badge}`}>{hoursText(minutes)}{minutes !== null && <span className="text-xs font-bold"> ساعت</span>}</span>}
                </div>

                {open ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
                      {FIELDS.filter((f) => showSecond || f.id === 'in' || f.id === 'out').map((f) => (
                        <div key={f.id} className="md:w-24">
                          <span className="mb-1 block text-[11px] font-bold text-slate-500">{f.label}</span>
                          <ClockTimePicker
                            label={`${f.label} — ${day.label}`}
                            value={e[f.id] || ''}
                            onChange={(v) => patchEntry(day.date, { [f.id]: v || null })}
                            className={`min-h-12 w-full rounded-xl border text-lg font-extrabold shadow-sm transition md:text-base ${e[f.id] ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
                          />
                        </div>
                      ))}
                    </div>
                    {invalid && <p className="text-xs font-bold text-rose-600 md:order-last">ساعت‌ها معتبر نیست (خروج باید بعد از ورود باشد).</p>}
                    <div className="flex flex-wrap items-center gap-2 md:flex-1" role="group" aria-label="فعالیت‌های روز">
                      {Object.entries(config.tags).map(([key, label]) => {
                        const on = (e.tags || []).includes(key);
                        return (
                          <button key={key} type="button" aria-pressed={on} onClick={() => toggleTag(day.date, key)} className={`min-h-11 rounded-full border px-4 text-sm font-bold transition md:min-h-9 md:px-3 md:text-xs ${on ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 active:bg-slate-100'}`}>{label}</button>
                        );
                      })}
                      {(e.tags || []).includes('other') && (
                        <input type="text" maxLength={120} value={e.otherText || ''} onChange={(ev) => patchEntry(day.date, { otherText: ev.target.value })} placeholder="فعالیت دلخواه…" aria-label="شرح سایر موارد" className="min-h-11 w-full rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 text-sm font-bold text-slate-800 placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 md:min-h-9 md:w-56 md:text-xs" />
                      )}
                    </div>
                    <span className={`hidden w-28 shrink-0 rounded-xl px-3 py-2 text-center text-base font-extrabold md:block ${badge}`}>{hoursText(minutes)}{minutes !== null && <span className="text-xs font-bold"> ساعت</span>}</span>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2 md:flex md:flex-1 md:justify-start">
                    {[0, 1].map((i) => <span key={i} className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-200/60 text-lg font-extrabold text-slate-400 md:w-24 md:text-base">--:--</span>)}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* خودارزیابی */}
      {tab === 'evaluation' && !loading && (
        <section className="space-y-3" aria-label="خودارزیابی ماهانه">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-600">امتیاز کل خودارزیابی</p>
            <p className="text-lg font-extrabold text-emerald-700">{fa(totalScore)} از {fa(allAxes.length * 5)}</p>
          </div>
          {config.axes.map((axis, i) => {
            const sc = scores[axis.id] || 0;
            return (
              <article key={axis.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-extrabold leading-7 text-slate-800"><span className="me-1 text-emerald-600">{fa(i + 1)}.</span>{axis.title}</h2>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">{fa(sc)} / ۵</span>
                </div>
                <div className="mt-3 flex items-center gap-1" role="group" aria-label={axis.title}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-label={String(n)} onClick={() => { setScores((p) => ({ ...p, [axis.id]: sc === n ? 0 : n })); touch(); }} className={`flex h-12 w-12 items-center justify-center rounded-xl active:bg-slate-100 ${sc >= n ? 'text-amber-400' : 'text-slate-300'}`}>
                      <Star className="h-8 w-8" fill={sc >= n ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                  <button type="button" onClick={() => { setScores((p) => ({ ...p, [axis.id]: 0 })); touch(); }} className="ms-auto min-h-11 rounded-xl px-3 text-xs font-bold text-slate-500 active:bg-slate-100">صفر</button>
                </div>
                {axis.id === 'extra' && (
                  <div className="mt-3">
                    <label htmlFor="ts-extra" className="mb-1 block text-xs font-bold text-slate-500">شرح کارهای اضافه‌ای که انجام داده‌اید</label>
                    <textarea id="ts-extra" rows={5} maxLength={3000} value={extraNote} onChange={(ev) => { setExtraNote(ev.target.value); touch(); }} placeholder="کارهای انجام‌شده‌ی فراتر از وظایف اصلی را اینجا بنویسید…" className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                )}
              </article>
            );
          })}
          {customAxes.map((axis) => {
            const sc = scores[axis.id] || 0;
            return (
              <article key={axis.id} className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <input type="text" maxLength={60} value={axis.title} aria-label="عنوان شاخص" onChange={(ev) => { const v = ev.target.value; setCustomAxes((p) => p.map((a) => (a.id === axis.id ? { ...a, title: v } : a))); touch(); }} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-extrabold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">{fa(sc)} / ۵</span>
                  <button type="button" aria-label="حذف شاخص" onClick={() => removeCustom(axis.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 active:bg-rose-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="mt-3 flex items-center gap-1" role="group" aria-label={axis.title}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-label={String(n)} onClick={() => { setScores((p) => ({ ...p, [axis.id]: sc === n ? 0 : n })); touch(); }} className={`flex h-12 w-12 items-center justify-center rounded-xl active:bg-slate-100 ${sc >= n ? 'text-amber-400' : 'text-slate-300'}`}>
                      <Star className="h-8 w-8" fill={sc >= n ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                  <button type="button" onClick={() => { setScores((p) => ({ ...p, [axis.id]: 0 })); touch(); }} className="ms-auto min-h-11 rounded-xl px-3 text-xs font-bold text-slate-500 active:bg-slate-100">صفر</button>
                </div>
              </article>
            );
          })}

          <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-emerald-900">افزودن شاخص شخصی</h2>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-emerald-700">{fa(customAxes.length)} از {fa(CUSTOM_IDS.length)}</span>
            </div>
            <p className="mt-1 text-xs leading-6 text-slate-500">می‌توانید تا ۴ شاخص دلخواه خودتان را به فهرست خودارزیابی اضافه کنید.</p>
            {atLimit ? (
              <p className="mt-3 text-xs font-bold text-emerald-800">به سقف ۴ شاخص رسیده‌اید؛ برای افزودن مورد جدید، یکی را حذف کنید.</p>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <input type="text" maxLength={60} value={newTitle} onChange={(ev) => setNewTitle(ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addCustom(); } }} placeholder="مثلاً: مشارکت در برنامه‌های فرهنگی" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                <button type="button" onClick={addCustom} disabled={newTitle.trim().length < 2} className="inline-flex min-h-12 shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white shadow-sm active:bg-emerald-700 disabled:opacity-40"><Plus className="h-4 w-4" />افزودن</button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* وضعیت ذخیره + دکمهٔ ذخیره (پایین، نزدیک شست) */}
      <div className="sticky bottom-20 z-10 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur md:bottom-4">
        <p className={`flex-1 px-2 text-xs font-bold ${error ? 'text-rose-600' : dirty ? 'text-amber-600' : 'text-emerald-700'}`}>
          {saving ? 'در حال ذخیره…' : error || (dirty ? 'ذخیره‌نشده' : status && <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />{status}</span>)}
        </p>
        <button type="button" onClick={() => void save()} disabled={saving} className="min-h-12 rounded-xl bg-slate-900 px-6 text-sm font-extrabold text-white shadow-sm active:bg-slate-700 disabled:opacity-50">ذخیره</button>
      </div>
    </div>
  );
};
