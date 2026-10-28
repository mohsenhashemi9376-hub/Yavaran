import { useSchool } from '../context/SchoolContext';
import { filterNavGroups } from '../utils/permissions';
import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  School,
  BookOpen,
  GraduationCap,
  Award,
  ClipboardCheck,
  ClipboardList,
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
  ChevronRight,
  ChevronDown,
  ListChecks,
  Clock,
  BellRing,
  Layers,
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
  | 'grey_list'
  | 'homework_followup'
  | 'worksheets'
  | 'lesson_plans'
  | 'timesheets'
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
  /** بج عددی خاکستری؛ فقط برای موارد ضروری */
  count?: number;
  /** بج قرمز درخشان و بولد (هشدار فوری) */
  urgent?: number;
  /** صفحهٔ مستقل (Blade) به‌جای نمای داخل داشبورد */
  href?: string;
}

interface NavGroupDef {
  id: string;
  title: string;
  icon: React.ElementType;
  items: NavItemDef[];
  /** گروه تک‌لینک (بدون زیرمنو) */
  single?: boolean;
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
  const { currentUser } = useSchool();
  const totalUngraded = counts?.grades ?? 0;
  const totalWarnings = counts?.warnings ?? 0;

  // معماری اطلاعات: داشبورد، مدیریت اساتید، امور آموزشی، سنجش و کارنامه، مرکز پیگیری و هشدار، سیستم
  const allGroups: NavGroupDef[] = [
    { id: 'home', title: 'داشبورد', icon: LayoutDashboard, single: true, items: [{ id: null, label: 'داشبورد', tooltip: 'داشبورد وضعیت آموزشی', icon: LayoutDashboard }] },
    {
      id: 'staff',
      title: 'مدیریت اساتید',
      icon: GraduationCap,
      items: [
        { id: 'teachers', label: 'لیست دبیران', tooltip: 'دبیران و اساتید', icon: UserCheck },
        { id: 'lesson_plans', label: 'بررسی طرح درس‌ها', tooltip: 'نظارت، بازخورد و تأیید طرح درس روزانه‌ی اساتید', icon: ClipboardCheck },
        { id: 'teacher_evaluation', label: 'ارزیابی عملکرد', tooltip: 'ارزیابی دوره‌ای عملکرد اساتید', icon: BarChart3 },
        { id: 'timesheets', label: 'تایم‌شیت', tooltip: 'ساعت کاری و خودارزیابی ماهانه‌ی اساتید', icon: Clock },
      ],
    },
    {
      id: 'academics',
      title: 'امور آموزشی',
      icon: School,
      items: [
        { id: 'classes', label: 'مدیریت کلاس‌ها', tooltip: 'کلاس‌ها و پایه‌ها', icon: School },
        { id: 'subjects', label: 'برنامه دروس', tooltip: 'برنامه دروس و زنگ‌ها', icon: BookOpen },
        ...(canAccessAttendance ? [{ id: 'attendance' as const, label: 'حضور و غیاب کلاسی', tooltip: 'دفتر حضور و غیاب کلاس‌ها', icon: CheckCircle2 }] : []),
        { id: 'worksheets', label: 'کاربرگ‌ها', tooltip: 'کاربرگ هفتگی دانش‌آموزان و مهلت ثبت', icon: Layers },
        { id: 'students', label: 'وضعیت تحصیلی', tooltip: 'پرونده تحصیلی دانش‌آموزان', icon: Users },
      ],
    },
    {
      id: 'assessment',
      title: 'سنجش و کارنامه',
      icon: Award,
      items: [
        { id: 'grades', label: 'ثبت نمرات', tooltip: 'ثبت نمرات مستمر و پایانی', icon: Award, count: totalUngraded > 0 ? totalUngraded : undefined },
        { id: 'comprehensive_exam', label: 'آزمون جامع', tooltip: 'ثبت نمرات و تحلیل آزمون جامع', icon: ClipboardCheck },
        { id: 'report_cards', label: 'صدور کارنامه', tooltip: 'کارنامه و سوابق تحصیلی', icon: FileText },
        { id: 'reports', label: 'گزارش‌های تحصیلی', tooltip: 'گزارش‌ها و تحلیل معدل', icon: BarChart3 },
      ],
    },
    {
      id: 'alerts',
      title: 'مرکز پیگیری و هشدار',
      icon: BellRing,
      items: [
        { id: 'warnings', label: 'دانش‌آموزان نیازمند پیگیری', tooltip: 'دانش‌آموزان نیازمند توجه و هشدارها', icon: AlertTriangle, urgent: totalWarnings > 0 ? totalWarnings : undefined },
        { id: 'grey_list', label: 'لیست خاکستری', tooltip: 'دانش‌آموزان نیازمند پیگیری آموزشی با علت ضعف و اقدام', icon: ListChecks },
        { id: 'homework_followup', label: 'پیگیری تکالیف', tooltip: 'دانش‌آموزانی که تکلیف را انجام نداده‌اند', icon: ClipboardList },
      ],
    },
    {
      id: 'system',
      title: 'سیستم',
      icon: Settings,
      items: [
        { id: 'announcements', label: 'بخشنامه‌ها', tooltip: 'مدیریت و ابلاغ بخشنامه‌ها و اطلاعیه‌ها به اساتید', icon: Megaphone },
        { id: 'settings', label: 'تنظیمات', tooltip: 'تنظیمات آموزشی و پایه‌ها', icon: Settings },
      ],
    },
  ];

