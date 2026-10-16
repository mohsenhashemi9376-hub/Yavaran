import React, { useMemo, useState } from 'react';
import { FlaskConical, Hammer, Users, X, Search, Check, Plus, Pencil, Trash2, Info } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Workshop } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { compareByLastName } from '../utils/morningAttendance';
import { gradeLevelOfClass } from '../utils/workshops';
import { studentFullName } from '../utils/studentName';

const EnrollmentModal: React.FC<{ workshop: Workshop; onClose: () => void }> = ({ workshop, onClose }) => {
  const { students, classes, workshops, updateWorkshop, showToast } = useSchool();
  const students0 = students;
  const classById0 = new Map(classes.map((c) => [c.id, c]));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'free' | 'selected'>('all');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(workshop.studentIds.filter((id) => gradeLevelOfClass(classById0.get(students0.find((s) => s.id === id)?.classId || '')) === workshop.gradeLevel))
  );

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const candidatesAll = useMemo(
    () => students.filter((s) => gradeLevelOfClass(classById.get(s.classId)) === workshop.gradeLevel),
    [students, classById, workshop.gradeLevel]
  );
  const candidates = useMemo(
    () =>
      students
        // فقط دانش‌آموزان کلاس‌های همین پایه
        .filter((s) => gradeLevelOfClass(classById.get(s.classId)) === workshop.gradeLevel)
        .filter((s) => !query.trim() || `${studentFullName(s)}`.includes(query.trim()) || `${studentFullName(s)}`.includes(query.trim()))
        .sort(compareByLastName),
    [students, classById, workshop.gradeLevel, query]
  );

  // عضویت در کارگاه دیگرِ همان دسته
  const otherMembership = useMemo(() => {
    const map = new Map<string, string>();
    workshops
      .filter((w) => w.id !== workshop.id && w.gradeLevel === workshop.gradeLevel && w.category === workshop.category)
      .forEach((w) => w.studentIds.forEach((sid) => map.set(sid, w.name)));
    return map;
  }, [workshops, workshop]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () => {
    // دانش‌آموز نمی‌تواند هم‌زمان در دو کارگاه یک دسته باشد
    const validIds = new Set(candidatesAll.map((s) => s.id));
    if (Array.from(selected).some((id) => !validIds.has(id))) {
      showToast(`فقط دانش‌آموزان پایه ${workshop.gradeLevel === 9 ? 'نهم' : 'هشتم'} قابل تخصیص هستند.`, 'error');
      return;
    }
    const conflicts = Array.from(selected).filter((id) => otherMembership.has(id));
    if (conflicts.length > 0) {
      showToast('برخی دانش‌آموزان انتخاب‌شده در کارگاه دیگری از همین دسته عضو هستند. ابتدا انتخاب آن‌ها را بردارید.', 'error');
      return;
    }
    updateWorkshop(workshop.id, { studentIds: Array.from(selected) });
    showToast(`فهرست ${workshop.name} ذخیره شد.`, 'success');
    onClose();
  };

  const filtered = candidates.filter((s) => {
    const locked = otherMembership.has(s.id) && !selected.has(s.id);
    if (filter === 'free') return !locked;
    if (filter === 'selected') return selected.has(s.id);
    return true;
  });
  const chips: { key: 'all' | 'free' | 'selected'; label: string }[] = [
    { key: 'all', label: 'همه دانش‌آموزان' },
    { key: 'free', label: 'فقط قابل انتخاب (آزاد)' },
    { key: 'selected', label: `انتخاب‌شده‌ها (${toPersianDigits(selected.size)})` },
  ];
  const gradeLabel = workshop.gradeLevel === 9 ? 'نهم' : 'هشتم';

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl h-[92dvh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* هدر و فیلترهای چسبان */}
        <div className="shrink-0 bg-white border-b border-slate-200">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 flex-1 leading-7">تخصیص دانش‌آموزان — {workshop.name} (پایه {gradeLabel})</h3>
            <button type="button" onClick={onClose} aria-label="بستن" className="w-11 h-11 -ml-2 rounded-full active:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 space-y-2.5">
            <div className="flex items-start gap-2 text-[11px] leading-5 font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                فقط دانش‌آموزان پایه {gradeLabel} فهرست می‌شوند. دانش‌آموزی که در کارگاه {workshop.category === 'scientific' ? 'علمی' : 'مهارتی'} دیگری عضو است، در این کارگاه قابل انتخاب نیست.
              </p>
            </div>

            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی نام دانش‌آموز..."
                className="w-full h-11 text-base sm:text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl pr-10 pl-10 outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="پاک کردن جستجو" className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full text-slate-400 active:bg-slate-100 flex items-center justify-center cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(c.key)}
                  aria-pressed={filter === c.key}
                  className={`shrink-0 h-9 px-4 rounded-full border text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    filter === c.key ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-600 active:bg-slate-100'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-1 px-4 h-10 flex items-center justify-between bg-slate-50 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-600">{toPersianDigits(selected.size)} دانش‌آموز انتخاب شده</span>
            <button type="button" onClick={() => setSelected(new Set())} disabled={selected.size === 0} className="h-9 px-2 font-bold text-emerald-600 disabled:text-slate-300 cursor-pointer disabled:cursor-not-allowed">
              لغو انتخاب‌ها
            </button>
          </div>
        </div>

        {/* لیست */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
          <ul className="divide-y divide-slate-100">
            {filtered.map((s) => {
              const other = otherMembership.get(s.id);
              // عضو کارگاه موازی (همان پایه و همان دسته): تا زمانی که از آن کارگاه خارج نشود، قابل انتخاب نیست
              const locked = !!other && !selected.has(s.id);
              const checked = selected.has(s.id);
              return (
                <li key={s.id}>
                  <label
                    title={locked ? `ابتدا باید از کارگاه «${other}» خارج شود.` : undefined}
                    className={`flex items-center gap-3 px-4 min-h-[64px] py-2.5 ${
                      locked ? 'opacity-50 cursor-not-allowed bg-slate-50' : checked ? 'bg-emerald-50/60 cursor-pointer active:bg-emerald-50' : 'cursor-pointer active:bg-slate-50'
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-[15px] text-slate-900 break-words">{studentFullName(s)}</span>
                      <span className="mt-1 inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[11px] leading-4">کلاس {classById.get(s.classId)?.name}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      {other && (
                        <span className="max-w-[9rem] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold leading-5 truncate">
                          {locked ? 'عضو کارگاه' : 'عضو کارگاه دیگر'} {other}
                        </span>
                      )}
                      <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggle(s.id)} className="w-6 h-6 shrink-0 accent-emerald-500 disabled:cursor-not-allowed" />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 && <div className="py-12 text-center text-xs text-slate-400">دانش‌آموزی یافت نشد.</div>}
        </div>

        {/* نوار چسبان پایین */}
        <div className="shrink-0 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3 shadow-[0_-4px_12px_rgba(15,23,42,0.08)]">
          <button type="button" onClick={save} className="flex-1 h-12 rounded-2xl bg-emerald-500 active:bg-emerald-600 hover:bg-emerald-600 text-white text-sm font-extrabold shadow-sm cursor-pointer inline-flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            <span>ذخیره تخصیص ({toPersianDigits(selected.size)} نفر)</span>
          </button>
          <button type="button" onClick={onClose} className="h-12 px-5 rounded-2xl text-sm font-bold text-slate-500 active:bg-slate-100 hover:bg-slate-100 cursor-pointer">
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
};


