import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Plus, Save, Send, X } from 'lucide-react';
import { LessonPlan, SchoolClass } from '../types';
import { METHOD_CRITERIA, METHOD_OPTIONS, TECHNIQUE_OPTIONS, TOOL_OPTIONS, newScenarioStep, totalMinutes } from '../utils/lessonPlan';
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

/** فهرست پویای اهداف (افزودن و حذف ردیف) */
const ObjectiveList: React.FC<{ label: string; tone: string; value: string[]; onChange: (v: string[]) => void }> = ({ label, tone, value, onChange }) => (
  <div className={`rounded-2xl border p-3 space-y-2 ${tone}`}>
    <div className="text-xs font-black text-slate-800">{label}</div>
    {value.map((v, i) => (
      <div key={i} className="flex items-center gap-2">
        <input value={v} onChange={(e) => onChange(value.map((x, n) => (n === i ? e.target.value : x)))} placeholder="مثلاً: متربی بتواند … را توضیح دهد" className={`${input} bg-white`} />
        {value.length > 1 && <button type="button" onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label="حذف هدف" className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-600 cursor-pointer"><X className="w-4 h-4 mx-auto" /></button>}
      </div>
    ))}
    <button type="button" onClick={() => onChange([...value, ''])} className="h-9 px-3 rounded-lg border border-dashed border-slate-300 text-[11px] font-bold text-slate-600 inline-flex items-center gap-1 cursor-pointer"><Plus className="w-3.5 h-3.5" /> افزودن هدف</button>
  </div>
);

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

  const setStepRow = (id: string, patch: Partial<LessonPlan['scenario'][number]>) => set('scenario', plan.scenario.map((s) => (s.id === id ? { ...s, ...patch } : s)));

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
                <TagPicker label="روش تدریس" options={METHOD_OPTIONS} value={plan.methods} onChange={(v) => set('methods', v)} />
                <TagPicker label="تکنیک‌های مورد استفاده" options={TECHNIQUE_OPTIONS} value={plan.techniques} onChange={(v) => set('techniques', v)} />
                <TagPicker label="وسایل مورد استفاده" options={TOOL_OPTIONS} value={plan.tools} onChange={(v) => set('tools', v)} />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="text-xs font-black text-slate-900">اهداف جلسه — پس از پایان درس از متربیان انتظار می‌رود:</div>
                <ObjectiveList label="روانی-حرکتی" tone="border-amber-200 bg-amber-50/50" value={plan.objectives.psychomotor} onChange={(v) => set('objectives', { ...plan.objectives, psychomotor: v })} />
                <ObjectiveList label="عاطفی" tone="border-rose-200 bg-rose-50/50" value={plan.objectives.affective} onChange={(v) => set('objectives', { ...plan.objectives, affective: v })} />
                <ObjectiveList label="شناختی" tone="border-sky-200 bg-sky-50/50" value={plan.objectives.cognitive} onChange={(v) => set('objectives', { ...plan.objectives, cognitive: v })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">مراحل تدریس</h3>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">جمع زمان: {toPersianDigits(minutes)} دقیقه</span>
              </div>
              {plan.scenario.map((s, i) => (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black flex items-center justify-center">{toPersianDigits(i + 1)}</span>
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
                  <Field key={k} label={label}><textarea rows={2} value={plan.checklist[k]} onChange={(e) => set('checklist', { ...plan.checklist, [k]: e.target.value })} className={area} /></Field>
                ))}
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <Field label="تجربه‌نگاری" hint="پس از تدریس بنویسید چه چیزی خوب پیش رفت و چه چیزی را بهتر می‌توان انجام داد.">
                  <textarea rows={5} value={plan.reflection} onChange={(e) => set('reflection', e.target.value)} className={area} />
                </Field>
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
