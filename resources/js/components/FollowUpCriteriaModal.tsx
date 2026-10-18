import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import {
  DEFAULT_FOLLOW_UP_CONFIG,
  FOLLOW_UP_GROUP_LABEL,
  FollowUpConfig,
  FollowUpGroup,
  FollowUpKind,
  isDefaultFollowUpConfig,
} from '../utils/academicFollowUp';
import { toPersianDigits } from '../utils/persianDate';

type NumKey = Exclude<keyof FollowUpConfig, 'enabled'>;

interface RuleDef {
  kind: FollowUpKind;
  group: FollowUpGroup;
  title: string;
  hint: string;
  /** مقدار قابل تنظیم این قانون (در صورت وجود) */
  field?: { key: NumKey; prefix: string; unit: string; min: number; max: number; step: number };
}

const RULES: RuleDef[] = [
  { kind: 'low_continuous', group: 'grades', title: 'مستمر ضعیف در یک درس', hint: 'نمره‌ی مستمر یک ماه از حد نمره‌ی ضعیف کمتر باشد' },
  { kind: 'low_continuous_avg', group: 'grades', title: 'میانگین مستمر ضعیف', hint: 'میانگین همه‌ی نمرات مستمر از حد نمره‌ی ضعیف کمتر باشد' },
  { kind: 'score_decline', group: 'grades', title: 'افت نمره', hint: 'دو ماه کاهش پشت‌سرهم، یا افت زیاد نسبت به ماه قبل', field: { key: 'dropFromPreviousMonth', prefix: 'افت بیش از', unit: 'نمره', min: 0.5, max: 20, step: 0.5 } },
  { kind: 'low_exam', group: 'grades', title: 'آزمون جامع ضعیف در یک درس', hint: 'نمره‌ی یک درس آزمون جامع از حد نمره‌ی ضعیف کمتر باشد' },
  { kind: 'low_exam_avg', group: 'grades', title: 'میانگین آزمون جامع ضعیف', hint: 'میانگین آزمون‌های جامع از حد نمره‌ی ضعیف کمتر باشد' },
  { kind: 'exam_gap', group: 'grades', title: 'اختلاف مستمر و آزمون جامع', hint: 'مستمر بالا و جامع پایین (یا برعکس) نشانه‌ی مشکل آمادگی یا نمره‌دهی است', field: { key: 'continuousVsExamGap', prefix: 'اختلاف حداقل', unit: 'نمره', min: 1, max: 20, step: 1 } },
  { kind: 'homework_not_done', group: 'homework', title: 'تکلیف انجام‌نشده (هر درس)', hint: 'در یک درس، در یک ماه', field: { key: 'homeworkNotDonePerMonth', prefix: 'حداقل', unit: 'بار در ماه', min: 1, max: 31, step: 1 } },
  { kind: 'homework_incomplete', group: 'homework', title: 'تکلیف ناقص (هر درس)', hint: 'در یک درس، در یک ماه', field: { key: 'homeworkIncompletePerMonth', prefix: 'حداقل', unit: 'بار در ماه', min: 1, max: 31, step: 1 } },
  { kind: 'homework_streak', group: 'homework', title: 'تکلیف انجام‌نشده پشت‌سرهم', hint: 'چند جلسه‌ی پیاپی از یک درس', field: { key: 'homeworkNotDoneStreak', prefix: 'حداقل', unit: 'جلسه پشت‌سرهم', min: 2, max: 31, step: 1 } },
  { kind: 'worksheet_streak', group: 'worksheet', title: 'کاربرگ تحویل‌نداده', hint: 'هفته‌های متوالی که مهلتشان گذشته است', field: { key: 'worksheetStreakWeeks', prefix: 'حداقل', unit: 'هفته متوالی', min: 1, max: 20, step: 1 } },
  { kind: 'subject_absences', group: 'attendance', title: 'غیبت در یک درس', hint: 'در یک درس، در یک ماه', field: { key: 'subjectAbsencesPerMonth', prefix: 'حداقل', unit: 'بار در ماه', min: 1, max: 31, step: 1 } },
  { kind: 'class_lates', group: 'attendance', title: 'تأخیر ورود به کلاس', hint: 'در همه‌ی دروس، در یک ماه', field: { key: 'classLatesPerMonth', prefix: 'حداقل', unit: 'بار در ماه', min: 1, max: 31, step: 1 } },
  { kind: 'class_warnings', group: 'attendance', title: 'اخطار کلاسی', hint: 'اخطار «عدم انجام تکلیف» یا «بی‌انضباطی» در یک ماه', field: { key: 'classWarningsPerMonth', prefix: 'حداقل', unit: 'بار در ماه', min: 1, max: 31, step: 1 } },
];

