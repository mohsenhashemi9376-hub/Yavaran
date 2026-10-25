import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { AcademicSubject, MONTHLY_EVALUATION_PERIODS, MonthlyContinuousKey, SchoolClass, Student } from '../types';
import { scoreLabel } from '../utils/gradePeriods';
import { getCurrentAcademicYear, getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';

const PERIODS = MONTHLY_EVALUATION_PERIODS;
const titleOf = (key: MonthlyContinuousKey) => PERIODS.find((p) => p.key === key)?.label ?? key;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** بج وضعیت: عالی/خوب سبز، متوسط کهربایی، نیازمند تلاش قرمز، ثبت‌نشده خاکستری خط‌چین */
const statusBadge = (score?: number) => {
  if (score === undefined) return 'border border-dashed border-slate-300 text-slate-400';
  const label = scoreLabel(score);
  if (label === 'عالی' || label === 'خوب') return 'bg-emerald-50 text-emerald-700';
  if (label === 'متوسط') return 'bg-amber-50 text-amber-700';
  return 'bg-rose-50 text-rose-700';
};

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
        <div className="bg-white w-full max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl font-['Vazirmatn',sans-serif]">
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
              <div className="text-xs font-bold text-emerald-700">کارنامه {titleOf(period)} • سال تحصیلی <bdi dir="ltr">{toPersianDigits(schoolSettings.academicYear || getCurrentAcademicYear())}</bdi></div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2 text-xs">
              <div className="min-w-0 truncate px-2 py-1.5"><span className="text-slate-500">دانش‌آموز: </span><b className="text-slate-900">{studentFullName(student)}</b></div>
              <div className="min-w-0 truncate px-2 py-1.5"><span className="text-slate-500">کلاس: </span><b className="text-slate-900">{classData.name}</b></div>
            </div>

            {graded.length === 0 ? (
              <div className="py-10 text-center text-sm font-bold text-slate-400">نمرات {titleOf(period)} هنوز ثبت نشده است.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full table-fixed text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] text-slate-500">
                      <th className="px-3 py-2 text-right">درس</th>
                      <th className="w-16 px-2 py-2 text-center">نمره</th>
                      <th className="w-24 px-2 py-2 text-center">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(({ sub, score }) => (
                      <tr key={sub.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-bold text-slate-800 break-words">{sub.name}</td>
                        <td className={`px-2 py-2.5 text-center font-extrabold ${score === undefined ? 'text-slate-300' : 'text-slate-900'}`}>
                          {score === undefined ? '—' : toPersianDigits(score)}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold ${statusBadge(score)}`}>
                            {score === undefined ? 'ثبت نشده' : scoreLabel(score)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-black">
                      <td className="px-3 py-3 text-slate-900">میانگین کل</td>
                      <td className="px-2 py-3 text-center text-slate-900">{avg === undefined ? '—' : toPersianDigits(avg)}</td>
                      <td className="px-2 py-3 text-center">
                        {avg !== undefined && <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold ${statusBadge(avg)}`}>{scoreLabel(avg)}</span>}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="text-[10px] text-slate-400 text-center">تاریخ صدور: {toPersianDigits(getTodayShamsi().formattedDate)}</div>
          </div>

          {graded.length > 0 && (
            <div className="yv-no-print sticky bottom-0 bg-white/95 backdrop-blur px-4 py-3 rounded-b-3xl border-t border-slate-100" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={handlePrint}
                className="w-full h-12 bg-[#00875A] hover:bg-[#007650] text-white font-extrabold text-base rounded-2xl shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🖨️ چاپ / ذخیره PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
