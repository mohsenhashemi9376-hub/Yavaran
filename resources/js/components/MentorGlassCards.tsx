import React from 'react';
import { BookOpen, ChevronLeft, Clock, ClipboardList, Eye, Plus, UserX } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

export interface MentorGlassCardsProps {
  /** تعداد مشاهده‌های ثبت‌شده و دانش‌آموزان تحت پوشش (نمایش در کادر اصلی) */
  observationsCount: number;
  studentsCount: number;
  attentionCount: number;
  onObserve: () => void;
  onTimeline: () => void;
  onHomework: () => void;
  onAcademicDiscipline: () => void;
  onGreyList: () => void;
}

const TILES = [
  { key: 'timeline', title: 'خط زمانی', hint: 'رویدادهای دانش‌آموز', icon: Clock, tone: 'from-sky-50/90 to-white/60 border-sky-200/80 text-sky-700' },
  { key: 'homework', title: 'پیگیری تکالیف', hint: 'تکالیف انجام‌نشده', icon: ClipboardList, tone: 'from-amber-50/90 to-white/60 border-amber-200/80 text-amber-700' },
  { key: 'academic', title: 'آموزش و انضباط', hint: 'کارنامه، غیبت و نمرات', icon: BookOpen, tone: 'from-indigo-50/90 to-white/60 border-indigo-200/80 text-indigo-700' },
  { key: 'grey', title: 'لیست خاکستری', hint: 'دانش‌آموزان تحت نظر', icon: UserX, tone: 'from-slate-100/90 to-white/60 border-slate-300/80 text-slate-600' },
] as const;

/** کادرهای شیشه‌ای پنل مربی؛ هم‌سبک پنل معاونان */
export const MentorGlassCards: React.FC<MentorGlassCardsProps> = ({
  observationsCount, studentsCount, attentionCount, onObserve, onTimeline, onHomework, onAcademicDiscipline, onGreyList,
}) => {
  const handlers = { timeline: onTimeline, homework: onHomework, academic: onAcademicDiscipline, grey: onGreyList };
  const values: Partial<Record<(typeof TILES)[number]['key'], number>> = { timeline: studentsCount, grey: attentionCount };

  return (
    <section className="space-y-3" aria-label="دسترسی‌های مربی">
      <button
        type="button"
        onClick={onObserve}
        className="group w-full flex items-center justify-between gap-3 rounded-3xl border border-emerald-200/80 bg-gradient-to-l from-emerald-100/80 via-white/70 to-white/60 p-5 text-right shadow-sm ring-1 ring-white/60 backdrop-blur-xl transition active:scale-[.99] cursor-pointer"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-base font-extrabold text-emerald-800"><Eye className="w-5 h-5" /> ثبت مشاهده‌گری</span>
          <span className="mt-1 block text-xs text-slate-500">
            {toPersianDigits(observationsCount)} مشاهده ثبت‌شده برای {toPersianDigits(studentsCount)} دانش‌آموز تحت پوشش
          </span>
        </span>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30 group-hover:bg-emerald-700">
          <Plus className="w-6 h-6" />
        </span>
      </button>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => {
          const Icon = t.icon;
          const v = values[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={handlers[t.key]}
              className={`group flex flex-col rounded-3xl border bg-gradient-to-br p-4 text-right shadow-sm ring-1 ring-white/60 backdrop-blur-xl transition active:scale-[.98] hover:shadow-md cursor-pointer ${t.tone}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="whitespace-nowrap text-[13px] font-bold text-slate-700">{t.title}</span>
                <Icon className="w-5 h-5 shrink-0" />
              </span>
              <span className="mt-3 text-3xl font-extrabold leading-none text-slate-900">{v === undefined ? '—' : toPersianDigits(v)}</span>
              <span className="mt-1 whitespace-nowrap text-[11px] text-slate-500">{t.hint}</span>
              <span className="mt-3 flex items-center gap-1 text-[11px] font-bold">
                مشاهده <ChevronLeft className="w-3 h-3 transition group-hover:-translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
