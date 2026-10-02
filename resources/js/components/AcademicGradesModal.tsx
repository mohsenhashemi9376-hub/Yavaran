import { subjectAppliesToClass } from '../utils/courseAssignments';
import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student, StudentAcademicGrade, AcademicSubject } from '../types';
import { toPersianDigits, toEnglishDigits } from '../utils/persianDate';
import { calculateAnnualScore, analyzeSubjectGrade } from '../utils/academicAnalysis';
import { 
  X, 
  BookOpen, 
  GraduationCap, 
  Save, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Award, 
  Users, 
  Plus, 
  Calculator, 
  Search,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AcademicGradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClassId?: string;
  initialSubjectId?: string;
  onSelectStudent?: (student: Student) => void;
}

export const AcademicGradesModal: React.FC<AcademicGradesModalProps> = ({
  isOpen,
  onClose,
  initialClassId,
  initialSubjectId,
  onSelectStudent,
}) => {
  const { 
    classes, 
    students, 
    academicSubjects, 
    academicGrades, 
    saveBatchAcademicGrades, 
    addAcademicSubject 
  } = useSchool();

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavedToast, setIsSavedToast] = useState(false);

  // Local working state for the grades being edited
  // Map of studentId -> Partial<StudentAcademicGrade>
  const [gradesDraft, setGradesDraft] = useState<Record<string, {
    c1?: string;
    f1?: string;
    c2?: string;
    f2?: string;
    notes?: string;
  }>>({});

  // New subject creation inline
  const [showNewSubjectForm, setShowNewSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  // Initialize selected class & subject
  useEffect(() => {
    if (isOpen) {
      if (initialClassId && classes.some(c => c.id === initialClassId)) {
        setSelectedClassId(initialClassId);
      } else if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
      }

      if (initialSubjectId && academicSubjects.some(s => s.id === initialSubjectId)) {
        setSelectedSubjectId(initialSubjectId);
      } else if (academicSubjects.length > 0) {
        setSelectedSubjectId(academicSubjects[0].id);
      }
    }
  }, [isOpen, initialClassId, initialSubjectId, classes, academicSubjects]);

  // دروس منحصراً مربوط به پایه‌ی کلاس انتخاب‌شده
  const classSubjects = React.useMemo(() => {
    const cls = classes.find((c) => c.id === selectedClassId);
    return cls ? academicSubjects.filter((s) => subjectAppliesToClass(s, cls)) : academicSubjects;
  }, [academicSubjects, classes, selectedClassId]);

  useEffect(() => {
    if (classSubjects.length > 0 && !classSubjects.some((s) => s.id === selectedSubjectId)) {
      setSelectedSubjectId(classSubjects[0].id);
    }
  }, [classSubjects, selectedSubjectId]);

  // Load existing grades into draft when class or subject changes
  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId) return;

    const classStudents = students.filter(s => s.classId === selectedClassId);
    const draft: Record<string, { c1?: string; f1?: string; c2?: string; f2?: string; notes?: string }> = {};

    classStudents.forEach(stu => {
      const existing = academicGrades.find(
        g => g.studentId === stu.id && g.subjectId === selectedSubjectId
      );
      if (existing) {
        draft[stu.id] = {
          c1: existing.term1Continuous !== undefined ? existing.term1Continuous.toString() : '',
          f1: existing.term1Final !== undefined ? existing.term1Final.toString() : '',
          c2: existing.term2Continuous !== undefined ? existing.term2Continuous.toString() : '',
          f2: existing.term2Final !== undefined ? existing.term2Final.toString() : '',
          notes: existing.notes || '',
        };
      } else {
        draft[stu.id] = { c1: '', f1: '', c2: '', f2: '', notes: '' };
      }
    });

    setGradesDraft(draft);
  }, [selectedClassId, selectedSubjectId, students, academicGrades]);

  if (!isOpen) return null;

  const currentClass = classes.find(c => c.id === selectedClassId);
  const currentSubject = academicSubjects.find(s => s.id === selectedSubjectId);
  const classStudents = students.filter(s => s.classId === selectedClassId);

  const filteredStudents = classStudents.filter(s => {
    if (!searchQuery) return true;
    const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
    const code = s.studentCode.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || code.includes(searchQuery);
  });

  const handleScoreChange = (
    studentId: string, 
    field: 'c1' | 'f1' | 'c2' | 'f2' | 'notes', 
    rawVal: string
  ) => {
    const val = toEnglishDigits(rawVal);
    // If number, ensure it's within 0-20
    if (field !== 'notes' && val !== '') {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0 || num > 20) {
        return; // Don't accept invalid range
      }
    }

    setGradesDraft(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: val,
      }
    }));
  };

  const handleSaveAll = () => {
    if (!selectedClassId || !selectedSubjectId || !currentSubject) return;

    const gradesToSave: StudentAcademicGrade[] = classStudents.map(stu => {
      const draft = gradesDraft[stu.id] || {};
      const c1 = draft.c1 && draft.c1.trim() !== '' ? parseFloat(draft.c1) : undefined;
      const f1 = draft.f1 && draft.f1.trim() !== '' ? parseFloat(draft.f1) : undefined;
      const c2 = draft.c2 && draft.c2.trim() !== '' ? parseFloat(draft.c2) : undefined;
      const f2 = draft.f2 && draft.f2.trim() !== '' ? parseFloat(draft.f2) : undefined;

      const existing = academicGrades.find(
        g => g.studentId === stu.id && g.subjectId === selectedSubjectId
      );

      return {
        id: existing ? existing.id : `grd-${stu.id}-${selectedSubjectId}`,
        studentId: stu.id,
        classId: selectedClassId,
        subjectId: selectedSubjectId,
        subjectName: currentSubject.name,
        term1Continuous: c1,
        term1Final: f1,
        term2Continuous: c2,
        term2Final: f2,
        notes: draft.notes,
        teacherName: currentSubject.defaultTeacherName,
        updatedAt: new Date().toISOString(),
      };
    });

    saveBatchAcademicGrades(gradesToSave);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const newId = addAcademicSubject({
      name: newSubjectName.trim(),
      coefficient: 1,
    });
    setSelectedSubjectId(newId);
    setNewSubjectName('');
    setShowNewSubjectForm(false);
  };

  // Calculate Class Metrics for current view
  let totalC1 = 0, countC1 = 0;
  let totalF1 = 0, countF1 = 0;
  let totalC2 = 0, countC2 = 0;
  let totalF2 = 0, countF2 = 0;
  let totalAnnual = 0, countAnnual = 0;

  classStudents.forEach(stu => {
    const draft = gradesDraft[stu.id] || {};
    const c1 = draft.c1 ? parseFloat(draft.c1) : undefined;
    const f1 = draft.f1 ? parseFloat(draft.f1) : undefined;
    const c2 = draft.c2 ? parseFloat(draft.c2) : undefined;
    const f2 = draft.f2 ? parseFloat(draft.f2) : undefined;

    if (c1 !== undefined && !isNaN(c1)) { totalC1 += c1; countC1++; }
    if (f1 !== undefined && !isNaN(f1)) { totalF1 += f1; countF1++; }
    if (c2 !== undefined && !isNaN(c2)) { totalC2 += c2; countC2++; }
    if (f2 !== undefined && !isNaN(f2)) { totalF2 += f2; countF2++; }

    const ann = calculateAnnualScore(c1, f1, c2, f2);
    if (ann !== undefined && !isNaN(ann)) { totalAnnual += ann; countAnnual++; }
  });

  const avgC1 = countC1 > 0 ? (totalC1 / countC1).toFixed(2) : '-';
  const avgF1 = countF1 > 0 ? (totalF1 / countF1).toFixed(2) : '-';
  const avgC2 = countC2 > 0 ? (totalC2 / countC2).toFixed(2) : '-';
  const avgF2 = countF2 > 0 ? (totalF2 / countF2).toFixed(2) : '-';
  const avgAnnual = countAnnual > 0 ? (totalAnnual / countAnnual).toFixed(2) : '-';

  // Export to Excel
  const handleExportExcel = () => {
    if (!currentClass || !currentSubject) return;

    const data = classStudents.map((stu, idx) => {
      const draft = gradesDraft[stu.id] || {};
      const c1 = draft.c1 ? parseFloat(draft.c1) : undefined;
      const f1 = draft.f1 ? parseFloat(draft.f1) : undefined;
      const c2 = draft.c2 ? parseFloat(draft.c2) : undefined;
      const f2 = draft.f2 ? parseFloat(draft.f2) : undefined;
      const ann = calculateAnnualScore(c1, f1, c2, f2);

      return {
        'ردیف': idx + 1,
        'کد دانش‌آموزی': stu.studentCode,
        'نام و نام خانوادگی': `${stu.firstName} ${stu.lastName}`,
        'نام پدر': stu.fatherName || '-',
        'مستمر نوبت اول': c1 !== undefined ? c1 : '',
        'پایانی نوبت اول': f1 !== undefined ? f1 : '',
        'مستمر نوبت دوم': c2 !== undefined ? c2 : '',
        'پایانی نوبت دوم': f2 !== undefined ? f2 : '',
        'نمره سالانه رسمی': ann !== undefined ? ann : '',
        'وضعیت': ann !== undefined ? (ann >= 10 ? 'قبول' : 'تجدید') : '',
        'ملاحظات': draft.notes || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ریز نمرات');
    XLSX.writeFile(workbook, `ریز_نمرات_${currentSubject.name}_${currentClass.name}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Top Header */}
        <div className="bg-linear-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs">
              <GraduationCap className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">
                  دفتر ثبت نمرات ۴ نوبته (معاونت آموزش)
                </h2>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                  مستمر و امتحانات ترم
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                ورود نمرات مستمر اول، پایانی اول، مستمر دوم و پایانی دوم به همراه محاسبه خودکار نمره سالانه
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              title="خروجی اکسل استاندارد"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
              <span>خروجی اکسل</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Toolbar & Selectors */}
        <div className="bg-slate-50 border-b border-slate-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            
            {/* Class Selector */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                انتخاب کلاس:
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Selector */}
            <div className="sm:col-span-5">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  انتخاب درس:
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewSubjectForm(!showNewSubjectForm)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ افزودن درس جدید</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {classSubjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} {sub.defaultTeacherName ? `- ${sub.defaultTeacherName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Filter */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                جستجوی دانش‌آموز:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="نام یا کد دانش‌آموزی..."
                  className="w-full bg-white border border-slate-300 rounded-lg pr-8 pl-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Inline New Subject Form */}
          {showNewSubjectForm && (
            <form onSubmit={handleCreateSubject} className="mt-3 p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center gap-3 flex-wrap text-xs">
              <span className="font-bold text-indigo-900">افزودن درس جدید:</span>
              <input
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="عنوان درس (مثلاً: حسابان ۲، زمین شناسی...)"
                className="bg-white border border-indigo-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 grow"
                required
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold cursor-pointer transition"
              >
                ثبت درس
              </button>
              <button
                type="button"
                onClick={() => setShowNewSubjectForm(false)}
                className="px-2 py-1.5 text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                انصراف
              </button>
            </form>
          )}

          {/* Quick Summary Badges */}
          <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-slate-700">میانگین کلاسی:</span>
              <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700">
                مستمر اول: <b className="text-indigo-700 font-mono">{toPersianDigits(avgC1)}</b>
              </span>
              <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700">
                پایانی ترم ۱: <b className="text-indigo-700 font-mono">{toPersianDigits(avgF1)}</b>
              </span>
              <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700">
                مستمر دوم: <b className="text-indigo-700 font-mono">{toPersianDigits(avgC2)}</b>
              </span>
              <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700">
                پایانی ترم ۲: <b className="text-indigo-700 font-mono">{toPersianDigits(avgF2)}</b>
              </span>
              <span className="bg-indigo-100/70 px-2.5 py-1 rounded-md border border-indigo-200 text-indigo-900 font-bold">
                معدل سالانه: <b className="font-mono">{toPersianDigits(avgAnnual)}</b>
              </span>
            </div>

            <div className="text-[11px] text-slate-500 font-medium">
              فرمول سالانه: (مستمر اول × ۱ + پایانی اول × ۲ + مستمر دوم × ۱ + پایانی دوم × ۶) ÷ ۱۰
            </div>
          </div>
        </div>

        {/* Grades Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-right border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[11px] sm:text-xs">
                  <th className="p-3 text-center w-10">#</th>
                  <th className="p-3 font-bold min-w-[160px]">دانش‌آموز</th>
                  <th className="p-2.5 text-center font-bold bg-amber-50/60 text-amber-900 min-w-[90px]">
                    مستمر اول (C1)
                  </th>
                  <th className="p-2.5 text-center font-bold bg-amber-100/70 text-amber-950 min-w-[90px]">
                    پایانی اول (F1)
                  </th>
                  <th className="p-2.5 text-center font-bold bg-emerald-50/60 text-emerald-900 min-w-[90px]">
                    مستمر دوم (C2)
                  </th>
                  <th className="p-2.5 text-center font-bold bg-emerald-100/70 text-emerald-950 min-w-[90px]">
                    پایانی دوم (F2)
                  </th>
                  <th className="p-2.5 text-center font-bold bg-indigo-50 text-indigo-900 min-w-[100px]">
                    نمره سالانه رسمی
                  </th>
                  <th className="p-2.5 text-center font-bold min-w-[80px]">وضعیت</th>
                  <th className="p-2.5 font-bold min-w-[140px]">ملاحظات و توصیف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student, idx) => {
                  const draft = gradesDraft[student.id] || {};
                  const c1 = draft.c1 ? parseFloat(draft.c1) : undefined;
                  const f1 = draft.f1 ? parseFloat(draft.f1) : undefined;
                  const c2 = draft.c2 ? parseFloat(draft.c2) : undefined;
                  const f2 = draft.f2 ? parseFloat(draft.f2) : undefined;

                  const annual = calculateAnnualScore(c1, f1, c2, f2);

                  let passBadge = '-';
                  let passClass = 'text-slate-400 bg-slate-50';
                  if (annual !== undefined) {
                    if (annual >= 10 && (f2 === undefined || f2 >= 10)) {
                      passBadge = 'قبول';
                      passClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                    } else if (annual >= 7) {
                      passBadge = 'تبصره';
                      passClass = 'text-amber-700 bg-amber-50 border-amber-200';
                    } else {
                      passBadge = 'تجدید';
                      passClass = 'text-rose-700 bg-rose-50 border-rose-200';
                    }
                  }

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 text-center text-slate-400 font-bold">
                        {toPersianDigits(idx + 1)}
                      </td>
                      
                      {/* Student Info */}
                      <td className="p-3">
                        {onSelectStudent ? (
                          <button
                            type="button"
                            onClick={() => onSelectStudent(student)}
                            className="font-bold text-slate-900 hover:text-teal-800 hover:underline transition cursor-pointer text-right block"
                            title="مشاهده پرونده کامل دانش‌آموز"
                          >
                            {student.firstName} {student.lastName}
                          </button>
                        ) : (
                          <div className="font-bold text-slate-900">
                            {student.firstName} {student.lastName}
                          </div>
                        )}
                        {student.fatherName && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            فرزند {student.fatherName}
                          </div>
                        )}
                      </td>

                      {/* Term 1 Continuous */}
                      <td className="p-2 text-center bg-amber-50/30">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="20"
                          value={draft.c1 ?? ''}
                          onChange={(e) => handleScoreChange(student.id, 'c1', e.target.value)}
                          placeholder="۰-۲۰"
                          className="w-18 text-center font-bold font-mono bg-white border border-amber-200 rounded-md py-1 text-slate-800 focus:ring-2 focus:ring-amber-400 outline-none text-xs sm:text-sm"
                        />
                      </td>

                      {/* Term 1 Final */}
                      <td className="p-2 text-center bg-amber-50/60">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="20"
                          value={draft.f1 ?? ''}
                          onChange={(e) => handleScoreChange(student.id, 'f1', e.target.value)}
                          placeholder="۰-۲۰"
                          className="w-18 text-center font-bold font-mono bg-white border border-amber-300 rounded-md py-1 text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none text-xs sm:text-sm"
                        />
                      </td>

                      {/* Term 2 Continuous */}
                      <td className="p-2 text-center bg-emerald-50/30">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="20"
                          value={draft.c2 ?? ''}
                          onChange={(e) => handleScoreChange(student.id, 'c2', e.target.value)}
                          placeholder="۰-۲۰"
                          className="w-18 text-center font-bold font-mono bg-white border border-emerald-200 rounded-md py-1 text-slate-800 focus:ring-2 focus:ring-emerald-400 outline-none text-xs sm:text-sm"
                        />
                      </td>

                      {/* Term 2 Final */}
                      <td className="p-2 text-center bg-emerald-50/60">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="20"
                          value={draft.f2 ?? ''}
                          onChange={(e) => handleScoreChange(student.id, 'f2', e.target.value)}
                          placeholder="۰-۲۰"
                          className="w-18 text-center font-bold font-mono bg-white border border-emerald-300 rounded-md py-1 text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none text-xs sm:text-sm"
                        />
                      </td>

                      {/* Auto Calculated Annual Score */}
                      <td className="p-2.5 text-center bg-indigo-50/50">
                        <span className={`font-mono font-bold text-sm ${
                          annual !== undefined
                            ? annual >= 14 ? 'text-indigo-700' : annual >= 10 ? 'text-emerald-700' : 'text-rose-600'
                            : 'text-slate-400'
                        }`}>
                          {annual !== undefined ? toPersianDigits(annual) : '-'}
                        </span>
                      </td>

                      {/* Pass Status */}
                      <td className="p-2.5 text-center">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${passClass}`}>
                          {passBadge}
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="p-2">
                        <input
                          type="text"
                          value={draft.notes ?? ''}
                          onChange={(e) => handleScoreChange(student.id, 'notes', e.target.value)}
                          placeholder="یادداشت معلم / معاون..."
                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {isSavedToast && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>نمرات با موفقیت ذخیره و در پرونده دانش‌آموزان ثبت گردید.</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              بستن
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>ذخیره رسمی نمرات</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
