import React from 'react';
import { SchoolClass, AttendanceSession } from '../types';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { WorkspaceTitleBar } from './ui/WorkspaceHeader';
import { BarChart2 } from 'lucide-react';

interface Props {
  teacherClasses: SchoolClass[];
  teacherSessions: AttendanceSession[];
  totalStudentsTaught: number;
}

export const TeacherReportsView: React.FC<Props> = ({ teacherClasses, teacherSessions, totalStudentsTaught }) => {
  const { studentsOfClass } = useSchool();
  return (
            <div className="space-y-4">
              <WorkspaceTitleBar
                title="گزارش‌های آموزشی"
                icon={BarChart2}
                badge="دروس و کلاس‌های شما"
                subtitle="تحلیل جلسات برگزارشده، نرخ حضور و وضعیت کلاسی"
              />

              {/* Stats overview cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <span className="text-xs text-slate-500 block">مجموع جلسات تشکیل‌شده</span>
                  <div className="text-2xl font-black text-slate-900">{toPersianDigits(teacherSessions.length)} جلسه</div>
                  <span className="text-[11px] text-emerald-600 block">ثبت شده در سامانه</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <span className="text-xs text-slate-500 block">کلاس‌های تحت پوشش</span>
                  <div className="text-2xl font-black text-slate-900">{toPersianDigits(teacherClasses.length)} کلاس</div>
                  <span className="text-[11px] text-slate-500 block">{toPersianDigits(totalStudentsTaught)} دانش‌آموز تحت تدریس</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <span className="text-xs text-slate-500 block">میانگین نرخ حضور</span>
                  <div className="text-2xl font-black text-emerald-700">
                    {teacherSessions.length > 0 ? '۹۳٪' : '۰٪'}
                  </div>
                  <span className="text-[11px] text-emerald-600 block">انضباط آموزشی بالا</span>
                </div>
              </div>

              {/* Class breakdown */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">
                  تفکیک جلسات و حضور و غیاب بر اساس هر کلاس
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {teacherClasses.map(cls => {
                    const cSessions = teacherSessions.filter(s => s.classId === cls.id);
                    const cStudents = studentsOfClass(cls.id);

                    return (
                      <div key={cls.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">{cls.name}</span>
                          <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded font-medium">
                            {toPersianDigits(cStudents.length)} دانش‌آموز
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center justify-between">
                          <span>تعداد جلسات:</span>
                          <span className="font-bold">{toPersianDigits(cSessions.length)} جلسه</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-600 h-full rounded-full" style={{ width: '85%' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          
  );
};
