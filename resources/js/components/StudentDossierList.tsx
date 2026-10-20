import React, { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronLeft, Menu, RotateCcw, Search, X } from 'lucide-react';
import { Student } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';

type StatusFilter = 'all' | 'incomplete' | 'complete';

interface ClassOption { id: string; name: string; count: number }

interface Props {
  /** دانش‌آموزان پس از اعمال جستجو و کلاس */
  students: Student[];
  classOptions: ClassOption[];
  totalCount: number;
  selectedClassId: string;
  /** وقتی مربی فقط یک کلاس دارد، گزینه‌ی «همه کلاس‌ها» نمایش داده نمی‌شود */
  lockClass?: boolean;
  searchTerm: string;
  onSearch: (v: string) => void;
  onClassChange: (id: string) => void;
  onBack: () => void;
  onOpenMenu: () => void;
  onOpen: (s: Student) => void;
  isComplete: (s: Student) => boolean;
  className: (classId: string) => string;
  observationCount: (studentId: string) => number;
}

const initials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return p.length > 1 ? `${p[0][0]}‌${p[p.length - 1][0]}` : p[0]?.[0] || '؟';
};

/** فهرست «پرونده تربیتی دانش‌آموزان»؛ فشرده و مناسب موبایل */
export const StudentDossierList: React.FC<Props> = ({
  students, classOptions, totalCount, selectedClassId, lockClass, searchTerm, onSearch, onClassChange,
  onBack, onOpenMenu, onOpen, isComplete, className, observationCount,
}) => {
  const [status, setStatus] = useState<StatusFilter>('all');

  const completeIds = useMemo(() => new Set(students.filter(isComplete).map((s) => s.id)), [students, isComplete]);
  const completeCount = completeIds.size;
  const incompleteCount = students.length - completeCount;
  const shown = status === 'all' ? students : students.filter((s) => (status === 'complete') === completeIds.has(s.id));

  const current = classOptions.find((c) => c.id === selectedClassId);
  const classLabel = selectedClassId === 'all' ? `همه کلاس‌ها (${toPersianDigits(totalCount)})` : `${current?.name ?? '—'} (${toPersianDigits(current?.count ?? 0)})`;
  const filtersActive = searchTerm.trim() !== '' || (selectedClassId !== 'all' && !lockClass) || status !== 'all';
  const reset = () => { onSearch(''); setStatus('all'); if (!lockClass) onClassChange('all'); };

  const chips: { key: StatusFilter; label: string; count: number; on: string; off: string }[] = [
    { key: 'all', label: 'همه', count: students.length, on: 'bg-slate-900 text-white border-slate-900', off: 'bg-white text-slate-600 border-slate-200' },
    { key: 'incomplete', label: 'پرونده‌های ناقص', count: incompleteCount, on: 'bg-amber-500 text-white border-amber-500', off: 'bg-amber-50 text-amber-700 border-amber-200' },
    { key: 'complete', label: 'تکمیل‌شده', count: completeCount, on: 'bg-emerald-600 text-white border-emerald-600', off: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ];

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* هدر فشرده‌ی چسبان */}
      <header className="sticky top-0 z-20 -mx-1 flex h-12 items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white/85 px-2 shadow-xs backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={onBack} aria-label="بازگشت به داشبورد" className="!min-h-0 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="truncate text-sm font-black text-slate-900">پرونده تربیتی دانش‌آموزان</h1>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{toPersianDigits(totalCount)} دانش‌آموز</span>
        </div>
        <button type="button" onClick={onOpenMenu} aria-label="ابزارها و منو" className="!min-h-0 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer lg:hidden">
          <Menu className="h-4 w-4" />
        </button>
      </header>

      {/* جستجو + کلاس */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            id="dossier-search-input"
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="جستجوی نام یا کد..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-9 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchTerm && (
            <button type="button" onClick={() => onSearch('')} aria-label="پاک کردن جستجو" className="!min-h-0 absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <label className="relative shrink-0">
          <span className="sr-only">کلاس</span>
          <span className="flex h-11 max-w-[11.5rem] items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800">
            <span className="font-medium text-slate-500">کلاس:</span>
            <span className="truncate">{classLabel.replace(/^شهید\s+/, 'شهید ')}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </span>
          <select
            id="dossier-class-filter"
            value={selectedClassId}
            onChange={(e) => onClassChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {!lockClass && <option value="all">همه کلاس‌ها ({toPersianDigits(totalCount)})</option>}
            {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name} ({toPersianDigits(c.count)})</option>)}
          </select>
        </label>
      </div>

      {/* چیپ‌های وضعیت */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="وضعیت پرونده">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={status === c.key}
            onClick={() => setStatus(c.key)}
            className={`!min-h-0 h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-xs font-bold transition cursor-pointer ${status === c.key ? c.on : c.off}`}
          >
            {c.label} ({toPersianDigits(c.count)})
          </button>
        ))}
      </div>

      {/* کارت‌ها */}
      {shown.length > 0 ? (
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {shown.map((s) => {
            const complete = completeIds.has(s.id);
            const obs = observationCount(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  id={`dossier-card-${s.id}`}
                  onClick={() => onOpen(s)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 text-right transition hover:border-emerald-500/40 active:bg-slate-50 cursor-pointer"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-extrabold text-emerald-700">{initials(studentFullName(s))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-800">{studentFullName(s)}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">{className(s.classId)} · {toPersianDigits(obs)} مشاهده</span>
                  </span>
                  <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${complete ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    {complete ? 'تکمیل' : 'ناقص'}
                  </span>
                  <ChevronLeft className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:-translate-x-0.5 group-hover:text-emerald-600" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><Search className="h-6 w-6" /></div>
          <h3 className="text-sm font-bold text-slate-800">{totalCount === 0 ? 'دانش‌آموزی در این کلاس ثبت نشده است.' : 'دانش‌آموزی پیدا نشد'}</h3>
          {filtersActive && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 cursor-pointer">
              <RotateCcw className="h-3.5 w-3.5" /> پاک کردن فیلترها
            </button>
          )}
        </div>
      )}
    </div>
  );
};
