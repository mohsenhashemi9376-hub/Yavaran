import React, { useState, useMemo } from 'react';
import { useSchool } from '../context/SchoolContext';
import { AcademicSubject, SubjectCategory } from '../types';
import { EditSubjectModal } from './EditSubjectModal';
import { SubjectClassAssignmentModal } from './SubjectClassAssignmentModal';
import { getStandardRoleTitle } from '../utils/userRoles';
import { toPersianDigits } from '../utils/persianDate';
import { BookOpen, Plus, Search, Edit2, Trash2, RotateCcw, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const CATEGORY_FILTERS = ['دروس یاوران', 'دروس آموزش و پرورش'] as const;

// هر درس غیر از «دروس یاوران» (از جمله گروه‌های قدیمی) در گروه آموزش و پرورش حساب می‌شود
const categoryOf = (s: AcademicSubject): string =>
  s.category === 'دروس یاوران' ? 'دروس یاوران' : 'دروس آموزش و پرورش';

export const SubjectManagementSection: React.FC = () => {
  const {
    academicSubjects,
    assignableStaff,
    classes,
    courseAssignments,
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
  const [classAssignSubject, setClassAssignSubject] = useState<AcademicSubject | null>(null);

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
      const foundTeacher = assignableStaff.find((t) => t.id === teacherId);
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
        false;

      // Category filter
      const matchCat =
        selectedCategoryFilter === 'all' || categoryOf(subj) === selectedCategoryFilter;

      // Grade filter
      const matchGrade =
        selectedGradeFilter === 'all' ||
        (subj.targetGrades && subj.targetGrades.includes(selectedGradeFilter)) ||
        (subj.grade && subj.grade.includes(selectedGradeFilter));

      return matchSearch && matchCat && matchGrade;
    });
  }, [academicSubjects, searchQuery, selectedCategoryFilter, selectedGradeFilter]);

  const totalHours = useMemo(
    () => academicSubjects.reduce((sum, s) => sum + (s.hoursPerWeek || 0), 0),
    [academicSubjects]
  );
  const assignedCount = useMemo(
    () => academicSubjects.filter((s) => s.teacherId || s.defaultTeacherName).length,
    [academicSubjects]
  );

  // Export Excel
  const handleExportExcel = () => {
    const data = academicSubjects.map((s, idx) => ({
      'ردیف': idx + 1,
      'نام درس': s.name,
      'ساعت در هفته': s.hoursPerWeek || 2,
      'گروه درسی': categoryOf(s),
      'پایه‌های تحصیلی': s.targetGrades ? s.targetGrades.join('، ') : (s.grade || 'متوسطه اول'),
      'دبیر تخصیص یافته': s.defaultTeacherName || 'بدون دبیر',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'چارت دروس متوسطه اول');
    XLSX.writeFile(wb, `چارت_دروس_متوسطه_اول_یاوران_ولایت_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('فایل اکسل دروس متوسطه اول دانلود شد.');
  };

  return (
    <div className="space-y-5">
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 bg-white text-slate-800 px-4 py-3 rounded-2xl shadow-xl shadow-slate-900/10 flex items-center gap-2 border border-slate-100 animate-in fade-in slide-in-from-bottom-3 text-sm font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* نوار ابزار */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">دروس</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {toPersianDigits(academicSubjects.length)} درس • {toPersianDigits(totalHours)} ساعت در هفته • دبیر {toPersianDigits(assignedCount)} درس مشخص است
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="h-11 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-sm flex items-center gap-2 transition shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف درس جدید</span>
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="h-11 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm flex items-center gap-2 transition border border-slate-200 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>خروجی اکسل</span>
          </button>
          {canManage && (
            <button
              onClick={handleResetToStandards}
              title="بازنشانی دروس به چارت استاندارد"
              aria-label="بازنشانی به چارت استاندارد"
              className="h-11 w-11 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 rounded-xl flex items-center justify-center transition border border-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* جستجو و فیلترها */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجوی درس یا دبیر..."
            className="w-full h-11 text-sm bg-white border border-slate-200 rounded-xl pr-10 pl-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
          />
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl text-sm font-bold self-start">
          {(['all', ...CATEGORY_FILTERS] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-4 py-2 rounded-lg transition cursor-pointer ${
                selectedCategoryFilter === cat ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {cat === 'all' ? 'همه' : cat}
            </button>
          ))}
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl text-sm font-bold self-start">
          {['all', 'پایه هفتم', 'پایه هشتم', 'پایه نهم'].map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGradeFilter(g)}
              className={`px-4 py-2 rounded-lg transition cursor-pointer ${
                selectedGradeFilter === g ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {g === 'all' ? 'همه پایه‌ها' : g.replace('پایه ', '')}
            </button>
          ))}
        </div>
      </div>

      {/* کارت دروس */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredSubjects.map((subject) => {
          const assignedTeacher = assignableStaff.find((t) => t.id === subject.teacherId);
          const teacherDisplay = subject.defaultTeacherName || assignedTeacher?.name;

          return (
            <div
              key={subject.id}
              className="bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-base text-slate-900 truncate">{subject.name}</h3>
                  <span className="inline-block mt-1.5 text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">
                    {toPersianDigits(subject.hoursPerWeek || 2)} ساعت در هفته
                  </span>
                </div>

                {canManage && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(subject)}
                      title="ویرایش درس"
                      aria-label="ویرایش درس"
                      className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSubject(subject)}
                      title="حذف درس"
                      aria-label="حذف درس"
                      className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {canManage ? (
                <select
                  value={subject.teacherId || ''}
                  onChange={(e) => handleQuickAssignTeacher(subject.id, e.target.value)}
                  aria-label={`دبیر درس ${subject.name}`}
                  className="w-full text-sm bg-slate-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-emerald-500 focus:bg-white font-bold text-slate-700 cursor-pointer"
                >
                  <option value="">دبیر پیش‌فرض تعیین نشده</option>
                  {assignableStaff.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({getStandardRoleTitle(t.role)})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-sm font-bold text-slate-700">
                  {teacherDisplay || <span className="text-slate-400 font-normal">دبیر تعیین نشده</span>}
                </div>
              )}

              {canManage && (
                <button
                  type="button"
                  onClick={() => setClassAssignSubject(subject)}
                  className="w-full text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl px-3 py-2 transition cursor-pointer"
                >
                  استاد هر کلاس
                  {(() => {
                    const n = courseAssignments.filter((a) => a.subjectId === subject.id).length;
                    return n > 0 ? ` (${toPersianDigits(n)} کلاس)` : '';
                  })()}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {filteredSubjects.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 mx-auto flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">درسی یافت نشد</h3>
          {canManage && (
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف درس جدید</span>
            </button>
          )}
        </div>
      )}

      {classAssignSubject && (
        <SubjectClassAssignmentModal subject={classAssignSubject} onClose={() => setClassAssignSubject(null)} />
      )}

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
