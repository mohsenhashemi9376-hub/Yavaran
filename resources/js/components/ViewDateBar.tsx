import React, { useState } from 'react';
import { CalendarDays, Eye, PencilLine, RotateCcw } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import {
  dateToShamsiString,
  formatShamsiDisplay,
  formatShamsiWithWeekday,
  getRealTodayShamsiString,
  shamsiStringToDate,
  toPersianDigits,
} from '../utils/persianDate';

const daysAgo = (n: number): string => {
  const d = shamsiStringToDate(getRealTodayShamsiString());
  d.setDate(d.getDate() - n);
  return dateToShamsiString(d);
};

const QUICK: [string, number][] = [
  ['دیروز', 1],
];

/**
 * مشاهده‌ی اطلاعات روزهای گذشته: با انتخاب یک روز، همه‌ی بخش‌ها (غیبت، تأخیر، جلسات، کاربرگ و…) همان روز را «امروز» می‌گیرند.
 * پس از انتخاب روز، ویرایش و ثبت (با تاریخ همان روز) آزاد است؛ با «فقط مشاهده» می‌شود از تغییر جلوگیری کرد.
 */
export const ViewDateBar: React.FC = () => {
  const { viewDate, changeViewDate, lateEntry, changeLateEntry, showConfirm } = useSchool();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (value: string | null) => {
    if (busy) return;
    setBusy(true);
    const ok = await changeViewDate(value);
    setBusy(false);
    if (ok) setText('');
  };

  const onType = (v: string) => {
    setText(v);
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(v)) void go(v);
  };

  const picker = (
    <ShamsiDatePicker
      value={text !== '' ? text : (viewDate ?? '')}
      onChange={onType}
      fallbackDate={viewDate ?? undefined}
      placeholder="انتخاب تاریخ..."
      className="w-28 text-xs bg-transparent border-0 py-1.5 pl-3 outline-none text-slate-600 text-right cursor-pointer"
    />
  );

  const askLateEntry = () => {
    if (!viewDate) return;
    showConfirm({
      title: 'فعال‌سازی ثبت دیرهنگام',
      message: `از این لحظه هر چیزی ثبت یا ویرایش کنید، با تاریخ ${toPersianDigits(viewDate)} در سامانه ذخیره می‌شود (زمان واقعی ثبت هم نگه‌داشته می‌شود). ساعت ورود دانش‌آموزان در حضور صبحگاه ۰۷:۰۰ (بدون تأخیر) ثبت می‌شود و در صورت نیاز تأخیر را دستی اصلاح کنید. ادامه می‌دهید؟`,
      confirmLabel: 'بله، ثبت دیرهنگام',
      cancelLabel: 'انصراف',
      onConfirm: () => changeLateEntry(true),
    });
  };

  if (viewDate) {
    return (
      <div
        role="status"
        className={`sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 mb-4 px-4 sm:px-6 lg:px-8 py-2.5 border-y ${
          lateEntry ? 'bg-rose-100 border-rose-300 text-rose-950' : 'bg-amber-100 border-amber-300 text-amber-950'
        }`}
        dir="rtl"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2 text-xs font-extrabold">
            {lateEntry ? <PencilLine className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
            <span>{lateEntry ? 'ویرایش و ثبت برای روز' : 'نمایش اطلاعات روز'} {toPersianDigits(formatShamsiWithWeekday(viewDate))}</span>
            <span className={`font-bold ${lateEntry ? 'text-rose-800' : 'text-amber-800'}`}>
              {lateEntry ? '— ویرایش و ثبت آزاد است؛ تغییرات با تاریخ همین روز ذخیره می‌شود (ساعت ورود صبحگاه ۰۷:۰۰ ثبت می‌شود، تأخیر را دستی اصلاح کنید).' : '— فقط مشاهده؛ تغییرات ذخیره نمی‌شود.'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mr-auto">
            {picker}
            <button
              type="button"
              onClick={() => (lateEntry ? changeLateEntry(false) : askLateEntry())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-current bg-white/70 hover:bg-white text-xs font-extrabold cursor-pointer"
            >
              <PencilLine className="w-3.5 h-3.5" />
              {lateEntry ? 'فقط مشاهده' : 'فعال‌سازی ویرایش'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => go(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-extrabold cursor-pointer disabled:opacity-60"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              بازگشت به امروز
            </button>
          </div>
        </div>
      </div>
    );
  }

  const todayLabel = formatShamsiDisplay(getRealTodayShamsiString()).split(' ').slice(0, 2).join(' ');
  const chip = 'shrink-0 h-9 px-3.5 rounded-full border text-xs whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60';

  return (
    <div
      className="flex items-center gap-2 mb-3 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      dir="rtl"
      role="group"
      aria-label="انتخاب سریع تاریخ"
    >
      <span className={`${chip} inline-flex items-center bg-emerald-50 text-emerald-800 border-emerald-300 font-bold`} aria-current="date">
        امروز ({todayLabel})
      </span>
      {QUICK.map(([label, n]) => (
        <button
          key={n}
          type="button"
          disabled={busy}
          onClick={() => go(daysAgo(n))}
          className={`${chip} bg-white border-slate-200 text-slate-600 font-medium active:bg-slate-100 hover:bg-slate-50`}
        >
          {label}
        </button>
      ))}
      <span className="shrink-0 inline-flex items-center gap-1.5 h-9 pr-3 rounded-full border border-slate-200 bg-white text-slate-600">
        <CalendarDays className="w-4 h-4" />
        {picker}
      </span>
    </div>
  );
};
