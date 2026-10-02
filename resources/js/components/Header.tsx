import React, { useState, useEffect, useRef } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { getUserGreeting } from '../utils/userRoles';
import { SchoolBrand } from './SchoolBrand';
import { UserProfileModal } from './UserProfileModal';
import { SupportModal } from './SupportModal';
import { SystemSettingsModal } from './SystemSettingsModal';
import { RolePanelSwitcher } from './RolePanelSwitcher';
import { 
  School, 
  ShieldAlert, 
  BookOpen, 
  HeartHandshake, 
  Bell, 
  ChevronDown, 
  LogOut, 
  Users, 
  Settings, 
  User as UserIcon,
  HelpCircle,
  PlusCircle, 
  Menu, 
  X, 
  GraduationCap,
  Search
} from 'lucide-react';

interface HeaderProps {
  onOpenNewClassModal: () => void;
  onOpenNewTeacherModal: () => void;
  onOpenAcademicGrades?: () => void;
  onOpenDisciplinaryDashboard?: () => void;
  onOpenLoginModal?: () => void;
  onOpenGlobalSearch?: () => void;
  currentActiveTab?: 'main' | 'discipline' | 'grades' | 'nurture' | 'teacher';
  onSelectTab?: (tab: 'main' | 'discipline' | 'grades' | 'nurture' | 'teacher') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewClassModal,
  onOpenNewTeacherModal,
  onOpenAcademicGrades,
  onOpenDisciplinaryDashboard,
  onOpenLoginModal,
  onOpenGlobalSearch,
  currentActiveTab = 'main',
  onSelectTab,
}) => {
  const { 
    currentUser, 
    classes, 
    students, 
    sessions, 
    isAdmin,
    isAdminOrVice,
    schoolSettings,
    logout,
    showConfirm
  } = useSchool();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // بستن منوهای شناور با کلیک/لمس در بیرون از آن‌ها
  useEffect(() => {
    if (!showUserMenu && !showNotifications) return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(t)) setShowUserMenu(false);
      if (showNotifications && notifRef.current && !notifRef.current.contains(t)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [showUserMenu, showNotifications]);

  const todayInfo = getTodayShamsi();
  const userGreeting = getUserGreeting(currentUser);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUserMenu(false);
        setShowNotifications(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Warning count for school notifications (students with >= 2 absences)
  const warningCount = students.filter((student) => {
    let abs = 0;
    sessions.filter((s) => s.classId === student.classId).forEach((s) => {
      if (s.records[student.id]?.status === 'absent') abs++;
    });
    return abs >= 2;
  }).length;

  const closeAllMenus = () => {
    setShowUserMenu(false);
    setShowNotifications(false);
    setMobileMenuOpen(false);
  };

  const handleBrandClick = () => {
    if (onSelectTab) {
      if (currentUser.role === 'coach') {
        onSelectTab('nurture');
      } else if (currentUser.role === 'teacher') {
        onSelectTab('teacher');
      } else {
        onSelectTab('main');
      }
    }
  };

  return (
    <header className="yv-header bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs" dir="rtl">
      {/* Click-outside backdrop for open dropdowns */}
      {(showUserMenu || showNotifications || mobileMenuOpen) && (
        <div 
          className="fixed inset-0 z-40 bg-transparent" 
          onClick={closeAllMenus}
          aria-hidden="true"
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16 gap-2 sm:gap-4">
          
          {/* ==================================================
              1. Right: School Brand (Logo + Name + Academic Year)
          ================================================== */}
          <SchoolBrand
            onClick={handleBrandClick}
            size="md"
            showAcademicYear
            showDate
          />

          {/* ==================================================
              2. Center: High-Level Navigation Tabs & Role Switcher
          ================================================== */}
          {onSelectTab && (
            currentUser.role === 'coach' && currentUser.isAlsoTeacher ? (
              <RolePanelSwitcher
                currentUser={currentUser}
                currentActiveTab={currentActiveTab}
                onSelectTab={onSelectTab}
              />
            ) : isAdmin ? (
              <nav aria-label="بخش‌های اصلی سامانه" className="hidden lg:flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 text-xs font-bold gap-1">
                <button
                  id="header-tab-main"
                  type="button"
                  onClick={() => onSelectTab('main')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    currentActiveTab === 'main'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  <span>کلاس‌ها و داشبورد</span>
                </button>

                <button
                  id="header-tab-discipline"
                  type="button"
                  onClick={() => {
                    onSelectTab('discipline');
                    if (onOpenDisciplinaryDashboard) onOpenDisciplinaryDashboard();
                  }}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    currentActiveTab === 'discipline'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>معاونت اجرایی</span>
                </button>

                <button
                  id="header-tab-grades"
                  type="button"
                  onClick={() => {
                    onSelectTab('grades');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    currentActiveTab === 'grades'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>معاونت آموزش</span>
                </button>

                {/* تب معاونت تربیتی برای مدیر مدرسه نمایش داده نمی‌شود */}
                {!isAdmin && (
                <button
                  id="header-tab-nurture"
                  type="button"
                  onClick={() => onSelectTab('nurture')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    currentActiveTab === 'nurture'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <HeartHandshake className="w-3.5 h-3.5" />
                  <span>معاونت تربیتی</span>
                </button>
                )}

                {/* پنل آموزشی برای کاربرانی که درسی به آن‌ها واگذار شده است */}
                {currentUser.isAlsoTeacher && (
                <button
                  id="header-tab-teacher"
                  type="button"
                  onClick={() => onSelectTab('teacher')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    currentActiveTab === 'teacher'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>پنل آموزشی</span>
                </button>
                )}
              </nav>
            ) : currentUser.isAlsoTeacher && currentUser.role !== 'teacher' ? (
              <div
                role="tablist"
                aria-label="انتخاب پنل کاری"
                className="inline-flex shrink-0 items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 gap-1 text-xs font-bold"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={currentActiveTab !== 'teacher'}
                  onClick={() => onSelectTab('main')}
                  className={`min-w-[6.5rem] px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    currentActiveTab !== 'teacher' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  پنل معاونت
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={currentActiveTab === 'teacher'}
                  onClick={() => onSelectTab('teacher')}
                  className={`min-w-[6.5rem] px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    currentActiveTab === 'teacher' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  پنل آموزشی
                </button>
              </div>
            ) : null
          )}

          {/* ==================================================
              3. Left: Search + Notifications + User Menu + Mobile Toggle
          ================================================== */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* جستجوی سراسری (Global Search Trigger) */}
            {onOpenGlobalSearch && (
              <>
                {/* Desktop & Tablet Search Bar */}
                <button
                  id="btn-header-global-search"
                  type="button"
                  onClick={onOpenGlobalSearch}
                  className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-slate-100/90 hover:bg-slate-200/70 border border-slate-200/90 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer text-xs group"
                  title="جستجوی سراسری (Ctrl+K)"
                  aria-label="جستجوی سراسری"
                >
                  <Search className="w-3.5 h-3.5 text-teal-800 group-hover:scale-110 transition-transform shrink-0" />
                  <span className="hidden xl:inline font-medium">جستجوی دانش‌آموز، کلاس، معلم...</span>
                  <span className="xl:hidden inline font-medium">جستجو...</span>
                  <kbd className="inline-flex items-center px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-400 shadow-2xs">
                    Ctrl K
                  </kbd>
                </button>

                {/* Mobile Search Icon Button */}
                <button
                  id="btn-header-global-search-mobile"
                  type="button"
                  onClick={onOpenGlobalSearch}
                  className="sm:hidden p-2 rounded-xl border bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                  title="جستجو"
                  aria-label="جستجوی سراسری"
                >
                  <Search className="w-4 h-4 text-teal-800" />
                </button>
              </>
            )}

            {/* 4. اعلان‌ها (Notifications) */}
            <div className="relative" ref={notifRef}>
              <button
                id="btn-header-notifications"
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowUserMenu(false);
                  setMobileMenuOpen(false);
                }}
                className={`relative p-2 rounded-xl border transition cursor-pointer ${
                  showNotifications
                    ? 'bg-slate-100 border-slate-300 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title="اعلانات و پیام‌ها"
                aria-label="اعلانات"
              >
                <Bell className="w-4 h-4" />
                {warningCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {toPersianDigits(warningCount)}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 px-4 z-50 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900">اعلانات مدرسه</span>
                    {warningCount > 0 ? (
                      <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                        {toPersianDigits(warningCount)} مورد نیازمند بررسی
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                        همه شاخص‌ها عادی
                      </span>
                    )}
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    {warningCount > 0 ? (
                      <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-100 text-rose-950 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full bg-rose-600 inline-block"></span>
                          <span>اخطار غیبت دانش‌آموزان</span>
                        </div>
                        <p className="text-[11px] text-rose-800 leading-relaxed">
                          {toPersianDigits(warningCount)} دانش‌آموز دارای ۲ جلسه غیبت یا بیشتر هستند.
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-3 text-[11px]">
                        هیچ اخطار جدیدی برای نمایش وجود ندارد.
                      </p>
                    )}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 text-[11px] text-center">
                      سال تحصیلی {getActiveAcademicYear()} • دبیرستان دوره اول یاوران ولایت
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. اطلاعات کاربر و منوی حساب (User Menu) */}
            <div className="relative" ref={userMenuRef}>
              <button
                id="btn-header-user-menu"
                type="button"
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  setShowNotifications(false);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border transition cursor-pointer select-none ${
                  showUserMenu 
                    ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-inner' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs'
                }`}
                title="حساب کاربری و تنظیمات"
                aria-label="منوی کاربر"
                aria-expanded={showUserMenu}
                aria-haspopup="menu"
              >
                <div className="w-8 h-8 rounded-full bg-teal-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  {currentUser?.name ? currentUser.name.slice(0, 2) : 'کا'}
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    <span>{userGreeting.greeting}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180 text-teal-800' : ''}`} />
                  </div>
                  <div className="text-[10px] text-teal-800 font-semibold truncate max-w-[130px]">
                    {userGreeting.roleLabel}
                  </div>
                  {currentUser.role === 'coach' && currentUser.isAlsoTeacher && (
                    <div className="text-[9px] text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                      <span>پنل: {currentActiveTab === 'teacher' ? 'آموزشی' : 'تربیتی'}</span>
                    </div>
                  )}
                </div>
              </button>

              {showUserMenu && (
                <div 
                  className="absolute left-0 mt-2 w-64 sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs animate-in fade-in select-none"
                  role="menu"
                  aria-orientation="vertical"
                  aria-labelledby="btn-header-user-menu"
                >
                  {/* معرفی کاربر (User Identity) */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-800 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                      {currentUser?.name ? currentUser.name.slice(0, 2) : 'کا'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-slate-900 text-sm truncate">
                        {currentUser?.name || 'کاربر گرامی'}
                      </div>
                      <div className="text-[11px] font-semibold text-teal-800 mt-0.5 truncate">
                        {userGreeting.roleLabel}
                      </div>
                    </div>
                  </div>

                  {/* سوییچ سریع پنل کاری برای مربی-معلم */}
                  {currentUser.role === 'coach' && currentUser.isAlsoTeacher && onSelectTab && (
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/80">
                      <div className="text-[10px] text-slate-500 font-bold mb-1.5 flex items-center justify-between">
                        <span>سوییچ سریع پنل:</span>
                        <span className="text-emerald-800 font-extrabold">
                          {currentActiveTab === 'teacher' ? 'پنل آموزشی فعال است' : 'پنل تربیتی فعال است'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTab('nurture');
                            setShowUserMenu(false);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                            currentActiveTab !== 'teacher'
                              ? 'bg-teal-800 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <HeartHandshake className="w-3 h-3" />
                          <span>پنل تربیتی</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTab('teacher');
                            setShowUserMenu(false);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                            currentActiveTab === 'teacher'
                              ? 'bg-emerald-800 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <GraduationCap className="w-3 h-3" />
                          <span>پنل آموزشی</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* عملیات شخصی کاربر */}
                  <div className="py-1">
                    {/* حساب کاربری */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowProfileModal(true);
                      }}
                      className="w-full text-right px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 cursor-pointer transition font-medium"
                    >
                      <UserIcon className="w-4 h-4 text-slate-500" />
                      <span>حساب کاربری</span>
                    </button>
                  </div>

                  {/* بخش تنظیمات و پشتیبانی */}
                  <div className="border-t border-slate-100 py-1">
                    {/* تنظیمات سامانه یا تنظیمات کاربری بر اساس سطح دسترسی */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowUserMenu(false);
                        if (isAdminOrVice) {
                          setShowSettingsModal(true);
                        } else {
                          setShowProfileModal(true);
                        }
                      }}
                      className="w-full text-right px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 cursor-pointer transition font-medium"
                    >
                      <Settings className="w-4 h-4 text-slate-500" />
                      <span>{isAdminOrVice ? 'تنظیمات سامانه' : 'تنظیمات'}</span>
                    </button>

                    {/* پشتیبانی و راهنما */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowSupportModal(true);
                      }}
                      className="w-full text-right px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 cursor-pointer transition font-medium"
                    >
                      <HelpCircle className="w-4 h-4 text-slate-500" />
                      <span>پشتیبانی و راهنما</span>
                    </button>
                  </div>

                  {/* خروج از حساب کاربری (با رنگ هشدار و تاییدیه) */}
                  <div className="border-t border-slate-100 pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowUserMenu(false);
                        showConfirm({
                          title: 'خروج از حساب کاربری',
                          message: 'آیا می‌خواهید از حساب کاربری خود خارج شوید؟',
                          confirmLabel: 'خروج',
                          cancelLabel: 'انصراف',
                          isDangerous: true,
                          onConfirm: () => {
                            logout();
                            if (onOpenLoginModal) onOpenLoginModal();
                          },
                        });
                      }}
                      className="w-full text-right px-4 py-2.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 cursor-pointer transition font-bold"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>خروج از حساب</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            {onSelectTab && (
              <button
                id="btn-header-mobile-menu"
                type="button"
                onClick={() => {
                  setMobileMenuOpen(!mobileMenuOpen);
                  setShowNotifications(false);
                  setShowUserMenu(false);
                }}
                className="p-2 lg:hidden rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                title="منوی بخش‌ها"
                aria-label="منوی بخش‌ها"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}

          </div>

        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 text-xs font-bold animate-in fade-in">
          {/* مشخصات کاربر در منوی موبایل */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-2 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">{userGreeting.greeting}</div>
              <div className="text-[11px] font-semibold text-teal-800 mt-0.5">{userGreeting.roleLabel}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">امروز: {todayInfo.dayOfWeek}، {todayInfo.displayDate}</div>
            </div>
          </div>

          {/* سوییچ سریع پنل برای مربی-معلم در منوی موبایل */}
          {currentUser.role === 'coach' && currentUser.isAlsoTeacher && onSelectTab && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl mb-2 space-y-2">
              <div className="text-[11px] font-bold text-amber-950 flex items-center justify-between">
                <span>پنل کاری فعال:</span>
                <span className="font-extrabold text-amber-900">
                  {currentActiveTab === 'teacher' ? 'پنل آموزشی (معلم)' : 'پنل تربیتی (مربی)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('nurture');
                    setMobileMenuOpen(false);
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    currentActiveTab !== 'teacher'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  <HeartHandshake className="w-3.5 h-3.5" />
                  <span>پنل تربیتی</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('teacher');
                    setMobileMenuOpen(false);
                  }}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    currentActiveTab === 'teacher'
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>پنل آموزشی</span>
                </button>
              </div>
            </div>
          )}

          {onOpenGlobalSearch && (
            <button
              type="button"
              onClick={() => {
                onOpenGlobalSearch();
                setMobileMenuOpen(false);
              }}
              className="w-full text-right px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-between transition cursor-pointer mb-2"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-teal-800" />
                <span>جستجوی سراسری (دانش‌آموز، کلاس، معلم...)</span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90" />
            </button>
          )}

          {onSelectTab && isAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  onSelectTab('main');
                  setMobileMenuOpen(false);
                }}
            className={`w-full text-right px-3 py-2.5 rounded-xl transition flex items-center gap-2 ${
              currentActiveTab === 'main' ? 'bg-teal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <School className="w-4 h-4" />
            <span>کلاس‌ها و داشبورد</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTab('discipline');
              if (onOpenDisciplinaryDashboard) onOpenDisciplinaryDashboard();
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right px-3 py-2.5 rounded-xl transition flex items-center gap-2 ${
              currentActiveTab === 'discipline' ? 'bg-teal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>معاونت اجرایی</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTab('grades');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right px-3 py-2.5 rounded-xl transition flex items-center gap-2 ${
              currentActiveTab === 'grades' ? 'bg-teal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>معاونت آموزش</span>
          </button>

          {currentUser.isAlsoTeacher && currentUser.role !== 'coach' && currentUser.role !== 'teacher' && (
            <button
              type="button"
              onClick={() => {
                onSelectTab('teacher');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-right px-3 py-2.5 rounded-xl transition flex items-center gap-2 ${
                currentActiveTab === 'teacher' ? 'bg-emerald-800 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>پنل آموزشی</span>
            </button>
          )}

          {!isAdmin && (
          <button
            type="button"
            onClick={() => {
              onSelectTab('nurture');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right px-3 py-2.5 rounded-xl transition flex items-center gap-2 ${
              currentActiveTab === 'nurture' ? 'bg-teal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <HeartHandshake className="w-4 h-4" />
            <span>معاونت تربیتی</span>
          </button>
          )}
            </>
          )}
          {onSelectTab && !isAdmin && currentUser.isAlsoTeacher && currentUser.role !== 'coach' && currentUser.role !== 'teacher' && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              {([['main', 'پنل معاونت'], ['teacher', 'پنل آموزشی']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    onSelectTab(tab);
                    setMobileMenuOpen(false);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    (tab === 'teacher') === (currentActiveTab === 'teacher')
                      ? 'bg-teal-800 text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* مودال حساب کاربری (User Profile) */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* مودال پشتیبانی و راهنما */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* مودال تنظیمات سامانه */}
      <SystemSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </header>
  );
};
