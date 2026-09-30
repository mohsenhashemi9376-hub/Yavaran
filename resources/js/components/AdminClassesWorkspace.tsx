import React, { useState } from 'react';
import { SchoolClass, Student, AttendanceSession, User } from '../types';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';
import { exportClassAttendanceToExcel } from '../utils/excelExport';
import { ClassProfileView } from './ClassProfileView';
import { AddStudentToClassModal } from './AddStudentToClassModal';
import { 
  GraduationCap, 
  Search, 
  Plus, 
  ChevronLeft, 
  Menu, 
  Users, 
  MoreVertical, 
  CheckCircle2, 
  BarChart3, 
  BookOpen, 
  FileSpreadsheet, 
  Edit2, 
  ArrowRight,
  ShieldCheck,
  Clock,
  UserPlus,
  AlertCircle,
  Filter,
  Eye,
  Layers
} from 'lucide-react';

interface AdminClassesWorkspaceProps {
  classes: SchoolClass[];
  students: Student[];
  sessions: AttendanceSession[];
  allTeachers: User[];
  allCoaches?: User[];
  onBack: () => void;
  onOpenSidebar: () => void;
  onOpenNewClass: () => void;
  onOpenClassDetail: (cls: SchoolClass) => void;
  onOpenNewAttendance: (classId?: string) => void;
  onOpenMonthlySummary: (classId?: string) => void;
  onOpenAcademicGrades?: (classId?: string) => void;
  onSelectStudent?: (student: Student) => void;
  onEditClass: (cls: SchoolClass) => void;
}

