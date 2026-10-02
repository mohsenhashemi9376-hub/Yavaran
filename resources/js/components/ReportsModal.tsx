import React, { useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { 
  exportClassAttendanceToExcel, 
  exportOverallSchoolSummaryToExcel,
  exportTeacherReportToExcel,
  exportCoachReportToExcel
} from '../utils/excelExport';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  BookOpen, 
  Users, 
  GraduationCap, 
  UserCheck, 
  HeartHandshake 
} from 'lucide-react';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAcademicGrades?: (classId?: string) => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({
  isOpen,
  onClose,
  onOpenAcademicGrades,
}) => {
  const { classes, students, sessions, allTeachers, allCoaches, coachEvaluations } = useSchool();
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [selectedTeacherId, setSelectedTeacherId] = useState(allTeachers[0]?.id || '');
  const [selectedCoachId, setSelectedCoachId] = useState(allCoaches[0]?.id || '');

  if (!isOpen) return null;

  const handleExportOverall = () => {
    exportOverallSchoolSummaryToExcel(classes, students, sessions, allTeachers);
  };

  const handleExportClass = () => {
    const cls = classes.find((c) => c.id === selectedClassId);
    if (!cls) return;
    const classStudents = students.filter((s) => s.classId === cls.id);
    const classSessions = sessions.filter((s) => s.classId === cls.id);
    exportClassAttendanceToExcel(cls, classStudents, classSessions);
  };

  const handleExportTeacher = () => {
    const teacher = allTeachers.find((t) => t.id === selectedTeacherId);
    if (!teacher) return;
    exportTeacherReportToExcel(teacher, classes, sessions, students);
  };

  const handleExportCoach = () => {
    const coach = allCoaches.find((c) => c.id === selectedCoachId);
    if (!coach) return;
    exportCoachReportToExcel(coach, classes, students, coachEvaluations || []);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">گزارش‌ها و خروجی‌های استاندارد اکسل</h3>
              <p className="text-xs text-slate-500">فیلتر گزارش بر اساس کلاس، معلم، مربی و تجمیعی</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Card 1: گزارش تجمیعی کل مدرسه */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900">خروجی تجمیعی کل مدرسه</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">آمار کامل تمام کلاس‌ها، معلمان و نرخ کلی حضور</p>
            </div>
            <button
              type="button"
              onClick={handleExportOverall}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود اکسل</span>
            </button>
          </div>

          {/* Card 2: گزارش تفکیکی یک کلاس */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900">گزارش بر اساس کلاس</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">ریز جلسات، ماتریس حضور و غیاب و آمار اختصاصی کلاس</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleExportClass}
                className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود</span>
              </button>
            </div>
          </div>

          {/* Card 3: گزارش تفکیکی یک معلم */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900">گزارش بر اساس معلم</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">جلسات تدریس، کلاس‌های فعال و آمار حضور و غیاب هر معلم</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
              >
                {allTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.subjectSpecialty || teacher.subject || 'عمومی'})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleExportTeacher}
                className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود</span>
              </button>
            </div>
          </div>

          {/* Card 4: گزارش تفکیکی مربی تربیتی */}
          {allCoaches.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900">گزارش بر اساس مربی تربیتی</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">کلاس‌های تحت پوشش، لیست دانش‌آموزان و ارزیابی‌ها</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCoachId}
                  onChange={(e) => setSelectedCoachId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
                >
                  {allCoaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.name} ({coach.coachRoleTitle || 'مربی تربیتی'})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleExportCoach}
                  className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود</span>
                </button>
              </div>
            </div>
          )}

          {/* Card 5: نمرات ۴ نوبته */}
          {onOpenAcademicGrades && (
            <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-200 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-indigo-950">دفتر ثبت نمرات ۴ نوبته</h4>
                <p className="text-[11px] text-indigo-800/80 mt-0.5">ثبت نمرات مستمر و پایانی نوبت اول و دوم</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAcademicGrades();
                }}
                className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>ورود به کارنامه</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
