import { useSchool } from '../context/SchoolContext';
import { filterNavGroups } from '../utils/permissions';
import React, { useState } from 'react';
import { 
  LayoutDashboard,
  School, 
  BookOpen, 
  GraduationCap, 
  Award, 
  ClipboardCheck,
  FileText, 
  BarChart3, 
  AlertTriangle,
  Users, 
  CheckCircle2, 
  Settings,
  Megaphone,
  UserCheck,
  X, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

export type EducationalViewType = 
  | null 
  | 'classes' 
  | 'subjects' 
  | 'teachers' 
  | 'grades' 
  | 'report_cards' 
  | 'comprehensive_exam'
  | 'announcements'
  | 'teacher_evaluation'
  | 'reports' 
  | 'warnings' 
  | 'students' 
  | 'attendance' 
  | 'settings';

export interface EducationalSidebarCounts {
  classes?: number;
  subjects?: number;
  teachers?: number;
  grades?: number; // نمرات ثبت‌نشده یا خالی
  reportCards?: number;
  warnings?: number; // دانش‌آموزان با معدل کمتر از ۱۲ یا نیازمند توجه
  students?: number;
  attendanceSessions?: number;
}

interface EducationalSidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: EducationalViewType;
  onSelectView: (view: EducationalViewType) => void;
  onOpenSettings?: () => void;
  variant?: 'drawer' | 'docked';
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  counts?: EducationalSidebarCounts;
  canAccessAttendance?: boolean;
}

interface NavItemDef {
  id: EducationalViewType;
  label: string;
  tooltip: string;
  icon: React.ElementType;
  count?: number;
  isWarning?: boolean;
}

interface NavGroupDef {
  id: string;
  title: string;
  items: NavItemDef[];
}