export const AdminClassesWorkspace: React.FC<AdminClassesWorkspaceProps> = ({
  classes,
  students,
  sessions,
  allTeachers,
  allCoaches = [],
  onBack,
  onOpenSidebar,
  onOpenNewClass,
  onOpenClassDetail,
  onOpenNewAttendance,
  onOpenMonthlySummary,
  onOpenAcademicGrades,
  onSelectStudent,
  onEditClass,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [openMenuClassId, setOpenMenuClassId] = useState<string | null>(null);

  // In-place selected class profile
  const [selectedClassForProfile, setSelectedClassForProfile] = useState<SchoolClass | null>(null);

  // Quick add student to empty class modal
  const [quickAddStudentClass, setQuickAddStudentClass] = useState<SchoolClass | null>(null);

  // If a class profile is selected in-place, show ClassProfileView with a clean back button (Phase 10 & 11)
  if (selectedClassForProfile) {
    const currentCls = classes.find((c) => c.id === selectedClassForProfile.id) || selectedClassForProfile;
    return (
      <div className="space-y-4" dir="rtl">
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <button
              onClick={() => setSelectedClassForProfile(null)}
              className="hover:text-teal-800 transition cursor-pointer"
            >
              کلاس‌ها
            </button>
            <span>/</span>
            <span className="text-teal-800 font-bold">{currentCls.name}</span>
          </div>

          <button
            onClick={() => setSelectedClassForProfile(null)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به لیست تمام کلاس‌ها</span>
          </button>
        </div>

        <ClassProfileView
          classData={currentCls}
          onBack={() => setSelectedClassForProfile(null)}
          onOpenNewAttendance={onOpenNewAttendance}
          onSelectStudent={onSelectStudent}
          onOpenAcademicGrades={onOpenAcademicGrades}
          onOpenMonthlySummary={onOpenMonthlySummary}
          isModal={false}
        />
      </div>
    );
  }

  // Get distinct grades for filter
  const distinctGrades = Array.from(new Set(classes.map((c) => c.grade)));

  // Search and filter (Phase 5 & 6)
  const filteredClasses = classes.filter((cls) => {
    const classStudents = students.filter((s) => s.classId === cls.id);
    const assignedTeachers = allTeachers.filter((t) => 
      cls.teacherIds?.includes(t.id) || t.assignedClassIds?.includes(cls.id)
    );
    const assignedCoach = allCoaches.find((c) => 
      c.id === cls.coachId || c.assignedClassIds?.includes(cls.id)
    );

    // Grade Filter
    if (gradeFilter !== 'all' && cls.grade !== gradeFilter) {
      return false;
    }

    // Status Filter
    if (statusFilter === 'has_students' && classStudents.length === 0) return false;
    if (statusFilter === 'no_students' && classStudents.length > 0) return false;
    if (statusFilter === 'no_teacher' && assignedTeachers.length > 0) return false;
    if (statusFilter === 'no_coach' && assignedCoach) return false;

    // Search query
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase().trim();
    const teachersNames = assignedTeachers.map((t) => t.name.toLowerCase()).join(' ');
    const coachName = (assignedCoach?.name || '').toLowerCase();
    const room = (cls.roomNumber || '').toLowerCase();

    return (
      cls.name.toLowerCase().includes(term) ||
      cls.grade.toLowerCase().includes(term) ||
      cls.major.toLowerCase().includes(term) ||
      teachersNames.includes(term) ||
      coachName.includes(term) ||
      room.includes(term)
    );
  });

  return (
    <div className="space-y-6 font-['Vazirmatn',sans-serif]" dir="rtl">
      
      {/* 1. Header اصلی مطابق دستورالعمل (مرحله ۳) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <span>مدیریت مدرسه</span>
              <span>/</span>
              <span className="text-teal-800">کلاس‌ها</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <GraduationCap className="w-6 h-6 text-teal-800" />
              <span>کلاس‌ها</span>
              <span className="text-xs font-bold bg-teal-50 text-teal-800 px-2.5 py-1 rounded-full border border-teal-200">
                {toPersianDigits(classes.length)} کلاس
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              کلاس‌ها و دانش‌آموزان هر کلاس را مدیریت کنید.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenNewClass}
              className="px-4 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن کلاس</span>
            </button>

            <button
              onClick={onOpenSidebar}
              className="lg:hidden px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="باز کردن منو"
            >
              <Menu className="w-4 h-4 text-slate-700" />
              <span>منو</span>
            </button>

            <button
              onClick={onBack}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>پیشخوان</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filter Controls (مراحل ۵ و ۶) */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-center gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجوی کلاس (نام کلاس، پایه، معلم، مربی، شماره اتاق)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition font-medium"
            />
          </div>

          {/* Grade Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-500 font-bold shrink-0">پایه:</span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full md:w-44 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-bold text-slate-800"
            >
              <option value="all">همه پایه‌ها</option>
              {distinctGrades.map((gr) => (
                <option key={gr} value={gr}>{gr}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-500 font-bold shrink-0">وضعیت:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-44 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-bold text-slate-800"
            >
              <option value="all">همه کلاس‌ها</option>
              <option value="has_students">دارای دانش‌آموز</option>
              <option value="no_students">بدون دانش‌آموز</option>
              <option value="no_teacher">بدون معلم</option>
              <option value="no_coach">بدون مربی</option>
            </select>
          </div>

        </div>
      </div>

      {/* 2. گرید کارت‌های کلاس (مرحله ۴، ۱۸، ۱۹) */}
      <div className="space-y-4">
        {openMenuClassId && (
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setOpenMenuClassId(null)}
          />
        )}

        {filteredClasses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
            <GraduationCap className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">کلاسی با این مشخصات یافت نشد.</p>
            <p className="text-xs text-slate-400">می‌توانید فیلترها را بازنشانی کرده یا کلاس جدیدی تعریف کنید.</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              {(searchTerm || gradeFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setGradeFilter('all');
                    setStatusFilter('all');
                  }}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  پاکسازی فیلترها
                </button>
              )}
              <button
                onClick={onOpenNewClass}
                className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن کلاس جدید</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredClasses.map((cls) => {
              const classStudents = students.filter((s) => s.classId === cls.id);
              const assignedTeachers = allTeachers.filter((t) => 
                cls.teacherIds?.includes(t.id) || t.assignedClassIds?.includes(cls.id)
              );
              const assignedCoach = allCoaches.find((c) => 
                c.id === cls.coachId || c.assignedClassIds?.includes(cls.id)
              );
              const classSessionsCount = sessions.filter((s) => s.classId === cls.id).length;

              const hasNoStudents = classStudents.length === 0;
              const hasNoTeachers = assignedTeachers.length === 0;

              return (
                <div
                  key={cls.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between relative group hover:border-teal-300"
                >
                  <div>
                    {/* Top Row: Class Name, Grade & More Menu */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                            {cls.grade}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {cls.major}
                          </span>
                          {cls.roomNumber && (
                            <span className="text-[10px] font-mono bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded border border-teal-200 font-bold">
                              اتاق {toPersianDigits(cls.roomNumber)}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-black text-slate-900 mt-1.5">
                          {cls.name}
                        </h3>
                      </div>

                      {/* Three-dots contextual menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuClassId(openMenuClassId === cls.id ? null : cls.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          title="عملیات سریع کلاس"
                          aria-label="عملیات سریع"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuClassId === cls.id && (
                          <div className="absolute left-0 top-8 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 text-xs animate-in fade-in divide-y divide-slate-100">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setSelectedClassForProfile(cls);
                                  setOpenMenuClassId(null);
                                }}
                                className="w-full text-right px-3 py-2 text-slate-800 hover:bg-teal-50 hover:text-teal-900 flex items-center gap-2 cursor-pointer font-bold"
                              >
                                <Eye className="w-3.5 h-3.5 text-teal-800" />
                                <span>مشاهده صفحه کلاس</span>
                              </button>

                              <button
                                onClick={() => {
                                  onOpenNewAttendance(cls.id);
                                  setOpenMenuClassId(null);
                                }}
                                className="w-full text-right px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                                <span>ثبت حضور و غیاب</span>
                              </button>

                              <button
                                onClick={() => {
                                  setQuickAddStudentClass(cls);
                                  setOpenMenuClassId(null);
                                }}
                                className="w-full text-right px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-teal-700" />
                                <span>افزودن دانش‌آموز</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                onClick={() => {
                                  onOpenMonthlySummary(cls.id);
                                  setOpenMenuClassId(null);
                                }}
                                className="w-full text-right px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                                <span>جمع‌بندی ماهانه</span>
                              </button>

                              {onOpenAcademicGrades && (
                                <button
                                  onClick={() => {
                                    onOpenAcademicGrades(cls.id);
                                    setOpenMenuClassId(null);
                                  }}
                                  className="w-full text-right px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                                  <span>نمرات ۴ نوبته</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  exportClassAttendanceToExcel(cls, students, sessions);
                                  setOpenMenuClassId(null);
                                }}
                                className="w-full text-right px-3 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                                <span>خروجی اکسل کلاس</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                onClick={() => {
                                  onEditClass(cls);
                                  setOpenMenuClassId(null);
                                }}
                                className="w-full text-right px-3 py-2 text-slate-600 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                <span>ویرایش مشخصات کلاس</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Class Information (مرحله ۴ و ۱۸: دانش‌آموزان، معلم، مربی) */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                      
                      {/* تعداد دانش‌آموزان */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>تعداد دانش‌آموز:</span>
                        </span>
                        <span className={`font-bold ${hasNoStudents ? 'text-amber-600 font-bold' : 'text-slate-900'}`}>
                          {hasNoStudents ? 'بدون دانش‌آموز' : `${toPersianDigits(classStudents.length)} نفر`}
                        </span>
                      </div>

                      {/* معلم کلاس */}
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                          <span>معلم:</span>
                        </span>
                        <span 
                          className={`font-medium text-left truncate max-w-[170px] ${
                            hasNoTeachers ? 'text-amber-600 text-[11px]' : 'text-slate-800'
                          }`}
                          title={assignedTeachers.map(t => t.name).join('، ')}
                        >
                          {hasNoTeachers ? 'تعیین نشده' : assignedTeachers.map(t => t.name).join('، ')}
                        </span>
                      </div>

                      {/* مربی کلاس */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span>مربی:</span>
                        </span>
                        <span className="font-medium text-slate-800">
                          {assignedCoach ? assignedCoach.name : <span className="text-slate-400 text-[11px]">تعیین نشده</span>}
                        </span>
                      </div>

                      {/* Empty states handling (مرحله ۱۹) */}
                      {hasNoStudents && (
                        <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-2 text-[11px] text-amber-800 flex items-center justify-between gap-2 mt-2">
                          <span>هنوز دانش‌آموزی اضافه نشده است.</span>
                          <button
                            onClick={() => setQuickAddStudentClass(cls)}
                            className="font-bold text-teal-800 hover:text-teal-900 underline cursor-pointer"
                          >
                            + افزودن دانش‌آموز
                          </button>
                        </div>
                      )}

                      {hasNoTeachers && !hasNoStudents && (
                        <div className="bg-slate-100 rounded-lg p-2 text-[11px] text-slate-600 flex items-center justify-between gap-2 mt-2">
                          <span>برای این کلاس معلمی تعیین نشده است.</span>
                          <button
                            onClick={() => onEditClass(cls)}
                            className="font-bold text-teal-800 hover:text-teal-900 underline cursor-pointer"
                          >
                            تعیین معلم
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Action Buttons (مشاهده کلاس) */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => setSelectedClassForProfile(cls)}
                      className="flex-1 py-2.5 px-4 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>مشاهده کلاس</span>
                    </button>

                    <button
                      onClick={() => onOpenNewAttendance(cls.id)}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                      title="ثبت حضور و غیاب امروز"
                    >
                      <CheckCircle2 className="w-4 h-4 text-teal-700" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Footer */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
        <div>
          نمایش <span className="font-bold text-slate-800">{toPersianDigits(filteredClasses.length)}</span> از{' '}
          <span className="font-bold text-slate-800">{toPersianDigits(classes.length)}</span> کلاس در مدرسه
        </div>
        <div className="text-[11px] text-slate-400">
          برای مدیریت مشخصات، انتقال دانش‌آموزان و مشاهده کارنامه کلاسی، روی «مشاهده کلاس» کلیک فرمایید.
        </div>
      </div>

      {/* Quick Add Student Modal */}
      {quickAddStudentClass && (
        <AddStudentToClassModal
          isOpen={!!quickAddStudentClass}
          onClose={() => setQuickAddStudentClass(null)}
          classData={quickAddStudentClass}
        />
      )}

    </div>
  );
};
