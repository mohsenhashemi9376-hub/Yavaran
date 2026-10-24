import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarRange, Check, CheckCircle2, Plus, Search, Sparkles, Users } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { getCurrentAcademicYear, toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { WorkspaceTitleBar } from './ui/WorkspaceHeader';
import { Modal } from './ui/Modal';

interface Props {
  onBack: () => void;
  onOpenSidebar: () => void;
}

const key = (v?: string) => toEnglishDigits((v || '').trim());
const startOf = (name: string) => Number((key(name).match(/^(\d{4})/) || [])[1]) || 0;

/**
 * مدیریت سال تحصیلی و انتقال دانش‌آموزان (فقط مدیر سامانه).
 * ایجاد دوره‌ی جدید هیچ دانش‌آموزی را خودکار منتقل نمی‌کند؛ مدیر در پنل انتقال دانش‌آموزان دوره‌ی مبدأ را
 * تک‌به‌تک یا گروهی به کلاس‌های دوره‌ی مقصد منتقل می‌کند. پرونده‌ی دوره‌ی مبدأ دست‌نخورده می‌ماند و
 * برای دوره‌ی مقصد پرونده‌ی تازه (با نمره‌ی انضباط ۲۰) ساخته می‌شود.
 */
export const AcademicTermsWorkspace: React.FC<Props> = ({ onBack, onOpenSidebar }) => {
  const { schoolSettings, classes, students, addAcademicTerm, updateAcademicYear, transferStudentsToTerm, addClass, showConfirm, showToast } = useSchool();

  const activeYear = schoolSettings.academicYear || getCurrentAcademicYear();
  const activeKey = key(activeYear);

  // همه‌ی دوره‌های شناخته‌شده: جاری + تعریف‌شده + دوره‌ی کلاس‌های موجود
  const terms = useMemo(() => {
    const names = new Map<string, { name: string; startDate?: string; endDate?: string }>();
    const put = (n?: string, extra: { startDate?: string; endDate?: string } = {}) => {
      if (!n || !/^\d{4}-\d{4}$/.test(key(n))) return;
      const k = key(n);
      names.set(k, { name: toPersianDigits(k), ...names.get(k), ...extra });
    };
    put(activeYear);
    (schoolSettings.academicTerms || []).forEach((t) => put(t.name, { startDate: t.startDate, endDate: t.endDate }));
    classes.forEach((c) => put(c.academicYear));
    return [...names.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => startOf(b.key) - startOf(a.key));
  }, [activeYear, schoolSettings.academicTerms, classes]);

  const classesOf = (termKey: string) => classes.filter((c) => key(c.academicYear) === termKey && !c.isWorkshop);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  // ---------------- ایجاد دوره‌ی جدید ----------------
  const suggestedStart = Math.max(...terms.map((t) => startOf(t.key)), 1405) + 1;
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const openCreate = () => {
    setNewName(`${suggestedStart}-${suggestedStart + 1}`);
    setNewStart(`${suggestedStart}/07/01`);
    setNewEnd(`${suggestedStart + 1}/03/31`);
    setCreateOpen(true);
  };
  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (addAcademicTerm({ name: newName, startDate: newStart, endDate: newEnd })) setCreateOpen(false);
  };

  // ---------------- انتقال ----------------
  const [fromKey, setFromKey] = useState('');
  const [toKey, setToKey] = useState('');
  useEffect(() => {
    if (!fromKey && terms.length) setFromKey(activeKey);
  }, [terms, fromKey, activeKey]);
  useEffect(() => {
    if (!toKey || toKey === fromKey) {
      const next = terms.find((t) => startOf(t.key) > startOf(fromKey)) || terms.find((t) => t.key !== fromKey);
      setToKey(next?.key || '');
    }
  }, [terms, fromKey, toKey]);

  const sourceStudents = useMemo(
    () => students.filter((s) => key(classById.get(s.classId)?.academicYear) === fromKey).sort((a, b) => studentFullName(a).localeCompare(studentFullName(b), 'fa')),
    [students, classById, fromKey]
  );
  const destClasses = useMemo(() => classesOf(toKey), [classes, toKey]);
  const destIds = useMemo(() => new Set(destClasses.map((c) => c.id)), [destClasses]);

  /** پرونده‌ی منتقل‌شده‌ی هر دانش‌آموز در دوره‌ی مقصد */
  const transferredTo = useMemo(() => {
    const m = new Map<string, string>();
    students.forEach((s) => { if (s.rolledOverFromId && destIds.has(s.classId)) m.set(s.rolledOverFromId, s.classId); });
    return m;
  }, [students, destIds]);

  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destPick, setDestPick] = useState<Record<string, string>>({});
  const [bulkDest, setBulkDest] = useState('');

  useEffect(() => { setSelected(new Set()); setDestPick({}); setClassFilter(''); setBulkDest(''); }, [fromKey, toKey]);

  const visible = useMemo(() => {
    const q = query.trim();
    return sourceStudents.filter((s) => (!classFilter || s.classId === classFilter) && (!q || studentFullName(s).includes(q)));
  }, [sourceStudents, query, classFilter]);
  const pending = visible.filter((s) => !transferredTo.has(s.id));
  const allSelected = pending.length > 0 && pending.every((s) => selected.has(s.id));
  const selectedPending = [...selected].filter((id) => !transferredTo.has(id));

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pending.map((s) => s.id)));
  const applyBulkDest = (cid: string) => {
    setBulkDest(cid);
    if (!cid) return;
    setDestPick((prev) => { const n = { ...prev }; selectedPending.forEach((id) => { n[id] = cid; }); return n; });
  };

  const sameTerm = !fromKey || !toKey || fromKey === toKey;

  const doTransfer = (ids: string[]) => {
    const items = ids.map((id) => ({ studentId: id, destClassId: destPick[id] })).filter((i) => i.destClassId);
    const missing = ids.length - items.length;
    if (items.length === 0) { showToast('برای دانش‌آموز انتخاب‌شده کلاس مقصد را مشخص کنید.', 'error'); return; }
    showConfirm({
      title: 'تأیید انتقال به دوره‌ی جدید',
      message: `${toPersianDigits(items.length)} دانش‌آموز از دوره‌ی ${toPersianDigits(fromKey)} به دوره‌ی ${toPersianDigits(toKey)} منتقل شود؟${missing > 0 ? ` (${toPersianDigits(missing)} مورد بدون کلاس مقصد انتقال نمی‌یابد.)` : ''} پرونده‌ی دوره‌ی قبل دست‌نخورده می‌ماند.`,
      confirmLabel: 'تأیید و انتقال',
      cancelLabel: 'انصراف',
      onConfirm: () => {
        transferStudentsToTerm(items);
        setSelected((prev) => { const n = new Set(prev); items.forEach((i) => n.delete(i.studentId)); return n; });
      },
    });
  };

  const cloneClasses = () => {
    const src = classesOf(fromKey);
    const existing = new Set(destClasses.map((c) => c.name));
    const todo = src.filter((c) => !existing.has(c.name));
    if (todo.length === 0) { showToast('کلاس‌های دوره‌ی مبدأ از قبل در دوره‌ی مقصد وجود دارند.', 'info'); return; }
    showConfirm({
      title: 'ساخت کلاس‌های دوره‌ی مقصد',
      message: `${toPersianDigits(todo.length)} کلاس با همان نام و پایه برای دوره‌ی ${toPersianDigits(toKey)} ساخته شود؟ (بدون دانش‌آموز، معلم و مربی؛ بعداً می‌توانید نام و تخصیص را ویرایش کنید.)`,
      confirmLabel: 'ساخت کلاس‌ها',
      cancelLabel: 'انصراف',
      onConfirm: () => todo.forEach((c) => addClass({ name: c.name, grade: c.grade, major: c.major, academicYear: toPersianDigits(toKey), teacherIds: [] })),
    });
  };

  const activate = (t: { key: string; name: string }) =>
    showConfirm({
      title: 'فعال‌سازی دوره',
      message: `دوره‌ی ${t.name} به‌عنوان سال تحصیلی جاری سامانه تنظیم شود؟`,
      confirmLabel: 'فعال‌سازی',
      cancelLabel: 'انصراف',
      onConfirm: () => updateAcademicYear(t.name),
    });

  const selectCls = 'h-11 w-full bg-white border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer';
  const transferredCount = sourceStudents.filter((s) => transferredTo.has(s.id)).length;

  return (
    <div className="space-y-5 pb-28" dir="rtl">
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
        <WorkspaceTitleBar
          title="سال تحصیلی و انتقال دانش‌آموزان"
          icon={CalendarRange}
          section="تنظیمات"
          subtitle="دوره‌ی جدید بسازید و دانش‌آموزان را با تأیید خودتان به آن منتقل کنید."
          onBack={onBack}
          onOpenSidebar={onOpenSidebar}
        />
      </div>

      {/* دوره‌ی فعال */}
      <section className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-white/70 backdrop-blur-sm p-4 sm:p-5 shadow-sm flex items-center gap-3 flex-wrap">
        <span className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm"><Sparkles className="w-6 h-6" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-emerald-700">دوره‌ی تحصیلی فعال</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">{toPersianDigits(activeYear)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">مهر {toPersianDigits(startOf(activeKey))} تا خرداد {toPersianDigits(startOf(activeKey) + 1)}</div>
        </div>
        <button type="button" onClick={openCreate} className="h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-sm inline-flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> ایجاد دوره‌ی تحصیلی جدید
        </button>
      </section>

      {/* فهرست دوره‌ها */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {terms.map((t) => {
          const isActive = t.key === activeKey;
          return (
            <div key={t.key} className={`rounded-2xl border p-3.5 flex items-center gap-3 ${isActive ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
              <div className="min-w-0 flex-1">
                <div className="font-black text-slate-900 tabular-nums">{t.name}</div>
                <div className="text-[11px] text-slate-500">{toPersianDigits(classesOf(t.key).length)} کلاس · {toPersianDigits(students.filter((s) => key(classById.get(s.classId)?.academicYear) === t.key).length)} دانش‌آموز</div>
              </div>
              {isActive ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold">فعال</span>
              ) : (
                <button type="button" onClick={() => activate(t)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer">فعال‌سازی</button>
              )}
            </div>
          );
        })}
      </section>

      {/* انتقال */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2"><ArrowLeftRight className="w-4 h-4 text-emerald-700" /> انتقال دانش‌آموزان به دوره‌ی جدید</h2>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          <label className="block text-[11px] font-bold text-slate-600 space-y-1">دوره‌ی مبدأ
            <select value={fromKey} onChange={(e) => setFromKey(e.target.value)} className={selectCls}>
              {terms.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
          </label>
          <span className="hidden sm:flex h-11 items-center text-slate-300"><ArrowLeftRight className="w-5 h-5" /></span>
          <label className="block text-[11px] font-bold text-slate-600 space-y-1">دوره‌ی مقصد
            <select value={toKey} onChange={(e) => setToKey(e.target.value)} className={selectCls}>
              {terms.filter((t) => t.key !== fromKey).map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
          </label>
        </div>

        {sameTerm ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">برای انتقال، یک دوره‌ی مقصد متفاوت از مبدأ انتخاب کنید (در صورت نیاز ابتدا دوره‌ی جدید بسازید).</div>
        ) : (
          <>
            {destClasses.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-3 flex-wrap">
                <span className="flex-1 min-w-[12rem] leading-6">برای دوره‌ی {toPersianDigits(toKey)} هنوز کلاسی وجود ندارد؛ برای انتقال لازم است کلاس مقصد داشته باشید.</span>
                <button type="button" onClick={cloneClasses} className="h-10 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer">ساخت کلاس‌ها از روی دوره‌ی مبدأ</button>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="relative flex-1 min-w-[10rem]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی دانش‌آموز…" className="w-full h-11 pr-9 pl-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-600" />
              </div>
              <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 outline-none cursor-pointer">
                <option value="">همه‌ی کلاس‌های مبدأ</option>
                {classesOf(fromKey).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="text-[11px] font-bold text-slate-500">{toPersianDigits(transferredCount)} از {toPersianDigits(sourceStudents.length)} منتقل‌شده</span>
            </div>

            {sourceStudents.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-400"><Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />در دوره‌ی مبدأ دانش‌آموزی وجود ندارد.</div>
            ) : (
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 bg-slate-50 px-3 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-600">
                  <label className="flex items-center gap-2 cursor-pointer select-none min-h-11">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={pending.length === 0} className="w-5 h-5 accent-emerald-600 cursor-pointer" />
                    انتخاب همه ({toPersianDigits(pending.length)})
                  </label>
                  <span className="hidden sm:block mr-auto w-56 text-center">کلاس مقصد</span>
                  <span className="hidden sm:block w-28 text-center">وضعیت / اقدام</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {visible.map((s) => {
                    const done = transferredTo.get(s.id);
                    const cls = classById.get(s.classId);
                    return (
                      <li key={s.id} className={`flex flex-col sm:flex-row sm:items-center gap-2.5 px-3 py-2.5 ${done ? 'bg-emerald-50' : 'bg-white'}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <input type="checkbox" aria-label={`انتخاب ${studentFullName(s)}`} checked={selected.has(s.id)} disabled={Boolean(done)} onChange={() => toggle(s.id)} className="w-5 h-5 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed shrink-0" />
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 truncate">{studentFullName(s)}</div>
                            <div className="text-[11px] text-slate-500">پایه {cls?.grade || '—'} · {cls?.name || '—'}</div>
                          </div>
                        </div>
                        {done ? (
                          <div className="flex items-center gap-2 sm:mr-auto">
                            <span className="text-[11px] text-slate-500">{classById.get(done)?.name}</span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> منتقل‌شد</span>
                            <button type="button" disabled className="h-11 w-28 rounded-xl bg-emerald-100 text-emerald-400 text-xs font-bold cursor-not-allowed hidden sm:block">ثبت شد</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 sm:mr-auto">
                            <select value={destPick[s.id] || ''} onChange={(e) => setDestPick((p) => ({ ...p, [s.id]: e.target.value }))} aria-label="کلاس مقصد" disabled={destClasses.length === 0} className="h-11 flex-1 sm:w-56 sm:flex-none bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer disabled:opacity-50">
                              <option value="">کلاس مقصد…</option>
                              {destClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button type="button" onClick={() => doTransfer([s.id])} disabled={!destPick[s.id]} className="h-11 px-3 shrink-0 sm:w-28 rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-extrabold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                              تأیید و ثبت
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {visible.length === 0 && <li className="py-8 text-center text-xs text-slate-400">موردی یافت نشد.</li>}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* نوار اکشن چسبان */}
      {!sameTerm && selectedPending.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 md:bottom-4 z-30 px-3 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto rounded-2xl border border-emerald-200 bg-white/90 backdrop-blur-md shadow-lg p-2.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-slate-800 px-1">{toPersianDigits(selectedPending.length)} انتخاب‌شده</span>
            <select value={bulkDest} onChange={(e) => applyBulkDest(e.target.value)} aria-label="کلاس مقصد گروهی" className="h-11 flex-1 min-w-[9rem] bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-xs font-bold text-slate-700 outline-none cursor-pointer">
              <option value="">کلاس مقصد برای همه…</option>
              {destClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={() => doTransfer(selectedPending)} className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer">
              <Check className="w-4 h-4" /> تأیید و انتقال گروهی {toPersianDigits(selectedPending.length)} دانش‌آموز
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="ایجاد دوره‌ی تحصیلی جدید"
        subtitle="دانش‌آموزی به‌صورت خودکار منتقل نمی‌شود"
        icon={<CalendarRange className="w-5 h-5" />}
        footer={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="h-11 px-4 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold cursor-pointer">انصراف</button>
            <button type="submit" form="term-create-form" className="h-11 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold cursor-pointer">ایجاد دوره</button>
          </div>
        }
      >
        <form id="term-create-form" onSubmit={submitCreate} className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 space-y-1">نام دوره (مثلاً ۱۴۰۶-۱۴۰۷)
            <input value={toPersianDigits(newName)} onChange={(e) => setNewName(toEnglishDigits(e.target.value))} dir="ltr" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-600" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-slate-700 space-y-1">تاریخ شروع (مهر)
              <input value={toPersianDigits(newStart)} onChange={(e) => setNewStart(toEnglishDigits(e.target.value))} dir="ltr" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-600" />
            </label>
            <label className="block text-xs font-bold text-slate-700 space-y-1">تاریخ پایان (خرداد)
              <input value={toPersianDigits(newEnd)} onChange={(e) => setNewEnd(toEnglishDigits(e.target.value))} dir="ltr" className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-600" />
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
};