export const EducationalSidebarNav: React.FC<EducationalSidebarNavProps> = ({
  isOpen,
  onClose,
  activeView,
  onSelectView,
  onOpenSettings,
  variant = 'docked',
  isCollapsed = false,
  onToggleCollapse,
  counts,
  canAccessAttendance = true,
}) => {
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const totalClasses = counts?.classes ?? 0;
  const totalSubjects = counts?.subjects ?? 0;
  const totalTeachers = counts?.teachers ?? 0;
  const totalUngraded = counts?.grades ?? 0;
  const totalReportCards = counts?.reportCards ?? 0;
  const totalWarnings = counts?.warnings ?? 0;
  const { currentUser } = useSchool();
  const totalStudents = counts?.students ?? 0;
  const totalSessions = counts?.attendanceSessions ?? 0;

  // ساختار گروه‌بندی استاندارد معاونت آموزشی:
  // ۱. خانه (داشبورد)
  // ۲. آموزش (کلاس‌ها، دروس، دبیران)
  // ۳. ارزیابی (ثبت نمره، کارنامه، گزارش‌های آموزشی)
  // ۴. پیگیری آموزشی (دانش‌آموزان نیازمند پیگیری، وضعیت تحصیلی)
  // ۵. امور کلاسی (حضور و غیاب کلاسی - در صورت وجود دسترسی)
  // ۶. سیستم (تنظیمات)
  const navGroups: NavGroupDef[] = [
    {
      id: 'home',
      title: 'خانه',
      items: [
        {
          id: null,
          label: 'داشبورد',
          tooltip: 'داشبورد وضعیت آموزشی',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: 'academics',
      title: 'آموزش',
      items: [
        {
          id: 'classes',
          label: 'کلاس‌ها',
          tooltip: 'کلاس‌ها و پایه‌ها',
          icon: School,
          count: totalClasses > 0 ? totalClasses : undefined,
        },
        {
          id: 'subjects',
          label: 'دروس',
          tooltip: 'برنامه دروس و زنگ‌ها',
          icon: BookOpen,
          count: totalSubjects > 0 ? totalSubjects : undefined,
        },
        {
          id: 'teachers',
          label: 'دبیران',
          tooltip: 'دبیران و اساتید',
          icon: GraduationCap,
          count: totalTeachers > 0 ? totalTeachers : undefined,
        },
        {
          id: 'announcements',
          label: 'بخشنامه‌ها و اطلاعیه‌ها',
          tooltip: 'مدیریت و ابلاغ بخشنامه‌ها و اطلاعیه‌ها به اساتید',
          icon: Megaphone,
        },
      ],
    },
    {
      id: 'evaluation',
      title: 'ارزیابی',
      items: [
        {
          id: 'grades',
          label: 'ثبت نمره',
          tooltip: 'ثبت نمرات مستمر و پایانی',
          icon: Award,
          count: totalUngraded > 0 ? totalUngraded : undefined,
          isWarning: totalUngraded > 0,
        },
        {
          id: 'comprehensive_exam',
          label: 'آزمون جامع',
          tooltip: 'ثبت نمرات و تحلیل آزمون جامع',
          icon: ClipboardCheck,
        },
        {
          id: 'report_cards',
          label: 'کارنامه',
          tooltip: 'کارنامه و سوابق تحصیلی',
          icon: FileText,
          count: totalReportCards > 0 ? totalReportCards : undefined,
        },
        {
          id: 'reports',
          label: 'گزارش‌های آموزشی',
          tooltip: 'گزارش‌ها و تحلیل معدل',
          icon: BarChart3,
        },
        {
          id: 'teacher_evaluation',
          label: 'ارزیابی اساتید',
          tooltip: 'ارزیابی دوره‌ای عملکرد اساتید',
          icon: UserCheck,
        },
      ],
    },
    {
      id: 'tracking',
      title: 'پیگیری آموزشی',
      items: [
        {
          id: 'warnings',
          label: 'دانش‌آموزان نیازمند پیگیری',
          tooltip: 'دانش‌آموزان نیازمند توجه و هشدارها',
          icon: AlertTriangle,
          count: totalWarnings > 0 ? totalWarnings : undefined,
          isWarning: true,
        },
        {
          id: 'students',
          label: 'وضعیت تحصیلی',
          tooltip: 'پرونده تحصیلی دانش‌آموزان',
          icon: Users,
          count: totalStudents > 0 ? totalStudents : undefined,
        },
      ],
    },
  ];

  // حضور و غیاب کلاسی (فقط در صورت داشتن دسترسی و فقط کلاسی)
  if (canAccessAttendance) {
    navGroups.push({
      id: 'classroom_ops',
      title: 'امور کلاسی',
      items: [
        {
          id: 'attendance',
          label: 'حضور و غیاب کلاسی',
          tooltip: 'دفتر حضور و غیاب کلاس‌ها',
          icon: CheckCircle2,
          count: totalSessions > 0 ? totalSessions : undefined,
        },
      ],
    });
  }

  // سیستم و تنظیمات
  navGroups.push({
    id: 'system',
    title: 'سیستم',
    items: [
      {
        id: 'settings',
        label: 'تنظیمات',
        tooltip: 'تنظیمات آموزشی و پایه‌ها',
        icon: Settings,
      },
    ],
  });

  const handleItemClick = (item: NavItemDef) => {
    if (item.id === 'settings' && onOpenSettings) {
      onOpenSettings();
    } else {
      onSelectView(item.id);
    }

    if (variant === 'drawer') {
      onClose();
    }
  };

  const isItemActive = (itemId: EducationalViewType) => {
    return activeView === itemId;
  };

  // بدنه ناوبری اصلی (مستقل از لوگو و آرم جهت تمرکز کامل بر کاربری آموزشی)
  const renderNavContent = () => (
    <div className="flex flex-col h-full bg-white select-none">
      {/* هدر سایدبار با دکمه جمع‌وجور باز/بسته شدن در موقعیت ثابت */}
      <div 
        className={`p-3 border-b border-slate-200/80 shrink-0 flex items-center transition-all duration-200 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2 pr-1">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
            <span className="text-xs font-bold text-slate-700">
              ناوبری معاونت آموزشی
            </span>
          </div>
        )}

        {/* دکمه بستن در حالت Drawer موبایل */}
        {variant === 'drawer' && (
          <button
            type="button"
            id="btn-educational-sidebar-drawer-close"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer border border-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
            title="بستن نوار کناری (ESC)"
            aria-label="بستن نوار کناری"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* دکمه جمع و باز کردن سایدبار دسکتاپ (Toggle Button) */}
        {variant === 'docked' && onToggleCollapse && (
          <button
            type="button"
            id={isCollapsed ? 'btn-educational-sidebar-expand' : 'btn-educational-sidebar-collapse'}
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

      {/* بخش اسکرول ناوبری و گزینه‌ها */}
      <div 
        className={`flex-1 p-2 space-y-2.5 ${
          isCollapsed ? 'overflow-visible' : 'overflow-y-auto'
        }`}
      >
        {filterNavGroups(navGroups, currentUser).map((group) => (
          <div key={group.id} className="space-y-0.5">
            {/* عنوان گروه منو در حالت Expanded */}
            {!isCollapsed ? (
              <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 mt-1">
                {group.title}
              </div>
            ) : (
              <div className="my-1.5 border-t border-slate-100" />
            )}

            {/* گزینه‌های منو */}
            {group.items.map((item) => {
              const active = isItemActive(item.id);
              const Icon = item.icon;
              const itemIdStr = item.id === null ? 'dashboard' : String(item.id);

              return (
                <div 
                  key={itemIdStr}
                  className="relative"
                  onMouseEnter={() => setHoveredItemId(itemIdStr)}
                  onMouseLeave={() => setHoveredItemId(null)}
                >
                  <button
                    type="button"
                    id={`edu-sidebar-nav-${itemIdStr}`}
                    onClick={() => handleItemClick(item)}
                    aria-label={item.label}
                    className={`w-full flex items-center transition-all duration-150 rounded-xl cursor-pointer text-right group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700 ${
                      isCollapsed 
                        ? 'justify-center p-2.5' 
                        : 'justify-between px-3 py-2 gap-2.5'
                    } ${
                      active
                        ? item.isWarning && item.id === 'warnings'
                          ? 'bg-rose-700 text-white font-black shadow-xs ring-1 ring-rose-800'
                          : 'bg-teal-800 text-white font-black shadow-xs ring-1 ring-teal-900'
                        : item.isWarning && item.id === 'warnings'
                          ? 'text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-bold'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                        active 
                          ? 'text-white' 
                          : item.isWarning && item.id === 'warnings'
                            ? 'text-rose-600'
                            : 'text-slate-500 group-hover:text-teal-800'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {!isCollapsed && (
                        <span className="text-xs leading-none truncate">
                          {item.label}
                        </span>
                      )}
                    </div>

                    {/* بج عددی در حالت باز */}
                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.count !== undefined && item.count > 0 && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            active
                              ? 'bg-white/20 text-white'
                              : item.isWarning
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600 group-hover:bg-teal-50 group-hover:text-teal-900'
                          }`}>
                            {toPersianDigits(item.count)}
                          </span>
                        )}
                        {active && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* تول‌تیپ فارسی با کنتراست بالا در حالت Collapsed */}
                  {isCollapsed && hoveredItemId === itemIdStr && (
                    <div 
                      className="absolute right-full top-1/2 -translate-y-1/2 mr-3 z-50 pointer-events-none"
                      style={{ minWidth: '120px' }}
                    >
                      <div 
                        className="bg-slate-900/95 text-white text-xs rounded-xl shadow-xl px-3 py-2 border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xs text-right"
                        dir="rtl"
                        role="tooltip"
                      >
                        <div className="font-bold flex items-center justify-between gap-2">
                          <span className="text-slate-100">{item.tooltip}</span>
                          {active && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-teal-500/25 text-teal-300 font-bold border border-teal-400/30">
                              فعال
                            </span>
                          )}
                        </div>
                        {item.count !== undefined && item.count > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-800 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">تعداد:</span>
                            <span className={`px-1.5 py-0.2 rounded font-mono font-bold ${
                              item.isWarning ? 'bg-amber-500/30 text-amber-300' : 'bg-slate-800 text-slate-200'
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
    </div>
  );

  // حالت کشویی در دستگاه‌های همراه (Mobile / Tablet Drawer)
  if (variant === 'drawer') {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex" dir="rtl">
        {/* پس‌زمینه نیمه‌شفاف */}
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* سایدبار کشویی */}
        <aside
          className="fixed top-0 right-0 h-full w-64 sm:w-72 bg-white shadow-2xl z-50 transform transition-transform duration-200 ease-in-out flex flex-col border-l border-slate-200"
          aria-label="نوار کناری معاونت آموزشی"
        >
          {renderNavContent()}
        </aside>
      </div>
    );
  }

  // حالت پیش‌فرض دسکتاپ (Docked Sidebar)
  return (
    <aside
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs transition-all duration-200 overflow-visible ${
        isCollapsed ? 'w-[72px]' : 'w-64'
      }`}
      aria-label="نوار کناری معاونت آموزشی"
      dir="rtl"
    >
      {renderNavContent()}
    </aside>
  );
};
