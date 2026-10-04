import React, { useEffect, useMemo, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { EXAM_SUBJECTS, ExamSubjectKey, ComprehensiveExamRecord } from '../types';
import { toPersianDigits, toEnglishDigits } from '../utils/persianDate';
import { scorePillClass, subjectPillClass } from '../utils/gradePeriods';
import { ArrowRight, Menu, ArrowUp, ArrowDown, ChevronsUpDown, Save, Trophy, TrendingDown, Sigma, Check } from 'lucide-react';

interface ComprehensiveExamManagementProps {
  onBack: () => void;
  onOpenSidebar: () => void;
}

type Draft = Record<string, Partial<Record<ExamSubjectKey, string>>>;
type SortKey = ExamSubjectKey | 'average';

const LEVELS = [
  { id: 'excellent', label: 'عالی', hint: 'بالای ۱۸', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  { id: 'good', label: 'خوب', hint: '۱۵ تا ۱۸', bar: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700' },
  { id: 'medium', label: 'متوسط', hint: '۱۲ تا ۱۵', bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700' },
  { id: 'weak', label: 'نیازمند تلاش', hint: 'زیر ۱۲', bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700' },
] as const;

const levelOf = (avg: number | null) => {
  if (avg === null) return null;
  if (avg > 18) return LEVELS[0];
  if (avg >= 15) return LEVELS[1];
  if (avg >= 12) return LEVELS[2];
  return LEVELS[3];
};

// ورودی را به رشته لاتین با نقطه اعشار تبدیل می‌کند
const normalizeInput = (raw: string) =>
  toEnglishDigits(raw).replace(/[٫/،,]/g, '.').replace(/[^0-9.]/g, '');

const round2 = (n: number) => Math.round(n * 100) / 100;
const fa = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : toPersianDigits(String(round2(n)).replace('.', '٫'));

const parseScore = (v: string | undefined): number | null => {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};
const isInvalid = (v: string | undefined) => {
  if (v === undefined || v === '') return false;
  const n = Number(v);
  return isNaN(n) || n < 0 || n > 20;
};

export const ComprehensiveExamManagement: React.FC<ComprehensiveExamManagementProps> = ({ onBack, onOpenSidebar }) => {
  const { classes, students, comprehensiveExams, saveComprehensiveExam, showToast } = useSchool();

  const [classId, setClassId] = useState<string>(classes[0]?.id || '');
  const [active, setActive] = useState<ExamSubjectKey[]>(EXAM_SUBJECTS.map((s) => s.key));
  const [draft, setDraft] = useState<Draft>({});
  const [dirty, setDirty] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);

  const classStudents = useMemo(
    () =>
      students
        .filter((s) => s.classId === classId)
        .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fa')),
    [students, classId]
  );

  // بارگذاری رکورد ذخیره‌شده هنگام تغییر کلاس
  useEffect(() => {
    const record = comprehensiveExams.find((r) => r.classId === classId);
    setActive(record?.activeSubjects?.length ? record.activeSubjects : EXAM_SUBJECTS.map((s) => s.key));
    const next: Draft = {};
    Object.entries(record?.scores || {}).forEach(([sid, sc]) => {
      next[sid] = {};
      (Object.entries(sc) as [ExamSubjectKey, number][]).forEach(([k, v]) => {
        if (typeof v === 'number') next[sid][k] = String(v);
      });
    });
    setDraft(next);
    setDirty(false);
    setSort(null);
  }, [classId]);

  const changeClass = (id: string) => {
    if (dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) return;
    setClassId(id);
  };

  const activeSubjects = EXAM_SUBJECTS.filter((s) => active.includes(s.key));

  const averageOf = (sid: string): number | null => {
    const vals = activeSubjects
      .map((s) => draft[sid]?.[s.key])
      .filter((v) => !isInvalid(v))
      .map(parseScore)
      .filter((n): n is number => n !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const hasErrors = classStudents.some((st) => EXAM_SUBJECTS.some((s) => isInvalid(draft[st.id]?.[s.key])));

  const toggleSubject = (key: ExamSubjectKey) => {
    setActive((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setSort((s) => (s && s.key === key ? null : s));
    setDirty(true);
  };

  const setScore = (sid: string, key: ExamSubjectKey, raw: string) => {
    setDraft((prev) => ({ ...prev, [sid]: { ...prev[sid], [key]: normalizeInput(raw) } }));
    setDirty(true);
  };

  const toggleSort = (key: SortKey) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'desc' } : s.dir === 'desc' ? { key, dir: 'asc' } : null));

  const rows = useMemo(() => {
    const list = classStudents.map((st) => ({ st, avg: averageOf(st.id) }));
    if (!sort) return list;
    const val = (r: (typeof list)[number]) => (sort.key === 'average' ? r.avg : parseScore(draft[r.st.id]?.[sort.key]));
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // خالی‌ها همیشه آخر
      if (vb === null) return -1;
      return sort.dir === 'asc' ? va - vb : vb - va;
    });
  }, [classStudents, draft, sort, active]);

  // ------------------------- تحلیل -------------------------
  const subjectAverages = EXAM_SUBJECTS.map((s) => {
    const vals = classStudents
      .map((st) => draft[st.id]?.[s.key])
      .filter((v) => !isInvalid(v))
      .map(parseScore)
      .filter((n): n is number => n !== null);
    return { ...s, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, count: vals.length };
  });
  const analysed = subjectAverages.filter((s) => active.includes(s.key) && s.avg !== null);
  const strongest = analysed.length ? analysed.reduce((a, b) => (b.avg! > a.avg! ? b : a)) : null;
  const weakest = analysed.length > 1 ? analysed.reduce((a, b) => (b.avg! < a.avg! ? b : a)) : null;
  const studentAverages = rows.map((r) => r.avg).filter((a): a is number => a !== null);
  const classAverage = studentAverages.length ? studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length : null;
  const distribution = LEVELS.map((lv) => ({ ...lv, count: studentAverages.filter((a) => levelOf(a)?.id === lv.id).length }));

  const handleSave = () => {
    if (hasErrors) {
      showToast('نمرات باید بین ۰ تا ۲۰ باشند.', 'error');
      return;
    }
    const scores: ComprehensiveExamRecord['scores'] = {};
    classStudents.forEach((st) => {
      const entry: Partial<Record<ExamSubjectKey, number>> = {};
      EXAM_SUBJECTS.forEach((s) => {
        const n = parseScore(draft[st.id]?.[s.key]);
        if (n !== null) entry[s.key] = n;
      });
      if (Object.keys(entry).length) scores[st.id] = entry;
    });
    saveComprehensiveExam({ id: `cexam-${classId}`, classId, activeSubjects: active, scores });
    setDirty(false);
    showToast('نمرات آزمون جامع ذخیره شد.', 'success');
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort?.key === k ? (
      sort.dir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
    ) : (
      <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />
    );

  const card = 'bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50';
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="space-y-5" dir="rtl">
      {/* سربرگ */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition cursor-pointer border border-slate-200"
          aria-label="بازگشت"
          title="بازگشت"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-extrabold text-slate-900 flex-1">ثبت نمرات و تحلیل آزمون جامع</h1>
        <button
          onClick={onOpenSidebar}
          className="lg:hidden h-10 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200"
        >
          <Menu className="w-4 h-4" />
          <span>منو</span>
        </button>
      </div>

      {/* کلاس و دروس فعال */}
      <div className={`${card} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <select
            value={classId}
            onChange={(e) => changeClass(e.target.value)}
            aria-label="انتخاب کلاس"
            className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer min-w-48"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleSave}
            disabled={!dirty || hasErrors}
            className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white font-extrabold text-sm rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره نمرات</span>
          </button>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-500 mb-2">دروس آزمون جامع (دروس فعال در جدول و معدل)</div>
          <div className="flex flex-wrap gap-2">
            {EXAM_SUBJECTS.map((s) => {
              const on = active.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSubject(s.key)}
                  aria-pressed={on}
                  className={`h-10 px-4 rounded-full text-sm font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    on ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {on && <Check className="w-4 h-4" />}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* تحلیل */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`${card} p-4 flex items-center gap-3`}>
          <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
            <Sigma className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">معدل کل آزمون جامع کلاس</div>
            <div className="text-2xl font-extrabold text-slate-900 mt-0.5">{fa(classAverage)}</div>
          </div>
        </div>
        <div className={`${card} p-4 flex items-center gap-3`}>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-500">درس قوت</div>
            <div className="text-lg font-extrabold text-slate-900 mt-0.5 truncate">
              {strongest ? strongest.label : '—'}
              {strongest && <span className="text-sm font-bold text-emerald-600 mr-2">{fa(strongest.avg)}</span>}
            </div>
          </div>
        </div>
        <div className={`${card} p-4 flex items-center gap-3`}>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-500">درس نیازمند تقویت</div>
            <div className="text-lg font-extrabold text-slate-900 mt-0.5 truncate">
              {weakest ? weakest.label : '—'}
              {weakest && <span className="text-sm font-bold text-rose-500 mr-2">{fa(weakest.avg)}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className={`${card} p-5`}>
          <h3 className="text-sm font-extrabold text-slate-800 mb-4">توزیع سطوح کلاسی</h3>
          <div className="space-y-3">
            {distribution.map((d) => (
              <div key={d.id} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <div className="text-sm font-bold text-slate-700">{d.label}</div>
                  <div className="text-[11px] text-slate-400">{d.hint}</div>
                </div>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${d.bar} transition-all`} style={{ width: `${(d.count / maxCount) * 100}%` }} />
                </div>
                <span className={`w-14 text-center text-xs font-extrabold rounded-full py-1 ${d.chip}`}>{toPersianDigits(d.count)} نفر</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-5`}>
          <h3 className="text-sm font-extrabold text-slate-800 mb-4">مقایسه میانگین دروس</h3>
          <div className="space-y-3">
            {subjectAverages.map((s) => {
              const on = active.includes(s.key);
              return (
                <div key={s.key} className={`flex items-center gap-3 ${on ? '' : 'opacity-40'}`}>
                  <span className="w-24 shrink-0 text-sm font-bold text-slate-700">{s.label}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${((s.avg ?? 0) / 20) * 100}%` }} />
                  </div>
                  <span className="w-12 text-center text-sm font-extrabold text-slate-800">{fa(s.avg)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* جدول */}
      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-right text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="p-3 w-14 text-center font-bold">ردیف</th>
                <th className="p-3 font-bold min-w-40">نام دانش‌آموز</th>
                {activeSubjects.map((s) => (
                  <th key={s.key} className="p-3 text-center font-bold">
                    <button type="button" onClick={() => toggleSort(s.key)} className={`inline-flex items-center gap-1 cursor-pointer px-3 py-1 rounded-full text-xs whitespace-nowrap ${subjectPillClass(s.label)}`}>
                      {s.label}
                      <SortIcon k={s.key} />
                    </button>
                  </th>
                ))}
                <th className="p-3 text-center font-bold bg-indigo-50/60 border-x border-indigo-200">
                  <button type="button" onClick={() => toggleSort('average')} className="inline-flex items-center gap-1 cursor-pointer text-indigo-900 whitespace-nowrap">
                    معدل آزمون جامع
                    <SortIcon k="average" />
                  </button>
                </th>
                <th className="p-3 text-center font-bold">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={activeSubjects.length + 4} className="p-10 text-center text-slate-400">
                    دانش‌آموزی در این کلاس ثبت نشده است.
                  </td>
                </tr>
              ) : (
                rows.map(({ st, avg }, idx) => {
                  const lv = levelOf(avg);
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center text-xs font-bold text-slate-400">{toPersianDigits(idx + 1)}</td>
                      <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                        {st.firstName} {st.lastName}
                      </td>
                      {activeSubjects.map((s) => {
                        const v = draft[st.id]?.[s.key];
                        const bad = isInvalid(v);
                        return (
                          <td key={s.key} className="p-2 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={toPersianDigits((v ?? '').replace('.', '٫'))}
                              onChange={(e) => setScore(st.id, s.key, e.target.value)}
                              placeholder="—"
                              aria-label={`${s.label} ${st.firstName} ${st.lastName}`}
                              aria-invalid={bad}
                              title={bad ? 'نمره باید بین ۰ تا ۲۰ باشد' : undefined}
                              className={`w-16 text-center rounded-xl py-2 outline-none transition focus:ring-4 focus:ring-emerald-100 ${
                                bad
                                  ? 'bg-rose-50 border border-rose-300 text-rose-700 font-bold'
                                  : scorePillClass(parseScore(v))
                              }`}
                            />
                          </td>
                        );
                      })}
                      <td className="p-3 text-center">
                        <span className={`inline-block font-black text-sm rounded-xl py-1 px-2.5 shadow-2xs whitespace-nowrap ${avg === null ? 'bg-slate-100/70 border border-slate-200/70 text-slate-400' : 'bg-indigo-50/60 border border-indigo-200 text-indigo-950'}`}>{fa(avg)}</span>
                      </td>
                      <td className="p-3 text-center">
                        {lv ? (
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${
                              lv.id === LEVELS[0].id
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : lv.id === LEVELS[3].id
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-blue-100 text-blue-800 border-blue-300'
                            }`}
                          >
                            {lv.id === LEVELS[0].id ? 'ممتاز / رتبه برتر' : lv.id === LEVELS[3].id ? 'نیاز به پیگیری' : 'پذیرفته / عادی'}
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 rounded-full text-xs bg-slate-100/70 border border-slate-200/70 text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {activeSubjects.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-400 border-t border-slate-50">حداقل یک درس را فعال کنید.</div>
        )}
      </div>
    </div>
  );
};
