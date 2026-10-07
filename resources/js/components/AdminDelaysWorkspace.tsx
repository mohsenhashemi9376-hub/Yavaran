import React, { useState } from 'react';
import { MorningDelayRecord, Student, SchoolClass } from '../types';
import { toPersianDigits, getTodayShamsi, formatShamsiDisplay, getDayOfWeekFromShamsi } from '../utils/persianDate';
import { 
  Clock, 
  Search, 
  Plus, 
  ChevronLeft, 
  Menu, 
  FileSpreadsheet, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  AlertCircle,
  Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { studentFullName } from '../utils/studentName';

interface AdminDelaysWorkspaceProps {
  delays?: MorningDelayRecord[];
  students: Student[];
  classes: SchoolClass[];
  onBack: () => void;
  onOpenSidebar: () => void;
  onOpenAddDelay: () => void;
  onDeleteDelay: (id: string) => void;
  onSelectStudent?: (student: Student) => void;
}

export const AdminDelaysWorkspace: React.FC<AdminDelaysWorkspaceProps> = ({
  delays = [],
  students,
  classes,
  onBack,
  onOpenSidebar,
  onOpenAddDelay,
  onDeleteDelay,
  onSelectStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const todayInfo = getTodayShamsi();
  const safeDelays = Array.isArray(delays) ? delays : [];

  // Metrics
  const totalMinutes = safeDelays.reduce((acc, d) => acc + (d.delayMinutes || 0), 0);
  const todayDelaysCount = safeDelays.filter((d) => d.date === todayInfo.formattedDate).length;
  const excusedCount = safeDelays.filter((d) => d.isExcused).length;

  // Filter delays
  const filteredDelays = safeDelays.filter((d) => {
    const student = students.find((s) => s.id === d.studentId);
    const cls = classes.find((c) => c.id === (d.classId || student?.classId));
    const studentName = student ? `${studentFullName(student)}` : (d.studentName || '');

    if (classFilter && (d.classId !== classFilter && student?.classId !== classFilter)) {
      return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchesName = studentName.toLowerCase().includes(q);
      const matchesReason = d.reason?.toLowerCase().includes(q);
      const matchesDate = d.date.includes(q);
      if (!matchesName && !matchesReason && !matchesDate) {
        return false;
      }
    }

    return true;
  });

  const exportDelaysToExcel = () => {
    const rows = filteredDelays.map((d, idx) => {
      const student = students.find((s) => s.id === d.studentId);
      const cls = classes.find((c) => c.id === (d.classId || student?.classId));
      return {
        'ردیف': idx + 1,
        'نام دانش‌آموز': student ? `${studentFullName(student)}` : d.studentName || 'نامشخص',
        'کلاس': cls?.name || 'نامشخص',
        'تاریخ': d.date,
        'روز هفته': getDayOfWeekFromShamsi(d.date),
        'دقایق تأخیر': d.delayMinutes,
        'علت': d.reason || '-',
        'موجه': d.isExcused ? 'موجه' : 'غیرموجه',
        'اطلاع به اولیاء': d.isParentNotified ? 'ارسال شده' : 'خیر',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تأخیرهای_مدرسه');
    XLSX.writeFile(wb, `School_Delays_${todayInfo.formattedDate}.xlsx`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* 1. Header ساختار یکسان */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <span>پیشخوان اصلی</span>
              <span>/</span>
              <span className="text-teal-800">مدیریت تأخیرها</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <Clock className="w-6 h-6 text-teal-800" />
              <span>مدیریت تأخیرهای صبحگاهی و کلاسی</span>
              <span className="text-xs font-bold bg-teal-50 text-teal-800 px-2.5 py-1 rounded-full border border-teal-200">
                {toPersianDigits(safeDelays.length)} مورد ثبت‌شده
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              ثبت و رصد ورود با تأخیر دانش‌آموزان به مدرسه یا کلاس‌های درس.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenAddDelay}
              className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت تأخیر جدید</span>
            </button>

            <button
              onClick={exportDelaysToExcel}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="خروجی اکسل از تأخیرها"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>خروجی اکسل</span>
            </button>

            <button
              onClick={onOpenSidebar}
              className="lg:hidden px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
              title="باز کردن نوار کناری"
              aria-label="باز کردن نوار کناری"
            >
              <Menu className="w-4 h-4 text-slate-700" />
              <span>منو</span>
            </button>

            <button
              onClick={onBack}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>بازگشت به داشبورد</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 کارت آمار سریع */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">مجموع دقایق تأخیر</div>
              <div className="text-xl font-black text-amber-700 mt-0.5">
                {toPersianDigits(totalMinutes)} <span className="text-xs font-normal text-slate-500">دقیقه</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">تأخیرهای امروز ({todayInfo.displayDate})</div>
              <div className="text-xl font-black text-slate-900 mt-0.5">
                {toPersianDigits(todayDelaysCount)} <span className="text-xs font-normal text-slate-500">مورد</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">تأخیرهای موجه‌شده</div>
              <div className="text-xl font-black text-emerald-700 mt-0.5">
                {toPersianDigits(excusedCount)} <span className="text-xs font-normal text-slate-500">مورد</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو با نام دانش‌آموز، علت تأخیر یا تاریخ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition"
            />
          </div>

          <div>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="">تمام کلاس‌ها ({toPersianDigits(classes.length)} کلاس)</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. بدنه: جدول کامل تأخیرها */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredDelays.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <Clock className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-xs font-bold text-slate-600">هیچ مورد تأخیری با این مشخصات ثبت نشده است.</p>
            <p className="text-[11px] text-slate-400">می‌توانید با دکمه «ثبت تأخیر جدید» مورد تأخیر اضافه کنید.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5 w-12 text-center">ردیف</th>
                  <th className="p-3.5">دانش‌آموز</th>
                  <th className="p-3.5">کلاس</th>
                  <th className="p-3.5 font-mono text-center">تاریخ تأخیر</th>
                  <th className="p-3.5 text-center">دقایق تأخیر</th>
                  <th className="p-3.5">علت و توضیحات</th>
                  <th className="p-3.5 text-center">وضعیت موجه</th>
                  <th className="p-3.5 text-center">اطلاع اولیاء</th>
                  <th className="p-3.5 text-center w-20">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDelays.map((delay, idx) => {
                  const student = students.find((s) => s.id === delay.studentId);
                  const cls = classes.find((c) => c.id === (delay.classId || student?.classId));
                  const studentName = student ? `${studentFullName(student)}` : (delay.studentName || 'دانش‌آموز');

                  return (
                    <tr key={delay.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 text-center font-bold text-slate-400">
                        {toPersianDigits(idx + 1)}
                      </td>

                      <td className="p-3.5">
                        {student && onSelectStudent ? (
                          <button
                            type="button"
                            onClick={() => onSelectStudent(student)}
                            className="font-bold text-slate-900 hover:text-teal-800 hover:underline transition cursor-pointer text-right"
                            title="مشاهده مشخصات دانش‌آموز"
                          >
                            {studentName}
                          </button>
                        ) : (
                          <div className="font-bold text-slate-900">
                            {studentName}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="font-bold text-slate-800">
                          {cls?.name || 'کلاس نامشخص'}
                        </span>
                      </td>

                      <td className="p-3.5 font-mono text-center text-slate-700">
                        {toPersianDigits(delay.date)}
                        <div className="text-[10px] text-slate-400 font-sans">
                          {getDayOfWeekFromShamsi(delay.date)}
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-900 border border-amber-200">
                          {toPersianDigits(delay.delayMinutes)} دقیقه
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-600 max-w-xs truncate">
                        {delay.reason || 'بدون ذکر علت'}
                      </td>

                      <td className="p-3.5 text-center">
                        {delay.isExcused ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            موجه
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            غیرموجه
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {delay.isParentNotified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ارسال شد</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            ارسال نشده
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('آیا از حذف این سابقه تأخیر اطمینان دارید؟')) {
                              onDeleteDelay(delay.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer mx-auto"
                          title="حذف سابقه تأخیر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Footer ساختار یکسان */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <div>
            نمایش <span className="font-bold text-slate-800">{toPersianDigits(filteredDelays.length)}</span> از{' '}
            <span className="font-bold text-slate-800">{toPersianDigits(safeDelays.length)}</span> مورد تأخیر
          </div>
          <div className="text-[11px] text-slate-400">
            تأخیرهای ثبت‌شده به صورت خودکار در کارنامه انضباطی محاسبه می‌شوند.
          </div>
        </div>
      </div>

    </div>
  );
};
