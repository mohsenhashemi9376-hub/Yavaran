import React, { useMemo, useState } from 'react';
import { Award, FileText, Sigma, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { EXAM_WEAK_BELOW, bandCounts, round2, stdDev } from '../utils/examReport';
import { SCORE_BAND_STYLE, ScoreBand, scoreBand } from '../utils/gradePeriods';
import { toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { TERMS, TermKey, analyzeTerm, termTitle } from '../utils/termReport';
import { nextBand, ScoreColumnHeader } from './ScoreColumnHeader';
import { TermStudentCardModal } from './TermStudentCardModal';
import { Student } from '../types';

const fa = (n?: number) => (n === undefined ? '—' : toPersianDigits(round2(n)));
const cellClass = (v?: number) => {
  const b = scoreBand(v);
  return b ? SCORE_BAND_STYLE[b].cell : 'text-slate-300';
};

const WEIGHTS = [
  { v: 0.5, label: 'پایانی ۵۰٪ • مستمر ۵۰٪' },
  { v: 0.6, label: 'پایانی ۶۰٪ • مستمر ۴۰٪' },
  { v: 0.7, label: 'پایانی ۷۰٪ • مستمر ۳۰٪' },
  { v: 0.3, label: 'پایانی ۳۰٪ • مستمر ۷۰٪' },
  { v: 0, label: 'فقط مستمر' },
];

/**
 * گزارش جامع نمرات نیمسال (اول، دوم یا کل سال): تحلیل هر کلاس و درس، برترین‌ها و ضعیف‌ها، پراکندگی، روند نیمسال اول به دوم
 * و کارنامه‌ی جامع هر دانش‌آموز. نمره‌ی نیمسال = ترکیب میانگین مستمر ماه‌های همان نیمسال و نمره‌ی پایانی آن.
 */
export const TermComprehensiveReport: React.FC<{ onSelectStudent?: (s: Student) => void }> = ({ onSelectStudent }) => {
  const { classes, students, academicSubjects, academicGrades } = useSchool();
  const classList = classes.filter((c) => !c.isWorkshop);
  const [classId, setClassId] = useState(classList[0]?.id || '');
  const [term, setTerm] = useState<TermKey>(1);
  const [finalWeight, setFinalWeight] = useState(0.5);
  const [filters, setFilters] = useState<Record<string, ScoreBand>>({});
  const [cardStudent, setCardStudent] = useState<Student | null>(null);

  const cls = classList.find((c) => c.id === classId) ?? classList[0];
  const analysis = useMemo(
    () => (cls ? analyzeTerm({ cls, students, subjects: academicSubjects, grades: academicGrades, term, finalWeight }) : null),
    [cls, students, academicSubjects, academicGrades, term, finalWeight]
  );
  const overview = useMemo(
    () => classList.map((c) => ({ c, a: analyzeTerm({ cls: c, students, subjects: academicSubjects, grades: academicGrades, term, finalWeight }) })),
    [classList, students, academicSubjects, academicGrades, term, finalWeight]
  );

  const cycle = (col: string) =>
    setFilters((prev) => {
      const next = nextBand(prev[col]);
      const { [col]: _old, ...rest } = prev;
      return next ? { ...rest, [col]: next } : rest;
    });

  if (!cls || !analysis) return null;
  const visible = analysis.rows.filter((r) => Object.entries(filters).every(([col, band]) => scoreBand(col === 'avg' ? r.avg : r.bySubject[col]?.score) === band));
  const select = 'w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer';
  const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm';

  return (
    <section className={`${card} overflow-hidden`} dir="rtl" aria-label="گزارش جامع نمرات نیمسال">
      <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
        <div>
          <h2 className="text-base font-black text-slate-900">گزارش جامع نمرات نیمسال</h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-6">نیمسال اول: مستمر مهر، آبان، آذر + پایانی اول • نیمسال دوم: مستمر بهمن، اسفند، فروردین، اردیبهشت + پایانی دوم. نمره‌ی نیمسال از ترکیب میانگین مستمر و پایانی همان نیمسال حساب می‌شود.</p>
        </div>
        <div className="flex rounded-2xl bg-slate-100 p-1 gap-1" role="tablist" aria-label="نیمسال">
          {([1, 2, 'year'] as TermKey[]).map((t) => (
            <button key={String(t)} type="button" role="tab" aria-selected={term === t} onClick={() => { setTerm(t); setFilters({}); }} className={`flex-1 min-h-[44px] rounded-xl text-sm font-extrabold cursor-pointer transition ${term === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
              {termTitle(t)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block"><span className="block text-[11px] font-bold text-slate-500 mb-1">کلاس</span>
            <select value={cls.id} onChange={(e) => { setClassId(e.target.value); setFilters({}); }} className={select}>{classList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          <label className="block"><span className="block text-[11px] font-bold text-slate-500 mb-1">سهم پایانی در نمره‌ی نیمسال</span>
            <select value={finalWeight} onChange={(e) => setFinalWeight(Number(e.target.value))} className={select}>{WEIGHTS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}</select>
          </label>
        </div>
      </div>

      {!analysis.hasData ? (
        <div className="py-12 text-center text-sm font-bold text-slate-400">برای این کلاس در {termTitle(term)} هنوز نمره‌ای ثبت نشده است.</div>
      ) : (
        <div className="p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4 flex items-center gap-3"><Sigma className="w-6 h-6 text-slate-500 shrink-0" /><div><div className="text-xs font-bold text-slate-500">معدل کلاس</div><div className={`text-2xl font-black inline-block px-2 rounded-lg ${cellClass(analysis.classAvg)}`}>{fa(analysis.classAvg)}</div></div></div>
            <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-4 flex items-center gap-3"><Award className="w-6 h-6 text-emerald-600 shrink-0" /><div className="min-w-0"><div className="text-xs font-bold text-emerald-800">دانش‌آموز برتر</div><div className="text-sm font-black text-slate-900 truncate">{analysis.top.map((r) => studentFullName(r.student)).join('، ')}</div><div className="text-xs font-bold text-emerald-700">معدل {fa(analysis.top[0]?.avg)}</div></div></div>
            <div className="rounded-2xl bg-rose-50/70 border border-rose-100 p-4 flex items-center gap-3"><TriangleAlert className="w-6 h-6 text-rose-500 shrink-0" /><div><div className="text-xs font-bold text-rose-800">ضعیف (معدل زیر {toPersianDigits(EXAM_WEAK_BELOW)})</div><div className="text-2xl font-black text-slate-900">{toPersianDigits(analysis.weak.length)} <span className="text-xs font-bold text-slate-500">نفر</span></div></div></div>
          </div>

          {analysis.weak.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{analysis.weak.map((r) => <button key={r.student.id} type="button" onClick={() => setCardStudent(r.student)} className="px-3 min-h-[36px] rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer">{studentFullName(r.student)} • {fa(r.avg)}</button>)}</div>
          )}

          {term === 'year' && (analysis.improved.length > 0 || analysis.declined.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3"><div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 mb-1.5"><TrendingUp className="w-4 h-4" /> پیشرفت در نیمسال دوم</div>{analysis.improved.slice(0, 6).map((r) => <div key={r.student.id} className="text-[12px] text-slate-700 flex justify-between"><span>{studentFullName(r.student)}</span><b className="text-emerald-700">+{toPersianDigits(r.delta as number)}</b></div>)}{analysis.improved.length === 0 && <div className="text-xs text-slate-400">موردی نیست</div>}</div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3"><div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-800 mb-1.5"><TrendingDown className="w-4 h-4" /> افت در نیمسال دوم</div>{analysis.declined.slice(0, 6).map((r) => <div key={r.student.id} className="text-[12px] text-slate-700 flex justify-between"><span>{studentFullName(r.student)}</span><b className="text-rose-700">{toPersianDigits(r.delta as number)}</b></div>)}{analysis.declined.length === 0 && <div className="text-xs text-slate-400">موردی نیست</div>}</div>
            </div>
          )}

          {/* تحلیل دروس */}
          <div className="rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] text-slate-500">
                <tr><th className="px-3 py-2 text-right">درس</th><th className="px-2 py-2 text-center">میانگین مستمر</th><th className="px-2 py-2 text-center">میانگین پایانی</th><th className="px-2 py-2 text-center">نمره‌ی {termTitle(term)}</th><th className="px-2 py-2 text-center">پراکندگی</th><th className="px-2 py-2 text-center">ممتاز • متوسط • ضعیف</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.stats.map((st) => (
                  <tr key={st.subject.id}>
                    <td className="px-3 py-2 font-bold text-slate-800 whitespace-nowrap">{st.subject.name}</td>
                    <td className={`px-2 py-2 text-center font-bold ${cellClass(st.contAvg)}`}>{fa(st.contAvg)}</td>
                    <td className={`px-2 py-2 text-center font-bold ${cellClass(st.finalAvg)}`}>{fa(st.finalAvg)}</td>
                    <td className={`px-2 py-2 text-center font-extrabold ${cellClass(st.scoreAvg)}`}>{fa(st.scoreAvg)}</td>
                    <td className="px-2 py-2 text-center text-xs text-slate-600">{fa(st.sd)}</td>
                    <td className="px-2 py-2 text-center text-xs whitespace-nowrap"><span className="text-emerald-700 font-bold">{toPersianDigits(st.bands.excellent)}</span> • <span className="text-amber-700 font-bold">{toPersianDigits(st.bands.good)}</span> • <span className="text-rose-700 font-bold">{toPersianDigits(st.bands.weak)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* دانش‌آموزان */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
              <span className="text-slate-500 ml-1">برای فیلتر، روی عنوان ستون بزنید:</span>
              {(Object.keys(SCORE_BAND_STYLE) as ScoreBand[]).map((b) => <span key={b} className={`px-2.5 py-1 rounded-full border ${SCORE_BAND_STYLE[b].chip}`}>{SCORE_BAND_STYLE[b].label}</span>)}
              {Object.keys(filters).length > 0 && <button type="button" onClick={() => setFilters({})} className="px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 bg-white cursor-pointer">حذف فیلترها</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-right text-[11px] font-bold text-slate-500 sticky right-0 bg-white z-10 min-w-36">دانش‌آموز</th>
                    {analysis.subjects.map((s) => <ScoreColumnHeader key={s.id} title={s.name} band={filters[s.id]} onCycle={() => cycle(s.id)} />)}
                    <ScoreColumnHeader title="معدل" band={filters.avg} onCycle={() => cycle('avg')} />
                    <th className="px-2 py-2 text-center text-[11px] font-bold text-slate-500">رتبه</th>
                    {term === 'year' && <th className="px-2 py-2 text-center text-[11px] font-bold text-slate-500">تغییر</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((r) => (
                    <tr key={r.student.id}>
                      <td className="px-3 py-2 sticky right-0 bg-white z-10 whitespace-nowrap">
                        <button type="button" onClick={() => onSelectStudent?.(r.student)} className="font-bold text-slate-900 cursor-pointer">{studentFullName(r.student)}</button>
                        <button type="button" onClick={() => setCardStudent(r.student)} aria-label={`کارنامه جامع ${studentFullName(r.student)}`} title="کارنامه جامع نیمسال" className="mr-2 w-9 h-9 inline-flex items-center justify-center align-middle rounded-xl bg-slate-50 text-emerald-700 hover:bg-emerald-50 cursor-pointer"><FileText className="w-4 h-4" /></button>
                      </td>
                      {analysis.subjects.map((s) => <td key={s.id} className={`px-2 py-2 text-center font-bold ${cellClass(r.bySubject[s.id]?.score)}`}>{fa(r.bySubject[s.id]?.score)}</td>)}
                      <td className={`px-2 py-2 text-center font-extrabold ${cellClass(r.avg)}`}>{fa(r.avg)}</td>
                      <td className="px-2 py-2 text-center text-xs text-slate-500">{r.rank ? toPersianDigits(r.rank) : '—'}</td>
                      {term === 'year' && <td className={`px-2 py-2 text-center text-xs font-bold ${(r.delta ?? 0) > 0 ? 'text-emerald-700' : (r.delta ?? 0) < 0 ? 'text-rose-700' : 'text-slate-400'}`}>{r.delta === undefined ? '—' : `${r.delta > 0 ? '+' : ''}${toPersianDigits(r.delta)}`}</td>}
                    </tr>
                  ))}
                  {visible.length === 0 && <tr><td colSpan={analysis.subjects.length + 4} className="py-8 text-center text-xs text-slate-400">دانش‌آموزی با این فیلترها پیدا نشد.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-extrabold border-t-2 border-slate-200">
                    <td className="px-3 py-2.5 sticky right-0 bg-slate-50 z-10 text-xs text-slate-700">میانگین هر درس</td>
                    {analysis.stats.map((st) => <td key={st.subject.id} className={`px-2 py-2.5 text-center ${cellClass(st.scoreAvg)}`}>{fa(st.scoreAvg)}</td>)}
                    <td className={`px-2 py-2.5 text-center ${cellClass(analysis.classAvg)}`}>{fa(analysis.classAvg)}</td>
                    <td />{term === 'year' && <td />}
                  </tr>
                  <tr className="bg-white text-[11px] font-bold text-slate-600 border-t border-slate-100">
                    <td className="px-3 py-2 sticky right-0 bg-white z-10">پراکندگی</td>
                    {analysis.subjects.map((s) => <td key={s.id} className="px-2 py-2 text-center">{fa(stdDev(analysis.rows.map((r) => r.bySubject[s.id]?.score).filter((v): v is number => v !== undefined)))}</td>)}
                    <td className="px-2 py-2 text-center">{fa(stdDev(analysis.rows.map((r) => r.avg).filter((v): v is number => v !== undefined)))}</td>
                    <td />{term === 'year' && <td />}
                  </tr>
                  <tr className="bg-white text-[10px] font-bold text-slate-600 border-t border-slate-100">
                    <td className="px-3 py-2 sticky right-0 bg-white z-10">ممتاز • متوسط • ضعیف</td>
                    {[...analysis.subjects.map((s) => analysis.rows.map((r) => r.bySubject[s.id]?.score)), analysis.rows.map((r) => r.avg)].map((col, i) => {
                      const b = bandCounts(col.filter((v): v is number => v !== undefined));
                      return <td key={i} className="px-1 py-2 text-center whitespace-nowrap"><span className="text-emerald-700">{toPersianDigits(b.excellent)}</span> • <span className="text-amber-700">{toPersianDigits(b.good)}</span> • <span className="text-rose-700">{toPersianDigits(b.weak)}</span></td>;
                    })}
                    <td />{term === 'year' && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* مقایسه‌ی کلاس‌ها */}
      <div className="px-4 sm:px-5 pb-5">
        <h3 className="text-sm font-extrabold text-slate-800 mb-2">مقایسه‌ی کلاس‌ها • {termTitle(term)}</h3>
        <div className="rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-500"><tr><th className="px-3 py-2 text-right">کلاس</th><th className="px-2 py-2 text-center">معدل</th><th className="px-3 py-2 text-right">دانش‌آموز برتر</th><th className="px-2 py-2 text-center">ضعیف</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {overview.map(({ c, a }) => (
                <tr key={c.id} onClick={() => { setClassId(c.id); setFilters({}); }} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-3 py-2 font-bold text-slate-800 whitespace-nowrap">{c.name}</td>
                  <td className={`px-2 py-2 text-center font-extrabold ${cellClass(a.classAvg)}`}>{fa(a.classAvg)}</td>
                  <td data-no-student-link className="px-3 py-2 text-xs text-slate-700">{a.top.length ? a.top.map((r) => studentFullName(r.student)).join('، ') : '—'}</td>
                  <td className="px-2 py-2 text-center text-xs font-bold text-rose-700">{a.hasData ? toPersianDigits(a.weak.length) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cardStudent && <TermStudentCardModal student={cardStudent} classData={cls} analysis={analysis} term={term} onClose={() => setCardStudent(null)} />}
    </section>
  );
};
