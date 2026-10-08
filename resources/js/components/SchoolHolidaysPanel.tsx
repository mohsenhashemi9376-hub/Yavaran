import React, { useMemo, useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { dateToShamsiString, formatShamsiWithWeekday, getTodayShamsi, shamsiStringToDate, toPersianDigits } from '../utils/persianDate';
import { isFridayShamsi, normalizeShamsi } from '../utils/schoolCalendar';

const addDays = (shamsi: string, days: number): string => {
  const d = shamsiStringToDate(shamsi);
  d.setDate(d.getDate() + days);
  return dateToShamsiString(d);
};

/**
 * اعلام تعطیلی: مدیر سامانه و معاون انضباطی می‌توانند یک روز را تعطیل اعلام کنند؛ حضور و غیاب آن روز
 * (صبحگاه و کلاسی) بسته می‌شود و در هیچ محاسبه‌ای (غیبت، تأخیر، نمره‌ی انضباط، گزارش‌ها) نمی‌آید.
 * جمعه‌ها همیشه تعطیل‌اند و نیازی به اعلام ندارند.
 */
export const SchoolHolidaysPanel: React.FC = () => {
  const { currentUser, schoolHolidays, addSchoolHoliday, removeSchoolHoliday, showConfirm, showToast } = useSchool();
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');

  const canManage = currentUser.role === 'admin' || currentUser.role === 'vice_disciplinary';
  const today = getTodayShamsi().formattedDate;
  const sorted = useMemo(() => [...schoolHolidays].sort((a, b) => (a.date < b.date ? 1 : -1)), [schoolHolidays]);

  if (!canManage) return null;

  const add = (value: string) => {
    const n = normalizeShamsi(value);
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(n)) {
      showToast('تاریخ را مثل 1405/07/20 وارد کنید.', 'error');
      return;
    }
    if (isFridayShamsi(n)) {
      showToast('جمعه همیشه تعطیل است و نیازی به اعلام ندارد.', 'info');
      return;
    }
    if (schoolHolidays.some((h) => normalizeShamsi(h.date) === n)) {
      showToast('این روز قبلاً تعطیل اعلام شده است.', 'info');
      return;
    }
    addSchoolHoliday(n, title);
    showToast(`${formatShamsiWithWeekday(n)} تعطیل اعلام شد؛ حضور و غیاب آن روز بسته است.`, 'success');
    setDate('');
    setTitle('');
  };

  const remove = (d: string) =>
    showConfirm({
      title: 'لغو تعطیلی',
      message: `تعطیلی ${formatShamsiWithWeekday(d)} لغو شود؟ حضور و غیاب این روز دوباره باز می‌شود.`,
      confirmLabel: 'لغو تعطیلی',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => removeSchoolHoliday(d),
    });

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 space-y-3.5" id="school-holidays-panel" dir="rtl">
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
          <CalendarOff className="w-4 h-4" />
        </span>
        <div>
          <div className="text-sm font-black text-slate-900">اعلام تعطیلی</div>
          <div className="text-[11px] text-slate-500 leading-5">
            حضور و غیاب روز تعطیل بسته می‌شود و در محاسبات نمی‌آید. جمعه‌ها همیشه تعطیل‌اند.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => add(today)} className="px-3.5 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 text-xs font-bold text-amber-900 cursor-pointer">
          امروز تعطیل است
        </button>
        <button type="button" onClick={() => add(addDays(today, 1))} className="px-3.5 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 text-xs font-bold text-amber-900 cursor-pointer">
          فردا تعطیل است
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          dir="ltr"
          inputMode="numeric"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          placeholder="1405/07/20"
          aria-label="تاریخ تعطیلی"
          className="w-32 text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-500 font-mono text-center"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="علت (اختیاری): برف، مراسم، ..."
          aria-label="علت تعطیلی"
          className="flex-1 min-w-[10rem] text-xs bg-white border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="button"
          onClick={() => add(date)}
          disabled={!date.trim()}
          className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>اعلام تعطیلی</span>
        </button>
      </div>

      {sorted.length > 0 && (
        <ul className="rounded-xl border border-amber-100 bg-white divide-y divide-amber-50 overflow-hidden">
          {sorted.slice(0, 12).map((h) => (
            <li key={h.id} className="px-3.5 py-2.5 flex items-center gap-3 text-xs">
              <span className="font-bold text-slate-800">{formatShamsiWithWeekday(h.date)}</span>
              {h.title && <span className="text-slate-500 truncate">— {h.title}</span>}
              {h.date >= today && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">{h.date === today ? 'امروز' : 'پیش‌رو'}</span>}
              <span className="mr-auto text-[10px] text-slate-400">{h.setBy ? `اعلام: ${h.setBy}` : toPersianDigits(h.date)}</span>
              <button
                type="button"
                onClick={() => remove(h.date)}
                aria-label="لغو تعطیلی"
                title="لغو تعطیلی"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
