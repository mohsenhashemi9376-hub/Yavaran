import React, { useState } from 'react';
import { 
  SchoolClass, 
  AttendanceSession, 
  StudentAttendanceRecord, 
  MorningDelayRecord, 
  SchoolAbsenceRecord, 
  Student 
} from '../types';
import { toPersianDigits, getTodayShamsi, formatShamsiDisplay, getDayOfWeekFromShamsi } from '../utils/persianDate';
import { 
  CheckCircle2, 
  Search, 
  Calendar, 
  Plus, 
  ChevronLeft, 
  Menu, 
  FileSpreadsheet, 
  Users, 
  UserX, 
  Clock,
  GraduationCap,
  BookOpen,
  Trash2,
  AlertCircle,
  XCircle,
  HelpCircle,
  PhoneCall
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdminAttendanceWorkspaceProps {
  sessions: AttendanceSession[];
  classes: SchoolClass[];
  delays?: MorningDelayRecord[];
  schoolAbsences?: SchoolAbsenceRecord[];
  students?: Student[];
  onBack: () => void;
  onOpenSidebar: () => void;
  onOpenNewAttendance: (classId?: string) => void;
  onOpenAddDelay?: () => void;
  onOpenAddAbsence?: () => void;
  onDeleteDelay?: (id: string) => void;
  onDeleteSchoolAbsence?: (id: string) => void;
  initialTab?: 'sessions' | 'delays' | 'absences';
}

export const AdminAttendanceWorkspace: React.FC<AdminAttendanceWorkspaceProps> = ({
  sessions = [],
  classes = [],
  delays = [],
  schoolAbsences = [],
  students = [],
  onBack,
  onOpenSidebar,
  onOpenNewAttendance,
  onOpenAddDelay,
  onOpenAddAbsence,
  onDeleteDelay,
  onDeleteSchoolAbsence,
  initialTab = 'sessions',
}) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'delays' | 'absences'>(initialTab);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [excusedFilter, setExcusedFilter] = useState<'all' | 'excused' | 'unexcused'>('all');

  const todayInfo = getTodayShamsi();

  // Metrics for Sessions
  let totalPossible = 0;
  let totalAttended = 0;
  let totalClassAbsences = 0;
  let totalClassLates = 0;

  sessions.forEach((session) => {
    (Object.values(session.records || {}) as StudentAttendanceRecord[]).forEach((r) => {
      totalPossible++;
      if (r.status === 'present') totalAttended++;
      else if (r.status === 'late') {
        totalAttended++;
        totalClassLates++;
      } else if (r.status === 'absent') {
        totalClassAbsences++;
      }
    });
  });

  const attendanceRate = totalPossible > 0 ? Math.round((totalAttended / totalPossible) * 100) : 100;
  const safeDelays = Array.isArray(delays) ? delays : [];
  const safeAbsences = Array.isArray(schoolAbsences) ? schoolAbsences : [];

  // Filter Sessions
  const filteredSessions = sessions.filter((s) => {
    const cls = classes.find((c) => c.id === s.classId);

    if (classFilter && s.classId !== classFilter) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchesClass = cls?.name.toLowerCase().includes(q);
      const matchesTeacher = s.teacherName?.toLowerCase().includes(q);
      const matchesSubject = s.subject?.toLowerCase().includes(q);
      const matchesDate = s.date.includes(q);
      if (!matchesClass && !matchesTeacher && !matchesSubject && !matchesDate) {
        return false;
      }
    }
    return true;
  });

  // Filter Delays
  const filteredDelays = safeDelays.filter((d) => {
    const student = students.find((s) => s.id === d.studentId);
    const cls = classes.find((c) => c.id === (d.classId || student?.classId));
    const studentName = student ? `${student.firstName} ${student.lastName}` : (d.studentName || '');

    if (classFilter && (d.classId !== classFilter && student?.classId !== classFilter)) return false;

    if (excusedFilter === 'excused' && !d.isExcused) return false;
    if (excusedFilter === 'unexcused' && d.isExcused) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchesName = studentName.toLowerCase().includes(q);
      const matchesReason = d.reason?.toLowerCase().includes(q);
      const matchesDate = d.date.includes(q);
      if (!matchesName && !matchesReason && !matchesDate) return false;
    }
    return true;
  });

  // Filter Absences
  const filteredAbsences = safeAbsences.filter((a) => {
    const student = students.find((s) => s.id === a.studentId);
    const cls = classes.find((c) => c.id === (a.classId || student?.classId));
    const studentName = student ? `${student.firstName} ${student.lastName}` : '';

    if (classFilter && (a.classId !== classFilter && student?.classId !== classFilter)) return false;

    if (excusedFilter === 'excused' && !a.isExcused) return false;
    if (excusedFilter === 'unexcused' && a.isExcused) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const matchesName = studentName.toLowerCase().includes(q);
      const matchesReason = a.reason?.toLowerCase().includes(q);
      const matchesDate = a.date.includes(q);
      if (!matchesName && !matchesReason && !matchesDate) return false;
    }
    return true;
  });

  // Excel Exports
  const exportSessionsToExcel = () => {
    const rows = filteredSessions.map((s, idx) => {
      const cls = classes.find((c) => c.id === s.classId);
      const records = Object.values(s.records || {}) as StudentAttendanceRecord[];
      const pres = records.filter((r) => r.status === 'present').length;
      const abs = records.filter((r) => r.status === 'absent').length;
      const lts = records.filter((r) => r.status === 'late').length;

      return {
        'ردیف': idx + 1,
        'تاریخ جلسه': s.date,
        'روز هفته': getDayOfWeekFromShamsi(s.date),
        'کلاس': cls?.name || 'نامشخص',
        'زنگ': s.periodNumber ? `زنگ ${s.periodNumber}` : '-',
        'نام دبیر': s.teacherName || '-',
        'درس': s.subject || '-',
        'حاضرین': pres,
        'غائبین': abs,
        'تأخیرها': lts,
        'مبحث تدریس': s.lessonTopic || '-',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'جلسات حضور و غیاب');
    XLSX.writeFile(wb, `Sessions_${todayInfo.formattedDate}.xlsx`);
  };

  const exportDelaysToExcel = () => {
    const rows = filteredDelays.map((d, idx) => {
      const student = students.find((s) => s.id === d.studentId);
      const cls = classes.find((c) => c.id === (d.classId || student?.classId));
      return {
        'ردیف': idx + 1,
        'نام دانش‌آموز': student ? `${student.firstName} ${student.lastName}` : d.studentName || 'نامشخص',
        'کلاس': cls?.name || 'نامشخص',
        'تاریخ': d.date,
        'روز هفته': d.dayOfWeek,
        'ساعت ورود': d.arrivalTime || '-',
        'میزان تأخیر (دقیقه)': d.delayMinutes || 0,
        'وضعیت': d.isExcused ? 'موجه' : 'غیرموجه',
        'علت': d.reason || '-',
        'اقدام انضباطی': d.disciplinaryActionTaken || '-',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تأخیرهای ورود');
    XLSX.writeFile(wb, `MorningDelays_${todayInfo.formattedDate}.xlsx`);
  };

  const exportAbsencesToExcel = () => {
    const rows = filteredAbsences.map((a, idx) => {
      const student = students.find((s) => s.id === a.studentId);
      const cls = classes.find((c) => c.id === (a.classId || student?.classId));
      return {
        'ردیف': idx + 1,
        'نام دانش‌آموز': student ? `${student.firstName} ${student.lastName}` : 'نامشخص',
        'کلاس': cls?.name || 'نامشخص',
        'تاریخ غیبت': a.date,
        'روز هفته': a.dayOfWeek,
        'وضعیت': a.isExcused ? 'موجه' : 'غیرموجه',
        'علت غیبت': a.reason || '-',
        'ثبت‌کننده': a.recordedBy || '-',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'غیبت‌های مدرسه');
    XLSX.writeFile(wb, `SchoolAbsences_${todayInfo.formattedDate}.xlsx`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* 1. Header & Breadcrumb */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            {/* Breadcrumb (Step 19) */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <span>داشبورد</span>
              <span>/</span>
              <span>امور روزانه</span>
              <span>/</span>
              <span className="text-teal-800 font-black">حضور و غیاب</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-teal-800" />
              <span>مدیریت یکپارچه حضور و غیاب مدرسه</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              مدیریت جلسات کلاسی، ثبت تأخیر ورود و ثبت غیبت روزانه مدرسه در یک پنجره واحد.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Action Button depends on active tab or all */}
            {activeTab === 'sessions' && (
              <button
                type="button"
                onClick={() => onOpenNewAttendance()}
                className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت جلسه کلاسی جدید</span>
              </button>
            )}

            {activeTab === 'delays' && onOpenAddDelay && (
              <button
                type="button"
                onClick={onOpenAddDelay}
                className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت تأخیر ورود جدید</span>
              </button>
            )}

            {activeTab === 'absences' && onOpenAddAbsence && (
              <button
                type="button"
                onClick={onOpenAddAbsence}
                className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت غیبت مدرسه جدید</span>
              </button>
            )}

            {/* Excel export */}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'sessions') exportSessionsToExcel();
                else if (activeTab === 'delays') exportDelaysToExcel();
                else exportAbsencesToExcel();
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="خروجی اکسل"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>خروجی اکسل</span>
            </button>

            {/* Back Button */}
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>بازگشت به داشبورد</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">جلسات کلاسی ثبت‌شده</div>
              <div className="text-xl font-black text-teal-900 mt-0.5">
                {toPersianDigits(sessions.length)} <span className="text-xs font-normal text-slate-500">جلسه</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">تأخیرهای ورود به مدرسه</div>
              <div className="text-xl font-black text-amber-800 mt-0.5">
                {toPersianDigits(safeDelays.length)} <span className="text-xs font-normal text-slate-500">مورد دیرکرد</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">غیبت‌های کل روز مدرسه</div>
              <div className="text-xl font-black text-rose-700 mt-0.5">
                {toPersianDigits(safeAbsences.length)} <span className="text-xs font-normal text-slate-500">مورد غیبت</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* 2. Unified Sub-Tabs (Step 4 & 12: Sessions, Delays, Absences) */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'sessions'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>جلسات کلاسی</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              activeTab === 'sessions' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {toPersianDigits(sessions.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('delays')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'delays'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>تأخیرهای ورود به مدرسه</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              activeTab === 'delays' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {toPersianDigits(safeDelays.length)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('absences')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'absences'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <UserX className="w-4 h-4" />
            <span>غیبت‌های مدرسه</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              activeTab === 'absences' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {toPersianDigits(safeAbsences.length)}
            </span>
          </button>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder={
                activeTab === 'sessions' 
                  ? 'جستجو با نام درس، دبیر، کلاس یا تاریخ...'
                  : 'جستجو با نام دانش‌آموز، علت یا تاریخ...'
              }
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

          {(activeTab === 'delays' || activeTab === 'absences') && (
            <div>
              <select
                value={excusedFilter}
                onChange={(e) => setExcusedFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
              >
                <option value="all">همه وضعیت‌ها (موجه و غیرموجه)</option>
                <option value="excused">فقط موجه</option>
                <option value="unexcused">فقط غیرموجه</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: SESSIONS TABLE */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredSessions.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto opacity-40 text-teal-800" />
              <p className="text-xs font-bold text-slate-600">هیچ جلسه حضور و غیابی با این فیلتر یافت نشد.</p>
              <p className="text-[11px] text-slate-400">می‌توانید فیلترها را تغییر داده یا جلسه جدیدی ثبت کنید.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">ردیف</th>
                    <th className="py-3.5 px-4">کلاس</th>
                    <th className="py-3.5 px-4">درس و زنگ</th>
                    <th className="py-3.5 px-4">دبیر</th>
                    <th className="py-3.5 px-4">تاریخ جلسه</th>
                    <th className="py-3.5 px-4 text-center">حاضرین</th>
                    <th className="py-3.5 px-4 text-center">غائبین</th>
                    <th className="py-3.5 px-4 text-center">تأخیرها</th>
                    <th className="py-3.5 px-4">مبحث تدریس</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredSessions.map((s, idx) => {
                    const cls = classes.find((c) => c.id === s.classId);
                    const records = Object.values(s.records || {}) as StudentAttendanceRecord[];
                    const pres = records.filter((r) => r.status === 'present').length;
                    const abs = records.filter((r) => r.status === 'absent').length;
                    const lts = records.filter((r) => r.status === 'late').length;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{toPersianDigits(idx + 1)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{cls?.name || 'نامشخص'}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-teal-900">{s.subject || 'عمومی'}</span>
                          {s.periodNumber && (
                            <span className="mr-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              زنگ {toPersianDigits(s.periodNumber)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{s.teacherName || '-'}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {toPersianDigits(s.date)} <span className="text-[10px] text-slate-400">({getDayOfWeekFromShamsi(s.date)})</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700 font-mono">{toPersianDigits(pres)}</td>
                        <td className="py-3 px-4 text-center">
                          {abs > 0 ? (
                            <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-mono">
                              {toPersianDigits(abs)}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">۰</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {lts > 0 ? (
                            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-mono">
                              {toPersianDigits(lts)}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">۰</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{s.lessonTopic || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MORNING DELAYS TABLE */}
      {activeTab === 'delays' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredDelays.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <Clock className="w-10 h-10 mx-auto opacity-40 text-amber-600" />
              <p className="text-xs font-bold text-slate-600">هیچ مورد تأخیر ورودی با این فیلتر ثبت نشده است.</p>
              <p className="text-[11px] text-slate-400">از دکمه «ثبت تأخیر ورود جدید» برای ثبت دیرکرد صبحگاهی استفاده کنید.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">ردیف</th>
                    <th className="py-3.5 px-4">نام دانش‌آموز</th>
                    <th className="py-3.5 px-4">کلاس</th>
                    <th className="py-3.5 px-4">تاریخ و روز</th>
                    <th className="py-3.5 px-4 text-center">ساعت ورود</th>
                    <th className="py-3.5 px-4 text-center">میزان تأخیر</th>
                    <th className="py-3.5 px-4 text-center">وضعیت</th>
                    <th className="py-3.5 px-4">علت دیرکرد</th>
                    <th className="py-3.5 px-4 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredDelays.map((d, idx) => {
                    const student = students.find((s) => s.id === d.studentId);
                    const cls = classes.find((c) => c.id === (d.classId || student?.classId));

                    return (
                      <tr key={d.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{toPersianDigits(idx + 1)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {student ? `${student.firstName} ${student.lastName}` : (d.studentName || 'نامشخص')}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{cls?.name || 'نامشخص'}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {toPersianDigits(d.date)} <span className="text-[10px] text-slate-400">({d.dayOfWeek})</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                          {d.arrivalTime ? toPersianDigits(d.arrivalTime) : '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-amber-800">
                          {toPersianDigits(d.delayMinutes || 0)} دقیقه
                        </td>
                        <td className="py-3 px-4 text-center">
                          {d.isExcused ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                              موجه
                            </span>
                          ) : (
                            <span className="text-[10px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full font-bold">
                              غیرموجه
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{d.reason || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          {onDeleteDelay && (
                            <button
                              type="button"
                              onClick={() => onDeleteDelay(d.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="حذف این مورد تأخیر"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCHOOL ABSENCES TABLE */}
      {activeTab === 'absences' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredAbsences.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <UserX className="w-10 h-10 mx-auto opacity-40 text-rose-600" />
              <p className="text-xs font-bold text-slate-600">هیچ مورد غیبت مدرسه‌ای با این فیلتر ثبت نشده است.</p>
              <p className="text-[11px] text-slate-400">از دکمه «ثبت غیبت مدرسه جدید» برای ثبت غیبت در دفتر مدرسه استفاده کنید.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">ردیف</th>
                    <th className="py-3.5 px-4">نام دانش‌آموز</th>
                    <th className="py-3.5 px-4">کلاس</th>
                    <th className="py-3.5 px-4">تاریخ و روز</th>
                    <th className="py-3.5 px-4 text-center">وضعیت غیبت</th>
                    <th className="py-3.5 px-4">علت غیبت</th>
                    <th className="py-3.5 px-4">ثبت‌کننده</th>
                    <th className="py-3.5 px-4 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredAbsences.map((a, idx) => {
                    const student = students.find((s) => s.id === a.studentId);
                    const cls = classes.find((c) => c.id === (a.classId || student?.classId));

                    return (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{toPersianDigits(idx + 1)}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {student ? `${student.firstName} ${student.lastName}` : 'نامشخص'}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{cls?.name || 'نامشخص'}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {toPersianDigits(a.date)} <span className="text-[10px] text-slate-400">({a.dayOfWeek})</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {a.isExcused ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                              موجه
                            </span>
                          ) : (
                            <span className="text-[10px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full font-bold">
                              غیرموجه
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{a.reason || '-'}</td>
                        <td className="py-3 px-4 text-slate-500">{a.recordedBy || 'معاونت اجرایی'}</td>
                        <td className="py-3 px-4 text-center">
                          {onDeleteSchoolAbsence && (
                            <button
                              type="button"
                              onClick={() => onDeleteSchoolAbsence(a.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="حذف این مورد غیبت"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
