import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Activity, AlertTriangle, ArrowLeft, BarChart3, Clock, Download, Eye, Flame, LayoutGrid, MapPin,
  ChevronDown, FileText, FolderOpen, Plus, Search, Users, X,
} from 'lucide-react';
import { SchoolClass, Student, StudentObservation, ObservationCategory } from '../types';
import { toPersianDigits, tehranNow, shamsiStringToDate } from '../utils/persianDate';
import { normalizeShamsi } from '../utils/schoolCalendar';
import { studentFullName } from '../utils/studentName';
import { exportStudentObservationsWord } from '../utils/observationWord';

/* ───────────────────────── ثابت‌ها ───────────────────────── */

export const CATS: { key: ObservationCategory; label: string; short: string; hex: string; soft: string }[] = [
  { key: 'behavioral', label: 'رفتاری و انضباطی', short: 'رفتاری', hex: '#2563eb', soft: '#eff6ff' },
  { key: 'social', label: 'اجتماعی و ارتباط با همسالان', short: 'اجتماعی', hex: '#0d9488', soft: '#f0fdfa' },
  { key: 'emotional', label: 'عاطفی و مدیریت هیجانات', short: 'عاطفی', hex: '#e11d48', soft: '#fff1f2' },
  { key: 'moral', label: 'اخلاقی، ارزشی و دینی', short: 'اخلاقی', hex: '#059669', soft: '#ecfdf5' },
  { key: 'learning_attitude', label: 'نگرش و انگیزش تحصیلی', short: 'تحصیلی', hex: '#7c3aed', soft: '#f5f3ff' },
  { key: 'family', label: 'مسائل خانوادگی', short: 'خانوادگی', hex: '#d97706', soft: '#fffbeb' },
  { key: 'other', label: 'سایر ملاحظات', short: 'سایر', hex: '#64748b', soft: '#f8fafc' },
];
const CAT = Object.fromEntries(CATS.map((c) => [c.key, c])) as Record<string, (typeof CATS)[number]>;
export const catOf = (k: string) => CAT[k] || CAT.other;
const CONCERN_CATS: ObservationCategory[] = ['emotional', 'family'];

type Period = '7' | '30' | 'all';
export type Tab = 'overview' | 'timeline' | 'students';

const DAY = 86400000;
const fa = toPersianDigits;

/* ───────────────────────── ابزارها ───────────────────────── */

interface Obs extends StudentObservation {
  _day: number; // روز سپری‌شده از امروز
  _sort: string;
}

export const daysAgo = (date: string, now: number): number => {
  const d = shamsiStringToDate(normalizeShamsi(date)).getTime();
  return Math.max(0, Math.floor((now - d) / DAY));
};

const bucketOf = (d: number): { key: number; label: string } => {
  if (d === 0) return { key: 0, label: 'امروز' };
  if (d === 1) return { key: 1, label: 'دیروز' };
  if (d <= 7) return { key: 2, label: 'این هفته' };
  if (d <= 30) return { key: 3, label: 'این ماه' };
  return { key: 4, label: 'قدیمی‌تر' };
};

const Highlight: React.FC<{ text: string; q: string }> = ({ text, q }) => {
  const needle = q.trim();
  if (!needle) return <>{text}</>;
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-amber-200 text-slate-900 rounded px-0.5">{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
};

/* ───────────────────────── نمودارهای SVG/CSS ───────────────────────── */

const Donut: React.FC<{ parts: { value: number; hex: string }[]; total: number }> = ({ parts, total }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0 -rotate-90" role="img" aria-label="توزیع دسته‌ها">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="18" />
      {total > 0 &&
        parts.map((p, i) => {
          const len = (p.value / total) * c;
          const el = (
            <circle
              key={i}
              cx="70" cy="70" r={r} fill="none" stroke={p.hex} strokeWidth="18"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      <g className="rotate-90 origin-center">
        <text x="70" y="68" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 26, fontWeight: 900 }}>{fa(total)}</text>
        <text x="70" y="88" textAnchor="middle" className="fill-slate-500" style={{ fontSize: 11 }}>مشاهده</text>
      </g>
    </svg>
  );
};

const Radar: React.FC<{ values: number[] }> = ({ values }) => {
  const n = CATS.length;
  const max = Math.max(1, ...values);
  const pt = (i: number, k: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [100 + Math.cos(a) * 70 * k, 100 + Math.sin(a) * 70 * k];
  };
  const poly = (k: (i: number) => number) => CATS.map((_, i) => pt(i, k(i)).join(',')).join(' ');
  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[220px] mx-auto" role="img" aria-label="رادار دسته‌ها">
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} points={poly(() => k)} fill="none" stroke="#e2e8f0" />
      ))}
      {CATS.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1="100" y1="100" x2={x} y2={y} stroke="#e2e8f0" />;
      })}
      <polygon points={poly((i) => values[i] / max)} fill="#10b98133" stroke="#059669" strokeWidth="2" />
      {CATS.map((c, i) => {
        const [x, y] = pt(i, 1.2);
        return (
          <text key={c.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 9 }} fill={c.hex}>
            {c.short}
          </text>
        );
      })}
    </svg>
  );
};

