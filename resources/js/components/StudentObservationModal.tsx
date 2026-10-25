import React, { useEffect, useState } from 'react';
import { Calendar, ClipboardList, Edit3, Eye, MapPin, NotebookPen, Plus, Save, Trash2, X } from 'lucide-react';
import { ObservationCategory, StudentObservation } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { EmptyState } from './EmptyState';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { ClockTimePicker } from './ClockTimePicker';

export interface ObservationCategoryOption { key: ObservationCategory; label: string; color: string }

interface Props {
  studentName: string;
  className: string;
  categories: ObservationCategoryOption[];
  /** سوابق همین دانش‌آموز */
  history: StudentObservation[];
  /** سوابق به‌دلیل قفل امنیتی نمایش داده نمی‌شود */
  locked: boolean;
  lockedMessage: string;
  canModify: (obs: StudentObservation) => boolean;
  showCoachBadge: boolean;

  title: string; onTitle: (v: string) => void;
  category: ObservationCategory; onCategory: (v: ObservationCategory) => void;
  content: string; onContent: (v: string) => void;
  date: string; onDate: (v: string) => void;
  time: string; onTime: (v: string) => void;
  dateManual: boolean; onDateManual: (v: boolean) => void;
  location: string; onLocation: (v: string) => void;
  /** برچسب‌ها به‌صورت رشته‌ی جداشده با کاما (همان فرمت قبلی) */
  tags: string; onTags: (v: string) => void;
  editingId: string | null;

  onResetDateTime: () => void;
  onCancelEdit: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onEdit: (obs: StudentObservation) => void;
  onDelete: (obs: StudentObservation) => void;
  onClose: () => void;
}

const LOCATIONS = ['کلاس درس', 'زنگ تفریح', 'حیاط', 'نمازخانه/اردو'];
const PRESET_TAGS = ['همدلی', 'مسئولیت‌پذیری', 'اضطراب', 'تمرکز', 'بی‌نظمی'];
const splitTags = (s: string) => s.split(/[,،]/).map((t) => t.trim()).filter(Boolean);
const SCROLL = '[scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]';

const inputCls = 'w-full h-11 text-sm bg-white border border-slate-200 rounded-xl px-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 transition';

