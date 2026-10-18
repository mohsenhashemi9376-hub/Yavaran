import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student } from '../types';
import { round2 } from '../utils/examReport';
import { SCORE_BAND_STYLE, scoreBand } from '../utils/gradePeriods';
import { buildStudentFullReport } from '../utils/studentFullReport';
import { getCurrentAcademicYear, getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';

const fa = (n?: number) => (n === undefined ? '—' : toPersianDigits(round2(n)));
const cell = (v?: number) => {
  const b = scoreBand(v);
  return b ? SCORE_BAND_STYLE[b].cell : 'text-slate-300';
};

interface Props {
  student: Student;
  classData: SchoolClass;
  onClose: () => void;
}

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({ label, value, tone = 'bg-slate-50 text-slate-900' }) => (
  <div className={`rounded-xl px-3 py-2 ${tone}`}>
    <div className="text-[10px] font-bold opacity-70">{label}</div>
    <div className="text-base font-black">{value}</div>
  </div>
);

/** کارنامه‌ی جامع دانش‌آموز: مستمر ماهانه، آزمون جامع، حضور، تکلیف، کاربرگ و انضباط در یک صفحه؛ قابل چاپ */
export const StudentFullReportModal: React.FC<Props> = ({ student, classData, onClose }) => {
  const { students, academicGrades, comprehensiveExams, sessions, morningDelays, morningAttendance, schoolAbsences, worksheets, worksheetWeeks, schoolSettings } = useSchool();
  const classStudents = useMemo(() => students.filter((s) => s.classId === classData.id), [students, classData.id]);
  const report = useMemo(
    () => buildStudentFullReport({
      student, classStudents, grades: academicGrades, exam: comprehensiveExams.find((r) => r.classId === classData.id),
      sessions, morningDelays, morningAttendance, schoolAbsences, worksheets, worksheetWeeks,
    }),
    [student, classStudents, academicGrades, comprehensiveExams, classData.id, sessions, morningDelays, morningAttendance, schoolAbsences, worksheets, worksheetWeeks]
  );
  const schoolName = schoolSettings.schoolName || 'مجتمع تربیتی آموزشی یاوران ولایت';
  const shownMonths = report.subjects[0]?.months.filter((_, idx) => report.subjects.some((s) => s.months[idx].score !== undefined)) ?? [];
  const monthIdx = shownMonths.map((m) => report.subjects[0].months.findIndex((x) => x.key === m.key));

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

  const trend = report.monthlyTrend.map((m) => ({
    name: m.label,
    'مستمر دانش‌آموز': m.student === undefined ? null : round2(m.student),
    'مستمر کلاس': m.classAvg === undefined ? null : round2(m.classAvg),
    'آزمون جامع': m.exam === undefined ? null : round2(m.exam),
  }));
  const h = report.homework;
  const w = report.worksheets;
  const a = report.attendance;

  return createPortal(
    <div id="yv-print-root" className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-white w-full max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl font-['Vazirmatn',sans-serif]">
          <div className="yv-no-print flex items-center justify-between gap-2 px-4 pt-4">
            <h3 className="text-base font-extrabold text-slate-900">کارنامه جامع دانش‌آموز</h3>
            <button type="button" onClick={onClose} aria-label="بستن" className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="text-center space-y-1 border-b border-slate-200 pb-3">
              <div className="text-sm font-extrabold text-slate-900">{schoolName}</div>
              <div className="text-xs font-bold text-emerald-700">کارنامه جامع • سال تحصیلی {toPersianDigits(schoolSettings.academicYear || getCurrentAcademicYear())}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">دانش‌آموز: </span><b>{studentFullName(student)}</b></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">کلاس: </span><b>{classData.name}</b></div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Stat label="میانگین مستمر" value={<span className={`px-1.5 rounded-md ${cell(report.continuousAvg)}`}>{fa(report.continuousAvg)}</span>} />
              <Stat label="معدل آزمون جامع" value={<span className={`px-1.5 rounded-md ${cell(report.exam.avg)}`}>{fa(report.exam.avg)}</span>} />
              <Stat label="رتبه در آزمون جامع" value={report.exam.rank ? `${toPersianDigits(report.exam.rank)} از ${toPersianDigits(report.exam.ranked)}` : '—'} />
            </div>

            <section>
              <div className="text-xs font-extrabold text-slate-700 mb-1.5">نمرات مستمر ماهانه</div>
              {report.subjects.length === 0 || shownMonths.length === 0 ? (
                <div className="py-5 text-center text-xs text-slate-400">نمره‌ی مستمری ثبت نشده است.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-2 py-2 text-right">درس</th>
                        {shownMonths.map((m) => <th key={m.key} className="px-2 py-2 text-center">{m.label}</th>)}
                        <th className="px-2 py-2 text-center">میانگین</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.subjects.map((s) => (
                        <tr key={s.subjectId}>
                          <td className="px-2 py-1.5 font-bold text-slate-800 whitespace-nowrap">{s.subjectName}</td>
                          {monthIdx.map((idx) => <td key={idx} className={`px-2 py-1.5 text-center font-bold ${cell(s.months[idx].score)}`}>{fa(s.months[idx].score)}</td>)}
                          <td className={`px-2 py-1.5 text-center font-extrabold ${cell(s.avg)}`}>{fa(s.avg)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <div className="text-xs font-extrabold text-slate-700 mb-1.5">روند ماهانه: مستمر و آزمون جامع</div>
              {trend.length === 0 ? (
                <div className="py-5 text-center text-xs text-slate-400">هنوز داده‌ای برای نمودار ثبت نشده است.</div>
              ) : (
                <div className="h-56" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="مستمر دانش‌آموز" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} connectNulls isAnimationActive={false} />
                      <Line type="monotone" dataKey="آزمون جامع" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                      <Line type="monotone" dataKey="مستمر کلاس" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="غیبت غیرموجه" value={toPersianDigits(a.unexcusedAbsences)} tone={a.unexcusedAbsences >= 3 ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-900'} />
              <Stat label="غیبت موجه" value={toPersianDigits(a.excusedAbsences)} />
              <Stat label="دفعات تأخیر" value={toPersianDigits(a.delayCount)} />
              <Stat label="دقایق تأخیر" value={toPersianDigits(a.delayMinutes)} />
              <Stat label="تکلیف انجام‌شده" value={toPersianDigits(h.done)} tone="bg-emerald-50 text-emerald-800" />
              <Stat label="تکلیف ناقص" value={toPersianDigits(h.incomplete)} tone="bg-amber-50 text-amber-800" />
              <Stat label="تکلیف انجام‌نشده" value={toPersianDigits(h.notDone)} tone="bg-rose-50 text-rose-800" />
              <Stat label="اخطار کلاسی" value={toPersianDigits(report.classWarnings)} />
              <Stat label="کاربرگ کامل" value={`${toPersianDigits(w.complete)} از ${toPersianDigits(w.weeks)}`} tone="bg-emerald-50 text-emerald-800" />
              <Stat label="کاربرگ ناقص" value={toPersianDigits(w.partial)} tone="bg-amber-50 text-amber-800" />
              <Stat label="کاربرگ تحویل‌نشده" value={toPersianDigits(w.missing)} tone="bg-rose-50 text-rose-800" />
              <Stat label="نمره انضباط" value={fa(report.disciplineScore)} />
            </section>
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