const Stepper: React.FC<{ value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string }> = ({ value, min, max, step, onChange, label }) => {
  const set = (v: number) => onChange(Math.round(Math.min(max, Math.max(min, v)) * 100) / 100);
  return (
    <div className="inline-flex items-center rounded-xl bg-slate-100 p-1" role="group" aria-label={label}>
      <button type="button" onClick={() => set(value + step)} aria-label="افزایش" className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 cursor-pointer active:scale-95"><Plus className="w-4 h-4" /></button>
      <span className="min-w-[3rem] text-center text-base font-black text-slate-900 tabular-nums">{toPersianDigits(String(value).replace('.', '٫'))}</span>
      <button type="button" onClick={() => set(value - step)} aria-label="کاهش" className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 cursor-pointer active:scale-95"><Minus className="w-4 h-4" /></button>
    </div>
  );
};

const Switch: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative w-12 h-7 rounded-full shrink-0 cursor-pointer transition ${on ? 'bg-emerald-600' : 'bg-slate-300'}`}>
    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${on ? 'right-0.5' : 'right-[1.4rem]'}`} />
  </button>
);

/** «پیشرفته»: معاون آموزش ملاک‌های نمایش دانش‌آموزان در «نیازمند پیگیری» را روشن/خاموش یا عددی تنظیم می‌کند */
export const FollowUpCriteriaModal: React.FC<{ config: FollowUpConfig; onSave: (c: FollowUpConfig) => void; onClose: () => void }> = ({ config, onSave, onClose }) => {
  const [draft, setDraft] = useState<FollowUpConfig>(config);
  const changed = JSON.stringify(draft) !== JSON.stringify(config);
  const setNum = (key: NumKey, v: number) => setDraft((d) => ({ ...d, [key]: v }));
  const setEnabled = (kind: FollowUpKind, v: boolean) => setDraft((d) => ({ ...d, enabled: { ...d.enabled, [kind]: v } }));
  const activeCount = RULES.filter((r) => draft.enabled[r.kind]).length;

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-slate-900/50 backdrop-blur-sm overflow-y-auto" dir="rtl" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="min-h-full flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-white w-full max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl font-['Vazirmatn',sans-serif] flex flex-col max-h-[92vh]">
          <header className="flex items-start gap-3 px-4 sm:px-6 pt-4 pb-3 border-b border-slate-100">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><SlidersHorizontal className="w-5 h-5" /></div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-black text-slate-900">تنظیمات پیشرفته‌ی ملاک‌ها</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-5">مشخص کنید چه دانش‌آموزی در «نیازمند پیگیری» بیاید. {toPersianDigits(activeCount)} از {toPersianDigits(RULES.length)} ملاک روشن است.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="بستن" className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
          </header>

          <div className="overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-5">
            <section className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-extrabold text-slate-800">حد نمره‌ی ضعیف</div>
                <div className="text-[11px] text-slate-500 leading-5">نمره‌ی کمتر از این مقدار در ملاک‌های «نمره» ضعیف حساب می‌شود</div>
              </div>
              <Stepper value={draft.lowScore} min={1} max={20} step={0.5} label="حد نمره‌ی ضعیف" onChange={(v) => setNum('lowScore', v)} />
            </section>

            {(['grades', 'homework', 'worksheet', 'attendance'] as FollowUpGroup[]).map((g) => (
              <section key={g} className="space-y-2">
                <h4 className="text-xs font-black text-slate-500">{FOLLOW_UP_GROUP_LABEL[g]}</h4>
                <ul className="space-y-2">
                  {RULES.filter((r) => r.group === g).map((r) => {
                    const on = draft.enabled[r.kind];
                    return (
                      <li key={r.kind} className={`rounded-2xl border p-3.5 transition ${on ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-extrabold text-slate-900">{r.title}</div>
                            <div className="text-[11px] text-slate-500 leading-5">{r.hint}</div>
                          </div>
                          <Switch on={on} onChange={(v) => setEnabled(r.kind, v)} label={r.title} />
                        </div>
                        {on && r.field && (
                          <div className="mt-2.5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                            <span className="text-xs font-bold text-slate-600">{r.field.prefix} <span className="text-slate-400 font-medium">{r.field.unit}</span></span>
                            <Stepper value={draft[r.field.key] as number} min={r.field.min} max={r.field.max} step={r.field.step} label={r.title} onChange={(v) => setNum(r.field!.key, v)} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <footer className="flex items-center gap-2 px-4 sm:px-6 py-3 border-t border-slate-100 bg-white sm:rounded-b-3xl" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => setDraft(DEFAULT_FOLLOW_UP_CONFIG)} disabled={isDefaultFollowUpConfig(draft)} className="min-h-[48px] px-3.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <RotateCcw className="w-4 h-4" /> پیش‌فرض
            </button>
            <button type="button" onClick={() => { onSave(draft); onClose(); }} disabled={!changed} className="flex-1 min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-base font-extrabold shadow-md shadow-emerald-600/20 cursor-pointer disabled:cursor-not-allowed disabled:shadow-none transition">
              ذخیره و اعمال
            </button>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  );
};
