import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { AcademicSubject, MONTHLY_EVALUATION_PERIODS, MonthlyContinuousKey, SchoolClass, Student } from '../types';
import { SCORE_BAND_STYLE, scoreBand, scoreLabel } from '../utils/gradePeriods';
import { getCurrentAcademicYear, getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';

const PERIODS = MONTHLY_EVALUATION_PERIODS;
const titleOf = (key: MonthlyContinuousKey) => PERIODS.find((p) => p.key === key)?.label ?? key;
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Props {
  student: Student;
  classData: SchoolClass;
  subjects: AcademicSubject[];
  initialPeriod: MonthlyContinuousKey;
  onClose: () => void;
}

/** کارنامه‌ی شخصی یک دانش‌آموز در یک ماه؛ قابل چاپ و ذخیره به‌صورت PDF */
export const StudentReportCardModal: React.FC<Props> = ({ student, classData, subjects, initialPeriod, onClose }) => {
  const { academicGrades, schoolSettings } = useSchool();
  const [period, setPeriod] = useState<MonthlyContinuousKey>(initialPeriod);

  const rows = subjects.map((sub) => {
    const v = academicGrades.find((g) => g.studentId === student.id && g.subjectId === sub.id)?.[period];
    return { sub, score: typeof v === 'number' && !Number.isNaN(v) ? v : undefined };
  });
  const graded = rows.filter((r) => r.score !== undefined);
  const avg = graded.length ? round2(graded.reduce((a, r) => a + (r.score as number), 0) / graded.length) : undefined;
  const schoolName = schoolSettings.schoolName || 'مجتمع تربیتی آموزشی یاوران ولایت';

  // چاپ فقط خود کارنامه: بقیه‌ی صفحه با کلاس موقت روی body پنهان می‌شود
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
        <div className="bg-white w-full max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl font-['Vazirmatn',sans-serif]">
          <div className="yv-no-print flex items-center justify-between gap-2 px-4 pt-4">
            <h3 className="text-base font-extrabold text-slate-900">کارنامه شخصی</h3>
            <button type="button" onClick={onClose} aria-label="بستن" className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="yv-no-print px-4 pt-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as MonthlyContinuousKey)}
              aria-label="انتخاب ماه"
              className="w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer"
            >
              {PERIODS.map((p) => <option key={p.key} value={p.key}>{titleOf(p.key)}</option>)}
            </select>
          </div>

          <div id="yv-report-sheet" className="p-4 space-y-4">
            <div className="text-center space-y-1 border-b border-slate-200 pb-3">
              <div className="text-sm font-extrabold text-slate-900">{schoolName}</div>
              <div className="text-xs font-bold text-emerald-700">کارنامه {titleOf(period)} • سال تحصیلی {toPersianDigits(schoolSettings.academicYear || getCurrentAcademicYear())}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">دانش‌آموز: </span><b className="text-slate-900">{studentFullName(student)}</b></div>
              <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">کلاس: </span><b className="text-slate-900">{classData.name}</b></div>
            </div>

            {graded.length === 0 ? (
              <div className="py-10 text-center text-sm font-bold text-slate-400">نمرات {titleOf(period)} هنوز ثبت نشده است.</div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] text-slate-500">
                    <th className="px-3 py-2 text-right">درس</th>
                    <th className="px-3 py-2 text-center">نمره</th>
                    <th className="px-3 py-2 text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ sub, score }) => {
                    const band = scoreBand(score);
                    return (
                      <tr key={sub.id}>
                        <td className="px-3 py-2 font-bold text-slate-800">{sub.name}</td>
                        <td className={`px-3 py-2 text-center font-extrabold ${band ? SCORE_BAND_STYLE[band].cell : 'text-slate-300'}`}>
                          {score === undefined ? 'ثبت نشده' : toPersianDigits(score)}
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-slate-500">{score === undefined ? '' : scoreLabel(score)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-extrabold">
                    <td className="px-3 py-2.5">میانگین</td>
                    <td className={`px-3 py-2.5 text-center ${SCORE_BAND_STYLE[scoreBand(avg) ?? 'good'].cell}`}>{toPersianDigits(avg ?? 0)}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-slate-500">{avg !== undefined ? scoreLabel(avg) : ''}</td>
                  </tr>
                </tfoot>
              </table>
            )}
            <div className="text-[10px] text-slate-400 text-center">تاریخ صدور: {toPersianDigits(getTodayShamsi().formattedDate)}</div>
          </div>

          {graded.length > 0 && (
            <div className="yv-no-print sticky bottom-0 bg-white/95 backdrop-blur px-4 py-3 rounded-b-3xl border-t border-slate-100" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={handlePrint}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-2xl shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>چاپ / ذخیره PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