/** فرم افزودن / ویرایش کارگاه */
const WorkshopFormModal: React.FC<{
  workshop?: Workshop;
  defaultCategory: Workshop['category'];
  defaultGrade: 8 | 9;
  onClose: () => void;
}> = ({ workshop, defaultCategory, defaultGrade, onClose }) => {
  const { addWorkshop, updateWorkshop, assignableStaff, showToast } = useSchool();
  const [name, setName] = useState(workshop?.name || '');
  const [category, setCategory] = useState<Workshop['category']>(workshop?.category || defaultCategory);
  const [gradeLevel, setGradeLevel] = useState<8 | 9>(workshop?.gradeLevel || defaultGrade);
  const [teacherId, setTeacherId] = useState(workshop?.teacherId || '');

  const field = 'w-full text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3 py-2.5 outline-none';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('نام کارگاه را وارد کنید.', 'error');
      return;
    }
    const teacher = assignableStaff.find((u) => u.id === teacherId);
    if (workshop) {
      // با تغییر پایه، دانش‌آموزان پایه قبلی از کارگاه خارج می‌شوند
      const gradeChanged = workshop.gradeLevel !== gradeLevel;
      updateWorkshop(workshop.id, {
        name: name.trim(),
        category,
        gradeLevel,
        teacherId: teacher?.id,
        teacherName: teacher?.name,
        ...(gradeChanged ? { studentIds: [] } : {}),
      });
      showToast('کارگاه ویرایش شد.', 'success');
    } else {
      const id = addWorkshop({ name, category, gradeLevel, teacherId: teacher?.id, teacherName: teacher?.name });
      if (id) showToast('کارگاه جدید افزوده شد.', 'success');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
      <form onSubmit={submit} className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900 flex-1">{workshop ? 'ویرایش کارگاه' : 'افزودن کارگاه'}</h3>
          <button type="button" onClick={onClose} aria-label="بستن" className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">نام کارگاه</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً رباتیک" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-bold text-slate-500 mb-1">نوع کارگاه</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as Workshop['category'])} className={field}>
                <option value="scientific">علمی</option>
                <option value="skill">مهارتی</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold text-slate-500 mb-1">پایه</span>
              <select value={gradeLevel} onChange={(e) => setGradeLevel(Number(e.target.value) === 9 ? 9 : 8)} className={field}>
                <option value={8}>هشتم</option>
                <option value={9}>نهم</option>
              </select>
            </label>
          </div>
          {workshop && workshop.gradeLevel !== gradeLevel && workshop.studentIds.length > 0 && (
            <div className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              با تغییر پایه، فهرست دانش‌آموزان این کارگاه پاک می‌شود.
            </div>
          )}
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">استاد / مربی مسئول</span>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className={field}>
              <option value="">— تخصیص نشده —</option>
              {assignableStaff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button type="submit" className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-extrabold shadow-sm cursor-pointer inline-flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            <span>{workshop ? 'ذخیره تغییرات' : 'افزودن'}</span>
          </button>
          <button type="button" onClick={onClose} className="h-12 px-5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
            انصراف
          </button>
        </div>
      </form>
    </div>
  );
};

