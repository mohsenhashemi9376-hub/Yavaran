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
import { useSchool } from '../context/SchoolContext';
import { MorningAttendanceWorkspace, MorningStatusFilter } from './MorningAttendanceWorkspace';
import { studentFullName } from '../utils/studentName';

type AttendanceTab = 'morning' | 'sessions';

interface AdminAttendanceWorkspaceProps {
  sessions: AttendanceSession[];
  classes: SchoolClass[];
  onBack: () => void;
  onOpenSidebar: () => void;
  onOpenNewAttendance: (classId?: string) => void;
  onSelectStudent?: (student: Student) => void;
  /** نمایش تب «حضور و غیاب صبحگاه» (ناظم/معاون اجرایی) */
  showMorning?: boolean;
  initialTab?: AttendanceTab;
  /** فیلتر وضعیت اولیه صفحه صبحگاه (غایب / متأخر / حاضر) */
  initialStatusFilter?: MorningStatusFilter;
}

const AttendanceTabSwitch: React.FC<{
  active: AttendanceTab;
  onChange: (tab: AttendanceTab) => void;
  sessionsCount: number;
}> = ({ active, onChange, sessionsCount }) => (
  <div className="flex items-center gap-2 overflow-x-auto" role="tablist">
    <button
      type="button"
      role="tab"
      aria-selected={active === 'morning'}
      onClick={() => onChange('morning')}
      className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
        active === 'morning'
          ? 'bg-emerald-100/70 text-emerald-900 border-emerald-300/80 shadow-sm'
          : 'bg-slate-50/80 text-slate-700 hover:bg-slate-100 border-slate-200/70'
      }`}
    >
      <Clock className="w-4 h-4" />
      <span>حضور و غیاب صبحگاه</span>
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={active === 'sessions'}
      onClick={() => onChange('sessions')}
      className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
        active === 'sessions'
          ? 'bg-emerald-100/70 text-emerald-900 border-emerald-300/80 shadow-sm'
          : 'bg-slate-50/80 text-slate-700 hover:bg-slate-100 border-slate-200/70'
      }`}
    >
      <CheckCircle2 className="w-4 h-4" />
      <span>جلسات کلاسی</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-white/70 text-slate-600">
        {toPersianDigits(sessionsCount)}
      </span>
    </button>
  </div>
);

