import React from 'react';
import { AttendanceSession, SchoolClass, Student, StudentAttendanceRecord } from '../types';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { WorkspaceTitleBar } from './ui/WorkspaceHeader';
import { ChevronLeft, Award } from 'lucide-react';
import { studentFullName } from '../utils/studentName';
import { FitTable } from './ui/FitTable';

interface Props {
  gradeClasses: SchoolClass[];
  currentGradeClass?: SchoolClass;
  selectedClassForMonthlyGrades: string;
  setSelectedClassForMonthlyGrades: (id: string) => void;
  onOpenAcademicGrades?: (classId?: string, subjectId?: string) => void;
  teacherSessions: AttendanceSession[];
  onSelectStudent?: (student: Student) => void;
}

export const TeacherReportCardsView: React.FC<Props> = ({ gradeClasses, currentGradeClass, selectedClassForMonthlyGrades, setSelectedClassForMonthlyGrades, onOpenAcademicGrades, teacherSessions, onSelectStudent }) => {
  const { studentsOfClass } = useSchool();
  return (
            <div className="space-y-4">
              <WorkspaceTitleBar
                title="کارنامه و نمرات"
                icon={Award}
                subtitle="وضعیت تحصیلی، غیبت‌ها و پرونده انضباطی دانش‌آموزان کلاس‌های شما"
                actions={(
                  <select
                    value={selectedClassForMonthlyGrades}
                    onChange={(e) => setSelectedClassForMonthlyGrades(e.target.value)}
                    aria-label="کلاس"
                    className="min-h-11 text-xs bg-slate-50 text-slate-900 border border-slate-200 font-bold rounded-xl px-3 outline-none cursor-pointer"
                  >
                    {gradeClasses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              />

              {currentGradeClass ? (() => {
                const classStudents = studentsOfClass(currentGradeClass.id);
                return (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        لیست دانش‌آموزان کلاس {currentGradeClass.name} ({toPersianDigits(classStudents.length)} نفر)
                      </span>
                      {onOpenAcademicGrades && (
                        <button
                          onClick={() => onOpenAcademicGrades(currentGradeClass.id)}
                          className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>مشاهده دفتر نمرات جامع</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <FitTable className="">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <th className="p-3 font-bold">ردیف</th>
                            <th className="p-3 font-bold">نام و نام خانوادگی</th>
                            <th className="p-3 font-bold text-center">غیبت در جلسات شما</th>
                            <th className="p-3 font-bold text-center">عملیات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {classStudents.map((std, idx) => {
                            const studentAbsences = teacherSessions
                              .filter(s => s.classId === currentGradeClass.id)
                              .filter(s => {
                                const recs: StudentAttendanceRecord[] = Object.values(s.records || {});
                                return recs.some(r => r.studentId === std.id && r.status === 'absent');
                              })
                              .length;

                            return (
                              <tr key={std.id} className="hover:bg-slate-50/80 transition">
                                <td className="p-3 font-mono text-slate-400">{toPersianDigits(idx + 1)}</td>
                                <td className="p-3 font-bold text-slate-900">
                                  {studentFullName(std)}
                                </td>
                                <td className="p-3 text-center">
                                  {studentAbsences > 0 ? (
                                    <span className="text-rose-600 font-bold">{toPersianDigits(studentAbsences)} جلسه</span>
                                  ) : (
                                    <span className="text-emerald-600 font-bold">بدون غیبت</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {onSelectStudent && (
                                      <button
                                        onClick={() => onSelectStudent(std)}
                                        className="px-2.5 py-1 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg transition cursor-pointer"
                                      >
                                        مشاهده پرونده
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </FitTable>
                  </div>
                );
              })() : null}
            </div>
          
  );
};
