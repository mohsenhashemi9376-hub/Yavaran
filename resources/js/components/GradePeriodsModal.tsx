import React, { useMemo, useState } from 'react';
import { CalendarCheck, ChevronDown, Lock, LockOpen, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { isPeriodOpenForSubject, periodUngradedStats } from '../utils/gradePeriods';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** ماه‌هایی که معاون آموزش جداگانه برایشان ثبت نمره را باز یا بسته می‌کند */
const MONTH_CODES = ['mehrContinuous', 'abanContinuous', 'azarContinuous', 'term1Continuous', 'bahmanContinuous', 'esfandContinuous', 'farvardinContinuous', 'ordibeheshtContinuous', 'term2Final'];

const MONTH_TITLE: Record<string, string> = {
  mehrContinuous: 'مهر',
  abanContinuous: 'آبان',
  azarContinuous: 'آذر',
  term1Continuous: 'نوبت اول',
  bahmanContinuous: 'بهمن',
  esfandContinuous: 'اسفند',
  farvardinContinuous: 'فروردین',
  ordibeheshtContinuous: 'اردیبهشت',
  term2Final: 'پایانی خرداد',
};

/** مدیریت ثبت نمره‌ی هر ماه: باز/بسته برای همه‌ی دروس یا فقط چند درس مشخص (ویژه معاون آموزش) */
export const GradePeriodsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { gradePeriods, academicSubjects, classes, students, academicGrades, setGradePeriodActive, setGradePeriodSubjectOpen } = useSchool();
  const [expanded, setExpanded] = useState<string | null>(null);

  const stats = useMemo(() => {
    const map = new Map(gradePeriods.map((p) => [p.code, periodUngradedStats(p, academicSubjects, classes, students, academicGrades)]));
    return map;
  }, [gradePeriods, academicSubjects, classes, students, academicGrades]);

  if (!isOpen) return null;

  const months = MONTH_CODES.map((c) => gradePeriods.find((p) => p.code === c)).filter((p): p is NonNullable<typeof p> => !!p);
  const openCount = months.filter((p) => p.isActive).length;
  const totalMissing = months.reduce((n, p) => n + (stats.get(p.code)?.missing || 0), 0);

  const card = (p: (typeof gradePeriods)[number]) => {
    const st = stats.get(p.code)!;
    const openSubjects = academicSubjects.filter((s) => isPeriodOpenForSubject(p, s.id));
    const partial = p.isActive && Array.isArray(p.openSubjectIds);
    const done = p.isActive && st.expected > 0 ? st.expected - st.missing : 0;
    const pct = st.expected > 0 ? Math.round((done / st.expected) * 100) : 0;
    const isExpanded = expanded === p.code;
    const title = MONTH_TITLE[p.code] || p.name;
    return (
      <div
        key={p.code}
        className={`rounded-3xl border backdrop-blur-xl shadow-sm transition ${
          p.isActive ? 'bg-emerald-50/70 border-emerald-200/90' : 'bg-white/60 border-white/80'
        }`}
      >
        <div className="p-4 flex items-center gap-3">
          <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${p.isActive ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
            {p.isActive ? <LockOpen className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-slate-900 truncate">{title}</div>
            <div className="text-[11px] mt-0.5 font-bold">
              {!p.isActive && <span className="text-slate-500">بسته — دبیران نمی‌توانند ثبت کنند</span>}
              {p.isActive && !partial && <span className="text-emerald-700">باز برای همه‌ی دروس</span>}
              {partial && <span className="text-teal-700">باز برای {toPersianDigits(openSubjects.length)} درس</span>}
            </div>
          </div>
          <label className="relative inline-flex shrink-0 cursor-pointer" aria-label={`باز یا بسته کردن ${title}`}>
            <input type="checkbox" checked={p.isActive && !partial} onChange={(e) => setGradePeriodActive(p.code, e.target.checked)} className="peer sr-only" />
            <span className="w-14 h-8 rounded-full bg-slate-200 peer-checked:bg-emerald-500 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-200" />
            <span className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white shadow transition-transform peer-checked:-translate-x-6" />
          </label>
        </div>

        {p.isActive && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1.5">
              <span>
                ثبت‌شده: <b className="text-emerald-700">{toPersianDigits(pct)}٪</b>
              </span>
              <span className={st.missing > 0 ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>
                {st.missing > 0 ? `${toPersianDigits(st.missing)} نمره ثبت‌نشده` : 'همه ثبت شده'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/80 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded(isExpanded ? null : p.code)}
          aria-expanded={isExpanded}
          className="w-full min-h-11 px-4 border-t border-white/70 flex items-center justify-between text-xs font-bold text-slate-600 cursor-pointer"
        >
          <span>انتخاب دروس این ماه</span>
          <ChevronDown className={`w-4 h-4 text-teal-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        <div className={`grid transition-[grid-template-rows] duration-300 ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="px-4 pb-4 pt-1 flex flex-wrap gap-2">
              {academicSubjects.length === 0 && <span className="text-xs text-slate-400">درسی تعریف نشده است.</span>}
              {academicSubjects.map((s) => {
                const on = isPeriodOpenForSubject(p, s.id);
                const miss = st.bySubject.get(s.id) || 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setGradePeriodSubjectOpen(p.code, s.id, !on)}
                    className={`min-h-10 px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition active:scale-95 ${
                      on ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'bg-white/80 border-slate-200 text-slate-600 hover:border-emerald-300'
                    }`}
                  >
                    {on ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 opacity-60" />}
                    {s.name}
                    {on && miss > 0 && <span className="px-1.5 rounded-full bg-white/90 text-amber-700 text-[10px] font-black">{toPersianDigits(miss)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
      <div className="relative w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] flex flex-col overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-sky-50">
        <div aria-hidden className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 rounded-full bg-emerald-300/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-10 w-64 h-64 rounded-full bg-sky-300/30 blur-3xl" />

        <div className="relative px-5 pt-5 pb-4 bg-white/60 backdrop-blur-xl border-b border-white/80 flex items-start gap-3 shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold text-slate-900">ثبت نمره‌ی ماهانه</h3>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              هر ماه را جداگانه باز یا بسته کنید؛ برای هر ماه می‌توانید فقط چند درس مشخص را باز کنید. آمار نمره‌ی ثبت‌نشده فقط برای دروسِ باز حساب می‌شود.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن" className="w-10 h-10 rounded-full hover:bg-white/80 text-slate-500 flex items-center justify-center cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative px-5 pt-4 grid grid-cols-2 gap-3 shrink-0">
          <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/80 px-4 py-3">
            <div className="text-[11px] text-slate-500 font-bold">بازه‌های باز</div>
            <div className="text-2xl font-black text-emerald-700 tabular-nums">{toPersianDigits(openCount)}<span className="text-xs text-slate-400 font-bold"> از {toPersianDigits(months.length)}</span></div>
          </div>
          <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/80 px-4 py-3">
            <div className="text-[11px] text-slate-500 font-bold">نمره‌ی ثبت‌نشده (دروس باز)</div>
            <div className={`text-2xl font-black tabular-nums ${totalMissing > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>{toPersianDigits(totalMissing)}</div>
          </div>
        </div>

        <div className="relative p-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{months.map(card)}</div>
        </div>

        <div className="relative px-5 py-4 bg-white/60 backdrop-blur-xl border-t border-white/80 shrink-0">
          <button type="button" onClick={onClose} className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold cursor-pointer">
            تأیید و بستن
          </button>
        </div>
      </div>
    </div>
  );
};