export const WeeklyBars: React.FC<{ counts: number[]; height?: number }> = ({ counts, height = 96 }) => {
  const max = Math.max(1, ...counts);
  return (
    <div className="flex items-end gap-1.5 w-full" style={{ height }}>
      {counts.map((v, i) => (
        <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1 h-full" title={`${fa(v)} مشاهده`}>
          <span className="text-[10px] font-bold text-slate-500">{v > 0 ? fa(v) : ''}</span>
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-teal-400 transition-all duration-500"
            style={{ height: `${Math.max(v > 0 ? 6 : 2, (v / max) * (height - 28))}px`, opacity: v > 0 ? 1 : 0.25 }}
          />
        </div>
      ))}
    </div>
  );
};

/** ۸ هفته‌ی اخیر؛ قدیمی‌ترین در ابتدا */
const weeklyCounts = (list: Obs[]): number[] => {
  const out = new Array(8).fill(0);
  list.forEach((o) => {
    const w = Math.floor(o._day / 7);
    if (w < 8) out[7 - w] += 1;
  });
  return out;
};

/* ───────────────────────── کامپوننت اصلی ───────────────────────── */

export interface ObservationInsightsProps {
  /** دانش‌آموزان قابل‌دسترس (بدون فیلتر کلاس/جستجو) */
  allStudents: Student[];
  /** دانش‌آموزان پس از فیلتر کلاس و جستجوی بالای صفحه */
  scopedStudents: Student[];
  classes: SchoolClass[];
  observations: StudentObservation[];
  /** دانش‌آموزان بدون مشاهده اخیر: شناسه ← روز از آخرین مشاهده (null = هرگز) */
  staleInfo: Map<string, number | null>;
  isVice: boolean;
  onRecord: (student: Student) => void;
  /** ثبت مشاهده‌ی جدید (باز کردن انتخاب دانش‌آموز) */
  onNewObservation?: () => void;
  /** فیلتر کلاس (برای مربی/معاونی که چند کلاس دارد) */
  classFilter?: { options: { id: string; name: string; count: number }[]; value: string; onChange: (id: string) => void; lockAll?: boolean };
  /** تب اولیه (پیش‌فرض: نمای کلی) */
  initialTab?: Tab;
}

