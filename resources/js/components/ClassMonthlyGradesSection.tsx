import React, { useState, useEffect, useMemo } from 'react';
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

interface ClassMonthlyGradesSectionProps {
  classData: SchoolClass;
  onSelectStudent?: (student: Student) => void;
}

export const ClassMonthlyGradesSection: React.FC<ClassMonthlyGradesSectionProps> = ({
  classData,
  onSelectStudent,
}) => {
  const { 
    students, 
    academicSubjects, 
    academicGrades, 
    saveBatchAcademicGrades,
    currentUser,
    isTeacher
  } = useSchool();

  const classStudents = useMemo(() => {
    return students.filter((s) => s.classId === classData.id);
  }, [students, classData.id]);

  // Determine initial subject: if current user is teacher with subject, try matching
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    if (isTeacher && currentUser.subject) {
      const match = academicSubjects.find(s => s.name.includes(currentUser.subject!) || currentUser.subject!.includes(s.name));
      if (match) return match.id;
    }
    return academicSubjects[0]?.id || '';
  });

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
  const activePeriod = MONTHLY_EVALUATION_PERIODS.find((p) => p.key === activePeriodKey) || MONTHLY_EVALUATION_PERIODS[0];

  // Handle score change for a specific student and month
  const handleScoreChange = (studentId: string, periodKey: string, rawValue: string) => {
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
        coefficient: currentSubject.coefficient || 1,
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
    const fullName = `${s.firstName} ${s.lastName} ${s.studentCode}`.toLowerCase();
    return !searchQuery || fullName.includes(searchQuery.toLowerCase());
  });

  // Export to Excel
  const handleExportExcel = () => {
    const data = classStudents.map((stu, idx) => {
      const row: Record<string, any> = {
        'ردیف': idx + 1,
        'کد دانش‌آموزی': stu.studentCode,
        'نام و نام خانوادگی': `${stu.firstName} ${stu.lastName}`,
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
      
      {/* Top Header & Controls Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              دفتر نمرات مستمر ماهانه کلاسی
            </span>
            <span className="text-xs text-slate-300 font-bold">
              {classData.name} ({classData.grade})
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold mt-1 text-white">
            ثبت نمرات مستمر ماه به ماه و ارزشیابی‌های نوبتی
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            امکان ثبت نمره مستمر برای ماه‌های مهر، آبان، آذر، ترم اول، بهمن، اسفند، فروردین، اردیبهشت و ترم دوم
          </p>
        </div>

        {/* Subject Dropdown & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Subject selector */}
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-slate-400 font-bold">انتخاب درس:</span>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              {academicSubjects.map((sub) => (
                <option key={sub.id} value={sub.id} className="bg-slate-900 text-white">
                  {sub.name} (ضریب {toPersianDigits(sub.coefficient)})
                </option>
              ))}
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs font-semibold">
            <button
              onClick={() => setViewMode('single_month')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'single_month' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              ماه به ماه
            </button>
            <button
              onClick={() => setViewMode('full_matrix')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'full_matrix' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              ماتریس کل سال
            </button>
            <button
              onClick={() => setViewMode('monthly_analytics')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'monthly_analytics' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              تحلیل و نمودار رشد
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSaveGrades}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره نمرات مستمر</span>
          </button>
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
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>انتخاب ماه جهت ورود و بررسی نمرات:</span>
            </span>

            {/* Quick Fill actions */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 text-[11px]">درج سریع برای همه:</span>
              <button
                onClick={() => handleQuickFill('20')}
                className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-bold text-[11px] hover:bg-emerald-100 transition cursor-pointer"
              >
                ۲۰
              </button>
              <button
                onClick={() => handleQuickFill('19')}
                className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-md font-bold text-[11px] hover:bg-blue-100 transition cursor-pointer"
              >
                ۱۹
              </button>
              <button
                onClick={() => handleQuickFill('18')}
                className="px-2 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-md font-bold text-[11px] hover:bg-indigo-100 transition cursor-pointer"
              >
                ۱۸
              </button>
              <button
                onClick={() => handleQuickFill('')}
                className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] hover:bg-slate-200 transition cursor-pointer"
              >
                پاک کردن
              </button>
            </div>
          </div>

          {/* Month Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-1.5 text-xs font-semibold">
            {MONTHLY_EVALUATION_PERIODS.map((period) => {
              const isActive = activePeriodKey === period.key;
              const hasGrades = classStudents.some(
                (s) => draftGrades[s.id]?.[period.key] && draftGrades[s.id]?.[period.key] !== ''
              );

              return (
                <button
                  key={period.key}
                  onClick={() => setActivePeriodKey(period.key)}
                  className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-between gap-1 ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold ring-2 ring-emerald-200'
                      : period.term === 1
                        ? 'bg-amber-50/50 hover:bg-amber-100/70 border-amber-200/60 text-slate-800'
                        : 'bg-emerald-50/40 hover:bg-emerald-100/60 border-emerald-200/60 text-slate-800'
                  }`}
                >
                  <div className="text-[10px] opacity-75">
                    {period.term === 1 ? '🍂 نیمسال ۱' : '🌱 نیمسال ۲'}
                  </div>
                  <div className="text-xs font-bold whitespace-nowrap">
                    {period.label}
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-0.5 ${
                    isActive 
                      ? 'bg-white' 
                      : hasGrades 
                        ? 'bg-emerald-500' 
                        : 'bg-slate-200'
                  }`} />
                </button>
              );
            })}
          </div>

          {/* Current Month Quick Stat Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div>
              <div className="text-slate-500 text-[11px]">ماه جاری:</div>
              <div className="font-bold text-slate-900">{activePeriod.label}</div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">میانگین کلاس:</div>
              <div className="font-bold text-emerald-800">
                {activeMonthStats.average !== undefined ? `${toPersianDigits(activeMonthStats.average)} / ۲۰` : 'هنوز ثبت نشده'}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">بالاترین / پایین‌ترین:</div>
              <div className="font-bold text-slate-800">
                {activeMonthStats.highest !== undefined ? `${toPersianDigits(activeMonthStats.highest)} / ${toPersianDigits(activeMonthStats.lowest || 0)}` : '-'}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">توزیع کیفی:</div>
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
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
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
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
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
                      <tr key={stu.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-center font-bold text-slate-400">
                          {toPersianDigits(idx + 1)}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => onSelectStudent && onSelectStudent(stu)}
                            className="font-bold text-slate-900 hover:text-emerald-700 transition cursor-pointer text-right group"
                            title="مشاهده کارنامه و پرونده دانش‌آموز"
                          >
                            <span className="group-hover:underline">{stu.firstName} {stu.lastName}</span>
                          </button>
                          {stu.fatherName && (
                            <div className="text-[10px] text-slate-400">
                              فرزند {stu.fatherName}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max="20"
                              value={scoreStr}
                              onChange={(e) => handleScoreChange(stu.id, activePeriodKey, e.target.value)}
                              placeholder="-"
                              className={`w-20 text-center font-bold text-xs py-1.5 px-2 rounded-lg border focus:ring-2 outline-none ${
                                scoreNum !== undefined
                                  ? scoreNum >= 17
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 focus:ring-emerald-500'
                                    : scoreNum >= 14
                                      ? 'bg-blue-50 border-blue-400 text-blue-950 focus:ring-blue-500'
                                      : scoreNum >= 10
                                        ? 'bg-amber-50 border-amber-400 text-amber-950 focus:ring-amber-500'
                                        : 'bg-rose-50 border-rose-400 text-rose-950 focus:ring-rose-500'
                                  : 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-500'
                              }`}
                            />
                            <span className="text-slate-400 text-[11px] font-mono">/۲۰</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {scoreNum !== undefined ? (
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              scoreNum >= 17 ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' :
                              scoreNum >= 14 ? 'bg-blue-100 text-blue-900 border border-blue-200' :
                              scoreNum >= 12 ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                              'bg-rose-100 text-rose-900 border border-rose-200'
                            }`}>
                              {scoreNum >= 17 ? 'عالی' :
                               scoreNum >= 14 ? 'خوب' :
                               scoreNum >= 12 ? 'متوسط' : 'نیازمند تلاش'}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[11px]">بدون نمره</span>
                          )}
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={notesStr}
                            onChange={(e) => handleScoreChange(stu.id, 'notes', e.target.value)}
                            placeholder="یادداشت معلم..."
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700"
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
                  <th className="p-2 text-center bg-amber-50/80 border-r border-amber-200">مهر</th>
                  <th className="p-2 text-center bg-amber-50/80">آبان</th>
                  <th className="p-2 text-center bg-amber-50/80">آذر</th>
                  <th className="p-2 text-center bg-amber-100/80 font-black">مستمر ۱</th>
                  <th className="p-2 text-center bg-amber-200/60 font-black border-l border-amber-300">پایانی ۱</th>

                  {/* Term 2 Months */}
                  <th className="p-2 text-center bg-emerald-50/80 border-r border-emerald-200">بهمن</th>
                  <th className="p-2 text-center bg-emerald-50/80">اسفند</th>
                  <th className="p-2 text-center bg-emerald-50/80">فروردین</th>
                  <th className="p-2 text-center bg-emerald-50/80">اردیبهشت</th>
                  <th className="p-2 text-center bg-emerald-100/80 font-black">مستمر ۲</th>
                  <th className="p-2 text-center bg-emerald-200/60 font-black border-l border-emerald-300">پایانی ۲</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classStudents.map((stu, idx) => (
                  <tr key={stu.id} className="hover:bg-slate-50 transition">
                    <td className="p-2 text-center font-bold text-slate-400 sticky right-0 bg-white z-10">
                      {toPersianDigits(idx + 1)}
                    </td>
                    <td className="p-2 font-bold text-slate-900 sticky right-10 bg-white z-10">
                      {stu.firstName} {stu.lastName}
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
                            onChange={(e) => handleScoreChange(stu.id, period.key, e.target.value)}
                            placeholder="-"
                            className={`w-14 text-center font-bold text-xs py-1 px-1 rounded border focus:ring-1 outline-none ${
                              val !== '' 
                                ? parseFloat(val) >= 17 
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                  : parseFloat(val) >= 12
                                    ? 'bg-blue-50 border-blue-300 text-blue-950'
                                    : 'bg-rose-50 border-rose-300 text-rose-950'
                                : 'bg-white border-slate-200'
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
                درس: {currentSubject?.name} • ضریب {toPersianDigits(currentSubject?.coefficient || 1)}
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
