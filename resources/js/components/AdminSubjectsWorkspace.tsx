import React from 'react';
import { SubjectManagementSection } from './SubjectManagementSection';
import { ArrowRight, Menu } from 'lucide-react';

interface AdminSubjectsWorkspaceProps {
  onBack: () => void;
  onOpenSidebar: () => void;
}

export const AdminSubjectsWorkspace: React.FC<AdminSubjectsWorkspaceProps> = ({
  onBack,
  onOpenSidebar,
}) => {
  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center transition cursor-pointer border border-slate-200"
          title="بازگشت به داشبورد"
          aria-label="بازگشت به داشبورد"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-extrabold text-slate-900 flex-1">مدیریت دروس</h1>
        <button
          onClick={onOpenSidebar}
          className="lg:hidden h-10 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
          aria-label="باز کردن منو"
        >
          <Menu className="w-4 h-4" />
          <span>منو</span>
        </button>
      </div>

      <SubjectManagementSection />
    </div>
  );
};
