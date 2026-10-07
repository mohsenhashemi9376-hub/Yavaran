import { subjectAppliesToClass } from '../utils/courseAssignments';
import React, { useState, useEffect, useMemo } from 'react';
import { scorePillClass, scoreLabel } from '../utils/gradePeriods';
import { summarizeActivity, formatActivitySummary, PERIOD_MONTH } from '../utils/classroomActivity';
import { SchoolClass, Student, AcademicSubject, StudentAcademicGrade, MONTHLY_EVALUATION_PERIODS, MonthlyContinuousKey } from '../types';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits, toEnglishDigits } from '../utils/persianDate';
import { 
  BookOpen, 
  Save, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Sparkles, 
  Calendar, 
  Layers, 
  Filter, 
  Search, 
  AlertCircle,
  FileSpreadsheet,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  AreaChart, 
  Area 
} from 'recharts';
import { studentFullName } from '../utils/studentName';

interface ClassMonthlyGradesSectionProps {
  classData: SchoolClass;
  onSelectStudent?: (student: Student) => void;
  initialSubjectId?: string;
}

export const ClassMonthlyGradesSection: React.FC<ClassMonthlyGradesSectionProps> = ({
  classData,
  onSelectStudent,
  initialSubjectId,
}) => {
  const { 
    students, 
    academicSubjects, 
    academicGrades, 
    saveBatchAcademicGrades,
    currentUser,
    isTeacher,
    isAdmin,
    isEducationalVice,
    canTeachClassAndSubject,
    isGradePeriodOpen,
    sessions
  } = useSchool();

  const classStudents = useMemo(() => {
    return students.filter((s) => s.classId === classData.id);
  }, [students, classData.id]);

  // Determine initial subject: if current user is teacher with subject, try matching
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (initialSubjectId) return initialSubjectId;
    if (isTeacher && currentUser.subject) {
      const match = academicSubjects.find(s => s.name.includes(currentUser.subject!) || currentUser.subject!.includes(s.name));
      if (match) return match.id;
    }
    return academicSubjects[0]?.id || '';
  });

  useEffect(() => {
    if (initialSubjectId) setSelectedSubjectId(initialSubjectId);
  }, [initialSubjectId]);

  // دروس منحصراً مربوط به پایه‌ی کلاس انتخاب‌شده
  // دبیر فقط درس‌های خودش را می‌بیند؛ مدیر و معاون آموزش به همه‌ی دروس دسترسی دارند
  const restrictToOwnSubjects = !isAdmin && !isEducationalVice && (isTeacher || (currentUser.teachingAssignments || []).length > 0);
  const classSubjects = useMemo(
    () =>
      academicSubjects.filter(
        (s) =>
          subjectAppliesToClass(s, classData) &&
          (!restrictToOwnSubjects || canTeachClassAndSubject(classData.id, s.id))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [academicSubjects, classData, restrictToOwnSubjects, currentUser.teachingAssignments]
  );

  useEffect(() => {
    if (classSubjects.length > 0 && !classSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(classSubjects[0].id);
    }
  }, [classSubjects, selectedSubjectId]);

  // Selected Month Key for tabbed entry (default: mehrContinuous)
  const [activePeriodKey, setActivePeriodKey] = useState<MonthlyContinuousKey>('mehrContinuous');
  const [viewMode, setViewMode] = useState<'single_month' | 'full_matrix' | 'monthly_analytics'>('single_month');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavedToast, setIsSavedToast] = useState(false);

  // Local draft of all grades for the selected class & subject
  // key: studentId -> record of monthly fields
  const [draftGrades, setDraftGrades] = useState<Record<string, Record<string, string>>>({});

  // Sync draft whenever classData or selectedSubjectId or academicGrades changes
  useEffect(() => {
    if (!classData.id || !selectedSubjectId) return;

    const newDraft: Record<string, Record<string, string>> = {};

    classStudents.forEach((stu) => {
      const existing = academicGrades.find(
        (g) => g.studentId === stu.id && g.subjectId === selectedSubjectId
      );

      const stuDraft: Record<string, string> = {
        notes: existing?.notes || '',
      };

      MONTHLY_EVALUATION_PERIODS.forEach((p) => {
        const val = existing ? existing[p.key] : undefined;
        stuDraft[p.key] = val !== undefined && val !== null ? val.toString() : '';
      });

      newDraft[stu.id] = stuDraft;
    });

    setDraftGrades(newDraft);
  }, [classData.id, selectedSubjectId, classStudents, academicGrades]);

  const currentSubject = academicSubjects.find((s) => s.id === selectedSubjectId);
  const activeLocked = !isGradePeriodOpen(activePeriodKey);
  const LockedBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
    <span className={`inline-block px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-medium whitespace-nowrap ${className}`}>
      هنوز باز نشده
    </span>
  );
  const activePeriod = MONTHLY_EVALUATION_PERIODS.find((p) => p.key === activePeriodKey) || MONTHLY_EVALUATION_PERIODS[0];

  // Handle score change for a specific student and month
  const handleScoreChange = (studentId: string, periodKey: string, rawValue: string) => {
    if (periodKey !== 'notes' && !isGradePeriodOpen(periodKey)) return;
    const val = toEnglishDigits(rawValue);
    if (periodKey !== 'notes' && val !== '') {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0 || num > 20) return;
    }

    setDraftGrades((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [periodKey]: val,
      },
    }));
  };

  // Quick fill score for all students (e.g. 20, 19, clear)
  const handleQuickFill = (scoreVal: string) => {
    if (!isGradePeriodOpen(activePeriodKey)) return;
    if (confirm(`آیا می‌خواهید نمره «${toPersianDigits(scoreVal || 'خالی')}» برای تمام دانش‌آموزان کلاس در این ماه ثبت شود؟`)) {
      setDraftGrades((prev) => {
        const updated = { ...prev };
        classStudents.forEach((stu) => {
          updated[stu.id] = {
            ...updated[stu.id],
            [activePeriodKey]: scoreVal,
          };
        });
        return updated;
      });
    }
  };

  // Save all grades in this subject & class
  const handleSaveGrades = () => {
    if (!currentSubject) return;

    const gradesToSave: StudentAcademicGrade[] = classStudents.map((stu) => {
      const stuDraft = draftGrades[stu.id] || {};
      const existing = academicGrades.find(
        (g) => g.studentId === stu.id && g.subjectId === selectedSubjectId
      );

      const gradeObj: StudentAcademicGrade = {
        id: existing?.id || `grd-${classData.id}-${stu.id}-${selectedSubjectId}`,
        studentId: stu.id,
        classId: classData.id,
        subjectId: selectedSubjectId,
        subjectName: currentSubject.name,
        teacherName: currentUser.name,
        notes: stuDraft.notes || existing?.notes || '',
        updatedAt: new Date().toISOString(),
      };

      // Populate each monthly key
      MONTHLY_EVALUATION_PERIODS.forEach((p) => {
        const str = stuDraft[p.key];
        if (str !== undefined && str.trim() !== '') {
          const num = parseFloat(str.trim());
          if (!isNaN(num)) {
            gradeObj[p.key] = num;
          }
        } else {
          gradeObj[p.key] = undefined;
        }
      });

      return gradeObj;
    });

    saveBatchAcademicGrades(gradesToSave);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  // Compute monthly class statistics for the active month
  const activeMonthStats = useMemo(() => {
    const scores: number[] = [];
    classStudents.forEach((stu) => {
      const valStr = draftGrades[stu.id]?.[activePeriodKey];
      if (valStr && valStr.trim() !== '') {
        const num = parseFloat(valStr.trim());
        if (!isNaN(num)) scores.push(num);
      }
    });

    if (scores.length === 0) {
      return {
        count: 0,
        average: undefined,
        highest: undefined,
        lowest: undefined,
        excellentCount: 0, // >= 17
        goodCount: 0, // 14 - 16.99
        averageCount: 0, // 12 - 13.99
        weakCount: 0, // < 12
      };
    }

    const sum = scores.reduce((a, b) => a + b, 0);
    const average = Math.round((sum / scores.length) * 100) / 100;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);

    let excellentCount = 0;
    let goodCount = 0;
    let averageCount = 0;
    let weakCount = 0;

    scores.forEach((s) => {
      if (s >= 17) excellentCount++;
      else if (s >= 14) goodCount++;
      else if (s >= 12) averageCount++;
      else weakCount++;
    });

    return {
      count: scores.length,
      average,
      highest,
      lowest,
      excellentCount,
      goodCount,
      averageCount,
      weakCount,
    };
  }, [classStudents, draftGrades, activePeriodKey]);

  // Compute monthly trend for this class & subject (Mehr through Khordad)
  const monthlyTrendData = useMemo(() => {
    return MONTHLY_EVALUATION_PERIODS.map((period) => {
      const scores: number[] = [];
      classStudents.forEach((stu) => {
        const valStr = draftGrades[stu.id]?.[period.key];
        if (valStr && valStr.trim() !== '') {
          const num = parseFloat(valStr.trim());
          if (!isNaN(num)) scores.push(num);
        }
      });

      const avg = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : null;

      return {
        key: period.key,
        monthName: period.shortLabel,
        fullLabel: period.label,
        average: avg,
        recordedCount: scores.length,
      };
    });
  }, [classStudents, draftGrades]);

  // Filter students for display
  const filteredStudents = classStudents.filter((s) => {
    const fullName = `${studentFullName(s)} ${s.studentCode}`.toLowerCase();
    return !searchQuery || fullName.includes(searchQuery.toLowerCase());
  });

  // Export to Excel
  const handleExportExcel = () => {
    const data = classStudents.map((stu, idx) => {
      const row: Record<string, any> = {
        'ردیف': idx + 1,
        'کد دانش‌آموزی': stu.studentCode,
        'نام و نام خانوادگی': `${studentFullName(stu)}`,
        'کلاس': classData.name,
        'درس': currentSubject?.name || 'نامشخص',
      };

      MONTHLY_EVALUATION_PERIODS.forEach((p) => {
        const val = draftGrades[stu.id]?.[p.key];
        row[p.label] = val && val.trim() !== '' ? parseFloat(val) : '-';
      });

      row['یادداشت دبیر'] = draftGrades[stu.id]?.notes || '-';
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نمرات مستمر ماهانه');
    XLSX.writeFile(wb, `نمرات_مستمر_${classData.name}_${currentSubject?.name || 'درس'}.xlsx`);
  };

  return (
    <div className="space-y-4 font-['Vazirmatn',sans-serif]">
      
      {/* نوار کنترل: انتخاب درس، حالت نمایش، ذخیره */}
      <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/60 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h3 className="text-lg font-extrabold text-slate-900">دفتر نمرات</h3>
          <button
            onClick={handleSaveGrades}
            className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره نمرات</span>
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="h-11 bg-slate-50 rounded-xl px-4 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer min-w-48"
            aria-label="انتخاب درس"
          >
            {classSubjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>

          <div className="flex bg-slate-100 p-1 rounded-xl text-sm font-bold">
            {([
              ['single_month', 'ماه به ماه'],
              ['full_matrix', 'کل سال'],
              ['monthly_analytics', 'نمودار رشد'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg transition cursor-pointer ${
                  viewMode === mode ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {isSavedToast && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>نمرات مستمر درس {currentSubject?.name} با موفقیت در سامانه ذخیره شدند.</span>
          </div>
          <span className="text-[11px] text-emerald-100">تحلیل ماهانه به‌روز شد</span>
        </div>
      )}

      {/* Month Selection Bar (When in single_month mode) */}
      {viewMode === 'single_month' && (
        <div className="bg-white rounded-2xl p-4 shadow-sm shadow-slate-200/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>انتخاب ماه جهت ورود و بررسی نمرات:</span>
            </span>

            {/* Quick Fill actions */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px]">درج سریع برای همه:</span>
              <button
                disabled={activeLocked}
                onClick={() => handleQuickFill('20')}
                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[11px] hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                ۲۰
              </button>
              <button
                disabled={activeLocked}
                onClick={() => handleQuickFill('19')}
                className="px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg font-bold text-[11px] hover:bg-teal-100 transition-colors cursor-pointer"
              >
                ۱۹
              </button>
              <button
                disabled={activeLocked}
                onClick={() => handleQuickFill('18')}
                className="px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg font-bold text-[11px] hover:bg-sky-100 transition-colors cursor-pointer"
              >
                ۱۸
              </button>
              <button
                disabled={activeLocked}
                onClick={() => handleQuickFill('')}
                className="px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg font-bold text-[11px] hover:bg-rose-100 transition-colors cursor-pointer"
              >
                پاک کردن
              </button>
            </div>
          </div>

          {/* Month Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {MONTHLY_EVALUATION_PERIODS.filter((p) => !p.key.endsWith('Final')).map((period) => {
              const isActive = activePeriodKey === period.key;
              const title = period.key === 'term1Continuous' ? 'ترم اول' : period.key === 'term2Continuous' ? 'ترم دوم' : period.monthName;
              return (
                <button
                  key={period.key}
                  onClick={() => setActivePeriodKey(period.key)}
                  className={`h-11 px-5 rounded-xl text-sm font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{title}</span>
                  {!isGradePeriodOpen(period.key) && (
                    <span className="mr-1.5 inline-block px-1.5 py-0.5 rounded-full bg-slate-200/70 text-slate-500 text-[9px] font-medium align-middle">بسته</span>
                  )}
                </button>
              );
            })}
          </div>

          {activeLocked && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-600 flex items-center gap-2 flex-wrap">
              <LockedBadge />
              <span>ثبت نمره این بازه هنوز توسط معاونت آموزش فعال نشده است؛ فیلدها فقط‌خواندنی هستند.</span>
            </div>
          )}

          {/* Current Month Quick Stat Bar */}
          <div className="bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 border border-slate-200/80 rounded-2xl p-3 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
            <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-2xs">
              <div className="text-slate-500 text-[11px] mb-0.5">ماه جاری:</div>
              <div className="font-bold text-slate-900">{activePeriod.label}</div>
            </div>
            <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-2xs">
              <div className="text-slate-500 text-[11px] mb-0.5">میانگین کلاس:</div>
              <div className="font-bold text-emerald-800">
                {activeMonthStats.average !== undefined ? `${toPersianDigits(activeMonthStats.average)} / ۲۰` : 'هنوز ثبت نشده'}
              </div>
            </div>
            <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-2xs">
              <div className="text-slate-500 text-[11px] mb-0.5">بالاترین / پایین‌ترین:</div>
              <div className="font-bold text-slate-800">
                {activeMonthStats.highest !== undefined ? `${toPersianDigits(activeMonthStats.highest)} / ${toPersianDigits(activeMonthStats.lowest || 0)}` : '-'}
              </div>
            </div>
            <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-2xs">
              <div className="text-slate-500 text-[11px] mb-0.5">توزیع کیفی:</div>
              <div className="font-bold text-slate-800">
                {activeMonthStats.count > 0 ? (
                  <span className="text-[11px]">
                    <strong className="text-emerald-700">{toPersianDigits(activeMonthStats.excellentCount)} عالی</strong> • {toPersianDigits(activeMonthStats.weakCount)} نیازمند تلاش
                  </span>
                ) : '-'}
              </div>
            </div>
            <div className="flex items-center justify-end">
              <button
                onClick={handleExportExcel}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>خروجی اکسل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 1: Single Month Entry Table */}
      {viewMode === 'single_month' && (
        <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/60 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                لیست نمرات مستمر: {activePeriod.label} • درس {currentSubject?.name}
              </h4>
              <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                {toPersianDigits(filteredStudents.length)} دانش‌آموز
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی نام دانش‌آموز..."
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none w-44 sm:w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/70 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12 text-center">ردیف</th>
                  <th className="p-3">نام و نام خانوادگی</th>
                  <th className="p-3 text-center w-36">نمره {activePeriod.shortLabel} (۰ تا ۲۰)</th>
                  <th className="p-3 text-center w-32">ارزیابی کیفی</th>
                  <th className="p-3">یادداشت دبیر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      دانش‌آموزی یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((stu, idx) => {
                    const scoreStr = draftGrades[stu.id]?.[activePeriodKey] || '';
                    const scoreNum = scoreStr ? parseFloat(scoreStr) : undefined;
                    const notesStr = draftGrades[stu.id]?.notes || '';

                    return (
                      <tr key={stu.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="p-3 text-center font-bold text-slate-600">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => onSelectStudent && onSelectStudent(stu)}
                            className="font-bold text-slate-800 hover:text-emerald-700 transition cursor-pointer text-right group"
                            title="مشاهده کارنامه و پرونده دانش‌آموز"
                          >
                            <span className="group-hover:underline">{studentFullName(stu)}</span>
                          </button>
                          {stu.fatherName && (
                            <div className="text-[10px] text-slate-400">
                              فرزند {stu.fatherName}
                            </div>
                          )}
                          {(() => {
                            const sum = summarizeActivity(sessions, stu.id, {
                              classId: classData.id,
                              subjectId: selectedSubjectId,
                              subjectName: currentSubject?.name,
                              month: PERIOD_MONTH[activePeriodKey],
                            });
                            return sum.total > 0 ? (
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold whitespace-nowrap" title="خلاصه فعالیت و تکالیف کلاسی این ماه">
                                {formatActivitySummary(sum)}
                              </span>
                            ) : null;
                          })()}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="20"
                              value={scoreStr}
                              disabled={activeLocked}
                              onChange={(e) => handleScoreChange(stu.id, activePeriodKey, e.target.value)}
                              placeholder="-"
                              className="w-20 text-center font-bold text-sm py-1.5 px-2 rounded-xl border border-slate-200 bg-slate-50/60 text-slate-900 outline-none transition focus:ring-2 focus:ring-emerald-400/25 focus:border-emerald-500 focus:bg-white disabled:bg-slate-100/70 disabled:text-slate-400 disabled:cursor-not-allowed"
                            />
                            <span className="text-slate-400 text-[11px] font-mono">/۲۰</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {scoreNum !== undefined ? (
                            <span className={`px-3 py-1 rounded-xl text-[11px] whitespace-nowrap ${scorePillClass(scoreNum)}`}>
                              {scoreLabel(scoreNum)}
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-xl text-[11px] bg-slate-100/70 border border-slate-200/70 text-slate-400 whitespace-nowrap">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={notesStr}
                            onChange={(e) => handleScoreChange(stu.id, 'notes', e.target.value)}
                            placeholder="یادداشت دبیر (اختیاری)..."
                            className="w-full text-xs bg-slate-50/60 border border-slate-200 rounded-xl px-3 py-2 placeholder:text-slate-400 text-slate-700 outline-none transition focus:ring-2 focus:ring-emerald-400/25 focus:border-emerald-500 focus:bg-white"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mode 2: Full Matrix (All months in single table) */}
      {viewMode === 'full_matrix' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-3">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                ماتریس جامع سالانه نمرات مستمر • درس {currentSubject?.name}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                مشاهده و ویرایش کلیه نمرات مستمر ماه‌ها و نوبت‌ها به صورت یکپارچه
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>خروجی اکسل ماتریس</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-10 text-center sticky right-0 bg-slate-100 z-10">ردیف</th>
                  <th className="p-2.5 sticky right-10 bg-slate-100 z-10">دانش‌آموز</th>
                  
                  {/* Term 1 Months */}
                  <th className="p-2 text-center bg-amber-50/80 border-r border-amber-200">مهر{!isGradePeriodOpen('mehrContinuous') && <LockedBadge className="block mt-0.5" />}</th>
                  <th className="p-2 text-center bg-amber-50/80">آبان{!isGradePeriodOpen('abanContinuous') && <LockedBadge className="block mt-0.5" />}</th>
                  <th className="p-2 text-center bg-amber-50/80">آذر{!isGradePeriodOpen('azarContinuous') && <LockedBadge className="block mt-0.5" />}</th>
                  <th className="p-2 text-center bg-amber-100/80 font-black">مستمر ۱{!isGradePeriodOpen('term1Continuous') && <LockedBadge className="block mt-0.5" />}</th>
                  <th className="p-2 text-center bg-amber-200/60 font-black border-l border-amber-300">پایانی ۱{!isGradePeriodOpen('term1Final') && <LockedBadge className="block mt-0.5" />}</th>

                  {/* Term 2 Months */}
                  <th className="p-2 text-center bg-emerald-50/80 border-r border-emerald-200">بهمن{!isGradePeriodOpen('bahmanContinuous') && <LockedBadge className="block mt-0.5" />}</th>
                  <th className="p-2 text-center bg-emerald-50/80">اسفند{!isGradePeriodOpen('esfandContinuous') && <LockedBadge className="block mt-0.5" />}</th>
                  <th className="p-2 text-center bg-emerald-50/80">فروردین{!isGradePeriodOpen('farvardinContinuous') && <LockedBadge className="block mt-0.5" />}</th>
                  <th className="p-2 text-center bg-emerald-50/80">اردیبهشت{!isGradePeriodOpen('ordibeheshtContinuous') && <LockedBadge className="block mt-0.5" />}</th>
                  <th className="p-2 text-center bg-emerald-100/80 font-black">مستمر ۲{!isGradePeriodOpen('term2Continuous') && <LockedBadge className="block mt-0.5" />}</th>
                  <th className="p-2 text-center bg-emerald-200/60 font-black border-l border-emerald-300">پایانی ۲{!isGradePeriodOpen('term2Final') && <LockedBadge className="block mt-0.5" />}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classStudents.map((stu, idx) => (
                  <tr key={stu.id} className="hover:bg-slate-50 transition">
                    <td className="p-2 text-center font-bold text-slate-400 sticky right-0 bg-white z-10">
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td className="p-2 font-bold text-slate-900 sticky right-10 bg-white z-10">
                      {studentFullName(stu)}
                    </td>

                    {/* Inputs for each period */}
                    {MONTHLY_EVALUATION_PERIODS.map((period) => {
                      const val = draftGrades[stu.id]?.[period.key] || '';
                      return (
                        <td key={period.key} className="p-1.5 text-center">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            max="20"
                            value={val}
                            disabled={!isGradePeriodOpen(period.key)}
                            title={!isGradePeriodOpen(period.key) ? 'هنوز باز نشده' : undefined}
                            onChange={(e) => handleScoreChange(stu.id, period.key, e.target.value)}
                            placeholder="-"
                            className={`w-14 text-center text-xs py-1 px-1 rounded-xl focus:ring-2 focus:ring-emerald-200 outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                              val !== '' ? scorePillClass(parseFloat(val)) : 'bg-slate-100/70 border border-slate-200/70 text-slate-400'
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mode 3: Monthly Analytics & Class Growth Chart */}
      {viewMode === 'monthly_analytics' && (
        <div className="space-y-4">
          {/* Chart Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">
                    نمودار روند میانگین نمرات ماهانه کلاس {classData.name}
                  </h4>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  روند تغییرات میانگین درس {currentSubject?.name} از مهر تا خرداد
                </p>
              </div>

              <div className="text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-xl">
                درس: {currentSubject?.name}
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="classMonthlyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="monthName" 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                  />
                  <YAxis 
                    domain={[0, 20]} 
                    ticks={[0, 5, 10, 12, 14, 17, 20]} 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs font-['Vazirmatn'] border border-slate-700">
                            <div className="font-bold text-emerald-400">{d.fullLabel}</div>
                            <div className="mt-1">
                              میانگین کلاس: <strong className="text-white">{d.average !== null ? `${toPersianDigits(d.average)} از ۲۰` : 'ثبت نشده'}</strong>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              تعداد نمرات ثبت شده: {toPersianDigits(d.recordedCount)} نفر
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="average" 
                    stroke="#059669" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#classMonthlyGrad)" 
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Trend Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2 pt-2 border-t border-slate-100 text-xs">
              {monthlyTrendData.map((d) => (
                <div key={d.key} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-slate-500 font-medium">{d.monthName}</div>
                  <div className={`text-xs font-bold mt-1 ${
                    d.average !== null
                      ? d.average >= 17 ? 'text-emerald-700' : d.average >= 14 ? 'text-blue-700' : 'text-slate-800'
                      : 'text-slate-400'
                  }`}>
                    {d.average !== null ? toPersianDigits(d.average) : '-'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
