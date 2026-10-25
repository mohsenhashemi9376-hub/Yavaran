import React, { useMemo } from 'react';
import { BarChart3, GraduationCap, Sparkles, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, MONTHLY_EVALUATION_PERIODS } from '../types';
import { subjectAppliesToClass } from '../utils/courseAssignments';
import { continuousAverage } from '../utils/gradeColumns';
import { toPersianDigits } from '../utils/persianDate';

const ACADEMIC_YEAR = '1405-1406';

/** داده‌ی آزمایشی: فقط وقتی هنوز نمره‌ای برای این کلاس ثبت نشده است نمایش داده می‌شود */
const DEMO_SCORES = [19.5, 18, 17.25, 16.5, 16, 15.5, 14, 13.25, 12, 11.5, 10, 9.5, 8, 6.75];

const TIERS = [
  { key: 'top', label: 'ممتاز', range: 'نمره ۱۶ تا ۲۰', icon: TrendingUp, bar: 'bg-emerald-500', card: 'border-emerald-200 bg-emerald-50/70', text: 'text-emerald-800', soft: 'text-emerald-600' },
  { key: 'mid', label: 'متوسط', range: 'نمره ۱۰ تا ۱۵٫۹۹', icon: BarChart3, bar: 'bg-amber-400', card: 'border-amber-200 bg-amber-50/70', text: 'text-amber-800', soft: 'text-amber-600' },
  { key: 'low', label: 'نیازمند تلاش', range: 'نمره زیر ۱۰', icon: TrendingDown, bar: 'bg-rose-500', card: 'border-rose-200 bg-rose-50/70', text: 'text-rose-800', soft: 'text-rose-600' },
] as const;

const tierOf = (score: number): 0 | 1 | 2 => (score >= 16 ? 0 : score >= 10 ? 1 : 2);

/**
 * پنل تحلیل وضعیت کلاس برای دبیر: میانگین کل و توزیع دانش‌آموزان در سه دسته.
 * فقط نمره‌ی دروس همین دبیر در این کلاس محاسبه می‌شود (نه دروس سایر دبیران و نه هیچ داده‌ی انضباطی).
 */
export const ClassGradeAnalytics: React.FC<{ classData: SchoolClass }> = ({ classData }) => {
  const { students, academicSubjects, academicGrades, canTeachClassAndSubject, isAdmin, isEducationalVice, isCoach } = useSchool();

  const { scores, subjectNames, isDemo, total } = useMemo(() => {
    const own = academicSubjects.filter((s) => subjectAppliesToClass(s, classData) && (isAdmin || isEducationalVice || isCoach || canTeachClassAndSubject(classData.id, s.id)));
    const ids = new Set(own.map((s) => s.id));
    const classStudents = students.filter((s) => s.classId === classData.id);
    const real: number[] = [];
    classStudents.forEach((stu) => {
      const avgs = academicGrades
        .filter((g) => g.studentId === stu.id && ids.has(g.subjectId))
        .map((g) => continuousAverage(MONTHLY_EVALUATION_PERIODS.map((p) => ({ key: p.key, value: g[p.key] as number | undefined }))))
        .filter((v): v is number => v !== undefined);
      if (avgs.length) real.push(avgs.reduce((a, b) => a + b, 0) / avgs.length);
    });
    const demo = real.length === 0;
    return { scores: demo ? DEMO_SCORES : real, subjectNames: own.map((s) => s.name), isDemo: demo, total: classStudents.length };
  }, [students, academicSubjects, academicGrades, classData, canTeachClassAndSubject, isAdmin, isEducationalVice, isCoach]);

  const counts = [0, 0, 0];
  scores.forEach((s) => { counts[tierOf(s)] += 1; });
  const n = scores.length;
  const average = Math.round((scores.reduce((a, b) => a + b, 0) / n) * 100) / 100;
  const pct = (c: number) => Math.round((c / n) * 100);

  return (
    <section className="bg-white rounded-2xl shadow-sm shadow-slate-200/60 p-5 lg:p-6 space-y-5" aria-label="تحلیل وضعیت کلاس">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 grid place-items-center"><GraduationCap className="w-6 h-6" /></span>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">تحلیل وضعیت کلاس {classData.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              سال تحصیلی {toPersianDigits(ACADEMIC_YEAR)}{subjectNames.length > 0 && <> · {subjectNames.join('، ')}</>}
            </p>
          </div>
        </div>
        {isDemo && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold px-3 py-1.5">
            <Sparkles className="w-3.5 h-3.5" /> داده‌ی نمونه — هنوز نمره‌ای ثبت نشده است
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-800 text-white p-5 shadow-sm flex flex-col justify-between min-h-32">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-100"><Users className="w-4 h-4" /> میانگین کل کلاس</div>
          <div>
            <div className="text-4xl font-black tabular-nums">{toPersianDigits(average)}</div>
            <div className="text-[11px] text-emerald-100 mt-1">از ۲۰ · {toPersianDigits(n)} دانش‌آموز{!isDemo && total > n && ` از ${toPersianDigits(total)}`}</div>
          </div>
        </div>
        {TIERS.map((t, i) => (
          <div key={t.key} className={`rounded-2xl border p-5 shadow-sm flex flex-col justify-between min-h-32 ${t.card}`}>
            <div className={`flex items-center justify-between text-xs font-extrabold ${t.text}`}>
              <span className="flex items-center gap-1.5"><t.icon className="w-4 h-4" /> {t.label}</span>
              <span className={`text-[11px] font-bold ${t.soft}`}>{t.range}</span>
            </div>
            <div className="flex items-end justify-between">
              <div className={`text-4xl font-black tabular-nums ${t.text}`}>{toPersianDigits(counts[i])}<span className="text-sm font-bold mr-1">نفر</span></div>
              <div className={`text-lg font-black tabular-nums ${t.soft}`}>{toPersianDigits(pct(counts[i]))}٪</div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-600">توزیع دانش‌آموزان کلاس</div>
        <div className="flex h-5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="نوار توزیع دانش‌آموزان در سه دسته">
          {TIERS.map((t, i) => counts[i] > 0 && (
            <div key={t.key} style={{ width: `${(counts[i] / n) * 100}%` }} className={`${t.bar} h-full transition-all duration-500 grid place-items-center text-[10px] font-black text-white`} title={`${t.label}: ${toPersianDigits(counts[i])} نفر`}>
              {pct(counts[i]) >= 8 && `${toPersianDigits(pct(counts[i]))}٪`}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] font-bold text-slate-600">
          {TIERS.map((t, i) => (
            <span key={t.key} className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${t.bar}`} />{t.label} ({toPersianDigits(counts[i])})</span>
          ))}
        </div>
      </div>
    </section>
  );
};
