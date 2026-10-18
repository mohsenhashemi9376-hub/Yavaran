import React, { useEffect, useState } from 'react';
import { GraduationCap, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { ClassMonthlyGradesSection } from './ClassMonthlyGradesSection';

interface AcademicGradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialClassId?: string;
  initialSubjectId?: string;
  onSelectStudent?: (student: Student) => void;
}

/**
 * ثبت نمرات: همان دفتر نمرات ماهانه‌ی پنل معاون آموزش (مستمر هر ماه + پایانی اول و دوم)، بدون ساختار ترمی جداگانه.
 * کلاس را انتخاب می‌کنید و ستون‌ها دقیقاً همان ستون‌های کارنامه‌ی تفکیکی دروس دانش‌آموز است.
 */
export const AcademicGradesModal: React.FC<AcademicGradesModalProps> = ({ isOpen, onClose, initialClassId, initialSubjectId, onSelectStudent }) => {
  const { classes, accessibleClasses } = useSchool();
  const pool = (accessibleClasses.length ? accessibleClasses : classes).filter((c) => !c.isWorkshop);
  const [classId, setClassId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setClassId(initialClassId && pool.some((c) => c.id === initialClassId) ? initialClassId : pool[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialClassId]);

  if (!isOpen) return null;
  const cls = pool.find((c) => c.id === classId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm overflow-y-auto overscroll-contain" dir="rtl">
      <div className="min-h-full flex items-start justify-center p-0 sm:p-4">
        <div className="bg-slate-50 w-full max-w-6xl min-h-screen sm:min-h-0 sm:rounded-3xl shadow-2xl font-['Vazirmatn',sans-serif]">
          <header className="sticky top-0 z-20 bg-white sm:rounded-t-3xl border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><GraduationCap className="w-5 h-5" /></div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-slate-900">ثبت نمرات</h2>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                aria-label="انتخاب کلاس"
                className="mt-1 h-10 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer max-w-full"
              >
                {pool.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button type="button" onClick={onClose} aria-label="بستن" className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"><X className="w-5 h-5" /></button>
          </header>

          <div className="p-3 sm:p-5">
            {cls ? (
              <ClassMonthlyGradesSection key={`${cls.id}-${initialSubjectId ?? ''}`} classData={cls} initialSubjectId={initialSubjectId} onSelectStudent={onSelectStudent} />
            ) : (
              <div className="py-16 text-center text-sm text-slate-400">کلاسی برای ثبت نمره وجود ندارد.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
