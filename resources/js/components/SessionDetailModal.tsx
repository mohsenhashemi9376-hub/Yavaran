import React, { useState } from 'react';
import { AttendanceSession, SchoolClass, Student, StudentAttendanceRecord } from '../types';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits, formatShamsiDisplay } from '../utils/persianDate';
import { 
  X, 
  Calendar, 
  Clock, 
  BookOpen, 
  UserCheck, 
  UserX, 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  Edit3, 
  Search, 
  FileText,
  Printer,
  Sparkles,
  Info,
  Layers,
  Award,
  ShieldAlert
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { studentFullName } from '../utils/studentName';

interface SessionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AttendanceSession | null;
  onEditSession?: (session: AttendanceSession) => void;
  onEdit?: () => void;
  onSelectStudent?: (student: Student) => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  isOpen,
  onClose,
  session,
  onEditSession,
  onEdit,
  onSelectStudent,
}) => {
  const { classes, students } = useSchool();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'late' | 'excused'>('all');

  if (!isOpen || !session) return null;

  const targetClass = classes.find((c) => c.id === session.classId);
  const classStudents = students.filter((s) => s.classId === session.classId);

  // Compute session statistics
  let presentCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  let lateCount = 0;
  let totalDelayMinutes = 0;
  let totalScoreSum = 0;
  let scoreCount = 0;
  let homeworkDone = 0;
  let homeworkIncomplete = 0;
  let homeworkNotDone = 0;

  classStudents.forEach((stu) => {
    const rec: StudentAttendanceRecord | undefined = session.records[stu.id];
    const status = rec?.status || 'present';

    if (status === 'present') presentCount++;
    else if (status === 'absent') absentCount++;
    else if (status === 'excused') excusedCount++;
    else if (status === 'late') {
      lateCount++;
      totalDelayMinutes += rec?.delayMinutes || 15;
    }

    if (rec?.score !== undefined && rec.score !== null) {
      totalScoreSum += rec.score;
      scoreCount++;
    }

    if (rec?.homeworkStatus === 'done') homeworkDone++;
    else if (rec?.homeworkStatus === 'incomplete') homeworkIncomplete++;
    else if (rec?.homeworkStatus === 'not_done') homeworkNotDone++;
  });

  const totalStudents = classStudents.length;
  const attendanceRate = totalStudents > 0 
    ? Math.round(((presentCount + lateCount) / totalStudents) * 100) 
    : 100;
  const averageClassScore = scoreCount > 0 
    ? (totalScoreSum / scoreCount).toFixed(1) 
    : undefined;

  // Filter student list
  const filteredStudents = classStudents.filter((stu) => {
    const fullName = `${studentFullName(stu)} ${stu.studentCode}`.toLowerCase();
    if (searchTerm.trim() && !fullName.includes(searchTerm.trim().toLowerCase())) {
      return false;
    }

    const rec = session.records[stu.id];
    const status = rec?.status || 'present';
    if (filterStatus !== 'all' && status !== filterStatus) {
      return false;
    }

    return true;
  });

  // Export this single session to Excel
  const handleExportSessionExcel = () => {
    const data = classStudents.map((stu, idx) => {
      const rec = session.records[stu.id];
      const status = rec?.status || 'present';
      const statusTitle = 
        status === 'present' ? 'حاضر' :
        status === 'absent' ? 'غایب' :
        status === 'late' ? `تاخیر (${toPersianDigits(rec?.delayMinutes || 15)} دقیقه)` : 'غیبت موجه';

      const hwTitle = 
        rec?.homeworkStatus === 'done' ? 'کامل' :
        rec?.homeworkStatus === 'incomplete' ? 'ناقص' :
        rec?.homeworkStatus === 'not_done' ? 'انجام نشده' : 'ثبت نشده';

      return {
        'ردیف': idx + 1,
        'کد دانش‌آموزی': stu.studentCode,
        'نام و نام خانوادگی': `${studentFullName(stu)}`,
        'نام پدر': stu.fatherName || '-',
        'وضعیت حضور': statusTitle,
        'دقایق تاخیر': status === 'late' ? rec?.delayMinutes || 15 : 0,
        'نمره شفاهی/کلاسی': rec?.score !== undefined ? rec.score : '-',
        'تکلیف کلاسی': hwTitle,
        'یادداشت دبیر': rec?.note || '-',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'آمار جلسه');
    const safeDate = session.date.replace(/\//g, '-');
    XLSX.writeFile(wb, `گزارش_جلسه_${targetClass?.name || 'کلاس'}_${safeDate}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  آمار و صورتجلسه: {session.subject}
                </h2>
                <span className="text-xs bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-md font-mono">
                  {session.date} ({session.dayOfWeek})
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                کلاس: <strong className="text-white">{targetClass?.name || 'کلاس'}</strong> • مدرس: {session.teacherName || 'دبیر محترم'}
                {session.bellPeriodName ? ` • ${session.bellPeriodName}` : ''}
                {session.startTime ? ` • ساعت: ${toPersianDigits(session.startTime)} ${session.endTime ? `تا ${toPersianDigits(session.endTime)}` : ''}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEditSession && (
              <button
                id="btn-edit-session-modal"
                onClick={() => {
                  onClose();
                  onEditSession(session);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="ویرایش جزئیات جلسه و حضور و غیاب"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ویرایش جلسه</span>
              </button>
            )}

            <button
              id="btn-export-session-excel"
              onClick={handleExportSessionExcel}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="خروجی اکسل این جلسه"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">اکسل جلسه</span>
            </button>

            <button
              id="btn-close-session-detail"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            {/* Total Students & Attendance Rate */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between text-slate-500 font-medium">
                <span>کل دانش‌آموزان</span>
                <Layers className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                {toPersianDigits(totalStudents)} نفر
              </div>
              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
                حضور: {toPersianDigits(attendanceRate)}٪
              </div>
            </div>

            {/* Present Count */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center justify-between text-emerald-800 font-medium">
                <span>حاضرین سر کلاس</span>
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-base sm:text-lg font-bold text-emerald-900 mt-1">
                {toPersianDigits(presentCount)} نفر
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">
                {totalStudents > 0 ? toPersianDigits(Math.round((presentCount / totalStudents) * 100)) : 0}٪ از کل کلاس
              </div>
            </div>

            {/* Absent Count */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3">
              <div className="flex items-center justify-between text-rose-800 font-medium">
                <span>غایبین غیرموجه</span>
                <UserX className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="text-base sm:text-lg font-bold text-rose-900 mt-1">
                {toPersianDigits(absentCount)} نفر
              </div>
              <div className="text-[10px] text-rose-700 mt-0.5">
                {excusedCount > 0 ? `+ ${toPersianDigits(excusedCount)} موجه` : 'بدون غیبت موجه'}
              </div>
            </div>

            {/* Late Arrivals */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center justify-between text-amber-800 font-medium">
                <span>ورود با تاخیر</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="text-base sm:text-lg font-bold text-amber-900 mt-1">
                {toPersianDigits(lateCount)} نفر
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">
                مجموع: {toPersianDigits(totalDelayMinutes)} دقیقه تاخیر
              </div>
            </div>

            {/* Class Oral Score Average */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-indigo-800 font-medium">
                <span>میانگین ارزشیابی</span>
                <Award className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="text-base sm:text-lg font-bold text-indigo-900 mt-1">
                {averageClassScore ? `${toPersianDigits(averageClassScore)} / ۲۰` : 'ثبت نشده'}
              </div>
              <div className="text-[10px] text-indigo-700 mt-0.5">
                {scoreCount > 0 ? `${toPersianDigits(scoreCount)} نمره ثبت‌شده` : 'ارزشیابی شفاهی'}
              </div>
            </div>
          </div>

          {/* Session Educational Content & Homework Panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>مبحث تدریس شده در این جلسه:</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700 leading-relaxed min-h-[44px]">
                {session.lessonTopic || 'مبحث خاصی ثبت نشده است.'}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>تکالیف داده شده برای جلسه آینده:</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700 leading-relaxed min-h-[44px]">
                {session.homeworkDescription || 'تکلیفی تعیین نشده است.'}
              </div>
            </div>

            {session.sessionNotes && (
              <div className="md:col-span-2 space-y-1.5 pt-1">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-slate-500" />
                  <span>یادداشت‌ها و توضیحات کلی دبیر:</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-slate-600">
                  {session.sessionNotes}
                </div>
              </div>
            )}
          </div>

          {/* Roster & Attendance Details Filter & Search */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>لیست دانش‌آموزان و وضعیت در این جلسه ({toPersianDigits(filteredStudents.length)} نفر)</span>
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Filter Buttons */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      filterStatus === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    همه ({toPersianDigits(totalStudents)})
                  </button>
                  <button
                    onClick={() => setFilterStatus('present')}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      filterStatus === 'present' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700'
                    }`}
                  >
                    حاضر ({toPersianDigits(presentCount)})
                  </button>
                  <button
                    onClick={() => setFilterStatus('absent')}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      filterStatus === 'absent' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700'
                    }`}
                  >
                    غایب ({toPersianDigits(absentCount)})
                  </button>
                  <button
                    onClick={() => setFilterStatus('late')}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      filterStatus === 'late' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-700'
                    }`}
                  >
                    تاخیر ({toPersianDigits(lateCount)})
                  </button>
                  {excusedCount > 0 && (
                    <button
                      onClick={() => setFilterStatus('excused')}
                      className={`px-2 py-1 rounded-md transition cursor-pointer ${
                        filterStatus === 'excused' ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700'
                      }`}
                    >
                      موجه ({toPersianDigits(excusedCount)})
                    </button>
                  )}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="جستجوی دانش‌آموز..."
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none w-36 sm:w-48"
                  />
                </div>
              </div>
            </div>

            {/* Students Table */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">ردیف</th>
                    <th className="p-3">نام و نام خانوادگی</th>
                    <th className="p-3">کد دانش‌آموزی</th>
                    <th className="p-3 text-center">وضعیت حضور</th>
                    <th className="p-3 text-center">نمره کلاسی/شفاهی</th>
                    <th className="p-3 text-center">وضعیت تکلیف</th>
                    <th className="p-3 text-center">اخطار انضباطی کلاسی</th>
                    <th className="p-3">یادداشت دبیر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400">
                        دانش‌آموزی با فیلتر انتخابی یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((stu, idx) => {
                      const rec = session.records[stu.id];
                      const status = rec?.status || 'present';

                      return (
                        <tr key={stu.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 text-center font-bold text-slate-400">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => {
                                if (onSelectStudent) {
                                  onClose();
                                  onSelectStudent(stu);
                                }
                              }}
                              className="font-bold text-slate-900 hover:text-emerald-700 transition cursor-pointer text-right"
                            >
                              {studentFullName(stu)}
                            </button>
                            <div className="text-[10px] text-slate-400">
                              فرزند {stu.fatherName || '-'}
                            </div>
                          </td>
                          <td className="p-3 font-mono text-slate-600">
                            {toPersianDigits(stu.studentCode)}
                          </td>
                          <td className="p-3 text-center">
                            {status === 'present' && (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                حاضر
                              </span>
                            )}
                            {status === 'absent' && (
                              <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                <UserX className="w-3 h-3 text-rose-600" />
                                غایب
                              </span>
                            )}
                            {status === 'late' && (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                <Clock className="w-3 h-3 text-amber-600" />
                                تاخیر ({toPersianDigits(rec?.delayMinutes || 15)} دقیقه)
                              </span>
                            )}
                            {status === 'excused' && (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                <Info className="w-3 h-3 text-blue-600" />
                                غیبت موجه
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold">
                            {rec?.score !== undefined ? (
                              <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                                rec.score >= 17 ? 'bg-emerald-100 text-emerald-900' :
                                rec.score >= 14 ? 'bg-blue-100 text-blue-900' :
                                rec.score >= 10 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'
                              }`}>
                                {toPersianDigits(rec.score)} / ۲۰
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {rec?.homeworkStatus === 'done' && (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold">
                                کامل
                              </span>
                            )}
                            {rec?.homeworkStatus === 'incomplete' && (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-semibold">
                                ناقص
                              </span>
                            )}
                            {rec?.homeworkStatus === 'not_done' && (
                              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] font-semibold">
                                انجام نشده
                              </span>
                            )}
                            {(!rec?.homeworkStatus || rec.homeworkStatus === undefined) && (
                              <span className="text-slate-400 text-[10px]">ثبت نشده</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {rec?.disciplinaryWarning?.hasWarning ? (
                              <span 
                                className="inline-flex items-center gap-1 bg-rose-100 border border-rose-300 text-rose-800 px-2 py-0.5 rounded-lg font-bold text-[11px]"
                                title={rec.disciplinaryWarning.description || rec.disciplinaryWarning.title}
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                <span>{rec.disciplinaryWarning.title} (-{toPersianDigits(rec.disciplinaryWarning.scoreDeduction)})</span>
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 max-w-xs truncate text-[11px]">
                            {rec?.note || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <div>
            ثبت شده در سامانه مدرسه یاوران ولایت
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition cursor-pointer"
          >
            بستن
          </button>
        </div>

      </div>
    </div>
  );
};