export const ObservationInsights: React.FC<ObservationInsightsProps> = ({
  allStudents, scopedStudents, classes, observations, staleInfo, isVice, onRecord, onNewObservation, classFilter, initialTab = 'overview',
}) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [period, setPeriod] = useState<Period>('30');
  const [cat, setCat] = useState<ObservationCategory | 'all'>('all');
  const [author, setAuthor] = useState<'all' | 'coach' | 'vice'>('all');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const groupBy: 'time' | 'student' = tab === 'students' ? 'student' : 'time';
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [panelStudentId, setPanelStudentId] = useState<string | null>(null);

  useEffect(() => setLimit(30), [period, cat, author, tag, q, scopedStudents]);

  const now = tehranNow().getTime();
  const studentById = useMemo(() => new Map(allStudents.map((s) => [s.id, s])), [allStudents]);
  const classNameOf = (id: string) => classes.find((c) => c.id === id)?.name || '—';

  const all: Obs[] = useMemo(
    () =>
      observations
        .filter((o) => studentById.has(o.studentId))
        .map((o) => ({
          ...o,
          _day: daysAgo(o.date, now),
          _sort: `${normalizeShamsi(o.date)} ${o.time || '00:00'}`,
        }))
        .sort((a, b) => (a._sort < b._sort ? 1 : -1)),
    [observations, studentById, now]
  );

  const scopedIds = useMemo(() => new Set(scopedStudents.map((s) => s.id)), [scopedStudents]);
  const inScope = useMemo(() => all.filter((o) => scopedIds.has(o.studentId)), [all, scopedIds]);
  const periodDays = period === 'all' ? Infinity : Number(period);
  const inPeriod = useMemo(() => inScope.filter((o) => o._day < periodDays), [inScope, periodDays]);

  /* ── خلاصه ── */
  const coveredCount = useMemo(() => new Set(inPeriod.map((o) => o.studentId)).size, [inPeriod]);
  const catCounts = useMemo(
    () => CATS.map((c) => ({ ...c, count: inPeriod.filter((o) => o.category === c.key).length })),
    [inPeriod]
  );
  const attention = useMemo(() => {
    const list: { student: Student; reasons: string[]; score: number }[] = [];
    scopedStudents.forEach((s) => {
      const mine = inScope.filter((o) => o.studentId === s.id);
      const concerns = mine.filter((o) => o._day < 14 && CONCERN_CATS.includes(o.category)).length;
      const reasons: string[] = [];
      let score = 0;
      if (concerns >= 2) { reasons.push(`${fa(concerns)} مشاهده عاطفی/خانوادگی در ۲ هفته`); score += concerns * 2; }
      if (staleInfo.has(s.id)) {
        const d = staleInfo.get(s.id);
        reasons.push(d == null ? 'هرگز مشاهده نشده' : `${fa(d)} روز بدون مشاهده`);
        score += 1;
      }
      if (reasons.length) list.push({ student: s, reasons, score });
    });
    return list.sort((a, b) => b.score - a.score);
  }, [scopedStudents, inScope, staleInfo]);

  /* ── خط زمانی ── */
  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    inScope.forEach((o) => (o.tags || []).forEach((t) => m.set(t, (m.get(t) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [inScope]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inPeriod.filter((o) => {
      if (cat !== 'all' && o.category !== cat) return false;
      if (author !== 'all') {
        const isCoachAuthor = o.authorRole === 'coach';
        if (author === 'coach' && !isCoachAuthor) return false;
        if (author === 'vice' && isCoachAuthor) return false;
      }
      if (tag && !(o.tags || []).includes(tag)) return false;
      if (needle) {
        const name = studentFullName(studentById.get(o.studentId)).toLowerCase();
        const hay = `${o.title} ${o.content} ${name} ${(o.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [inPeriod, cat, author, tag, q, studentById]);

  const groups = useMemo(() => {
    if (groupBy === 'student') {
      const m = new Map<string, { label: string; studentId: string; items: Obs[] }>();
      filtered.forEach((o) => {
        if (!m.has(o.studentId)) m.set(o.studentId, { label: studentFullName(studentById.get(o.studentId)), studentId: o.studentId, items: [] });
        m.get(o.studentId)!.items.push(o);
      });
      return [...m.values()].sort((x, y) => x.label.localeCompare(y.label, 'fa')).slice(0, limit);
    }
    const m = new Map<number, { label: string; studentId?: string; items: Obs[] }>();
    filtered.slice(0, limit).forEach((o) => {
      const b = bucketOf(o._day);
      if (!m.has(b.key)) m.set(b.key, { label: b.label, items: [] });
      m.get(b.key)!.items.push(o);
    });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [filtered, limit, groupBy, studentById]);
  const groupTotal = groupBy === 'student' ? new Set(filtered.map((o) => o.studentId)).size : filtered.length;

  /** خروجی Word از «همه» مشاهدات ثبت‌شده‌ی یک دانش‌آموز */
  const exportWord = (studentId: string) => {
    const s = studentById.get(studentId);
    if (!s) return;
    exportStudentObservationsWord({
      studentName: studentFullName(s),
      className: classNameOf(s.classId),
      items: all.filter((o) => o.studentId === studentId).map((o) => ({
        date: o.date, time: o.time, categoryLabel: catOf(o.category).label, title: o.title, content: o.content,
        location: o.location, tags: o.tags, recordedBy: o.recordedBy, authorLabel: o.authorRole === 'coach' ? 'مربی' : 'معاون',
      })),
    });
  };

  const exportExcel = () => {
    const rows = filtered.map((o) => {
      const s = studentById.get(o.studentId);
      return {
        'دانش‌آموز': studentFullName(s),
        'کلاس': s ? classNameOf(s.classId) : '',
        'تاریخ': o.date,
        'ساعت': o.time || '',
        'دسته': catOf(o.category).label,
        'عنوان': o.title,
        'شرح': o.content,
        'مکان': o.location || '',
        'برچسب‌ها': (o.tags || []).join('، '),
        'ثبت‌کننده': o.recordedBy || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    ws['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'مشاهدات');
    XLSX.writeFile(wb, 'observations.xlsx');
  };

  /* ── پنل دانش‌آموز ── */
  const panelStudent = panelStudentId ? studentById.get(panelStudentId) || null : null;
  useEffect(() => {
    if (!panelStudent) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanelStudentId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelStudent]);

  const periods: { key: Period; label: string }[] = [
    { key: '7', label: '۷ روز اخیر' },
    { key: '30', label: '۳۰ روز اخیر' },
    { key: 'all', label: 'همه' },
  ];

  const PeriodChips = (
    <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold" role="tablist" aria-label="بازه زمانی">
      {periods.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => setPeriod(p.key)}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${period === p.key ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  const catChips = [{ key: 'all' as const, short: 'همه', count: inPeriod.length }, ...catCounts.filter((c) => c.key !== 'other' || c.count > 0).map((c) => ({ key: c.key as ObservationCategory | 'all', short: c.short, count: c.count }))];
  const filtersActive = cat !== 'all' || author !== 'all' || q.trim() !== '' || period !== '30';
  const clearFilters = () => { setCat('all'); setTag(''); setQ(''); setAuthor('all'); setPeriod('30'); };
  const toggleFolder = (id: string) => setOpenFolders((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const selectCls = 'h-9 shrink-0 appearance-none rounded-full border border-slate-200 bg-white pr-3 pl-7 text-xs font-bold text-slate-700 outline-none focus:border-emerald-600 cursor-pointer';

  /* ───────────── رندر ───────────── */
  return (
    <div className="space-y-3">
      {/* نوار جستجوی جامع + ابزارها */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); if (tab === 'overview') setTab('timeline'); }}
            placeholder="جستجوی دانش‌آموز، عنوان، شرح یا برچسب…"
            aria-label="جستجوی جامع"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pr-10 pl-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#00875A] focus:bg-white focus:ring-2 focus:ring-emerald-600/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="پاک کردن جستجو" className="!min-h-0 absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setTab(tab === 'overview' ? 'timeline' : 'overview')}
          aria-pressed={tab === 'overview'}
          title="نمای کلی و آمار"
          aria-label="نمای کلی و آمار"
          className={`!min-h-0 grid h-12 w-12 shrink-0 place-items-center rounded-2xl border cursor-pointer transition ${tab === 'overview' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          <BarChart3 className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={exportExcel}
          disabled={filtered.length === 0}
          title="خروجی اکسل"
          aria-label="خروجی اکسل"
          className="!min-h-0 grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>

      {/* سگمنت دوزبانه */}
      <div className="grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 text-xs font-bold" role="tablist" aria-label="نحوه‌ی نمایش">
        {([['timeline', '⏱️ خط زمانی رویدادها'], ['students', '👥 به تفکیک دانش‌آموز']] as const).map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`!min-h-0 h-10 rounded-full whitespace-nowrap cursor-pointer transition ${tab === k ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ریل فیلتر تک‌خطی */}
      {tab === 'overview' ? (
        <div className="flex justify-end">{PeriodChips}</div>
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <label className="relative shrink-0">
            <span className="sr-only">بازه زمانی</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={selectCls}>
              {periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </label>
          {classFilter && classFilter.options.length > 1 && (
            <label className="relative shrink-0">
              <span className="sr-only">کلاس</span>
              <select value={classFilter.value} onChange={(e) => classFilter.onChange(e.target.value)} className={selectCls}>
                {!classFilter.lockAll && <option value="all">همه کلاس‌ها</option>}
                {classFilter.options.map((c) => <option key={c.id} value={c.id}>{c.name} ({fa(c.count)})</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </label>
          )}
          {isVice && (
            <label className="relative shrink-0">
              <span className="sr-only">ثبت‌کننده</span>
              <select value={author} onChange={(e) => setAuthor(e.target.value as 'all' | 'coach' | 'vice')} className={selectCls}>
                <option value="all">همه ثبت‌کنندگان</option>
                <option value="coach">ثبت مربی</option>
                <option value="vice">ثبت معاون</option>
              </select>
              <ChevronDown className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </label>
          )}
          <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
          {catChips.map((c) => {
            const meta = c.key === 'all' ? null : catOf(c.key);
            const on = cat === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCat(c.key === 'all' || cat === c.key ? 'all' : (c.key as ObservationCategory))}
                aria-pressed={on}
                className="!min-h-0 h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-bold cursor-pointer transition"
                style={on ? { background: meta?.hex || '#0f172a', color: '#fff', borderColor: meta?.hex || '#0f172a' } : { background: meta?.soft || '#fff', color: meta?.hex || '#475569', borderColor: meta ? `${meta.hex}44` : '#e2e8f0' }}
              >
                {c.short} ({fa(c.count)})
              </button>
            );
          })}
        </div>
      )}

      {/* ───────── نمای کلی ───────── */}
      {tab === 'overview' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'مشاهدات ثبت‌شده', value: fa(inPeriod.length), sub: period === 'all' ? 'کل سوابق' : `در ${fa(period)} روز اخیر`, icon: <Eye className="w-5 h-5" />, tone: 'from-emerald-50 to-white border-emerald-200 text-emerald-800', onClick: () => { setCat('all'); setTag(''); setQ(''); setAuthor('all'); setTab('timeline'); } },
              { label: 'پوشش دانش‌آموزان', value: `${fa(coveredCount)} از ${fa(scopedStudents.length)}`, sub: `${fa(scopedStudents.length ? Math.round((coveredCount / scopedStudents.length) * 100) : 0)}٪ دانش‌آموزان`, icon: <Users className="w-5 h-5" />, tone: 'from-sky-50 to-white border-sky-200 text-sky-800' },
              { label: 'میانگین برای هر نفر', value: fa(scopedStudents.length ? (inPeriod.length / scopedStudents.length).toFixed(1) : 0), sub: 'مشاهده به‌ازای دانش‌آموز', icon: <Activity className="w-5 h-5" />, tone: 'from-violet-50 to-white border-violet-200 text-violet-800' },
              { label: 'نیازمند پیگیری', value: fa(attention.length), sub: 'دانش‌آموز', icon: <Flame className="w-5 h-5" />, tone: 'from-amber-50 to-white border-amber-200 text-amber-800' },
            ].map((k: { label: string; value: string; sub: string; icon: React.ReactNode; tone: string; onClick?: () => void }) => {
              const body = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold opacity-80">{k.label}</span>
                    <span className="opacity-70">{k.icon}</span>
                  </div>
                  <div className="mt-1 text-xl sm:text-2xl font-black text-slate-900">{k.value}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                    <span>{k.sub}</span>
                    {k.onClick && <span className="font-bold text-emerald-700">مشاهده ←</span>}
                  </div>
                </>
              );
              const cls = `rounded-2xl border bg-gradient-to-br ${k.tone} p-4 shadow-xs`;
              return k.onClick ? (
                <button key={k.label} type="button" onClick={k.onClick} className={`${cls} text-right cursor-pointer transition hover:shadow-md active:scale-[.98]`}>{body}</button>
              ) : (
                <div key={k.label} className={cls}>{body}</div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* روند هفتگی */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" /> روند هفتگی مشاهدات (۸ هفته اخیر)
              </h3>
              <WeeklyBars counts={weeklyCounts(inScope)} />
              <div className="flex justify-between text-[10px] text-slate-400"><span>۸ هفته پیش</span><span>این هفته</span></div>
            </div>

            {/* حلقه‌ای دسته‌ها */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" /> توزیع دسته‌ها
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Donut parts={catCounts.map((c) => ({ value: c.count, hex: c.hex }))} total={inPeriod.length} />
                <ul className="flex-1 w-full space-y-1.5">
                  {catCounts.map((c) => (
                    <li key={c.key}>
                      <button
                        type="button"
                        onClick={() => { setCat(c.key); setTab('timeline'); }}
                        className="w-full flex items-center gap-2 text-xs rounded-lg px-2 py-1 hover:bg-slate-50 cursor-pointer"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.hex }} />
                        <span className="text-slate-700 truncate">{c.short}</span>
                        <span className="mr-auto font-mono font-bold text-slate-800">{fa(c.count)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* نقشه حرارتی کلاس × دسته */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-emerald-600" /> نقشه حرارتی کلاس × دسته
            </h3>
            {classes.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">کلاسی برای نمایش وجود ندارد.</p>
            ) : (
              <div className="space-y-1">
                <div className="grid gap-1 text-[10px] font-bold text-slate-500" style={{ gridTemplateColumns: 'minmax(0,1.4fr) repeat(7,minmax(0,1fr)) minmax(0,0.8fr)' }}>
                  <span />
                  {CATS.map((c) => <span key={c.key} className="text-center truncate" style={{ color: c.hex }}>{c.short}</span>)}
                  <span className="text-center">جمع</span>
                </div>
                {(() => {
                  const rows = classes.map((cl) => {
                    const ids = new Set(allStudents.filter((s) => s.classId === cl.id).map((s) => s.id));
                    const obs = all.filter((o) => ids.has(o.studentId) && o._day < periodDays);
                    return { cl, counts: CATS.map((c) => obs.filter((o) => o.category === c.key).length), total: obs.length };
                  });
                  const max = Math.max(1, ...rows.flatMap((r) => r.counts));
                  return rows.map(({ cl, counts, total }) => (
                    <div key={cl.id} className="grid gap-1 items-center" style={{ gridTemplateColumns: 'minmax(0,1.4fr) repeat(7,minmax(0,1fr)) minmax(0,0.8fr)' }}>
                      <span className="text-[11px] font-bold text-slate-800 truncate">{cl.name}</span>
                      {counts.map((v, i) => (
                        <div
                          key={i}
                          title={`${cl.name} — ${CATS[i].short}: ${fa(v)}`}
                          className="h-8 rounded-md flex items-center justify-center text-[10px] font-bold"
                          style={{ background: v ? CATS[i].hex : '#f1f5f9', opacity: v ? 0.25 + 0.75 * (v / max) : 1, color: v / max > 0.5 ? '#fff' : '#334155' }}
                        >
                          {v ? fa(v) : ''}
                        </div>
                      ))}
                      <span className="text-center text-[11px] font-black text-slate-800">{fa(total)}</span>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* نیازمند پیگیری */}
          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> نیازمند پیگیری
            </h3>
            {attention.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">موردی برای پیگیری وجود ندارد 👌</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {attention.slice(0, 8).map(({ student, reasons }) => (
                  <li key={student.id}>
                    <button
                      type="button"
                      onClick={() => setPanelStudentId(student.id)}
                      className="w-full text-right rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 p-3 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900">{studentFullName(student)}</span>
                        <span className="text-[10px] text-slate-500">{classNameOf(student.classId)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {reasons.map((r) => (
                          <span key={r} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-800">{r}</span>
                        ))}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ───────── خط زمانی ───────── */}
      {(tab === 'timeline' || tab === 'students') && (
        <div className="space-y-3 animate-in fade-in">
          <div className="text-[11px] text-slate-500 px-1">{fa(filtered.length)} مشاهده یافت شد</div>

          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-white/70 bg-white/80 px-6 py-12 text-center shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/80 bg-gradient-to-br from-emerald-50 to-white text-emerald-600 shadow-sm ring-1 ring-emerald-100">
                <Eye className="h-7 w-7" />
              </span>
              {inScope.length === 0 ? (
                <>
                  <h3 className="mt-4 text-base font-black text-slate-900">هنوز مشاهده‌ای ثبت نشده است</h3>
                  <p className="mt-1 text-xs leading-6 text-slate-500">اولین مشاهده‌ی رفتاری را ثبت کنید تا در خط زمانی نمایش داده شود.</p>
                  {onNewObservation && (
                    <button type="button" onClick={onNewObservation} className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#00875A] px-6 text-sm font-extrabold text-white shadow-md shadow-emerald-700/25 hover:bg-emerald-800 active:scale-[.99] cursor-pointer">
                      ➕ ثبت اولین مشاهده‌گری
                    </button>
                  )}
                </>
              ) : (
                <>
                  <h3 className="mt-4 text-base font-black text-slate-900">مشاهده‌ای با این فیلترها پیدا نشد</h3>
                  <p className="mt-1 text-xs leading-6 text-slate-500">بازه‌ی زمانی را گسترده‌تر کنید یا فیلترها را بردارید.</p>
                  <button type="button" onClick={() => { clearFilters(); setPeriod('all'); }} className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer">
                    پاک‌کردن فیلترها
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <section key={g.label} className="space-y-2">
                  {groupBy === 'student' && g.studentId ? (
                    <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 pr-3 shadow-xs">
                      <button type="button" onClick={() => toggleFolder(g.studentId!)} aria-expanded={openFolders.has(g.studentId)} className="!min-h-0 flex min-w-0 flex-1 items-center gap-2.5 text-right cursor-pointer">
                        <FolderOpen className="h-5 w-5 shrink-0 text-emerald-600" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-slate-900">{g.label}</span>
                          <span className="block truncate text-[11px] text-slate-500">{(() => { const st = studentById.get(g.studentId!); return st ? classNameOf(st.classId) : ''; })()} · {fa(g.items.length)} مشاهده</span>
                        </span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${openFolders.has(g.studentId) ? 'rotate-180' : ''}`} />
                      </button>
                      {onNewObservation && (
                        <button type="button" onClick={() => { const st = studentById.get(g.studentId!); if (st) onRecord(st); }} title="ثبت مشاهده برای این دانش‌آموز" aria-label="ثبت مشاهده" className="!min-h-0 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-emerald-700 hover:bg-emerald-50 cursor-pointer"><Plus className="h-4 w-4" /></button>
                      )}
                      <button type="button" onClick={() => exportWord(g.studentId!)} title="خروجی Word" aria-label="خروجی Word" className="!min-h-0 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sky-700 hover:bg-sky-50 cursor-pointer"><FileText className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <h4 className="flex items-center gap-2 text-xs font-black text-slate-500">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {g.label}
                      <span className="h-px flex-1 bg-slate-200" />
                      <span className="font-mono">{fa(g.items.length)}</span>
                    </h4>
                  )}
                  {(groupBy === 'time' || (g.studentId && openFolders.has(g.studentId))) && (
                  <div className="relative pr-4 space-y-2 before:absolute before:right-[3px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
                    {g.items.map((o) => {
                      const s = studentById.get(o.studentId);
                      const c = catOf(o.category);
                      const open = expanded.has(o.id);
                      const long = o.content.length > 140;
                      return (
                        <article
                          key={o.id}
                          className="relative bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition overflow-hidden"
                        >
                          <span className="absolute right-[-17px] top-4 w-2.5 h-2.5 rounded-full ring-2 ring-white" style={{ background: c.hex }} />
                          <span className="absolute inset-y-0 right-0 w-1" style={{ background: c.hex }} />
                          <div className="pr-4 pl-3 py-3 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.soft, color: c.hex }}>{c.short}</span>
                              <button
                                type="button"
                                onClick={() => s && setPanelStudentId(s.id)}
                                className="text-xs font-black text-slate-900 hover:text-emerald-700 cursor-pointer"
                              >
                                <Highlight text={studentFullName(s)} q={q} />
                              </button>
                              <span className="text-[10px] text-slate-400">{s ? classNameOf(s.classId) : ''}</span>
                              <span className="mr-auto text-[10px] text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span dir="ltr">{fa(o.date)}{o.time ? ` · ${fa(o.time)}` : ''}</span>
                              </span>
                            </div>
                            <h5 className="text-[13px] font-bold text-slate-800"><Highlight text={o.title} q={q} /></h5>
                            {(
                              <p className={`text-xs text-slate-600 leading-6 ${open ? '' : 'line-clamp-2'}`}>
                                <Highlight text={o.content} q={q} />
                              </p>
                            )}
                            {long && (
                              <button
                                type="button"
                                onClick={() => setExpanded((p) => { const n = new Set(p); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n; })}
                                className="text-[11px] font-bold text-emerald-700 cursor-pointer"
                              >
                                {open ? 'کمتر' : 'ادامه…'}
                              </button>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              {o.location && (
                                <span className="inline-flex items-center gap-1 text-slate-500"><MapPin className="w-3 h-3" />{o.location}</span>
                              )}
                              {(o.tags || []).map((t) => (
                                <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">#{t}</span>
                              ))}
                              <span className={`mr-auto px-2 py-0.5 rounded-full font-bold ${o.authorRole === 'coach' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>
                                {o.authorRole === 'coach' ? 'ثبت مربی' : 'ثبت معاون'}{o.recordedBy ? ` · ${o.recordedBy}` : ''}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  )}
                </section>
              ))}
              {groupTotal > limit && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setLimit((l) => l + 30)}
                    className="text-xs font-bold px-5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                  >
                    نمایش بیشتر ({fa(groupTotal - limit)} {groupBy === 'student' ? 'دانش‌آموز' : 'مورد'} دیگر)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ───────── پنل کشویی دانش‌آموز ───────── */}
      {panelStudent && (() => {
        const mine = all.filter((o) => o.studentId === panelStudent.id);
        const radar = CATS.map((c) => mine.filter((o) => o.category === c.key).length);
        const tagMap = new Map<string, number>();
        mine.forEach((o) => (o.tags || []).forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1)));
        const topTags = [...tagMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
        const last = mine[0];
        const concerns14 = mine.filter((o) => o._day < 14 && CONCERN_CATS.includes(o.category)).length;
        return (
          <div className="fixed inset-0 z-40 flex" dir="rtl" role="dialog" aria-modal="true" aria-label="پروفایل مشاهداتی">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setPanelStudentId(null)} />
            <aside className="relative mr-0 ml-auto w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
              <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-l from-emerald-50 to-white">
                <div>
                  <h3 className="text-base font-black text-slate-900">{studentFullName(panelStudent)}</h3>
                  <p className="text-xs text-slate-500">{classNameOf(panelStudent.classId)}</p>
                </div>
                <button type="button" onClick={() => setPanelStudentId(null)} className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="بستن">
                  <X className="w-5 h-5" />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-emerald-50 p-3"><div className="text-lg font-black text-emerald-800">{fa(mine.length)}</div><div className="text-[10px] text-slate-500">کل مشاهدات</div></div>
                  <div className="rounded-xl bg-sky-50 p-3"><div className="text-lg font-black text-sky-800">{last ? fa(last._day) : '—'}</div><div className="text-[10px] text-slate-500">روز از آخرین مشاهده</div></div>
                  <div className={`rounded-xl p-3 ${concerns14 >= 2 ? 'bg-rose-50' : 'bg-slate-50'}`}><div className={`text-lg font-black ${concerns14 >= 2 ? 'text-rose-700' : 'text-slate-700'}`}>{fa(concerns14)}</div><div className="text-[10px] text-slate-500">عاطفی/خانوادگی (۲ هفته)</div></div>
                </div>

                {concerns14 >= 2 && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 leading-6">
                    <b>توجه:</b> {fa(concerns14)} مشاهده عاطفی/خانوادگی در ۲ هفته اخیر ثبت شده است؛ پیگیری پیشنهاد می‌شود.
                  </div>
                )}

                {mine.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">هنوز مشاهده‌ای برای این دانش‌آموز ثبت نشده است.</p>
                ) : (
                  <>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 mb-1">پروفایل دسته‌ها</h4>
                      <Radar values={radar} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-700 mb-2">روند هفتگی</h4>
                      <WeeklyBars counts={weeklyCounts(mine)} height={72} />
                    </div>
                    {topTags.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black text-slate-700 mb-2">برچسب‌های پرتکرار</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {topTags.map(([t, n]) => (
                            <span key={t} className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[11px] text-slate-700">#{t} <b>{fa(n)}</b></span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-black text-slate-700 mb-2">آخرین مشاهدات</h4>
                      <ul className="space-y-2">
                        {mine.slice(0, 5).map((o) => (
                          <li key={o.id} className="rounded-xl border border-slate-200 p-3 border-r-4" style={{ borderRightColor: catOf(o.category).hex }}>
                            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                              <span style={{ color: catOf(o.category).hex }} className="font-bold">{catOf(o.category).short}</span>
                              <span dir="ltr">{fa(o.date)}</span>
                            </div>
                            <div className="text-xs font-bold text-slate-800 mt-0.5">{o.title}</div>
                            <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{o.content}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
              <footer className="p-4 border-t border-slate-100 bg-slate-50 space-y-2">
                <button
                  type="button"
                  onClick={() => exportWord(panelStudent.id)}
                  disabled={mine.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-sky-200 bg-white text-sky-700 text-sm font-bold hover:bg-sky-50 disabled:opacity-40 cursor-pointer"
                >
                  <FileText className="w-4 h-4" /> خروجی Word از مشاهدات ({fa(mine.length)})
                </button>
                <button
                  type="button"
                  onClick={() => { const s = panelStudent; setPanelStudentId(null); onRecord(s); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white text-sm font-bold hover:opacity-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> ثبت مشاهده جدید
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </footer>
            </aside>
          </div>
        );
      })()}
    </div>
  );
};
