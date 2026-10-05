import React, { useState } from 'react';
import { WorkshopsSection } from './WorkshopsSection';
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
  const [tab, setTab] = useState<'official' | 'workshops'>('official');
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

      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {([
          ['official', 'دروس رسمی و کلاسی', null],
          ['workshops', 'کارگاه‌های انتخابی (هشتم و نهم)', '۱۲ کارگاه'],
        ] as const).map(([key, label, badge]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              tab === key
                ? 'bg-emerald-100/70 text-emerald-900 border-emerald-300 shadow-sm'
                : 'bg-slate-50/80 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>{label}</span>
            {badge && <span className="px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-bold text-teal-700">{badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'official' ? <SubjectManagementSection /> : <WorkshopsSection />}
    </div>
  );
};
