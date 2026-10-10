import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Search, FileSpreadsheet, RotateCcw, CheckCircle2, XCircle, Send, X, ChevronLeft, BarChart3 } from 'lucide-react';
import { PageHeader, Button } from './ui';
import { useSchool } from '../context/SchoolContext';
import { apiRequest } from '../lib/serverSync';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { buildAttendanceStats, StudentAttendanceStat, monthKeyOf } from '../utils/attendanceStats';
import { DELAY_MINUTES_PER_POINT, DELAY_POINTS_DEDUCTED, formatMinutesLong } from '../utils/delays';
import { AttendanceAlertsCard, referralRefId } from './AttendanceAlertsCard';
import { TrendTile } from './Sparkline';
import { attendanceTrends } from '../utils/trends';
import type { Student } from '../types';

/** آمار تجمیعی هر دانش‌آموز + هشدارهای ماهانه؛ مشترک بین صفحه‌ی آمار و داشبوردها */
export function useAttendanceStats(period: 'month' | 'all' = 'month') {
  const { students, morningDelays, morningAttendance, schoolAbsences, sessions } = useSchool();
  const monthKey = useMemo(() => monthKeyOf(getTodayShamsi().formattedDate), []);
  const stats = useMemo(
    () => buildAttendanceStats(students, { morningDelays, morningAttendance, schoolAbsences, sessions }, { monthKey, period }),
    [students, morningDelays, morningAttendance, schoolAbsences, sessions, monthKey, period]
  );
  return { stats, monthKey };
}

/** ارجاع‌های ثبت‌شده و ثبت ارجاع تازه */
export function useReferrals(enabled: boolean) {
  const { showToast } = useSchool();
  const [referred, setReferred] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!enabled) return;
    apiRequest<{ referrals: string[] }>('GET', '/api/referrals')
      .then((r) => setReferred(new Set(r.referrals || [])))
      .catch(() => undefined);
  }, [enabled]);

  const refer = async (stat: StudentAttendanceStat, kind: 'absence' | 'delay', monthKey: string, note: string) => {
    const summary = kind === 'absence'
      ? `${toPersianDigits(stat.monthUnexcused)} روز غیبت غیرموجه در ماه ${toPersianDigits(monthKey)}.`
      : `${toPersianDigits(stat.monthDelayCount)} بار تأخیر در ماه ${toPersianDigits(monthKey)}.`;
    try {
      await apiRequest('POST', '/api/referrals', { studentId: stat.student.id, kind, month: monthKey, summary, note: note.trim() || undefined });
      setReferred((cur) => new Set(cur).add(referralRefId(stat.student.id, kind, monthKey)));
      showToast('ارجاع به معاون تربیتی ثبت شد.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ثبت ارجاع ناموفق بود.', 'error');
    }
  };
  return { referred, refer };
}

/** مودال کوتاه ارجاع (با توضیح اختیاری) */
export const ReferralDialog: React.FC<{
  target: { stat: StudentAttendanceStat; kind: 'absence' | 'delay' } | null;
  onClose: () => void;
  onSubmit: (note: string) => void;
}> = ({ target, onClose, onSubmit }) => {
  const [note, setNote] = useState('');
  useEffect(() => setNote(''), [target]);
  if (!target) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()} dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-slate-900">ارجاع به معاون تربیتی</h3>
            <p className="text-xs text-slate-500 mt-1">{studentFullName(target.stat.student)} — {target.kind === 'absence' ? 'غیبت غیرموجه' : 'تأخیر مکرر'}</p>
          </div>
          <button onClick={onClose} aria-label="بستن" className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="توضیح برای معاون تربیتی (اختیاری)"
          className="w-full text-sm bg-slate-50 rounded-2xl px-4 py-3 outline-none focus:bg-white focus:ring-4 focus:ring-violet-100" />
        <button onClick={() => { onSubmit(note); onClose(); }} className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 cursor-pointer">
          <Send className="w-4 h-4" /> ثبت ارجاع
        </button>
      </div>
    </div>
  );
};

const num = (v: string): number | null => {
  const n = parseInt(v.replace(/[^0-9۰-۹]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))), 10);
  return Number.isFinite(n) ? n : null;
};

interface Props {
  onSelectStudent?: (s: Student) => void;
}

const fieldCls = 'h-10 text-xs bg-slate-50 rounded-xl px-3 outline-none focus:bg-white focus:ring-4 focus:ring-teal-100';

