import { WorkspaceTitleBar, HeaderAction } from './ui/WorkspaceHeader';
import React, { useState, useMemo } from 'react';
import { User, SchoolClass, Workshop } from '../types';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';
import { workshopTitle } from '../utils/workshops';
import { 
  UserCheck, 
  Search, 
  UserPlus, 
  ChevronLeft, 
  Menu, 
  FileSpreadsheet, 
  Eye, 
  Edit3,
  X,
  GraduationCap, 
  BookOpen,
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdminTeachersWorkspaceProps {
  allTeachers: User[];
  classes: SchoolClass[];
  onBack: () => void;
  onOpenSidebar: () => void;
  onOpenNewTeacher: () => void;
  onSelectTeacherForProfile: (teacher: User) => void;
  onEditTeacher?: (teacher: User) => void;
}

export const AdminTeachersWorkspace: React.FC<AdminTeachersWorkspaceProps> = ({
  allTeachers,
  classes,
  onBack,
  onOpenSidebar,
  onOpenNewTeacher,
  onSelectTeacherForProfile,
  onEditTeacher,
}) => {
  const { workshops, updateWorkshop, showConfirm, isAdmin, isEducationalVice } = useSchool();
  const canManageWorkshops = isAdmin || isEducationalVice;
  // کارگاه‌های هر استاد فقط از تخصیص صریح (teacherId) می‌آید؛ کارگاه‌های هم‌نام و هم‌پایه یک‌بار نمایش داده می‌شوند
  const workshopsOf = (t: User) => {
    const seen = new Set<string>();
    return workshops.filter((w) => {
      if (!w.teacherId || w.teacherId !== t.id) return false;
      const key = `${w.category}|${w.name.trim()}|${w.gradeLevel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const unassignWorkshop = (w: Workshop, t: User) =>
    showConfirm({
      title: 'برداشتن استاد از کارگاه؟',
      message: `«${t.name}» از مسئولیت ${workshopTitle(w)} برداشته شود؟ کارگاه بدون استاد می‌ماند.`,
      confirmLabel: 'بله، برداشته شود',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => updateWorkshop(w.id, { teacherId: undefined, teacherName: undefined }),
    });
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherSubjectFilter, setTeacherSubjectFilter] = useState('');
  const [teacherClassFilter, setTeacherClassFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const todayInfo = getTodayShamsi();

  // Extract unique subjects
  const allTeacherSubjects = useMemo(() => {
    return Array.from(
      new Set(allTeachers.map((t) => t.subjectSpecialty || t.subject).filter(Boolean))
    ) as string[];
  }, [allTeachers]);

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    return allTeachers.filter((t) => {
      const q = teacherSearch.trim().toLowerCase();
      const subjectName = t.subjectSpecialty || t.subject || '';
      const assignedClasses = classes.filter(
        (c) => c.teacherIds.includes(t.id) || t.assignedClassIds.includes(c.id)
      );

      if (q) {
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesSubject = subjectName.toLowerCase().includes(q);
        const matchesUsername = t.username.toLowerCase().includes(q);
        if (!matchesName && !matchesSubject && !matchesUsername) return false;
      }

      if (teacherSubjectFilter && subjectName !== teacherSubjectFilter) {
        return false;
      }

      if (teacherClassFilter) {
        const teachesInClass = assignedClasses.some((c) => c.id === teacherClassFilter);
        if (!teachesInClass) return false;
      }

      const hasAssignment = assignedClasses.length > 0 || workshopsOf(t).length > 0;
      if (assignmentFilter === 'assigned' && !hasAssignment) return false;
      if (assignmentFilter === 'unassigned' && hasAssignment) return false;

      return true;
    });
  }, [allTeachers, classes, workshops, teacherSearch, teacherSubjectFilter, teacherClassFilter, assignmentFilter]);

  const exportTeachersToExcel = () => {
    const rows = filteredTeachers.map((t, idx) => {
      const assignedClasses = classes.filter(
        (c) => c.teacherIds.includes(t.id) || t.assignedClassIds.includes(c.id)
      );
      return {
        'ردیف': idx + 1,
        'نام معلم': t.name,
        'درس تدریسی': t.subjectSpecialty || t.subject || 'عمومی',
        'نام کاربری': t.username,
        'کلاس‌های فعال': [...assignedClasses.map((c) => c.name), ...workshopsOf(t).map((w) => workshopTitle(w))].join('، ') || 'تعیین نشده',
        'تعداد کلاس‌ها': assignedClasses.length + workshopsOf(t).length,
        'وضعیت': 'فعال',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'معلمان');
    XLSX.writeFile(wb, `Teachers_List_${todayInfo.formattedDate}.xlsx`);
  };


  /* اجزای مشترک جدول دسکتاپ و کارت‌های موبایل */
  const classesOf = (t: User) => classes.filter((c) => c.teacherIds.includes(t.id) || t.assignedClassIds.includes(c.id));

  const TeacherIdentity: React.FC<{ teacher: User }> = ({ teacher }) => (
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center border shrink-0 ${
        teacher.role === 'coach' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-slate-100 text-slate-700 border-slate-200'
      }`}>
        {teacher.name[0]}
      </div>
      <div className="min-w-0">
        <div className="font-bold text-slate-900">{teacher.name}</div>
        {teacher.role === 'coach' ? (
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5 whitespace-nowrap">مربی یاوران ولایت (معلم)</div>
        ) : teacher.phone ? (
          <div className="text-[11px] text-slate-400 font-medium mt-0.5 whitespace-nowrap">{toPersianDigits(teacher.phone)}</div>
        ) : null}
      </div>
    </div>
  );

  const SubjectChips: React.FC<{ teacher: User }> = ({ teacher }) => {
    const subjects = (teacher.subjectSpecialty || teacher.subject || 'عمومی').split(/[،,]/).map((x) => x.trim()).filter(Boolean);
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {subjects.map((sub) => (
          <span key={sub} className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/80 text-[11px] font-medium whitespace-nowrap">{sub}</span>
        ))}
      </div>
    );
  };

  const ActiveBadge: React.FC = () => (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      فعال
    </span>
  );

  const renderClasses = (teacher: User) => {
    const assigned = classesOf(teacher);
    const ws = workshopsOf(teacher);
    if (assigned.length === 0 && ws.length === 0) {
      return <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap">بدون کلاس</span>;
    }
    return (
      <div className="flex flex-wrap gap-1 items-center">
        {assigned.map((cls) => (
          <span key={cls.id} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] whitespace-nowrap">{cls.name}</span>
        ))}
        {ws.map((w) => (
          <span key={w.id} title={workshopTitle(w)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium whitespace-nowrap">
            <span>کارگاه {w.name} · {w.gradeLevel === 9 ? 'نهم' : 'هشتم'}</span>
            {canManageWorkshops && (
              <button
                type="button"
                onClick={() => unassignWorkshop(w, teacher)}
                aria-label="برداشتن استاد از این کارگاه"
                title="برداشتن استاد از این کارگاه"
                className="opacity-60 hover:opacity-100 cursor-pointer leading-none"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>
    );
  };

  const renderActions = (teacher: User, full = false) => (
    <div className={`${full ? 'grid grid-cols-2' : 'inline-flex items-center'} gap-1.5`}>
      <button
        type="button"
        onClick={() => onSelectTeacherForProfile(teacher)}
        className="h-10 md:h-9 px-3 rounded-xl bg-teal-50 hover:bg-teal-800 hover:text-white text-teal-900 font-bold text-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer border border-teal-200 whitespace-nowrap"
        title="مشاهده اطلاعات کامل معلم"
      >
        <Eye className="w-3.5 h-3.5 shrink-0" />
        <span>مشاهده</span>
      </button>
      <button
        type="button"
        onClick={() => (onEditTeacher ? onEditTeacher(teacher) : onSelectTeacherForProfile(teacher))}
        className="h-10 md:h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 whitespace-nowrap"
        title="ویرایش اطلاعات معلم"
      >
        <Edit3 className="w-3.5 h-3.5 shrink-0" />
        <span>ویرایش</span>
      </button>
    </div>
  );

  const hasActiveFilters = Boolean(teacherSearch || teacherSubjectFilter || teacherClassFilter || assignmentFilter !== 'all');

  const handleClearFilters = () => {
    setTeacherSearch('');
    setTeacherSubjectFilter('');
    setTeacherClassFilter('');
    setAssignmentFilter('all');
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Header ساختار یکپارچه */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <WorkspaceTitleBar
          title="معلمان"
          icon={UserCheck}
          section="مدیریت مدرسه"
          badge={`${toPersianDigits(allTeachers.length)} معلم`}
          subtitle="معلمان و کلاس‌های مرتبط با آنها را مدیریت کنید."
          onBack={onBack}
          onOpenSidebar={onOpenSidebar}
          actions={
            <>
              <HeaderAction variant="primary" icon={UserPlus} label="افزودن معلم" onClick={onOpenNewTeacher} />
              <HeaderAction icon={FileSpreadsheet} iconClassName="text-emerald-700" label="خروجی اکسل" onClick={exportTeachersToExcel} title="خروجی اکسل معلمان" />
            </>
          }
        />

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجوی نام معلم، درس، کدملی..."
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              className="w-full pl-8 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition"
            />
            {teacherSearch && (
              <button
                type="button"
                onClick={() => setTeacherSearch('')}
                className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="پاک کردن جستجو"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Subject Filter */}
          <div>
            <select
              value={teacherSubjectFilter}
              onChange={(e) => setTeacherSubjectFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="">همه درس‌ها</option>
              {allTeacherSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          {/* Class Filter */}
          <div>
            <select
              value={teacherClassFilter}
              onChange={(e) => setTeacherClassFilter(e.target.value)}
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

          {/* Assignment Status Filter */}
          <div>
            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="all">همه وضعیت‌های تخصیص</option>
              <option value="assigned">دارای کلاس فعال</option>
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

      {/* 2. بدنه: جدول معلمان */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredTeachers.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-3">
            <UserCheck className="w-12 h-12 mx-auto text-slate-300" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">
                {hasActiveFilters ? 'معلمی با این فیلترها یافت نشد.' : 'هنوز هیچ معلمی ثبت نشده است.'}
              </p>
              <p className="text-xs text-slate-400">
                {hasActiveFilters ? 'لطفاً عبارت جستجو یا گزینه‌های فیلتر را تغییر دهید.' : 'با کلیک بر روی دکمه زیر اولین معلم را اضافه کنید.'}
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
                onClick={onOpenNewTeacher}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                افزودن اولین معلم
              </button>
            )}
          </div>
        ) : (
          <>
            {/* عنوان فهرست */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" aria-hidden="true" />
                <h2 className="text-sm sm:text-base font-black text-slate-800">فهرست اساتید و مربیان دبیرستان</h2>
              </div>
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{toPersianDigits(filteredTeachers.length)} نفر</span>
            </div>

            {/* دسکتاپ: جدول (سلول‌ها نمی‌شکنند؛ در صورت کمبود جا فقط داخل کارت اسکرول می‌شود) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[820px] text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 bg-slate-50/30">
                    <th className="py-3 px-4 whitespace-nowrap">نام و نام خانوادگی</th>
                    <th className="py-3 px-4 whitespace-nowrap">تخصص و دروس تدریسی</th>
                    <th className="py-3 px-4 whitespace-nowrap">کلاس‌های مرتبط</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">وضعیت</th>
                    <th className="py-3 px-4 text-center whitespace-nowrap">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4"><TeacherIdentity teacher={teacher} /></td>
                      <td className="py-3.5 px-4"><SubjectChips teacher={teacher} /></td>
                      <td className="py-3.5 px-4">{renderClasses(teacher)}</td>
                      <td className="py-3.5 px-4 text-center"><ActiveBadge /></td>
                      <td className="py-3.5 px-4 text-center">{renderActions(teacher)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* موبایل: کارت‌های فشرده */}
            <ul className="md:hidden divide-y divide-slate-100">
              {filteredTeachers.map((teacher) => (
                <li key={teacher.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <TeacherIdentity teacher={teacher} />
                    <ActiveBadge />
                  </div>
                  <SubjectChips teacher={teacher} />
                  {renderClasses(teacher)}
                  {renderActions(teacher, true)}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* 3. Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <div>
            نمایش <span className="font-bold text-slate-800">{toPersianDigits(filteredTeachers.length)}</span> از{' '}
            <span className="font-bold text-slate-800">{toPersianDigits(allTeachers.length)}</span> معلم
          </div>
          <div className="text-[11px] text-slate-400">
            برای تخصیص درس و کلاس‌ها، از دکمه «ویرایش» استفاده نمایید.
          </div>
        </div>
      </div>
    </div>
  );
};
