import React from 'react';
import { User } from '../types';
import { HeartHandshake, GraduationCap } from 'lucide-react';

interface RolePanelSwitcherProps {
  currentUser: User;
  currentActiveTab: 'main' | 'discipline' | 'grades' | 'nurture' | 'teacher';
  onSelectTab: (tab: 'main' | 'discipline' | 'grades' | 'nurture' | 'teacher') => void;
  className?: string;
}

export const RolePanelSwitcher: React.FC<RolePanelSwitcherProps> = ({
  currentActiveTab,
  onSelectTab,
  className = '',
}) => {
  const isTeacherActive = currentActiveTab === 'teacher';

  const base =
    'min-w-[6.5rem] sm:min-w-[7.5rem] px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer select-none whitespace-nowrap';

  return (
    <div
      role="tablist"
      aria-label="انتخاب پنل کاری"
      dir="rtl"
      className={`inline-flex shrink-0 items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs gap-1 ${className}`}
    >
      <button
        type="button"
        role="tab"
        aria-selected={!isTeacherActive}
        id="role-switcher-btn-nurture"
        onClick={() => onSelectTab('nurture')}
        className={`${base} ${
          !isTeacherActive ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
        }`}
      >
        <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
        <span>پنل تربیتی</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={isTeacherActive}
        id="role-switcher-btn-teacher"
        onClick={() => onSelectTab('teacher')}
        className={`${base} ${
          isTeacherActive ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
        }`}
      >
        <GraduationCap className="w-3.5 h-3.5 shrink-0" />
        <span>پنل آموزشی</span>
      </button>
    </div>
  );
};
