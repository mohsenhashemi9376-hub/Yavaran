import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Pencil, Plus, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { apiRequest } from '../lib/serverSync';
import { toPersianDigits } from '../utils/persianDate';

type Axis = { id: string | null; title: string };
type Config = { academicYear: string; months: { key: string; label: string }[]; axes: { id: string; title: string }[] };
type Teacher = {
  id: string;
  name: string;
  hours: number;
  prevHours: number | null;
  days: number;
  scores: Record<string, number>;
  custom: { title: string; score: number }[];
  scoreTotal: number;
  scoreMax: number;
  hasEval: boolean;
  extraNote: string;
};
type Summary = { hours: number; teachers: number; submitted: number; avgHours: number; scorePct: number | null };
type Overview = { teachers: Teacher[]; summary: Summary; prevSummary: Summary | null; prevLabel: string | null };

const fa = (v: string | number) => toPersianDigits(v);
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const num = (n: number, d = 2) => fa(String(round(n, d)).replace('.', '٫'));

/** تغییر نسبت به ماه قبل: متن و رنگ */
const delta = (cur: number | null | undefined, prev: number | null | undefined, unit: string, digits: number) => {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return { text: '', cls: 'text-slate-400' };
  const d = round(cur - prev, digits);
  if (d === 0) return { text: 'بدون تغییر', cls: 'text-slate-400' };
  return { text: `${d > 0 ? '▲' : '▼'} ${num(Math.abs(d), digits)}${unit}`, cls: d > 0 ? 'text-emerald-600' : 'text-rose-600' };
};

