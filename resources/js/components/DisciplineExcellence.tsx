import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Award, ChevronDown, ChevronLeft, FileSpreadsheet, HelpCircle, Printer, Search } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Modal } from './ui';
import { Student, StudentAttendanceRecord } from '../types';
import { absenceEventsOf, delayEventsOf } from '../utils/attendanceStats';
import { PERSIAN_MONTHS, dateToShamsiString, getTodayShamsi, shamsiStringToDate, toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { studentFullName, compareStudents } from '../utils/studentName';

/** حداقل مدت حضور (روز) برای ممتاز شدن؛ دانش‌آموز تازه‌وارد ممتاز حساب نمی‌شود */
export const MIN_PRESENCE_DAYS = 30;
/** تأخیر تا این مقدار (دقیقه) «مورد جزئی» حساب می‌شود */
const MINOR_DELAY_MINUTES = 20;

export type ExcellencePeriod = 'month' | 'term' | 'year';
const PERIOD_LABEL: Record<ExcellencePeriod, string> = { month: 'این ماه', term: 'این نیمسال', year: 'کل سال تحصیلی' };

const PERIOD_SHORT: Record<ExcellencePeriod, string> = { month: 'ماه', term: 'نیمسال', year: 'سال' };
/** «شهید ثناگو» → «ثناگو» */
const shortClass = (name: string) => name.replace(/^شهید\s+/, '');

const key = (d: string): string => toEnglishDigits(d || '').split('/').map((p, i) => (i === 0 ? p : p.padStart(2, '0'))).join('/');
const pad = (n: number) => String(n).padStart(2, '0');

/** شروع بازه (تاریخ شمسی)؛ خالی = از ابتدا */
const periodStart = (p: ExcellencePeriod): string => {
  const t = getTodayShamsi();
  if (p === 'month') return `${t.year}/${pad(t.month)}/01`;
  if (p === 'term') {
    if (t.month >= 7 && t.month <= 10) return `${t.year}/07/01`;
    if (t.month >= 11) return `${t.year}/11/01`;
    return `${t.year - 1}/11/01`; // بهمن تا شهریور: نیمسال دوم
  }
  return '';
};

type Incident = { date: string; kind: 'delay' | 'absence' | 'classAbsence' | 'note'; minutes?: number; excused?: boolean };

interface Verdict {
  student: Student;
  incidents: Incident[];
  eligible: boolean;
  /** آغاز حضور (تاریخ شمسی) یا null اگر هیچ مبنایی نیست */
  start: string | null;
  presenceDays: number | null;
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

/** ارزیابی همه‌ی دانش‌آموزان: رویدادهای انضباطی + تاریخ آغاز حضور */
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
    const classFirst = new Map<string, string>();
    (sessions || []).forEach((sess) => {
      const d = key(sess.date);
      if (!classFirst.has(sess.classId) || d < classFirst.get(sess.classId)!) classFirst.set(sess.classId, d);
      if (!sess.records) return;
      const recs = (Array.isArray(sess.records) ? sess.records : Object.entries(sess.records).map(([id, r]) => ({ ...(r as object), studentId: id }))) as StudentAttendanceRecord[];
      recs.forEach((r) => {
        if (r.status === 'absent') classAbsent.set(r.studentId, [...(classAbsent.get(r.studentId) || []), d]);
      });
    });
    const firstMorning = new Map<string, string>();
    (morningAttendance || []).forEach((r) => {
      const d = key(r.date);
      if (!firstMorning.has(r.studentId) || d < firstMorning.get(r.studentId)!) firstMorning.set(r.studentId, d);
    });

    const scoped = scopeClassIds ? students.filter((s) => scopeClassIds.includes(s.classId)) : students;
    const todayMs = shamsiStringToDate(getTodayShamsi().formattedDate).getTime();

    const verdicts: Verdict[] = scoped.map((student) => {
      const incidents: Incident[] = [
        ...delayEventsOf(student, src).map((e) => ({ date: key(e.date), kind: 'delay' as const, minutes: e.minutes })),
        ...absenceEventsOf(student, src).map((e) => ({ date: key(e.date), kind: 'absence' as const, excused: e.excused })),
        ...(classAbsent.get(student.id) || []).map((d) => ({ date: d, kind: 'classAbsence' as const })),
        ...(student.disciplinaryNotes || []).map((n) => ({ date: key(n.date), kind: 'note' as const })),
      ];
      // آغاز حضور: زمان ثبت دانش‌آموز، وگرنه اولین حضور و غیاب صبحگاه او، وگرنه اولین جلسه‌ی کلاسش
      const created = (student as Student & { createdAt?: string }).createdAt;
      let start: string | null = null;
      if (created && !Number.isNaN(Date.parse(created))) start = dateToShamsiString(new Date(created));
      else start = firstMorning.get(student.id) || classFirst.get(student.classId) || null;
      const eligible = start !== null && (todayMs - shamsiStringToDate(start).getTime()) / 86400000 >= MIN_PRESENCE_DAYS;
      return { student, incidents, eligible, start, presenceDays: start === null ? null : Math.floor((todayMs - shamsiStringToDate(start).getTime()) / 86400000) };
    });
    // سابقه‌ی نمره/وضعیت انضباطی خارج از رویدادها
    const flagged = new Set(scoped.filter((s) => (s.disciplinaryStatus && s.disciplinaryStatus !== 'normal') || (s.disciplineScore ?? s.disciplinaryScore ?? 20) < 20).map((s) => s.id));

    // آغاز حضور هر دانش‌آموز برای روند ماهانه
    const starts = new Map<string, string | null>();
    scoped.forEach((s) => {
      const created = (s as Student & { createdAt?: string }).createdAt;
      starts.set(s.id, created && !Number.isNaN(Date.parse(created)) ? dateToShamsiString(new Date(created)) : firstMorning.get(s.id) || classFirst.get(s.classId) || null);
    });
    return { verdicts, flagged, starts, classes, scoped };
  }, [students, classes, sessions, morningAttendance, morningDelays, schoolAbsences, scopeClassIds]);
}

