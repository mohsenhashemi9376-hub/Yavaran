import React, { useState, useMemo } from 'react';
import { User, SchoolClass } from '../types';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';
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

      if (assignmentFilter === 'assigned' && assignedClasses.length === 0) return false;
      if (assignmentFilter === 'unassigned' && assignedClasses.length > 0) return false;

      return true;
    });
  }, [allTeachers, classes, teacherSearch, teacherSubjectFilter, teacherClassFilter, assignmentFilter]);

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
        'کلاس‌های فعال': assignedClasses.map((c) => c.name).join('، ') || 'تعیین نشده',
        'تعداد کلاس‌ها': assignedClasses.length,
        'وضعیت': 'فعال',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'معلمان');
    XLSX.writeFile(wb, `Teachers_List_${todayInfo.formattedDate}.xlsx`);
  };

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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <span>پیشخوان اصلی</span>
              <span>/</span>
              <span className="text-teal-800">مدیریت معلمان</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <UserCheck className="w-6 h-6 text-teal-800" />
              <span>معلمان</span>
              <span className="text-xs font-bold bg-teal-50 text-teal-800 px-2.5 py-1 rounded-full border border-teal-200">
                {toPersianDigits(allTeachers.length)} معلم
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              معلمان و کلاس‌های مرتبط با آنها را مدیریت کنید.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenNewTeacher}
              className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>افزودن معلم</span>
            </button>

            <button
              onClick={exportTeachersToExcel}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="خروجی اکسل معلمان"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>خروجی اکسل</span>
            </button>

            <button
              onClick={onOpenSidebar}
              className="lg:hidden px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 focus:outline-hidden"
              title="باز کردن نوار کناری"
              aria-label="باز کردن نوار کناری"
            >
              <Menu className="w-4 h-4 text-slate-700" />
              <span>منو</span>
            </button>

            <button
              onClick={onBack}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>بازگشت</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

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
                  {cls.name} (پایه {cls.grade})
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
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">نام و نام خانوادگی</th>
                  <th className="p-3.5">تخصص / درس</th>
                  <th className="p-3.5">کلاس‌های مرتبط</th>
                  <th className="p-3.5 text-center">وضعیت</th>
                  <th className="p-3.5 text-center w-40">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((teacher) => {
                  const assignedClasses = classes.filter(
                    (c) => c.teacherIds.includes(teacher.id) || teacher.assignedClassIds.includes(c.id)
                  );
                  const teachingSubject = teacher.subjectSpecialty || teacher.subject || 'عمومی';

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-800 font-bold text-xs flex items-center justify-center shrink-0">
                            {teacher.name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {teacher.name}
                            </div>
                            {teacher.role === 'coach' ? (
                              <span className="inline-block text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded font-bold mt-0.5">
                                مربی یاوران ولایت (معلم)
                              </span>
                            ) : teacher.phone ? (
                              <div className="text-[11px] text-slate-400">
                                {toPersianDigits(teacher.phone)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 text-teal-900 border border-teal-200/80">
                          {teachingSubject}
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>فعال</span>
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectTeacherForProfile(teacher)}
                            className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-800 hover:text-white text-teal-900 font-bold text-xs transition flex items-center gap-1 cursor-pointer border border-teal-200"
                            title="مشاهده اطلاعات کامل معلم"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>مشاهده</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditTeacher ? onEditTeacher(teacher) : onSelectTeacherForProfile(teacher)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer border border-slate-200"
                            title="ویرایش اطلاعات معلم"
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
          </div>
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