/** نمای مدیریتی تایم‌شیت و خودارزیابی اساتید داخل پنل (جایگزین صفحهٔ جدای Blade) */
export const TimesheetOverviewWorkspace: React.FC = () => {
  const { currentUser } = useSchool();
  const canEditAxes = currentUser.role === 'admin';

  const [config, setConfig] = useState<Config | null>(null);
  const [monthKey, setMonthKey] = useState('');
  const [data, setData] = useState<Overview | null>(null);
  const [openId, setOpenId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<(Axis & { k: number })[]>([]);
  const [axesError, setAxesError] = useState('');
  const [axesMsg, setAxesMsg] = useState('');
  const [axesSaving, setAxesSaving] = useState(false);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    try {
      setData(await apiRequest<Overview>('GET', `/api/teacher-timesheets?month=${encodeURIComponent(key)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری انجام نشد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    apiRequest<Config>('GET', '/api/teacher-timesheet/config')
      .then((c) => { if (alive) { setConfig(c); setMonthKey(c.months[0]?.key ?? ''); } })
      .catch((err) => { if (alive) { setError(err instanceof Error ? err.message : 'بارگذاری انجام نشد.'); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (monthKey) void load(monthKey); }, [monthKey, load]);

  const cards = useMemo(() => {
    const s = data?.summary;
    const p = data?.prevSummary;
    if (!s) return [];
    return [
      { key: 'hours', label: 'مجموع ساعات', value: num(s.hours), ...delta(s.hours, p?.hours, ' ساعت', 1) },
      { key: 'submitted', label: 'دارای ساعت ثبت‌شده', value: `${fa(s.submitted)} از ${fa(s.teachers)}`, ...delta(s.submitted, p?.submitted, ' نفر', 0) },
      { key: 'avg', label: 'میانگین ساعت هر استاد', value: num(s.avgHours), ...delta(s.avgHours, p?.avgHours, ' ساعت', 1) },
      { key: 'score', label: 'میانگین خودارزیابی', value: s.scorePct === null ? '—' : `${num(s.scorePct, 1)}٪`, ...delta(s.scorePct, p?.scorePct, '٪', 1) },
    ];
  }, [data]);

  const startEdit = () => {
    setDraft((config?.axes ?? []).map((a, i) => ({ k: i, id: a.id, title: a.title })));
    setAxesError('');
    setAxesMsg('');
    setEditing(true);
  };
  const move = (k: number, dir: -1 | 1) => setDraft((prev) => {
    const i = prev.findIndex((a) => a.k === k);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const saveAxes = async () => {
    const axes = draft.map((a) => ({ id: a.id, title: a.title.trim() }));
    if (axes.length === 0) return setAxesError('حداقل یک شاخص لازم است.');
    if (axes.some((a) => a.title.length < 2)) return setAxesError('عنوان همه‌ی شاخص‌ها را بنویسید.');
    setAxesSaving(true);
    setAxesError('');
    try {
      const res = await apiRequest<{ axes: { id: string; title: string }[] }>('PUT', '/api/teacher-timesheet/axes', { axes });
      setConfig((c) => (c ? { ...c, axes: res.axes } : c));
      setEditing(false);
      setAxesMsg('شاخص‌ها ذخیره شد ✓');
      await load(monthKey);
    } catch (err) {
      setAxesError(err instanceof Error ? err.message : 'ذخیره انجام نشد.');
    } finally {
      setAxesSaving(false);
    }
  };

  if (!config) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-500 shadow-sm">{error || 'در حال بارگذاری…'}</div>;
  }

  const teachers = data?.teachers ?? [];

  /** جزئیات خودارزیابی یک استاد (زیر ردیف جدول یا کارت موبایل) */
  const Details: React.FC<{ t: Teacher }> = ({ t }) => (
    <div className="space-y-2">
      <div className="grid gap-x-8 gap-y-1.5 md:grid-cols-2">
        {config.axes.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600">{a.title}</span>
            <span className="font-extrabold text-slate-800">{fa(t.scores[a.id] || 0)} / ۵</span>
          </div>
        ))}
        {t.custom.map((c) => (
          <div key={c.title} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-emerald-800">{c.title}</span>
            <span className="font-extrabold text-slate-800">{fa(c.score)} / ۵</span>
          </div>
        ))}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${t.scoreMax ? Math.min(100, (t.scoreTotal / t.scoreMax) * 100) : 0}%` }} /></div>
      {t.extraNote && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-7 text-slate-700">{t.extraNote}</p>}
    </div>
  );

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">تایم‌شیت و خودارزیابی اساتید</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">سال تحصیلی {fa(config.academicYear)}</p>
        </div>
        <div className="sm:w-64">
          <label htmlFor="tso-month" className="mb-1.5 block text-xs font-bold text-slate-500">ماه کاری</label>
          <select id="tso-month" value={monthKey} onChange={(e) => { setOpenId(''); setMonthKey(e.target.value); }} className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200">
            {config.months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
      </section>

      <section aria-label="خلاصهٔ ماه">
        <div className="grid grid-cols-2 gap-2.5 text-center lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.key} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <p className="text-[11px] font-bold text-slate-500">{c.label}</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{c.value}</p>
              <p className={`mt-0.5 min-h-5 text-xs font-extrabold ${c.cls}`}>{c.text}</p>
            </div>
          ))}
        </div>
        {data?.prevSummary && data.prevLabel && <p className="mt-2 text-center text-[11px] font-medium text-slate-400">مقایسه با {data.prevLabel}</p>}
      </section>

      {canEditAxes && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="شاخص‌های خودارزیابی">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">شاخص‌های خودارزیابی</h3>
              <p className="mt-0.5 text-xs text-slate-500">{fa(config.axes.length)} شاخص ثابت · هر استاد تا ۴ شاخص شخصی هم می‌تواند اضافه کند</p>
            </div>
            {!editing && (
              <button type="button" onClick={startEdit} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-700"><Pencil className="h-4 w-4" />ویرایش</button>
            )}
          </div>
          {axesMsg && <p className="mt-2 text-xs font-bold text-emerald-700">{axesMsg}</p>}
          {editing && (
            <div className="mt-3 space-y-2">
              {draft.map((a, index) => (
                <div key={a.k} className="flex items-center gap-1.5">
                  <span className="w-6 shrink-0 text-center text-xs font-extrabold text-slate-400">{fa(index + 1)}</span>
                  <input type="text" maxLength={80} value={a.title} onChange={(e) => { const v = e.target.value; setDraft((p) => p.map((x) => (x.k === a.k ? { ...x, title: v } : x))); }} placeholder="عنوان شاخص" className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  <button type="button" onClick={() => move(a.k, -1)} aria-label="بالا" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100">↑</button>
                  <button type="button" onClick={() => move(a.k, 1)} aria-label="پایین" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100">↓</button>
                  <button type="button" onClick={() => setDraft((p) => p.filter((x) => x.k !== a.k))} aria-label="حذف" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100"><X className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setDraft((p) => [...p, { k: Math.max(-1, ...p.map((x) => x.k)) + 1, id: null, title: '' }])} disabled={draft.length >= 12} className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 text-sm font-extrabold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"><Plus className="h-4 w-4" />افزودن شاخص</button>
              {axesError && <p className="text-xs font-bold text-rose-600">{axesError}</p>}
              <div className="grid grid-cols-2 gap-2 pt-1 sm:max-w-sm">
                <button type="button" onClick={() => { setEditing(false); setAxesError(''); }} className="min-h-12 rounded-xl bg-slate-100 text-sm font-extrabold text-slate-700 hover:bg-slate-200">انصراف</button>
                <button type="button" onClick={() => void saveAxes()} disabled={axesSaving} className="min-h-12 rounded-xl bg-slate-900 text-sm font-extrabold text-white hover:bg-slate-700 disabled:opacity-50">{axesSaving ? 'در حال ذخیره…' : 'ذخیره شاخص‌ها'}</button>
              </div>
              <p className="text-[11px] leading-5 text-slate-400">حذف یا تغییر شاخص، نمره‌های قبلی ثبت‌شده را پاک نمی‌کند ولی دیگر در امتیاز کل حساب نمی‌شود.</p>
            </div>
          )}
        </section>
      )}

      {loading && <p className="py-6 text-center text-sm font-medium text-slate-500">در حال بارگذاری…</p>}
      {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
      {!loading && !error && teachers.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">استادی یافت نشد.</p>}

      {!loading && teachers.length > 0 && (
        <>
          {/* دسکتاپ: جدول */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-right">استاد</th>
                  <th className="px-3 py-3 text-center">روز ثبت‌شده</th>
                  <th className="px-3 py-3 text-center">مجموع ساعت</th>
                  <th className="px-3 py-3 text-center">نسبت به ماه قبل</th>
                  <th className="px-3 py-3 text-center">خودارزیابی</th>
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map((t) => {
                  const d = delta(t.hours, t.prevHours, ' ساعت', 1);
                  const isOpen = openId === t.id;
                  return (
                    <React.Fragment key={t.id}>
                      <tr onClick={() => setOpenId(isOpen ? '' : t.id)} className="cursor-pointer hover:bg-slate-50">
                        <td className="px-4 py-3 font-extrabold text-slate-900">{t.name}</td>
                        <td className="px-3 py-3 text-center font-bold text-slate-700">{fa(t.days)}</td>
                        <td className="px-3 py-3 text-center"><span className="rounded-full bg-emerald-50 px-3 py-1 font-extrabold text-emerald-700">{t.days ? num(t.hours) : '—'} ساعت</span></td>
                        <td className={`px-3 py-3 text-center text-xs font-extrabold ${d.cls}`}>{d.text}</td>
                        <td className="px-3 py-3 text-center font-bold text-slate-700">{t.hasEval ? `${fa(t.scoreTotal)} / ${fa(t.scoreMax)}` : '—'}</td>
                        <td className="px-3 py-3 text-slate-400"><ChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} /></td>
                      </tr>
                      {isOpen && <tr className="bg-slate-50/60"><td colSpan={6} className="px-4 py-4"><Details t={t} /></td></tr>}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* موبایل: کارت */}
          <ul className="space-y-2 md:hidden">
            {teachers.map((t) => {
              const d = delta(t.hours, t.prevHours, ' ساعت', 1);
              const isOpen = openId === t.id;
              return (
                <li key={t.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <button type="button" onClick={() => setOpenId(isOpen ? '' : t.id)} aria-expanded={isOpen} className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-start">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold">{t.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{fa(t.days)} روز ثبت‌شده · خودارزیابی {t.hasEval ? `${fa(t.scoreTotal)} / ${fa(t.scoreMax)}` : '—'}</span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-extrabold text-emerald-700">{t.days ? num(t.hours) : '—'} ساعت</span>
                      <span className={`mt-0.5 block text-[11px] font-extrabold ${d.cls}`}>{d.text}</span>
                    </span>
                  </button>
                  {isOpen && <div className="border-t border-slate-100 p-4"><Details t={t} /></div>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};
