import React from 'react';
import { SchoolClass, Student } from '../types';
import { ClassMonthlyGradesSection } from './ClassMonthlyGradesSection';
import { ClassGradeAnalytics } from './ClassGradeAnalytics';
import { WorkspaceTitleBar, HeaderAction } from './ui/WorkspaceHeader';
import { BarChart2, Award, ArrowUpRight } from 'lucide-react';

interface Props {
  gradeClasses: SchoolClass[];
  currentGradeClass?: SchoolClass;
  selectedClassForMonthlyGrades: string;
  setSelectedClassForMonthlyGrades: (id: string) => void;
  showGradeAnalytics: boolean;
  setShowGradeAnalytics: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenAcademicGrades?: (classId?: string, subjectId?: string) => void;
  onSelectStudent?: (student: Student) => void;
}

export const TeacherGradesView: React.FC<Props> = ({ gradeClasses, currentGradeClass, selectedClassForMonthlyGrades, setSelectedClassForMonthlyGrades, showGradeAnalytics, setShowGradeAnalytics, onOpenAcademicGrades, onSelectStudent }) => {
  return (
            <div className="space-y-4">
              {/* Class selector banner */}
              <WorkspaceTitleBar
                title="ثبت نمره"
                icon={Award}
                subtitle="دفتر نمرات مستمر ماهانه کلاس‌های شما؛ مهر تا اردیبهشت"
                actions={(
                  <>
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
                    {onOpenAcademicGrades && (
                      <HeaderAction variant="primary" icon={ArrowUpRight} label="ورود به فرم نمرات" onClick={() => onOpenAcademicGrades(selectedClassForMonthlyGrades)} className="!h-11" />
                    )}
                  </>
                )}
              />

              {currentGradeClass ? (
                <>
                  {/* موبایل: تحلیل کلاس پیش‌فرض بسته است تا فرم نمره بالاتر دیده شود */}
                  <button
                    type="button"
                    onClick={() => setShowGradeAnalytics((v) => !v)}
                    aria-expanded={showGradeAnalytics}
                    className="md:hidden w-full min-h-12 rounded-2xl border border-slate-200 bg-white shadow-sm px-4 text-sm font-extrabold text-slate-800 inline-flex items-center justify-between cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2"><BarChart2 className="w-4 h-4 text-emerald-700" />تحلیل نمرات کلاس</span>
                    <span className="text-xs font-bold text-emerald-700">{showGradeAnalytics ? 'بستن' : 'نمایش'}</span>
                  </button>
                  <div className={showGradeAnalytics ? '' : 'hidden md:block'}>
                    <ClassGradeAnalytics classData={currentGradeClass} />
                  </div>
                  <ClassMonthlyGradesSection
                    classData={currentGradeClass}
                    onSelectStudent={onSelectStudent}
                  />
                </>
              ) : (
                <div className="bg-white p-8 rounded-2xl border text-center text-slate-500">
                  هیچ کلاسی در دسترس نیست.
                </div>
              )}
            </div>
          
  );
};
