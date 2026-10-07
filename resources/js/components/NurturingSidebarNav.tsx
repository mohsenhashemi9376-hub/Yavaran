import { filterNavGroups } from '../utils/permissions';
import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard,
  Eye, 
  FolderHeart, 
  Award, 
  Users, 
  AlertCircle,
  BarChart3, 
  Settings,
  X, 
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  BookOpen,
  Search
} from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';
import { Student, SchoolClass, StudentObservation } from '../types';
import { useSchool } from '../context/SchoolContext';
import { studentFullName, compareStudents } from '../utils/studentName';

export type NurturingViewType = 
  | null 
  | 'dashboard' 
  | 'observation' 
  | 'dossier' 
  | 'coachEvaluations' 
  | 'coaches' 
  | 'attention' 
  | 'reports' 
  | 'settings'
  | 'academic_and_discipline'
  | 'taught_lessons';

export interface NurturingSidebarCounts {
  observations?: number;
  dossiers?: number;
  evaluations?: number;
  coaches?: number;
  attentionNeeded?: number;
}

interface NurturingSidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: NurturingViewType;
  onSelectView: (view: NurturingViewType) => void;
  onOpenSettings?: () => void;
  variant?: 'drawer' | 'docked';
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  counts?: NurturingSidebarCounts;
  canManageCoaches?: boolean;
  students?: Student[];
  classes?: SchoolClass[];
  observations?: StudentObservation[];
  onSelectStudent?: (student: Student) => void;
}

interface NavItemDef {
  id: NurturingViewType | 'student_observations';
  label: string;
  tooltip: string;
  icon: React.ElementType;
  count?: number;
  isWarning?: boolean;
  isExpandable?: boolean;
}

interface NavGroupDef {
  id: string;
  title: string;
  items: NavItemDef[];
}

