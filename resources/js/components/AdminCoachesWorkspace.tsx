import { WorkspaceTitleBar, HeaderAction } from './ui/WorkspaceHeader';
import React, { useEffect, useState, useMemo } from 'react';
import { User, SchoolClass } from '../types';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';
import { 
  HeartHandshake, 
  Search, 
  UserPlus, 
  ChevronLeft, 
  Menu, 
  FileSpreadsheet, 
  Eye, 
  Edit3,
  X,
  Filter,
  ArrowRight,
  Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FitTable } from './ui/FitTable';

interface AdminCoachesWorkspaceProps {
  allCoaches: User[];
  classes: SchoolClass[];
  onBack: () => void;
  onOpenSidebar: () => void;
  onOpenNewCoach: () => void;
  onSelectCoachForProfile: (coach: User) => void;
  onEditCoach?: (coach: User) => void;
}

export const AdminCoachesWorkspace: React.FC<AdminCoachesWorkspaceProps> = ({
  allCoaches,
  classes,
  onBack,
  onOpenSidebar,
  onOpenNewCoach,
  onSelectCoachForProfile,
  onEditCoach,
}) => {
  const [coachSearch, setCoachSearch] = useState('');
  const [coachGradeFilter, setCoachGradeFilter] = useState('');
  const [coachClassFilter, setCoachClassFilter] = useState('');
  const [coachStatusFilter, setCoachStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const todayInfo = getTodayShamsi();

  // هدر چسبان موبایل درست زیر هدر چسبان برنامه قرار می‌گیرد
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const measure = () => setStickyTop(document.querySelector<HTMLElement>('.yv-header')?.offsetHeight || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Filter coaches
  const filteredCoaches = useMemo(() => {
    return allCoaches.filter((c) => {
      const q = coachSearch.trim().toLowerCase();
      const assignedClasses = classes.filter((cls) => 
        c.assignedClassIds?.includes(cls.id) || cls.coachId === c.id
      );
      const roleTitle = c.coachRoleTitle || c.roleTitle || 'مربی تربیتی';

      if (q) {
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesRole = roleTitle.toLowerCase().includes(q);
        const matchesUsername = c.username.toLowerCase().includes(q);
        if (!matchesName && !matchesRole && !matchesUsername) return false;
      }

      if (coachGradeFilter) {
        const matchesGrade = assignedClasses.some((cls) => cls.grade === coachGradeFilter);
        if (!matchesGrade) return false;
      }

      if (coachClassFilter) {
        const matchesClass = assignedClasses.some((cls) => cls.id === coachClassFilter);
        if (!matchesClass) return false;
      }

      if (coachStatusFilter === 'active' && c.isActive === false) return false;
      if (coachStatusFilter === 'inactive' && c.isActive !== false) return false;

      if (assignmentFilter === 'assigned' && assignedClasses.length === 0) return false;
      if (assignmentFilter === 'unassigned' && assignedClasses.length > 0) return false;

      return true;
    });
  }, [allCoaches, classes, coachSearch, coachGradeFilter, coachClassFilter, coachStatusFilter, assignmentFilter]);

  const exportCoachesToExcel = () => {
    const rows = filteredCoaches.map((c, idx) => {
      const assignedClasses = classes.filter((cls) => 
        c.assignedClassIds?.includes(cls.id) || cls.coachId === c.id
      );
      return {
        'ردیف': idx + 1,
        'نام مربی': c.name,
        'حوزه و مسئولیت تربیتی': c.coachRoleTitle || c.roleTitle || 'مربی تربیتی',
        'نام کاربری': c.username,
        'کلاس‌های فعال': assignedClasses.map((cls) => cls.name).join('، ') || 'تعیین نشده',
        'تعداد کلاس‌ها': assignedClasses.length,
        'وضعیت': c.isActive !== false ? 'فعال' : 'غیرفعال',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'مربیان_تربیتی');
    XLSX.writeFile(wb, `Coaches_List_${todayInfo.formattedDate}.xlsx`);
  };

  const hasActiveFilters = Boolean(
    coachSearch || coachGradeFilter || coachClassFilter || coachStatusFilter !== 'all' || assignmentFilter !== 'all'
  );

  const handleClearFilters = () => {
    setCoachSearch('');
    setCoachGradeFilter('');
    setCoachClassFilter('');
    setCoachStatusFilter('all');
    setAssignmentFilter('all');
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* ===================== موبایل ===================== */}
      <div className="md:hidden space-y-3">
        {/* هدر چسبان شیشه‌ای */}
        <div className="sticky z-20 -mx-4 px-4 py-2 bg-white/90 backdrop-blur-md border-b border-slate-200/70 space-y-2" style={{ top: stickyTop }}>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onBack} aria-label="بازگشت" className="h-11 w-11 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center cursor-pointer">
              <ArrowRight className="w-5 h-5" />
            </button>
            <h2 className="flex-1 min-w-0 text-sm font-black text-slate-900 truncate">مربیان تربیتی ({toPersianDigits(allCoaches.length)})</h2>
            <button type="button" onClick={exportCoachesToExcel} aria-label="خروجی اکسل" title="خروجی اکسل" className="h-11 px-3 shrink-0 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>اکسل</span>
            </button>
            <button type="button" onClick={onOpenNewCoach} className="h-11 px-3.5 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm inline-flex items-center gap-1.5 cursor-pointer">
              <UserPlus className="w-4 h-4" />
              <span>افزودن مربی</span>
            </button>
          </div>
        </div>

        {/* جستجو */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="جستجوی نام مربی، مسئولیت…"
            aria-label="جستجوی مربی"
            value={coachSearch}
            onChange={(e) => setCoachSearch(e.target.value)}
            className="w-full h-11 pr-10 pl-10 bg-white border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
          />
          {coachSearch && (
            <button type="button" onClick={() => setCoachSearch('')} aria-label="پاک کردن جستجو" className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 text-slate-400 flex items-center justify-center cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* فیلترهای کپسولی در یک ردیف افقی */}
        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
          {([
            { value: coachGradeFilter, set: setCoachGradeFilter, label: 'پایه', options: [['', 'همه پایه‌ها'], ['هفتم', 'هفتم'], ['هشتم', 'هشتم'], ['نهم', 'نهم']] },
            { value: coachClassFilter, set: setCoachClassFilter, label: 'کلاس', options: [['', 'همه کلاس‌ها'], ...classes.map((c) => [c.id, c.name])] },
            { value: coachStatusFilter, set: (v: string) => setCoachStatusFilter(v as 'all' | 'active' | 'inactive'), label: 'وضعیت', options: [['all', 'همه وضعیت‌ها'], ['active', 'فعال'], ['inactive', 'غیرفعال']] },
            { value: assignmentFilter, set: (v: string) => setAssignmentFilter(v as 'all' | 'assigned' | 'unassigned'), label: 'تخصیص', options: [['all', 'همه تخصیص‌ها'], ['assigned', 'دارای کلاس'], ['unassigned', 'بدون کلاس']] },
          ] as { value: string; set: (v: string) => void; label: string; options: string[][] }[]).map((f) => {
            const active = f.value !== '' && f.value !== 'all';
            return (
              <select
                key={f.label}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                aria-label={f.label}
                className={`h-10 shrink-0 rounded-full border pr-3.5 pl-7 text-xs font-bold whitespace-nowrap outline-none cursor-pointer ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'}`}
              >
                {f.options.map(([v, l]) => <option key={v} value={v} className="text-slate-900 bg-white">{l}</option>)}
              </select>
            );
          })}
          {hasActiveFilters && (
            <button type="button" onClick={handleClearFilters} className="h-10 px-3 shrink-0 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer">
              <X className="w-3.5 h-3.5" /> پاک‌سازی
            </button>
          )}
        </div>

        {/* کارت‌های مربیان */}
        {filteredCoaches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            {hasActiveFilters ? 'مربی با این فیلترها یافت نشد.' : 'هنوز هیچ مربی ثبت نشده است.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredCoaches.map((coach) => {
              const assignedClasses = classes.filter((cls) => coach.assignedClassIds?.includes(cls.id) || cls.coachId === coach.id);
              const isCoachActive = coach.isActive !== false;
              const roleTitle = coach.coachRoleTitle || coach.roleTitle || 'مربی تربیتی';
              return (
                <article key={coach.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 h-10 shrink-0 rounded-full bg-emerald-100 text-emerald-800 font-black text-sm flex items-center justify-center">{coach.name[0]}</span>
                    <h3 className="flex-1 min-w-0 font-bold text-slate-900 text-sm truncate">{coach.name}</h3>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isCoachActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isCoachActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {isCoachActive ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">{roleTitle}</span>
                    {coach.isAlsoTeacher && <span className="px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">معلم {coach.teachingSubject || 'درس'}</span>}
                    {assignedClasses.length > 0 ? assignedClasses.map((cls) => (
                      <span key={cls.id} className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">{cls.name}</span>
                    )) : <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">بدون کلاس</span>}
                  </div>
                  <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                    <button type="button" onClick={() => onEditCoach ? onEditCoach(coach) : onSelectCoachForProfile(coach)} className="h-11 px-4 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                      <Edit3 className="w-4 h-4" /> ویرایش
                    </button>
                    <button type="button" onClick={() => onSelectCoachForProfile(coach)} className="h-11 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer">
                      <Users className="w-4 h-4" /> مشاهده دانش‌آموزان <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== دسکتاپ ===================== */}
      <div className="hidden md:block space-y-6">
      {/* 1. Header ساختار یکپارچه */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <WorkspaceTitleBar
          title="مربیان"
          icon={HeartHandshake}
          section="مدیریت مدرسه"
          badge={`${toPersianDigits(allCoaches.length)} مربی`}
          subtitle="مربیان تربیتی و کلاس‌های تحت پوشش را مدیریت کنید."
          onBack={onBack}
          onOpenSidebar={onOpenSidebar}
          actions={
            <>
              <HeaderAction variant="primary" icon={UserPlus} label="افزودن مربی" onClick={onOpenNewCoach} />
              <HeaderAction icon={FileSpreadsheet} iconClassName="text-emerald-700" label="خروجی اکسل" onClick={exportCoachesToExcel} title="خروجی اکسل مربیان" />
            </>
          }
        />

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجوی نام مربی، مسئولیت..."
              value={coachSearch}
              onChange={(e) => setCoachSearch(e.target.value)}
              className="w-full pl-8 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition"
            />
            {coachSearch && (
              <button
                type="button"
                onClick={() => setCoachSearch('')}
                className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="پاک کردن جستجو"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Grade Filter */}
          <div>
            <select
              value={coachGradeFilter}
              onChange={(e) => setCoachGradeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="">همه پایه‌ها</option>
              <option value="هفتم">پایه هفتم</option>
              <option value="هشتم">پایه هشتم</option>
              <option value="نهم">پایه نهم</option>
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={coachClassFilter}
              onChange={(e) => setCoachClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="">همه کلاس‌ها</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={coachStatusFilter}
              onChange={(e) => setCoachStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </select>
          </div>

          {/* Assignment Filter */}
          <div>
            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="all">همه وضعیت‌های تخصیص</option>
              <option value="assigned">دارای کلاس</option>
              <option value="unassigned">بدون کلاس</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
            <span>فیلترهای اعمال‌شده روی جدول</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-teal-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>پاک‌سازی همه فیلترها</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. بدنه: جدول مربیان */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredCoaches.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-3">
            <HeartHandshake className="w-12 h-12 mx-auto text-slate-300" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">
                {hasActiveFilters ? 'مربی با این فیلترها یافت نشد.' : 'هنوز هیچ مربی ثبت نشده است.'}
              </p>
              <p className="text-xs text-slate-400">
                {hasActiveFilters ? 'لطفاً عبارت جستجو یا گزینه‌های فیلتر را تغییر دهید.' : 'با کلیک بر روی دکمه زیر اولین مربی را ثبت کنید.'}
              </p>
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                پاک کردن فیلترها
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenNewCoach}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                افزودن اولین مربی
              </button>
            )}
          </div>
        ) : (
          <FitTable className="">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">نام و نام خانوادگی</th>
                  <th className="p-3.5">حوزه مسئولیت تربیتی</th>
                  <th className="p-3.5">کلاس‌های مرتبط</th>
                  <th className="p-3.5 text-center">وضعیت</th>
                  <th className="p-3.5 text-center w-40">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCoaches.map((coach) => {
                  const assignedClasses = classes.filter((cls) =>
                    coach.assignedClassIds?.includes(cls.id) || cls.coachId === coach.id
                  );
                  const isCoachActive = coach.isActive !== false;
                  const roleTitle = coach.coachRoleTitle || coach.roleTitle || 'مربی تربیتی';

                  return (
                    <tr key={coach.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                            {coach.name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {coach.name}
                            </div>
                            {coach.isAlsoTeacher ? (
                              <span className="inline-block text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-bold mt-0.5">
                                معلم {coach.teachingSubject || 'درس'}
                              </span>
                            ) : coach.phone ? (
                              <div className="text-[11px] text-slate-400">
                                {toPersianDigits(coach.phone)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-900 border border-teal-200/80">
                          {roleTitle}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {assignedClasses.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {assignedClasses.map((cls) => (
                              <span
                                key={cls.id}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium"
                              >
                                {cls.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium">
                            بدون کلاس
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {isCoachActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>فعال</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            <span>غیرفعال</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectCoachForProfile(coach)}
                            className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-800 hover:text-white text-teal-900 font-bold text-xs transition flex items-center gap-1 cursor-pointer border border-teal-200"
                            title="مشاهده اطلاعات و دانش‌آموزان مربی"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>مشاهده</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditCoach ? onEditCoach(coach) : onSelectCoachForProfile(coach)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer border border-slate-200"
                            title="ویرایش مشخصات مربی"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>ویرایش</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </FitTable>
        )}

        {/* 3. Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <div>
            نمایش <span className="font-bold text-slate-800">{toPersianDigits(filteredCoaches.length)}</span> از{' '}
            <span className="font-bold text-slate-800">{toPersianDigits(allCoaches.length)}</span> مربی
          </div>
          <div className="text-[11px] text-slate-400">
            برای مشاهده فهرست دانش‌آموزان تحت پوشش، روی دکمه «مشاهده» کلیک کنید.
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
