import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass } from '../types';
import { X, Trash2, AlertTriangle, AlertCircle, Loader2, Check } from 'lucide-react';
import { toPersianDigits, getActiveAcademicYear } from '../utils/persianDate';

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  classData?: SchoolClass | null;
  schoolClass?: SchoolClass | null;
}

const GRADE_OPTIONS = ['پایه هفتم', 'پایه هشتم', 'پایه نهم'];

// پایه‌های قدیمی/نامعتبر (مثل «عمومی متوسطه اول») به نزدیک‌ترین گزینه معتبر نگاشت می‌شوند
const normalizeGrade = (grade?: string | null): string => {
  const g = grade || '';
  return GRADE_OPTIONS.find((opt) => opt === g) || GRADE_OPTIONS.find((opt) => g.includes(opt.replace('پایه ', ''))) || GRADE_OPTIONS[0];
};

const fieldClass =
  'w-full text-base bg-slate-50 rounded-2xl px-4 py-3 text-slate-900 outline-none border border-transparent focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 transition';

export const EditClassModal: React.FC<EditClassModalProps> = ({ isOpen, onClose, classData, schoolClass }) => {
  const currentClass = classData || schoolClass || null;
  const { updateClass, deleteClass, classes, allTeachers, allCoaches, students, showToast } = useSchool();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(GRADE_OPTIONS[0]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedCoachId, setSelectedCoachId] = useState('');
  const [errorName, setErrorName] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  // فقط هنگام باز شدن یا تغییر کلاس هدف، فرم با مقادیر فعلی پر می‌شود
  useEffect(() => {
    if (!isOpen || !currentClass) return;
    setName(currentClass.name || '');
    setGrade(normalizeGrade(currentClass.grade));
    setSelectedTeacherId((currentClass.teacherIds || [])[0] || '');
    setSelectedCoachId(currentClass.coachId || '');
    setShowDeleteConfirm(false);
    setDeleteWarning(null);
    setErrorName(null);
  }, [isOpen, currentClass?.id]);

  if (!isOpen || !currentClass) return null;

  const teachers = allTeachers || [];
  const coaches = allCoaches || [];
  const classStudentsCount = (students || []).filter((s) => s.classId === currentClass.id).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setErrorName('لطفاً نام کلاس را وارد کنید.');
      return;
    }

    const isDuplicate = (classes || []).some(
      (c) => c.id !== currentClass.id && c.grade === grade && (c.name || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      setErrorName(`کلاسی با نام «${cleanName}» در ${grade} قبلاً ثبت شده است.`);
      return;
    }

    try {
      setIsSubmitting(true);
      // رشته تحصیلی و سال تحصیلی در پس‌زمینه حفظ می‌شوند (مقدار قبلی یا پیش‌فرض)
      updateClass(currentClass.id, {
        name: cleanName,
        grade,
        major: currentClass.major || 'متوسطه اول',
        academicYear: currentClass.academicYear || getActiveAcademicYear(),
        teacherIds: selectedTeacherId ? [selectedTeacherId] : [],
        coachId: selectedCoachId || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update class:', err);
      showToast('خطا در ذخیره اطلاعات', 'هنگام ذخیره تغییرات کلاس مشکلی رخ داد. لطفاً دوباره تلاش کنید.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    if (classStudentsCount > 0) {
      setDeleteWarning(
        `این کلاس ${toPersianDigits(classStudentsCount)} دانش‌آموز دارد. برای حذف، ابتدا آن‌ها را به کلاس دیگری منتقل کنید.`
      );
      return;
    }
    setDeleteWarning(null);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deleteClass(currentClass.id)) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/10 w-full max-w-md animate-in fade-in zoom-in-95 font-['Vazirmatn',sans-serif]">
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">ویرایش کلاس</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">پایه تحصیلی</label>
            <div className="grid grid-cols-3 gap-2">
              {GRADE_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onClick={() => {
                    setGrade(opt);
                    setErrorName(null);
                  }}
                  className={`h-12 rounded-2xl text-sm font-extrabold transition cursor-pointer ${
                    grade === opt
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {opt.replace('پایه ', '')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">نام کلاس</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorName) setErrorName(null);
              }}
              placeholder="مثلاً: هفتم ۱"
              className={`${fieldClass} ${errorName ? '!border-rose-400 !ring-4 !ring-rose-100' : ''}`}
            />
            {errorName && (
              <div className="flex items-center gap-1.5 text-rose-600 text-xs mt-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorName}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">مربی تربیتی کلاس</label>
            <select value={selectedCoachId} onChange={(e) => setSelectedCoachId(e.target.value)} className={fieldClass}>
              <option value="">بدون مربی</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">معلم کلاس</label>
            <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className={fieldClass}>
              <option value="">بدون معلم</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {deleteWarning && (
            <div className="bg-rose-50 rounded-2xl p-3 text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{deleteWarning}</span>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="bg-amber-50 rounded-2xl p-3 text-xs text-amber-900 space-y-2">
              <p className="font-bold">کلاس خالی «{currentClass.name}» حذف شود؟ این کار قابل بازگشت نیست.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  بله، حذف شود
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold rounded-2xl shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            <span>ذخیره تغییرات</span>
          </button>

          <div className="flex justify-start">
            <button
              type="button"
              onClick={handleDeleteClick}
              className="flex items-center gap-1.5 text-xs font-medium text-rose-300 hover:text-rose-500 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف کلاس</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
