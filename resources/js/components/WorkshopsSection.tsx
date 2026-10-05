import React, { useMemo, useState } from 'react';
import { FlaskConical, Hammer, Users, X, Search, Check } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Workshop } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { compareByLastName } from '../utils/morningAttendance';
import { WORKSHOP_DAYS, WORKSHOP_PERIODS, gradeLevelOfClass } from '../utils/workshops';

const EnrollmentModal: React.FC<{ workshop: Workshop; onClose: () => void }> = ({ workshop, onClose }) => {
  const { students, classes, workshops, updateWorkshop, showToast } = useSchool();
  const students0 = students;
  const classById0 = new Map(classes.map((c) => [c.id, c]));
  const [query, setQuery] = useState('');
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
        .filter((s) => !query.trim() || `${s.firstName} ${s.lastName}`.includes(query.trim()) || `${s.lastName} ${s.firstName}`.includes(query.trim()))
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
    if (workshop.capacity && selected.size > workshop.capacity) {
      showToast(`ظرفیت این کارگاه ${toPersianDigits(workshop.capacity)} نفر است.`, 'error');
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

  const tone = workshop.category === 'scientific' ? 'sky' : 'teal';

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className={`px-5 pt-5 pb-3 flex items-center gap-3 shrink-0 ${tone === 'sky' ? 'bg-sky-50/70 border-b border-sky-100' : 'bg-teal-50/70 border-b border-teal-100'}`}>
          <h3 className="text-base font-extrabold text-slate-900 flex-1">تخصیص دانش‌آموزان — {workshop.name} (پایه {workshop.gradeLevel === 9 ? 'نهم' : 'هشتم'})</h3>
          <button type="button" onClick={onClose} aria-label="بستن" className="w-9 h-9 rounded-full hover:bg-white/70 text-slate-500 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-3 space-y-2.5 shrink-0">
          <div className="text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            فقط دانش‌آموزان کلاس‌های پایه {workshop.gradeLevel === 9 ? 'نهم' : 'هشتم'} فهرست می‌شوند.
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی نام دانش‌آموز..."
              className="w-full text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl pr-9 pl-3 py-2.5 outline-none"
            />
          </div>
          <div className="text-[11px] text-slate-500">{toPersianDigits(selected.size)} نفر انتخاب شده است.</div>
        </div>

        <div className="px-5 py-3 overflow-y-auto flex-1 min-h-0">
          <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {candidates.map((s) => {
              const other = otherMembership.get(s.id);
              return (
                <label key={s.id} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-slate-50/80 text-sm">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="w-4 h-4 accent-emerald-600" />
                  <span className="flex-1 font-semibold text-slate-800 whitespace-nowrap">
                    {s.lastName} {s.firstName}
                  </span>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{classById.get(s.classId)?.name}</span>
                  {other && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold whitespace-nowrap">
                      ثبت‌شده در کارگاه دیگر ({other})
                    </span>
                  )}
                </label>
              );
            })}
            {candidates.length === 0 && <div className="py-8 text-center text-xs text-slate-400">دانش‌آموزی یافت نشد.</div>}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          <button type="button" onClick={save} className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-extrabold shadow-sm cursor-pointer inline-flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            <span>ذخیره تخصیص</span>
          </button>
          <button type="button" onClick={onClose} className="h-12 px-5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
};

/** تب «کارگاه‌های انتخابی» در صفحه برنامه دروس و اساتید */
export const WorkshopsSection: React.FC = () => {
  const { workshops, updateWorkshop, assignableStaff, isAdmin, isEducationalVice } = useSchool();
  const canManage = isAdmin || isEducationalVice;
  const [enrolling, setEnrolling] = useState<Workshop | null>(null);
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
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <g.Icon className="w-4 h-4" />
            <span>{g.title}</span>
          </h3>
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
                    <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-600 inline-flex items-center gap-1 whitespace-nowrap">
                      <Users className="w-3 h-3" />
                      {toPersianDigits(w.studentIds.length)}{w.capacity ? ` / ${toPersianDigits(w.capacity)}` : ''} نفر
                    </span>
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

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="block text-[11px] font-bold text-slate-500 mb-1">روز</span>
                      <select value={w.day || ''} disabled={!canManage} onChange={(e) => updateWorkshop(w.id, { day: e.target.value || undefined })} className={selectClass}>
                        <option value="">—</option>
                        {WORKSHOP_DAYS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="block text-[11px] font-bold text-slate-500 mb-1">زنگ</span>
                      <select value={w.period || ''} disabled={!canManage} onChange={(e) => updateWorkshop(w.id, { period: e.target.value || undefined })} className={selectClass}>
                        <option value="">—</option>
                        {WORKSHOP_PERIODS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="block text-[11px] font-bold text-slate-500 mb-1">ظرفیت (نفر)</span>
                    <input
                      type="number"
                      min={0}
                      value={w.capacity ?? ''}
                      disabled={!canManage}
                      onChange={(e) => updateWorkshop(w.id, { capacity: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
                      placeholder="بدون محدودیت"
                      className={selectClass}
                    />
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

      {enrolling && <EnrollmentModal workshop={enrolling} onClose={() => setEnrolling(null)} />}
    </div>
  );
};
