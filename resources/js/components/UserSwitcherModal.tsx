import React, { useState, useMemo, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { User, UserRole, SchoolClass } from '../types';
import { 
  X, 
  UserCheck, 
  ShieldCheck, 
  HeartHandshake, 
  BookOpen, 
  Search, 
  CheckCircle2, 
  User as UserIcon,
  Sparkles,
  School,
  ChevronLeft,
  GraduationCap
} from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

interface UserSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLoginModal?: () => void;
}

// Single consolidated person structure to avoid duplicate cards for multi-role staff
interface PersonAccount {
  id: string; // Unique key for the person (e.g. name or primary ID)
  name: string;
  isCurrentPerson: boolean;
  activeUserId: string; // The primary user ID to activate
  assignedClasses: SchoolClass[];
  roles: Array<{
    userId: string;
    role: UserRole;
    roleCategory: 'management' | 'coach' | 'teacher';
    badgeLabel: string;
    roleTitle: string;
    roleDescription: string;
    subject?: string;
    isCurrentActiveRole: boolean;
  }>;
}

type FilterCategory = 'all' | 'management' | 'coach' | 'teacher';

export const UserSwitcherModal: React.FC<UserSwitcherModalProps> = ({ 
  isOpen, 
  onClose,
}) => {
  const { allUsers, currentUser, switchUser, classes, showToast } = useSchool();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Consolidate users into distinct person records so one person with multiple roles appears once
  const consolidatedPersons = useMemo(() => {
    const personMap = new Map<string, PersonAccount>();

    allUsers.forEach((user) => {
      const normalizedName = user.name.trim();
      const isCurrentUser = user.id === currentUser.id;

      // Determine category and descriptions
      let roleCategory: 'management' | 'coach' | 'teacher' = 'teacher';
      let badgeLabel = 'دبیر';
      let roleDescription = 'ثبت حضور و غیاب کلاسی و بررسی نمرات';

      if (user.role === 'admin') {
        roleCategory = 'management';
        badgeLabel = 'مدیر دبیرستان';
        roleDescription = 'مدیریت کلان و نظارت جامع بر کلیه امور مدرسه';
      } else if (user.role === 'vice_educational') {
        roleCategory = 'management';
        badgeLabel = 'معاون آموزشی';
        roleDescription = 'مدیریت امور آموزشی، برنامه‌ریزی اساتید و کارنامه';
      } else if (user.role === 'vice_disciplinary' || user.role === 'vice_principal') {
        roleCategory = 'management';
        badgeLabel = 'معاون انضباطی / اجرایی';
        roleDescription = 'امور اجرایی، تاخیرها، غیبت‌ها و موارد انضباطی';
      } else if (user.role === 'vice_nurturing') {
        roleCategory = 'management';
        badgeLabel = 'معاون تربیتی و پرورشی';
        roleDescription = 'مشاهده‌گری رفتاری، مشاوره و پرونده تربیتی';
      } else if (user.role === 'coach') {
        roleCategory = 'coach';
        badgeLabel = 'مربی یاوران ولایت';
        roleDescription = 'ارزیابی‌های رشدی-تربیتی و مشاوره‌ای دانش‌آموزان';
      } else if (user.role === 'teacher') {
        roleCategory = 'teacher';
        badgeLabel = user.subject ? `دبیر ${user.subject}` : 'دبیر درس';
        roleDescription = user.subject ? `تدریس تخصصی درس ${user.subject}` : 'ثبت حضور و غیاب کلاسی و دفتر نمرات';
      }

      // Classes assigned
      const userClasses = classes.filter((c) => 
        (user.assignedClassIds || []).includes(c.id) || 
        (c.teacherIds || []).includes(user.id)
      );

      const existingPerson = personMap.get(normalizedName);

      const roleEntry = {
        userId: user.id,
        role: user.role,
        roleCategory,
        badgeLabel,
        roleTitle: user.roleTitle || badgeLabel,
        roleDescription,
        subject: user.subject,
        isCurrentActiveRole: isCurrentUser,
      };

      if (!existingPerson) {
        const rolesList = [roleEntry];

        // Also check if user has isAlsoTeacher attribute on the same model
        if (user.isAlsoTeacher && user.role === 'coach') {
          rolesList.push({
            userId: user.id,
            role: 'teacher' as UserRole,
            roleCategory: 'teacher',
            badgeLabel: user.teachingSubject ? `دبیر ${user.teachingSubject}` : 'دبیر',
            roleTitle: user.teachingSubject ? `دبیر ${user.teachingSubject}` : 'دبیر درس',
            roleDescription: 'تدریس تخصصی و ثبت حضور و غیاب کلاسی',
            subject: user.teachingSubject,
            isCurrentActiveRole: isCurrentUser && currentUser.role === 'teacher',
          });
        }

        personMap.set(normalizedName, {
          id: user.id,
          name: user.name,
          isCurrentPerson: isCurrentUser,
          activeUserId: isCurrentUser ? user.id : user.id,
          assignedClasses: userClasses,
          roles: rolesList,
        });
      } else {
        // Merge into existing person
        if (isCurrentUser) {
          existingPerson.isCurrentPerson = true;
          existingPerson.activeUserId = user.id;
        }

        // Avoid adding exact duplicate role
        const roleExists = existingPerson.roles.some((r) => r.role === user.role && r.subject === user.subject);
        if (!roleExists) {
          existingPerson.roles.push(roleEntry);
        }

        // Merge classes
        userClasses.forEach((cls) => {
          if (!existingPerson.assignedClasses.some((c) => c.id === cls.id)) {
            existingPerson.assignedClasses.push(cls);
          }
        });
      }
    });

    return Array.from(personMap.values());
  }, [allUsers, currentUser, classes]);

  // Current person's profile
  const currentPerson = useMemo(() => {
    return consolidatedPersons.find((p) => p.isCurrentPerson) || {
      id: currentUser.id,
      name: currentUser.name,
      isCurrentPerson: true,
      activeUserId: currentUser.id,
      assignedClasses: [],
      roles: [{
        userId: currentUser.id,
        role: currentUser.role,
        roleCategory: 'management' as const,
        badgeLabel: currentUser.roleTitle,
        roleTitle: currentUser.roleTitle,
        roleDescription: 'حساب فعال در سامانه',
        isCurrentActiveRole: true,
      }],
    };
  }, [consolidatedPersons, currentUser]);

  // Check if current person has multiple roles
  const currentPersonHasMultipleRoles = currentPerson.roles.length > 1;

  // Filtered persons based on search query and category
  const filteredPersons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return consolidatedPersons.filter((person) => {
      // Filter by Category
      if (activeCategory !== 'all') {
        const hasRoleInCategory = person.roles.some((r) => r.roleCategory === activeCategory);
        if (!hasRoleInCategory) return false;
      }

      // Filter by Search Query (Persian name, roles, or subjects)
      if (q) {
        const nameMatch = person.name.toLowerCase().includes(q);
        const roleMatch = person.roles.some((r) => 
          r.badgeLabel.toLowerCase().includes(q) ||
          r.roleTitle.toLowerCase().includes(q) ||
          (r.subject && r.subject.toLowerCase().includes(q))
        );
        const classMatch = person.assignedClasses.some((c) => c.name.toLowerCase().includes(q));
        return nameMatch || roleMatch || classMatch;
      }

      return true;
    });
  }, [consolidatedPersons, searchQuery, activeCategory]);

  // Group filtered persons for display
  const managementPersons = useMemo(() => 
    filteredPersons.filter((p) => p.roles.some((r) => r.roleCategory === 'management')),
    [filteredPersons]
  );

  const coachPersons = useMemo(() => 
    filteredPersons.filter((p) => 
      p.roles.some((r) => r.roleCategory === 'coach') && 
      !p.roles.some((r) => r.roleCategory === 'management')
    ),
    [filteredPersons]
  );

  const teacherPersons = useMemo(() => 
    filteredPersons.filter((p) => 
      p.roles.some((r) => r.roleCategory === 'teacher') && 
      !p.roles.some((r) => r.roleCategory === 'management') && 
      !p.roles.some((r) => r.roleCategory === 'coach')
    ),
    [filteredPersons]
  );

  const handleSelectUser = (userId: string, roleTitle: string) => {
    switchUser(userId);
    showToast('تغییر حساب انجام شد', `ورود با نقش «${roleTitle}» انجام گردید.`, 'success');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" 
      dir="rtl"
    >
      {/* Click outside backdrop */}
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      {/* Modal Container */}
      <div 
        className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] z-10 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-switcher-title"
      >
        
        {/* 1. Header پنجره */}
        <div className="p-4 sm:p-5 bg-gradient-to-l from-slate-50 via-white to-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center shadow-xs shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="user-switcher-title" className="text-base font-black text-slate-900">
                تغییر کاربر و نقش
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                نقش یا حساب موردنظر خود را برای ادامه انتخاب کنید.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="بستن (ESC)"
            aria-label="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. اطلاعات کاربر فعلی (حساب فعلی) */}
        <div className="px-4 sm:px-5 py-3 bg-teal-50/50 border-b border-teal-100 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-teal-800 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
              {currentUser.name.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-teal-900 flex items-center gap-1.5">
                <span>حساب فعلی شما:</span>
                <span className="text-slate-900 font-black">{currentUser.name}</span>
              </div>
              <div className="text-[11px] text-teal-800 font-semibold truncate mt-0.5">
                {currentUser.roleTitle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-100/80 text-emerald-800 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>در حال استفاده</span>
          </div>
        </div>

        {/* 3. جستجو و فیلتر نقش‌ها */}
        <div className="p-4 sm:px-5 py-3 border-b border-slate-100 bg-white space-y-2.5 shrink-0">
          {/* Search Box */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام کاربر، نقش یا درس..."
              className="w-full pr-9 pl-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 transition"
              aria-label="جستجوی نام کاربر"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="پاک کردن جستجو"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs select-none">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              همه حساب‌ها ({toPersianDigits(consolidatedPersons.length)})
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('management')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                activeCategory === 'management'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              مدیران و معاونان
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('coach')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                activeCategory === 'coach'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              مربیان
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory('teacher')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                activeCategory === 'teacher'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              دبیران
            </button>
          </div>
        </div>

        {/* 4. محتوای Scrollable فهرست کاربران و نقش‌ها */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 max-h-[58vh]">

          {/* الف: بخش «نقش‌های من» در صورت چندنقشه بودن شخص فعلی */}
          {currentPersonHasMultipleRoles && !searchQuery && activeCategory === 'all' && (
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-blue-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-700" />
                  <span>نقش‌های فعال من ({currentPerson.name})</span>
                </div>
                <span className="text-[10px] text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full font-bold">
                  چندنقشی
                </span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                شما به عنوان یک شخص دارای چند نقش در مدرسه هستید. با یک کلیک می‌توانید نقش فعال خود را تغییر دهید:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {currentPerson.roles.map((r) => {
                  const isActiveRole = r.userId === currentUser.id;
                  return (
                    <button
                      key={r.role + (r.subject || '')}
                      type="button"
                      onClick={() => handleSelectUser(r.userId, r.roleTitle)}
                      className={`p-2.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between gap-2 ${
                        isActiveRole
                          ? 'bg-white border-blue-500 ring-2 ring-blue-300 shadow-xs'
                          : 'bg-white/80 border-blue-200 hover:bg-white hover:border-blue-300'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <span>{r.badgeLabel}</span>
                          {isActiveRole && (
                            <span className="text-[10px] bg-blue-700 text-white px-1.5 py-0.2 rounded font-medium">
                              فعال
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {r.roleDescription}
                        </div>
                      </div>

                      {isActiveRole ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-1 rounded-lg shrink-0">
                          فعال‌سازی
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* حالت جستجوی بدون نتیجه */}
          {filteredPersons.length === 0 && (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <UserIcon className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">کاربر یا نقشی با این مشخصات یافت نشد.</p>
              <p className="text-[11px] text-slate-400">نام شخص یا عنوان درس را بررسی کنید.</p>
            </div>
          )}

          {/* ب: بخش مدیران و معاونان */}
          {(activeCategory === 'all' || activeCategory === 'management') && managementPersons.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 pb-1 border-b border-slate-100">
                <ShieldCheck className="w-4 h-4 text-indigo-700" />
                <span>مدیران و معاونان</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {managementPersons.map((person) => {
                  const isCurrent = person.isCurrentPerson;
                  const primaryRole = person.roles[0];

                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelectUser(primaryRole.userId, primaryRole.roleTitle)}
                      className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isCurrent
                          ? 'bg-indigo-50/40 border-indigo-500 ring-2 ring-indigo-200/80 shadow-xs'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            isCurrent ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {person.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                              <span>{person.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] bg-indigo-700 text-white px-1.5 py-0.2 rounded font-medium">
                                  فعال
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-bold text-indigo-800 mt-0.5">
                              {primaryRole.badgeLabel}
                            </div>
                          </div>
                        </div>

                        {isCurrent && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-700 shrink-0 mt-1" />
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500 leading-tight">
                        {primaryRole.roleDescription}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ج: بخش مربیان (ارزیابی‌های رشدی و پرونده تربیتی) */}
          {(activeCategory === 'all' || activeCategory === 'coach') && coachPersons.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-teal-900 pb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-teal-700" />
                  <span>مربیان</span>
                </div>
                <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full font-bold">
                  {toPersianDigits(coachPersons.length)} مربی
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {coachPersons.map((person) => {
                  const isCurrent = person.isCurrentPerson;
                  const primaryRole = person.roles[0];

                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelectUser(primaryRole.userId, primaryRole.roleTitle)}
                      className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isCurrent
                          ? 'bg-teal-50/40 border-teal-600 ring-2 ring-teal-200 shadow-xs'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            isCurrent ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {person.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                              <span>{person.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] bg-teal-800 text-white px-1.5 py-0.2 rounded font-medium">
                                  فعال
                                </span>
                              )}
                            </div>
                            
                            {/* Badges for roles - multi-role displayed on one card */}
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {person.roles.map((r, idx) => (
                                <span 
                                  key={idx} 
                                  className="text-[10px] font-bold bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded border border-teal-100"
                                >
                                  {r.badgeLabel}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {isCurrent && (
                          <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-1" />
                        )}
                      </div>

                      {/* Associated classes */}
                      {person.assignedClasses.length > 0 && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <School className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            کلاس‌های مرتبط: {person.assignedClasses.map((c) => c.name).join('، ')}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* د: بخش دبیران */}
          {(activeCategory === 'all' || activeCategory === 'teacher') && teacherPersons.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-700" />
                  <span>دبیران</span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                  {toPersianDigits(teacherPersons.length)} دبیر
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {teacherPersons.map((person) => {
                  const isCurrent = person.isCurrentPerson;
                  const primaryRole = person.roles[0];

                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelectUser(primaryRole.userId, primaryRole.roleTitle)}
                      className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isCurrent
                          ? 'bg-emerald-50/40 border-emerald-600 ring-2 ring-emerald-200 shadow-xs'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            isCurrent ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {person.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                              <span>{person.name}</span>
                              {isCurrent && (
                                <span className="text-[9px] bg-emerald-700 text-white px-1.5 py-0.2 rounded font-medium">
                                  فعال
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-bold text-emerald-800 mt-0.5">
                              {primaryRole.badgeLabel}
                            </div>
                          </div>
                        </div>

                        {isCurrent && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-1" />
                        )}
                      </div>

                      {/* Associated classes */}
                      {person.assignedClasses.length > 0 && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <GraduationCap className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            کلاس‌ها: {person.assignedClasses.map((c) => c.name).join('، ')}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* 5. Footer پنجره */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>مجموع {toPersianDigits(consolidatedPersons.length)} نفر از کادر مدرسه</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
          >
            انصراف و بستن
          </button>
        </div>

      </div>
    </div>
  );
};