export const NurturingSidebarNav: React.FC<NurturingSidebarNavProps> = ({
  isOpen,
  onClose,
  activeView,
  onSelectView,
  onOpenSettings,
  variant = 'docked',
  isCollapsed = false,
  onToggleCollapse,
  counts,
  canManageCoaches = true,
  students: propStudents,
  classes: propClasses,
  observations: propObservations,
  onSelectStudent,
}) => {
  const school = useSchool();
  const isCoachUser = school.currentUser.role === 'coach';
  // مربی فقط کلاس‌های خودش را می‌بیند؛ مدیر و معاونین کل مدرسه را
  const actualClasses = propClasses ?? (isCoachUser ? school.nurturingClasses : school.classes) ?? [];
  const sidebarClassIds = useMemo(() => new Set(actualClasses.map((c) => c.id)), [actualClasses]);
  const actualStudents = useMemo(() => {
    const list = propStudents ?? school.students;
    return isCoachUser ? list.filter((s) => sidebarClassIds.has(s.classId)) : list;
  }, [propStudents, school.students, isCoachUser, sidebarClassIds]);
  const actualObservations = useMemo(() => {
    const list = propObservations ?? school.observations;
    if (!isCoachUser) return list;
    const ids = new Set(actualStudents.map((s) => s.id));
    return list.filter((o) => ids.has(o.studentId));
  }, [propObservations, school.observations, isCoachUser, actualStudents]);

  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isStudentObsExpanded, setIsStudentObsExpanded] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const singleClassId = isCoachUser && actualClasses.length === 1 ? actualClasses[0].id : null;
  const effectiveClassFilter = singleClassId ?? (sidebarClassIds.has(selectedClassFilter) ? selectedClassFilter : 'all');

  const totalObservations = counts?.observations ?? actualObservations.length ?? 0;
  const totalDossiers = counts?.dossiers ?? 0;
  const totalEvaluations = counts?.evaluations ?? 0;
  const totalCoaches = counts?.coaches ?? 0;
  const totalAttentionNeeded = counts?.attentionNeeded ?? 0;

  // محاسبه تجمیعی یکپارچه تعداد مشاهدات هر دانش‌آموز (Single-pass O(N) Aggregate برای جلوگیری از N+1)
  const studentObservationCounts = useMemo(() => {
    const countsMap: Record<string, number> = {};
    if (actualObservations && actualObservations.length > 0) {
      for (let i = 0; i < actualObservations.length; i++) {
        const sId = actualObservations[i].studentId;
        if (sId) {
          countsMap[sId] = (countsMap[sId] || 0) + 1;
        }
      }
    }
    return countsMap;
  }, [actualObservations]);

  // فیلتر و مرتب‌سازی بهینه دانش‌آموزان (ابتدا بر اساس تعداد مشاهده، سپس نام خانوادگی)
  const filteredStudentsList = useMemo(() => {
    if (!actualStudents || actualStudents.length === 0) return [];

    let list = actualStudents;
    if (effectiveClassFilter !== 'all') {
      list = list.filter((s) => s.classId === effectiveClassFilter);
    }

    const query = studentSearchTerm.trim().toLowerCase();
    if (query) {
      list = list.filter((s) => {
        const fullName = `${studentFullName(s)}`.toLowerCase();
        return fullName.includes(query);
      });
    }

    return [...list].sort((a, b) => {
      const countA = studentObservationCounts[a.id] || 0;
      const countB = studentObservationCounts[b.id] || 0;
      if (countB !== countA) {
        return countB - countA;
      }
      return compareStudents(a, b);
    });
  }, [actualStudents, effectiveClassFilter, studentSearchTerm, studentObservationCounts]);

  // ساختار استاندارد و خلوت منوی معاونت تربیتی و پرورشی:
  // ۱. خانه (داشبورد)
  // ۲. امور تربیتی (مشاهده‌گری رفتاری، مشاهدات دانش‌آموزان، پرونده تربیتی، ارزیابی رشد، مربیان)
  // ۳. پیگیری (موارد نیازمند توجه، گزارش‌های تربیتی)
  // ۴. سیستم (تنظیمات)
  const navGroups: NavGroupDef[] = [
    {
      id: 'home',
      title: 'خانه',
      items: [
        {
          id: 'dashboard',
          label: 'داشبورد',
          tooltip: 'داشبورد جامع امور تربیتی',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: 'nurturing_affairs',
      title: 'امور تربیتی',
      items: [
        {
          id: 'observation',
          label: 'مشاهده‌گری رفتاری',
          tooltip: 'ثبت و پیگیری مشاهدات رفتاری و عاطفی',
          icon: Eye,
          count: totalObservations > 0 ? totalObservations : undefined,
        },
        {
          id: 'student_observations',
          label: 'مشاهدات دانش‌آموزان',
          tooltip: 'مشاهده تعداد مشاهدات ثبت‌شده برای هر دانش‌آموز',
          icon: ClipboardList,
          count: totalObservations > 0 ? totalObservations : undefined,
          isExpandable: true,
        },
        {
          id: 'dossier',
          label: 'پرونده تربیتی',
          tooltip: 'پرونده جامع ۸ بخشی تربیتی دانش‌آموزان',
          icon: FolderHeart,
          count: totalDossiers > 0 ? totalDossiers : undefined,
        },
        {
          id: 'coachEvaluations',
          label: 'ارزیابی رشد',
          tooltip: 'ارزیابی شاخص‌های شش‌گانه رشد فردی',
          icon: Award,
          count: totalEvaluations > 0 ? totalEvaluations : undefined,
        },
      ],
    },
    {
      id: 'education',
      title: 'آموزش و انضباط',
      items: [
        {
          id: 'academic_and_discipline',
          label: 'آموزش و انضباط کلاس‌ها',
          tooltip: 'نمای یکپارچه کارنامه، غیبت‌ها و نمرات',
          icon: BookOpen,
        },
        {
          id: 'taught_lessons',
          label: 'درس‌های تدریس‌شده و تکالیف',
          tooltip: 'عنوان درس هر جلسه و تکلیف داده‌شده توسط استاد',
          icon: ClipboardList,
        },
      ],
    },
    {
      id: 'tracking',
      title: 'پیگیری',
      items: [
        {
          id: 'attention',
          label: 'موارد نیازمند توجه',
          tooltip: 'دانش‌آموزان نیازمند هدایت و توجه ویژه',
          icon: AlertCircle,
          count: totalAttentionNeeded > 0 ? totalAttentionNeeded : undefined,
          isWarning: true,
        },
        {
          id: 'reports',
          label: 'گزارش‌های تربیتی',
          tooltip: 'تحلیل آماری و نمودارهای رشد تربیتی',
          icon: BarChart3,
        },
      ],
    },
  ];

  // افزودن گزینه مربیان در صورت دسترسی مجاز
  if (canManageCoaches) {
    const affairsGroup = navGroups.find((g) => g.id === 'nurturing_affairs');
    if (affairsGroup) {
      affairsGroup.items.push({
        id: 'coaches',
        label: 'مربیان',
        tooltip: 'مربیان تربیتی یاوران ولایت و کلاس‌های مرتبط',
        icon: Users,
        count: totalCoaches > 0 ? totalCoaches : undefined,
      });
    }
  }

  // بخش سیستم و تنظیمات
  navGroups.push({
    id: 'system',
    title: 'سیستم',
    items: [
      {
        id: 'settings',
        label: 'تنظیمات',
        tooltip: 'تنظیمات و شاخص‌های تربیتی',
        icon: Settings,
      },
    ],
  });

  const handleItemClick = (item: NavItemDef) => {
    if (item.id === 'student_observations') {
      if (isCollapsed) {
        onToggleCollapse?.();
        setIsStudentObsExpanded(true);
      } else {
        setIsStudentObsExpanded((prev) => !prev);
      }
      return;
    }

    if (item.id === 'settings' && onOpenSettings) {
      onOpenSettings();
    } else {
      onSelectView(item.id as NurturingViewType);
    }

    if (variant === 'drawer') {
      onClose();
    }
  };

  const isItemActive = (itemId: NurturingViewType | 'student_observations') => {
    if (itemId === 'student_observations') {
      return isStudentObsExpanded;
    }
    if (itemId === 'dashboard' || itemId === null) {
      return activeView === 'dashboard' || activeView === null;
    }
    return activeView === itemId;
  };

  // بدنه اصلی منو بدون هرگونه لوگو یا بنر تبلیغاتی، صرفاً برای ناوبری سریع و روان
  const renderNavContent = () => (
    <div className="flex flex-col h-full bg-white select-none">
      {/* هدر سایدبار با دکمه کنترل یکپارچه جمع‌وجور باز/بسته شدن در موقعیت ثابت */}
      <div 
        className={`p-3 border-b border-slate-200/80 shrink-0 flex items-center transition-all duration-200 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2 pr-1">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-xs font-bold text-slate-700">
              ناوبری معاونت تربیتی
            </span>
          </div>
        )}

        {/* دکمه بستن در حالت Drawer موبایل */}
        {variant === 'drawer' && (
          <button
            type="button"
            id="btn-nurturing-sidebar-drawer-close"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer border border-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-700"
            title="بستن نوار کناری (ESC)"
            aria-label="بستن نوار کناری"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* دکمه واحد جمع و باز کردن سایدبار دسکتاپ (Single Toggle Button) */}
        {variant === 'docked' && onToggleCollapse && (
          <button
            type="button"
            id={isCollapsed ? 'btn-nurturing-sidebar-expand' : 'btn-nurturing-sidebar-collapse'}
            onClick={onToggleCollapse}
            className={`p-2 rounded-xl transition-colors cursor-pointer border focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-700 ${
              isCollapsed 
                ? 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-900 border-emerald-200/80 shadow-2xs' 
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

      {/* لیست گروه‌ها و گزینه‌های منو */}
      <div 
        className={`flex-1 p-2 space-y-2.5 ${
          isCollapsed ? 'overflow-visible' : 'overflow-y-auto'
        }`}
      >
        {filterNavGroups(navGroups, school.currentUser).map((group) => (
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
                    id={`nur-sidebar-nav-${itemIdStr}`}
                    onClick={() => handleItemClick(item)}
                    aria-label={item.label}
                    className={`w-full flex items-center transition-all duration-150 rounded-xl cursor-pointer text-right group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                      isCollapsed 
                        ? 'justify-center p-2.5' 
                        : 'justify-between px-3 py-2 gap-2.5'
                    } ${
                      active
                        ? item.isWarning && item.id === 'attention'
                          ? 'bg-rose-700 text-white font-black shadow-xs ring-1 ring-rose-800'
                          : 'bg-emerald-800 text-white font-black shadow-xs ring-1 ring-emerald-900'
                        : item.isWarning && item.id === 'attention'
                          ? 'text-rose-700 hover:bg-rose-50 hover:text-rose-800 font-bold'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                        active 
                          ? 'text-white' 
                          : item.isWarning && item.id === 'attention'
                            ? 'text-rose-600'
                            : 'text-slate-500 group-hover:text-emerald-800'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {!isCollapsed && (
                        <span className="text-xs leading-none truncate">
                          {item.label}
                        </span>
                      )}
                    </div>

                    {/* نشانگر تعداد (بج) در حالت باز - فقط در صورت وجود عدد مثبت */}
                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.count !== undefined && item.count > 0 && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            active
                              ? 'bg-white/20 text-white'
                              : item.isWarning
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-900'
                          }`}>
                            {toPersianDigits(item.count)}
                          </span>
                        )}
                        {item.isExpandable ? (
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                            isStudentObsExpanded ? 'rotate-180 text-emerald-700' : ''
                          }`} />
                        ) : active ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        ) : null}
                      </div>
                    )}
                  </button>

                  {/* پنل بازشونده آکاردئونی فهرست مشاهدات هر دانش‌آموز (فقط در حالت عدم جمع‌شدگی سایدبار) */}
                  {!isCollapsed && item.id === 'student_observations' && isStudentObsExpanded && (
                    <div 
                      className="mt-1 mb-2 p-2 bg-slate-50/95 rounded-xl border border-slate-200/90 shadow-2xs space-y-2 text-right transition-all animate-in fade-in duration-150"
                      dir="rtl"
                    >
                      {/* جستجوی سریع نام دانش‌آموز */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          id="sidebar-student-obs-search-input"
                          value={studentSearchTerm}
                          onChange={(e) => setStudentSearchTerm(e.target.value)}
                          placeholder="جستجوی دانش‌آموز..."
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg pr-8 pl-6 py-1.5 outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition placeholder:text-slate-400 text-slate-800"
                        />
                        {studentSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setStudentSearchTerm('')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                            title="پاک کردن جستجو"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* فیلتر کلاس در صورت وجود بیش از یک کلاس */}
                      {actualClasses && (actualClasses.length > 1 || singleClassId) && (
                        <div className="flex items-center gap-1.5">
                          <label htmlFor="sidebar-student-obs-class-filter" className="text-[10px] text-slate-500 font-bold shrink-0">کلاس:</label>
                          <select
                            id="sidebar-student-obs-class-filter"
                            value={effectiveClassFilter}
                            onChange={(e) => setSelectedClassFilter(e.target.value)}
                            className="w-full text-[10px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-600 text-slate-700 cursor-pointer"
                          >
                            {!singleClassId && <option value="all">همه کلاس‌ها</option>}
                            {actualClasses.map((cls) => (
                              <option key={cls.id} value={cls.id}>
                                {cls.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* لیست مستقل اسکرول‌شونده دانش‌آموزان با محدودیت ارتفاع دقیق */}
                      <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 pl-0.5">
                        {filteredStudentsList.length > 0 ? (
                          filteredStudentsList.map((student) => {
                            const count = studentObservationCounts[student.id] || 0;
                            return (
                              <button
                                key={student.id}
                                type="button"
                                id={`sidebar-student-obs-item-${student.id}`}
                                onClick={() => {
                                  onSelectStudent?.(student);
                                  if (variant === 'drawer') {
                                    onClose();
                                  }
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-white hover:shadow-2xs transition-all text-right group cursor-pointer border border-transparent hover:border-slate-200/80"
                                title={`مشاهده پرونده تربیتی ${studentFullName(student)} (${toPersianDigits(count)} مشاهده)`}
                              >
                                {/* فقط نام فارسی دانش‌آموز - بدون هیچ کد یا اطلاعات انگلیسی و فنی */}
                                <span className="text-slate-800 group-hover:text-emerald-800 font-medium truncate text-xs">
                                  {studentFullName(student)}
                                </span>

                                {/* نشانگر تعداد با فرمت [ ۵ ] یا [ ۰ ] دقیقاً مطابق مشخصات */}
                                <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 transition-colors ${
                                  count > 0 
                                    ? 'bg-emerald-100 text-emerald-800 group-hover:bg-emerald-700 group-hover:text-white' 
                                    : 'bg-slate-200/70 text-slate-500'
                                }`}>
                                  [ {toPersianDigits(count)} ]
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="py-3 text-center text-[11px] text-slate-400 font-medium">
                            دانش‌آموزی یافت نشد
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* تول‌تیپ اختصاصی فارسی با کنتراست عالی در حالت Collapsed */}
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
                            <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-400/30">
                              فعال
                            </span>
                          )}
                        </div>
                        {item.count !== undefined && item.count > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-800 flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">تعداد:</span>
                            <span className={`px-1.5 py-0.2 rounded font-mono font-bold ${
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
    </div>
  );

  // حالت کشویی در دستگاه‌های همراه (Mobile / Tablet Drawer)
  if (variant === 'drawer') {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex" dir="rtl">
        {/* پس‌زمینه نیمه‌شفاف برای بستن با کلیک خارج */}
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* سایدبار کشویی */}
        <aside
          className="fixed top-0 right-0 h-full w-64 sm:w-72 bg-white shadow-2xl z-50 transform transition-transform duration-200 ease-in-out flex flex-col border-l border-slate-200"
          aria-label="نوار کناری معاونت تربیتی"
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
      aria-label="نوار کناری معاونت تربیتی"
      dir="rtl"
    >
      {renderNavContent()}
    </aside>
  );
};
