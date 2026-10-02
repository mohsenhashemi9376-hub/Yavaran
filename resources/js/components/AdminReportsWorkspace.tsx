import React, { useState } from 'react';
import { SchoolClass, Student, AttendanceSession, User } from '../types';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';
import { exportClassAttendanceToExcel, exportOverallSchoolSummaryToExcel } from '../utils/excelExport';
import { 
  FileSpreadsheet, 
  ChevronLeft, 
  Menu, 
  Download, 
  GraduationCap, 
  AlertTriangle, 
  BookOpen, 
  BarChart3,
  Calendar,
  Users
} from 'lucide-react';

interface AdminReportsWorkspaceProps {
  classes: SchoolClass[];
  students: Student[];
  sessions: AttendanceSession[];
  teachers?: User[];
  onBack: () => void;
  onOpenSidebar: () => void;
  onOpenAcademicGrades?: () => void;
  onViewWarnings: () => void;
}

export const AdminReportsWorkspace: React.FC<AdminReportsWorkspaceProps> = ({
  classes,
  students,
  sessions,
  teachers = [],
  onBack,
  onOpenSidebar,
  onOpenAcademicGrades,
  onViewWarnings,
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const todayInfo = getTodayShamsi();

  const handleExportOverall = () => {
    exportOverallSchoolSummaryToExcel(classes, students, sessions, teachers);
  };

  const handleExportClass = () => {
    const cls = classes.find((c) => c.id === selectedClassId);
    if (!cls) return;
    const classStudents = students.filter((s) => s.classId === cls.id);
    const classSessions = sessions.filter((s) => s.classId === cls.id);
    exportClassAttendanceToExcel(cls, classStudents, classSessions);
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
              <span className="text-teal-800">گزارش‌ها و خروجی اکسل</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <FileSpreadsheet className="w-6 h-6 text-teal-800" />
              <span>مرکز گزارش‌ها و خروجی‌های مدرسه</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              تولید خروجی‌های استاندارد اکسل (Excel)، دفتر ثبت نمرات و آمار تجمیعی پایه‌ها.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
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
      </div>

      {/* 2. بدنه: کارت‌های تخصصی گزارش‌ها */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* کارت ۱: گزارش اکسل تجمیعی مدرسه */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200/60">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                گزارش تجمیعی کل مدرسه (اکسل)
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                دریافت یک فایل اکسل جامع شامل آمار تمام کلاس‌ها، مجموع غیبت‌ها، نرخ حضور هفتگی و ماهانه، و وضعیت تحصیلی.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              فرمت استاندارد xlsx • سازگار با آفیس و شاد
            </span>
            <button
              type="button"
              onClick={handleExportOverall}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>دانلود فایل اکسل تجمیعی</span>
            </button>
          </div>
        </div>

        {/* کارت ۲: دفتر ثبت نمرات ۴ نوبته */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-800 flex items-center justify-center border border-indigo-200/60">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                دفتر ثبت نمرات ۴ نوبته و ارزشیابی
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                سامانه ثبت، مدیریت و صدور کارنامه نمرات مستمر ۱، نوبت اول، مستمر ۲ و نوبت دوم به تفکیک تمام دروس و معلمان.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              قابلیت چاپ و خروجی کارنامه رسمی
            </span>
            <button
              type="button"
              onClick={() => onOpenAcademicGrades && onOpenAcademicGrades()}
              className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <GraduationCap className="w-4 h-4" />
              <span>ورود به سامانه ثبت نمرات</span>
            </button>
          </div>
        </div>

        {/* کارت ۳: گزارش اختصاصی یک کلاس */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-200/60">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                خروجی حضور و غیاب کلاس خاص
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                انتخاب کلاس مورد نظر و استخراج فایل اکسل جلسات، اسامی حاضرین، غایبین و وضعیت تأخیرها.
              </p>
            </div>

            <div className="pt-2">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              بر اساس جلسات ثبت‌شده در سامانه
            </span>
            <button
              type="button"
              onClick={handleExportClass}
              className="px-4 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>دانلود اکسل کلاس</span>
            </button>
          </div>
        </div>

        {/* کارت ۴: گزارش غیبت‌های پرخطر */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-800 flex items-center justify-center border border-rose-200/60">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                گزارش موارد نیازمند پیگیری انضباطی
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                بررسی دانش‌آموزانی که به حد نصاب ۲ غیبت یا بیشتر رسیده‌اند جهت تماس با اولیاء و اقدامات ارشادی.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              پیگیری تلفنی و کارنامه انضباطی
            </span>
            <button
              type="button"
              onClick={onViewWarnings}
              className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>مشاهده لیست پیگیری</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
