import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ArrowDown, ArrowUp, ChevronLeft, FileSpreadsheet, Info, Minus, ShieldCheck, Sparkles } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import type { Student } from '../types';
import type { ProfileTab } from './StudentProfileModal';
import { getShamsiWeekRange, getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import {
  RISK_CONFIG,
  RISK_LEVEL_CLASS,
  RISK_LEVEL_LABELS,
  RISK_SIGNAL_LABELS,
  RiskLevel,
  RiskSignalKey,
  RiskStudent,
  RiskTrend,
  computeAtRisk,
} from '../utils/riskScore';

/** هر رنگ نشانه‌ها را از هم جدا می‌کند تا در یک نگاه الگوی ترکیب دیده شود */
const SIGNAL_CLASS: Record<RiskSignalKey, string> = {
  absence: 'bg-rose-50 text-rose-800 border-rose-200',
  delay: 'bg-amber-50 text-amber-800 border-amber-200',
  grades: 'bg-violet-50 text-violet-800 border-violet-200',
  parent: 'bg-teal-50 text-teal-800 border-teal-200',
  worksheet: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  discipline: 'bg-purple-50 text-purple-800 border-purple-200',
};

const TREND_LABEL: Record<RiskTrend, string> = { new: 'جدید این هفته', up: 'بدتر شده', down: 'بهتر شده', same: 'بدون تغییر' };

const TrendBadge: React.FC<{ r: RiskStudent }> = ({ r }) => {
  const base = 'inline-flex items-center gap-1 text-[11px] font-bold whitespace-nowrap';
  if (r.trend === 'new') return <span className={`${base} text-rose-700`}><Sparkles className="w-3.5 h-3.5" />{TREND_LABEL.new}</span>;
  if (r.trend === 'up') return <span className={`${base} text-rose-700`}><ArrowUp className="w-3.5 h-3.5" />{TREND_LABEL.up} ({toPersianDigits(r.previousScore)} ← {toPersianDigits(r.score)})</span>;
  if (r.trend === 'down') return <span className={`${base} text-emerald-700`}><ArrowDown className="w-3.5 h-3.5" />{TREND_LABEL.down} ({toPersianDigits(r.previousScore)} ← {toPersianDigits(r.score)})</span>;
  return <span className={`${base} text-slate-500`}><Minus className="w-3.5 h-3.5" />{TREND_LABEL.same}</span>;
};

interface Props {
  onSelectStudent?: (student: Student, tab?: ProfileTab) => void;
}

/** فهرست زندهٔ دانش‌آموزان در خطر (مشترک بین صفحهٔ فهرست و شمارندهٔ منو) */
export function useAtRisk() {
  const { students, classes, sessions, morningAttendance, morningDelays, schoolAbsences, academicGrades, gradePeriods, parentMeetings, worksheets, worksheetWeeks, schoolHolidays } = useSchool();
  return useMemo(
    () =>
      computeAtRisk({
        students,
        classes,
        sessions,
        morningAttendance: morningAttendance || [],
        morningDelays: morningDelays || [],
        schoolAbsences: schoolAbsences || [],
        academicGrades,
        gradePeriods,
        parentMeetings: parentMeetings || [],
        worksheets: worksheets || [],
        worksheetWeeks: worksheetWeeks || [],
        holidays: schoolHolidays || [],
      }),
    [students, classes, sessions, morningAttendance, morningDelays, schoolAbsences, academicGrades, gradePeriods, parentMeetings, worksheets, worksheetWeeks, schoolHolidays]
  );
}

/** فهرست هفتگی «دانش‌آموز در خطر» برای معاون تربیتی: ترکیب هم‌زمان غیبت، تأخیر، افت نمره، غیبت ولی، کاربرگ و انضباط */
export const AtRiskWorkspace: React.FC<Props> = ({ onSelectStudent }) => {
  const { students, classes } = useSchool();
  const list = useAtRisk();
  const [level, setLevel] = useState<RiskLevel | 'all'>('all');
  const [classId, setClassId] = useState('all');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const week = getShamsiWeekRange(getTodayShamsi().formattedDate);
  const counts = {
    high: list.filter((r) => r.level === 'high').length,
    medium: list.filter((r) => r.level === 'medium').length,
    watch: list.filter((r) => r.level === 'watch').length,
    fresh: list.filter((r) => r.trend === 'new').length,
    worse: list.filter((r) => r.trend === 'up').length,
  };

  const shown = list.filter(
    (r) => (level === 'all' || r.level === level) && (classId === 'all' || r.student.classId === classId) && (!onlyChanged || r.trend === 'new' || r.trend === 'up')
  );

  const exportExcel = () => {
    const rows = shown.map((r, i) => ({
      ردیف: i + 1,
      'نام و نام خانوادگی': studentFullName(r.student),
      کلاس: r.className,
      امتیاز: r.score,
      وضعیت: RISK_LEVEL_LABELS[r.level],
      'روند نسبت به هفته‌ی قبل': TREND_LABEL[r.trend],
      نشانه‌ها: r.signals.map((s) => s.label).join(' | '),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ rightToLeft: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'دانش‌آموزان در خطر');
    XLSX.writeFile(wb, `دانش‌آموزان_در_خطر_${getTodayShamsi().formattedDate.replace(/\//g, '-')}.xlsx`);
  };

  const classOptions = classes.filter((c) => students.some((s) => s.classId === c.id));
  const selectCls = 'min-h-[40px] px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700';
  const chip = (on: boolean) => `min-h-[36px] px-3 rounded-full border text-[11px] font-bold cursor-pointer transition ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`;

  return (
    <div className="space-y-5" id="at-risk-workspace">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">دانش‌آموزان در خطر؛ فهرست هفتگی</h2>
              <p className="text-xs text-slate-500 mt-0.5">هفتهٔ {week.title} • فقط دانش‌آموزانی که چند نشانه با هم دارند یا یک نشانهٔ شدید</p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportExcel}
            disabled={shown.length === 0}
            className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی اکسل</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'خطر بالا', n: counts.high, cls: 'bg-rose-50 border-rose-200 text-rose-800' },
            { label: 'خطر متوسط', n: counts.medium, cls: 'bg-amber-50 border-amber-200 text-amber-800' },
            { label: 'جدید این هفته', n: counts.fresh, cls: 'bg-slate-50 border-slate-200 text-slate-800' },
            { label: 'بدتر شده', n: counts.worse, cls: 'bg-slate-50 border-slate-200 text-slate-800' },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl border px-3 py-2.5 ${c.cls}`}>
              <div className="text-2xl font-black font-mono">{toPersianDigits(c.n)}</div>
              <div className="text-[11px] font-bold opacity-80">{c.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setLevel('all')} className={chip(level === 'all')}>همه ({toPersianDigits(list.length)})</button>
          {(['high', 'medium', 'watch'] as RiskLevel[]).map((l) => (
            <button key={l} type="button" onClick={() => setLevel(l)} className={chip(level === l)}>
              {RISK_LEVEL_LABELS[l]} ({toPersianDigits(counts[l])})
            </button>
          ))}
          <button type="button" onClick={() => setOnlyChanged((v) => !v)} className={chip(onlyChanged)} aria-pressed={onlyChanged}>فقط جدید یا بدتر شده</button>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`${selectCls} mr-auto`} aria-label="فیلتر کلاس">
            <option value="all">همهٔ کلاس‌ها</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-10 text-center text-sm font-bold text-emerald-800">
          {list.length === 0 ? 'این هفته دانش‌آموزی با نشانه‌های هم‌زمان پیدا نشد.' : 'با فیلتر فعلی موردی وجود ندارد.'}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((r) => (
            <li key={r.student.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex items-center gap-3 lg:w-72 shrink-0">
                <div className={`w-12 h-12 rounded-2xl border flex flex-col items-center justify-center shrink-0 ${RISK_LEVEL_CLASS[r.level]}`} title={`امتیاز ${r.score} از ۱۰۰`}>
                  <span className="text-lg font-black font-mono leading-none">{toPersianDigits(r.score)}</span>
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900 text-sm truncate">{studentFullName(r.student)}</div>
                  <div className="text-[11px] text-slate-500 truncate">{r.className}</div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${RISK_LEVEL_CLASS[r.level]}`}>{RISK_LEVEL_LABELS[r.level]}</span>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {r.signals.map((s) => (
                    <span key={s.key} className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${SIGNAL_CLASS[s.key]}`} title={`${RISK_SIGNAL_LABELS[s.key]}: ${toPersianDigits(s.points)} امتیاز`}>
                      {s.label}
                    </span>
                  ))}
                </div>
                <TrendBadge r={r} />
              </div>

              {onSelectStudent && (
                <button
                  type="button"
                  onClick={() => onSelectStudent(r.student, 'timeline')}
                  className="shrink-0 min-h-[40px] px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <span>خط زمانی و اقدام</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <button type="button" onClick={() => setShowRules((v) => !v)} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer" aria-expanded={showRules}>
          <Info className="w-4 h-4 text-slate-400" />
          <span>امتیاز چطور حساب می‌شود؟</span>
        </button>
        {showRules && (
          <div className="mt-3 text-[11px] text-slate-600 leading-7 space-y-1">
            <p>بازهٔ بررسی غیبت، تأخیر و انضباط {toPersianDigits(RISK_CONFIG.windowDays)} روز اخیر است. هر نشانه امتیاز و سقف خودش را دارد:</p>
            <ul className="list-disc pr-5">
              <li>غیبت (سقف {toPersianDigits(RISK_CONFIG.caps.absence)}): دست‌کم ۳ غیبت غیرموجه یا ۳ روز متوالی.</li>
              <li>تأخیر (سقف {toPersianDigits(RISK_CONFIG.caps.delay)}): دست‌کم ۳ روز تأخیر.</li>
              <li>افت نمره (سقف {toPersianDigits(RISK_CONFIG.caps.grades)}): افت میانگین بیش از ۲ نمره نسبت به بازهٔ قبلی.</li>
              <li>غیبت ولی (سقف {toPersianDigits(RISK_CONFIG.caps.parent)}): هیچ‌یک از والدین در آخرین جلسه یا در دو جلسه نیامده‌اند.</li>
              <li>کاربرگ (سقف {toPersianDigits(RISK_CONFIG.caps.worksheet)}): دو هفتهٔ پیاپی ناقص یا تحویل‌نشده.</li>
              <li>انضباط (سقف {toPersianDigits(RISK_CONFIG.caps.discipline)}): دست‌کم ۲ مورد ثبت‌شده.</li>
            </ul>
            <p>جمع امتیازها با دو نشانه ×۱٫۲۵ و با سه نشانه یا بیشتر ×۱٫۵ می‌شود (حداکثر ۱۰۰). از {toPersianDigits(RISK_CONFIG.levels.high)} «خطر بالا»، از {toPersianDigits(RISK_CONFIG.levels.medium)} «خطر متوسط» و از {toPersianDigits(RISK_CONFIG.levels.watch)} «نیازمند توجه».</p>
            <p>برای ورود به فهرست باید دو نشانهٔ هم‌زمان باشد یا یک نشانهٔ شدید (مثل ۶ غیبت غیرموجه، ۵ روز غیبت متوالی یا افت ۴ نمره‌ای). روند با مقایسهٔ امتیاز امروز و یک هفته‌ی پیش محاسبه می‌شود.</p>
          </div>
        )}
      </div>
    </div>
  );
};