export const AdminAttendanceWorkspace: React.FC<AdminAttendanceWorkspaceProps> = ({
  sessions = [],
  classes = [],
  onBack,
  onOpenSidebar,
  onOpenNewAttendance,
  onSelectStudent,
  showMorning = true,
  initialTab,
  initialStatusFilter,
}) => {
  const [activeTab, setActiveTab] = useState<AttendanceTab>(
    initialTab ?? (showMorning ? 'morning' : 'sessions')
  );

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const { students } = useSchool();
  // ردیفی که لیست اسامی غائبین/تأخیرها در آن باز شده است
  const [expanded, setExpanded] = useState<{ id: string; kind: 'absent' | 'late' } | null>(null);
  const toggleExpanded = (id: string, kind: 'absent' | 'late') =>
    setExpanded((cur) => (cur && cur.id === id && cur.kind === kind ? null : { id, kind }));

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
        'تکلیف جلسه': s.homeworkDescription || '-',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'جلسات حضور و غیاب');
    XLSX.writeFile(wb, `Sessions_${todayInfo.formattedDate}.xlsx`);
  };

  if (showMorning && activeTab === 'morning') {
    return (
      <div className="space-y-4" dir="rtl">
        <AttendanceTabSwitch active={activeTab} onChange={setActiveTab} sessionsCount={sessions.length} />
        <MorningAttendanceWorkspace initialStatusFilter={initialStatusFilter} onBack={onBack} onOpenSidebar={onOpenSidebar} onSelectStudent={onSelectStudent} />
      </div>
    );
  }

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

            {/* Excel export */}
            <button
              type="button"
              onClick={() => {
                exportSessionsToExcel();
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

        </div>

        {showMorning && (
          <div className="pt-2 border-t border-slate-100">
            <AttendanceTabSwitch active={activeTab} onChange={setActiveTab} sessionsCount={sessions.length} />
          </div>
        )}

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو با نام درس، دبیر، کلاس یا تاریخ..."
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
                    <th className="py-3.5 px-4">تکلیف جلسه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredSessions.map((s, idx) => {
                    const cls = classes.find((c) => c.id === s.classId);
                    const records = Object.values(s.records || {}) as StudentAttendanceRecord[];
                    const pres = records.filter((r) => r.status === 'present').length;
                    const abs = records.filter((r) => r.status === 'absent').length;
                    const lts = records.filter((r) => r.status === 'late').length;
                    const isOpen = expanded?.id === s.id;

                    return (
                      <React.Fragment key={s.id}>
                      <tr className="hover:bg-slate-50/80 transition">
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
                            <button
                              type="button"
                              onClick={() => toggleExpanded(s.id, 'absent')}
                              title="نمایش اسامی غائبین"
                              className={`font-bold text-rose-700 px-2 py-0.5 rounded-full font-mono cursor-pointer transition hover:bg-rose-100 ${
                                isOpen && expanded?.kind === 'absent' ? 'bg-rose-200 ring-1 ring-rose-300' : 'bg-rose-50'
                              }`}
                            >
                              {toPersianDigits(abs)}
                            </button>
                          ) : (
                            <span className="text-slate-300 font-mono">۰</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {lts > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(s.id, 'late')}
                              title="نمایش اسامی متأخرین"
                              className={`font-bold text-amber-700 px-2 py-0.5 rounded-full font-mono cursor-pointer transition hover:bg-amber-100 ${
                                isOpen && expanded?.kind === 'late' ? 'bg-amber-200 ring-1 ring-amber-300' : 'bg-amber-50'
                              }`}
                            >
                              {toPersianDigits(lts)}
                            </button>
                          ) : (
                            <span className="text-slate-300 font-mono">۰</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{s.lessonTopic || '-'}</td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={s.homeworkDescription}>{s.homeworkDescription || '-'}</td>
                      </tr>
                      {isOpen && expanded && (
                        <tr className={expanded.kind === 'absent' ? 'bg-rose-50/40' : 'bg-amber-50/40'}>
                          <td colSpan={10} className="px-4 py-3">
                            <div className="text-[11px] font-bold text-slate-600 mb-2">
                              {expanded.kind === 'absent' ? 'غائبین این جلسه' : 'متأخرین این جلسه'}
                              {' • '}
                              {s.subject || 'عمومی'} • {cls?.name || 'نامشخص'} • {toPersianDigits(s.date)}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {records
                                .filter((r) => r.status === expanded.kind)
                                .map((r) => {
                                  const stu = students.find((x) => x.id === r.studentId);
                                  const name = stu ? `${studentFullName(stu)}`.trim() : 'دانش‌آموز حذف‌شده';
                                  const tone =
                                    expanded.kind === 'absent'
                                      ? 'bg-white text-rose-800 border-rose-200'
                                      : 'bg-white text-amber-800 border-amber-200';
                                  return (
                                    <button
                                      key={r.studentId}
                                      type="button"
                                      disabled={!stu || !onSelectStudent}
                                      onClick={() => stu && onSelectStudent?.(stu)}
                                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${tone} ${
                                        stu && onSelectStudent ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'
                                      }`}
                                    >
                                      {name}
                                      {expanded.kind === 'late' && r.delayMinutes ? (
                                        <span className="mr-1.5 font-mono font-medium text-[10px] text-amber-600">
                                          ({toPersianDigits(r.delayMinutes)} دقیقه)
                                        </span>
                                      ) : null}
                                      {r.note ? <span className="mr-1.5 font-medium text-[10px] text-slate-500">— {r.note}</span> : null}
                                    </button>
                                  );
                                })}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
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
