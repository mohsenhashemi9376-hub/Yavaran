import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student } from '../types';
import { round2 } from '../utils/examReport';
import { SCORE_BAND_STYLE, scoreBand, scoreLabel } from '../utils/gradePeriods';
import { getCurrentAcademicYear, getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { TERMS, TermAnalysis, TermKey, termTitle } from '../utils/termReport';

const fa = (n?: number) => (n === undefined ? '—' : toPersianDigits(round2(n)));
const cell = (v?: number) => {
  const b = scoreBand(v);
  return b ? SCORE_BAND_STYLE[b].cell : 'text-slate-300';
};

interface Props {
  student: Student;
  classData: SchoolClass;
  analysis: TermAnalysis;
  term: TermKey;
  onClose: () => void;
}

/** کارنامه‌ی جامع نیمسال دانش‌آموز: مستمر ماه‌های نیمسال، پایانی، نمره‌ی نیمسال، مقایسه با میانگین کلاس، رتبه و نمودار؛ قابل چاپ */
export const TermStudentCardModal: React.FC<Props> = ({ student, classData, analysis, term, onClose }) => {
  const { academicGrades, schoolSettings } = useSchool();
  const row = analysis.rows.find((r) => r.student.id === student.id);
  const schoolName = schoolSettings.schoolName || 'مجتمع تربیتی آموزشی یاوران ولایت';
  const own = useMemo(() => academicGrades.filter((g) => g.studentId === student.id), [academicGrades, student.id]);

  // نمودار: مستمر هر ماه و پایانی نیمسال(ها) — نمره‌ی دانش‌آموز در برابر میانگین کلاس
  const columns = (term === 'year' ? [1, 2] as const : [term]).flatMap((t) => [...TERMS[t].months, TERMS[t].final]);
  const chart = columns.map((key) => {
    const mine = own.map((g) => g[key]).filter((v): v is number => typeof v === 'number');
    const classMates = analysis.rows.flatMap((r) => analysis.subjects.map((s) => academicGrades.find((g) => g.studentId === r.student.id && g.subjectId === s.id)?.[key])).filter((v): v is number => typeof v === 'number');
    const m = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const label = [...TERMS[1].months, ...TERMS[2].months, TERMS[1].final, TERMS[2].final].includes(key) ? key : key;
    return { key, name: key.replace('Continuous', ''), student: m(mine), classAvg: m(classMates), label };
  });
  const NAMES: Record<string, string> = { mehr: 'مهر', aban: 'آبان', azar: 'آذر', bahman: 'بهمن', esfand: 'اسفند', farvardin: 'فروردین', ordibehesht: 'اردیبهشت', term1Final: 'پایانی اول', term2Final: 'پایانی دوم' };
  const chartData = chart.map((c) => ({ name: NAMES[c.name] ?? c.name, 'نمره‌ی دانش‌آموز': c.student, 'میانگین کلاس': c.classAvg }));

  const handlePrint = () => {
    document.body.classList.add('yv-printing');
    const done = () => {
      document.body.classList.remove('yv-printing');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  };
  useEffect(() => () => document.body.classList.remove('yv-printing'), []);

  return createPortal(
    <div id="yv-print-root" className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-white w-full max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl font-['Vazirmatn',sans-serif]">
          <div className="yv-no-print flex items-center justify-between gap-2 px-4 pt-4">
            <h3 className="text-base font-extrabold text-slate-900">کارنامه جامع {termTitle(term)}</h3>
            <button type="button" onClick={onClose} aria-label="بستن" className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-4 space-y-4">
            <div className="text-center space-y-1 border-b border-slate-200 pb-3">
              <div className="text-sm font-extrabold text-slate-900">{schoolName}</div>
              <div className="text-xs font-bold text-emerald-700">کارنامه جامع {termTitle(term)} • سال تحصیلی {toPersianDigits(schoolSettings.academicYear || getCurrentAcademicYear())}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 px-3 py-2 col-span-2"><span className="text-slate-500">دانش‌آموز: </span><b>{studentFullName(student)}</b></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">کلاس: </span><b>{classData.name}</b></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">رتبه: </span><b>{row?.rank ? `${toPersianDigits(row.rank)} از ${toPersianDigits(analysis.rows.filter((r) => r.avg !== undefined).length)}` : '—'}</b></div>
            </div>

            {row?.avg === undefined ? (
              <div className="py-8 text-center text-sm font-bold text-slate-400">نمرات {termTitle(term)} هنوز ثبت نشده است.</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-slate-50 px-3 py-2"><div className="text-[11px] font-bold text-slate-500">معدل {termTitle(term)}</div><div className={`text-xl font-black inline-block px-1.5 rounded-lg ${cell(row.avg)}`}>{fa(row.avg)}</div></div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2"><div className="text-[11px] font-bold text-slate-500">میانگین کلاس</div><div className="text-xl font-black text-slate-700">{fa(analysis.classAvg)}</div></div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2"><div className="text-[11px] font-bold text-slate-500">{term === 'year' ? 'تغییر نیمسال دوم' : 'وضعیت'}</div><div className="text-base font-black text-slate-800">{term === 'year' ? (row.delta === undefined ? '—' : `${row.delta > 0 ? '+' : ''}${toPersianDigits(row.delta)}`) : scoreLabel(row.avg)}</div></div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-2 text-right">درس</th>
                        <th className="px-2 py-2 text-center">میانگین مستمر</th>
                        <th className="px-2 py-2 text-center">پایانی</th>
                        <th className="px-2 py-2 text-center">نمره‌ی {termTitle(term)}</th>
                        <th className="px-2 py-2 text-center">میانگین کلاس</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analysis.subjects.map((s) => {
                        const v = row.bySubject[s.id];
                        const stat = analysis.stats.find((x) => x.subject.id === s.id);
                        return (
                          <tr key={s.id}>
                            <td className="px-2 py-1.5 font-bold text-slate-800 whitespace-nowrap">{s.name}</td>
                            <td className={`px-2 py-1.5 text-center font-bold ${cell(v.cont)}`}>{fa(v.cont)}</td>
                            <td className={`px-2 py-1.5 text-center font-bold ${cell(v.final)}`}>{fa(v.final)}</td>
                            <td className={`px-2 py-1.5 text-center font-extrabold ${cell(v.score)}`}>{fa(v.score)}</td>
                            <td className="px-2 py-1.5 text-center text-slate-500">{fa(stat?.scoreAvg)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="text-xs font-extrabold text-slate-700 mb-2">روند نمرات ({termTitle(term)})</div>
                  <div className="h-56" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="نمره‌ی دانش‌آموز" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} connectNulls isAnimationActive={false} />
                        <Line type="monotone" dataKey="میانگین کلاس" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
            <div className="text-[10px] text-slate-400 text-center">تاریخ صدور: {toPersianDigits(getTodayShamsi().formattedDate)}</div>
          </div>

          <div className="yv-no-print sticky bottom-0 bg-white/95 backdrop-blur px-4 py-3 rounded-b-3xl border-t border-slate-100" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={handlePrint} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-2xl shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer">
              <Printer className="w-5 h-5" />
              <span>چاپ / ذخیره PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
