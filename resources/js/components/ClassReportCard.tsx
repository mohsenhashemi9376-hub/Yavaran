import React, { useMemo, useState } from 'react';
import { ClipboardList, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSchool } from '../context/SchoolContext';
import { MONTHLY_EVALUATION_PERIODS, MonthlyContinuousKey, SchoolClass, Student } from '../types';
import { subjectAppliesToClass } from '../utils/courseAssignments';
import { CONTINUOUS_MONTHS } from '../utils/examReport';
import { SCORE_BAND_STYLE, ScoreBand, isPeriodOpenForSubject, scoreBand } from '../utils/gradePeriods';
import { toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { compareByLastName } from '../utils/morningAttendance';
import { ScoreColumnHeader } from './ScoreColumnHeader';
import { StudentFullReportModal } from './StudentFullReportModal';
import { StudentReportCardModal } from './StudentReportCardModal';

/** ستون‌های کارنامه: همان ستون‌های دفتر نمرات (مستمر هر ماه + پایانی اول و دوم) */
const REPORT_PERIODS = MONTHLY_EVALUATION_PERIODS;
const periodTitle = (key: MonthlyContinuousKey) => REPORT_PERIODS.find((p) => p.key === key)?.label ?? key;

const BAND_ORDER: (ScoreBand | undefined)[] = [undefined, 'excellent', 'good', 'weak'];
const fmt = (n: number | undefined) => (n === undefined ? '—' : toPersianDigits(Math.round(n * 100) / 100));
const mean = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined);

interface ClassReportCardProps {
  classData: SchoolClass;
  onSelectStudent?: (student: Student) => void;
}

