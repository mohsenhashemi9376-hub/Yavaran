import React, { useState, useMemo } from 'react';
import { useSchool } from '../context/SchoolContext';
import { AcademicSubject, SubjectCategory } from '../types';
import { EditSubjectModal } from './EditSubjectModal';
import { toPersianDigits } from '../utils/persianDate';
import {
  BookOpen,
  Plus,
  Search,
  UserCheck,
  Award,
  Clock,
  Layers,
  Edit2,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  Shield,
  CheckCircle2,
  Sparkles,
  Info,
  UserPlus,
  Filter,
  GraduationCap
} from 'lucide-react';
import * as XLSX from 'xlsx';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; badgeBg: string }> = {
  'علوم پایه': { bg: 'bg-blue-50/70', text: 'text-blue-700', border: 'border-blue-200', badgeBg: 'bg-blue-100' },
  'ادبیات و معارف': { bg: 'bg-emerald-50/70', text: 'text-emerald-700', border: 'border-emerald-200', badgeBg: 'bg-emerald-100' },
  'زبان‌های خارجی': { bg: 'bg-purple-50/70', text: 'text-purple-700', border: 'border-purple-200', badgeBg: 'bg-purple-100' },
  'علوم اجتماعی و فرهنگ': { bg: 'bg-amber-50/70', text: 'text-amber-700', border: 'border-amber-200', badgeBg: 'bg-amber-100' },
  'مهارتی و فناوری': { bg: 'bg-cyan-50/70', text: 'text-cyan-700', border: 'border-cyan-200', badgeBg: 'bg-cyan-100' },
  'تربیت بدنی و سلامت': { bg: 'bg-rose-50/70', text: 'text-rose-700', border: 'border-rose-200', badgeBg: 'bg-rose-100' },
};

