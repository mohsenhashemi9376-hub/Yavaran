import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Award, ChevronDown, ChevronLeft, FileSpreadsheet, HelpCircle, Printer, Save, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Modal } from './ui';
import { Student, StudentAttendanceRecord } from '../types';
import { absenceEventsOf, delayEventsOf } from '../utils/attendanceStats';
import { dateToShamsiString, getAcademicYearStart, getActiveAcademicYear, getTodayShamsi, PERSIAN_MONTHS, shamsiStringToDate, toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { studentFullName, compareStudents } from '../utils/studentName';
import { academicMonths } from '../utils/teacherActivities';

/** تأخیر نسبت به ۰۷:۰۰ محاسبه می‌شود؛ ورود تا ۰۷:۱۰ (۱۰ دقیقه) «تأخیر جزئی» است و دانش‌آموز را از «تقریباً ممتاز» خارج نمی‌کند */
const MINOR_DELAY_MINUTES = 10;
const MINOR_DELAY_TIME = '۰۷:۱۰';

/** بازه‌ی ارزیابی: ۷/۱۴/۳۰ روز اخیر یا یکی از ماه‌های سال تحصیلی (m7 = مهر، m8 = آبان، …) */
export type ExcellencePeriod = 'd7' | 'd14' | 'd30' | `m${number}`;

const pad = (n: number) => String(n).padStart(2, '0');

/** آغاز حضور همه‌ی دانش‌آموزان: اول مهر سال تحصیلی جاری */
const yearStart = (): string => `${getAcademicYearStart(getActiveAcademicYear())}/07/01`;

/** همه‌ی ماه‌های سال تحصیلی (مهر تا شهریور)؛ ماه‌هایی که هنوز نرسیده‌اند قابل انتخاب نیستند */
const elapsedMonths = () => academicMonths();
const isFutureMonth = (m: { month: number; year: number }) => `${m.year}/${pad(m.month)}/01` > key(getTodayShamsi().formattedDate);

const PERIOD_FIXED: { key: ExcellencePeriod; label: string }[] = [
  { key: 'd7', label: '۷ روز اخیر' },
  { key: 'd14', label: '۲ هفته اخیر' },
  { key: 'd30', label: '۳۰ روز اخیر' },
];

const periodOptions = (): { key: ExcellencePeriod; label: string }[] => [
  ...PERIOD_FIXED,
  ...elapsedMonths().map((m) => ({ key: `m${m.month}` as ExcellencePeriod, label: `${m.label} ${toPersianDigits(m.year)}` })),
];

const periodLabel = (p: ExcellencePeriod): string => periodOptions().find((o) => o.key === p)?.label || '';

/** بازه‌ی تاریخ (شمسی، قابل مقایسه‌ی رشته‌ای)؛ هیچ‌گاه قبل از اول مهر نیست */
const periodRange = (p: ExcellencePeriod): { from: string; to: string } => {
  const today = getTodayShamsi().formattedDate;
  let from = yearStart();
  let to = key(today);
  if (p === 'd7' || p === 'd14' || p === 'd30') {
    const d = shamsiStringToDate(today);
    d.setDate(d.getDate() - ({ d7: 6, d14: 13, d30: 29 }[p]));
    from = key(dateToShamsiString(d));
  } else {
    const m = elapsedMonths().find((x) => `m${x.month}` === p);
    if (m) { from = `${m.year}/${pad(m.month)}/01`; to = `${m.year}/${pad(m.month)}/31`; }
  }
  return { from: from < yearStart() ? yearStart() : from, to };
};

/** «شهید ثناگو» → «ثناگو» */
const shortClass = (name: string) => name.replace(/^شهید\s+/, '');

const key = (d: string): string => toEnglishDigits(d || '').split('/').map((p, i) => (i === 0 ? p : p.padStart(2, '0'))).join('/');

type Incident = { date: string; kind: 'delay' | 'absence' | 'classAbsence' | 'note'; minutes?: number; excused?: boolean };

/** معیارهای پیشرفته‌ی «ممتاز»؛ معاون انضباطی تعیین می‌کند. پیش‌فرض (همه صفر) یعنی «بدون هیچ مورد» */
export interface ExcellenceCriteria {
  /** ماه‌های انتخابی (شماره‌ی ماه شمسی)؛ خالی = همان بازه‌ی بالا */
  months: number[];
  maxDelays: number;
  maxExcusedAbsences: number;
  maxUnexcusedAbsences: number;
  maxClassAbsences: number;
  maxNotes: number;
}

export const DEFAULT_CRITERIA: ExcellenceCriteria = { months: [], maxDelays: 0, maxExcusedAbsences: 0, maxUnexcusedAbsences: 0, maxClassAbsences: 0, maxNotes: 0 };

const CRITERIA_FIELDS: { key: Exclude<keyof ExcellenceCriteria, 'months'>; label: string }[] = [
  { key: 'maxDelays', label: 'حداکثر تأخیر' },
  { key: 'maxExcusedAbsences', label: 'حداکثر غیبت موجه' },
  { key: 'maxUnexcusedAbsences', label: 'حداکثر غیبت غیرموجه' },
  { key: 'maxClassAbsences', label: 'حداکثر غیبت کلاسی' },
  { key: 'maxNotes', label: 'حداکثر مورد انضباطی' },
];

const PRESETS_KEY = 'yavaran.disciplineExcellence.presets';
interface CriteriaPreset { name: string; criteria: ExcellenceCriteria }
const loadPresets = (): CriteriaPreset[] => {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]'); } catch { return []; }
};
const storePresets = (list: CriteriaPreset[]) => { try { localStorage.setItem(PRESETS_KEY, JSON.stringify(list)); } catch { /* حافظه در دسترس نیست */ } };

