import { filterNavGroups } from '../utils/permissions';
import React, { useState } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { 
  LayoutDashboard,
  CheckCircle2, 
  ShieldAlert, 
  Users, 
  GraduationCap, 
  UserCheck, 
  HeartHandshake, 
  BookOpen, 
  FileSpreadsheet, 
  AlertTriangle,
  Settings,
  X, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';

export type FullScreenView = 
  | 'classes' 
  | 'students' 
  | 'attendance' 
  | 'delays' 
  | 'discipline' 
  | 'teachers' 
  | 'coaches' 
  | 'subjects' 
  | 'warnings' 
  | 'reports'
  | 'settings';

export interface AdminSidebarCounts {
  classes?: number;
  students?: number;
  teachers?: number;
  coaches?: number;
  warnings?: number;
  delays?: number;
  sessions?: number;
}

interface AdminSidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: FullScreenView | null;
  onSelectView: (view: FullScreenView | null) => void;
  onOpenSettings?: () => void;
  variant?: 'drawer' | 'docked';
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  counts?: AdminSidebarCounts;
  // Legacy individual props support
  studentCount?: number;
  classCount?: number;
  teacherCount?: number;
  coachCount?: number;
  warningCount?: number;
  delayCount?: number;
  sessionCount?: number;
}

interface NavItemDef {
  id: FullScreenView | null | 'settings';
  label: string;
  subtitle: string;
  tooltip: string;
  icon: React.ElementType;
  count?: number;
  isWarning?: boolean;
  isSettings?: boolean;
  allowedRoles?: string[]; // If undefined, accessible to all admin/vice roles
}

interface NavGroupDef {
  id: string;
  title: string;
  items: NavItemDef[];
}

