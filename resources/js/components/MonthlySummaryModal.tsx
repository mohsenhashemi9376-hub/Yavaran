import React, { useMemo, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { PERSIAN_MONTHS, getActiveAcademicYear, getAcademicYearStart, getTodayShamsi, toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { exportClassAttendanceToExcel, exportMonthlySummaryToExcel } from '../utils/excelExport';
import { ABSENCE_ALERT_PER_MONTH, DELAY_ALERT_PER_MONTH, absenceEventsOf, delayEventsOf } from '../utils/attendanceStats';
import { X, FileSpreadsheet, AlertTriangle, Phone, BarChart3, Printer, ArrowUp, ArrowDown, ChevronsUpDown, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';
import { studentFullName, compareStudents } from '../utils/studentName';
import { FitTable } from './ui/FitTable';

interface MonthlySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClassId?: string;
  onSelectStudent?: (student: Student) => void;
}

/** ماه‌های سال تحصیلی که گزارش دارند (به ترتیب سال تحصیلی) */
const REPORT_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2];
/** غیبت کلاسی (زنگ‌ها) بیش از این تعداد در ماه، هشدار می‌دهد */
const CLASS_ABSENCE_ALERT = 3;

type Level = 'alert' | 'late' | 'perfect' | 'normal';
type RowFilter = 'all' | 'attention' | 'late' | 'perfect';
type SortKey = 'name' | 'present' | 'classAbsent' | 'daily' | 'delays' | 'rate';

export interface MonthRow {
  student: Student;
  sessions: number;
  present: number;
  classAbsent: number;
  classExcused: number;
  delayCount: number;
  delayMinutes: number;
  dailyUnexcused: number;
  dailyExcused: number;
  rate: number;
  averageScore?: number;
  level: Level;
}

const LEVEL_LABEL: Record<Level, string> = { alert: 'اخطار غیبت', late: 'پرتأخیر', perfect: 'عالی', normal: 'عادی' };
const LEVEL_CLASS: Record<Level, string> = {
  alert: 'bg-rose-100 text-rose-800 border border-rose-200',
  late: 'bg-amber-100 text-amber-800 border border-amber-200',
  perfect: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  normal: 'bg-slate-100 text-slate-700',
};

export const MonthlySummaryModal: React.FC<MonthlySummaryModalProps> = ({ isOpen, onClose, initialClassId, onSelectStudent }) => {
  const { accessibleClasses, students, sessions, morningDelays, morningAttendance, schoolAbsences } = useSchool();
  const todayInfo = getTodayShamsi();

  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || (accessibleClasses.length > 0 ? accessibleClasses[0].id : ''));
  const [selectedMonth, setSelectedMonth] = useState<number>(REPORT_MONTHS.includes(todayInfo.month) ? todayInfo.month : REPORT_MONTHS[0]);
  const [filter, setFilter] = useState<RowFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);

  const currentClass = accessibleClasses.find((c) => c.id === selectedClassId) || accessibleClasses[0];
  const classStudents = useMemo(() => (currentClass ? students.filter((s) => s.classId === currentClass.id).sort(compareStudents) : []), [students, currentClass]);

  // آمار هر ماهِ سال تحصیلی برای کلاس انتخاب‌شده (برای جدول، مقایسه با ماه قبل و روند هشت‌ماهه)
  const byMonth = useMemo(() => {
    const start = getAcademicYearStart(getActiveAcademicYear());
    const src = { morningDelays: morningDelays || [], morningAttendance: morningAttendance || [], schoolAbsences: schoolAbsences || [], sessions: sessions || [] };
    const monthOf = (date: string) => {
      const [y, m] = toEnglishDigits(date || '').split('/').map(Number);
      return { y, m };
    };
    const matches = (date: string, month: number) => {
      const { y, m } = monthOf(date);
      return m === month && (!y || y === (month >= 7 ? start : start + 1));
    };
    const classSessions = sessions.filter((s) => s.classId === currentClass?.id);
    const delaysOf = new Map(classStudents.map((s) => [s.id, delayEventsOf(s, src)]));
    const absencesOf = new Map(classStudents.map((s) => [s.id, absenceEventsOf(s, src)]));

    return new Map(
      REPORT_MONTHS.map((month) => {
        const monthSessions = classSessions.filter((s) => matches(s.date, month));
        let attended = 0;
        let possible = 0;
        const rows: MonthRow[] = classStudents.map((student) => {
          let present = 0, classAbsent = 0, classExcused = 0, sessionLate = 0, score = 0, scoreCount = 0;
          monthSessions.forEach((session) => {
            const rec = session.records[student.id];
            if (!rec) return;
            if (rec.status === 'present') present++;
            else if (rec.status === 'absent') classAbsent++;
            else if (rec.status === 'excused') classExcused++;
            else if (rec.status === 'late') sessionLate++;
            if (rec.score !== undefined) { score += rec.score; scoreCount++; }
          });
          const delays = (delaysOf.get(student.id) || []).filter((e) => matches(e.date, month));
          const daily = (absencesOf.get(student.id) || []).filter((e) => matches(e.date, month));
          const dailyUnexcused = daily.filter((e) => !e.excused).length;
          const rate = monthSessions.length > 0 ? Math.round(((present + sessionLate) / monthSessions.length) * 100) : 100;
          attended += present + sessionLate;
          possible += monthSessions.length;
          const level: Level =
            dailyUnexcused >= ABSENCE_ALERT_PER_MONTH || classAbsent >= CLASS_ABSENCE_ALERT ? 'alert'
            : delays.length >= DELAY_ALERT_PER_MONTH ? 'late'
            : rate === 100 && monthSessions.length > 0 && dailyUnexcused === 0 && delays.length === 0 ? 'perfect'
            : 'normal';
          return {
            student,
            sessions: monthSessions.length,
            present,
            classAbsent,
            classExcused,
            delayCount: delays.length,
            delayMinutes: delays.reduce((a, e) => a + e.minutes, 0),
            dailyUnexcused,
            dailyExcused: daily.length - dailyUnexcused,
            rate,
            averageScore: scoreCount > 0 ? Number((score / scoreCount).toFixed(1)) : undefined,
            level,
          };
        });
        const hasData = monthSessions.length > 0 || rows.some((r) => r.delayCount > 0 || r.dailyUnexcused + r.dailyExcused > 0);
        return [month, { rows, sessionCount: monthSessions.length, overallRate: possible > 0 ? Math.round((attended / possible) * 100) : null, hasData }] as const;
      })
    );
  }, [classStudents, sessions, morningDelays, morningAttendance, schoolAbsences, currentClass?.id]);

  if (!isOpen) return null;

  const cur = byMonth.get(selectedMonth)!;
  const prevMonth = REPORT_MONTHS[REPORT_MONTHS.indexOf(selectedMonth) - 1];
  const prev = prevMonth ? byMonth.get(prevMonth) : undefined;
  const delta = cur.overallRate !== null && prev && prev.overallRate !== null ? cur.overallRate - prev.overallRate : null;
  const selectedMonthName = PERSIAN_MONTHS[selectedMonth - 1];

  const totals = cur.rows.reduce(
    (t, r) => ({ daily: t.daily + r.dailyUnexcused, dailyEx: t.dailyEx + r.dailyExcused, classAbs: t.classAbs + r.classAbsent, delays: t.delays + r.delayCount, minutes: t.minutes + r.delayMinutes }),
    { daily: 0, dailyEx: 0, classAbs: 0, delays: 0, minutes: 0 }
  );
  const attention = cur.rows.filter((r) => r.level === 'alert' || r.level === 'late');
  const counts: Record<RowFilter, number> = {
    all: cur.rows.length,
    attention: cur.rows.filter((r) => r.level === 'alert').length,
    late: cur.rows.filter((r) => r.delayCount >= DELAY_ALERT_PER_MONTH).length,
    perfect: cur.rows.filter((r) => r.level === 'perfect').length,
  };

  const sortValue = (r: MonthRow, key: SortKey): number | string =>
    key === 'name' ? studentFullName(r.student) : key === 'present' ? r.present : key === 'classAbsent' ? r.classAbsent : key === 'daily' ? r.dailyUnexcused * 100 + r.dailyExcused : key === 'delays' ? r.delayCount : r.rate;
  const visibleRows = cur.rows
    .filter((r) => (filter === 'all' ? true : filter === 'attention' ? r.level === 'alert' : filter === 'late' ? r.delayCount >= DELAY_ALERT_PER_MONTH : r.level === 'perfect'))
    .sort((a, b) => {
      if (!sort) return b.dailyUnexcused + b.classAbsent - (a.dailyUnexcused + a.classAbsent) || a.rate - b.rate;
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      const c = typeof x === 'string' ? x.localeCompare(String(y), 'fa') : (x as number) - (y as number);
      return sort.dir === 'asc' ? c : -c;
    });

  const toggleSort = (key: SortKey) => setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  const SortHead: React.FC<{ k: SortKey; children: React.ReactNode; className?: string }> = ({ k, children, className = '' }) => (
    <th className={`p-3 ${className}`}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 font-bold cursor-pointer hover:text-indigo-700" aria-label={`مرتب‌سازی بر اساس ${String(children)}`}>
        {children}
        {sort?.key === k ? (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );

  const exportRows = () => ({
    className: currentClass?.name || '',
    monthName: selectedMonthName,
    rows: cur.rows,
  });
  const handleExportSummary = () => currentClass && exportMonthlySummaryToExcel(exportRows());
  const handleExportSessions = () => {
    if (!currentClass) return;
    exportClassAttendanceToExcel(currentClass, students, sessions, { monthFilter: selectedMonth, monthName: selectedMonthName });
  };
  const handlePrint = () => {
    if (!currentClass) return;
    const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const body = visibleRows
      .map((r, i) => `<tr><td>${toPersianDigits(i + 1)}</td><td>${esc(studentFullName(r.student))}</td><td>${toPersianDigits(r.present)}</td><td>${toPersianDigits(r.classAbsent)}</td><td>${toPersianDigits(r.dailyUnexcused)} / ${toPersianDigits(r.dailyExcused)}</td><td>${toPersianDigits(r.delayCount)}${r.delayMinutes ? ` (${toPersianDigits(r.delayMinutes)} دقیقه)` : ''}</td><td>${r.averageScore !== undefined ? toPersianDigits(r.averageScore) : '-'}</td><td>${toPersianDigits(r.rate)}٪</td><td>${LEVEL_LABEL[r.level]}</td></tr>`)
      .join('');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>گزارش ماهانه</title><style>
      body{font-family:Vazirmatn,Tahoma,sans-serif;margin:16mm;color:#0f172a}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#475569;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:center}td:nth-child(2){text-align:right}th{background:#f1f5f9}
    </style></head><body><h1>گزارش حضور و غیاب ماه ${esc(selectedMonthName)}</h1><p>${esc(currentClass.name)} · میانگین حضور کلاس: ${cur.overallRate === null ? '-' : toPersianDigits(cur.overallRate) + '٪'} · تأخیر کل: ${toPersianDigits(totals.delays)} بار</p>
    <table><thead><tr><th>ردیف</th><th>نام و نام خانوادگی</th><th>حاضر</th><th>غیبت کلاسی</th><th>غیبت روزانه (غیرموجه/موجه)</th><th>تأخیر</th><th>نمره میانگین</th><th>درصد حضور</th><th>وضعیت</th></tr></thead><tbody>${body}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const filters: { key: RowFilter; label: string }[] = [
    { key: 'all', label: 'همه' },
    { key: 'attention', label: 'نیازمند توجه' },
    { key: 'late', label: 'پرتأخیر' },
    { key: 'perfect', label: 'عالی' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">جمع‌بندی و گزارش آماری ماهانه حضور و غیاب</h2>
              <p className="text-xs text-slate-300">گزارش عملکرد ماه {selectedMonthName} • {currentClass?.name || ''}</p>
            </div>
          </div>
          <button id="btn-close-monthly-summary" onClick={onClose} aria-label="بستن" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              id="select-summary-class"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {accessibleClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-1 flex-wrap py-1 max-w-md">
              {REPORT_MONTHS.map((monthNum) => {
                const isSelected = selectedMonth === monthNum;
                const hasData = byMonth.get(monthNum)?.hasData;
                return (
                  <button
                    key={monthNum}
                    type="button"
                    onClick={() => setSelectedMonth(monthNum)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition cursor-pointer ${
                      isSelected ? 'bg-indigo-600 text-white shadow-xs' : `bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 ${hasData ? '' : 'opacity-50'}`
                    }`}
                    title={hasData ? undefined : 'داده‌ای برای این ماه ثبت نشده است'}
                  >
                    {PERSIAN_MONTHS[monthNum - 1]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button id="btn-export-month-excel" onClick={handleExportSummary} className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4" />
              <span>اکسل {selectedMonthName}</span>
            </button>
            <button type="button" onClick={handlePrint} className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center gap-1.5">
              <Printer className="w-4 h-4" />
              <span>چاپ / PDF</span>
            </button>
            <button type="button" onClick={handleExportSessions} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer" title="ماتریس حضور هر جلسه و ریز مباحث">
              ریز جلسات (اکسل)
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* کارت‌های آماری */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-right">
              <div className="text-xs text-slate-500 font-medium">جلسات برگزارشده این ماه</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {toPersianDigits(cur.sessionCount)} <span className="text-xs font-normal text-slate-500">جلسه</span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-right">
              <div className="text-xs text-emerald-800 font-medium">میانگین کل حضور کلاس</div>
              <div className="text-xl font-bold text-emerald-700 mt-1 flex items-center gap-2">
                {cur.overallRate === null ? '—' : `${toPersianDigits(cur.overallRate)}٪`}
                {delta !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                    {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                    {toPersianDigits(Math.abs(delta))}٪
                  </span>
                )}
              </div>
              {delta !== null && <div className="text-[10px] text-emerald-800/70 mt-0.5">نسبت به {PERSIAN_MONTHS[prevMonth - 1]}</div>}
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-right">
              <div className="text-xs text-rose-800 font-medium">غیبت روزانه (غیرموجه)</div>
              <div className="text-xl font-bold text-rose-700 mt-1">
                {toPersianDigits(totals.daily)} <span className="text-xs font-normal text-rose-600">مورد</span>
              </div>
              <div className="text-[10px] text-rose-800/70 mt-0.5">
                {toPersianDigits(totals.dailyEx)} موجه • {toPersianDigits(totals.classAbs)} غیبت کلاسی
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-right">
              <div className="text-xs text-amber-800 font-medium">مجموع موارد تأخیر</div>
              <div className="text-xl font-bold text-amber-700 mt-1">
                {toPersianDigits(totals.delays)} <span className="text-xs font-normal text-amber-600">مورد</span>
              </div>
              <div className="text-[10px] text-amber-800/70 mt-0.5">مجموع {toPersianDigits(totals.minutes)} دقیقه</div>
            </div>
          </div>

          {/* روند هشت‌ماهه */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5">
            <div className="text-xs font-bold text-slate-700 mb-2">روند میانگین حضور کلاس (مهر تا اردیبهشت)</div>
            <div className="flex items-end justify-between gap-2 h-20" role="img" aria-label="روند ماهانه میانگین حضور">
              {REPORT_MONTHS.map((m) => {
                const d = byMonth.get(m)!;
                const v = d.overallRate;
                return (
                  <button key={m} type="button" onClick={() => setSelectedMonth(m)} className="flex-1 h-full flex flex-col items-center justify-end gap-0.5 cursor-pointer" title={v === null ? 'بدون داده' : `${PERSIAN_MONTHS[m - 1]}: ${toPersianDigits(v)}٪`}>
                    <span className="text-[9px] font-bold text-slate-500">{v === null ? '' : toPersianDigits(v)}</span>
                    <span
                      className={`w-full max-w-8 rounded-t ${m === selectedMonth ? 'bg-indigo-500' : v === null ? 'bg-slate-200' : 'bg-indigo-200'}`}
                      style={{ height: v === null ? '3px' : `${Math.max(6, (v / 100) * 44)}px` }}
                    />
                    <span className={`text-[9px] ${m === selectedMonth ? 'font-bold text-indigo-700' : 'text-slate-500'}`}>{PERSIAN_MONTHS[m - 1]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* کادر فشرده‌ی نیازمند توجه */}
          {attention.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-rose-900 whitespace-nowrap">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                نیازمند توجه در {selectedMonthName}:
              </span>
              {attention.map((r) => (
                <span key={r.student.id} className="inline-flex items-center gap-1 bg-white border border-rose-200 rounded-lg ps-2 pe-1 py-0.5 text-[11px]">
                  <button type="button" onClick={() => onSelectStudent && onSelectStudent(r.student)} className="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer" title="مشاهده پرونده دانش‌آموز">
                    {studentFullName(r.student)}
                  </button>
                  <span className={r.level === 'alert' ? 'text-rose-600 font-semibold' : 'text-amber-700 font-semibold'}>
                    {r.level === 'alert'
                      ? `${toPersianDigits(r.dailyUnexcused >= ABSENCE_ALERT_PER_MONTH ? r.dailyUnexcused : r.classAbsent)} غیبت`
                      : `${toPersianDigits(r.delayCount)} تأخیر`}
                  </span>
                  <a href={`tel:${r.student.parentPhone}`} className="p-1 bg-rose-100 text-rose-800 rounded-md hover:bg-rose-200" title="تماس با اولیاء">
                    <Phone className="w-3 h-3" />
                  </a>
                </span>
              ))}
            </div>
          )}

          {/* جدول / کارت‌ها */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-bold text-slate-800">جزئیات حضور و غیاب دانش‌آموزان در ماه {selectedMonthName}</h3>
              <span className="text-xs text-slate-500">تعداد کل دانش‌آموزان: {toPersianDigits(cur.rows.length)} نفر</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-100 p-1 rounded-xl text-xs font-bold w-fit max-w-full" role="tablist">
              {filters.map((f) => (
                <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer transition flex items-center gap-1.5 ${filter === f.key ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
                  {f.label}
                  <span className="text-[10px] px-1.5 rounded-full bg-slate-200/70 font-mono">{toPersianDigits(counts[f.key])}</span>
                </button>
              ))}
            </div>

            {!cur.hasData ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                در ماه {selectedMonthName} هیچ جلسه یا رویداد حضور و غیابی برای این کلاس ثبت نشده است.
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">موردی با این فیلتر پیدا نشد.</div>
            ) : (
              <>
                {/* موبایل: کارت فشرده */}
                <ul className="sm:hidden space-y-2">
                  {visibleRows.map((r, idx) => (
                    <li key={r.student.id} className={`rounded-2xl border p-3 ${r.level === 'alert' ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => onSelectStudent && onSelectStudent(r.student)} className="text-sm font-extrabold text-slate-900 text-right cursor-pointer">
                          <span className="text-slate-400 font-mono text-xs ml-1.5">{toPersianDigits(idx + 1)}</span>
                          {studentFullName(r.student)}
                        </button>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_CLASS[r.level]}`}>{LEVEL_LABEL[r.level]}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-1.5 text-center text-[11px]">
                        <div className="rounded-xl bg-emerald-50 py-1.5"><div className="font-black text-emerald-700">{toPersianDigits(r.present)}</div><div className="text-slate-500">حاضر</div></div>
                        <div className="rounded-xl bg-rose-50 py-1.5"><div className="font-black text-rose-700">{toPersianDigits(r.dailyUnexcused)}</div><div className="text-slate-500">غیبت روزانه</div></div>
                        <div className="rounded-xl bg-amber-50 py-1.5"><div className="font-black text-amber-700">{toPersianDigits(r.delayCount)}</div><div className="text-slate-500">تأخیر</div></div>
                        <div className="rounded-xl bg-indigo-50 py-1.5"><div className="font-black text-indigo-700">{toPersianDigits(r.rate)}٪</div><div className="text-slate-500">حضور</div></div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* دسکتاپ: جدول */}
                <div className="hidden sm:block">
                  <FitTable className="border border-slate-200 rounded-xl shadow-xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-12 text-center">ردیف</th>
                          <SortHead k="name">نام و نام خانوادگی</SortHead>
                          <SortHead k="present" className="text-center">حاضر</SortHead>
                          <SortHead k="classAbsent" className="text-center">غیبت کلاسی</SortHead>
                          <SortHead k="daily" className="text-center">غیبت روزانه</SortHead>
                          <SortHead k="delays" className="text-center">تأخیر</SortHead>
                          <th className="p-3 text-center">نمره میانگین</th>
                          <SortHead k="rate" className="text-center">درصد حضور ماه</SortHead>
                          <th className="p-3 text-center">وضعیت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleRows.map((r, idx) => (
                          <tr key={r.student.id} className={`transition ${r.level === 'alert' ? 'bg-rose-50/40' : 'hover:bg-slate-50'}`}>
                            <td className="p-3 text-center font-bold text-slate-400">{toPersianDigits(idx + 1)}</td>
                            <td className="p-3">
                              <button type="button" onClick={() => onSelectStudent && onSelectStudent(r.student)} className="font-bold text-slate-900 hover:text-indigo-600 hover:underline text-right cursor-pointer flex items-center gap-1.5" title="مشاهده کارنامه و پرونده دانش‌آموز">
                                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold">{r.student.firstName[0]}</div>
                                <span>{studentFullName(r.student)}</span>
                              </button>
                            </td>
                            <td className="p-3 text-center text-emerald-700 font-bold">{toPersianDigits(r.present)}</td>
                            <td className="p-3 text-center text-rose-700 font-bold">
                              {toPersianDigits(r.classAbsent)}
                              {r.classExcused > 0 && <span className="text-[10px] text-blue-600 block font-medium">+{toPersianDigits(r.classExcused)} موجه</span>}
                            </td>
                            <td className="p-3 text-center text-rose-700 font-bold">
                              {toPersianDigits(r.dailyUnexcused)}
                              {r.dailyExcused > 0 && <span className="text-[10px] text-blue-600 block font-medium">+{toPersianDigits(r.dailyExcused)} موجه</span>}
                            </td>
                            <td className="p-3 text-center text-amber-700 font-medium">
                              {toPersianDigits(r.delayCount)}
                              {r.delayMinutes > 0 && <span className="text-[10px] text-amber-600 block">({toPersianDigits(r.delayMinutes)} دقیقه)</span>}
                            </td>
                            <td className="p-3 text-center font-bold text-slate-700">{r.averageScore !== undefined ? toPersianDigits(r.averageScore) : '-'}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                                  <div className={`h-full rounded-full ${r.rate >= 85 ? 'bg-emerald-500' : r.rate >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${r.rate}%` }} />
                                </div>
                                <span className="font-bold text-[11px] text-slate-800">{toPersianDigits(r.rate)}٪</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_CLASS[r.level]}`}>
                                {r.level === 'late' && <Clock className="w-3 h-3 inline -mt-0.5 ml-0.5" />}
                                {LEVEL_LABEL[r.level]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </FitTable>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
