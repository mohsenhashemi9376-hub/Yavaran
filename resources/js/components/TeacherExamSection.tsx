import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Lock, Save, Trophy, TrendingDown, Users } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { ComprehensiveExamRecord, EXAM_SUBJECTS, ExamSubjectKey, SchoolClass } from '../types';
import { EXAM_MONTHS, EXAM_WEAK_BELOW, examScoresOf, isExamAbsent, mean, round2 } from '../utils/examReport';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { scorePillClass } from '../utils/gradePeriods';
import { studentFullName } from '../utils/studentName';
import { compareByLastName } from '../utils/morningAttendance';

/** واژه‌های نام درس ← کلید درس آزمون جامع (همسان با سرور) */
const KEY_WORDS: Record<ExamSubjectKey, string[]> = {
  persian: ['فارسی', 'ادبیات'],
  math: ['ریاضی'],
  science: ['علوم'],
  arabic: ['عربی'],
  english: ['انگلیسی'],
};
export const examKeyOfSubjectName = (name: string): ExamSubjectKey | null => {
  for (const [key, words] of Object.entries(KEY_WORDS) as [ExamSubjectKey, string[]][]) {
    if (words.some((w) => name.includes(w)) && !(key === 'science' && name.includes('اجتماعی'))) return key;
  }
  return null;
};

export interface TeacherSubjectGroup {
  subjectId: string;
  subjectName: string;
  classes: SchoolClass[];
}

