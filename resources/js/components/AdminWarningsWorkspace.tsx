import React, { useState } from 'react';
import { Student } from '../types';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';
import { 
  AlertTriangle, 
  ChevronLeft, 
  Menu, 
  Phone, 
  Search, 
  FileSpreadsheet, 
  CheckCircle2, 
  UserCheck 
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface WarningItem {
  student: Student;
  className: string;
  absentCount: number;
}

interface AdminWarningsWorkspaceProps {
  warnings: WarningItem[];
  onBack: () => void;
  onOpenSidebar: () => void;
  onSelectStudent: (student: Student) => void;
}

export const AdminWarningsWorkspace: React.FC<AdminWarningsWorkspaceProps> = ({
  warnings,
  onBack,
  onOpenSidebar,
  onSelectStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const todayInfo = getTodayShamsi();

  const filteredWarnings = warnings.filter((w) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    const fullName = `${w.student.firstName} ${w.student.lastName}`.toLowerCase();
    return (
      fullName.includes(q) ||
      w.className.toLowerCase().includes(q) ||
      w.student.parentPhone.includes(q)
    );
  });

  const exportWarningsToExcel = () => {
    const rows = filteredWarnings.map((w, idx) => ({
      'ردیف': idx + 1,
      'نام و نام خانوادگی': `${w.student.firstName} ${w.student.lastName}`,
      'کلاس': w.className,
      'تعداد کل غیبت‌ها': w.absentCount,
      'شماره تماس اولیاء': w.student.parentPhone,
      'وضعیت پیگیری': 'نیازمند تماس با ولی',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'موارد_پیگیری_غیبت');
    XLSX.writeFile(wb, `Absence_Warnings_${todayInfo.formattedDate}.xlsx`);
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
              <span className="text-rose-700">موارد نیازمند پیگیری فوری</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
              <span>موارد نیازمند بررسی و اخطار غیبت</span>
              <span className="text-xs font-bold bg-rose-50 text-rose-800 px-2.5 py-1 rounded-full border border-rose-200">
                {toPersianDigits(warnings.length)} دانش‌آموز در مرز خطر
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              دانش‌آموزانی با ۲ جلسه غیبت یا بیشتر که نیازمند تماس با اولیاء و ثبت در پرونده انضباطی هستند.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={exportWarningsToExcel}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="خروجی اکسل غیبت‌ها"
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

        {/* Search */}
        <div className="pt-3 border-t border-slate-100">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجوی نام دانش‌آموز، کلاس یا شماره تماس..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 transition"
            />
          </div>
        </div>
      </div>

      {/* 2. بدنه: لیست یا گرید دانش‌آموزان با غیبت بحرانی */}
      {filteredWarnings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-emerald-200 p-12 text-center text-emerald-800 space-y-2">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
          <p className="text-sm font-bold">عالی! هیچ دانش‌آموزی در مرز غیبت غیرمجاز قرار ندارد.</p>
          <p className="text-xs text-emerald-700">وضعیت حضور و غیاب کل مدرسه پایدار است.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWarnings.map((item) => (
            <div
              key={item.student.id}
              className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs hover:shadow-sm transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-800 font-bold text-sm flex items-center justify-center shrink-0">
                      {item.student.firstName[0]}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {item.student.firstName} {item.student.lastName}
                      </h4>
                      <div className="text-xs text-slate-500 mt-0.5 font-medium">
                        کلاس: {item.className}
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                    {toPersianDigits(item.absentCount)} غیبت
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">شماره ولی:</span>
                  <a
                    href={`tel:${item.student.parentPhone}`}
                    className="inline-flex items-center gap-1.5 font-mono font-bold text-teal-800 hover:text-teal-900"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{item.student.parentPhone}</span>
                  </a>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <a
                  href={`tel:${item.student.parentPhone}`}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>تماس با ولی</span>
                </a>

                <button
                  type="button"
                  onClick={() => onSelectStudent(item.student)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  کارنامه و سوابق
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Footer ساختار یکسان */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
        <div>
          نمایش <span className="font-bold text-slate-800">{toPersianDigits(filteredWarnings.length)}</span> از{' '}
          <span className="font-bold text-slate-800">{toPersianDigits(warnings.length)}</span> دانش‌آموز نیازمند بررسی
        </div>
        <div className="text-[11px] text-slate-400">
          توصیه می‌شود در صورت رسیدن غیبت‌ها به ۳ جلسه، مورد در کارنامه انضباطی ثبت گردد.
        </div>
      </div>
    </div>
  );
};
