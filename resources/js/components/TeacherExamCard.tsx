import React, { useMemo } from 'react';
import { ChevronLeft, ClipboardCheck } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { EXAM_MONTHS, examScoresOf, examMaxOf, mean, round2 } from '../utils/examReport';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { scorePillClass } from '../utils/gradePeriods';
import { examKeyOfSubjectName, TeacherSubjectGroup } from './TeacherExamSection';

/** ماه شمسی هر ماه آزمون (مهر…اردیبهشت) ← ترتیب در سال تحصیلی (مهر = ۰) */
const MONTH_NUMBER: Record<string, number> = { mehrContinuous: 7, abanContinuous: 8, azarContinuous: 9, bahmanContinuous: 11, farvardinContinuous: 1, ordibeheshtContinuous: 2 };
const ordinal = (m: number) => (m >= 7 ? m - 7 : m + 5);

interface Props {
  groups: TeacherSubjectGroup[];
  onOpen: () => void;
}

/** کادر شیشه‌ای آزمون جامع در داشبورد دبیر: معدل کلاس‌های دبیر در ماه قبل؛ با لمس، کارنامهٔ آزمون جامع باز می‌شود. */
export const TeacherExamCard: React.FC<Props> = ({ groups, onOpen }) => {
  const { students, comprehensiveExams } = useSchool();

  const data = useMemo(() => {
    const opts = groups.flatMap((g) => {
      const key = examKeyOfSubjectName(g.subjectName);
      return key ? g.classes.filter((c) => !c.isWorkshop).map((c) => ({ key, classId: c.id })) : [];
    });
    const avgOf = (monthKey: (typeof EXAM_MONTHS)[number]['key']) => {
      const vals: number[] = [];
      opts.forEach((o) => {
        const record = comprehensiveExams.find((r) => r.classId === o.classId);
        const ids = new Set(students.filter((s) => s.classId === o.classId).map((s) => s.id));
        Object.entries(examScoresOf(record, monthKey)).forEach(([sid, sc]) => {
          const v = sc[o.key];
          if (ids.has(sid) && typeof v === 'number') vals.push((v / examMaxOf(record, monthKey, o.key)) * 100);
        });
      });
      return mean(vals);
    };
    const withData = EXAM_MONTHS.map((m) => ({ ...m, avg: avgOf(m.key) })).filter((m) => m.avg !== undefined);
    const cur = ordinal(getTodayShamsi().month);
    const before = withData.filter((m) => ordinal(MONTH_NUMBER[m.key]) < cur);
    const pick = before.length ? before[before.length - 1] : withData[withData.length - 1];
    return pick ? { label: pick.monthName.replace('مستمر ', ''), avg: pick.avg as number } : null;
  }, [groups, students, comprehensiveExams]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-2xl border border-white/70 bg-white/50 p-4 text-right shadow-sm backdrop-blur-xl transition active:scale-[0.99] cursor-pointer"
    >
      <div className="pointer-events-none absolute -start-8 -top-8 h-28 w-28 rounded-full bg-indigo-300/30 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <ClipboardCheck className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-slate-900">آزمون جامع</div>
          <div className="mt-0.5 text-[11px] font-medium text-slate-500">
            {data ? `معدل کلاس‌های شما در ${data.label}` : 'هنوز نمره‌ای ثبت نشده است'}
          </div>
        </div>
        {data && (
          <span className={`rounded-2xl px-4 py-2 text-2xl font-black tabular-nums ${scorePillClass(data.avg / 5)}`}>
            {toPersianDigits(String(round2(data.avg)).replace('.', '٫'))}٪
          </span>
        )}
        <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:-translate-x-0.5" />
      </div>
      <div className="relative mt-2 text-[11px] font-bold text-indigo-700">ورود نمره و مشاهدهٔ کارنامهٔ آزمون جامع به تفکیک دانش‌آموز و ماه</div>
    </button>
  );
};
