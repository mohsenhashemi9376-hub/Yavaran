import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Lightbulb, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { getShamsiWeekRange } from '../utils/persianDate';
import { toPersianDigits } from '../utils/persianDate';
import { compareStudents, studentFullName } from '../utils/studentName';
import { shiftWeek, weekStartOf } from '../utils/worksheets';

type Filter = 'all' | 'missing' | 'delivered';

/** یادداشت هر دانش‌آموز: هنگام تایپ محلی می‌ماند و با خروج از کادر ذخیره می‌شود */
const NoteField: React.FC<{ value: string; onCommit: (v: string) => void; label: string }> = ({ value, onCommit, label }) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== value.trim() && onCommit(text)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      maxLength={500}
      placeholder="یادداشت..."
      aria-label={label}
      className="w-full min-h-[44px] text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 outline-none transition"
    />
  );
};

/**
 * گزارش نقاط تفکر: مربی (کلاس‌های خودش) و معاون تربیتی (همه‌ی کلاس‌ها) هر هفته ثبت می‌کنند چه کسی نقاط تفکر را تحویل داده.
 * «تحویل نداده» حالت پیش‌فرض است؛ فقط کسانی که تحویل داده‌اند با «تحویل داده شد» علامت می‌خورند و کنار هر نفر یادداشت باز است.
 */
export const ReflectionPointsWorkspace: React.FC = () => {
  const { currentUser, students, classes, nurturingClasses, reflectionPoints, setReflectionPoint } = useSchool();
  const isCoach = currentUser.role === 'coach';
  const myClasses = useMemo(() => (isCoach ? nurturingClasses : classes).filter((c) => !c.isWorkshop), [isCoach, nurturingClasses, classes]);

  const [weekStart, setWeekStart] = useState(() => weekStartOf());
  const [classId, setClassId] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!classId || !myClasses.some((c) => c.id === classId)) setClassId(myClasses[0]?.id || '');
  }, [classId, myClasses]);

  const records = useMemo(() => new Map(reflectionPoints.filter((r) => r.weekStart === weekStart).map((r) => [r.studentId, r])), [reflectionPoints, weekStart]);
  const list = useMemo(() => students.filter((s) => s.classId === classId).sort(compareStudents), [students, classId]);
  const delivered = list.filter((s) => records.get(s.id)?.delivered).length;
  const visible = list.filter((s) => {
    const d = Boolean(records.get(s.id)?.delivered);
    return filter === 'all' ? true : filter === 'delivered' ? d : !d;
  });
  const range = getShamsiWeekRange(weekStart);
  const isCurrent = weekStart === weekStartOf();

  if (myClasses.length === 0) {
    return <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500" dir="rtl">کلاسی برای نمایش گزارش نقاط تفکر وجود ندارد.</div>;
  }

  const setDelivered = (s: Student, value: boolean) => setReflectionPoint(s, weekStart, { delivered: value });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Lightbulb className="w-5 h-5" /></div>
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-900">گزارش نقاط تفکر</h2>
            <p className="text-xs text-slate-500 mt-0.5">وضعیت همه‌ی دانش‌آموزان در ابتدا «تحویل نداده» است. هر کس نقاط تفکر را تحویل داد، «تحویل داده شد» را بزنید و در صورت نیاز یادداشت بنویسید.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">کلاس</span>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer">
              {myClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div>
            <span className="block text-[11px] font-bold text-slate-500 mb-1">هفته</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setWeekStart(shiftWeek(weekStart, 1))} aria-label="هفته بعد" className="w-11 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center cursor-pointer"><ChevronRight className="w-5 h-5" /></button>
              <button type="button" onClick={() => setWeekStart(weekStartOf())} className={`flex-1 h-11 rounded-xl text-xs font-extrabold cursor-pointer ${isCurrent ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-700'}`}>
                {toPersianDigits(range.title)}{isCurrent ? ' • این هفته' : ''}
              </button>
              <button type="button" onClick={() => setWeekStart(shiftWeek(weekStart, -1))} aria-label="هفته قبل" className="w-11 h-11 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center cursor-pointer"><ChevronLeft className="w-5 h-5" /></button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap text-xs font-bold">
          {([['all', `همه (${toPersianDigits(list.length)})`], ['missing', `تحویل نداده (${toPersianDigits(list.length - delivered)})`], ['delivered', `تحویل داده شد (${toPersianDigits(delivered)})`]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`min-h-[40px] px-3.5 rounded-full border cursor-pointer transition ${filter === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {visible.length === 0 && <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-400">دانش‌آموزی با این فیلتر پیدا نشد.</div>}
        {visible.map((s, idx) => {
          const rec = records.get(s.id);
          const done = Boolean(rec?.delivered);
          return (
            <div key={s.id} className={`bg-white rounded-2xl border shadow-sm p-3 flex flex-col sm:flex-row sm:items-center gap-2.5 ${done ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 sm:w-56 shrink-0">
                <span className="w-6 text-center text-xs font-bold text-slate-400">{toPersianDigits(idx + 1)}</span>
                <span className="text-sm font-extrabold text-slate-900 truncate">{studentFullName(s)}</span>
              </div>
              <div className="flex rounded-2xl bg-slate-100 p-1 gap-1 shrink-0" role="group" aria-label={`وضعیت تحویل ${studentFullName(s)}`}>
                <button type="button" onClick={() => setDelivered(s, false)} aria-pressed={!done} className={`min-h-[44px] px-3.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition ${!done ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500'}`}>
                  <X className="w-4 h-4" />تحویل نداده
                </button>
                <button type="button" onClick={() => setDelivered(s, true)} aria-pressed={done} className={`min-h-[44px] px-3.5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer transition ${done ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}>
                  <Check className="w-4 h-4" />تحویل داده شد
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <NoteField value={rec?.note || ''} label={`یادداشت ${studentFullName(s)}`} onCommit={(v) => setReflectionPoint(s, weekStart, { note: v })} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
