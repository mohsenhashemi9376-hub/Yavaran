import React from 'react';
import { SubjectManagementSection } from './SubjectManagementSection';
import { BookOpen, ChevronLeft, Menu } from 'lucide-react';

interface AdminSubjectsWorkspaceProps {
  onBack: () => void;
  onOpenSidebar: () => void;
}

export const AdminSubjectsWorkspace: React.FC<AdminSubjectsWorkspaceProps> = ({
  onBack,
  onOpenSidebar,
}) => {
  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Header ساختار یکسان */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <span>پیشخوان اصلی</span>
              <span>/</span>
              <span className="text-teal-800">برنامه دروس و مدیریت زنگ‌ها</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <BookOpen className="w-6 h-6 text-teal-800" />
              <span>مدیریت دروس و ساعات زنگ‌ها</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              تعریف عناوین دروس، تخصیص معلمان به دروس، تنظیم ساعات شروع و پایان زنگ‌ها.
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

      {/* 2. بدنه: کامپوننت مدیریت دروس و زنگ‌ها */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <SubjectManagementSection />
      </div>

      {/* 3. Footer ساختار یکسان */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
        <div>
          تغییرات در برنامه دروس و زنگ‌ها بلافاصله در فرم ثبت حضور و غیاب معلمان اعمال می‌شود.
        </div>
        <div className="text-[11px] text-slate-400">
          طرح تربیتی و آموزشی یاوران ولایت
        </div>
      </div>
    </div>
  );
};