export function useDisciplineExcellence(period: ExcellencePeriod, scopeClassIds?: string[]) {
  const { verdicts, flagged, starts, classes, scoped } = useVerdicts(scopeClassIds);
  return useMemo(() => {
    const from = periodStart(period);
    const inWin = (d: string) => !from || d >= from;
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
    verdicts.forEach(({ student, incidents, eligible, start, presenceDays }) => {
      if (!eligible) {
        others.push({
          student,
          reason: start === null
            ? 'آغاز حضور مشخص نیست (نه تاریخ ثبت دارد، نه حضور و غیاب)'
            : `کمتر از ${toPersianDigits(MIN_PRESENCE_DAYS)} روز از ثبت در سامانه (${toPersianDigits(Math.max(0, presenceDays || 0))} روز؛ از ${toPersianDigits(start)})`,
        });
        return;
      }
      const inc = incidents.filter((i) => inWin(i.date));
      // نمره/وضعیت انضباطی تجمعی است؛ فقط در بازه‌ی «کل سال» ملاک است
      const notFlagged = from !== '' || !flagged.has(student.id);
      if (inc.length === 0 && notFlagged) { excellent.push(student); return; }
      if (inc.length === 1 && notFlagged) {
        const i = inc[0];
        if (i.kind === 'delay' && (i.minutes || 0) <= MINOR_DELAY_MINUTES) near.push({ student, reason: `یک تأخیر ${toPersianDigits(i.minutes || 0)} دقیقه‌ای` });
        else if (i.kind === 'absence' && i.excused) near.push({ student, reason: 'یک غیبت موجه' });
        else others.push({ student, reason: describe(inc) });
        return;
      }
      if (inc.length === 0) others.push({ student, reason: 'نمره یا وضعیت انضباطی پرونده کمتر از ۲۰ / غیرعادی است' });
      else others.push({ student, reason: describe(inc) });
    });
    others.sort((a, b) => compareStudents(a.student, b.student));
    excellent.sort(compareStudents);
    near.sort((a, b) => compareStudents(a.student, b.student));

    const byClass = classes
      .filter((c) => !scopeClassIds || scopeClassIds.includes(c.id))
      .map((c) => ({ cls: c, count: excellent.filter((s) => s.classId === c.id).length, size: scoped.filter((s) => s.classId === c.id).length }))
      .filter((x) => x.size > 0);

    // روند ۶ ماه اخیر: دانش‌آموزان بدون هیچ مورد در همان ماه
    const t = getTodayShamsi();
    const trend = Array.from({ length: 6 }, (_, k) => {
      const idx = t.month - 1 - (5 - k);
      const y = t.year + Math.floor(idx / 12);
      const m = ((idx % 12) + 12) % 12 + 1;
      const a = `${y}/${pad(m)}/01`;
      const b = `${y}/${pad(m)}/31`;
      let n = 0;
      // مرجع محاسبه‌ی «۳۰ روز حضور»: امروز برای ماه جاری، وگرنه پایان همان ماه (همان شرط فهرست ممتازین)
      const refMs = (y === t.year && m === t.month) ? shamsiStringToDate(t.formattedDate).getTime() : shamsiStringToDate(`${y}/${pad(m)}/${m <= 6 ? 31 : 29}`).getTime();
      verdicts.forEach(({ student, incidents }) => {
        const st = starts.get(student.id);
        if (!st || st > b) return;
        if ((refMs - shamsiStringToDate(st).getTime()) / 86400000 < MIN_PRESENCE_DAYS) return;
        if (!incidents.some((i) => i.date >= a && i.date <= b)) n += 1;
      });
      return { label: PERSIAN_MONTHS[m - 1], n };
    });
    return { excellent, near, others, byClass, total: scoped.length, trend };
  }, [verdicts, flagged, starts, classes, scoped, period, scopeClassIds]);
}