/** تب «کارگاه‌های انتخابی» در صفحه برنامه دروس و اساتید */
export const WorkshopsSection: React.FC = () => {
  const { workshops, updateWorkshop, deleteWorkshop, assignableStaff, isAdmin, isEducationalVice, showToast, showConfirm } = useSchool();
  const canManage = isAdmin || isEducationalVice;
  const [enrolling, setEnrolling] = useState<Workshop | null>(null);
  const [form, setForm] = useState<{ workshop?: Workshop; category: Workshop['category'] } | null>(null);
  const [grade, setGrade] = useState<8 | 9>(8);
  const gradeName = grade === 9 ? 'نهم' : 'هشتم';

  const groups = [
    { key: 'scientific' as const, title: 'کارگاه‌های علمی', Icon: FlaskConical, box: 'bg-sky-50/60 border-sky-200/80', card: 'border-sky-200/80', btn: 'bg-sky-100/70 hover:bg-sky-100 text-sky-800 border-sky-200' },
    { key: 'skill' as const, title: 'کارگاه‌های مهارتی', Icon: Hammer, box: 'bg-teal-50/60 border-teal-200/80', card: 'border-teal-200/80', btn: 'bg-teal-100/70 hover:bg-teal-100 text-teal-800 border-teal-200' },
  ];

  const selectClass = 'w-full text-xs bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-2.5 py-2 outline-none disabled:opacity-60 cursor-pointer';

  return (
    <div className="space-y-5" dir="rtl">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="پایه">
        {([8, 9] as const).map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={grade === g}
            onClick={() => setGrade(g)}
            className={`px-4 py-3 rounded-2xl border text-sm font-extrabold transition cursor-pointer whitespace-nowrap ${
              grade === g
                ? g === 8
                  ? 'bg-sky-100/70 text-sky-900 border-sky-300 ring-2 ring-sky-200 shadow-sm'
                  : 'bg-violet-100/70 text-violet-900 border-violet-300 ring-2 ring-violet-200 shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            پایه {g === 8 ? 'هشتم' : 'نهم'} ({toPersianDigits(workshops.filter((w) => w.gradeLevel === g).length)} کارگاه)
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.key} className={`rounded-2xl border p-4 space-y-3 ${g.box}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <g.Icon className="w-4 h-4" />
              <span>{g.title}</span>
            </h3>
            {canManage && (
              <button
                type="button"
                onClick={() => setForm({ category: g.key })}
                className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${g.btn}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن کارگاه</span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {workshops
              .filter((w) => w.category === g.key && w.gradeLevel === grade)
              .map((w) => (
                <div key={w.id} className={`bg-white rounded-2xl border p-4 space-y-3 shadow-xs ${g.card}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block text-base font-extrabold text-slate-900 whitespace-nowrap">{w.name}</span>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap ${
                        w.gradeLevel === 8 ? 'bg-sky-50 text-sky-800 border-sky-200' : 'bg-violet-50 text-violet-800 border-violet-200'
                      }`}>
                        {w.category === 'scientific' ? 'کارگاه علمی' : 'کارگاه مهارتی'} {w.name} • پایه {gradeName}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600 inline-flex items-center gap-1 whitespace-nowrap">
                      <Users className="w-3 h-3" />
                      {toPersianDigits(w.studentIds.length)} نفر
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="ویرایش کارگاه"
                          aria-label="ویرایش کارگاه"
                          onClick={() => setForm({ workshop: w, category: w.category })}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="حذف کارگاه"
                          aria-label="حذف کارگاه"
                          onClick={() => {
                            const warn = w.studentIds.length > 0 ? ` فهرست ${toPersianDigits(w.studentIds.length)} دانش‌آموز آن هم پاک می‌شود.` : '';
                            showConfirm({
                              title: 'حذف شود؟',
                              message: `کارگاه «${w.name}» (پایه ${w.gradeLevel === 9 ? 'نهم' : 'هشتم'}) حذف شود؟${warn}`,
                              confirmLabel: 'بله، حذف شود',
                              cancelLabel: 'انصراف',
                              isDangerous: true,
                              onConfirm: () => {
                              deleteWorkshop(w.id);
                              showToast('کارگاه حذف شد.', 'success');
                            
                              },
                            });
                          }}
                          className="w-8 h-8 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    </div>
                  </div>

                  <label className="block">
                    <span className="block text-[11px] font-bold text-slate-500 mb-1">استاد / مربی مسئول</span>
                    <select
                      value={w.teacherId || ''}
                      disabled={!canManage}
                      onChange={(e) => {
                        const t = assignableStaff.find((u) => u.id === e.target.value);
                        updateWorkshop(w.id, { teacherId: t?.id, teacherName: t?.name });
                      }}
                      className={selectClass}
                    >
                      <option value="">— تخصیص نشده —</option>
                      {assignableStaff.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setEnrolling(w)}
                      className={`w-full min-h-[40px] rounded-xl border text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${g.btn}`}
                    >
                      تخصیص دانش‌آموزان
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}

      {form && <WorkshopFormModal workshop={form.workshop} defaultCategory={form.category} defaultGrade={grade} onClose={() => setForm(null)} />}
      {enrolling && <EnrollmentModal workshop={enrolling} onClose={() => setEnrolling(null)} />}
    </div>
  );
};
