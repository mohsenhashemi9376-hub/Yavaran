import React, { useMemo, useState } from 'react';
import { Clock, Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { TeacherActivity } from '../types';
import {
  getDayOfWeekFromShamsi,
  getDaysInShamsiMonth,
  getTodayShamsi,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/persianDate';
import { academicMonths, currentMonthKey, formatHours, monthKeyOf, parseHours } from '../utils/teacherActivities';

/** «فعالیت خارج مدرسه» — ثبت ساعات کار اضافه معلم (پنل معلمان) */
export const TeacherActivitiesSection: React.FC = () => {
  const { currentUser, teacherActivities, addTeacherActivity, updateTeacherActivity, deleteTeacherActivity, showToast, showConfirm } =
    useSchool();

  const months = useMemo(() => academicMonths(), []);
  const today = getTodayShamsi();
  const [monthKey, setMonthKey] = useState<string>(() => {
    const cur = currentMonthKey();
    return months.some((m) => m.key === cur) ? cur : months[0].key;
  });
  const selected = months.find((m) => m.key === monthKey) || months[0];
  const daysInMonth = getDaysInShamsiMonth(selected.year, selected.month);

  const defaultDay = () =>
    monthKey === currentMonthKey() ? today.day : 1;

  const [day, setDay] = useState<number>(defaultDay());
  const [title, setTitle] = useState('');
  const [hoursText, setHoursText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fullDate = (d: number) => `${selected.year}/${String(selected.month).padStart(2, '0')}/${String(d).padStart(2, '0')}`;

  const mine = useMemo(
    () =>
      teacherActivities
        .filter((a) => a.teacherId === currentUser.id && monthKeyOf(a.date) === monthKey)
        .sort((a, b) => toEnglishDigits(b.date).localeCompare(toEnglishDigits(a.date)) || b.createdAt.localeCompare(a.createdAt)),
    [teacherActivities, currentUser.id, monthKey]
  );
  const totalHours = mine.reduce((sum, a) => sum + (a.hours || 0), 0);

  const changeMonth = (key: string) => {
    setMonthKey(key);
    const m = months.find((x) => x.key === key);
    setDay(key === currentMonthKey() ? today.day : 1);
    resetForm(false);
    void m;
  };

  const resetForm = (resetDay = true) => {
    setEditingId(null);
    setTitle('');
    setHoursText('');
    setError('');
    if (resetDay) setDay(defaultDay());
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseHours(hoursText);
    if (title.trim().length < 2) return setError('عنوان و شرح فعالیت را وارد کنید.');
    if (hours === null) return setError('مدت زمان را به ساعت و عددی بین ۰٫۲۵ تا ۲۴ وارد کنید (مثلاً ۱٫۵).');

    if (editingId) {
      updateTeacherActivity(editingId, { date: fullDate(day), title: title.trim(), hours });
      showToast('فعالیت ویرایش شد.', 'success');
    } else {
      addTeacherActivity({ date: fullDate(day), title: title.trim(), hours });
      showToast('فعالیت ثبت شد.', 'success');
    }
    resetForm();
  };

  const startEdit = (a: TeacherActivity) => {
    const parts = toEnglishDigits(a.date).split('/');
    setEditingId(a.id);
    setDay(Number(parts[2]) || 1);
    setTitle(a.title);
    setHoursText(String(a.hours));
    setError('');
  };

  const remove = (a: TeacherActivity) =>
    showConfirm({
      title: 'حذف فعالیت؟',
      message: 'آیا از حذف این فعالیت اطمینان دارید؟',
      confirmLabel: 'بله، حذف شود',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => deleteTeacherActivity(a.id),
    });

  const fieldClass =
    'w-full text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 outline-none transition';

  return (
    <div className="space-y-5" dir="rtl">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
              <Clock className="w-6 h-6 text-sky-600" />
              <span>فعالیت خارج مدرسه</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              ساعات کارکرد اضافه (طراحی آزمون، تصحیح اوراق، جلسه با اولیاء و...) را ماه‌به‌ماه ثبت کنید.
            </p>
          </div>
          <label className="block sm:w-48">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">ماه</span>
            <select
              value={monthKey}
              onChange={(e) => changeMonth(e.target.value)}
              className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 cursor-pointer"
            >
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} {toPersianDigits(m.year)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-sky-700">مجموع کارکرد این ماه</div>
            <div className="text-2xl font-black text-sky-900 mt-1">
              {formatHours(totalHours)} <span className="text-sm font-bold">ساعت</span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-white/70 border border-sky-200 text-sky-800 text-xs font-bold whitespace-nowrap">
            {toPersianDigits(mine.length)} فعالیت ثبت‌شده
          </span>
        </div>

        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <label className="sm:col-span-3 block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">تاریخ / روز فعالیت</span>
            <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={`${fieldClass} cursor-pointer`}>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {getDayOfWeekFromShamsi(fullDate(d))} {toPersianDigits(d)} {selected.label}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-5 block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">عنوان و شرح فعالیت</span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              placeholder="طراحی آزمون، تصحیح اوراق، جلسه آنلاین با اولیاء، تهیه محتوای آموزشی..."
              className={fieldClass}
            />
          </label>
          <label className="sm:col-span-2 block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">مدت (ساعت)</span>
            <input
              type="text"
              inputMode="decimal"
              value={toPersianDigits(hoursText)}
              onChange={(e) => {
                setHoursText(toEnglishDigits(e.target.value));
                setError('');
              }}
              placeholder="۱٫۵"
              className={`${fieldClass} text-center`}
            />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-sm px-4 py-2.5 text-sm font-bold transition cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingId ? 'ذخیره' : 'ثبت'}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => resetForm()}
                aria-label="انصراف از ویرایش"
                className="px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {error && <p className="sm:col-span-12 text-xs font-bold text-rose-700">{error}</p>}
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-right text-xs min-w-[650px]">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">تاریخ</th>
                <th className="p-3">شرح فعالیت</th>
                <th className="p-3 text-center">ساعت</th>
                <th className="p-3 text-center w-40">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mine.map((a) => (
                <tr key={a.id} className={editingId === a.id ? 'bg-amber-50/50' : 'hover:bg-slate-50/60'}>
                  <td className="p-3 font-bold text-slate-700">
                    {getDayOfWeekFromShamsi(a.date)} {toPersianDigits(a.date)}
                  </td>
                  <td className="p-3 whitespace-normal min-w-[240px] text-slate-700">{a.title}</td>
                  <td className="p-3 text-center">
                    <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold">
                      {formatHours(a.hours)} ساعت
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(a)}
                        className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(a)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mine.length === 0 && (
          <div className="py-10 text-center text-xs text-slate-400">در این ماه فعالیتی ثبت نشده است.</div>
        )}
      </div>
    </div>
  );
};
