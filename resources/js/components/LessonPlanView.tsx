import React from 'react';
import { LessonPlan } from '../types';
import { LESSON_STANDARDS, totalMinutes } from '../utils/lessonPlan';
import { formatShamsiWithWeekday, toPersianDigits } from '../utils/persianDate';

const Row: React.FC<{ label: string; value?: string }> = ({ label, value }) =>
  value && value.trim() ? (
    <div className="flex flex-col gap-0.5 py-1.5">
      <dt className="text-[11px] font-bold text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800 leading-6 whitespace-pre-wrap">{value}</dd>
    </div>
  ) : null;

const Chips: React.FC<{ label: string; items: string[]; tone: string }> = ({ label, items, tone }) =>
  items.length ? (
    <div className="py-1.5">
      <div className="text-[11px] font-bold text-slate-400 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">{items.map((t) => <span key={t} className={`px-2.5 py-1 rounded-full border text-xs font-bold ${tone}`}>{t}</span>)}</div>
    </div>
  ) : null;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-3.5">
    <h4 className="text-xs font-black text-slate-900 mb-1.5">{title}</h4>
    {children}
  </section>
);

/** نمایش فقط‌خواندنی کامل یک طرح درس (برای معاونت و پیش‌نمایش دبیر) */
export const LessonPlanView: React.FC<{ plan: LessonPlan; tone?: 'emerald' | 'blue' }> = ({ plan, tone = 'blue' }) => {
  const chip = tone === 'blue' ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200';
  const objectives: [string, string[]][] = [
    ['روانی-حرکتی', plan.objectives.psychomotor],
    ['عاطفی', plan.objectives.affective],
    ['شناختی', plan.objectives.cognitive],
  ];
  const checklist: [string, string][] = [
    ['انگیزه‌بخشی', plan.checklist.motivation], ['اتصال به یادگیری قبلی', plan.checklist.prior], ['تطبیق برنامه با اهداف', plan.checklist.alignment],
    ['جمع‌بندی', plan.checklist.summary], ['توجه به اختلاف سطح', plan.checklist.differences], ['درگیری دانش‌آموزان', plan.checklist.engagement], ['تمرین در منزل', plan.checklist.homework],
  ];
  return (
    <div className="space-y-3" dir="rtl">
      <Section title="مشخصات کلی">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Row label="نام درس" value={plan.subject} />
          <Row label="تاریخ" value={plan.date ? toPersianDigits(formatShamsiWithWeekday(plan.date)) : ''} />
          <Row label="سرفصل کلی" value={plan.mainTopic} />
          <Row label="ریز سرفصل" value={plan.subTopic} />
          <Row label="منبع" value={plan.source} />
          <Row label="پایه / کلاس" value={[plan.grade, plan.className].filter(Boolean).join(' • ')} />
          <Row label="تعداد متربیان" value={plan.studentCount ? toPersianDigits(plan.studentCount) : ''} />
          <Row label="محدوده‌ی تدریس" value={plan.scope} />
        </dl>
      </Section>
      <Section title="روش تدریس و وسایل">
        <Chips label="ملاک‌های انتخاب روش" items={plan.methodCriteria} tone="bg-slate-50 text-slate-700 border-slate-200" />
        <Chips label="روش تدریس" items={plan.methods} tone={chip} />
        <Chips label="تکنیک‌های مورد استفاده" items={plan.techniques} tone={chip} />
        <Chips label="وسایل مورد استفاده" items={plan.tools} tone="bg-slate-50 text-slate-700 border-slate-200" />
      </Section>
      <Section title="اهداف جلسه (پس از پایان درس از متربیان انتظار می‌رود…)">
        {objectives.map(([label, items]) => items.some((i) => i.trim()) && (
          <div key={label} className="py-1.5">
            <div className="text-[11px] font-bold text-slate-400 mb-1">{label}</div>
            <ul className="list-disc pr-5 space-y-0.5 text-sm text-slate-800">{items.filter((i) => i.trim()).map((i, n) => <li key={n}>{i}</li>)}</ul>
          </div>
        ))}
      </Section>
      <Section title={`سناریو و مراحل تدریس (${toPersianDigits(totalMinutes(plan.scenario))} دقیقه)`}>
        <ol className="space-y-2">
          {plan.scenario.filter((s) => s.description || s.teacherActivity || s.studentActivity).map((s, i) => (
            <li key={s.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-extrabold text-slate-900">مرحله‌ی {toPersianDigits(i + 1)}</span>
                {s.minutes && <span className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold">{toPersianDigits(s.minutes)} دقیقه</span>}
              </div>
              {s.description && <p className="text-slate-700 leading-6 whitespace-pre-wrap">{s.description}</p>}
              {s.teacherActivity && <p className="mt-1 text-[12px] leading-6"><b className="text-emerald-700">فعالیت معلم: </b>{s.teacherActivity}</p>}
              {s.studentActivity && <p className="text-[12px] leading-6"><b className="text-sky-700">فعالیت دانش‌آموزان: </b>{s.studentActivity}</p>}
            </li>
          ))}
        </ol>
      </Section>
      <Section title="ارزشیابی و فرایند تدریس">
        {LESSON_STANDARDS.some((x) => plan.standards?.[x.key]) && (
          <Chips label="استانداردهای لحاظ‌شده" items={LESSON_STANDARDS.filter((x) => plan.standards?.[x.key]).map((x) => x.label)} tone={chip} />
        )}
        <dl>
          <Row label="سنجش آغازین" value={plan.evaluation.initial} />
          <Row label="ارزشیابی فرایندی" value={plan.evaluation.process} />
          <Row label="ارزشیابی پایانی" value={plan.evaluation.final} />
          {checklist.map(([l, v]) => <Row key={l} label={l} value={v} />)}
        </dl>
      </Section>
      {(plan.reflection?.trim() || plan.reflectionTags?.length) ? (
        <Section title="تجربه‌نگاری پس از کلاس">
          <Chips label="چالش‌ها" items={plan.reflectionTags || []} tone="bg-amber-50 text-amber-800 border-amber-200" />
          {plan.reflection?.trim() && <p className="text-sm text-slate-800 leading-7 whitespace-pre-wrap">{plan.reflection}</p>}
        </Section>
      ) : null}
    </div>
  );
};