export const SubjectManagementSection: React.FC = () => {
  const {
    academicSubjects,
    allTeachers,
    isAdmin,
    isEducationalVice,
    assignTeacherToSubject,
    deleteAcademicSubject,
    resetSubjectsToJuniorHighStandards,
  } = useSchool();

  // Access control: only Admin and Educational Vice can edit
  const canManage = isAdmin || isEducationalVice;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AcademicSubject | null>(null);

  // Quick Action Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenAdd = () => {
    setEditingSubject(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (subj: AcademicSubject) => {
    setEditingSubject(subj);
    setIsModalOpen(true);
  };

  const handleDeleteSubject = (subj: AcademicSubject) => {
    if (!canManage) return;
    const confirmDelete = window.confirm(
      `آیا از حذف درس «${subj.name}» از چارت آموزشی متوسطه اول اطمینان دارید؟`
    );
    if (confirmDelete) {
      deleteAcademicSubject(subj.id);
      showToast(`درس «${subj.name}» با موفقیت حذف شد.`);
    }
  };

  const handleResetToStandards = () => {
    if (!canManage) return;
    const confirmReset = window.confirm(
      'آیا مایلید تمام عناوین درسی به چارت مصوب و استاندارد دوره اول دبیرستان (متوسطه اول: هفتم، هشتم، نهم) بازنشانی شوند؟'
    );
    if (confirmReset) {
      resetSubjectsToJuniorHighStandards();
      showToast('چارت درسی به استاندارد آموزش و پرورش بازنشانی شد.');
    }
  };

  const handleQuickAssignTeacher = (subjectId: string, teacherId: string) => {
    if (!canManage) return;
    if (!teacherId) {
      assignTeacherToSubject(subjectId, null);
      showToast('تخصیص دبیر این درس لغو گردید.');
    } else {
      const foundTeacher = allTeachers.find((t) => t.id === teacherId);
      assignTeacherToSubject(subjectId, teacherId, foundTeacher ? foundTeacher.name : undefined);
      showToast(`استاد «${foundTeacher?.name || ''}» به این درس اختصاص یافت.`);
    }
  };

  // Filtered Subjects
  const filteredSubjects = useMemo(() => {
    return academicSubjects.filter((subj) => {
      // Search
      const matchSearch =
        searchQuery.trim() === '' ||
        subj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (subj.defaultTeacherName &&
          subj.defaultTeacherName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (subj.code && subj.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (subj.description && subj.description.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category filter
      const matchCat =
        selectedCategoryFilter === 'all' || subj.category === selectedCategoryFilter;

      // Grade filter
      const matchGrade =
        selectedGradeFilter === 'all' ||
        (subj.targetGrades && subj.targetGrades.includes(selectedGradeFilter)) ||
        (subj.grade && subj.grade.includes(selectedGradeFilter));

      return matchSearch && matchCat && matchGrade;
    });
  }, [academicSubjects, searchQuery, selectedCategoryFilter, selectedGradeFilter]);

  // Summary Metrics
  const totalCoefficients = useMemo(() => {
    return academicSubjects.reduce((sum, s) => sum + (s.coefficient || 0), 0);
  }, [academicSubjects]);

  const totalHours = useMemo(() => {
    return academicSubjects.reduce((sum, s) => sum + (s.hoursPerWeek || s.coefficient || 0), 0);
  }, [academicSubjects]);

  const assignedCount = useMemo(() => {
    return academicSubjects.filter((s) => s.teacherId || s.defaultTeacherName).length;
  }, [academicSubjects]);

  // Export Excel
  const handleExportExcel = () => {
    const data = academicSubjects.map((s, idx) => ({
      'ردیف': idx + 1,
      'نام درس': s.name,
      'کد درس': s.code || '-',
      'ضریب واحد': s.coefficient,
      'ساعت در هفته': s.hoursPerWeek || s.coefficient,
      'گروه درسی': s.category || 'عمومی',
      'پایه‌های تحصیلی': s.targetGrades ? s.targetGrades.join('، ') : (s.grade || 'متوسطه اول'),
      'دبیر تخصیص یافته': s.defaultTeacherName || 'بدون دبیر',
      'توضیحات و اهداف': s.description || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'چارت دروس متوسطه اول');
    XLSX.writeFile(wb, `چارت_دروس_متوسطه_اول_یاوران_ولایت_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('فایل اکسل دروس متوسطه اول دانلود شد.');
  };

  return (
    <div className="space-y-6">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-800/40">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                برنامه درسی مصوب متوسطه اول (پایه‌های هفتم، هشتم، نهم)
              </span>
              {canManage ? (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  دسترسی مدیریت و معاونت آموزش فعال
                </span>
              ) : (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  حالت مشاهده (ویرایش مختص مدیر و معاون آموزش)
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              مدیریت دروس و تخصیص اساتید متوسطه اول
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              تعریف و ویرایش سرفصل‌های درسی، تعیین ضرایب، ساعات آموزشی و انتساب مستقیم هر دبیر به درس متناظر در دبیرستان یاوران ولایت.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
            {canManage && (
              <>
                <button
                  onClick={handleOpenAdd}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>تعریف درس جدید</span>
                </button>
                <button
                  onClick={handleResetToStandards}
                  title="بازنشانی دروس به چارت استاندارد متوسطه اول آموزش و پرورش"
                  className="bg-indigo-700/60 hover:bg-indigo-600 text-white font-bold px-3 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition border border-indigo-500/30 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>چارت استاندارد</span>
                </button>
              </>
            )}
            <button
              onClick={handleExportExcel}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>خروجی اکسل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">تعداد کل عناوین درسی</div>
            <div className="text-lg font-bold text-slate-800">
              {toPersianDigits(academicSubjects.length)} <span className="text-xs font-normal text-slate-500">عنوان</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">مجموع ضرایب هفتگی</div>
            <div className="text-lg font-bold text-slate-800">
              {toPersianDigits(totalCoefficients)} <span className="text-xs font-normal text-slate-500">واحد</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">ساعت آموزشی هفتگی</div>
            <div className="text-lg font-bold text-slate-800">
              {toPersianDigits(totalHours)} <span className="text-xs font-normal text-slate-500">ساعت</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">اساتید تخصیص یافته</div>
            <div className="text-lg font-bold text-slate-800">
              {toPersianDigits(assignedCount)} <span className="text-xs font-normal text-slate-500">از {toPersianDigits(academicSubjects.length)} درس</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی نام درس، نام دبیر، کد درس..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedCategoryFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              همه گروه‌ها ({toPersianDigits(academicSubjects.length)})
            </button>
            {Object.keys(CATEGORY_COLORS).map((catName) => {
              const count = academicSubjects.filter((s) => s.category === catName).length;
              const isSelected = selectedCategoryFilter === catName;
              return (
                <button
                  key={catName}
                  onClick={() => setSelectedCategoryFilter(catName)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {catName} {count > 0 && <span className="opacity-80 text-[10px]">({toPersianDigits(count)})</span>}
                </button>
              );
            })}
          </div>

          {/* Grade Filter */}
          <div className="w-full md:w-auto flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-bold outline-none text-slate-700"
            >
              <option value="all">همه پایه‌ها</option>
              <option value="پایه هفتم">پایه هفتم</option>
              <option value="پایه هشتم">پایه هشتم</option>
              <option value="پایه نهم">پایه نهم</option>
            </select>
          </div>

        </div>
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubjects.map((subject) => {
          const catStyle = subject.category ? CATEGORY_COLORS[subject.category] : null;
          const assignedTeacher = allTeachers.find((t) => t.id === subject.teacherId);
          const teacherDisplay = subject.defaultTeacherName || assignedTeacher?.name;

          return (
            <div
              key={subject.id}
              className={`bg-white rounded-2xl border ${
                catStyle ? catStyle.border : 'border-slate-200'
              } shadow-2xs hover:shadow-md transition flex flex-col justify-between overflow-hidden group`}
            >
              {/* Card Top */}
              <div className="p-4 space-y-3">
                {/* Header row with Title and Category */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition">
                        {subject.name}
                      </h3>
                    </div>
                    {subject.code && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        کد: {subject.code}
                      </span>
                    )}
                  </div>

                  {subject.category && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        catStyle ? `${catStyle.bg} ${catStyle.text} ${catStyle.border}` : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {subject.category}
                    </span>
                  )}
                </div>

                {/* Specs row (Coeff, Hours, Grades) */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 text-[11px]">
                    <Award className="w-3 h-3 text-amber-600" />
                    <span>ضریب {toPersianDigits(subject.coefficient)}</span>
                  </div>

                  <div className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 text-[11px]">
                    <Clock className="w-3 h-3 text-blue-600" />
                    <span>{toPersianDigits(subject.hoursPerWeek || subject.coefficient)} ساعت/هفته</span>
                  </div>
                </div>

                {/* Target Grades Pills */}
                {subject.targetGrades && subject.targetGrades.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {subject.targetGrades.map((g) => (
                      <span
                        key={g}
                        className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description if present */}
                {subject.description && (
                  <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                    {subject.description}
                  </p>
                )}
              </div>

              {/* Card Bottom: Assigned Teacher Box & Actions */}
              <div className="bg-slate-50 border-t border-slate-100 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>دبیر مسئول درس:</span>
                  </div>

                  {/* If user is manager, quick assign dropdown */}
                  {canManage ? (
                    <select
                      value={subject.teacherId || ''}
                      onChange={(e) => handleQuickAssignTeacher(subject.id, e.target.value)}
                      className="text-[11px] bg-white border border-slate-300 rounded-lg px-2 py-1 outline-none font-bold text-slate-700 hover:border-indigo-400 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="">-- بدون دبیر (انتخاب) --</option>
                      {allTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>

                {/* Teacher Badge display */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        teacherDisplay
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {teacherDisplay ? teacherDisplay.charAt(0) : '؟'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {teacherDisplay || <span className="text-slate-400 font-normal">دبیر تعیین نشده</span>}
                      </div>
                      {assignedTeacher?.phone && (
                        <div className="text-[10px] font-mono text-slate-400" dir="ltr">
                          {assignedTeacher.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions for Admin and Educational Vice */}
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(subject)}
                        title="ویرایش مشخصات درس و دبیر"
                        className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(subject)}
                        title="حذف درس"
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSubjects.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">هیچ درسی با این فیلترها یافت نشد</h3>
          <p className="text-xs text-slate-500">
            می‌توانید عبارت جستجو را پاک کنید یا درس جدیدی را اضافه نمایید.
          </p>
          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف درس جدید</span>
            </button>
          )}
        </div>
      )}

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <EditSubjectModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingSubject(null);
          }}
          subject={editingSubject}
        />
      )}
    </div>
  );
};
