import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { HeartHandshake, GraduationCap, ChevronDown, Check, ArrowRightLeft } from 'lucide-react';

interface RolePanelSwitcherProps {
  currentUser: User;
  currentActiveTab: 'main' | 'discipline' | 'grades' | 'nurture' | 'teacher';
  onSelectTab: (tab: 'main' | 'discipline' | 'grades' | 'nurture' | 'teacher') => void;
  className?: string;
}

export const RolePanelSwitcher: React.FC<RolePanelSwitcherProps> = ({
  currentUser,
  currentActiveTab,
  onSelectTab,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isTeacherActive = currentActiveTab === 'teacher';
  const subjectName = currentUser.teachingSubject || 'درس تخصصی';

  // Close on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (tab: 'nurture' | 'teacher') => {
    onSelectTab(tab);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-flex items-center ${className}`} dir="rtl">
      {/* Desktop Quick Toggle Buttons (Side-by-side pills) */}
      <div className="hidden md:flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-2xs gap-1">
        <button
          type="button"
          id="role-switcher-btn-nurture"
          onClick={() => handleSelect('nurture')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none ${
            !isTeacherActive
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
          title="ورود به پنل تربیتی و پرونده‌های رشد"
        >
          <HeartHandshake className="w-3.5 h-3.5" />
          <span>پنل تربیتی</span>
          {!isTeacherActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          id="role-switcher-btn-teacher"
          onClick={() => handleSelect('teacher')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none ${
            isTeacherActive
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
          }`}
          title={`ورود به پنل آموزشی و تدریس ${subjectName}`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>پنل آموزشی ({subjectName})</span>
          {isTeacherActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
          )}
        </button>
      </div>

      {/* Dropdown Button for compact/mobile view or explicit dropdown */}
      <div className="relative">
        <button
          type="button"
          id="role-switcher-dropdown-trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="true"
          className={`flex md:hidden items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer select-none shadow-2xs ${
            isTeacherActive
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-teal-50 border-teal-300 text-teal-900'
          }`}
        >
          {isTeacherActive ? (
            <GraduationCap className="w-4 h-4 text-emerald-700" />
          ) : (
            <HeartHandshake className="w-4 h-4 text-teal-700" />
          )}
          <div className="text-right">
            <span className="text-[10px] text-slate-500 block font-normal leading-none mb-0.5">پنل فعلی:</span>
            <span className="font-extrabold">{isTeacherActive ? 'پنل آموزشی' : 'پنل تربیتی'}</span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 text-right"
            role="menu"
            aria-orientation="vertical"
          >
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">انتخاب پنل کاری</span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3" />
                سوییچ سریع
              </span>
            </div>

            <div className="py-1.5 space-y-1">
              {/* Option: Nurturing Panel */}
              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelect('nurture')}
                className={`w-full p-2.5 rounded-xl text-right transition flex items-start justify-between cursor-pointer ${
                  !isTeacherActive
                    ? 'bg-teal-50/80 border border-teal-200 text-teal-950'
                    : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    !isTeacherActive ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <HeartHandshake className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">پنل تربیتی</div>
                    <div className="text-[10px] text-teal-800 font-medium">مربی طرح یاوران ولایت</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      پرونده‌های رشد، مشاهده‌گری رفتاری و ارزشیابی
                    </div>
                  </div>
                </div>
                {!isTeacherActive && (
                  <Check className="w-4 h-4 text-teal-700 shrink-0 mt-1" />
                )}
              </button>

              {/* Option: Educational Panel */}
              <button
                type="button"
                role="menuitem"
                onClick={() => handleSelect('teacher')}
                className={`w-full p-2.5 rounded-xl text-right transition flex items-start justify-between cursor-pointer ${
                  isTeacherActive
                    ? 'bg-emerald-50/80 border border-emerald-200 text-emerald-950'
                    : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    isTeacherActive ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">پنل آموزشی</div>
                    <div className="text-[10px] text-emerald-800 font-medium">معلم {subjectName}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      کلاس‌های تدریس، حضور و غیاب، ثبت نمره و کارنامه
                    </div>
                  </div>
                </div>
                {isTeacherActive && (
                  <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-1" />
                )}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
              یک حساب کاربری با دسترسی دوگانه
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
