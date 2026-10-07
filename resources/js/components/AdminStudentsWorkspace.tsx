import React, { useState } from 'react';
import { Student, SchoolClass, AttendanceSession, MorningDelayRecord } from '../types';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  ChevronLeft, 
  Menu, 
  Phone, 
  FileSpreadsheet, 
  Eye, 
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  Trash2
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import * as XLSX from 'xlsx';
import { studentFullName } from '../utils/studentName';

interface AdminStudentsWorkspaceProps {
  students: Student[];
  classes: SchoolClass[];
  sessions: AttendanceSession[];
  morningDelays?: MorningDelayRecord[];
  onBack: () => void;
  onOpenSidebar: () => void;
  onSelectStudent?: (student: Student) => void;
  onOpenQuickAddStudent: () => void;
}

export const AdminStudentsWorkspace: React.FC<AdminStudentsWorkspaceProps> = ({
  students,
  classes,
  sessions,
  morningDelays = [],
  onBack,
  onOpenSidebar,
  onSelectStudent,
  onOpenQuickAddStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'warning' | 'normal'>('all');

  const todayInfo = getTodayShamsi();
  const { deleteStudent, showConfirm, isAdminOrVice } = useSchool();

  const handleDeleteStudent = (student: Student) => {
    showConfirm({
      title: 'حذف کامل دانش‌آموز',
      message: `آیا از حذف «${studentFullName(student)}» اطمینان دارید؟ تمام سوابق حضور و غیاب، نمرات، تأخیرها و پرونده تربیتی این دانش‌آموز نیز حذف خواهد شد و قابل بازگشت نیست.`,
      confirmLabel: 'حذف دانش‌آموز',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => deleteStudent(student.id),
    });
  };

  // Compute student stats
  const getStudentMetrics = (studentId: string, classId: string) => {
    let absences = 0;
    let lates = 0;
    sessions.filter((s) => s.classId === classId).forEach((s) => {
      const r = s.records[studentId];
      if (r?.status === 'absent') absences++;
      if (r?.status === 'late') lates++;
    });
    const safeMorningDelays = Array.isArray(morningDelays) ? morningDelays : [];
    const morningLateCount = safeMorningDelays.filter((d) => d.studentId === studentId).length;
    return {
      absences,
      lates: lates + morningLateCount,
    };
  };

  // Filter students
  const filteredStudents = students.filter((student) => {
    const studentClass = classes.find((c) => c.id === student.classId);
    const fullName = `${studentFullName(student)}`.toLowerCase();
    const metrics = getStudentMetrics(student.id, student.classId);

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchesName = fullName.includes(q);
      const matchesCode = student.studentCode?.toLowerCase().includes(q);
      const matchesNational = student.nationalId?.includes(q);
      const matchesPhone = student.parentPhone?.includes(q);
      const matchesClass = studentClass?.name.toLowerCase().includes(q);
      if (!matchesName && !matchesCode && !matchesNational && !matchesPhone && !matchesClass) {
        return false;
      }
    }

    // Class filter
    if (classFilter && student.classId !== classFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'warning' && metrics.absences < 2) {
      return false;
    }
    if (statusFilter === 'normal' && metrics.absences >= 2) {
      return false;
    }

    return true;
  });

  const exportStudentsToExcel = () => {
    const rows = filteredStudents.map((s, idx) => {
      const cls = classes.find((c) => c.id === s.classId);
      const metrics = getStudentMetrics(s.id, s.classId);
      return {
        'ردیف': idx + 1,
        'نام و نام خانوادگی': `${studentFullName(s)}`,
        'کلاس': cls?.name || 'نامشخص',
        'پایه': cls?.grade || '-',
        'کد دانش‌آموزی': s.studentCode || '-',
        'کد ملی': s.nationalId || '-',
        'شماره تماس ولی': s.parentPhone || '-',
        'تعداد غیبت': metrics.absences,
        'تعداد تأخیر': metrics.lates,
        'نمره انضباط': s.disciplinaryScore ?? 20,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'دانش‌آموزان');
    XLSX.writeFile(wb, `Students_List_${todayInfo.formattedDate}.xlsx`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* 1. Header ساختار یکسان */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <span>پیشخوان اصلی</span>
              <span>/</span>
              <span className="text-teal-800">لیست دانش‌آموزان مدرسه</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <Users className="w-6 h-6 text-teal-800" />
              <span>لیست دانش‌آموزان مدرسه</span>
              <span className="text-xs font-bold bg-teal-50 text-teal-800 px-2.5 py-1 rounded-full border border-teal-200">
                {toPersianDigits(students.length)} دانش‌آموز
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              مشاهده سریع، جستجو، ثبت‌نام و مدیریت پرونده‌های دانش‌آموزان تمام پایه‌ها.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenQuickAddStudent}
              className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>ثبت‌نام دانش‌آموز جدید</span>
            </button>

            <button
              onClick={exportStudentsToExcel}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="خروجی اکسل از لیست فعلی"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>خروجی اکسل</span>
            </button>

            <button
              onClick={onOpenSidebar}
              className="lg:hidden px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
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
              <span>بازگشت به داشبورد</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو با نام، کد ملی، شماره دانش‌آموزی..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition"
            />
          </div>

          <div>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="">تمام کلاس‌ها ({toPersianDigits(classes.length)} کلاس)</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="all">تمام وضعیت‌ها</option>
              <option value="normal">وضعیت عادی (بدون اخطار غیبت)</option>
              <option value="warning">دارای اخطار (۲ غیبت یا بیشتر)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. بدنه: جدول کامل دانش‌آموزان */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-xs font-bold text-slate-600">دانش‌آموزی با این مشخصات یافت نشد.</p>
            <p className="text-[11px] text-slate-400">می‌توانید فیلترها را بازنشانی کرده یا دانش‌آموز جدیدی ثبت کنید.</p>
          </div>
        ) : (
          <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5 whitespace-nowrap w-12 text-center">ردیف</th>
                  <th className="p-3.5 whitespace-nowrap">نام و نام خانوادگی</th>
                  <th className="p-3.5 whitespace-nowrap">کلاس و پایه</th>
                  <th className="p-3.5 whitespace-nowrap text-center">شماره تماس ولی</th>
                  <th className="p-3.5 whitespace-nowrap text-center">حضور و غیاب</th>
                  <th className="p-3.5 whitespace-nowrap text-center">انضباط</th>
                  {isAdminOrVice && <th className="p-3.5 whitespace-nowrap w-16 text-center">حذف</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student, idx) => {
                  const studentClass = classes.find((c) => c.id === student.classId);
                  const metrics = getStudentMetrics(student.id, student.classId);
                  const hasWarning = metrics.absences >= 2;

                  return (
                    <tr 
                      key={student.id} 
                      className={`hover:bg-slate-50/80 transition ${
                        hasWarning ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="p-3.5 whitespace-nowrap text-center font-bold text-slate-400">
                        {toPersianDigits(idx + 1)}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectStudent && onSelectStudent(student)}
                          className="flex items-center gap-2.5 text-right group cursor-pointer"
                          title="مشاهده پروفایل و پرونده کامل دانش‌آموز"
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition group-hover:scale-105 ${
                            hasWarning ? 'bg-rose-100 text-rose-800' : 'bg-teal-50 text-teal-800 group-hover:bg-teal-100'
                          }`}>
                            {student.firstName[0]}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-teal-800 group-hover:underline transition text-xs sm:text-sm">
                              {studentFullName(student)}
                            </span>
                          </div>
                        </button>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-bold text-slate-800">
                          {studentClass?.name || 'کلاس نامشخص'}
                        </span>
                        {studentClass?.grade && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            پایه {studentClass.grade}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-center">
                        <a
                          href={`tel:${student.parentPhone}`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-teal-800 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition"
                        >
                          <Phone className="w-3 h-3 text-teal-700" />
                          <span dir="ltr">{toPersianDigits(student.parentPhone)}</span>
                        </a>
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            hasWarning 
                              ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {toPersianDigits(metrics.absences)} غیبت
                          </span>
                          {metrics.lates > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              {toPersianDigits(metrics.lates)} تأخیر
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap text-center">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-800 border border-slate-200">
                          {toPersianDigits(student.disciplinaryScore ?? 20)}
                        </span>
                      </td>

                      {isAdminOrVice && (
                        <td className="p-3.5 whitespace-nowrap text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="حذف دانش‌آموز"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* نمای کارتی موبایل */}
          <ul className="md:hidden p-3 space-y-3">
            {filteredStudents.map((student, idx) => {
              const studentClass = classes.find((c) => c.id === student.classId);
              const metrics = getStudentMetrics(student.id, student.classId);
              const hasWarning = metrics.absences >= 2;
              return (
                <li
                  key={student.id}
                  className={`bg-white rounded-2xl border shadow-sm shadow-slate-900/5 p-4 space-y-3 ${
                    hasWarning ? 'border-rose-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-[11px] font-bold text-slate-400 pt-1 w-6 shrink-0 text-center">
                      {toPersianDigits(idx + 1)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectStudent && onSelectStudent(student)}
                      className="flex-1 min-w-0 text-right cursor-pointer"
                    >
                      <div className="text-base font-extrabold text-slate-900 leading-snug break-words">
                        {studentFullName(student)}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800">
                          {studentClass?.name || 'کلاس نامشخص'}
                        </span>
                        {studentClass?.grade && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            پایه {studentClass.grade}
                          </span>
                        )}
                      </div>
                    </button>
                    {isAdminOrVice && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(student)}
                        className="p-2.5 -m-1 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                        title="حذف دانش‌آموز"
                        aria-label="حذف دانش‌آموز"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                    <a
                      href={`tel:${student.parentPhone}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200"
                    >
                      <Phone className="w-3.5 h-3.5 text-teal-700" />
                      <span dir="ltr">{toPersianDigits(student.parentPhone)}</span>
                    </a>
                    <span
                      className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold ${
                        hasWarning ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {toPersianDigits(metrics.absences)} غیبت
                    </span>
                    {metrics.lates > 0 && (
                      <span className="px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        {toPersianDigits(metrics.lates)} تأخیر
                      </span>
                    )}
                    <span className="mr-auto px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      انضباط: {toPersianDigits(student.disciplinaryScore ?? 20)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}

        {/* 3. Footer ساختار یکسان */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <div>
            نمایش <span className="font-bold text-slate-800">{toPersianDigits(filteredStudents.length)}</span> از{' '}
            <span className="font-bold text-slate-800">{toPersianDigits(students.length)}</span> دانش‌آموز
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              جهت ویرایش مشخصات یا ثبت غیبت و تأخیر، وارد پرونده دانش‌آموز شوید.
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
