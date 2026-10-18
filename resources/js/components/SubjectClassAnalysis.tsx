import React, { useMemo, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { MonthlyContinuousKey } from '../types';
import { subjectAppliesToClass } from '../utils/courseAssignments';
import { bandCounts, CONTINUOUS_MONTHS, mean, round2, stdDev } from '../utils/examReport';
import { SCORE_BAND_STYLE, ScoreBand, scoreBand } from '../utils/gradePeriods';
import { toPersianDigits } from '../utils/persianDate';
import { nextBand, ScoreColumnHeader } from './ScoreColumnHeader';

const fa = (n?: number) => (n === undefined ? '—' : toPersianDigits(round2(n)));
const num = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);

/** تحلیل هر درس در کلاس‌های هم‌پایه: میانگین، پراکندگی، توزیع ممتاز/متوسط/ضعیف و دبیر هر کلاس */
export const SubjectClassAnalysis: React.FC = () => {
  const { classes, students, academicSubjects, academicGrades, courseAssignments, allTeachers } = useSchool();
  const gradeLevels = useMemo(() => Array.from(new Set(classes.filter((c) => !c.isWorkshop).map((c) => c.grade))), [classes]);
  const [grade, setGrade] = useState(gradeLevels[0] || '');
  const [period, setPeriod] = useState<MonthlyContinuousKey | 'year'>('year');
  const [filters, setFilters] = useState<Record<string, ScoreBand>>({});

  const gradeClasses = classes.filter((c) => !c.isWorkshop && c.grade === grade);

  /** نمره‌های مستمر یک درس در یک کلاس (ماه انتخابی یا میانگین ماه‌های هر دانش‌آموز) */
  const scoresOf = (subjectId: string, classId: string): number[] => {
    const ids = new Set(students.filter((s) => s.classId === classId).map((s) => s.id));
    return academicGrades
      .filter((g) => g.subjectId === subjectId && ids.has(g.studentId))
      .map((g) => (period === 'year' ? mean(CONTINUOUS_MONTHS.map((m) => g[m.key]).filter(num)) : g[period]))
      .filter(num);
  };

  const rows = useMemo(
    () =>
      academicSubjects
        .map((sub) => {
          const cells = gradeClasses.map((cls) => {
            if (!subjectAppliesToClass(sub, cls)) return { cls, applies: false as const };
            const xs = scoresOf(sub.id, cls.id);
            const teacherId = courseAssignments.find((a) => a.classId === cls.id && a.subjectId === sub.id)?.teacherId;
            return {
              cls, applies: true as const, n: xs.length, avg: mean(xs), sd: stdDev(xs), bands: bandCounts(xs),
              teacher: allTeachers.find((t) => t.id === teacherId)?.name,
            };
          });
          const pooled = gradeClasses.flatMap((cls) => (subjectAppliesToClass(sub, cls) ? scoresOf(sub.id, cls.id) : []));
          return { sub, cells, pooledAvg: mean(pooled) };
        })
        .filter((r) => r.cells.some((c) => c.applies)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [academicSubjects, gradeClasses.map((c) => c.id).join(), students, academicGrades, period, courseAssignments, allTeachers]
  );

  const visible = rows.filter((r) =>
    Object.entries(filters).every(([col, band]) => {
      if (col === 'pooled') return scoreBand(r.pooledAvg) === band;
      const c = r.cells.find((x) => x.cls.id === col);
      return c?.applies && scoreBand(c.avg) === band;
    })
  );
  const cycle = (col: string) =>
    setFilters((prev) => {
      const next = nextBand(prev[col]);
      const { [col]: _old, ...rest } = prev;
      return next ? { ...rest, [col]: next } : rest;
    });
  const select = 'w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer';

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" dir="rtl" aria-label="تحلیل دروس در کلاس‌ها">
      <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
        <div>
          <h2 className="text-base font-black text-slate-900">تحلیل هر درس در کلاس‌های هم‌پایه</h2>
          <p className="text-xs text-slate-500 mt-0.5">میانگین نمرات مستمر هر درس در هر کلاس، همراه با دبیر، پراکندگی و تعداد دانش‌آموزان ممتاز/متوسط/ضعیف. اگر میانگین یک درس فقط در یک کلاس پایین است، مشکل از همان کلاس است نه خود درس.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">پایه</span>
            <select value={grade} onChange={(e) => { setGrade(e.target.value); setFilters({}); }} className={select}>
              {gradeLevels.map((g) => <option key={g} value={g}>پایه {g}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">ماه</span>
            <select value={period} onChange={(e) => { setPeriod(e.target.value as MonthlyContinuousKey | 'year'); setFilters({}); }} className={select}>
              <option value="year">میانگین کل سال</option>
              {CONTINUOUS_MONTHS.map((m) => <option key={m.key} value={m.key}>{m.monthName}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
          {(Object.keys(SCORE_BAND_STYLE) as ScoreBand[]).map((b) => (
            <span key={b} className={`px-2.5 py-1 rounded-full border ${SCORE_BAND_STYLE[b].chip}`}>{SCORE_BAND_STYLE[b].label}</span>
          ))}
          {Object.keys(filters).length > 0 && <button type="button" onClick={() => setFilters({})} className="px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 cursor-pointer">حذف فیلترها</button>}
        </div>
      </div>

      {gradeClasses.length === 0 || rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">برای این پایه درس یا کلاسی ثبت نشده است.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-2 text-right text-[11px] font-bold text-slate-500 sticky right-0 bg-white z-10 min-w-28">درس</th>
                {gradeClasses.map((c) => <ScoreColumnHeader key={c.id} title={c.name} band={filters[c.id]} onCycle={() => cycle(c.id)} />)}
                <ScoreColumnHeader title="میانگین پایه" band={filters.pooled} onCycle={() => cycle('pooled')} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map(({ sub, cells, pooledAvg }) => (
                <tr key={sub.id}>
                  <td className="px-3 py-2 font-bold text-slate-900 sticky right-0 bg-white z-10 whitespace-nowrap">{sub.name}</td>
                  {cells.map((c) =>
                    !c.applies ? (
                      <td key={c.cls.id} className="px-2 py-2 text-center text-slate-200">—</td>
                    ) : (
                      <td key={c.cls.id} className="px-1.5 py-1.5 text-center align-top">
                        <div className={`rounded-xl px-2 py-1.5 ${c.avg === undefined ? 'bg-slate-50 text-slate-300' : SCORE_BAND_STYLE[scoreBand(c.avg) as ScoreBand].cell}`}>
                          <div className="font-black">{fa(c.avg)}</div>
                          {c.avg !== undefined && (
                            <div className="text-[10px] font-bold opacity-80 leading-4">
                              <div>پراکندگی {fa(c.sd)}</div>
                              <div>{toPersianDigits(c.bands.excellent)} ممتاز • {toPersianDigits(c.bands.good)} متوسط • {toPersianDigits(c.bands.weak)} ضعیف</div>
                            </div>
                          )}
                          {c.teacher && <div className="text-[10px] font-medium opacity-70 mt-0.5 truncate max-w-32">{c.teacher}</div>}
                        </div>
                      </td>
                    )
                  )}
                  <td className={`px-2 py-2 text-center font-black ${pooledAvg === undefined ? 'text-slate-300' : SCORE_BAND_STYLE[scoreBand(pooledAvg) as ScoreBand].cell}`}>{fa(pooledAvg)}</td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={gradeClasses.length + 2} className="py-8 text-center text-xs text-slate-400">درسی با این فیلترها پیدا نشد.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