interface Verdict {
  student: Student;
  incidents: Incident[];
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** چاپ لوح تقدیر (هر دانش‌آموز یک صفحه‌ی A4 افقی) */
function printCertificates(items: { name: string; className: string }[], periodLabel: string) {
  if (items.length === 0) return;
  const today = toPersianDigits(getTodayShamsi().displayDate);
  const pages = items.map((it) => `
    <section class="page">
      <div class="frame">
        <div class="medal">★</div>
        <h1>لوح تقدیر</h1>
        <p class="lead">به پاس رعایت کامل نظم و انضباط مدرسه</p>
        <h2>${escapeHtml(it.name)}</h2>
        <p class="cls">${escapeHtml(it.className)}</p>
        <p class="body">این لوح به‌عنوان «دانش‌آموز ممتاز انضباطی» (${escapeHtml(periodLabel)}) به ایشان تقدیم می‌شود؛ بدون هیچ غیبت، تأخیر و مورد انضباطی. توفیق روزافزون‌تان را آرزومندیم.</p>
        <div class="foot"><span>${today}</span><span>مدیریت مدرسه</span></div>
      </div>
    </section>`).join('');
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>لوح تقدیر</title><style>
    @page { size: A4 landscape; margin: 0; }
    body { margin: 0; font-family: Vazirmatn, Tahoma, sans-serif; color: #1e293b; }
    .page { width: 297mm; height: 209mm; box-sizing: border-box; padding: 12mm; page-break-after: always; }
    .frame { height: 100%; box-sizing: border-box; border: 3mm double #b45309; border-radius: 6mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 10mm; background: linear-gradient(135deg,#fffbeb,#fff); }
    .medal { font-size: 22mm; color: #d97706; line-height: 1; }
    h1 { font-size: 15mm; margin: 4mm 0 2mm; color: #92400e; }
    .lead { font-size: 6mm; margin: 0 0 8mm; color: #475569; }
    h2 { font-size: 13mm; margin: 0; color: #0f172a; }
    .cls { font-size: 6mm; margin: 2mm 0 8mm; color: #64748b; }
    .body { font-size: 5.5mm; line-height: 1.9; max-width: 190mm; margin: 0; }
    .foot { display: flex; justify-content: space-between; width: 100%; margin-top: 14mm; font-size: 5mm; color: #475569; padding: 0 20mm; box-sizing: border-box; }
  </style></head><body>${pages}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

/** ارزیابی همه‌ی دانش‌آموزان: رویدادهای انضباطی (غیبت، تأخیر، غیبت کلاسی، مورد انضباطی) */
function useVerdicts(scopeClassIds?: string[]) {
  const { students, classes, sessions, morningAttendance, morningDelays, schoolAbsences } = useSchool();
  return useMemo(() => {
    const src = {
      morningDelays: morningDelays || [],
      morningAttendance: morningAttendance || [],
      schoolAbsences: schoolAbsences || [],
      sessions: sessions || [],
    };
    const classAbsent = new Map<string, string[]>();
    (sessions || []).forEach((sess) => {
      const d = key(sess.date);
      if (!sess.records) return;
      const recs = (Array.isArray(sess.records) ? sess.records : Object.entries(sess.records).map(([id, r]) => ({ ...(r as object), studentId: id }))) as StudentAttendanceRecord[];
      recs.forEach((r) => {
        if (r.status === 'absent') classAbsent.set(r.studentId, [...(classAbsent.get(r.studentId) || []), d]);
      });
    });

    const scoped = scopeClassIds ? students.filter((s) => scopeClassIds.includes(s.classId)) : students;

    const verdicts: Verdict[] = scoped.map((student) => ({
      student,
      incidents: [
        ...delayEventsOf(student, src).map((e) => ({ date: key(e.date), kind: 'delay' as const, minutes: e.minutes })),
        ...absenceEventsOf(student, src).map((e) => ({ date: key(e.date), kind: 'absence' as const, excused: e.excused })),
        ...(classAbsent.get(student.id) || []).map((d) => ({ date: d, kind: 'classAbsence' as const })),
        ...(student.disciplinaryNotes || []).map((n) => ({ date: key(n.date), kind: 'note' as const })),
      ],
    }));
    return { verdicts, classes, scoped };
  }, [students, classes, sessions, morningAttendance, morningDelays, schoolAbsences, scopeClassIds]);
}

export function useDisciplineExcellence(period: ExcellencePeriod, scopeClassIds?: string[], criteria: ExcellenceCriteria = DEFAULT_CRITERIA) {
  const { verdicts, classes, scoped } = useVerdicts(scopeClassIds);
  return useMemo(() => {
    const ranges = criteria.months.length ? criteria.months.map((m) => periodRange(`m${m}`)) : [periodRange(period)];
    const inWin = (d: string) => ranges.some(({ from, to }) => d >= from && d <= to);
    const within = (inc: Incident[]) => {
      const n = (f: (i: Incident) => boolean) => inc.filter(f).length;
      return n((i) => i.kind === 'delay') <= criteria.maxDelays
        && n((i) => i.kind === 'absence' && !!i.excused) <= criteria.maxExcusedAbsences
        && n((i) => i.kind === 'absence' && !i.excused) <= criteria.maxUnexcusedAbsences
        && n((i) => i.kind === 'classAbsence') <= criteria.maxClassAbsences
        && n((i) => i.kind === 'note') <= criteria.maxNotes;
    };
    const describe = (inc: Incident[]) => {
      const n = (k: Incident['kind']) => inc.filter((i) => i.kind === k).length;
      return [
        n('delay') && `${toPersianDigits(n('delay'))} تأخیر`,
        n('absence') && `${toPersianDigits(n('absence'))} غیبت روزانه`,
        n('classAbsence') && `${toPersianDigits(n('classAbsence'))} غیبت کلاسی`,
        n('note') && `${toPersianDigits(n('note'))} مورد انضباطی`,
      ].filter(Boolean).join('، ') || 'دارای مورد ثبت‌شده';
    };
    const excellent: Student[] = [];
    const near: { student: Student; reason: string }[] = [];
    const others: { student: Student; reason: string }[] = [];
    verdicts.forEach(({ student, incidents }) => {
      const inc = incidents.filter((i) => inWin(i.date));
      if (within(inc)) { excellent.push(student); return; }
      // هر مورد انضباطی ثبت‌شده، غیبت کلاسی یا غیبت غیرموجه یعنی «غیرممتاز»
      // تقریباً ممتاز: فقط تأخیرهایی که همگی تا ۰۷:۱۰ بوده‌اند (هر تعداد)، یا فقط یک غیبت موجه
      if (inc.every((i) => i.kind === 'delay' && (i.minutes || 0) <= MINOR_DELAY_MINUTES)) {
        near.push({ student, reason: inc.length === 1 ? `یک تأخیر تا ${MINOR_DELAY_TIME}` : `${toPersianDigits(inc.length)} تأخیر، همگی تا ${MINOR_DELAY_TIME}` });
        return;
      }
      if (inc.length === 1 && inc[0].kind === 'absence' && inc[0].excused) { near.push({ student, reason: 'یک غیبت موجه' }); return; }
      others.push({ student, reason: describe(inc) });
    });
    excellent.sort(compareStudents);
    near.sort((a, b) => compareStudents(a.student, b.student));
    others.sort((a, b) => compareStudents(a.student, b.student));

    const byClass = classes
      .filter((c) => !scopeClassIds || scopeClassIds.includes(c.id))
      .map((c) => ({ cls: c, count: excellent.filter((s) => s.classId === c.id).length, size: scoped.filter((s) => s.classId === c.id).length }))
      .filter((x) => x.size > 0);

    // روند ماهانه (۶ ماه تقویمی منتهی به ماه جاری): دانش‌آموزان بدون هیچ مورد در همان ماه؛
    // ماه‌های پیش از اول مهر (آغاز حضور) داده ندارند و صفر نمایش داده می‌شوند
    const today = getTodayShamsi();
    const start = yearStart();
    const trend = Array.from({ length: 6 }, (_, i) => {
      const back = 5 - i;
      let month = today.month - back;
      let year = today.year;
      while (month < 1) { month += 12; year -= 1; }
      const a = `${year}/${pad(month)}/01`;
      const b = `${year}/${pad(month)}/31`;
      const n = b < start ? 0 : verdicts.filter(({ incidents }) => !incidents.some((inc) => inc.date >= a && inc.date <= b)).length;
      return { label: PERSIAN_MONTHS[month - 1], n };
    });
    return { excellent, near, others, byClass, total: scoped.length, trend };
  }, [verdicts, classes, scoped, period, scopeClassIds, criteria]);
}

const PeriodSelect: React.FC<{ value: ExcellencePeriod; onChange: (p: ExcellencePeriod) => void; compact?: boolean }> = ({ value, onChange, compact }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as ExcellencePeriod)}
    aria-label="بازه‌ی زمانی"
    style={{ fontFamily: 'inherit', ...(compact ? { fontSize: '12px' } : {}) }}
    className={`${compact ? '!min-h-0 h-8 w-[7.25rem] shrink-0 text-xs' : 'h-10 text-xs'} font-bold bg-white border border-amber-200 text-slate-700 rounded-lg px-2 outline-none cursor-pointer`}
  >
    <optgroup label="بازه‌ی اخیر">
      {PERIOD_FIXED.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </optgroup>
    <optgroup label="ماه‌های سال تحصیلی">
      {elapsedMonths().map((m) => (
        <option key={m.month} value={`m${m.month}`} disabled={isFutureMonth(m)}>
          {m.label} {toPersianDigits(m.year)}{isFutureMonth(m) ? ' (هنوز نرسیده)' : ''}
        </option>
      ))}
    </optgroup>
  </select>
);

/** «ممتازین انضباطی»: مدیر، معاون تربیتی، معاون انضباطی و مربی (فقط کلاس‌های خودش) */
export const DisciplineExcellenceCard: React.FC<{ onSelectStudent?: (s: Student) => void; classIds?: string[] }> = ({ onSelectStudent, classIds }) => {
  const { isAdmin, isDisciplinaryVice, isNurturingVice, isCoach, classes: allClasses } = useSchool();
  const [period, setPeriod] = useState<ExcellencePeriod>('d30');
  const [crit, setCrit] = useState<ExcellenceCriteria>(DEFAULT_CRITERIA);
  const { excellent, near, others, byClass, total, trend } = useDisciplineExcellence(period, classIds, crit);
  const [advOpen, setAdvOpen] = useState(false);
  const [presets, setPresets] = useState<CriteriaPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  const [tab, setTab] = useState<'excellent' | 'near' | 'others'>('excellent');
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  if (!(isAdmin || isDisciplinaryVice || isNurturingVice || (isCoach && classIds))) return null;

  const monthLabelOf = (m: number) => elapsedMonths().find((x) => x.month === m)?.label || '';
  const winLabel = crit.months.length ? crit.months.map(monthLabelOf).join('، ') : periodLabel(period);
  const advActive = crit.months.length > 0 || CRITERIA_FIELDS.some((f) => crit[f.key] !== 0);
  const toggleMonth = (m: number) => setCrit((c) => ({ ...c, months: c.months.includes(m) ? c.months.filter((x) => x !== m) : [...c.months, m] }));
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const next = [...presets.filter((p) => p.name !== name), { name, criteria: crit }];
    setPresets(next); storePresets(next); setPresetName('');
  };
  const removePreset = (name: string) => { const next = presets.filter((p) => p.name !== name); setPresets(next); storePresets(next); };

  const className = (id: string) => allClasses.find((c) => c.id === id)?.name || '—';
  const percent = total ? Math.round((excellent.length / total) * 100) : 0;
  const match = (s: Student) => (!classId || s.classId === classId) && (!q.trim() || studentFullName(s).includes(q.trim()));
  const shownExcellent = excellent.filter(match);
  const shownNear = near.filter((x) => match(x.student));
  const shownOthers = others.filter((x) => match(x.student));
  const trendMax = Math.max(1, ...trend.map((t) => t.n));

  const openAll = () => { setClassId(''); setTab('excellent'); setOpen(true); };

  const exportExcel = () => {
    const rows = tab === 'excellent'
      ? shownExcellent.map((s, i) => ({ 'ردیف': i + 1, 'دانش‌آموز': studentFullName(s), 'کلاس': className(s.classId), 'کد دانش‌آموزی': s.studentCode || '' }))
      : (tab === 'near' ? shownNear : shownOthers).map((x, i) => ({ 'ردیف': i + 1, 'دانش‌آموز': studentFullName(x.student), 'کلاس': className(x.student.classId), 'مورد': x.reason }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws, tab === 'excellent' ? 'ممتازین انضباطی' : tab === 'near' ? 'تقریباً ممتاز' : 'غیرممتاز');
    XLSX.writeFile(wb, `ممتازین_انضباطی_${getTodayShamsi().formattedDate.replace(/\//g, '-')}.xlsx`);
  };
  const print = (list: Student[]) => printCertificates(list.map((s) => ({ name: studentFullName(s), className: className(s.classId) })), winLabel);

  return (
    <>
      <section className="rounded-3xl border border-amber-200/90 bg-amber-50/70 backdrop-blur-xl shadow-sm px-4 pt-4 pb-2 sm:px-5" aria-label="ممتازین انضباطی">
        {/* هدر: عنوان (راست) + بازه و مشاهده همه (چپ) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-9 h-9 shrink-0 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center" aria-hidden="true">
              <Award className="w-5 h-5" />
            </span>
            <h3 className="font-bold text-sm text-slate-900 whitespace-nowrap">ممتازین انضباطی</h3>
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              aria-label="شرایط ممتاز شدن"
              aria-expanded={helpOpen}
              className="!min-h-0 w-7 h-7 shrink-0 rounded-full text-amber-600 hover:bg-amber-100 flex items-center justify-center cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <PeriodSelect value={period} onChange={setPeriod} compact />
            <button type="button" onClick={openAll} className="!min-h-0 text-[11px] font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap cursor-pointer">
              مشاهده همه ←
            </button>
          </div>
        </div>

        {helpOpen && (
          <p className="mt-2 text-[11px] leading-5 text-amber-900 bg-amber-100/60 rounded-xl px-3 py-1.5">
            {advActive ? `بر اساس معیارهای پیشرفته‌ی تعیین‌شده در ${winLabel}` : `بدون هیچ غیبت، تأخیر یا مورد انضباطی در ${winLabel} (حضور از اول مهر حساب می‌شود)`}
          </p>
        )}

        {/* ردیف میانی: آمار کلی (راست) + گرید ۲×۲ کلاس‌ها (چپ) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3">
          <div className="rounded-2xl bg-white/70 backdrop-blur border border-amber-100 px-4 py-3 flex flex-col justify-center">
            <div className="text-4xl leading-none font-black text-amber-700 tabular-nums">
              {toPersianDigits(excellent.length)}<span className="text-sm font-bold text-slate-500 mr-1.5">نفر</span>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">{toPersianDigits(percent)}٪ از {toPersianDigits(total)} دانش‌آموز</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-amber-100 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-l from-amber-500 to-yellow-400 transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
          {byClass.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {byClass.map(({ cls, count, size }) => (
                <button key={cls.id} type="button" onClick={() => { setClassId(cls.id); setTab('excellent'); setOpen(true); }}
                  className="min-h-11 px-2 py-2 rounded-2xl bg-white/70 backdrop-blur border border-amber-100 text-xs font-bold text-slate-700 text-center truncate cursor-pointer hover:bg-white">
                  {shortClass(cls.name)}: {toPersianDigits(count)}/{toPersianDigits(size)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* روند ۶ ماهه (تاشو) */}
        <div className="border-t border-amber-200/70">
          <button
            type="button"
            onClick={() => setTrendOpen((v) => !v)}
            aria-expanded={trendOpen}
            className="!min-h-0 w-full h-10 flex items-center justify-between text-xs font-bold text-slate-600 cursor-pointer"
          >
            <span>روند ۶ ماه اخیر ({trend[trend.length - 1]?.label}: {toPersianDigits(trend[trend.length - 1]?.n ?? 0)} نفر)</span>
            <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform ${trendOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`grid transition-[grid-template-rows] duration-300 ${trendOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
              <div className="flex items-end justify-around gap-2 h-28 pb-3 pt-1" role="img" aria-label="روند ماهانه ممتازین">
                {trend.map((t, i) => {
                  const last = i === trend.length - 1;
                  return (
                    <div key={t.label} className="flex flex-col items-center justify-end gap-1 flex-1 h-full" title={`${t.label}: ${toPersianDigits(t.n)} نفر`}>
                      <span className={last ? 'text-sm font-black text-amber-700' : 'text-[10px] font-bold text-slate-500'}>{toPersianDigits(t.n)}</span>
                      <span
                        className={`w-full max-w-9 rounded-t-lg ${t.n > 0 ? 'bg-gradient-to-t from-amber-500 to-yellow-300' : 'bg-amber-200/70'}`}
                        style={{ height: t.n > 0 ? `${Math.max(6, (t.n / trendMax) * 52)}px` : '3px' }}
                      />
                      <span className={`text-[10px] ${last ? 'font-bold text-slate-700' : 'text-slate-500'}`}>{t.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="ممتازین انضباطی" subtitle={`${winLabel} · ${toPersianDigits(shownExcellent.length)} ممتاز، ${toPersianDigits(shownNear.length)} تقریباً ممتاز`} icon={<Award className="w-5 h-5" />} size="xl">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold" role="tablist">
          {([['excellent', `ممتاز (${toPersianDigits(shownExcellent.length)})`], ['near', `تقریباً ممتاز (${toPersianDigits(shownNear.length)})`], ['others', `غیرممتاز + دلیل (${toPersianDigits(shownOthers.length)})`]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3.5 py-1.5 rounded-lg cursor-pointer ${tab === k ? 'bg-white shadow-xs text-amber-800' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[10rem]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام…" className="w-full h-10 text-xs bg-slate-50 rounded-xl pr-9 pl-3 outline-none focus:bg-white focus:ring-4 focus:ring-amber-100" />
          </div>
          <PeriodSelect value={period} onChange={setPeriod} />
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-10 text-xs bg-slate-50 rounded-xl px-3 outline-none" aria-label="کلاس">
            <option value="">همه کلاس‌ها</option>
            {byClass.map(({ cls }) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
          </select>
          {tab === 'excellent' && (
            <button type="button" onClick={() => print(shownExcellent)} disabled={shownExcellent.length === 0} className="h-10 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <Printer className="w-4 h-4" /> چاپ لوح برای همه ({toPersianDigits(shownExcellent.length)})
            </button>
          )}
          <button type="button" onClick={exportExcel} className="h-10 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
            <FileSpreadsheet className="w-4 h-4" /> خروجی اکسل
          </button>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40">
          <button type="button" onClick={() => setAdvOpen((v) => !v)} aria-expanded={advOpen} className="!min-h-0 w-full h-11 px-3 flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-amber-600" /> فیلتر پیشرفته (تعیین معیار ممتاز){advActive && <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px]">فعال</span>}</span>
            <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform ${advOpen ? 'rotate-180' : ''}`} />
          </button>
          {advOpen && (
            <div className="px-3 pb-3 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-500">ماه‌های مبنا (در صورت انتخاب، جایگزین بازه‌ی بالا می‌شود)</span>
                  {crit.months.length > 0 && <button type="button" onClick={() => setCrit((c) => ({ ...c, months: [] }))} className="!min-h-0 text-[11px] font-bold text-slate-400 cursor-pointer">پاک کردن</button>}
                </div>
                <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {elapsedMonths().map((m) => (
                    <button key={m.month} type="button" disabled={isFutureMonth(m)} onClick={() => toggleMonth(m.month)}
                      className={`shrink-0 !min-h-0 h-8 px-3 rounded-full text-xs font-bold border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${crit.months.includes(m.month) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>{m.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CRITERIA_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="block text-[11px] font-bold text-slate-500 mb-1 whitespace-nowrap">{f.label}</span>
                    <input type="number" min={0} value={crit[f.key]} onChange={(e) => setCrit((c) => ({ ...c, [f.key]: Math.max(0, Number(e.target.value) || 0) }))} className="w-full h-10 text-xs bg-white rounded-xl px-3 outline-none border border-slate-200 focus:ring-4 focus:ring-amber-100" />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-200/60">
                {presets.map((p) => (
                  <span key={p.name} className="inline-flex items-center rounded-full bg-white border border-amber-200 text-xs font-bold text-amber-800 overflow-hidden">
                    <button type="button" onClick={() => setCrit(p.criteria)} className="!min-h-0 px-3 h-8 cursor-pointer hover:bg-amber-50">{p.name}</button>
                    <button type="button" onClick={() => removePreset(p.name)} aria-label={`حذف ${p.name}`} className="!min-h-0 px-2 h-8 text-slate-400 hover:text-rose-600 cursor-pointer"><X className="w-3 h-3" /></button>
                  </span>
                ))}
                <div className="flex items-center gap-2 mr-auto">
                  <input value={presetName} onChange={(e) => setPresetName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && savePreset()} placeholder="نام فیلتر…" className="w-32 h-9 text-xs bg-white rounded-lg px-2.5 outline-none border border-slate-200" />
                  <button type="button" onClick={savePreset} disabled={!presetName.trim()} className="h-9 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"><Save className="w-3.5 h-3.5" /> ذخیره</button>
                  <button type="button" onClick={() => setCrit(DEFAULT_CRITERIA)} className="h-9 px-3 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">بازنشانی</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {(tab === 'excellent' ? shownExcellent.length : tab === 'near' ? shownNear.length : shownOthers.length) === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">موردی یافت نشد.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(tab === 'excellent' ? shownExcellent.map((s) => ({ student: s, reason: '' })) : tab === 'near' ? shownNear : shownOthers).map(({ student: s, reason }, i) => (
              <li key={s.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${tab === 'excellent' ? 'border-amber-100 bg-amber-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
                <button type="button" onClick={() => { if (onSelectStudent) { setOpen(false); onSelectStudent(s); } }} className="flex-1 min-w-0 text-right flex items-center gap-3 cursor-pointer">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">{toPersianDigits(i + 1)}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 truncate">{studentFullName(s)}</span>
                    <span className="block text-[11px] text-slate-500">{className(s.classId)}{reason && <span className="text-amber-700"> · {reason}</span>}</span>
                  </span>
                </button>
                {tab === 'excellent' && (
                  <button type="button" onClick={() => print([s])} title="چاپ لوح تقدیر" aria-label={`چاپ لوح تقدیر ${studentFullName(s)}`} className="p-2 rounded-lg text-amber-700 hover:bg-amber-100 cursor-pointer shrink-0">
                    <Printer className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-slate-400 leading-5">
          معیار ممتاز: {advActive ? `در ${winLabel} از سقف‌های تعیین‌شده‌ی «فیلتر پیشرفته» فراتر نرود.` : `در ${winLabel} هیچ غیبت (موجه/غیرموجه، روزانه/کلاسی)، تأخیر یا سابقه‌ی انضباطی نداشته باشد.`} آغاز حضور همه‌ی دانش‌آموزان اول مهر است.
          تقریباً ممتاز: بدون مورد انضباطی و غیبت غیرموجه، و هیچ‌گاه بعد از {MINOR_DELAY_TIME} وارد نشده باشد (تأخیرهای تا {MINOR_DELAY_TIME}) یا فقط یک غیبت موجه داشته باشد.
        </p>
      </Modal>
    </>
  );
};