export const AdminSidebarNav: React.FC<AdminSidebarNavProps> = ({
  isOpen,
  onClose,
  activeView,
  onSelectView,
  onOpenSettings,
  variant = 'drawer',
  isCollapsed = false,
  onToggleCollapse,
  counts,
  studentCount = 0,
  classCount = 0,
  teacherCount = 0,
  coachCount = 0,
  warningCount = 0,
  delayCount = 0,
  sessionCount = 0,
}) => {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const { currentUser, isAdmin } = useSchool();

  // Derive counts from props
  const totalStudents = counts?.students ?? studentCount;
  const totalClasses = counts?.classes ?? classCount;
  const totalTeachers = counts?.teachers ?? teacherCount;
  const totalCoaches = counts?.coaches ?? coachCount;
  const totalWarnings = counts?.warnings ?? warningCount;
  const totalSessions = counts?.sessions ?? sessionCount;

  // Pure Navigation Groups (Organised by User Tasks):
  // 1. خانه (داشبورد)
  // 2. امور روزانه (حضور و غیاب، ثبت مورد انضباطی)
  // 3. مدیریت مدرسه (دانش‌آموزان، کلاس‌ها، معلمان، مربیان، برنامه دروس)
  // 4. پیگیری و گزارش (گزارش‌ها، هشدارها)
  // 5. تنظیمات (تنظیمات سامانه)
  const rawNavGroups: NavGroupDef[] = [
    {
      id: 'home',
      title: 'خانه',
      items: [
        {
          id: null,
          label: 'داشبورد',
          subtitle: 'نمای کلی و آمار روز جاری',
          tooltip: 'داشبورد',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: 'daily_ops',
      title: 'امور روزانه',
      items: [
        {
          id: 'attendance',
          label: 'حضور و غیاب',
          subtitle: 'جلسات کلاسی، تأخیرها و غیبت‌ها',
          tooltip: 'حضور و غیاب',
          icon: CheckCircle2,
          count: totalSessions > 0 ? totalSessions : undefined,
          allowedRoles: ['admin', 'principal', 'vice_disciplinary', 'vice_educational', 'vice_principal'],
        },
        {
          id: 'discipline',
          label: 'ثبت مورد انضباطی',
          subtitle: 'ثبت تخلفات، تعهدات و نمرات',
          tooltip: 'ثبت مورد انضباطی',
          icon: ShieldAlert,
          allowedRoles: ['admin', 'principal', 'vice_disciplinary', 'vice_nurturing', 'coach', 'vice_principal'],
        },
      ],
    },
    {
      id: 'school_management',
      title: 'مدیریت مدرسه',
      items: [
        {
          id: 'students',
          label: 'دانش‌آموزان',
          subtitle: 'پرونده، سوابق و مدیریت اطلاعات',
          tooltip: 'دانش‌آموزان',
          icon: Users,
          count: totalStudents > 0 ? totalStudents : undefined,
        },
        {
          id: 'classes',
          label: 'کلاس‌ها',
          subtitle: 'پایه‌ها، رشته‌ها و ظرفیت کلاس‌ها',
          tooltip: 'کلاس‌ها',
          icon: GraduationCap,
          count: totalClasses > 0 ? totalClasses : undefined,
        },
        {
          id: 'teachers',
          label: 'معلمان',
          subtitle: 'فهرست اساتید، دروس و برنامه‌ریزی',
          tooltip: 'معلمان',
          icon: UserCheck,
          count: totalTeachers > 0 ? totalTeachers : undefined,
          allowedRoles: ['admin', 'principal', 'vice_educational', 'vice_principal'],
        },
        {
          id: 'coaches',
          label: 'مربیان',
          subtitle: 'مربیان تربیتی یاوران ولایت',
          tooltip: 'مربیان',
          icon: HeartHandshake,
          count: totalCoaches > 0 ? totalCoaches : undefined,
          allowedRoles: ['admin', 'principal', 'vice_nurturing', 'coach', 'vice_principal'],
        },
        {
          id: 'subjects',
          label: 'برنامه دروس',
          subtitle: 'عناوین درسی و زمان‌بندی زنگ‌ها',
          tooltip: 'برنامه دروس',
          icon: BookOpen,
          allowedRoles: ['admin', 'principal', 'vice_educational', 'vice_principal'],
        },
      ],
    },
    {
      id: 'reports_tracking',
      title: 'پیگیری و گزارش',
      items: [
        {
          id: 'reports',
          label: 'گزارش‌ها',
          subtitle: 'کارنامه، آمار تحصیلی و اکسل',
          tooltip: 'گزارش‌ها',
          icon: FileSpreadsheet,
        },
        {
          id: 'warnings',
          label: 'هشدارها',
          subtitle: 'موارد فوری نیازمند پیگیری',
          tooltip: 'هشدارها',
          icon: AlertTriangle,
          count: totalWarnings > 0 ? totalWarnings : undefined,
          isWarning: true,
        },
      ],
    },
    {
      id: 'system_settings',
      title: 'تنظیمات',
      items: [
        {
          id: 'settings',
          label: 'تنظیمات و اطلاعات پایه',
          subtitle: 'مشخصات مدرسه، سال، پایه‌ها و کاربران',
          tooltip: 'تنظیمات و اطلاعات پایه',
          icon: Settings,
          isSettings: false,
          allowedRoles: ['admin', 'principal', 'vice_educational', 'vice_disciplinary', 'vice_nurturing', 'vice_principal'],
        },
      ],
    },
  ];

  // Filter groups and items based on current user role
  const userRole = currentUser?.role || 'admin';
  const filteredNavGroups = filterNavGroups(rawNavGroups, currentUser)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!item.allowedRoles) return true;
        if (isAdmin) return true;
        return item.allowedRoles.includes(userRole);
      }),
    }))
    .filter((group) => group.items.length > 0);

  const handleItemClick = (item: NavItemDef) => {
    if (item.isSettings) {
      if (onOpenSettings) onOpenSettings();
      if (variant === 'drawer') onClose();
      return;
    }

    // Delays view is unified under attendance
    if (item.id === 'delays') {
      onSelectView('attendance');
    } else {
      onSelectView(item.id as FullScreenView | null);
    }

    if (variant === 'drawer') {
      onClose();
    }
  };

  const isItemActive = (itemId: FullScreenView | null | 'settings') => {
    // Map delays to attendance active state
    if (itemId === 'attendance') {
      return activeView === 'attendance' || activeView === 'delays';
    }
    return activeView === itemId;
  };

  // Render navigation interior content - STRICTLY NAVIGATION ONLY (NO LOGO)
  const renderNavContent = () => (
    <div className="flex flex-col h-full">
      {/* Header with Unified Toggle Button - Pure Navigation Control */}
      <div className={`p-2.5 border-b border-slate-200/80 shrink-0 flex items-center transition-all duration-200 ${
        isCollapsed ? 'justify-center' : 'justify-between'
      }`}>
        {!isCollapsed && (
          <span className="text-xs font-bold text-slate-500 pr-1 select-none">
            ناوبری سامانه
          </span>
        )}

        {/* Drawer Close Button (Mobile / Tablet) */}
        {variant === 'drawer' && (
          <button
            type="button"
            id="btn-sidebar-drawer-close"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer border border-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
            title="بستن منو (ESC)"
            aria-label="بستن منو"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Docked Desktop Toggle Button - The Single Unified Control */}
        {variant === 'docked' && onToggleCollapse && (
          <button
            type="button"
            id={isCollapsed ? 'btn-sidebar-expand' : 'btn-sidebar-collapse'}
            onClick={onToggleCollapse}
            className={`p-2 rounded-xl transition-colors cursor-pointer border focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700 ${
              isCollapsed 
                ? 'text-teal-800 bg-teal-50 hover:bg-teal-100 hover:text-teal-900 border-teal-200/80 shadow-2xs' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-slate-200/80'
            }`}
            title={isCollapsed ? 'باز کردن نوار کناری (بزرگ کردن)' : 'بستن نوار کناری (کوچک کردن)'}
            aria-label={isCollapsed ? 'باز کردن نوار کناری' : 'بستن نوار کناری'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Scrollable Body */}
      <div className={`flex-1 p-2.5 space-y-3.5 ${
        isCollapsed ? 'overflow-visible' : 'overflow-y-auto'
      }`}>
        {filteredNavGroups.map((group) => (
          <div key={group.id} className="space-y-1">
            {/* Group Title (Only in Expanded mode) */}
            {!isCollapsed ? (
              <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 select-none">
                {group.title}
              </div>
            ) : (
              <div className="my-1.5 border-t border-slate-100" />
            )}

            {/* Nav Items */}
            {group.items.map((item) => {
              const active = isItemActive(item.id);
              const Icon = item.icon;
              const itemIdStr = String(item.id);

              return (
                <div 
                  key={itemIdStr}
                  className="relative"
                  onMouseEnter={() => setHoveredItemId(itemIdStr)}
                  onMouseLeave={() => setHoveredItemId(null)}
                >
                  <button
                    type="button"
                    id={`sidebar-item-${itemIdStr}`}
                    onClick={() => handleItemClick(item)}
                    aria-label={item.label}
                    className={`w-full flex items-center transition-all duration-150 rounded-xl cursor-pointer text-right group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700 ${
                      isCollapsed 
                        ? 'justify-center p-3' 
                        : 'justify-between px-3 py-2.5 gap-2.5'
                    } ${
                      active
                        ? item.isWarning
                          ? 'bg-rose-700 text-white font-black shadow-xs ring-1 ring-rose-800'
                          : 'bg-teal-800 text-white font-black shadow-xs ring-1 ring-teal-900'
                        : item.isWarning
                          ? 'text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-bold'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                        active 
                          ? 'text-white' 
                          : item.isWarning
                            ? 'text-rose-600'
                            : 'text-slate-500 group-hover:text-teal-800'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {!isCollapsed && (
                        <div className="min-w-0">
                          <div className="text-xs leading-snug truncate">
                            {item.label}
                          </div>
                          <div className={`text-[10px] font-normal truncate mt-0.5 ${
                            active 
                              ? 'text-teal-100/90' 
                              : 'text-slate-400 group-hover:text-slate-500'
                          }`}>
                            {item.subtitle}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Badge Count or Active Indicator in Expanded Mode */}
                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.count !== undefined && item.count > 0 && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            active
                              ? 'bg-white/20 text-white'
                              : item.isWarning
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-600 group-hover:bg-teal-50 group-hover:text-teal-900'
                          }`}>
                            {toPersianDigits(item.count)}
                          </span>
                        )}
                        {active && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* High-Contrast Floating Tooltip in Collapsed Mode */}
                  {isCollapsed && hoveredItemId === itemIdStr && (
                    <div 
                      className="absolute right-full top-1/2 -translate-y-1/2 mr-3 z-50 pointer-events-none"
                      style={{ minWidth: '130px' }}
                    >
                      <div 
                        className="bg-slate-900/95 text-white text-xs rounded-xl shadow-xl px-3 py-2 border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xs text-right"
                        dir="rtl"
                        role="tooltip"
                      >
                        <div className="font-black flex items-center justify-between gap-2">
                          <span className="text-slate-100 font-bold">{item.tooltip || item.label}</span>
                          {active && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-teal-500/20 text-teal-300 font-bold border border-teal-400/30">
                              فعال
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5 leading-snug">
                          {item.subtitle}
                        </div>
                        {item.count !== undefined && item.count > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">تعداد:</span>
                            <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${
                              item.isWarning ? 'bg-rose-500/30 text-rose-300' : 'bg-slate-800 text-slate-200'
                            }`}>
                              {toPersianDigits(item.count)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Subtle Year Footer only in expanded mode - completely absent in collapsed */}
      {!isCollapsed && (
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50 shrink-0 text-center select-none">
          <span className="text-[10px] text-slate-400 font-medium">
            سال تحصیلی {getActiveAcademicYear()}
          </span>
        </div>
      )}
    </div>
  );

  // If Drawer variant (Mobile / Tablet):
  if (variant === 'drawer') {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex" dir="rtl">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Slide-over Drawer */}
        <aside
          className="fixed top-0 right-0 h-full w-72 sm:w-80 bg-white shadow-2xl z-50 transform transition-transform duration-200 ease-in-out flex flex-col border-l border-slate-200"
          aria-label="منوی اصلی سامانه"
        >
          {renderNavContent()}
        </aside>
      </div>
    );
  }

  // If Docked variant (Desktop layout):
  return (
    <aside
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs transition-all duration-200 overflow-visible ${
        isCollapsed ? 'w-[72px]' : 'w-64'
      }`}
      aria-label="منوی اصلی سامانه"
      dir="rtl"
    >
      {renderNavContent()}
    </aside>
  );
};
