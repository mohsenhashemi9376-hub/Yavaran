import React, { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { LessonPlan } from '../types';
import { REFLECTION_CHALLENGES } from '../utils/lessonPlan';
import { formatShamsiWithWeekday, toPersianDigits } from '../utils/persianDate';
import { Modal } from './ui/Modal';

interface Props {
  plan: LessonPlan | null;
  onClose: () => void;
  onSave: (plan: LessonPlan) => void;
}

/** تجربه‌نگاری هوشمند پس از کلاس: تگ چالش‌ها، پیشنهاد جلسه‌ی بعد و متن آزاد */
export const LessonPlanReflectionModal: React.FC<Props> = ({ plan, onClose, onSave }) => {
  if (!plan) return null;
  return <Inner key={plan.id} plan={plan} onClose={onClose} onSave={onSave} />;
};

const Inner: React.FC<{ plan: LessonPlan; onClose: () => void; onSave: (plan: LessonPlan) => void }> = ({ plan, onClose, onSave }) => {
  // طرح‌های قدیمی تگ‌ها را داخل متن داشتند؛ از روی متن بازیابی می‌شوند
  const [tags, setTags] = useState<string[]>(
    plan.reflectionTags ?? REFLECTION_CHALLENGES.filter((c) => (plan.reflection || '').includes(c.tag)).map((c) => c.tag)
  );
  const [text, setText] = useState(plan.reflection || '');
  const toggle = (tag: string) => setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="📝 تجربه‌نگاری پس از کلاس"
      subtitle={`${plan.subject || 'طرح درس'} · ${plan.date ? toPersianDigits(formatShamsiWithWeekday(plan.date)) : ''}`}
      size="lg"
      footer={
        <div className="flex items-center gap-2 w-full">
          <button type="button" onClick={onClose} className="h-12 px-4 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold cursor-pointer">انصراف</button>
          <button
            type="button"
            onClick={() => onSave({ ...plan, reflection: text.trim(), reflectionTags: tags, reflectedAt: new Date().toISOString() })}
            className="h-12 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold cursor-pointer"
          >
            ذخیره‌ی تجربه‌نگاری
          </button>
        </div>
      }
    >
      <div className="space-y-4" dir="rtl">
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700">این جلسه با چه چالشی روبه‌رو شدید؟ <span className="font-medium text-slate-400">(چند مورد را می‌توانید انتخاب کنید)</span></div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="چالش‌های تدریس">
            {REFLECTION_CHALLENGES.map((c) => {
              const on = tags.includes(c.tag);
              return (
                <button key={c.tag} type="button" aria-pressed={on} onClick={() => toggle(c.tag)}
                  className={`!min-h-0 min-h-10 px-3 rounded-full border text-xs font-bold cursor-pointer transition ${on ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {on ? '✓ ' : '+ '}{c.tag}
                </button>
              );
            })}
          </div>
        </div>

        {REFLECTION_CHALLENGES.filter((c) => tags.includes(c.tag)).map((c) => (
          <div key={c.tag} className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs leading-6 text-emerald-900 flex gap-2 animate-in fade-in">
            <Lightbulb className="w-4 h-4 shrink-0 mt-1 text-amber-500" />
            <div><b>پیشنهاد برای جلسه‌ی بعد ({c.tag}): </b>{c.advice}</div>
          </div>
        ))}

        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-700">تجربه‌نگاری</span>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="چه چیزی خوب پیش رفت و چه چیزی را بهتر می‌توان انجام داد؟"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 resize-none leading-6"
          />
        </label>
      </div>
    </Modal>
  );
};