const parseScore = (raw: string): number | null => {
  const t = toEnglishDigits(raw).replace(/[٫/،,]/g, '.').replace(/[^0-9.]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isNaN(n) ? NaN : n;
};
const fa = (n?: number | null) => (n === undefined || n === null ? '—' : toPersianDigits(String(round2(n)).replace('.', '٫')));

const LEVELS = [
  { label: 'عالی (بالای ۱۸)', min: 18.0001, bar: 'bg-emerald-500' },
  { label: 'خوب (۱۵ تا ۱۸)', min: 15, bar: 'bg-sky-500' },
  { label: 'متوسط (۱۲ تا ۱۵)', min: 12, bar: 'bg-amber-400' },
  { label: 'نیازمند تلاش (زیر ۱۲)', min: -1, bar: 'bg-rose-500' },
];

interface Props {
  groups: TeacherSubjectGroup[];
}

/**
 * آزمون جامع در پنل دبیران فارسی، ریاضی، علوم، عربی و انگلیسی:
 * دبیر فقط نمره‌ی درس خودش را (وقتی معاونت آموزش ثبت نمره‌ی آن ماه را باز کرده) وارد می‌کند و فقط تحلیل همان درس را می‌بیند.
 */
export const TeacherExamSection: React.FC<Props> = ({ groups }) => {
  const { students, comprehensiveExams, saveComprehensiveExam, isGradePeriodOpen, showToast } = useSchool();

  const options = useMemo(
    () =>
      groups.flatMap((g) => {
        const key = examKeyOfSubjectName(g.subjectName);
        return key ? g.classes.filter((c) => !c.isWorkshop).map((c) => ({ key, classId: c.id, className: c.name, subjectId: g.subjectId, subjectName: g.subjectName })) : [];
      }),
    [groups]
  );

  const [optIndex, setOptIndex] = useState(0);
  const [month, setMonth] = useState<(typeof EXAM_MONTHS)[number]['key']>(EXAM_MONTHS[0].key);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const opt = options[Math.min(optIndex, Math.max(0, options.length - 1))];
  const record: ComprehensiveExamRecord | undefined = useMemo(() => comprehensiveExams.find((r) => r.classId === opt?.classId), [comprehensiveExams, opt?.classId]);
  const classStudents = useMemo(() => (opt ? students.filter((s) => s.classId === opt.classId).slice().sort(compareByLastName) : []), [students, opt?.classId]);

  const open = Boolean(opt) && isGradePeriodOpen(month, opt.subjectId);
  const monthActive = !opt || (record?.monthlyActive?.[month] ?? record?.activeSubjects ?? [opt.key]).includes(opt.key) || !record;
  const canEdit = open && monthActive;

  useEffect(() => {
    if (!opt) return;
    const next: Record<string, string> = {};
    const scores = examScoresOf(record, month);
    classStudents.forEach((s) => {
      const v = scores[s.id]?.[opt.key];
      if (typeof v === 'number') next[s.id] = String(v);
    });
    setDraft(next);
    setDirty(false);
  }, [opt?.classId, opt?.key, month, record?.updatedAt, classStudents.length]);

  if (options.length === 0) {
    return <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-sm text-slate-500">آزمون جامع برای دروس شما تعریف نشده است.</div>;
  }

  const subjectLabel = EXAM_SUBJECTS.find((s) => s.key === opt.key)?.label || opt.subjectName;
  const invalid = (id: string) => {
    const n = parseScore(draft[id] ?? '');
    return n !== null && (Number.isNaN(n) || n < 0 || n > 20);
  };
  const hasErrors = classStudents.some((s) => invalid(s.id));

  const save = () => {
    if (!canEdit || hasErrors) return;
    const cells: Record<string, Partial<Record<ExamSubjectKey, number>>> = {};
    const prevMonth = record?.monthly?.[month] || {};
    classStudents.forEach((s) => {
      const base = { ...(prevMonth[s.id] || {}) };
      if (isExamAbsent(record, s.id, month)) return; // غیبت ثبت شده؛ نمره بسته است
      const n = parseScore(draft[s.id] ?? '');
      if (n === null) delete base[opt.key];
      else base[opt.key] = n as number;
      if (Object.keys(base).length) cells[s.id] = base;
    });
    saveComprehensiveExam({
      ...(record || { id: `cexam-${opt.classId}`, classId: opt.classId, activeSubjects: [opt.key], scores: {} }),
      monthly: { ...(record?.monthly || {}), [month]: cells },
    });
    setDirty(false);
    showToast(`نمره‌ی آزمون جامع ${subjectLabel} ثبت شد.`, 'success');
  };

  // تحلیل فقط برای درس خودِ دبیر
  const values = classStudents.map((s) => parseScore(draft[s.id] ?? '')).filter((n): n is number => n !== null && !Number.isNaN(n));
  const avg = mean(values);
  const levelCounts = LEVELS.map((l, i) => values.filter((v) => v >= l.min && (i === 0 || v < LEVELS[i - 1].min)).length);
  const weakList = classStudents.filter((s) => { const n = parseScore(draft[s.id] ?? ''); return n !== null && !Number.isNaN(n) && n < EXAM_WEAK_BELOW; });
  const trend = EXAM_MONTHS.map((m) => {
    const vs = Object.values(examScoresOf(record, m.key)).map((c) => c[opt.key]).filter((v): v is number => typeof v === 'number');
    return { key: m.key, label: m.monthName.replace('مستمر ', ''), avg: mean(vs), n: vs.length };
  });
  const trendMax = Math.max(20, ...trend.map((t) => t.avg ?? 0));
  const best = values.length ? Math.max(...values) : undefined;
  const worst = values.length ? Math.min(...values) : undefined;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><BarChart3 className="w-5 h-5" /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-black text-slate-900">آزمون جامع — {subjectLabel}</h2>
            <p className="text-[11px] text-slate-500">فقط نمره و تحلیل درس شما نمایش داده می‌شود.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={optIndex} onChange={(e) => { if (dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) return; setOptIndex(Number(e.target.value)); }} aria-label="کلاس" className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none cursor-pointer">
            {options.map((o, i) => <option key={`${o.classId}-${o.key}`} value={i}>{o.className} — {o.subjectName}</option>)}
          </select>
          <select value={month} onChange={(e) => { if (dirty && !window.confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) return; setMonth(e.target.value as typeof month); }} aria-label="ماه" className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none cursor-pointer">
            {EXAM_MONTHS.map((m) => <option key={m.key} value={m.key}>{m.monthName.replace('مستمر ', '')}{isGradePeriodOpen(m.key, opt.subjectId) ? ' 🟢' : ''}</option>)}
          </select>
        </div>
        {!canEdit && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs font-bold text-amber-900">
            <Lock className="w-4 h-4 shrink-0" />
            {open ? 'درس شما برای آزمون جامع این ماه فعال نشده است.' : 'ثبت نمره‌ی این ماه هنوز توسط معاونت آموزش باز نشده است؛ فقط مشاهده می‌کنید.'}
          </div>
        )}
      </div>

      {/* تحلیل درس خود دبیر */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[
          { label: 'میانگین کلاس', value: fa(avg), icon: Users, tone: 'text-emerald-700' },
          { label: 'بالاترین نمره', value: fa(best), icon: Trophy, tone: 'text-amber-600' },
          { label: 'پایین‌ترین نمره', value: fa(worst), icon: TrendingDown, tone: 'text-rose-600' },
          { label: 'نمره‌ی ثبت‌شده', value: `${toPersianDigits(values.length)} از ${toPersianDigits(classStudents.length)}`, icon: BarChart3, tone: 'text-sky-700' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500"><Icon className={`w-4 h-4 ${tone}`} />{label}</div>
            <div className={`mt-1 text-xl font-black tabular-nums ${tone}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2.5">
          <h3 className="text-xs font-black text-slate-800">توزیع نمرات</h3>
          {LEVELS.map((l, i) => (
            <div key={l.label} className="flex items-center gap-2 text-[11px]">
              <span className="w-32 shrink-0 font-bold text-slate-600">{l.label}</span>
              <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${l.bar}`} style={{ width: `${values.length ? (levelCounts[i] / values.length) * 100 : 0}%` }} /></div>
              <span className="w-6 text-left font-black text-slate-800 tabular-nums">{toPersianDigits(levelCounts[i])}</span>
            </div>
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <h3 className="text-xs font-black text-slate-800 mb-2">روند میانگین در ماه‌های آزمون</h3>
          <div className="flex items-end justify-around gap-1.5 h-28" role="img" aria-label="روند میانگین آزمون جامع">
            {trend.map((t) => (
              <div key={t.key} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-600 tabular-nums">{t.avg === undefined ? '' : fa(t.avg)}</span>
                <div className="w-full max-w-[1.75rem] rounded-t-lg bg-emerald-500/80" style={{ height: `${t.avg === undefined ? 4 : Math.max(6, (t.avg / trendMax) * 76)}px`, opacity: t.avg === undefined ? 0.2 : 1 }} />
                <span className="text-[10px] text-slate-500 whitespace-nowrap">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {weakList.length > 0 && (
        <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-3 text-xs">
          <div className="font-black text-rose-800 mb-1.5">نیازمند تلاش (نمره‌ی زیر {toPersianDigits(EXAM_WEAK_BELOW)}):</div>
          <div className="flex flex-wrap gap-1.5">{weakList.map((s) => <span key={s.id} className="px-2 py-1 rounded-lg bg-white border border-rose-200 font-bold text-rose-800">{studentFullName(s)}</span>)}</div>
        </div>
      )}

      {/* ورود نمره */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-xs font-black text-slate-800">ورود نمره‌ی {subjectLabel} ({toPersianDigits(classStudents.length)} دانش‌آموز)</div>
        <ul className="divide-y divide-slate-100">
          {classStudents.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-3 px-4 py-2 ${isExamAbsent(record, s.id, month) ? 'bg-slate-50' : ''}`}>
              <span className="w-6 text-center text-[11px] font-bold text-slate-400">{toPersianDigits(i + 1)}</span>
              <span className="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{studentFullName(s)}</span>
              {typeof parseScore(draft[s.id] ?? '') === 'number' && !invalid(s.id) && <span className={`hidden sm:inline px-2 py-0.5 rounded-lg text-[11px] ${scorePillClass(parseScore(draft[s.id] ?? '') as number)}`}>{fa(parseScore(draft[s.id] ?? '') as number)}</span>}
              {isExamAbsent(record, s.id, month) && <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 text-[11px] font-extrabold">غایب</span>}
              <input
                value={toPersianDigits(draft[s.id] ?? '')}
                onChange={(e) => { setDraft((p) => ({ ...p, [s.id]: toEnglishDigits(e.target.value).replace(/[٫/،,]/g, '.').replace(/[^0-9.]/g, '') })); setDirty(true); }}
                disabled={!canEdit || isExamAbsent(record, s.id, month)}
                inputMode="decimal"
                dir="ltr"
                aria-label={`نمره ${studentFullName(s)}`}
                placeholder="—"
                className={`w-20 h-11 text-center font-bold text-sm rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${invalid(s.id) ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}
              />
            </li>
          ))}
          {classStudents.length === 0 && <li className="py-8 text-center text-xs text-slate-400">دانش‌آموزی در این کلاس نیست.</li>}
        </ul>
      </div>

      {canEdit && (
        <div className="sticky bottom-20 md:bottom-4 z-20">
          <button type="button" onClick={save} disabled={!dirty || hasErrors} className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-extrabold shadow-lg inline-flex items-center justify-center gap-2 cursor-pointer">
            <Save className="w-4 h-4" /> {hasErrors ? 'نمره باید بین ۰ تا ۲۰ باشد' : 'ذخیره‌ی نمرات آزمون جامع'}
          </button>
        </div>
      )}
    </div>
  );
};
