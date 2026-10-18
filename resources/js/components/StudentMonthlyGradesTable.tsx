import React, { useMemo, useState } from 'react';
import { BookOpen, Edit3 } from 'lucide-react';
import { StudentAcademicGrade } from '../types';
import { CONTINUOUS_MONTHS } from '../utils/examReport';
import { SCORE_BAND_STYLE, scoreBand } from '../utils/gradePeriods';
import { buildMonthlyRows, monthlyGpa, ReportMonth } from '../utils/monthlyReport';
import { toPersianDigits } from '../utils/persianDate';
import { FitTable } from './ui/FitTable';

const fa = (n?: number) => (n === undefined ? '-' : toPersianDigits(String(n)));
const cell = (v?: number) => {
  const b = scoreBand(v);
  return b ? SCORE_BAND_STYLE[b].cell : 'text-slate-300';
};

interface Props {
  grades: StudentAcademicGrade[];
  onEdit?: () => void;
}

/** کارنامه‌ی تفکیکی دروس بر اساس نمره‌ی هر ماه؛ با انتخاب یک ماه، نمره‌ی همان ماه (جدا از بقیه) نمایش داده می‌شود */
export const StudentMonthlyGradesTable: React.FC<Props> = ({ grades, onEdit }) => {
  const [month, setMonth] = useState<ReportMonth>('all');
  const rows = useMemo(() => buildMonthlyRows(grades, month), [grades, month]);
  const gpa = useMemo(() => monthlyGpa(grades, month), [grades, month]);
  // ماه‌هایی که برای دست‌کم یک درس نمره دارند
  const filled = useMemo(() => CONTINUOUS_MONTHS.map((m, i) => ({ ...m, i })).filter((m) => rows.some((r) => r.months[m.i].score !== undefined)), [rows]);
  const shown = month === 'all' ? filled : filled.filter((m) => m.key === month);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-sm">کارنامه تفکیکی دروس (نمره‌ی هر ماه)</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium">
            {month === 'all' ? 'میانگین کل ماه‌ها' : `معدل ${CONTINUOUS_MONTHS.find((m) => m.key === month)?.monthName}`}: <b className={`font-mono px-1.5 rounded-md ${cell(gpa)}`}>{fa(gpa)}</b>
          </span>
          {onEdit && (
            <button onClick={onEdit} className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer flex items-center gap-1">
              <Edit3 className="w-3.5 h-3.5" />
              <span>ثبت و ویرایش نمرات این کلاس</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="ماه">
        <button type="button" role="tab" aria-selected={month === 'all'} onClick={() => setMonth('all')} className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-xs font-extrabold cursor-pointer transition ${month === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>همه ماه‌ها</button>
        {CONTINUOUS_MONTHS.map((m) => (
          <button key={m.key} type="button" role="tab" aria-selected={month === m.key} onClick={() => setMonth(m.key)} className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-xs font-extrabold cursor-pointer transition ${month === m.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{m.monthName}</button>
        ))}
      </div>

      {rows.length === 0 || (month !== 'all' && rows.every((r) => r.value === undefined)) ? (
        <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
          {rows.length === 0 ? 'هنوز نمره‌ای برای این دانش‌آموز ثبت نشده است.' : 'نمرات این ماه هنوز ثبت نشده است.'}
        </div>
      ) : (
        <FitTable className="border border-slate-200 rounded-xl shadow-2xs">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] sm:text-xs">
              <tr>
                <th className="p-3 w-10 text-center">ردیف</th>
                <th className="p-3 font-bold min-w-[140px]">عنوان درس</th>
                {shown.map((m) => <th key={m.key} className="p-2.5 text-center min-w-[64px]">{m.monthName}</th>)}
                {month === 'all' && <th className="p-2.5 text-center bg-indigo-50 text-indigo-950 min-w-[80px]">میانگین</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, idx) => (
                <tr key={r.subjectId} className="hover:bg-slate-50 transition">
                  <td className="p-3 text-center text-slate-400 font-bold">{toPersianDigits(idx + 1)}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{r.subjectName}</div>
                    {r.teacherName && <div className="text-[10px] text-slate-400">استاد: {r.teacherName}</div>}
                  </td>
                  {shown.map((m) => <td key={m.key} className={`p-2.5 text-center font-bold font-mono ${cell(r.months[m.i].score)}`}>{fa(r.months[m.i].score)}</td>)}
                  {month === 'all' && <td className={`p-2.5 text-center font-black font-mono ${cell(r.value)}`}>{fa(r.value)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </FitTable>
      )}
    </div>
  );
};
