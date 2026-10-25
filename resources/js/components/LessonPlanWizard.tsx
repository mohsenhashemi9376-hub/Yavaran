import React, { useMemo, useRef, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { suggestForStep, SuggestPhase } from '../utils/lessonSuggest';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Dices, Lightbulb, Plus, Save, Send, X } from 'lucide-react';
import { LessonPlan, SchoolClass } from '../types';
import { GUIDE_SUBJECTS, TeachingMethod } from '../utils/teachingMethods';
import { METHOD_GUIDE, TECHNIQUE_GUIDE } from '../utils/teachingGuide';
import { BLOOM_VERBS, CLASS_MINUTES, DIFFERENTIATION, HOOK_IDEAS, REFLECTION_CHALLENGES, METHOD_CRITERIA, TOOL_OPTIONS, newScenarioStep, totalMinutes } from '../utils/lessonPlan';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { ShamsiDatePicker } from './ShamsiDatePicker';

const STEPS = ['مشخصات', 'اهداف و روش‌ها', 'سناریو', 'ارزیابی و تجربه‌نگاری'];

const input = 'w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500';
const area = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 resize-none leading-6';

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="block space-y-1">
    <span className="text-xs font-bold text-slate-700">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
  </label>
);

/** چیپ‌های هوشمند چندانتخابی (Array Toggle) با امکان افزودن گزینه‌ی دلخواه */
const TagPicker: React.FC<{ label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }> = ({ label, options, value, onChange }) => {
  const [custom, setCustom] = useState('');
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  const add = () => {
    const t = custom.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom('');
  };
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-slate-700">{label}</div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {all.map((t) => {
          const on = value.includes(t);
          return (
            <button key={t} type="button" aria-pressed={on} onClick={() => toggle(t)}
              className={`min-h-10 px-3 rounded-full border text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {on && <Check className="w-3.5 h-3.5" />}{t}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="گزینه‌ی دیگر…" className={`${input} h-10 text-xs`} />
        <button type="button" onClick={add} className="h-10 px-3 shrink-0 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer">افزودن</button>
      </div>
    </div>
  );
};

/**
 * دستیار هوشمند چندانتخابی برای «روش‌های تدریس» و «تکنیک‌های تدریس»: هر مورد یک چیپ است؛ با لمس چیپ یا آیکون [؟]
 * پنل راهنما (توضیح کوتاه و ۵ مثال برای علوم، فارسی، ریاضی، عربی و زبان انگلیسی) زیر چیپ‌ها باز یا به‌روز می‌شود.
 */
const GuidePicker: React.FC<{
  title: string;
  intro: string;
  guideData: Record<string, TeachingMethod>;
  value: string[];
  onChange: (v: string[]) => void;
  customPlaceholder: string;
}> = ({ title, intro, guideData, value, onChange, customPlaceholder }) => {
  const [guide, setGuide] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [adding, setAdding] = useState(false);
  const extra = value.filter((v) => !guideData[v]);
  const info = guide ? guideData[guide] : null;

  const toggle = (name: string) => {
    if (value.includes(name)) {
      onChange(value.filter((x) => x !== name));
      if (guide === name) setGuide(null);
    } else onChange([...value, name]);
  };
  const addCustom = () => {
    const t = custom.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom('');
    setAdding(false);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-black text-slate-900">{title}</div>
        <span className="text-[11px] font-bold text-emerald-700">{toPersianDigits(value.length)} انتخاب</span>
      </div>
      <p className="rounded-xl bg-emerald-50/70 border border-emerald-100 px-3 py-2 text-[11px] leading-6 text-emerald-900">💡 {intro}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={title}>
        {[...Object.keys(guideData), ...extra].map((name) => {
          const on = value.includes(name);
          const hasGuide = Boolean(guideData[name]);
          const focused = guide === name;
          return (
            <span key={name} className={`inline-flex items-center rounded-full border text-xs font-bold transition ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'} ${focused ? 'ring-2 ring-emerald-300 ring-offset-1' : ''}`}>
              <button type="button" aria-pressed={on} onClick={() => toggle(name)} className="!min-h-0 h-10 pr-3 pl-1.5 inline-flex items-center gap-1 cursor-pointer">
                {on && <Check className="w-3.5 h-3.5" />}{name}
              </button>
              {hasGuide && (
                <button type="button" onClick={() => setGuide(focused ? null : name)} aria-label={`راهنمای ${name}`} aria-expanded={focused}
                  className={`!min-h-0 h-10 w-8 grid place-items-center rounded-l-full text-[13px] font-black cursor-pointer ${on ? 'text-white/90 hover:bg-emerald-700' : 'text-emerald-700 hover:bg-emerald-50'}`}>؟</button>
              )}
              {!hasGuide && <span className="w-1.5" />}
            </span>
          );
        })}
        <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className="!min-h-0 h-10 px-3 rounded-full border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">➕ سایر موارد</button>
      </div>
      {adding && (
        <div className="flex items-center gap-2">
          <input autoFocus value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} placeholder={customPlaceholder} className={`${input} h-10 text-xs`} />
          <button type="button" onClick={addCustom} className="h-10 px-3 shrink-0 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer">افزودن</button>
        </div>
      )}
      {info && guide && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2.5 animate-in fade-in" aria-live="polite">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-emerald-900">راهنمای «{guide}»</div>
              <p className="text-xs text-slate-700 leading-6 mt-0.5">{info.summary}</p>
            </div>
            <button type="button" onClick={() => setGuide(null)} aria-label="بستن راهنما" className="w-9 h-9 shrink-0 rounded-lg text-slate-400 hover:bg-white cursor-pointer"><X className="w-4 h-4 mx-auto" /></button>
          </div>
          <ul className="space-y-1.5">
            {GUIDE_SUBJECTS.map((s) => (
              <li key={s.key} className="flex gap-2 rounded-xl bg-white border border-emerald-100 p-2.5 text-xs leading-6">
                <span className="shrink-0 h-6 px-2 rounded-lg bg-emerald-600 text-white text-[11px] font-bold inline-flex items-center">{s.label}</span>
                <span className="text-slate-800">{info.examples[s.key]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/** فهرست پویای اهداف + دستیار هرم بلوم (با لمس هر فعل، به همان ردیف اضافه می‌شود) */
const ObjectiveList: React.FC<{ label: string; tone: string; verbs: string[]; value: string[]; onChange: (v: string[]) => void }> = ({ label, tone, verbs, value, onChange }) => {
  const [focus, setFocus] = useState(value.length - 1);
  const addVerb = (verb: string) => {
    const i = Math.min(Math.max(focus, 0), value.length - 1);
    const cur = value[i] || '';
    if (cur.includes(verb)) return;
    onChange(value.map((x, n) => (n === i ? (cur.trim() ? `${cur.trim()} ${verb}` : verb) : x)));
  };
  return (
    <div className={`rounded-2xl border p-3 space-y-2 ${tone}`}>
      <div className="text-xs font-black text-slate-800">{label}</div>
      {value.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={v} onFocus={() => setFocus(i)} onChange={(e) => onChange(value.map((x, n) => (n === i ? e.target.value : x)))} placeholder="مثلاً: متربی بتواند … را توضیح دهد" className={`${input} bg-white ${focus === i ? 'ring-2 ring-emerald-300' : ''}`} />
          {value.length > 1 && <button type="button" onClick={() => { onChange(value.filter((_, n) => n !== i)); setFocus(0); }} aria-label="حذف هدف" className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 cursor-pointer"><X className="w-4 h-4 mx-auto" /></button>}
        </div>
      ))}
      <div>
        <div className="text-[10px] font-bold text-slate-500 mb-1">فعل‌های پیشنهادی (لمس کنید تا به هدف انتخاب‌شده اضافه شود):</div>
        <div className="flex flex-wrap gap-1.5">
          {verbs.map((verb) => (
            <button key={verb} type="button" onClick={() => addVerb(verb)} className="min-h-9 px-2.5 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-700 cursor-pointer">+ {verb}</button>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => { onChange([...value, '']); setFocus(value.length); }} className="h-9 px-3 rounded-lg border border-dashed border-slate-300 text-[11px] font-bold text-slate-600 inline-flex items-center gap-1 cursor-pointer"><Plus className="w-3.5 h-3.5" /> افزودن هدف</button>
    </div>
  );
};

interface Props {
  initial: LessonPlan;
  classes: SchoolClass[];
  /** نام درس‌های دبیر برای انتخاب سریع */
  subjectNames: string[];
  studentCountOf: (classId: string) => number;
  onSave: (plan: LessonPlan) => void;
  onClose: () => void;
}

/** ویزارد ۴ مرحله‌ای طرح درس روزانه (موبایل‌فرست، تم زمردی دبیر) */
export const LessonPlanWizard: React.FC<Props> = ({ initial, classes, subjectNames, studentCountOf, onSave, onClose }) => {
  const [plan, setPlan] = useState<LessonPlan>(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const set = <K extends keyof LessonPlan>(k: K, v: LessonPlan[K]) => setPlan((p) => ({ ...p, [k]: v }));
  const minutes = useMemo(() => totalMinutes(plan.scenario), [plan.scenario]);

  const pickClass = (id: string) => {
    const c = classes.find((x) => x.id === id);
    setPlan((p) => ({ ...p, classId: id, className: c?.name || '', grade: c?.grade || '', studentCount: id ? String(studentCountOf(id)) : '' }));
  };

  const validateStep = (n: number): string => {
    if (n === 0) {
      if (!plan.classId) return 'کلاس را انتخاب کنید.';
      if (!plan.subject.trim()) return 'نام درس را وارد کنید.';
      if (!plan.mainTopic.trim()) return 'سرفصل کلی را وارد کنید.';
      if (!/^\d{4}\/\d{2}\/\d{2}$/.test(toEnglishDigits(plan.date))) return 'تاریخ را درست وارد کنید.';
    }
    if (n === 2 && !plan.scenario.some((s) => s.description.trim() || s.teacherActivity.trim() || s.studentActivity.trim())) return 'دست‌کم یک مرحله‌ی تدریس را پر کنید.';
    return '';
  };

  const go = (to: number) => {
    if (to > step) {
      const e = validateStep(step);
      if (e) return setError(e);
    }
    setError('');
    setStep(to);
    document.getElementById('lesson-wizard-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const finish = (status: 'draft' | 'submitted') => {
    for (let i = 0; i <= (status === 'submitted' ? 2 : 0); i++) {
      const e = validateStep(i);
      if (e) { setStep(i); return setError(e); }
    }
    onSave({
      ...plan,
      date: toEnglishDigits(plan.date),
      status,
      objectives: { psychomotor: plan.objectives.psychomotor.filter((x) => x.trim()), affective: plan.objectives.affective.filter((x) => x.trim()), cognitive: plan.objectives.cognitive.filter((x) => x.trim()) },
      scenario: plan.scenario.filter((s) => s.description.trim() || s.teacherActivity.trim() || s.studentActivity.trim() || s.minutes.trim()),
    });
  };

  /** ایده‌ی تصادفی شروع کلاس (بدون تکرار پیاپی) در فیلد «فعالیت معلم» گام اول */
  const [lastHook, setLastHook] = useState(-1);
  const rollHook = (id: string) => {
    let n = Math.floor(Math.random() * HOOK_IDEAS.length);
    if (n === lastHook) n = (n + 1) % HOOK_IDEAS.length;
    setLastHook(n);
    setStepRow(id, { teacherActivity: HOOK_IDEAS[n] });
  };

  const [diffOpen, setDiffOpen] = useState(false);
  const addToDifferences = (text: string) => {
    const cur = plan.checklist.differences;
    if (cur.includes(text)) return;
    set('checklist', { ...plan.checklist, differences: cur.trim() ? `${cur.trim()}\n• ${text}` : `• ${text}` });
  };
  const toggleChallenge = (tag: string) => {
    const cur = plan.reflection;
    set('reflection', cur.includes(tag) ? cur.replace(new RegExp(`\\n?[ \\t]*${tag}[.،]?`), '').trim() : `${cur.trim() ? `${cur.trim()}\n` : ''}${tag}.`);
  };

  const setStepRow = (id: string, patch: Partial<LessonPlan['scenario'][number]>) => set('scenario', plan.scenario.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  /** پیشنهاد هوشمند: بر اساس درس (گام ۱) و روش/تکنیک (گام ۲) فعالیت معلم و دانش‌آموز را در همان گام می‌نویسد */
  const { showToast } = useSchool();
  const suggestCount = useRef<Record<string, number>>({});
  const lastSuggested = useRef<Record<string, { teacher: string; student: string }>>({});
  const suggestStep = (stepId: string, index: number) => {
    const phase: SuggestPhase = index === 0 ? 'motivation' : index === plan.scenario.length - 1 && plan.scenario.length > 1 ? 'wrapup' : 'content';
    const n = suggestCount.current[stepId] ?? 0;
    const sug = suggestForStep(phase, { subject: plan.subject, methods: plan.methods, techniques: plan.techniques }, n);
    if (!sug) {
      showToast('ابتدا درس و روش تدریس را در مراحل قبل مشخص کنید.', 'info');
      return;
    }
    suggestCount.current[stepId] = n + 1;
    const cur = plan.scenario.find((x) => x.id === stepId);
    const prev = lastSuggested.current[stepId];
    // اگر فیلد خالی است یا هنوز همان پیشنهاد قبلی است، جایگزین می‌شود؛ در غیر این صورت متن استاد حفظ و پیشنهاد به انتهای آن افزوده می‌شود
    const merge = (now: string, old: string | undefined, next: string) => (!now.trim() || now === old ? next : `${now.trim()}\n${next}`);
    setStepRow(stepId, {
      teacherActivity: merge(cur?.teacherActivity ?? '', prev?.teacher, sug.teacher),
      studentActivity: merge(cur?.studentActivity ?? '', prev?.student, sug.student),
    });
    lastSuggested.current[stepId] = sug;
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col font-['Vazirmatn',sans-serif]" dir="rtl" role="dialog" aria-modal="true" aria-label="ویزارد طرح درس">
      {/* هدر و گام‌ها */}
      <div className="bg-white border-b border-slate-200 px-3 pt-3 pb-2 shrink-0 space-y-2.5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} aria-label="بستن" className="w-11 h-11 shrink-0 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center cursor-pointer"><ArrowRight className="w-5 h-5" /></button>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-900 truncate">طرح درس روزانه</h2>
            <p className="text-[11px] text-slate-500">سال تحصیلی {toPersianDigits(plan.academicYear || '1405-1406')}</p>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">مرحله {toPersianDigits(step + 1)} از {toPersianDigits(4)}</span>
        </div>
        <div className="flex items-center gap-1" role="tablist" aria-label="مراحل">
          {STEPS.map((s, i) => (
            <button key={s} type="button" role="tab" aria-selected={i === step} onClick={() => go(i)} className="flex-1 min-w-0 cursor-pointer">
              <div className={`h-1.5 rounded-full transition ${i <= step ? 'bg-emerald-600' : 'bg-slate-200'}`} />
              <div className={`mt-1 text-[10px] sm:text-[11px] font-bold truncate ${i === step ? 'text-emerald-700' : 'text-slate-400'}`}>{toPersianDigits(i + 1)}. {s}</div>
            </button>
          ))}
        </div>
      </div>

      {/* بدنه */}
      <div id="lesson-wizard-body" className="flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="max-w-3xl mx-auto space-y-4">
          {error && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3">{error}</div>}

          {step === 0 && (
            <div className="space-y-3 bg-white rounded-2xl border border-slate-200 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="کلاس">
                  <select value={plan.classId} onChange={(e) => pickClass(e.target.value)} className={input}>
                    <option value="">انتخاب کلاس…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="تاریخ تدریس">
                  <ShamsiDatePicker value={plan.date} onChange={(v) => set('date', v)} className={`${input} text-center`} />
                </Field>
                <Field label="نام درس">
                  <input list="lesson-subjects" value={plan.subject} onChange={(e) => set('subject', e.target.value)} className={input} />
                  <datalist id="lesson-subjects">{subjectNames.map((n) => <option key={n} value={n} />)}</datalist>
                </Field>
                <Field label="منبع"><input value={plan.source} onChange={(e) => set('source', e.target.value)} className={input} /></Field>
                <Field label="سرفصل کلی"><input value={plan.mainTopic} onChange={(e) => set('mainTopic', e.target.value)} className={input} /></Field>
                <Field label="ریز سرفصل"><input value={plan.subTopic} onChange={(e) => set('subTopic', e.target.value)} className={input} /></Field>
                <Field label="پایه"><input value={plan.grade} onChange={(e) => set('grade', e.target.value)} className={input} /></Field>
                <Field label="تعداد متربیان"><input value={toPersianDigits(plan.studentCount)} onChange={(e) => set('studentCount', toEnglishDigits(e.target.value).replace(/[^0-9]/g, ''))} inputMode="numeric" className={input} /></Field>
              </div>
              <Field label="محدوده‌ی تدریس" hint="مثلاً: از صفحه‌ی ۳۲ تا ۳۶ کتاب"><input value={plan.scope} onChange={(e) => set('scope', e.target.value)} className={input} /></Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                <TagPicker label="ملاک‌های انتخاب روش تدریس" options={METHOD_CRITERIA} value={plan.methodCriteria} onChange={(v) => set('methodCriteria', v)} />
                <GuidePicker title="۱. روش‌های تدریس" intro="روش تدریس، چارچوب و استراتژی اصلی کلاس شماست (مانند اسکلت ساختمان)." guideData={METHOD_GUIDE} value={plan.methods} onChange={(v) => set('methods', v)} customPlaceholder="روش دیگر…" />
                <div className="border-t border-slate-100" />
                <GuidePicker title="۲. تکنیک‌های تدریس" intro="تکنیک‌ها، ابزارهای خرد و جذابی هستند که در دل روش اصلی برای پویایی کلاس استفاده می‌شوند." guideData={TECHNIQUE_GUIDE} value={plan.techniques} onChange={(v) => set('techniques', v)} customPlaceholder="تکنیک دیگر…" />
                <TagPicker label="وسایل مورد استفاده" options={TOOL_OPTIONS} value={plan.tools} onChange={(v) => set('tools', v)} />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="text-xs font-black text-slate-900">اهداف جلسه — پس از پایان درس از متربیان انتظار می‌رود:</div>
                <ObjectiveList label="مهارتی (روانی-حرکتی)" tone="border-amber-200 bg-amber-50/50" verbs={BLOOM_VERBS.psychomotor} value={plan.objectives.psychomotor} onChange={(v) => set('objectives', { ...plan.objectives, psychomotor: v })} />
                <ObjectiveList label="عاطفی" tone="border-rose-200 bg-rose-50/50" verbs={BLOOM_VERBS.affective} value={plan.objectives.affective} onChange={(v) => set('objectives', { ...plan.objectives, affective: v })} />
                <ObjectiveList label="شناختی" tone="border-sky-200 bg-sky-50/50" verbs={BLOOM_VERBS.cognitive} value={plan.objectives.cognitive} onChange={(v) => set('objectives', { ...plan.objectives, cognitive: v })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-900">مراحل تدریس</h3>
              {/* ماشین‌حساب زمان: جمع زمان گام‌ها در برابر سقف ۴۵ دقیقه‌ی هر زنگ */}
              <div className={`rounded-2xl border p-3 space-y-1.5 ${minutes > CLASS_MINUTES ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50/60'}`} aria-live="polite">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className={minutes > CLASS_MINUTES ? 'text-rose-700' : 'text-emerald-800'}>زمان برنامه‌ریزی‌شده</span>
                  <span className={`tabular-nums ${minutes > CLASS_MINUTES ? 'text-rose-700' : 'text-emerald-800'}`}>{toPersianDigits(minutes)} از {toPersianDigits(CLASS_MINUTES)} دقیقه</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/80 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={CLASS_MINUTES} aria-valuenow={Math.min(minutes, CLASS_MINUTES)}>
                  <div className={`h-full rounded-full transition-all ${minutes > CLASS_MINUTES ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (minutes / CLASS_MINUTES) * 100)}%` }} />
                </div>
                {minutes > CLASS_MINUTES ? (
                  <div className="text-xs font-extrabold text-rose-700 inline-flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> ⚠️ زمان‌بندی از زنگ {toPersianDigits(CLASS_MINUTES)} دقیقه‌ای بیشتر شد! ({toPersianDigits(minutes - CLASS_MINUTES)} دقیقه اضافه)</div>
                ) : (
                  <div className="text-[11px] text-slate-500">{minutes === CLASS_MINUTES ? `✅ زمان‌بندی دقیقاً ${toPersianDigits(CLASS_MINUTES)} دقیقه است.` : `${toPersianDigits(CLASS_MINUTES - minutes)} دقیقه از زنگ ${toPersianDigits(CLASS_MINUTES)} دقیقه‌ای آزاد باقی مانده است.`}</div>
                )}
              </div>
              {plan.scenario.map((s, i) => (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">{toPersianDigits(i + 1)}</span>
                    {i === 0 && (
                      <>
                        <span className="text-xs font-extrabold text-slate-800">ایجاد انگیزه</span>
                        <button type="button" onClick={() => rollHook(s.id)} title="ایده‌ی تصادفی برای شروع کلاس" aria-label="ایده‌ی تصادفی برای شروع کلاس" className="h-9 px-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold inline-flex items-center gap-1 cursor-pointer hover:bg-amber-100">
                          <Dices className="w-4 h-4" /> 🎲 ایده
                        </button>
                      </>
                    )}
                    {i === 1 && <span className="text-xs font-extrabold text-slate-800">تدریس اصلی</span>}
                    {i === 2 && <span className="text-xs font-extrabold text-slate-800">جمع‌بندی</span>}
                    <button type="button" onClick={() => suggestStep(s.id, i)} title="پیشنهاد هوشمند بر اساس درس و روش تدریس" aria-label="پیشنهاد هوشمند" className="!min-h-0 h-9 px-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer">
                      🪄 پیشنهاد هوشمند
                    </button>
                    <input value={toPersianDigits(s.minutes)} onChange={(e) => setStepRow(s.id, { minutes: toEnglishDigits(e.target.value).replace(/[^0-9]/g, '') })} inputMode="numeric" placeholder="زمان (دقیقه)" aria-label="زمان" className={`${input} w-32`} />
                    {plan.scenario.length > 1 && <button type="button" onClick={() => set('scenario', plan.scenario.filter((x) => x.id !== s.id))} aria-label="حذف مرحله" className="mr-auto w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-rose-600 cursor-pointer"><X className="w-4 h-4 mx-auto" /></button>}
                  </div>
                  <Field label="شرح و تفصیل مرحله"><textarea rows={2} value={s.description} onChange={(e) => setStepRow(s.id, { description: e.target.value })} className={area} /></Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Field label="فعالیت معلم"><textarea rows={2} value={s.teacherActivity} onChange={(e) => setStepRow(s.id, { teacherActivity: e.target.value })} className={area} /></Field>
                    <Field label="فعالیت دانش‌آموزان (بچه‌ها چه می‌کنند؟)"><textarea rows={2} value={s.studentActivity} onChange={(e) => setStepRow(s.id, { studentActivity: e.target.value })} className={area} /></Field>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => set('scenario', [...plan.scenario, newScenarioStep()])} className="w-full h-12 rounded-2xl border-2 border-dashed border-emerald-300 text-emerald-700 text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer hover:bg-emerald-50"><Plus className="w-4 h-4" /> افزودن مرحله</button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-black text-slate-900">ارزشیابی</h3>
                <Field label="سنجش آغازین"><textarea rows={2} value={plan.evaluation.initial} onChange={(e) => set('evaluation', { ...plan.evaluation, initial: e.target.value })} className={area} /></Field>
                <Field label="ارزشیابی فرایندی"><textarea rows={2} value={plan.evaluation.process} onChange={(e) => set('evaluation', { ...plan.evaluation, process: e.target.value })} className={area} /></Field>
                <Field label="ارزشیابی پایانی"><textarea rows={2} value={plan.evaluation.final} onChange={(e) => set('evaluation', { ...plan.evaluation, final: e.target.value })} className={area} /></Field>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <h3 className="text-sm font-black text-slate-900">فرایند تدریس</h3>
                {([
                  ['motivation', 'انگیزه‌بخشی'], ['prior', 'اتصال به یادگیری قبلی'], ['alignment', 'تطبیق برنامه با اهداف'], ['summary', 'جمع‌بندی'],
                  ['differences', 'توجه به اختلاف سطح'], ['engagement', 'درگیری دانش‌آموزان'], ['homework', 'تمرین در منزل'],
                ] as const).map(([k, label]) => (
                  <React.Fragment key={k}>
                    {k === 'differences' && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50">
                        <button type="button" onClick={() => setDiffOpen((v) => !v)} aria-expanded={diffOpen} className="w-full h-12 px-3.5 flex items-center justify-between text-xs font-extrabold text-slate-800 cursor-pointer">
                          <span className="inline-flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-amber-500" /> پیشنهادگر اختلاف سطح</span>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${diffOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {diffOpen && (
                          <div className="px-3.5 pb-3.5 space-y-3">
                            {([['دانش‌آموزان سریع', DIFFERENTIATION.fast, 'border-sky-200 text-sky-800 bg-sky-50'], ['دانش‌آموزان نیازمند تلاش', DIFFERENTIATION.needs, 'border-amber-200 text-amber-800 bg-amber-50']] as const).map(([title, tags, tone]) => (
                              <div key={title}>
                                <div className="text-[11px] font-bold text-slate-500 mb-1.5">{title}</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {tags.map((t) => (
                                    <button key={t} type="button" onClick={() => addToDifferences(t)} className={`min-h-9 px-2.5 rounded-full border text-[11px] font-bold cursor-pointer ${plan.checklist.differences.includes(t) ? 'bg-emerald-600 border-emerald-600 text-white' : tone}`}>
                                      {plan.checklist.differences.includes(t) ? '✓ ' : '+ '}{t}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <Field label={label}><textarea rows={2} value={plan.checklist[k]} onChange={(e) => set('checklist', { ...plan.checklist, [k]: e.target.value })} className={area} /></Field>
                  </React.Fragment>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <Field label="تجربه‌نگاری" hint="پس از تدریس بنویسید چه چیزی خوب پیش رفت و چه چیزی را بهتر می‌توان انجام داد.">
                  <textarea rows={5} value={plan.reflection} onChange={(e) => set('reflection', e.target.value)} className={area} />
                </Field>
                <div className="mt-2.5 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500">چالش‌های پرتکرار (لمس کنید تا به متن اضافه شود):</div>
                  <div className="flex flex-wrap gap-1.5">
                    {REFLECTION_CHALLENGES.map((c) => {
                      const on = plan.reflection.includes(c.tag);
                      return (
                        <button key={c.tag} type="button" aria-pressed={on} onClick={() => toggleChallenge(c.tag)} className={`min-h-9 px-2.5 rounded-full border text-[11px] font-bold cursor-pointer ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{on ? '✓ ' : '+ '}{c.tag}</button>
                      );
                    })}
                  </div>
                  {REFLECTION_CHALLENGES.filter((c) => plan.reflection.includes(c.tag)).map((c) => (
                    <div key={c.tag} className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs leading-6 text-emerald-900 animate-in fade-in">
                      <b>💡 پیشنهاد برای جلسه‌ی بعد ({c.tag}): </b>{c.advice}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* نوار پایین چسبان */}
      <div className="bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {step > 0 && <button type="button" onClick={() => go(step - 1)} className="h-12 px-4 shrink-0 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold inline-flex items-center gap-1 cursor-pointer"><ChevronRight className="w-4 h-4" /> قبلی</button>}
          <button type="button" onClick={() => finish('draft')} className="h-12 px-3 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"><Save className="w-4 h-4" /> پیش‌نویس</button>
          {step < 3 ? (
            <button type="button" onClick={() => go(step + 1)} className="h-12 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer">بعدی <ChevronLeft className="w-4 h-4" /></button>
          ) : (
            <button type="button" onClick={() => finish('submitted')} className="h-12 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"><Send className="w-4 h-4" /> ثبت و ارسال برای معاونت</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
