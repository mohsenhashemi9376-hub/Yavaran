import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ArrowRight, CalendarDays, ChevronDown, Clock, FileSpreadsheet, Menu, Printer } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { getDayOfWeekFromShamsi, toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { academicMonths, currentMonthKey, formatHours, monthKeyOf } from '../utils/teacherActivities';

interface Props {
  onBack: () => void;
  onOpenSidebar: () => void;
}

/** گزارش ماهانه فعالیت‌های خارج مدرسه اساتید (پنل مدیر و معاونت آموزش) */
export const TeacherActivitiesReport: React.FC<Props> = ({ onBack, onOpenSidebar }) => {
  const { teacherActivities, allUsers, updateTeacherActivity } = useSchool();
  const months = useMemo(() => academicMonths(), []);
  const [monthKey, setMonthKey] = useState(() => {
    const cur = currentMonthKey();
    return months.some((m) => m.key === cur) ? cur : months[0].key;
  });
  const [openTeacher, setOpenTeacher] = useState<string | null>(null);

  const rows = useMemo(() => {
    const byTeacher = new Map<string, typeof teacherActivities>();
    teacherActivities
      .filter((a) => monthKeyOf(a.date) === monthKey)
      .forEach((a) => byTeacher.set(a.teacherId, [...(byTeacher.get(a.teacherId) || []), a]));
    return Array.from(byTeacher.entries())
      .map(([teacherId, list]) => ({
        teacherId,
        name: allUsers.find((u) => u.id === teacherId)?.name || list[0]?.teacherName || 'نامشخص',
        list: [...list].sort((a, b) => toEnglishDigits(b.date).localeCompare(toEnglishDigits(a.date))),
        total: list.reduce((s, a) => s + (a.hours || 0), 0),
        approved: list.filter((a) => a.status !== 'pending').reduce((s, a) => s + (a.hours || 0), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [teacherActivities, allUsers, monthKey]);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const monthLabel = (() => {
    const m = months.find((x) => x.key === monthKey);
    return m ? `${m.label} ${toPersianDigits(m.year)}` : '';
  })();

  /** حروف اختصاری نام: «استاد ادیب» ← «ا.ا» */
  const initials = (name: string) =>
    name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join('.');

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summary = XLSX.utils.json_to_sheet(
      rows.map((r, i) => ({ 'ردیف': i + 1, 'استاد': r.name, 'تعداد فعالیت': r.list.length, 'مجموع ساعات': r.total, 'ساعات تأییدشده': r.approved }))
    );
    summary['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, summary, 'خلاصه');
    const detail = XLSX.utils.json_to_sheet(
      rows.flatMap((r) => r.list.map((a) => ({ 'استاد': r.name, 'تاریخ': a.date, 'عنوان فعالیت': a.title, 'ساعت': a.hours, 'وضعیت': a.status === 'pending' ? 'در انتظار تأیید' : 'تأییدشده' })))
    );
    detail['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, detail, 'جزئیات');
    XLSX.writeFile(wb, `فعالیت_خارج_مدرسه_اساتید_${monthKey.replace('/', '-')}.xlsx`);
  };

  /** خروجی PDF: پنجره‌ی چاپ مرورگر (ذخیره به‌صورت PDF) */
  const exportPdf = () => {
    const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const w = window.open('', '_blank');
    if (!w) return;
    const trs = rows
      .map((r, i) => `<tr><td>${toPersianDigits(i + 1)}</td><td>${esc(r.name)}</td><td>${toPersianDigits(r.list.length)}</td><td>${formatHours(r.total)}</td><td>${formatHours(r.approved)}</td></tr>`)
      .join('');
    w.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>گزارش فعالیت خارج مدرسه اساتید</title><style>
      body{font-family:Vazirmatn,Tahoma,sans-serif;color:#0f172a;padding:12mm}
      h1{font-size:18px;margin:0 0 4px} p{margin:0 0 12px;color:#475569;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:center}
      th{background:#f1f5f9} td:nth-child(2){text-align:right;font-weight:700}
    </style></head><body><h1>گزارش فعالیت‌های خارج مدرسه اساتید</h1>
    <p>${esc(monthLabel)} — مجموع کارکرد ثبت‌شده: ${formatHours(grandTotal)} ساعت</p>
    <table><thead><tr><th>ردیف</th><th>استاد</th><th>تعداد فعالیت</th><th>مجموع ساعات</th><th>ساعات تأییدشده</th></tr></thead><tbody>${trs}</tbody></table>
    <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  const exportBtn = 'h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="space-y-4" dir="rtl">
      {/* ۱. هدر */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-1">
            <button
              type="button"
              onClick={onBack}
              className="w-11 h-11 shrink-0 rounded-xl bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 cursor-pointer"
              aria-label="بازگشت"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <span className="w-11 h-11 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center" aria-hidden="true">
              <Clock className="w-5 h-5" />
            </span>
            <h1 className="text-base sm:text-xl font-black text-slate-900 leading-7">گزارش فعالیت‌های خارج مدرسه اساتید</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button type="button" onClick={exportExcel} disabled={rows.length === 0} className={exportBtn}>
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
            </button>
            <button type="button" onClick={exportPdf} disabled={rows.length === 0} className={exportBtn}>
              <Printer className="w-4 h-4 text-rose-500" /> PDF
            </button>
            <button
              type="button"
              onClick={onOpenSidebar}
              className="lg:hidden mr-auto sm:mr-0 h-10 w-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center cursor-pointer border border-slate-200"
              aria-label="باز کردن منو"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ۲. فیلتر ماه + شاخص مجموع ساعات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col justify-center gap-2">
          <span className="text-[11px] font-bold text-slate-500">ماه و سال</span>
          <span className="relative block">
            <CalendarDays className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              style={{ fontFamily: 'inherit' }}
              className="w-full h-12 appearance-none text-sm font-extrabold text-slate-800 bg-slate-50 border border-slate-200 rounded-full pr-11 pl-10 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 cursor-pointer"
            >
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} {toPersianDigits(m.year)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </span>
        </label>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col justify-center">
          <div className="text-3xl font-black text-blue-900 tabular-nums">
            {formatHours(grandTotal)} <span className="text-base font-extrabold text-blue-700">ساعت</span>
          </div>
          <div className="text-xs font-bold text-blue-700 mt-1">مجموع کارکرد ثبت‌شده اساتید</div>
        </div>
      </div>

      {/* ۳. فهرست اساتید */}
      <div className="space-y-3">
        {rows.map((r) => {
          const isOpen = openTeacher === r.teacherId;
          return (
            <div key={r.teacherId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 md:flex-1">
                  <span className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-teal-600 to-emerald-500 text-white text-sm font-black flex items-center justify-center" aria-hidden="true">
                    {initials(r.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 truncate">{r.name}</div>
                    <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold whitespace-nowrap">
                      {toPersianDigits(r.list.length)} فعالیت
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 text-xs font-bold whitespace-nowrap">
                    مجموع: {formatHours(r.total)} ساعت
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold whitespace-nowrap">
                    تأییدشده: {formatHours(r.approved)} ساعت
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenTeacher(isOpen ? null : r.teacherId)}
                  aria-expanded={isOpen}
                  className="h-11 min-w-[9.5rem] px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span className="whitespace-nowrap">مشاهده جزئیات</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/70 p-3 space-y-2">
                  {r.list.map((a) => (
                    <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-x-3 gap-y-2 flex-wrap text-xs">
                      <span className="font-bold text-slate-700 whitespace-nowrap">
                        {getDayOfWeekFromShamsi(a.date)} {toPersianDigits(a.date)}
                      </span>
                      <span className="flex-1 min-w-[10rem] whitespace-normal text-slate-600 leading-6">{a.title}</span>
                      <span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-bold whitespace-nowrap">
                        {formatHours(a.hours)} ساعت
                      </span>
                      <button
                        type="button"
                        onClick={() => updateTeacherActivity(a.id, { status: a.status === 'pending' ? 'approved' : 'pending' })}
                        className={`h-9 px-3 rounded-xl border font-bold cursor-pointer whitespace-nowrap ${
                          a.status === 'pending'
                            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {a.status === 'pending' ? 'در انتظار تأیید' : 'تأییدشده'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">
            در {monthLabel} فعالیتی ثبت نشده است.
          </div>
        )}
      </div>
    </div>
  );
};
