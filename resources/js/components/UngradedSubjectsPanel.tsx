import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardX } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { MonthlyContinuousKey } from '../types';
import { subjectAppliesToClass } from '../utils/courseAssignments';
import { SCORE_COLUMNS } from '../utils/examReport';
import { buildGradePeriodList } from '../utils/gradePeriods';
import { toPersianDigits } from '../utils/persianDate';

interface Props {
  /** باز کردن دفتر نمره‌ی همان کلاس و درس */
  onPick: (classId: string, subjectId: string) => void;
}

/** دروسی که نمره‌ی ماه انتخابی برایشان کامل ثبت نشده است، به تفکیک کلاس و دبیر */
export const UngradedSubjectsPanel: React.FC<Props> = ({ onPick }) => {
  const { classes, students, academicSubjects, academicGrades, gradePeriods, courseAssignments, allTeachers } = useSchool();
  const periods = useMemo(() => buildGradePeriodList(gradePeriods), [gradePeriods]);
  const [period, setPeriod] = useState<MonthlyContinuousKey>(
    () => (SCORE_COLUMNS.find((m) => periods.find((p) => p.code === m.key)?.isActive)?.key ?? 'mehrContinuous')
  );
  const isActive = Boolean(periods.find((p) => p.code === period)?.isActive);

  const { missingRows, completeCount } = useMemo(() => {
    const rows: {
      subjectId: string;
      subjectName: string;
      items: { classId: string; className: string; expected: number; recorded: number; teacher?: string }[];
    }[] = [];
    let complete = 0;
    academicSubjects.forEach((sub) => {
      const items = classes
        .filter((c) => !c.isWorkshop && subjectAppliesToClass(sub, c))
        .map((c) => {
          const ids = students.filter((s) => s.classId === c.id).map((s) => s.id);
          const idSet = new Set(ids);
          const recorded = academicGrades.filter((g) => g.subjectId === sub.id && idSet.has(g.studentId) && typeof g[period] === 'number' && !Number.isNaN(g[period] as number)).length;
          const teacherId = courseAssignments.find((a) => a.classId === c.id && a.subjectId === sub.id)?.teacherId;
          return { classId: c.id, className: c.name, expected: ids.length, recorded, teacher: allTeachers.find((t) => t.id === teacherId)?.name };
        })
        .filter((i) => i.expected > 0);
      const missing = items.filter((i) => i.recorded < i.expected);
      complete += items.length - missing.length;
      if (missing.length) rows.push({ subjectId: sub.id, subjectName: sub.name, items: missing });
    });
    return { missingRows: rows, completeCount: complete };
  }, [classes, students, academicSubjects, academicGrades, courseAssignments, allTeachers, period]);

  const totalMissingClasses = missingRows.reduce((n, r) => n + r.items.length, 0);

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" dir="rtl" aria-label="دروس بدون نمره">
      <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><ClipboardX className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-slate-900">دروسی که نمره‌شان ثبت نشده</h2>
            <p className="text-xs text-slate-500 mt-0.5">برای هر ماه، درس‌ها و کلاس‌هایی که نمره‌ی همه‌ی دانش‌آموزانشان ثبت نشده است. با زدن هر مورد، دفتر نمره‌ی همان کلاس و درس باز می‌شود.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as MonthlyContinuousKey)}
            aria-label="انتخاب ماه"
            className="h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer"
          >
            {SCORE_COLUMNS.map((m) => (
              <option key={m.key} value={m.key}>{m.monthName}</option>
            ))}
          </select>
          <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${isActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
            {isActive ? 'ثبت نمره‌ی این ماه باز است' : 'ثبت نمره‌ی این ماه بسته است'}
          </span>
          <span className="text-[11px] font-bold text-slate-500 mr-auto">
            {toPersianDigits(totalMissingClasses)} مورد ناقص • {toPersianDigits(completeCount)} مورد کامل
          </span>
        </div>
      </div>

      {missingRows.length === 0 ? (
        <div className="py-10 text-center text-sm font-bold text-emerald-700 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>نمره‌ی همه‌ی دروس این ماه ثبت شده است.</span>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {missingRows.map((r) => (
            <li key={r.subjectId} className="p-4 space-y-2">
              <div className="text-sm font-extrabold text-slate-900">{r.subjectName}</div>
              <div className="flex flex-wrap gap-2">
                {r.items.map((i) => {
                  const none = i.recorded === 0;
                  return (
                    <button
                      key={i.classId}
                      type="button"
                      onClick={() => onPick(i.classId, r.subjectId)}
                      className={`min-h-[44px] px-3 py-1.5 rounded-xl border text-right cursor-pointer transition ${none ? 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100' : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'}`}
                    >
                      <div className="text-xs font-extrabold">{i.className}</div>
                      <div className="text-[11px] font-bold opacity-80">
                        {none ? 'هیچ نمره‌ای ثبت نشده' : `${toPersianDigits(i.expected - i.recorded)} نفر از ${toPersianDigits(i.expected)} بدون نمره`}
                      </div>
                      {i.teacher && <div className="text-[10px] font-medium opacity-70">دبیر: {i.teacher}</div>}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