export const AttendanceStatsView: React.FC<Props> = ({ onSelectStudent }) => {
  const { classes, isAdmin, isDisciplinaryVice, resolveDelayDeduction } = useSchool();
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const { stats, monthKey } = useAttendanceStats(period);
  const { stats: monthStats } = useAttendanceStats('month');
  const canRefer = isDisciplinaryVice;
  const canApprove = isAdmin || isDisciplinaryVice;
  const { referred, refer } = useReferrals(canRefer);

  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  const [minMinutes, setMinMinutes] = useState('');
  const [maxMinutes, setMaxMinutes] = useState('');
  const [minDelays, setMinDelays] = useState('');
  const [minUnexcused, setMinUnexcused] = useState('');
  const [minExcused, setMinExcused] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [sort, setSort] = useState<'minutes' | 'delays' | 'unexcused' | 'name'>('minutes');
  const [target, setTarget] = useState<{ stat: StudentAttendanceStat; kind: 'absence' | 'delay' } | null>(null);

  const classNameOf = (id: string) => classes.find((c) => c.id === id)?.name || '—';

  const rows = useMemo(() => {
    const mn = num(minMinutes), mx = num(maxMinutes), md = num(minDelays), mu = num(minUnexcused), me = num(minExcused);
    const text = q.trim();
    return stats
      .filter((s) => (!classId || s.student.classId === classId)
        && (!text || studentFullName(s.student).includes(text) || (s.student.studentCode || '').includes(text) || (s.student.nationalId || '').includes(text))
        && (mn === null || s.delayMinutes >= mn)
        && (mx === null || s.delayMinutes <= mx)
        && (md === null || s.delayCount >= md)
        && (mu === null || s.unexcusedAbsences >= mu)
        && (me === null || s.excusedAbsences >= me)
        && (!onlyPending || s.pendingDeductions > 0))
      .sort((a, b) => sort === 'name' ? studentFullName(a.student).localeCompare(studentFullName(b.student), 'fa')
        : sort === 'delays' ? b.delayCount - a.delayCount
        : sort === 'unexcused' ? b.unexcusedAbsences - a.unexcusedAbsences
        : b.delayMinutes - a.delayMinutes);
  }, [stats, q, classId, minMinutes, maxMinutes, minDelays, minUnexcused, minExcused, onlyPending, sort]);

  const reset = () => { setQ(''); setClassId(''); setMinMinutes(''); setMaxMinutes(''); setMinDelays(''); setMinUnexcused(''); setMinExcused(''); setOnlyPending(false); };
  const preset = (fn: () => void) => { reset(); fn(); };

  const exportExcel = () => {
    const data = rows.map((s, i) => ({
      'ردیف': i + 1,
      'دانش‌آموز': studentFullName(s.student),
      'کلاس': classNameOf(s.student.classId),
      'بازه': period === 'month' ? `ماه ${monthKey}` : 'کل دوره',
      'غیبت غیرموجه (روز)': s.unexcusedAbsences,
      'غیبت موجه (روز)': s.excusedAbsences,
      'دفعات تأخیر': s.delayCount,
      'مجموع دقایق تأخیر': s.delayMinutes,
      'کسر منتظر تأیید': s.pendingDeductions,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'آمار تأخیر و غیبت');
    XLSX.writeFile(wb, `آمار_تاخیر_و_غیبت_${getTodayShamsi().formattedDate.replace(/\//g, '-')}.xlsx`);
  };

  const totals = useMemo(() => ({
    minutes: rows.reduce((a, s) => a + s.delayMinutes, 0),
    unexcused: rows.reduce((a, s) => a + s.unexcusedAbsences, 0),
    pending: rows.reduce((a, s) => a + s.pendingDeductions, 0),
  }), [rows]);

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        title="آمار تأخیر و غیبت"
        subtitle="غیبت‌های کلاسی (زنگ‌ها) در این آمار نیامده است؛ فقط غیبت روزانهٔ مدرسه و تأخیرها."
        icon={<BarChart3 className="w-5 h-5" />}
        className="!mb-0"
        actions={<Button variant="secondary" onClick={exportExcel} icon={<FileSpreadsheet className="w-4 h-4" />}>خروجی اکسل</Button>}
      />

      <AttendanceAlertsCard stats={monthStats} showDelays={isDisciplinaryVice} canRefer={canRefer} referred={referred} monthKey={monthKey}
        classNameOf={classNameOf} onRefer={(stat, kind) => setTarget({ stat, kind })} onOpenStudent={onSelectStudent} />

      {/* فیلترها */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام یا کد…" className={`${fieldCls} w-full pr-9`} />
          </div>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={fieldCls} aria-label="کلاس">
            <option value="">همه کلاس‌ها</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {([['month', 'ماه جاری'], ['all', 'کل دوره']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setPeriod(k)} className={`px-3 h-8 rounded-lg text-xs font-bold cursor-pointer ${period === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>{l}</button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={fieldCls} aria-label="مرتب‌سازی">
            <option value="minutes">بیشترین دقایق تأخیر</option>
            <option value="delays">بیشترین دفعات تأخیر</option>
            <option value="unexcused">بیشترین غیبت غیرموجه</option>
            <option value="name">نام</option>
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {([
            ['حداقل دقایق تأخیر', minMinutes, setMinMinutes],
            ['حداکثر دقایق تأخیر', maxMinutes, setMaxMinutes],
            ['حداقل دفعات تأخیر', minDelays, setMinDelays],
            ['حداقل غیبت غیرموجه', minUnexcused, setMinUnexcused],
            ['حداقل غیبت موجه', minExcused, setMinExcused],
          ] as const).map(([label, value, set]) => (
            <label key={label} className="text-[11px] font-bold text-slate-500 space-y-1">
              <span>{label}</span>
              <input inputMode="numeric" value={value} onChange={(e) => set(e.target.value)} placeholder="—" className={`${fieldCls} w-full`} />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-bold text-slate-500">فیلتر سریع:</span>
          {([
            ['۶۰+ دقیقه تأخیر', () => setMinMinutes('60')],
            [`${toPersianDigits(DELAY_MINUTES_PER_POINT)}+ دقیقه تأخیر`, () => setMinMinutes(String(DELAY_MINUTES_PER_POINT))],
            ['۳+ بار تأخیر', () => setMinDelays('3')],
            ['۳+ غیبت غیرموجه', () => setMinUnexcused('3')],
            ['منتظر تأیید کسر نمره', () => setOnlyPending(true)],
          ] as const).map(([label, fn]) => (
            <button key={label} onClick={() => preset(fn)} className="px-3 py-1 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold border border-teal-200 cursor-pointer">{label}</button>
          ))}
          <label className="flex items-center gap-1.5 mr-auto cursor-pointer text-slate-600 font-bold">
            <input type="checkbox" className="accent-teal-700" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> فقط منتظر تأیید کسر نمره
          </label>
          <button onClick={reset} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 font-bold cursor-pointer"><RotateCcw className="w-3.5 h-3.5" /> پاک‌کردن فیلترها</button>
        </div>
      </div>

      {/* خلاصه */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {[
          ['دانش‌آموز', rows.length, 'text-slate-900'],
          ['مجموع تأخیر', formatMinutesLong(totals.minutes), 'text-amber-700'],
          ['غیبت غیرموجه', `${toPersianDigits(totals.unexcused)} روز`, 'text-rose-700'],
          ['کسر منتظر تأیید', totals.pending, 'text-violet-700'],
        ].map(([label, value, cls]) => (
          <div key={String(label)} className="bg-white rounded-2xl border border-slate-200/80 p-3">
            <div className="text-slate-500">{label}</div>
            <div className={`text-lg font-black mt-0.5 ${cls}`}>{typeof value === 'number' ? toPersianDigits(value) : toPersianDigits(String(value))}</div>
          </div>
        ))}
      </div>

      {/* فهرست (بدون اسکرول افقی) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="hidden lg:grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.8fr))_minmax(0,1.6fr)] gap-2 px-5 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-500 border-b border-slate-100">
          <div>دانش‌آموز</div><div className="text-center">غیبت غیرموجه</div><div className="text-center">غیبت موجه</div><div className="text-center">دفعات تأخیر</div><div className="text-center">دقایق تأخیر</div><div className="text-center">کسر نمره</div>
        </div>
        {rows.length === 0 && <div className="py-14 text-center text-sm text-slate-400">موردی با این فیلترها پیدا نشد.</div>}
        <div className="divide-y divide-slate-100">
          {rows.map((s) => (
            <div key={s.student.id} className="px-4 sm:px-5 py-3 grid grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,0.8fr))_minmax(0,1.6fr)] gap-x-2 gap-y-2 items-center hover:bg-slate-50/60">
              <button type="button" onClick={() => onSelectStudent?.(s.student)} className="col-span-2 lg:col-span-1 text-right min-w-0 cursor-pointer">
                <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-1">{studentFullName(s.student)} <ChevronLeft className="w-3.5 h-3.5 text-slate-300" /></div>
                <div className="text-[11px] text-slate-500">{classNameOf(s.student.classId)}</div>
              </button>
              {([
                ['غیبت غیرموجه', s.unexcusedAbsences, s.unexcusedAbsences >= 3 ? 'text-rose-700' : 'text-slate-800', ''],
                ['غیبت موجه', s.excusedAbsences, 'text-slate-800', ''],
                ['دفعات تأخیر', s.delayCount, s.delayCount >= 3 ? 'text-amber-700' : 'text-slate-800', ''],
                ['دقایق تأخیر', s.delayMinutes, 'text-slate-800', ' دقیقه'],
              ] as const).map(([label, v, cls, unit]) => (
                <div key={label} className="flex lg:block items-center justify-between lg:text-center">
                  <span className="lg:hidden text-[11px] text-slate-500">{label}</span>
                  <span className={`font-black text-sm ${cls}`}>{toPersianDigits(v)}{unit}</span>
                </div>
              ))}
              <div className="col-span-2 lg:col-span-1 flex items-center lg:justify-center gap-1.5 flex-wrap">
                {s.pendingDeductions > 0 ? (
                  <>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 rounded-full px-2.5 py-1">{toPersianDigits(s.pendingDeductions * DELAY_POINTS_DEDUCTED)} نمره منتظر تأیید</span>
                    {canApprove && (
                      <>
                        <button onClick={() => resolveDelayDeduction(s.student.id, true)} className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"><CheckCircle2 className="w-3.5 h-3.5" /> تأیید کسر</button>
                        <button onClick={() => resolveDelayDeduction(s.student.id, false)} className="h-7 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"><XCircle className="w-3.5 h-3.5" /> رد</button>
                      </>
                    )}
                  </>
                ) : s.approvedDeductions > 0 ? (
                  <span className="text-[11px] font-bold text-violet-700 bg-violet-50 rounded-full px-2.5 py-1">−{toPersianDigits(s.approvedDeductions)} نمره اعمال شد</span>
                ) : (
                  <span className="text-[11px] text-slate-400">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ReferralDialog target={target} onClose={() => setTarget(null)} onSubmit={(note) => target && refer(target.stat, target.kind, monthKey, note)} />
    </div>
  );
};

/** کارت هشدار ماهانه‌ی غیبت و تأخیر برای صفحه‌ی اصلی معاون انضباطی و مدیر */
export const AttendanceAlertsPanel: React.FC<{ onOpenStats?: () => void; onSelectStudent?: (s: Student) => void }> = ({ onOpenStats, onSelectStudent }) => {
  const { classes, isDisciplinaryVice } = useSchool();
  const { stats, monthKey } = useAttendanceStats('month');
  const { referred, refer } = useReferrals(isDisciplinaryVice);
  const [target, setTarget] = useState<{ stat: StudentAttendanceStat; kind: 'absence' | 'delay' } | null>(null);
  const hasAlerts = stats.some((s) => s.monthUnexcused >= 3 || (isDisciplinaryVice && s.monthDelayCount >= 3));
  if (!hasAlerts) return null;
  return (
    <div className="space-y-2">
      <AttendanceAlertsCard stats={stats} showDelays={isDisciplinaryVice} canRefer={isDisciplinaryVice} referred={referred} monthKey={monthKey}
        classNameOf={(id) => classes.find((c) => c.id === id)?.name || '—'} onRefer={(stat, kind) => setTarget({ stat, kind })} onOpenStudent={onSelectStudent} />
      {onOpenStats && (
        <button onClick={onOpenStats} className="text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer">مشاهده آمار کامل تأخیر و غیبت ←</button>
      )}
      <ReferralDialog target={target} onClose={() => setTarget(null)} onSubmit={(note) => target && refer(target.stat, target.kind, monthKey, note)} />
    </div>
  );
};

/** روند ۱۴ روز اخیر تأخیر و غیبت غیرموجه (نمودار کوچک) برای صفحه‌ی اصلی انضباطی */
export const AttendanceTrendsPanel: React.FC = () => {
  const { students, morningDelays, morningAttendance, schoolAbsences, sessions } = useSchool();
  const t = useMemo(
    () => attendanceTrends(students, { morningDelays, morningAttendance, schoolAbsences, sessions }, 14),
    [students, morningDelays, morningAttendance, schoolAbsences, sessions]
  );
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  return (
    <div data-stagger className="grid grid-cols-2 sm:grid-cols-3 gap-3 [&>*:nth-child(3)]:col-span-2 sm:[&>*:nth-child(3)]:col-span-1">
      <TrendTile label="تأخیرها" total={toPersianDigits(sum(t.delays))} hint="۱۴ روز اخیر" values={t.delays} color="#d97706" />
      <TrendTile label="دقایق تأخیر" total={toPersianDigits(sum(t.minutes))} hint="۱۴ روز اخیر" values={t.minutes} color="#7c3aed" />
      <TrendTile label="غیبت غیرموجه" total={toPersianDigits(sum(t.absences))} hint="۱۴ روز اخیر" values={t.absences} color="#e11d48" />
    </div>
  );
};