/** «ممتازین انضباطی»: مدیر، معاون تربیتی، معاون انضباطی و مربی (فقط کلاس‌های خودش) */
export const DisciplineExcellenceCard: React.FC<{ onSelectStudent?: (s: Student) => void; classIds?: string[] }> = ({ onSelectStudent, classIds }) => {
  const { isAdmin, isDisciplinaryVice, isNurturingVice, isCoach, classes: allClasses } = useSchool();
  const [period, setPeriod] = useState<ExcellencePeriod>('term');
  const { excellent, near, others, byClass, total, trend } = useDisciplineExcellence(period, classIds);
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [trendOpen, setTrendOpen] = useState(false);
  const [tab, setTab] = useState<'excellent' | 'near' | 'others'>('excellent');
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  if (!(isAdmin || isDisciplinaryVice || isNurturingVice || (isCoach && classIds))) return null;

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
  const print = (list: Student[]) => printCertificates(list.map((s) => ({ name: studentFullName(s), className: className(s.classId) })), PERIOD_LABEL[period]);

  return (
    <>
      <section className="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 via-yellow-50 to-white shadow-xs px-3.5 pt-3 pb-1 sm:px-5" aria-label="ممتازین انضباطی">
        {/* هدر فشرده */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 shrink-0 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center" aria-hidden="true">
              <Award className="w-4.5 h-4.5" />
            </span>
            <h3 className="font-bold text-sm text-slate-900 whitespace-nowrap">ممتازین انضباطی</h3>
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              aria-label="شرایط ممتاز شدن"
              aria-expanded={helpOpen}
              className="!min-h-0 w-6 h-6 shrink-0 rounded-full text-amber-600 hover:bg-amber-100 flex items-center justify-center cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex p-0.5 bg-white/80 border border-amber-100 rounded-lg text-[11px] font-bold" role="group" aria-label="بازه">
              {(Object.keys(PERIOD_LABEL) as ExcellencePeriod[]).map((pk) => (
                <button key={pk} type="button" role="tab" aria-selected={period === pk} onClick={() => setPeriod(pk)} className={`px-2 h-6 rounded-md cursor-pointer ${period === pk ? 'bg-amber-500 text-white' : 'text-slate-500'}`}>{PERIOD_SHORT[pk]}</button>
              ))}
            </div>
            <button type="button" onClick={openAll} className="!min-h-0 text-[11px] font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap cursor-pointer">
              مشاهده همه ←
            </button>
          </div>
        </div>

        {helpOpen && (
          <p className="mt-2 text-[11px] leading-5 text-amber-900 bg-amber-100/60 rounded-lg px-2.5 py-1.5">
            بدون هیچ غیبت، تأخیر یا مورد انضباطی · حداقل {toPersianDigits(MIN_PRESENCE_DAYS)} روز حضور
          </p>
        )}

        {/* ردیف میانی: شاخص + کلاس‌ها */}
        <div className="flex items-center justify-between gap-3 py-2.5">
          <div className="shrink-0">
            <div className="text-3xl leading-none font-black text-amber-700 tabular-nums">
              {toPersianDigits(excellent.length)}<span className="text-xs font-bold text-slate-500 mr-1">نفر</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 whitespace-nowrap">{toPersianDigits(percent)}٪ از {toPersianDigits(total)} دانش‌آموز</div>
          </div>
          {byClass.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5 min-w-0">
              {byClass.map(({ cls, count, size }) => (
                <button key={cls.id} type="button" onClick={() => { setClassId(cls.id); setTab('excellent'); setOpen(true); }}
                  className="!min-h-0 h-6 px-2 rounded-md bg-slate-100 text-[11px] font-bold text-slate-700 whitespace-nowrap truncate cursor-pointer hover:bg-slate-200">
                  {shortClass(cls.name)}: {toPersianDigits(count)}/{toPersianDigits(size)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* روند ۶ ماهه (تاشو) */}
        <div className="border-t border-amber-100">
          <button
            type="button"
            onClick={() => setTrendOpen((v) => !v)}
            aria-expanded={trendOpen}
            className="!min-h-0 w-full h-8 flex items-center justify-between text-[11px] font-bold text-slate-600 cursor-pointer"
          >
            <span>روند ۶ ماهه ({trend[trend.length - 1]?.label}: {toPersianDigits(trend[trend.length - 1]?.n ?? 0)} نفر)</span>
            <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform ${trendOpen ? 'rotate-180' : ''}`} />
          </button>
          {trendOpen && (
            <div className="flex items-end justify-around gap-1.5 h-20 pb-2" role="img" aria-label="روند ماهانه ممتازین">
              {trend.map((t) => (
                <div key={t.label} className="flex flex-col items-center justify-end gap-0.5 flex-1 h-full" title={`${t.label}: ${toPersianDigits(t.n)} نفر`}>
                  <span className="text-[9px] font-bold text-slate-600">{toPersianDigits(t.n)}</span>
                  <span className="w-full max-w-9 rounded-t bg-gradient-to-t from-amber-500 to-yellow-300" style={{ height: `${Math.max(3, (t.n / trendMax) * 34)}px` }} />
                  <span className="text-[9px] text-slate-500">{t.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="ممتازین انضباطی" subtitle={`${PERIOD_LABEL[period]} · ${toPersianDigits(shownExcellent.length)} ممتاز، ${toPersianDigits(shownNear.length)} تقریباً ممتاز`} icon={<Award className="w-5 h-5" />} size="xl">
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
          معیار ممتاز: در {PERIOD_LABEL[period]} هیچ غیبت (موجه/غیرموجه، روزانه/کلاسی)، تأخیر یا سابقه‌ی انضباطی نداشته باشد، نمره انضباط ۲۰ باشد و دست‌کم {toPersianDigits(MIN_PRESENCE_DAYS)} روز از حضورش گذشته باشد.
          تقریباً ممتاز: فقط یک مورد جزئی (تأخیر تا {toPersianDigits(MINOR_DELAY_MINUTES)} دقیقه یا یک غیبت موجه).
        </p>
      </Modal>
    </>
  );
};
