import React, { useMemo, useState } from 'react';
import { ClipboardList, FileSpreadsheet, FileText, SlidersHorizontal, Users, X } from 'lucide-react';
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
  const [sheetOpen, setSheetOpen] = useState(false);
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

  const pickClass = (id: string) => { setClassId(id); setFilters({}); };
  const pickPeriod = (key: MonthlyContinuousKey | 'year') => { setPeriod(key); setFilters({}); };
  const periodLabel = period === 'year' ? 'میانگین مستمر' : periodTitle(period);

  const headerCell = (col: string, title: string) => <ScoreColumnHeader key={col} title={title} band={filters[col]} onCycle={() => cycle(col)} />;

  /** فیلتر سریع بر اساس گروه میانگین (برای موبایل و خلاصه‌ی بالای صفحه) */
  const toggleAvgBand = (band: ScoreBand) =>
    setFilters((prev) => {
      const { avg: _old, ...rest } = prev;
      return prev.avg === band ? rest : { ...rest, avg: band };
    });
  const bandCount = (band: ScoreBand) => rows.filter((r) => scoreBand(r.avg) === band).length;
  const classAverage = colAvg('avg');

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
          <p className="text-xs text-slate-500 mt-0.5">نمرات همه‌ی دروس کلاس در یک ماه. برای فیلتر، یکی از گروه‌های میانگین را لمس کنید.</p>
        </div>
        <div className="hidden md:grid grid-cols-2 gap-2">
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
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 rounded-2xl py-2.5 px-1">
            <div className="text-lg font-extrabold text-emerald-800 leading-6">{fmt(classAverage)}</div>
            <div className="text-[11px] font-bold text-slate-500">میانگین کلاس</div>
          </div>
          <div className="bg-slate-50 rounded-2xl py-2.5 px-1">
            <div className="text-lg font-extrabold text-slate-800 leading-6 inline-flex items-center gap-1">
              <Users className="w-4 h-4 text-slate-400" />
              {toPersianDigits(rows.length)}
            </div>
            <div className="text-[11px] font-bold text-slate-500">دانش‌آموز</div>
          </div>
          <div className="bg-slate-50 rounded-2xl py-2.5 px-1">
            <div className="text-lg font-extrabold text-slate-800 leading-6">{toPersianDigits(subjects.length)}</div>
            <div className="text-[11px] font-bold text-slate-500">درس</div>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
          {(Object.keys(SCORE_BAND_STYLE) as ScoreBand[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => toggleAvgBand(b)}
              aria-pressed={filters.avg === b}
              className={`shrink-0 min-h-[44px] px-3.5 rounded-xl border text-xs font-bold cursor-pointer transition ${SCORE_BAND_STYLE[b].chip} ${filters.avg === b ? 'ring-2 ring-offset-1 ring-current' : 'opacity-80'}`}
            >
              {SCORE_BAND_STYLE[b].label.split(' ')[0]} · {toPersianDigits(bandCount(b))}
            </button>
          ))}
          {Object.keys(filters).length > 0 && (
            <button type="button" onClick={() => setFilters({})} className="shrink-0 min-h-[44px] px-3.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer">
              حذف فیلترها
            </button>
          )}
        </div>
        <button type="button" onClick={exportExcel} className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition">
          <FileSpreadsheet className="w-4 h-4" />
          <span>خروجی اکسل</span>
        </button>
      </div>

      {subjects.length === 0 || classStudents.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">برای این کلاس درس یا دانش‌آموزی ثبت نشده است.</div>
      ) : (
        <>
        {/* موبایل: کارت برای هر دانش‌آموز، بدون اسکرول افقی */}
        <div className="md:hidden p-3 pb-44 space-y-3 bg-slate-50/60">
          {visible.map((r, i) => {
            const band = scoreBand(r.avg);
            return (
              <div key={r.st.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3.5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-slate-100 text-slate-500 text-xs font-extrabold inline-flex items-center justify-center">{toPersianDigits(i + 1)}</span>
                  <button type="button" onClick={() => onSelectStudent?.(r.st)} className="flex-1 min-w-0 text-right text-sm font-extrabold text-slate-900 truncate cursor-pointer">
                    {studentFullName(r.st)}
                  </button>
                  <div className={`shrink-0 min-w-14 text-center rounded-xl border px-2 py-1 ${band ? SCORE_BAND_STYLE[band].chip : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <div className="text-base font-extrabold leading-5">{fmt(r.avg)}</div>
                    <div className="text-[10px] font-bold">میانگین</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {subjects.map((s) => (
                    <div key={s.id} className={`rounded-xl px-3 py-2 flex items-center justify-between gap-2 ${r.scores[s.id] === undefined ? 'bg-slate-50 text-slate-300' : cellClass(r.scores[s.id])}`}>
                      <span className="text-[11px] font-bold leading-4 text-slate-600 line-clamp-2">{s.name}</span>
                      <span className="text-sm font-extrabold shrink-0">{fmt(r.scores[s.id])}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setCardStudent(r.st)} className="min-h-[44px] rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer">
                    <FileText className="w-4 h-4" />
                    کارنامه شخصی
                  </button>
                  <button type="button" onClick={() => setFullStudent(r.st)} className="min-h-[44px] rounded-xl bg-indigo-50 text-indigo-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer">
                    <ClipboardList className="w-4 h-4" />
                    کارنامه جامع
                  </button>
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <div className="py-8 text-center text-xs text-slate-400">دانش‌آموزی با این فیلترها پیدا نشد.</div>}
        </div>

        <div className="hidden md:block overflow-x-auto">
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
        </>
      )}

      {/* موبایل: نوار انتخاب کلاس و ماه نزدیک شست، بالای منوی پایین */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="md:hidden fixed inset-x-4 bottom-24 z-30 min-h-[52px] px-4 rounded-2xl bg-slate-900 text-white shadow-lg inline-flex items-center justify-between gap-3 cursor-pointer"
      >
        <span className="min-w-0 truncate text-sm font-extrabold">{cls.name} <span className="text-slate-400 font-bold">•</span> {periodLabel}</span>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300">
          <SlidersHorizontal className="w-4 h-4" />
          تغییر
        </span>
      </button>
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
          <button type="button" aria-label="بستن" onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-slate-900/50" />
          <div className="relative w-full max-h-[80vh] overflow-y-auto bg-white rounded-t-3xl shadow-xl p-4 pb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-extrabold text-slate-900">انتخاب کلاس و ماه</h5>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="بستن" className="w-11 h-11 inline-flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 mb-2">ماه</div>
              <div className="grid grid-cols-3 gap-2">
                {[...REPORT_PERIODS.map((p) => ({ key: p.key as MonthlyContinuousKey | 'year', label: periodTitle(p.key) })), { key: 'year' as const, label: 'میانگین مستمر' }].map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => pickPeriod(o.key)}
                    className={`min-h-[44px] px-2 rounded-xl text-xs font-bold cursor-pointer transition ${period === o.key ? 'bg-emerald-700 text-white' : 'bg-slate-50 text-slate-700'}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 mb-2">کلاس</div>
              <div className="grid grid-cols-2 gap-2">
                {classChoices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickClass(c.id)}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-bold text-right cursor-pointer transition ${cls.id === c.id ? 'bg-emerald-700 text-white' : 'bg-slate-50 text-slate-700'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setSheetOpen(false)} className="w-full min-h-[48px] rounded-xl bg-emerald-700 text-white text-sm font-bold cursor-pointer">
              مشاهده نتیجه
            </button>
          </div>
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
