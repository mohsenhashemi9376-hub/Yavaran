import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSchool } from '../context/SchoolContext';
import { ComprehensiveExamRecord, SchoolClass, Student } from '../types';
import { analyzeClassExam, ExamMonth, examMonthLabel, examMonthsWithData, EXAM_MONTHS, round2, studentExamTimeline, faExamPct, examPercent } from '../utils/examReport';
import { SCORE_BAND_STYLE, scoreBand, scoreLabel } from '../utils/gradePeriods';
import { getCurrentAcademicYear, getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';

const fa = faExamPct;
const SUBJECT_COLORS = ['#4f46e5', '#d97706', '#7c3aed', '#0284c7', '#db2777'];

interface Props {
  record?: ComprehensiveExamRecord;
  classData: SchoolClass;
  classStudents: Student[];
  student: Student;
  initialMonth: ExamMonth;
  onClose: () => void;
}

/** کارنامه‌ی آزمون جامع یک دانش‌آموز + نمودار رشد ماهانه؛ قابل چاپ / ذخیره PDF */
export const StudentExamCardModal: React.FC<Props> = ({ record, classData, classStudents, student, initialMonth, onClose }) => {
  const { schoolSettings } = useSchool();
  const [month, setMonth] = useState<ExamMonth>(initialMonth);
  const analysis = useMemo(() => analyzeClassExam(record, classStudents, month), [record, classStudents, month]);
  const row = analysis.rows.find((r) => r.student.id === student.id);
  const timeline = useMemo(() => studentExamTimeline(record, classStudents, student.id), [record, classStudents, student.id]);
  const monthsWithData = examMonthsWithData(record);
  const schoolName = schoolSettings.schoolName || 'مجتمع تربیتی آموزشی یاوران ولایت';

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

  const chartData = timeline.map((p) => ({
    name: p.label,
    'میانگین دانش‌آموز': p.avg === undefined ? null : round2(examPercent(p.avg)),
    'میانگین کلاس': p.classAvg === undefined ? null : round2(examPercent(p.classAvg)),
    ...Object.fromEntries(analysis.subjects.map((s) => [s.label, p.bySubject[s.key] === undefined ? null : round2(examPercent(p.bySubject[s.key] as number))])),
  }));

  return createPortal(
    <div id="yv-print-root" className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-white w-full max-w-xl sm:rounded-3xl rounded-t-3xl shadow-2xl font-['Vazirmatn',sans-serif]">
          <div className="yv-no-print flex items-center justify-between gap-2 px-4 pt-4">
            <h3 className="text-base font-extrabold text-slate-900">کارنامه آزمون جامع</h3>
            <button type="button" onClick={onClose} aria-label="بستن" className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="yv-no-print px-4 pt-2">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value as ExamMonth)}
              aria-label="انتخاب ماه"
              className="w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer"
            >
              {EXAM_MONTHS.map((m) => <option key={m.key} value={m.key}>آزمون {m.monthName}</option>)}
              {monthsWithData.includes('legacy') && <option value="legacy">{examMonthLabel('legacy')}</option>}
              <option value="all">{examMonthLabel('all')}</option>
            </select>
          </div>

          <div className="p-4 space-y-4">
            <div className="text-center space-y-1 border-b border-slate-200 pb-3">
              <div className="text-sm font-extrabold text-slate-900">{schoolName}</div>
              <div className="text-xs font-bold text-emerald-700">
                کارنامه آزمون جامع • {examMonthLabel(month)} • سال تحصیلی {toPersianDigits(schoolSettings.academicYear || getCurrentAcademicYear())}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 px-3 py-2 col-span-3 sm:col-span-1"><span className="text-slate-500">دانش‌آموز: </span><b>{studentFullName(student)}</b></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">کلاس: </span><b>{classData.name}</b></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">رتبه: </span><b>{row?.rank ? `${toPersianDigits(row.rank)} از ${toPersianDigits(analysis.rows.filter((r) => r.avg !== undefined).length)}` : '—'}</b></div>
            </div>

            {row?.avg === undefined ? (
              <div className="py-8 text-center text-sm font-bold text-slate-400">نمرات آزمون جامع {examMonthLabel(month)} هنوز ثبت نشده است.</div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] text-slate-500">
                    <th className="px-3 py-2 text-right">درس</th>
                    <th className="px-3 py-2 text-center">نمره</th>
                    <th className="px-3 py-2 text-center">میانگین کلاس</th>
                    <th className="px-3 py-2 text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.subjects.map((s) => {
                    const v = row.scores[s.key];
                    const band = scoreBand(v);
                    return (
                      <tr key={s.key}>
                        <td className="px-3 py-2 font-bold text-slate-800">{s.label}</td>
                        <td className={`px-3 py-2 text-center font-extrabold ${band ? SCORE_BAND_STYLE[band].cell : 'text-slate-300'}`}>{v === undefined ? 'ثبت نشده' : fa(v)}</td>
                        <td className="px-3 py-2 text-center text-slate-500">{fa(analysis.subjectAverages[s.key])}</td>
                        <td className="px-3 py-2 text-center text-xs text-slate-500">{v === undefined ? '' : scoreLabel(v)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-extrabold">
                    <td className="px-3 py-2.5">معدل آزمون جامع</td>
                    <td className={`px-3 py-2.5 text-center ${SCORE_BAND_STYLE[scoreBand(row.avg) ?? 'good'].cell}`}>{fa(row.avg)}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{fa(analysis.classAverage)}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-slate-500">{scoreLabel(row.avg)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            <div>
              <div className="text-xs font-extrabold text-slate-700 mb-2">نمودار رشد در آزمون جامع (ماه به ماه)</div>
              {chartData.length < 1 ? (
                <div className="py-6 text-center text-xs text-slate-400">هنوز نمره‌ی ماهانه‌ای برای رسم نمودار ثبت نشده است.</div>
              ) : (
                <div className="h-60" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="میانگین دانش‌آموز" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} connectNulls isAnimationActive={false} />
                      <Line type="monotone" dataKey="میانگین کلاس" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
                      {analysis.subjects.map((s, i) => (
                        <Line key={s.key} type="monotone" dataKey={s.label} stroke={SUBJECT_COLORS[i % SUBJECT_COLORS.length]} strokeWidth={1.2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
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