  const navGroups = filterNavGroups(allGroups, currentUser)
    .map((g) => ({ ...g, items: g.items.filter((i) => i.id !== 'lesson_plans' || currentUser.role === 'vice_educational') }))
    .filter((g) => g.items.length > 0);

  const isItemActive = (item: NavItemDef) => activeView === item.id;
  const groupHasActive = (g: NavGroupDef) => g.items.some(isItemActive);
  const groupAlert = (g: NavGroupDef) => g.items.some((i) => (i.urgent ?? 0) > 0);

  // آکاردئون: گروهِ دارای آیتم فعال به‌صورت خودکار باز است
  const [openGroups, setOpenGroups] = useState<string[]>(() => navGroups.filter((g) => !g.single && groupHasActive(g)).map((g) => g.id));
  useEffect(() => {
    const active = navGroups.find((g) => !g.single && groupHasActive(g));
    if (active) setOpenGroups((prev) => (prev.includes(active.id) ? prev : [...prev, active.id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  const toggleGroup = (id: string) => setOpenGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const handleItemClick = (item: NavItemDef) => {
    if (item.href) {
      window.location.assign(item.href);
      return;
    }
    if (item.id === 'settings' && onOpenSettings) onOpenSettings();
    else onSelectView(item.id as EducationalViewType);
    if (variant === 'drawer') onClose();
  };

  /** در حالت جمع‌شده، لمس آیکون گروه، نوار را باز و همان گروه را باز می‌کند */
  const handleCollapsedGroup = (g: NavGroupDef) => {
    if (g.single) return handleItemClick(g.items[0]);
    setOpenGroups((prev) => (prev.includes(g.id) ? prev : [...prev, g.id]));
    onToggleCollapse?.();
  };

  const UrgentBadge: React.FC<{ n: number; active: boolean }> = ({ n }) => (
    <span className="relative inline-flex shrink-0" aria-label={`${toPersianDigits(n)} مورد فوری`}>
      <span className="absolute inset-0 rounded-full bg-rose-500 opacity-60 animate-ping" aria-hidden="true" />
      <span className="relative min-w-6 rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[11px] font-black leading-4 text-white shadow-[0_0_10px_rgba(244,63,94,0.7)]">
        {toPersianDigits(n)}
      </span>
    </span>
  );

  const renderGroup = (g: NavGroupDef) => {
    const GroupIcon = g.icon;
    const activeGroup = groupHasActive(g);
    const open = openGroups.includes(g.id);

    // حالت جمع‌شده: فقط آیکون گروه‌ها
    if (isCollapsed) {
      return (
        <div key={g.id} className="relative flex justify-center">
          <button
            type="button"
            onClick={() => handleCollapsedGroup(g)}
            title={g.title}
            aria-label={g.title}
            className={`relative flex size-11 items-center justify-center rounded-xl transition cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 ${activeGroup ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <GroupIcon className="size-5" />
            {groupAlert(g) && <span className="absolute top-1.5 left-1.5 size-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />}
          </button>
        </div>
      );
    }

    // لینک تکی (داشبورد)
    if (g.single) {
      const item = g.items[0];
      const active = isItemActive(item);
      return (
        <button
          key={g.id}
          type="button"
          id="edu-sidebar-nav-dashboard"
          onClick={() => handleItemClick(item)}
          className={`flex w-full min-h-11 items-center gap-3 rounded-xl px-3 text-right text-sm transition cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 ${active ? 'bg-emerald-50 font-black text-emerald-800' : 'font-semibold text-slate-700 hover:bg-slate-100'}`}
        >
          <GroupIcon className={`size-5 shrink-0 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span>{g.title}</span>
        </button>
      );
    }

    return (
      <div key={g.id}>
        <button
          type="button"
          onClick={() => toggleGroup(g.id)}
          aria-expanded={open}
          aria-controls={`edu-group-${g.id}`}
          className={`flex w-full min-h-11 items-center gap-3 rounded-xl px-3 text-right text-sm transition cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 ${activeGroup ? 'font-black text-slate-900' : 'font-semibold text-slate-700 hover:bg-slate-100'}`}
        >
          <GroupIcon className={`size-5 shrink-0 ${activeGroup ? 'text-emerald-600' : 'text-slate-400'}`} />
          <span className="flex-1 truncate">{g.title}</span>
          {!open && groupAlert(g) && <span className="size-2.5 shrink-0 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" aria-hidden="true" />}
          <ChevronDown className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* باز و بسته شدن نرم: انیمیشن ارتفاع با grid-rows */}
        <div id={`edu-group-${g.id}`} className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <ul className="min-h-0 overflow-hidden" aria-hidden={!open}>
            <li className="me-5 mt-0.5 space-y-0.5 border-e-2 border-slate-100 pe-2 pb-1">
              {g.items.map((item) => {
                const active = isItemActive(item);
                const Icon = item.icon;
                const itemIdStr = item.id === null ? 'dashboard' : String(item.id);
                return (
                  <button
                    key={itemIdStr}
                    type="button"
                    id={`edu-sidebar-nav-${itemIdStr}`}
                    tabIndex={open ? 0 : -1}
                    onClick={() => handleItemClick(item)}
                    title={item.tooltip}
                    className={`flex w-full min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-right text-[13px] transition cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                      active ? 'bg-emerald-600 font-black text-white shadow-xs' : item.urgent ? 'font-bold text-rose-700 hover:bg-rose-50' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 ${active ? 'text-white' : item.urgent ? 'text-rose-500' : 'text-slate-400'}`} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.urgent !== undefined && <UrgentBadge n={item.urgent} active={active} />}
                    {item.count !== undefined && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>{toPersianDigits(item.count)}</span>
                    )}
                  </button>
                );
              })}
            </li>
          </ul>
        </div>
      </div>
    );
  };

  const renderNavContent = () => (
    <div className="flex h-full flex-col bg-white select-none">
      <div className={`flex shrink-0 items-center border-b border-slate-100 p-3 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 pr-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-slate-700">معاونت آموزشی</span>
          </div>
        )}
        {variant === 'drawer' && (
          <button type="button" id="btn-educational-sidebar-drawer-close" onClick={onClose} className="flex size-11 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-800 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600" title="بستن نوار کناری (ESC)" aria-label="بستن نوار کناری">
            <X className="size-4" />
          </button>
        )}
        {variant === 'docked' && onToggleCollapse && (
          <button
            type="button"
            id={isCollapsed ? 'btn-educational-sidebar-expand' : 'btn-educational-sidebar-collapse'}
            onClick={onToggleCollapse}
            className="flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600"
            title={isCollapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'}
            aria-label={isCollapsed ? 'باز کردن نوار کناری' : 'جمع کردن نوار کناری'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        )}
      </div>
      <nav className={`flex-1 space-y-1 p-2 ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}`} aria-label="منوی معاونت آموزشی">
        {navGroups.map(renderGroup)}
      </nav>
    </div>
  );

  if (variant === 'drawer') {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex" dir="rtl">
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs animate-in fade-in" onClick={onClose} aria-hidden="true" />
        <aside className="fixed top-0 right-0 z-50 flex h-full w-72 flex-col border-l border-slate-200 bg-white shadow-2xl" aria-label="نوار کناری معاونت آموزشی">
          {renderNavContent()}
        </aside>
      </div>
    );
  }

  return (
    <aside className={`overflow-visible rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 ${isCollapsed ? 'w-[72px]' : 'w-64'}`} aria-label="نوار کناری معاونت آموزشی" dir="rtl">
      {renderNavContent()}
    </aside>
  );
};
