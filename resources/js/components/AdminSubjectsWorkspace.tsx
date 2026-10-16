import React, { useState } from 'react';
import { WorkshopsSection } from './WorkshopsSection';
import { SubjectManagementSection } from './SubjectManagementSection';
import { BookOpen } from 'lucide-react';
import { WorkspaceHeader } from './ui/WorkspaceHeader';

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
      <WorkspaceHeader
        title="برنامه دروس"
        icon={BookOpen}
        section="مدیریت مدرسه"
        subtitle="دروس رسمی هر کلاس، دبیر هر درس و کارگاه‌های انتخابی پایه‌ی هشتم و نهم."
        onBack={onBack}
        onOpenSidebar={onOpenSidebar}
      />

      <div className="flex gap-2 flex-wrap" role="tablist">
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
