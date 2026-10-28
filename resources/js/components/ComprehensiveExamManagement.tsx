import React, { useEffect, useMemo, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { EXAM_SUBJECTS, ExamSubjectKey, ComprehensiveExamRecord } from '../types';
import { toPersianDigits, toEnglishDigits } from '../utils/persianDate';
import { subjectPillClass } from '../utils/gradePeriods';
import { ArrowRight, Menu, ArrowUp, ArrowDown, ChevronsUpDown, Save, Trophy, TrendingDown, Sigma, Check } from 'lucide-react';
import { studentFullName, compareStudents } from '../utils/studentName';
import { FitTable } from './ui/FitTable';
import { activeExamSubjects, defaultExamMonth, EXAM_MONTHS, ExamMonth, examMonthsWithData, examScoresOf, examMonthLabel, isExamAbsent, examMaxOf, examNormalize, EXAM_DEFAULT_MAX, EXAM_EXCELLENT_FROM, EXAM_WEAK_BELOW } from '../utils/examReport';

interface ComprehensiveExamManagementProps {
  onBack: () => void;
  onOpenSidebar: () => void;
}

/** رنگ‌بندی نمره: ۱۶ به بالا سبز، ۱۰ تا کمتر از ۱۶ زرد، زیر ۱۰ قرمز، بدون نمره خاکستری کم‌رنگ */
const examScoreClass = (score: number | null | undefined): string => {
  if (score === null || score === undefined || Number.isNaN(score)) return 'bg-slate-100/70 border border-slate-200/70 text-slate-400';
  if (score >= 16) return 'bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold';
  if (score >= 10) return 'bg-amber-100 border border-amber-200 text-amber-700 font-bold';
  return 'bg-rose-100 border border-rose-200 text-rose-700 font-bold';
};

type Draft = Record<string, Partial<Record<ExamSubjectKey, string>>>;
type SortKey = ExamSubjectKey | 'average';

/** سطح‌بندی درصدی: میانگین روی مقیاس ۲۰ است، پس ۸۰٪ = ۱۶ و ۵۰٪ = ۱۰ */
const LEVELS = [
  { id: 'excellent', label: 'ممتاز', hint: '۸۰٪ و بالاتر', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  { id: 'medium', label: 'متوسط', hint: '۵۰٪ تا کمتر از ۸۰٪', bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-700' },
  { id: 'weak', label: 'نیازمند تلاش', hint: 'زیر ۵۰٪', bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700' },
] as const;

const levelOf = (avg: number | null) => {
  if (avg === null) return null;
  if (avg >= EXAM_EXCELLENT_FROM) return LEVELS[0];
  if (avg >= EXAM_WEAK_BELOW) return LEVELS[1];
  return LEVELS[2];
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
const isInvalid = (v: string | undefined, max: number = EXAM_DEFAULT_MAX) => {
  if (v === undefined || v === '') return false;
  const n = Number(v);
  return isNaN(n) || n < 0 || n > max;
};
/** بارم باید عددی مثبت و حداکثر ۱۰۰ باشد */
const isInvalidMax = (v: string | undefined) => {
  const n = Number(v);
  return v === undefined || v === '' || isNaN(n) || n <= 0 || n > 100;
};

export const ComprehensiveExamManagement: React.FC<ComprehensiveExamManagementProps> = ({ onBack, onOpenSidebar }) => {
  const { classes, students, comprehensiveExams, saveComprehensiveExam, showToast, showConfirm, currentUser } = useSchool();
  /** ثبت غیبت آزمون جامع فقط با معاون آموزش (و مدیر سامانه) */
  const canMarkAbsent = currentUser.role === 'vice_educational' || currentUser.role === 'admin';

  const [classId, setClassId] = useState<string>(classes[0]?.id || '');
  /** ماه آزمونی که در حال ثبت است؛ «legacy» = نمرات قدیمی بدون ماه */
  const [month, setMonth] = useState<Exclude<ExamMonth, 'all'>>(() => defaultExamMonth(comprehensiveExams.find((r) => r.classId === (classes[0]?.id || ''))));
  const [active, setActive] = useState<ExamSubjectKey[]>(EXAM_SUBJECTS.map((s) => s.key));
  const [draft, setDraft] = useState<Draft>({});
  const [absent, setAbsent] = useState<Record<string, boolean>>({});
  /** بارم هر درس در ماه جاری (رشته‌ی ورودی)؛ پیش‌فرض ۲۰ */
  const [maxes, setMaxes] = useState<Partial<Record<ExamSubjectKey, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);

  const classStudents = useMemo(
    () =>
      students
        .filter((s) => s.classId === classId)
        .sort(compareStudents),
    [students, classId]
  );

  // بارگذاری رکورد ذخیره‌شده هنگام تغییر کلاس
  useEffect(() => {
    const record = comprehensiveExams.find((r) => r.classId === classId);
    setActive(activeExamSubjects(record, month).map((s) => s.key));
    const next: Draft = {};
    Object.entries(examScoresOf(record, month)).forEach(([sid, sc]) => {
      next[sid] = {};
      (Object.entries(sc) as [ExamSubjectKey, number][]).forEach(([k, v]) => {
        if (typeof v === 'number') next[sid][k] = String(v);
      });
    });
    setDraft(next);
    setMaxes(Object.fromEntries(EXAM_SUBJECTS.map((s) => [s.key, String(examMaxOf(record, month, s.key))])));
    setAbsent(month === 'legacy' ? {} : { ...(record?.monthlyAbsent?.[month] || {}) });
    setDirty(false);
    setSort(null);
  }, [classId, month]);

  const confirmDiscard = (then: () => void) => {
    if (!dirty) return then();
    showConfirm({
      title: 'تغییرات ذخیره‌نشده',
      message: 'تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟',
      confirmLabel: 'بله، ادامه',
      cancelLabel: 'ماندن در صفحه',
      isDangerous: true,
      onConfirm: then,
    });
  };

  const changeMonth = (m: Exclude<ExamMonth, 'all'>) => confirmDiscard(() => setMonth(m));

  const changeClass = (id: string) =>
    confirmDiscard(() => {
      setClassId(id);
      setMonth(defaultExamMonth(comprehensiveExams.find((r) => r.classId === id)));
    });

  const activeSubjects = EXAM_SUBJECTS.filter((s) => active.includes(s.key));

  /** بارم عددی هر درس (در صورت ورودی نامعتبر، ۲۰) */
  const maxOf = (key: ExamSubjectKey): number => (isInvalidMax(maxes[key]) ? EXAM_DEFAULT_MAX : Number(maxes[key]));
  /** نمره‌ی خام را به مقیاس ۲۰ می‌برد (برای معدل و رنگ‌بندی) */
  const scaled = (key: ExamSubjectKey, n: number | null) => (n === null ? null : examNormalize(n, maxOf(key)));
  const hasMaxErrors = EXAM_SUBJECTS.some((s) => isInvalidMax(maxes[s.key]));

  const averageOf = (sid: string): number | null => {
    if (absent[sid]) return null;
    const vals = activeSubjects
      .map((s) => {
        const v = draft[sid]?.[s.key];
        return isInvalid(v, maxOf(s.key)) ? null : scaled(s.key, parseScore(v));
      })
      .filter((n): n is number => n !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const hasErrors = hasMaxErrors || classStudents.some((st) => EXAM_SUBJECTS.some((s) => isInvalid(draft[st.id]?.[s.key], maxOf(s.key))));

  const changeMax = (key: ExamSubjectKey, raw: string) => {
    setMaxes((prev) => ({ ...prev, [key]: normalizeInput(raw) }));
    setDirty(true);
  };

  const toggleSubject = (key: ExamSubjectKey) => {
    setActive((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setSort((s) => (s && s.key === key ? null : s));
    setDirty(true);
  };

  /** ثبت یا لغو غیبت: با ثبت غیبت، نمره‌ی این ماه پاک و ورود نمره بسته می‌شود */
  const toggleAbsent = (sid: string) => {
    if (!canMarkAbsent || month === 'legacy') return;
    setAbsent((prev) => ({ ...prev, [sid]: !prev[sid] }));
    setDraft((prev) => (absent[sid] ? prev : { ...prev, [sid]: {} }));
    setDirty(true);
  };

  const setScore = (sid: string, key: ExamSubjectKey, raw: string) => {
    if (absent[sid]) return;
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
      .filter((st) => !absent[st.id])
      .map((st) => draft[st.id]?.[s.key])
      .filter((v) => !isInvalid(v, maxOf(s.key)))
      .map((v) => scaled(s.key, parseScore(v)))
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
      showToast(hasMaxErrors ? 'بارم هر درس باید عددی بین ۱ تا ۱۰۰ باشد.' : 'نمرات باید بین ۰ و بارم هر درس باشند.', 'error');
      return;
    }
    const scores: ComprehensiveExamRecord['scores'] = {};
    classStudents.forEach((st) => {
      if (absent[st.id]) return;
      const entry: Partial<Record<ExamSubjectKey, number>> = {};
      EXAM_SUBJECTS.forEach((s) => {
        const n = parseScore(draft[st.id]?.[s.key]);
        if (n !== null) entry[s.key] = n;
      });
      if (Object.keys(entry).length) scores[st.id] = entry;
    });
    const base = comprehensiveExams.find((r) => r.classId === classId);
    saveComprehensiveExam({
      id: `cexam-${classId}`,
      classId,
      activeSubjects: month === 'legacy' ? active : base?.activeSubjects?.length ? base.activeSubjects : active,
      monthlyActive: month === 'legacy' ? base?.monthlyActive : { ...base?.monthlyActive, [month]: active },
      scores: month === 'legacy' ? scores : base?.scores || {},
      monthly: month === 'legacy' ? base?.monthly : { ...base?.monthly, [month]: scores },
      monthlyMax: month === 'legacy' ? base?.monthlyMax : { ...base?.monthlyMax, [month]: Object.fromEntries(EXAM_SUBJECTS.map((s) => [s.key, maxOf(s.key)])) },
      monthlyAbsent: month === 'legacy' ? base?.monthlyAbsent : { ...base?.monthlyAbsent, [month]: Object.fromEntries(Object.entries(absent).filter(([, v]) => v)) },
    });
    setDirty(false);
    showToast(`نمرات آزمون جامع ${examMonthLabel(month)} ذخیره شد.`, 'success');
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
          <div className="text-xs font-bold text-slate-500 mb-2">ماه آزمون (هر ماه جداگانه تعریف و ثبت می‌شود)</div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="ماه آزمون جامع">
            {EXAM_MONTHS.map((m) => {
              const has = examMonthsWithData(comprehensiveExams.find((r) => r.classId === classId)).includes(m.key);
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={month === m.key}
                  onClick={() => changeMonth(m.key)}
                  className={`h-11 min-w-[4.5rem] px-4 rounded-2xl text-sm font-extrabold border transition cursor-pointer inline-flex items-center justify-center gap-1 ${
                    month === m.key ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m.monthName}
                  {has && <Check className="w-3.5 h-3.5" />}
                </button>
              );
            })}
            {examMonthsWithData(comprehensiveExams.find((r) => r.classId === classId)).includes('legacy') && (
              <button
                type="button"
                role="tab"
                aria-selected={month === 'legacy'}
                onClick={() => changeMonth('legacy')}
                className={`h-11 px-4 rounded-2xl text-xs font-bold border cursor-pointer ${month === 'legacy' ? 'bg-slate-700 text-white border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
              >
                {examMonthLabel('legacy')}
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold text-slate-500 mb-2">دروس آزمون {examMonthLabel(month)} (دروس فعال در جدول و معدل همین ماه)</div>
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
        <FitTable className="" fullView="table" title="نمرات آزمون جامع">
          <table className="w-full min-w-[920px] text-right text-sm">
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
                    {month !== 'legacy' && (
                      <label className="mt-1.5 flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500">
                        از
                        <input
                          type="text"
                          inputMode="decimal"
                          dir="ltr"
                          value={toPersianDigits((maxes[s.key] ?? '').replace('.', '٫'))}
                          onChange={(e) => changeMax(s.key, e.target.value)}
                          aria-label={`بارم ${s.label}`}
                          aria-invalid={isInvalidMax(maxes[s.key])}
                          title="بارم (نمره‌ی کل) این درس"
                          className={`w-12 h-8 text-center rounded-lg outline-none border focus:ring-4 focus:ring-emerald-100 ${isInvalidMax(maxes[s.key]) ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-white border-slate-200 text-slate-800'}`}
                        />
                      </label>
                    )}
                  </th>
                ))}
                <th className="p-3 text-center font-bold bg-indigo-50/60 border-x border-indigo-200">
                  <button type="button" onClick={() => toggleSort('average')} className="inline-flex items-center gap-1 cursor-pointer text-indigo-900 whitespace-nowrap">
                    معدل آزمون جامع
                    <SortIcon k="average" />
                  </button>
                </th>
                <th className="p-3 text-center font-bold">وضعیت</th>
                {month !== 'legacy' && <th className="p-3 text-center font-bold">غیبت</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={activeSubjects.length + 5} className="p-10 text-center text-slate-400">
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
                        {studentFullName(st)}
                      </td>
                      {activeSubjects.map((s) => {
                        const v = draft[st.id]?.[s.key];
                        const bad = isInvalid(v, maxOf(s.key));
                        return (
                          <td key={s.key} className="p-2 text-center">
                            <input
                              type="text"
                              disabled={Boolean(absent[st.id])}
                              inputMode="decimal"
                              value={toPersianDigits((v ?? '').replace('.', '٫'))}
                              onChange={(e) => setScore(st.id, s.key, e.target.value)}
                              placeholder="—"
                              aria-label={`${s.label} ${studentFullName(st)}`}
                              aria-invalid={bad}
                              title={bad ? `نمره باید بین ۰ تا ${toPersianDigits(maxOf(s.key))} باشد` : undefined}
                              className={`w-16 text-center rounded-xl py-2 outline-none transition focus:ring-4 focus:ring-emerald-100 ${
                                bad
                                  ? 'bg-rose-50 border border-rose-300 text-rose-700 font-bold'
                                  : examScoreClass(scaled(s.key, parseScore(v)))
                              }`}
                            />
                          </td>
                        );
                      })}
                      <td className="p-3 text-center">
                        <span className={`inline-block font-black text-sm rounded-xl py-1 px-2.5 shadow-2xs whitespace-nowrap tabular-nums ${examScoreClass(avg)}`}>{fa(avg)}</span>
                      </td>
                      <td className="p-3 text-center">
                        {absent[st.id] ? (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap bg-rose-100 text-rose-800 border-rose-300">غایب در آزمون</span>
                        ) : lv ? (
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${
                              lv.id === LEVELS[0].id
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : lv.id === LEVELS[2].id
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-blue-100 text-blue-800 border-blue-300'
                            }`}
                          >
                            {lv.id === LEVELS[0].id ? 'ممتاز / رتبه برتر' : lv.id === LEVELS[2].id ? 'نیاز به پیگیری' : 'پذیرفته / عادی'}
                          </span>
                        ) : (
                          <span className="inline-block px-3 py-1 rounded-full text-xs bg-slate-100/70 border border-slate-200/70 text-slate-400">—</span>
                        )}
                      </td>
                      {month !== 'legacy' && (
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleAbsent(st.id)}
                            disabled={!canMarkAbsent}
                            aria-pressed={Boolean(absent[st.id])}
                            title={canMarkAbsent ? undefined : 'ثبت غیبت فقط با معاون آموزش است'}
                            className={`h-10 px-3 rounded-xl text-xs font-extrabold border transition whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                              absent[st.id] ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700'
                            }`}
                          >
                            {absent[st.id] ? 'لغو غیبت' : 'ثبت غیبت'}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </FitTable>
        {activeSubjects.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-400 border-t border-slate-50">حداقل یک درس را فعال کنید.</div>
        )}
      </div>
    </div>
  );
};
