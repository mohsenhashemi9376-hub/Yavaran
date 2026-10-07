import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Student, SchoolAbsenceRecord } from '../types';
import { toPersianDigits, getTodayShamsi, getDayOfWeekFromShamsi } from '../utils/persianDate';
import { UserX, X, Search, Calendar, AlertCircle, Loader2 } from 'lucide-react';
import { studentFullName } from '../utils/studentName';

interface SchoolAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudent?: Student | null;
  editRecord?: SchoolAbsenceRecord | null;
}

export const SchoolAbsenceModal: React.FC<SchoolAbsenceModalProps> = ({
  isOpen,
  onClose,
  initialStudent,
  editRecord,
}) => {
  const { 
    students, 
    classes, 
    currentUser, 
    schoolAbsences,
    addSchoolAbsence, 
    updateSchoolAbsence 
  } = useSchool();

  const todayInfo = getTodayShamsi();

  // Form state
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [date, setDate] = useState<string>(todayInfo.formattedDate);
  const [reason, setReason] = useState<string>('');
  const [isExcused, setIsExcused] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state on open/props change
  useEffect(() => {
    if (!isOpen) {
      setErrorMessage(null);
      return;
    }

    if (editRecord) {
      setSelectedStudentId(editRecord.studentId);
      setDate(editRecord.date);
      setReason(editRecord.reason || '');
      setIsExcused(editRecord.isExcused ?? false);
      setStudentSearch('');
      setErrorMessage(null);
    } else {
      setSelectedStudentId(initialStudent?.id || '');
      setDate(todayInfo.formattedDate);
      setReason('');
      setIsExcused(false);
      setStudentSearch('');
      setErrorMessage(null);
    }
  }, [isOpen, editRecord, initialStudent]);

  if (!isOpen) return null;

  // Student filtering
  const filteredStudents = students.filter((stu) => {
    const fullName = `${studentFullName(stu)}`.toLowerCase();
    const code = (stu.studentCode || '').toLowerCase();
    const searchLower = studentSearch.toLowerCase().trim();
    if (!searchLower) return true;
    return fullName.includes(searchLower) || code.includes(searchLower);
  });

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedStudentClass = classes.find((c) => c.id === selectedStudent?.classId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    // 1. Student validation
    if (!selectedStudentId || !selectedStudent) {
      setErrorMessage('لطفاً یک دانش‌آموز انتخاب کنید.');
      return;
    }

    // 2. Date validation
    const cleanDate = date.trim();
    if (!cleanDate || cleanDate.length < 8) {
      setErrorMessage('لطفاً تاریخ را بررسی کنید.');
      return;
    }

    // 3. Duplicate check
    const isDuplicate = schoolAbsences.some(
      (a) => a.studentId === selectedStudentId && a.date === cleanDate && (!editRecord || a.id !== editRecord.id)
    );
    if (isDuplicate) {
      setErrorMessage(`برای دانش‌آموز «${studentFullName(selectedStudent)}» در تاریخ ${toPersianDigits(cleanDate)} قبلاً سند غیبت مدرسه ثبت شده است.`);
      return;
    }

    const dayOfWeek = getDayOfWeekFromShamsi(cleanDate);

    setIsSubmitting(true);
    try {
      if (editRecord) {
        updateSchoolAbsence(editRecord.id, {
          studentId: selectedStudentId,
          classId: selectedStudent.classId,
          date: cleanDate,
          dayOfWeek,
          reason: reason.trim() || undefined,
          isExcused,
        });
      } else {
        addSchoolAbsence({
          studentId: selectedStudentId,
          classId: selectedStudent.classId,
          date: cleanDate,
          dayOfWeek,
          reason: reason.trim() || undefined,
          isExcused,
          recordedBy: `${currentUser.name} (${currentUser.roleTitle})`,
        });
      }
      onClose();
    } catch {
      setErrorMessage('ذخیره اطلاعات با مشکل مواجه شد. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-rose-700 to-rose-600 text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shadow-xs">
              <UserX className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {editRecord ? 'ویرایش غیبت مدرسه' : 'ثبت غیبت'}
              </h2>
              <p className="text-xs text-rose-100 mt-0.5">
                غیبت دانش‌آموز در مدرسه را ثبت کنید.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Inline Error Message (No alert) */}
          {errorMessage && (
            <div 
              role="alert" 
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* فیلد ۱: دانش‌آموز */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              دانش‌آموز <span className="text-rose-600">*</span>
            </label>
            
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="جستجو بر اساس نام دانش‌آموز یا کدملی..."
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>

            {/* Student Picker List */}
            <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((stu) => {
                  const isSelected = stu.id === selectedStudentId;
                  const stuClass = classes.find((c) => c.id === stu.classId);
                  return (
                    <button
                      type="button"
                      key={stu.id}
                      onClick={() => {
                        setSelectedStudentId(stu.id);
                        setErrorMessage(null);
                      }}
                      className={`w-full px-3 py-2 text-right text-xs flex items-center justify-between transition cursor-pointer ${
                        isSelected 
                          ? 'bg-rose-50 text-rose-950 font-black border-r-4 border-rose-600' 
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-rose-600' : 'bg-slate-300'}`} />
                        <span>{studentFullName(stu)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        {stuClass && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                            {stuClass.name}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-center text-xs text-slate-400">
                  دانش‌آموزی با این مشخصات یافت نشد.
                </div>
              )}
            </div>

            {/* Selected Student Feedback Chip */}
            {selectedStudent && (
              <div className="mt-1 flex items-center justify-between text-xs bg-rose-50/70 border border-rose-200/80 px-3 py-1.5 rounded-lg text-rose-900">
                <span className="font-bold">
                  انتخاب شده: {studentFullName(selectedStudent)}
                </span>
                {selectedStudentClass && (
                  <span className="text-[11px] text-rose-700">
                    کلاس {selectedStudentClass.name}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* فیلد ۲: تاریخ */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              تاریخ <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="1404/08/20"
                className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-2.5 text-slate-800 font-mono outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* فیلد ۳: توضیحات (اختیاری) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              توضیحات <span className="text-slate-400 font-normal">(اختیاری)</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="دانش‌آموز امروز در مدرسه حضور نداشت."
              className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
            />
          </div>

          {/* وضعیت موجه / غیرموجه */}
          <div className="pt-1">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isExcused}
                onChange={(e) => setIsExcused(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
              />
              <span>غیبت موجه است (با ارائه گواهی پزشکی یا اطلاع قبلی اولیا)</span>
            </label>
          </div>

          {/* Absence Status Badge Info */}
          <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl text-xs text-rose-900 flex items-center justify-between">
            <span className="font-bold">وضعیت در پرونده مدرسه:</span>
            <span className="font-bold px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-300">
              غایب در مدرسه
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-2 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSubmitting ? 'در حال ثبت...' : (editRecord ? 'ذخیره تغییرات' : 'ثبت غیبت')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