/** پنجره‌ی «مشاهده‌گری رفتاری دانش‌آموز»: روی موبایل باتم‌شیت، روی دسکتاپ مدال */
export const StudentObservationModal: React.FC<Props> = (p) => {
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [customTag, setCustomTag] = useState('');
  const tags = splitTags(p.tags);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && p.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.onClose]);

  const setTags = (list: string[]) => p.onTags(list.join(', '));
  const toggleTag = (t: string) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const addCustom = () => {
    const t = customTag.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setCustomTag('');
  };
  const extraTags = tags.filter((t) => !PRESET_TAGS.includes(t));
  const locations = LOCATIONS.includes(p.location) || !p.location ? LOCATIONS : [...LOCATIONS, p.location];

  const submit = (e: React.FormEvent) => {
    p.onSubmit(e);
    if (p.content.trim()) setTab('history');
  };

  const chip = (on: boolean, tone: 'emerald' | 'sky' = 'emerald') =>
    `shrink-0 !min-h-0 h-9 px-3.5 rounded-full border text-xs font-bold whitespace-nowrap cursor-pointer transition ${
      on ? (tone === 'emerald' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-sky-600 border-sky-600 text-white') : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-xs sm:items-center sm:p-4" dir="rtl" role="dialog" aria-modal="true" aria-label="مشاهده‌گری رفتاری">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-50 shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:max-h-[90vh] sm:rounded-3xl">
        {/* هدر شیشه‌ای */}
        <header className="relative shrink-0 overflow-hidden bg-slate-900 px-4 py-3.5 text-white sm:px-6">
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-emerald-700/40 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-500/20 text-emerald-300 backdrop-blur"><Eye className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-black">{p.studentName}</h3>
              <p className="truncate text-xs text-emerald-300">{p.className} | ثبت مشاهدات</p>
            </div>
            <button type="button" onClick={p.onClose} aria-label="بستن" className="!min-h-0 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* سوئیچر زبانه‌ها */}
        <div className="shrink-0 px-4 pt-3 sm:px-6">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-slate-200/70 p-1 text-xs font-bold" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'new'} onClick={() => setTab('new')} className={`!min-h-0 h-10 rounded-full cursor-pointer transition ${tab === 'new' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>
              {p.editingId ? '✏️ ویرایش مشاهده' : '➕ ثبت مشاهده جدید'}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')} className={`!min-h-0 h-10 rounded-full cursor-pointer transition ${tab === 'history' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>
              📋 سوابق گذشته ({toPersianDigits(p.history.length)} مورد)
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 ${SCROLL}`}>
          {tab === 'new' ? (
            <form onSubmit={submit} className="space-y-4 rounded-3xl border border-emerald-200/70 bg-white/90 p-4 shadow-sm backdrop-blur">
              {p.editingId && (
                <button type="button" onClick={p.onCancelEdit} className="!min-h-0 text-[11px] font-bold text-rose-600 hover:underline cursor-pointer">انصراف از ویرایش</button>
              )}

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-700">عنوان یا محور مشاهده <span className="text-rose-500">*</span></span>
                <input type="text" required value={p.title} onChange={(e) => p.onTitle(e.target.value)} placeholder="مثال: تعامل با همکلاسی‌ها در زنگ تفریح" className={inputCls} />
              </label>

              {/* مکان: چیپ‌های افقی */}
              <div>
                <span className="mb-1.5 block text-[11px] font-bold text-slate-700">مکان مشاهده</span>
                <div className={`flex gap-2 overflow-x-auto pb-1 ${SCROLL}`}>
                  {locations.map((l) => (
                    <button key={l} type="button" onClick={() => p.onLocation(l)} aria-pressed={p.location === l} className={chip(p.location === l)}>{l}</button>
                  ))}
                </div>
              </div>

              {/* دسته‌بندی + زمان */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-slate-700">دسته‌بندی مشاهده</span>
                  <select value={p.category} onChange={(e) => p.onCategory(e.target.value as ObservationCategory)} className={`${inputCls} cursor-pointer`}>
                    {p.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </label>
                <div>
                  <span className="mb-1 block text-[11px] font-bold text-slate-700">زمان مشاهده</span>
                  {p.dateManual ? (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 [&>div]:block">
                        <ShamsiDatePicker value={p.date} onChange={(v) => { p.onDate(v); p.onDateManual(true); }} className={`${inputCls} text-center font-bold cursor-pointer`} />
                      </div>
                      <ClockTimePicker label="ساعت مشاهده" value={p.time} onChange={(v) => { p.onTime(v); p.onDateManual(true); }} className={`${inputCls} w-28 shrink-0 font-bold`} />
                      <button type="button" onClick={p.onResetDateTime} className="!min-h-0 h-11 shrink-0 rounded-xl px-2.5 text-[11px] font-bold text-teal-700 hover:bg-teal-50 cursor-pointer">اکنون</button>
                    </div>
                  ) : (
                    <div className="flex h-11 items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 text-xs font-bold text-emerald-800">
                      <span className="flex items-center gap-1.5 whitespace-nowrap"><Calendar className="h-3.5 w-3.5" /><span dir="ltr">{toPersianDigits(p.date)} · {toPersianDigits(p.time)}</span> <span className="font-medium text-emerald-600">(خودکار)</span></span>
                      <button type="button" onClick={() => p.onDateManual(true)} aria-label="ویرایش زمان" className="!min-h-0 grid h-8 w-8 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-100 cursor-pointer"><Edit3 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-700">متن مشروح مشاهده‌گری <span className="text-rose-500">*</span></span>
                <textarea rows={4} required value={p.content} onChange={(e) => p.onContent(e.target.value)} placeholder="رفتار، گفتار، واکنش هیجانی و جزئیات مشاهده‌شده را بنویسید..." className={`w-full resize-none rounded-2xl border border-slate-200 bg-white p-3.5 text-sm leading-7 text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 ${SCROLL}`} />
              </label>

              {/* برچسب‌ها */}
              <div>
                <span className="mb-1.5 block text-[11px] font-bold text-slate-700">برچسب‌های کلیدی</span>
                <div className="flex flex-wrap gap-2">
                  {[...PRESET_TAGS, ...extraTags].map((t) => (
                    <button key={t} type="button" onClick={() => toggleTag(t)} aria-pressed={tags.includes(t)} className={chip(tags.includes(t), 'sky')}>{tags.includes(t) ? '✓ ' : '#'}{t}</button>
                  ))}
                  <div className="flex h-9 items-center overflow-hidden rounded-full border border-dashed border-slate-300 bg-white">
                    <input value={customTag} onChange={(e) => setCustomTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} placeholder="برچسب دلخواه" aria-label="برچسب دلخواه" className="h-full w-28 bg-transparent px-3 text-xs outline-none" />
                    <button type="button" onClick={addCustom} disabled={!customTag.trim()} aria-label="افزودن برچسب" className="!min-h-0 grid h-full w-9 place-items-center text-emerald-700 hover:bg-emerald-50 disabled:opacity-30 cursor-pointer"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>

              <button type="submit" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#00875A] text-base font-extrabold text-white shadow-md shadow-emerald-700/25 transition hover:bg-emerald-800 active:scale-[.99] cursor-pointer">
                <Save className="h-5 w-5" /> {p.editingId ? 'ذخیره تغییرات' : 'ثبت مشاهده'}
              </button>
            </form>
          ) : p.locked ? (
            <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
              <div className="mb-1 font-black">سوابق مشاهده‌گری نمایش داده نمی‌شود</div>
              {p.lockedMessage}
            </div>
          ) : p.history.length === 0 ? (
            <EmptyState icon={NotebookPen} title="هنوز مشاهده‌ای ثبت نشده است" description="اولین مشاهده‌ی رفتاری این دانش‌آموز را از زبانه‌ی «ثبت مشاهده جدید» ثبت کنید." />
          ) : (
            <ul className="space-y-3">
              {p.history.map((o) => {
                const cat = p.categories.find((c) => c.key === o.category);
                return (
                  <li key={o.id} className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{o.title}</span>
                        <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${cat?.color || 'bg-slate-100 text-slate-800 border-slate-200'}`}>{cat?.label || 'عمومی'}</span>
                        {p.showCoachBadge && o.authorRole === 'coach' && (
                          <span className="whitespace-nowrap rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">ثبت‌شده توسط مربی</span>
                        )}
                      </div>
                      {p.canModify(o) && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button type="button" onClick={() => { p.onEdit(o); setTab('new'); }} title="ویرایش" aria-label="ویرایش" className="!min-h-0 grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-indigo-600 cursor-pointer"><Edit3 className="h-4 w-4" /></button>
                          <button type="button" onClick={() => p.onDelete(o)} title="حذف" aria-label="حذف" className="!min-h-0 grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-rose-600 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{o.content}</p>
                    {o.tags && o.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {o.tags.map((t, i) => <span key={i} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">#{t}</span>)}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /><span dir="ltr">{toPersianDigits(o.date)}</span></span>
                        {o.time && <span dir="ltr">{toPersianDigits(o.time)}</span>}
                        {o.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.location}</span>}
                      </span>
                      <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3" />ثبت: {o.recordedBy}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
