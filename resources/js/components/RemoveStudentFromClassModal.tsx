import React, { useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student } from '../types';
import { X, UserMinus, ShieldCheck, Loader2 } from 'lucide-react';

interface RemoveStudentFromClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  classData: SchoolClass | null;
}

export const RemoveStudentFromClassModal: React.FC<RemoveStudentFromClassModalProps> = ({
  isOpen,
  onClose,
  student,
  classData,
}) => {
  const { removeStudentFromClass, showToast } = useSchool();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !student || !classData) return null;

  const handleRemoveFromClassOnly = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      removeStudentFromClass(student.id);
      showToast('خروج از کلاس', `دانش‌آموز «${student.firstName} ${student.lastName}» از کلاس ${classData.name} خارج شد.`, 'info');
      onClose();
    } catch (err) {
      console.error('Error removing student from class:', err);
      showToast('خطا در خروج از کلاس', 'عملیات با خطا مواجه شد. لطفاً دوباره تلاش کنید.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 font-['Vazirmatn',sans-serif]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <UserMinus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">خروج دانش‌آموز از کلاس</h2>
              <p className="text-[11px] text-slate-400">تفکیک بین خروج از کلاس و حذف از سامانه</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">دانش‌آموز:</span>
              <span className="font-bold text-slate-900">{student.firstName} {student.lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">کلاس جاری:</span>
              <span className="font-bold text-teal-800">{classData.name}</span>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 space-y-1.5 text-xs text-emerald-950">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>خروج از کلاس با حفظ کامل اطلاعات و پرونده</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              با انتخاب این گزینه، دانش‌آموز تنها از کلاس «{classData.name}» خارج شده و وضعیت او به «بدون کلاس» تغییر می‌یابد. 
              کلیه سوابق انضباطی، تأخیرها، نمرات و اطلاعات پرونده او در سیستم مدرسه دست‌نخورده باقی می‌ماند و می‌توانید بعداً او را به کلاس دیگری منتقل کنید.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleRemoveFromClassOnly}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
              <span>{isSubmitting ? 'در حال پردازش...' : `خروج از کلاس ${classData.name} (پیشنهادی)`}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full py-2 px-4 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              انصراف و بازگشت
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
