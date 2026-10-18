import React, { useMemo, useState } from 'react';
import { BookOpen, Edit3 } from 'lucide-react';
import { StudentAcademicGrade } from '../types';
import { SCORE_COLUMNS, isFinalKey } from '../utils/examReport';
import { columnTone } from '../utils/gradeColumns';
import { scorePillClass, scoreLabel } from '../utils/gradePeriods';
import { buildMonthlyRows, monthlyGpa, ReportMonth } from '../utils/monthlyReport';
import { toPersianDigits } from '../utils/persianDate';
import { FitTable } from './ui/FitTable';

const fa = (n?: number) => (n === undefined ? '-' : toPersianDigits(String(n)));

interface Props {
  grades: StudentAcademicGrade[];
  onEdit?: () => void;
}

/**
 * کارنامه‌ی تفکیکی دروس؛ هم‌ساختار با «ثبت نمره» در پنل معاون آموزش:
 * مستمر مهر، آبان، آذر، پایانی اول، مستمر بهمن، اسفند، فروردین، اردیبهشت، پایانی دوم و «میانگین مستمر».
 * با انتخاب یک ستون، فقط نمره‌ی همان ستون نمایش داده می‌شود.
 */
export const StudentMonthlyGradesTable: React.FC<Props> = ({ grades, onEdit }) => {
  const [col, setCol] = useState<ReportMonth>('all');
  const rows = useMemo(() => buildMonthlyRows(grades, col), [grades, col]);
  const gpa = useMemo(() => monthlyGpa(grades, col), [grades, col]);
  const shown = col === 'all' ? SCORE_COLUMNS.map((m, i) => ({ ...m, i })) : SCORE_COLUMNS.map((m, i) => ({ ...m, i })).filter((m) => m.key === col);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-sm">کارنامه تفکیکی دروس</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium">
            {col === 'all' ? 'میانگین مستمر' : `معدل ${SCORE_COLUMNS.find((m) => m.key === col)?.monthName}`}: <b className={`font-mono px-2 py-0.5 rounded-lg ${scorePillClass(gpa)}`}>{fa(gpa)}</b>
          </span>
          {onEdit && (
            <button onClick={onEdit} className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer flex items-center gap-1">
              <Edit3 className="w-3.5 h-3.5" />
              <span>ثبت و ویرایش نمرات این کلاس</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="ستون نمره">
        <button type="button" role="tab" aria-selected={col === 'all'} onClick={() => setCol('all')} className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-xs font-extrabold cursor-pointer transition ${col === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>همه ستون‌ها</button>
        {SCORE_COLUMNS.map((m) => (
          <button key={m.key} type="button" role="tab" aria-selected={col === m.key} onClick={() => setCol(m.key)} className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-xs font-extrabold cursor-pointer transition ${col === m.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{isFinalKey(m.key) ? m.monthName : m.monthName}</button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">هنوز نمره‌ای برای این دانش‌آموز ثبت نشده است.</div>
      ) : (
        <FitTable className="border border-slate-200 rounded-xl shadow-2xs">
          <table className="w-full text-right text-xs whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-10 text-center">ردیف</th>
                <th className="p-2.5 min-w-[140px]">درس</th>
                {shown.map((m) => (
                  <th key={m.key} className={`p-2 text-center ${columnTone(m)} ${isFinalKey(m.key) ? 'font-black' : ''}`}>{m.monthName}</th>
                ))}
                {col === 'all' && <th className="p-2 text-center bg-indigo-50 text-indigo-900 font-black">میانگین مستمر</th>}
                <th className="p-2 text-center">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, idx) => (
                <tr key={r.subjectId} className="hover:bg-slate-50 transition">
                  <td className="p-2 text-center font-bold text-slate-400">{toPersianDigits(idx + 1)}</td>
                  <td className="p-2">
                    <div className="font-bold text-slate-900">{r.subjectName}</div>
                    {r.teacherName && <div className="text-[10px] text-slate-400">استاد: {r.teacherName}</div>}
                  </td>
                  {shown.map((m) => {
                    const v = r.months[m.i].score;
                    return (
                      <td key={m.key} className="p-1.5 text-center">
                        <span className={`inline-block min-w-[3rem] px-2 py-1 rounded-xl text-xs ${v !== undefined ? scorePillClass(v) : 'bg-slate-100/70 border border-slate-200/70 text-slate-400'}`}>{fa(v)}</span>
                      </td>
                    );
                  })}
                  {col === 'all' && <td className="p-1.5 text-center font-black text-indigo-900 bg-indigo-50/50">{fa(r.value)}</td>}
                  <td className="p-1.5 text-center">
                    {r.value !== undefined ? (
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] ${scorePillClass(r.value)}`}>{scoreLabel(r.value)}</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">ثبت نشده</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </FitTable>
      )}
    </div>
  );
};
