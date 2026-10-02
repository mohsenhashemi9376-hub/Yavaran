import React, { useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { X, AlertCircle, Loader2, Check } from 'lucide-react';
import { getActiveAcademicYear } from '../utils/persianDate';

interface AddClassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GRADE_OPTIONS = ['پایه هفتم', 'پایه هشتم', 'پایه نهم'];

const fieldClass =
  'w-full text-base bg-slate-50 rounded-2xl px-4 py-3 text-slate-900 outline-none border border-transparent focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 transition';

export const AddClassModal: React.FC<AddClassModalProps> = ({ isOpen, onClose }) => {
  const { addClass, classes, allCoaches } = useSchool();

  const [grade, setGrade] = useState(GRADE_OPTIONS[0]);
  const [name, setName] = useState('');
  const [selectedCoachId, setSelectedCoachId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorName, setErrorName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setName('');
    setGrade(GRADE_OPTIONS[0]);
    setSelectedCoachId('');
    setErrorName(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const cleanName = name.trim();

    if (!cleanName) {
      setErrorName('لطفاً نام کلاس را وارد کنید.');
      return;
    }

    const isDuplicate = (classes || []).some(
      (c) => c.grade === grade && (c.name || '').trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (isDuplicate) {
      setErrorName(`کلاسی با نام «${cleanName}» در ${grade} قبلاً ثبت شده است.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // رشته تحصیلی و سال تحصیلی به‌صورت پیش‌فرض در پس‌زمینه ثبت می‌شوند
      addClass({
        name: cleanName,
        grade,
        major: 'متوسطه اول',
        academicYear: getActiveAcademicYear(),
        teacherIds: [],
        coachId: selectedCoachId || undefined,
      });
      handleClose();
    } catch {
      setErrorName('خطا در ایجاد کلاس. لطفاً مجدداً تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/10 w-full max-w-md animate-in fade-in zoom-in-95 font-['Vazirmatn',sans-serif]">
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">افزودن کلاس</h2>
          <button
            type="button"
            onClick={handleClose}
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
              autoFocus
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
              {(allCoaches || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>


          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold rounded-2xl shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            <span>افزودن کلاس</span>
          </button>
        </form>
      </div>
    </div>
  );
};
