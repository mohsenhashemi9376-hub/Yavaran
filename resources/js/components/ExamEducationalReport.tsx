import React, { useMemo, useState } from 'react';
import { Award, ClipboardList, FileText, Sigma, TriangleAlert } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { StudentFullReportModal } from './StudentFullReportModal';
import { analyzeClassExam, bandCounts, stdDev, EXAM_MONTHS, EXAM_WEAK_BELOW, ExamMonth, examMonthLabel, examMonthsWithData, round2 } from '../utils/examReport';
import { SCORE_BAND_STYLE, ScoreBand, scoreBand } from '../utils/gradePeriods';
import { toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { nextBand, ScoreColumnHeader } from './ScoreColumnHeader';
import { StudentExamCardModal } from './StudentExamCardModal';

const fa = (n?: number) => (n === undefined ? '—' : toPersianDigits(round2(n)));
const cellClass = (v?: number) => {
  const b = scoreBand(v);
  return b ? SCORE_BAND_STYLE[b].cell : 'text-slate-300';
};

interface Props {
  onSelectStudent?: (student: Student) => void;
}

/** گزارش آموزشی آزمون جامع: تحلیل هر کلاس و درس، برترین‌ها و ضعیف‌ها، کارنامه و نمودار رشد دانش‌آموز */
export const ExamEducationalReport: React.FC<Props> = ({ onSelectStudent }) => {
  const { classes, students, comprehensiveExams } = useSchool();
  const examClasses = classes.filter((c) => !c.isWorkshop);
  const [classId, setClassId] = useState(examClasses[0]?.id || '');
  const [month, setMonth] = useState<ExamMonth>('all');
  const [filters, setFilters] = useState<Record<string, ScoreBand>>({});
  const [cardStudent, setCardStudent] = useState<Student | null>(null);
  const [fullStudent, setFullStudent] = useState<Student | null>(null);

  const cls = examClasses.find((c) => c.id === classId) ?? examClasses[0];
  const record = comprehensiveExams.find((r) => r.classId === cls?.id);
  const classStudents = useMemo(() => students.filter((s) => s.classId === cls?.id), [students, cls?.id]);
  const analysis = useMemo(() => analyzeClassExam(record, classStudents, month), [record, classStudents, month]);
  const monthsWithData = examMonthsWithData(record);

  // مقایسه‌ی همه‌ی کلاس‌ها (برای ماه انتخاب‌شده)
  const overview = useMemo(
    () =>
      examClasses.map((c) => {
        const a = analyzeClassExam(comprehensiveExams.find((r) => r.classId === c.id), students.filter((s) => s.classId === c.id), month);
        return { cls: c, a };
      }),
    [examClasses, comprehensiveExams, students, month]
  );

  const cycle = (col: string) =>
    setFilters((prev) => {
      const next = nextBand(prev[col]);
      const { [col]: _old, ...rest } = prev;
      return next ? { ...rest, [col]: next } : rest;
    });
  const visible = analysis.rows.filter((r) =>
    Object.entries(filters).every(([col, band]) => scoreBand(col === 'avg' ? r.avg : r.scores[col as keyof typeof r.scores]) === band)
  );
  const select = 'w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer';
  const card = 'bg-white rounded-2xl border border-slate-200 shadow-sm';

  if (!cls) return null;

  return (
    <section className={`${card} overflow-hidden`} dir="rtl" aria-label="گزارش آموزشی آزمون جامع">
      <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
        <div>
          <h2 className="text-base font-black text-slate-900">گزارش آموزشی آزمون جامع</h2>
          <p className="text-xs text-slate-500 mt-0.5">تحلیل نمرات آزمون جامع هر کلاس، برترین و ضعیف‌ترین دانش‌آموزان، معدل دروس و کارنامه‌ی هر دانش‌آموز.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">کلاس</span>
            <select value={cls.id} onChange={(e) => { setClassId(e.target.value); setFilters({}); }} className={select}>
              {examClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">آزمون</span>
            <select value={month} onChange={(e) => { setMonth(e.target.value as ExamMonth); setFilters({}); }} className={select}>
              <option value="all">{examMonthLabel('all')}</option>
              {EXAM_MONTHS.map((m) => <option key={m.key} value={m.key}>آزمون {m.monthName}</option>)}
              {monthsWithData.includes('legacy') && <option value="legacy">{examMonthLabel('legacy')}</option>}
            </select>
          </label>
        </div>
      </div>

      {!analysis.hasData ? (
        <div className="py-12 text-center text-sm font-bold text-slate-400">برای این کلاس در «{examMonthLabel(month)}» هنوز نمره‌ای ثبت نشده است.</div>
      ) : (
        <div className="p-4 sm:p-5 space-y-5">
          {/* خلاصه */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4 flex items-center gap-3">
              <Sigma className="w-6 h-6 text-slate-500 shrink-0" />
              <div><div className="text-xs font-bold text-slate-500">معدل کلاس</div><div className={`text-2xl font-black inline-block px-2 rounded-lg ${cellClass(analysis.classAverage)}`}>{fa(analysis.classAverage)}</div></div>
            </div>
            <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-4 flex items-center gap-3">
              <Award className="w-6 h-6 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-emerald-800">دانش‌آموز برتر</div>
                <div className="text-sm font-black text-slate-900 truncate">{analysis.top.map((r) => studentFullName(r.student)).join('، ')}</div>
                <div className="text-xs font-bold text-emerald-700">معدل {fa(analysis.top[0]?.avg)}</div>
              </div>
            </div>
            <div className="rounded-2xl bg-rose-50/70 border border-rose-100 p-4 flex items-center gap-3">
              <TriangleAlert className="w-6 h-6 text-rose-500 shrink-0" />
              <div><div className="text-xs font-bold text-rose-800">دانش‌آموزان ضعیف (معدل زیر {toPersianDigits(EXAM_WEAK_BELOW)})</div><div className="text-2xl font-black text-slate-900">{toPersianDigits(analysis.weak.length)} <span className="text-xs font-bold text-slate-500">نفر</span></div></div>
            </div>
          </div>

          {analysis.weak.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {analysis.weak.map((r) => (
                <button key={r.student.id} type="button" onClick={() => setCardStudent(r.student)} className="px-3 min-h-[36px] rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer">
                  {studentFullName(r.student)} • {fa(r.avg)}
                </button>
              ))}
            </div>
          )}

          {/* جدول دانش‌آموزان */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
              <span className="text-slate-500 ml-1">برای فیلتر، روی عنوان ستون بزنید:</span>
              {(Object.keys(SCORE_BAND_STYLE) as ScoreBand[]).map((b) => (
                <span key={b} className={`px-2.5 py-1 rounded-full border ${SCORE_BAND_STYLE[b].chip}`}>{SCORE_BAND_STYLE[b].label}</span>
              ))}
              {Object.keys(filters).length > 0 && (
                <button type="button" onClick={() => setFilters({})} className="px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 bg-white cursor-pointer">حذف فیلترها</button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-right text-[11px] font-bold text-slate-500 sticky right-0 bg-white z-10 min-w-36">دانش‌آموز</th>
                    {analysis.subjects.map((s) => <ScoreColumnHeader key={s.key} title={s.label} band={filters[s.key]} onCycle={() => cycle(s.key)} />)}
                    <ScoreColumnHeader title="معدل" band={filters.avg} onCycle={() => cycle('avg')} />
                    <th className="px-2 py-2 text-center text-[11px] font-bold text-slate-500">رتبه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((r) => (
                    <tr key={r.student.id}>
                      <td className="px-3 py-2 sticky right-0 bg-white z-10 whitespace-nowrap">
                        <button type="button" onClick={() => onSelectStudent?.(r.student)} className="font-bold text-slate-900 cursor-pointer">{studentFullName(r.student)}</button>
                        <button type="button" onClick={() => setCardStudent(r.student)} aria-label={`کارنامه آزمون جامع ${studentFullName(r.student)}`} title="کارنامه و نمودار رشد" className="mr-2 w-9 h-9 inline-flex items-center justify-center align-middle rounded-xl bg-slate-50 text-emerald-700 hover:bg-emerald-50 cursor-pointer">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setFullStudent(r.student)} aria-label={`کارنامه جامع ${studentFullName(r.student)}`} title="کارنامه جامع (مستمر، آزمون جامع، حضور، تکلیف و کاربرگ)" className="mr-1 w-9 h-9 inline-flex items-center justify-center align-middle rounded-xl bg-slate-50 text-indigo-700 hover:bg-indigo-50 cursor-pointer">
                          <ClipboardList className="w-4 h-4" />
                        </button>
                      </td>
                      {analysis.subjects.map((s) => <td key={s.key} className={`px-2 py-2 text-center font-bold ${cellClass(r.scores[s.key])}`}>{fa(r.scores[s.key])}</td>)}
                      <td className={`px-2 py-2 text-center font-extrabold ${cellClass(r.avg)}`}>{fa(r.avg)}</td>
                      <td className="px-2 py-2 text-center text-xs text-slate-500">{r.rank ? toPersianDigits(r.rank) : '—'}</td>
                    </tr>
                  ))}
                  {visible.length === 0 && <tr><td colSpan={analysis.subjects.length + 3} className="py-8 text-center text-xs text-slate-400">دانش‌آموزی با این فیلترها پیدا نشد.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-extrabold border-t-2 border-slate-200">
                    <td className="px-3 py-2.5 sticky right-0 bg-slate-50 z-10 text-xs text-slate-700">معدل هر درس</td>
                    {analysis.subjects.map((s) => <td key={s.key} className={`px-2 py-2.5 text-center ${cellClass(analysis.subjectAverages[s.key])}`}>{fa(analysis.subjectAverages[s.key])}</td>)}
                    <td className={`px-2 py-2.5 text-center ${cellClass(analysis.classAverage)}`}>{fa(analysis.classAverage)}</td>
                    <td />
                  </tr>
                  <tr className="bg-white text-[11px] font-bold text-slate-600 border-t border-slate-100">
                    <td className="px-3 py-2 sticky right-0 bg-white z-10">پراکندگی (انحراف معیار)</td>
                    {analysis.subjects.map((s) => <td key={s.key} className="px-2 py-2 text-center">{fa(stdDev(analysis.rows.map((r) => r.scores[s.key]).filter((v): v is number => v !== undefined)))}</td>)}
                    <td className="px-2 py-2 text-center">{fa(stdDev(analysis.rows.map((r) => r.avg).filter((v): v is number => v !== undefined)))}</td>
                    <td />
                  </tr>
                  <tr className="bg-white text-[10px] font-bold text-slate-600 border-t border-slate-100">
                    <td className="px-3 py-2 sticky right-0 bg-white z-10">ممتاز • متوسط • ضعیف</td>
                    {[...analysis.subjects.map((s) => analysis.rows.map((r) => r.scores[s.key])), analysis.rows.map((r) => r.avg)].map((col, i) => {
                      const b = bandCounts(col.filter((v): v is number => v !== undefined));
                      return (
                        <td key={i} className="px-1 py-2 text-center whitespace-nowrap">
                          <span className="text-emerald-700">{toPersianDigits(b.excellent)}</span> • <span className="text-amber-700">{toPersianDigits(b.good)}</span> • <span className="text-rose-700">{toPersianDigits(b.weak)}</span>
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* مقایسه‌ی کلاس‌ها */}
      <div className="px-4 sm:px-5 pb-5">
        <h3 className="text-sm font-extrabold text-slate-800 mb-2">مقایسه‌ی کلاس‌ها • {examMonthLabel(month)}</h3>
        <div className="rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] text-slate-500">
              <tr><th className="px-3 py-2 text-right">کلاس</th><th className="px-2 py-2 text-center">معدل</th><th className="px-3 py-2 text-right">دانش‌آموز برتر</th><th className="px-2 py-2 text-center">ضعیف</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {overview.map(({ cls: c, a }) => (
                <tr key={c.id} onClick={() => { setClassId(c.id); setFilters({}); }} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-3 py-2 font-bold text-slate-800 whitespace-nowrap">{c.name}</td>
                  <td className={`px-2 py-2 text-center font-extrabold ${cellClass(a.classAverage)}`}>{fa(a.classAverage)}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">{a.top.length ? a.top.map((r) => studentFullName(r.student)).join('، ') : '—'}</td>
                  <td className="px-2 py-2 text-center text-xs font-bold text-rose-700">{a.hasData ? toPersianDigits(a.weak.length) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {fullStudent && cls && <StudentFullReportModal student={fullStudent} classData={cls} onClose={() => setFullStudent(null)} />}
      {cardStudent && cls && (
        <StudentExamCardModal record={record} classData={cls} classStudents={classStudents} student={cardStudent} initialMonth={month} onClose={() => setCardStudent(null)} />
      )}
    </section>
  );
};
