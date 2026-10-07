import React, { useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, StudentMonthlyStat, Student } from '../types';
import { PERSIAN_MONTHS, getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { exportClassAttendanceToExcel } from '../utils/excelExport';
import { 
  X, 
  Calendar, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Phone,
  BarChart3,
  Award
} from 'lucide-react';
import { studentFullName } from '../utils/studentName';

interface MonthlySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClassId?: string;
  onSelectStudent?: (student: Student) => void;
}

export const MonthlySummaryModal: React.FC<MonthlySummaryModalProps> = ({
  isOpen,
  onClose,
  initialClassId,
  onSelectStudent,
}) => {
  const { 
    accessibleClasses, 
    students, 
    sessions, 
    currentUser, 
    isTeacher 
  } = useSchool();

  const todayInfo = getTodayShamsi();

  const [selectedClassId, setSelectedClassId] = useState<string>(
    initialClassId || (accessibleClasses.length > 0 ? accessibleClasses[0].id : '')
  );

  const [selectedMonth, setSelectedMonth] = useState<number>(todayInfo.month); // 1 to 12

  if (!isOpen) return null;

  const currentClass = accessibleClasses.find((c) => c.id === selectedClassId) || accessibleClasses[0];
  const classStudents = currentClass ? students.filter((s) => s.classId === currentClass.id) : [];

  // Filter sessions for this class and selected month
  const monthSessions = sessions.filter((s) => {
    if (s.classId !== currentClass?.id) return false;
    const parts = s.date.split('/');
    return Number(parts[1]) === selectedMonth;
  });

  // Calculate stats per student
  const studentsStats: StudentMonthlyStat[] = classStudents.map((student) => {
    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    let lateCount = 0;
    let totalDelayMinutes = 0;
    let totalScore = 0;
    let scoreCount = 0;

    monthSessions.forEach((session) => {
      const rec = session.records[student.id];
      if (rec) {
        if (rec.status === 'present') presentCount++;
        else if (rec.status === 'absent') absentCount++;
        else if (rec.status === 'excused') excusedCount++;
        else if (rec.status === 'late') {
          lateCount++;
          totalDelayMinutes += rec.delayMinutes || 0;
        }

        if (rec.score !== undefined) {
          totalScore += rec.score;
          scoreCount++;
        }
      }
    });

    const totalSessions = monthSessions.length;
    const attended = presentCount + lateCount;
    const attendanceRate = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 100;
    const averageScore = scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(1)) : undefined;

    return {
      student,
      totalSessions,
      presentCount,
      absentCount,
      excusedCount,
      lateCount,
      totalDelayMinutes,
      attendanceRate,
      averageScore,
      warningFlag: absentCount >= 2,
    };
  });

  // Sort: warning students first or by attendance rate
  studentsStats.sort((a, b) => b.absentCount - a.absentCount || a.attendanceRate - b.attendanceRate);

  // Overall Class Metric
  let totalClassAttended = 0;
  let totalClassPossible = 0;
  let totalClassAbsences = 0;
  let totalClassLates = 0;

  studentsStats.forEach((st) => {
    totalClassAttended += st.presentCount + st.lateCount;
    totalClassPossible += st.totalSessions;
    totalClassAbsences += st.absentCount;
    totalClassLates += st.lateCount;
  });

  const overallRate = totalClassPossible > 0 ? Math.round((totalClassAttended / totalClassPossible) * 100) : 100;
  const warningList = studentsStats.filter((st) => st.warningFlag);
  const perfectList = studentsStats.filter((st) => st.attendanceRate === 100 && st.totalSessions > 0);

  const selectedMonthName = PERSIAN_MONTHS[selectedMonth - 1];

  const handleExportMonth = () => {
    if (!currentClass) return;
    exportClassAttendanceToExcel(currentClass, students, sessions, {
      monthFilter: selectedMonth,
      monthName: selectedMonthName,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                جمعبندی و گزارش آماری ماهانه حضور و غیاب
              </h2>
              <p className="text-xs text-slate-300">
                گزارش عملکرد ماه {selectedMonthName} • {currentClass?.name || ''}
              </p>
            </div>
          </div>
          
          <button
            id="btn-close-monthly-summary"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Class Selector */}
            <div>
              <select
                id="select-summary-class"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {accessibleClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Buttons Slider */}
            <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-md scrollbar-none">
              {PERSIAN_MONTHS.map((mName, idx) => {
                const monthNum = idx + 1;
                const isSelected = selectedMonth === monthNum;
                return (
                  <button
                    key={monthNum}
                    type="button"
                    onClick={() => setSelectedMonth(monthNum)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {mName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export Button */}
          <button
            id="btn-export-month-excel"
            onClick={handleExportMonth}
            className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی اکسل ماه {selectedMonthName}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-right">
              <div className="text-xs text-slate-500 font-medium">جلسات برگزارشده این ماه</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {toPersianDigits(monthSessions.length)} <span className="text-xs font-normal text-slate-500">جلسه</span>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-right">
              <div className="text-xs text-emerald-800 font-medium">میانگین کل حضور کلاس</div>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {toPersianDigits(overallRate)}٪
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-right">
              <div className="text-xs text-rose-800 font-medium">مجموع غیبت‌های ماه</div>
              <div className="text-xl font-bold text-rose-700 mt-1">
                {toPersianDigits(totalClassAbsences)} <span className="text-xs font-normal text-rose-600">مورد</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-right">
              <div className="text-xs text-amber-800 font-medium">مجموع موارد تاخیر</div>
              <div className="text-xl font-bold text-amber-700 mt-1">
                {toPersianDigits(totalClassLates)} <span className="text-xs font-normal text-amber-600">مورد</span>
              </div>
            </div>
          </div>

          {/* Warning Box for Frequent Absentees */}
          {warningList.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>دانش‌آموزان با بیش از ۲ جلسه غیبت در ماه {selectedMonthName} (نیازمند تماس با اولیاء و اقدام انضباطی):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {warningList.map((item) => (
                  <div key={item.student.id} className="bg-white p-2.5 rounded-lg border border-rose-200 shadow-xs flex items-center justify-between text-xs">
                    <div>
                      <button
                        type="button"
                        onClick={() => onSelectStudent && onSelectStudent(item.student)}
                        className="font-bold text-slate-900 hover:text-indigo-600 hover:underline text-right cursor-pointer"
                        title="مشاهده کارنامه و پرونده دانش‌آموز"
                      >
                        {studentFullName(item.student)}
                      </button>
                      <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                        {toPersianDigits(item.absentCount)} جلسه غیبت غیرموجه
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectStudent && onSelectStudent(item.student)}
                        className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-[11px] font-bold transition cursor-pointer"
                      >
                        کارنامه
                      </button>
                      <a
                        href={`tel:${item.student.parentPhone}`}
                        className="px-2 py-1 bg-rose-100 text-rose-800 rounded-md font-mono text-[11px] hover:bg-rose-200 flex items-center gap-1"
                        title="تماس مستقیم با اولیاء"
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table of Students Monthly Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800">
                جدول جزئیات حضور و غیاب دانش‌آموزان در ماه {selectedMonthName}
              </h3>
              <span className="text-xs text-slate-500">
                تعداد کل دانش‌آموزان: {toPersianDigits(studentsStats.length)} نفر
              </span>
            </div>

            {monthSessions.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs">
                در ماه {selectedMonthName} هیچ جلسه درسی برای این کلاس ثبت نشده است.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-12 text-center">ردیف</th>
                      <th className="p-3">نام و نام خانوادگی</th>
                      <th className="p-3 font-mono text-center">کد دانش‌آموزی</th>
                      <th className="p-3 text-center">حاضر</th>
                      <th className="p-3 text-center">غایب غیرموجه</th>
                      <th className="p-3 text-center">غیبت موجه</th>
                      <th className="p-3 text-center">تاخیر</th>
                      <th className="p-3 text-center">نمره میانگین</th>
                      <th className="p-3 w-36 text-center">درصد حضور ماه</th>
                      <th className="p-3 text-center">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentsStats.map((item, idx) => (
                      <tr 
                        key={item.student.id} 
                        className={`transition ${item.warningFlag ? 'bg-rose-50/40' : 'hover:bg-slate-50'}`}
                      >
                        <td className="p-3 text-center font-bold text-slate-400">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => onSelectStudent && onSelectStudent(item.student)}
                            className="font-bold text-slate-900 hover:text-indigo-600 hover:underline text-right cursor-pointer flex items-center gap-1.5"
                            title="مشاهده کارنامه و پرونده دانش‌آموز"
                          >
                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold">
                              {item.student.firstName[0]}
                            </div>
                            <span>{studentFullName(item.student)}</span>
                          </button>
                        </td>
                        <td className="p-3 font-mono text-slate-600 text-center">
                          {item.student.studentCode || '-'}
                        </td>
                        <td className="p-3 text-center text-emerald-700 font-bold">
                          {toPersianDigits(item.presentCount)}
                        </td>
                        <td className="p-3 text-center text-rose-700 font-bold">
                          {toPersianDigits(item.absentCount)}
                        </td>
                        <td className="p-3 text-center text-blue-700 font-medium">
                          {toPersianDigits(item.excusedCount)}
                        </td>
                        <td className="p-3 text-center text-amber-700 font-medium">
                          {toPersianDigits(item.lateCount)}
                          {item.totalDelayMinutes > 0 && (
                            <span className="text-[10px] text-amber-600 block">({toPersianDigits(item.totalDelayMinutes)} دقیقه)</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {item.averageScore !== undefined ? toPersianDigits(item.averageScore) : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  item.attendanceRate >= 85 
                                    ? 'bg-emerald-500' 
                                    : item.attendanceRate >= 70 
                                      ? 'bg-amber-500' 
                                      : 'bg-rose-500'
                                }`} 
                                style={{ width: `${item.attendanceRate}%` }}
                              />
                            </div>
                            <span className="font-bold text-[11px] text-slate-800">
                              {toPersianDigits(item.attendanceRate)}٪
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {item.warningFlag ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              اخطار غیبت
                            </span>
                          ) : item.attendanceRate === 100 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              عالی (۱۰۰٪)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                              عادی
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