export const ClassReportCard: React.FC<ClassReportCardProps> = ({ classData, onSelectStudent }) => {
  const { accessibleClasses, classes, students, academicSubjects, academicGrades, isTeacher, isAdmin, isEducationalVice, canTeachClassAndSubject, currentUser, gradePeriods } = useSchool();

  const classChoices = useMemo(() => {
    const pool = (accessibleClasses.length ? accessibleClasses : classes).filter((c) => !c.isWorkshop);
    return pool.some((c) => c.id === classData.id) ? pool : [classData, ...pool];
  }, [accessibleClasses, classes, classData]);

  const [classId, setClassId] = useState(classData.id);
  const [period, setPeriod] = useState<MonthlyContinuousKey | 'year'>('mehrContinuous');
  // فیلتر هر ستون: شناسه‌ی درس (یا «avg») ← گروه نمره
  const [cardStudent, setCardStudent] = useState<Student | null>(null);
  const [fullStudent, setFullStudent] = useState<Student | null>(null);
  const [filters, setFilters] = useState<Record<string, ScoreBand>>({});

  const cls = classChoices.find((c) => c.id === classId) ?? classData;
  const restrict = !isAdmin && !isEducationalVice && (isTeacher || (currentUser.teachingAssignments || []).length > 0);
  const scopedSubjects = useMemo(
    () => academicSubjects.filter((s) => subjectAppliesToClass(s, cls) && (!restrict || canTeachClassAndSubject(cls.id, s.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [academicSubjects, cls, restrict, currentUser.teachingAssignments]
  );
  const classStudents = useMemo(() => students.filter((s) => s.classId === cls.id).slice().sort(compareByLastName), [students, cls.id]);

  /** دروسی که ثبت نمره‌شان برای این ماه (یا هر ماهی در «کل سال») باز نشده و نمره‌ای هم ندارند، نمایش داده نمی‌شوند */
  const subjects = useMemo(() => {
    const classStudentIds = new Set(classStudents.map((s) => s.id));
    return scopedSubjects.filter((sub) => {
      const open = period === 'year'
        ? gradePeriods.some((p) => isPeriodOpenForSubject(p, sub.id))
        : isPeriodOpenForSubject(gradePeriods.find((p) => p.code === period), sub.id);
      if (open) return true;
      const keys = period === 'year' ? CONTINUOUS_MONTHS.map((m) => m.key) : [period];
      return academicGrades.some((g) => g.subjectId === sub.id && classStudentIds.has(g.studentId) && keys.some((k) => typeof g[k] === 'number' && !Number.isNaN(g[k] as number)));
    });
  }, [scopedSubjects, classStudents, gradePeriods, academicGrades, period]);

  /** نمره‌ی یک دانش‌آموز در یک درس: ماه انتخابی، یا میانگین تمام ماه‌های ثبت‌شده */
  const scoreOf = (studentId: string, subjectId: string): number | undefined => {
    const g = academicGrades.find((x) => x.studentId === studentId && x.subjectId === subjectId);
    if (!g) return undefined;
    if (period !== 'year') {
      const v = g[period];
      return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
    }
    return mean(CONTINUOUS_MONTHS.map((p) => g[p.key]).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v)));
  };

  const rows = useMemo(
    () =>
      classStudents.map((st) => {
        const scores: Record<string, number | undefined> = {};
        subjects.forEach((sub) => { scores[sub.id] = scoreOf(st.id, sub.id); });
        const avg = mean(Object.values(scores).filter((v): v is number => v !== undefined));
        return { st, scores, avg };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classStudents, subjects, academicGrades, period]
  );

  const visible = rows.filter((r) =>
    Object.entries(filters).every(([col, band]) => scoreBand(col === 'avg' ? r.avg : r.scores[col]) === band)
  );
  const colAvg = (col: string, list = rows) => mean(list.map((r) => (col === 'avg' ? r.avg : r.scores[col])).filter((v): v is number => v !== undefined));

  /** کلیک روی عنوان ستون: همه ← ممتازین ← متوسط ← ضعیف ← همه */
  const cycle = (col: string) =>
    setFilters((prev) => {
      const next = BAND_ORDER[(BAND_ORDER.indexOf(prev[col]) + 1) % BAND_ORDER.length];
      const { [col]: _old, ...rest } = prev;
      return next ? { ...rest, [col]: next } : rest;
    });

  const headerCell = (col: string, title: string) => <ScoreColumnHeader key={col} title={title} band={filters[col]} onCycle={() => cycle(col)} />;

  const cellClass = (score: number | undefined) => {
    const b = scoreBand(score);
    return b ? SCORE_BAND_STYLE[b].cell : 'text-slate-300';
  };

  const exportExcel = () => {
    const data = visible.map((r, i) => ({
      ردیف: i + 1,
      'نام و نام خانوادگی': studentFullName(r.st),
      ...Object.fromEntries(subjects.map((s) => [s.name, r.scores[s.id] ?? ''])),
      میانگین: r.avg === undefined ? '' : Math.round(r.avg * 100) / 100,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'کارنامه');
    XLSX.writeFile(wb, `کارنامه-${cls.name}-${period === 'year' ? 'کل-سال' : periodTitle(period)}.xlsx`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div>
          <h4 className="text-sm font-extrabold text-slate-900">کارنامه تجمیعی کلاس</h4>
          <p className="text-xs text-slate-500 mt-0.5">نمرات همه‌ی دروس و دانش‌آموزان کلاس در یک ماه، با میانگین. برای فیلتر، روی عنوان هر ستون بزنید.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">کلاس</span>
            <select
              value={cls.id}
              onChange={(e) => { setClassId(e.target.value); setFilters({}); }}
              className="w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer"
            >
              {classChoices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">ماه</span>
            <select
              value={period}
              onChange={(e) => { setPeriod(e.target.value as MonthlyContinuousKey | 'year'); setFilters({}); }}
              className="w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer"
            >
              {REPORT_PERIODS.map((p) => <option key={p.key} value={p.key}>{periodTitle(p.key)}</option>)}
              <option value="year">میانگین مستمر</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
          {(Object.keys(SCORE_BAND_STYLE) as ScoreBand[]).map((b) => (
            <span key={b} className={`px-2.5 py-1 rounded-full border ${SCORE_BAND_STYLE[b].chip}`}>{SCORE_BAND_STYLE[b].label}</span>
          ))}
          {Object.keys(filters).length > 0 && (
            <button type="button" onClick={() => setFilters({})} className="px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 cursor-pointer">
              حذف فیلترها
            </button>
          )}
          <button type="button" onClick={exportExcel} className="mr-auto px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg inline-flex items-center gap-1 cursor-pointer">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>خروجی اکسل</span>
          </button>
        </div>
      </div>

      {subjects.length === 0 || classStudents.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">برای این کلاس درس یا دانش‌آموزی ثبت نشده است.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/70">
                <th className="px-3 py-2 text-right text-[11px] font-bold text-slate-500 sticky right-0 bg-slate-50 z-10 min-w-36">دانش‌آموز</th>
                {subjects.map((s) => headerCell(s.id, s.name))}
                {headerCell('avg', 'میانگین')}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r, i) => (
                <tr key={r.st.id}>
                  <td className="px-3 py-2 sticky right-0 bg-white z-10 whitespace-nowrap">
                    <button type="button" onClick={() => onSelectStudent?.(r.st)} className="text-right font-bold text-slate-900 cursor-pointer">
                      <span className="text-slate-400 text-xs ml-2">{toPersianDigits(i + 1)}</span>
                      {studentFullName(r.st)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardStudent(r.st)}
                      aria-label={`کارنامه شخصی ${studentFullName(r.st)}`}
                      title="کارنامه شخصی"
                      className="mr-2 w-9 h-9 inline-flex items-center justify-center align-middle rounded-xl bg-slate-50 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullStudent(r.st)}
                      aria-label={`کارنامه جامع ${studentFullName(r.st)}`}
                      title="کارنامه جامع"
                      className="mr-1 w-9 h-9 inline-flex items-center justify-center align-middle rounded-xl bg-slate-50 text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                    >
                      <ClipboardList className="w-4 h-4" />
                    </button>
                  </td>
                  {subjects.map((s) => (
                    <td key={s.id} className={`px-2 py-2 text-center font-bold ${cellClass(r.scores[s.id])}`}>{fmt(r.scores[s.id])}</td>
                  ))}
                  <td className={`px-2 py-2 text-center font-extrabold ${cellClass(r.avg)}`}>{fmt(r.avg)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={subjects.length + 2} className="py-8 text-center text-xs text-slate-400">دانش‌آموزی با این فیلترها پیدا نشد.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-extrabold border-t-2 border-slate-200">
                <td className="px-3 py-2.5 sticky right-0 bg-slate-50 z-10 text-xs text-slate-700">
                  میانگین کلاس{visible.length !== rows.length ? ' (فیلترشده)' : ''}
                </td>
                {subjects.map((s) => {
                  const a = colAvg(s.id, visible);
                  return <td key={s.id} className={`px-2 py-2.5 text-center ${cellClass(a)}`}>{fmt(a)}</td>;
                })}
                <td className={`px-2 py-2.5 text-center ${cellClass(colAvg('avg', visible))}`}>{fmt(colAvg('avg', visible))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {fullStudent && <StudentFullReportModal student={fullStudent} classData={cls} onClose={() => setFullStudent(null)} />}
      {cardStudent && (
        <StudentReportCardModal
          student={cardStudent}
          classData={cls}
          subjects={subjects}
          initialPeriod={period === 'year' ? 'mehrContinuous' : period}
          onClose={() => setCardStudent(null)}
        />
      )}
    </div>
  );
};
