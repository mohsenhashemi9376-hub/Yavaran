import React, { useMemo } from 'react';
import { BookOpen, CheckCircle2, Plus } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { MonthlyContinuousKey } from '../types';
import { subjectAppliesToClass } from '../utils/courseAssignments';
import { buildGradePeriodList, isPeriodOpenForSubject } from '../utils/gradePeriods';
import { toPersianDigits } from '../utils/persianDate';

interface Props {
  /** باز کردن دفتر نمره‌ی همان کلاس و درس */
  onPick: (classId: string, subjectId: string) => void;
  /** کلاس انتخاب‌شده در نوار فرمان */
  classId: string;
  /** ماه انتخاب‌شده در نوار فرمان */
  period: MonthlyContinuousKey;
}

/** دروسی که نمره‌ی ماه انتخابی برایشان در کلاس انتخاب‌شده کامل ثبت نشده است؛ هر درس یک کارت مجزا */
export const UngradedSubjectsPanel: React.FC<Props> = ({ onPick, classId, period }) => {
  const { classes, students, academicSubjects, academicGrades, gradePeriods, courseAssignments, allTeachers } = useSchool();
  const periods = useMemo(() => buildGradePeriodList(gradePeriods), [gradePeriods]);

  const { missingRows, completeCount } = useMemo(() => {
    const rows: { subjectId: string; subjectName: string; classId: string; className: string; expected: number; recorded: number; teacher?: string }[] = [];
    let complete = 0;
    const periodRec = periods.find((p) => p.code === period);
    const cls = classes.find((c) => c.id === classId && !c.isWorkshop);
    if (!cls) return { missingRows: rows, completeCount: 0 };
    const ids = new Set(students.filter((s) => s.classId === cls.id).map((s) => s.id));
    academicSubjects.forEach((sub) => {
      // دروسی که ثبت نمره‌ی این ماه برایشان باز نشده، در این فهرست نمی‌آیند
      if (!isPeriodOpenForSubject(periodRec, sub.id) || !subjectAppliesToClass(sub, cls) || ids.size === 0) return;
      const recorded = academicGrades.filter((g) => g.subjectId === sub.id && ids.has(g.studentId) && typeof g[period] === 'number' && !Number.isNaN(g[period] as number)).length;
      if (recorded >= ids.size) { complete++; return; }
      const teacherId = courseAssignments.find((a) => a.classId === cls.id && a.subjectId === sub.id)?.teacherId;
      rows.push({ subjectId: sub.id, subjectName: sub.name, classId: cls.id, className: cls.name, expected: ids.size, recorded, teacher: allTeachers.find((t) => t.id === teacherId)?.name });
    });
    return { missingRows: rows, completeCount: complete };
  }, [classes, students, academicSubjects, academicGrades, courseAssignments, allTeachers, period, periods, classId]);

  return (
    <section className="space-y-3" dir="rtl" aria-label="دروس بدون نمره">
      {/* نوار وضعیت فشرده */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-3 py-1.5 rounded-full text-[11px] font-extrabold border bg-rose-50 text-rose-700 border-rose-200">
          {toPersianDigits(missingRows.length)} مورد ناقص
        </span>
        <span className="px-3 py-1.5 rounded-full text-[11px] font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200">
          {toPersianDigits(completeCount)} مورد کامل
        </span>
      </div>

      {missingRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-8 text-center text-sm font-bold text-emerald-700 flex items-center justify-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>نمره‌ی همه‌ی دروس این کلاس در این ماه ثبت شده است.</span>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {missingRows.map((r) => {
            const none = r.recorded === 0;
            return (
              <li key={r.subjectId} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><BookOpen className="w-5 h-5" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-extrabold text-slate-900 truncate">{r.subjectName}</h3>
                    <div className="text-[11px] text-slate-500 truncate">{r.teacher ? `دبیر: ${r.teacher}` : 'دبیر تعیین نشده'}</div>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-bold ${none ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  {none ? 'هیچ نمره‌ای ثبت نشده' : `${toPersianDigits(r.expected - r.recorded)} نفر از ${toPersianDigits(r.expected)} بدون نمره`}
                </span>
                <button
                  type="button"
                  onClick={() => onPick(r.classId, r.subjectId)}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" /> ورود به دفتر نمره
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
