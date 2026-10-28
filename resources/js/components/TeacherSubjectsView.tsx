import React from 'react';
import { SchoolClass } from '../types';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { WorkspaceTitleBar } from './ui/WorkspaceHeader';
import { BookOpen } from 'lucide-react';

interface Props {
  subjectGroups: { subjectName: string; classes: SchoolClass[] }[];
  onOpenClassDetail: (cls: SchoolClass) => void;
  onOpenNewAttendance: (classId?: string, subject?: string) => void;
}

export const TeacherSubjectsView: React.FC<Props> = ({ subjectGroups, onOpenClassDetail, onOpenNewAttendance }) => {
  const { studentsOfClass } = useSchool();
  return (
            <div className="space-y-5">
              <WorkspaceTitleBar
                title="دروس تدریسی من"
                icon={BookOpen}
                badge={`${toPersianDigits(subjectGroups.length)} عنوان درسی`}
                subtitle="عناوین دروس و کلاس‌های مرتبط با هر درس"
              />

              <div className="space-y-4">
                {subjectGroups.map((group, gIdx) => {
                  const totalGroupStudents = group.classes.reduce((sum, c) => {
                    return sum + studentsOfClass(c.id).length;
                  }, 0);

                  return (
                    <div key={gIdx} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-amber-100 text-amber-900 font-black text-sm rounded-lg border border-amber-200">
                            درس: {group.subjectName}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({toPersianDigits(group.classes.length)} کلاس • {toPersianDigits(totalGroupStudents)} دانش‌آموز)
                          </span>
                        </div>
                      </div>

                      {group.classes.length === 0 ? (
                        <div className="text-xs text-slate-400 py-3 text-center">
                          هنوز کلاسی برای این عنوان درسی ثبت نشده است.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {group.classes.map((cls) => {
                            const cStudents = studentsOfClass(cls.id);
                            return (
                              <div key={cls.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 text-xs">{cls.name}</span>
                                  <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    پایه {cls.grade}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {toPersianDigits(cStudents.length)} دانش‌آموز
                                </div>
                                <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200">
                                  <button
                                    onClick={() => onOpenClassDetail(cls)}
                                    className="flex-1 min-h-11 text-xs bg-white hover:bg-emerald-50 text-emerald-800 font-bold rounded-xl border border-slate-200 transition cursor-pointer"
                                  >
                                    ورود
                                  </button>
                                  <button
                                    onClick={() => onOpenNewAttendance(cls.id)}
                                    className="flex-1 min-h-11 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer"
                                  >
                                    حضور و غیاب
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          
  );
};
