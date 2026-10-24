import React, { useMemo, useState } from 'react';
import { BookOpen, Edit3 } from 'lucide-react';
import { StudentAcademicGrade } from '../types';
import { SCORE_COLUMNS, isFinalKey } from '../utils/examReport';
import { columnTone } from '../utils/gradeColumns';
import { scorePillClass, scoreLabel } from '../utils/gradePeriods';
import { buildMonthlyRows, monthlyGpa, ReportMonth } from '../utils/monthlyReport';
import { toPersianDigits } from '../utils/persianDate';

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
        <div className="relative overflow-x-auto border border-slate-200 rounded-xl shadow-2xs bg-white" dir="rtl">
          <table className="yv-keep-table w-full min-w-max border-separate border-spacing-0 text-right text-xs whitespace-nowrap">
            <thead className="text-slate-700 font-bold">
              <tr>
                <th className="sticky right-0 z-10 bg-slate-50 border-l border-b border-slate-200 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] px-3 py-2 min-w-[8.5rem] whitespace-nowrap">درس</th>
                {shown.map((m) => (
                  <th key={m.key} className={`border-b border-slate-200 px-3 py-2 text-center whitespace-nowrap ${columnTone(m)} ${isFinalKey(m.key) ? 'font-black' : ''}`}>{m.monthName}</th>
                ))}
                {col === 'all' && <th className="border-b border-slate-200 px-3 py-2 text-center bg-indigo-50 text-indigo-900 font-black whitespace-nowrap">میانگین مستمر</th>}
                <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-center whitespace-nowrap">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.subjectId} className="group">
                  <td className="sticky right-0 z-10 bg-slate-50 border-l border-b border-slate-200 shadow-[-4px_0_10px_rgba(0,0,0,0.05)] px-3 py-1.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 w-4 text-center">{toPersianDigits(idx + 1)}</span>
                      <div>
                        <div className="font-bold text-slate-900 leading-5">{r.subjectName}</div>
                        {r.teacherName && <div className="text-[10px] text-slate-400 leading-4">استاد: {r.teacherName}</div>}
                      </div>
                    </div>
                  </td>
                  {shown.map((m) => {
                    const v = r.months[m.i].score;
                    return (
                      <td key={m.key} className="border-b border-slate-100 px-2 py-1.5 text-center whitespace-nowrap">
                        <span className={`inline-block min-w-[3rem] px-2 py-1 rounded-xl text-xs ${v !== undefined ? scorePillClass(v) : 'bg-slate-100/70 border border-slate-200/70 text-slate-400'}`}>{fa(v)}</span>
                      </td>
                    );
                  })}
                  {col === 'all' && <td className="border-b border-slate-100 px-3 py-1.5 text-center font-black text-indigo-900 bg-indigo-50/50 whitespace-nowrap">{fa(r.value)}</td>}
                  <td className="border-b border-slate-100 px-2 py-1.5 text-center whitespace-nowrap">
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
        </div>
      )}
    </div>
  );
};
