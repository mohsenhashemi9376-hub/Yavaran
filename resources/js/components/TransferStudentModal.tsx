import React, { useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student } from '../types';
import { X, ArrowRightLeft, CheckCircle2, Loader2 } from 'lucide-react';

interface TransferStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  currentClass: SchoolClass | null;
}

export const TransferStudentModal: React.FC<TransferStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  currentClass,
}) => {
  const { classes, transferStudentClass, showToast } = useSchool();
  const [selectedTargetClassId, setSelectedTargetClassId] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !student) return null;

  const availableClasses = classes.filter((c) => c.id !== student.classId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!selectedTargetClassId) {
      setErrorText('لطفاً کلاس مقصد را انتخاب کنید.');
      return;
    }

    try {
      setIsSubmitting(true);
      const targetClass = classes.find(c => c.id === selectedTargetClassId);
      transferStudentClass(student.id, selectedTargetClassId);
      showToast('انتقال کلاس', `دانش‌آموز «${student.firstName} ${student.lastName}» به کلاس «${targetClass?.name || 'جدید'}» منتقل شد.`, 'success');
      onClose();
      setSelectedTargetClassId('');
      setErrorText(null);
    } catch (err) {
      console.error('Error transferring student:', err);
      setErrorText('خطا در انتقال کلاس. لطفاً دوباره تلاش کنید.');
      showToast('خطا در انتقال', 'عملیات انتقال با خطا مواجه شد.', 'error');
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
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">انتقال دانش‌آموز به کلاس دیگر</h2>
              <p className="text-[11px] text-slate-400">تغییر کلاس بدون ایجاد رکورد دوم و با حفظ تمام سوابق</p>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">دانش‌آموز:</span>
              <span className="font-bold text-slate-900">{student.firstName} {student.lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">کلاس فعلی:</span>
              <span className="font-bold text-teal-800">{currentClass?.name || 'نامشخص'}</span>
            </div>
            {student.studentCode && (
              <div className="flex justify-between">
                <span className="text-slate-500">کد دانش‌آموزی:</span>
                <span className="font-mono text-slate-700">{student.studentCode}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              انتخاب کلاس مقصد: <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTargetClassId}
              onChange={(e) => {
                setSelectedTargetClassId(e.target.value);
                setErrorText(null);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-medium text-slate-800"
            >
              <option value="">-- کلاس جدید را انتخاب کنید --</option>
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errorText && (
              <p className="text-rose-600 text-[11px] mt-1 font-medium">{errorText}</p>
            )}
          </div>

          {/* Safety info notice */}
          <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-3 text-xs text-teal-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-800" />
              <span>یکپارچگی اطلاعات و سوابق</span>
            </div>
            <p className="text-[11px] text-teal-800/90 leading-relaxed">
              سوابق گذشته دانش‌آموز از جمله جلسات حضور و غیاب قبلی، تأخیرهای ثبت شده، نمرات کارنامه و پرونده تربیتی بدون تغییر حفظ شده و دانش‌آموز تنها یک کلاس فعال خواهد داشت.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold bg-teal-800 hover:bg-teal-900 text-white rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
              <span>{isSubmitting ? 'در حال انتقال...' : 'تایید انتقال کلاس'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
