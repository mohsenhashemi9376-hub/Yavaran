import React from 'react';
import { User, SchoolClass, TeachingAssignment } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { 
  LayoutDashboard, 
  GraduationCap, 
  BookOpen, 
  UserCheck, 
  Award, 
  FileText, 
  BarChart3, 
  MessageSquare, 
  ChevronLeft,
  ChevronRight,
  Sparkles,
  School,
  Calendar
} from 'lucide-react';

export type TeacherViewType = 
  | 'dashboard'
  | 'classes'
  | 'subjects'
  | 'attendance'
  | 'grades'
  | 'report_cards'
  | 'reports'
  | 'evaluations';

interface TeacherSidebarNavProps {
  activeView: TeacherViewType;
  onSelectView: (view: TeacherViewType) => void;
  currentUser: User;
  teachingClasses: SchoolClass[];
  teachingSubjects: string[];
  totalSessionsCount: number;
  totalStudentsCount: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
}

export const TeacherSidebarNav: React.FC<TeacherSidebarNavProps> = ({
  activeView,
  onSelectView,
  currentUser,
  teachingClasses,
  teachingSubjects,
  totalSessionsCount,
  totalStudentsCount,
  isCollapsed = false,
  onToggleCollapse,
  isMobileDrawer = false,
  onCloseMobileDrawer,
}) => {
  const isCoachTeacher = currentUser.role === 'coach' && currentUser.isAlsoTeacher;

  const navGroups: {
    title: string;
    items: {
      id: TeacherViewType;
      label: string;
      icon: React.FC<{ className?: string }>;
      badge?: string | number;
      badgeColor?: string;
    }[];
  }[] = [
    {
      title: 'خانه',
      items: [
        {
          id: 'dashboard',
          label: 'داشبورد معلم',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'آموزش',
      items: [
        {
          id: 'classes',
          label: 'کلاس‌های من',
          icon: School,
          badge: toPersianDigits(teachingClasses.length),
          badgeColor: 'bg-emerald-100 text-emerald-800',
        },
        {
          id: 'subjects',
          label: 'دروس من',
          icon: BookOpen,
          badge: toPersianDigits(teachingSubjects.length),
          badgeColor: 'bg-sky-100 text-sky-800',
        },
        {
          id: 'attendance',
          label: 'حضور و غیاب',
          icon: UserCheck,
          badge: toPersianDigits(totalSessionsCount),
          badgeColor: 'bg-teal-100 text-teal-800',
        },
        {
          id: 'grades',
          label: 'ثبت نمره',
          icon: Award,
        },
        {
          id: 'report_cards',
          label: 'کارنامه و نمرات',
          icon: FileText,
        },
      ],
    },
    {
      title: 'پیگیری و ارزیابی',
      items: [
        {
          id: 'reports',
          label: 'گزارش‌های آموزشی',
          icon: BarChart3,
        },
        {
          id: 'evaluations',
          label: 'اعلانات و ارزیابی',
          icon: MessageSquare,
        },
      ],
    },
  ];

  const handleItemClick = (id: TeacherViewType) => {
    onSelectView(id);
    if (isMobileDrawer && onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  return (
    <aside
      className={`bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col transition-all duration-300 select-none ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
      dir="rtl"
    >
      {/* Header Info */}
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
        {!isCollapsed ? (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black text-slate-900 truncate">
                  {isCoachTeacher ? 'پنل آموزشی مربی' : 'میز کار دبیر'}
                </h3>
                <p className="text-[10px] text-emerald-800 font-semibold truncate">
                  تدریس: {teachingSubjects.join('، ') || 'دروس اختصاصی'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <GraduationCap className="w-4 h-4" />
          </div>
        )}

        {onToggleCollapse && !isMobileDrawer && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0"
            title={isCollapsed ? 'گسترش منو' : 'جمع کردن منو'}
          >
            {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation List */}
      <div className="p-2 space-y-4 flex-1 overflow-y-auto">
        {navGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  } ${isCollapsed ? 'justify-center px-0' : 'justify-between'}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isCollapsed && item.badge !== undefined && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : (item.badgeColor || 'bg-slate-100 text-slate-700')
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Scope Restriction Indicator */}
      {!isCollapsed && (
        <div className="p-3 m-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-950 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900">
            <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
            <span>حوزه دسترسی آموزشی</span>
          </div>
          <p className="text-[10px] text-emerald-800 leading-relaxed">
            دسترسی شما محدود به {toPersianDigits(teachingClasses.length)} کلاس و {toPersianDigits(totalStudentsCount)} دانش‌آموز تحت تدریس شماست.
          </p>
        </div>
      )}
    </aside>
  );
};
