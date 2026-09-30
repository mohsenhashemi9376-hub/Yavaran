import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Student, MorningDelayRecord } from '../types';
import { toPersianDigits, toEnglishDigits, getTodayShamsi, getDayOfWeekFromShamsi } from '../utils/persianDate';
import { Clock, X, Search, Calendar, AlertCircle, Loader2, CheckCircle2, UserCheck, ChevronDown } from 'lucide-react';

interface MorningDelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudent?: Student | null;
  initialClassId?: string | null;
  editRecord?: MorningDelayRecord | null;
}

const QUICK_MINUTE_OPTIONS = [5, 10, 15, 20, 30];

export const MorningDelayModal: React.FC<MorningDelayModalProps> = ({
  isOpen,
  onClose,
  initialStudent,
  initialClassId,
  editRecord,
}) => {
  const { 
    students, 
    classes, 
    currentUser, 
    morningDelays,
    addMorningDelay, 
    updateMorningDelay,
    showToast
  } = useSchool();

  const todayInfo = getTodayShamsi();

  // -------------------------------------------------------------
  // Form States
  // -------------------------------------------------------------
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [date, setDate] = useState<string>(todayInfo.formattedDate);
  const [delayMinutesInput, setDelayMinutesInput] = useState<string>('15');
  const [reason, setReason] = useState<string>('');
  const [isExcused, setIsExcused] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef<boolean>(false);
  const prevIsOpenRef = useRef<boolean>(false);

  // -------------------------------------------------------------
  // Sync state on open or target record change
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      setErrorMessage(null);
      setIsSearchDropdownOpen(false);
      return;
    }

    // Only initialize when modal transitions from closed to open, or target record changes
    const justOpened = !prevIsOpenRef.current && isOpen;
    prevIsOpenRef.current = true;

    if (justOpened || editRecord?.id) {
      setErrorMessage(null);
      setIsSearchDropdownOpen(false);

      if (editRecord) {
        // Editing existing delay record
        const existingStudent = students.find((s) => s.id === editRecord.studentId);
        setSelectedClassId(editRecord.classId || existingStudent?.classId || '');
        setSelectedStudentId(editRecord.studentId);
        setDate(toEnglishDigits(editRecord.date));
        setDelayMinutesInput(String(editRecord.delayMinutes || 15));
        setReason(editRecord.reason || '');
        setIsExcused(editRecord.isExcused ?? false);
        setStudentSearchQuery('');
      } else if (initialStudent) {
        // Opened with preselected student (e.g. from Student Profile)
        setSelectedClassId(initialStudent.classId || '');
        setSelectedStudentId(initialStudent.id);
        setDate(todayInfo.formattedDate);
        setDelayMinutesInput('15');
        setReason('');
        setIsExcused(false);
        setStudentSearchQuery('');
      } else if (initialClassId) {
        // Opened with preselected class (e.g. from Class Profile)
        setSelectedClassId(initialClassId);
        setSelectedStudentId('');
        setDate(todayInfo.formattedDate);
        setDelayMinutesInput('15');
        setReason('');
        setIsExcused(false);
        setStudentSearchQuery('');
      } else {
        // Fresh empty registration
        setSelectedClassId('');
        setSelectedStudentId('');
        setDate(todayInfo.formattedDate);
        setDelayMinutesInput('15');
        setReason('');
        setIsExcused(false);
        setStudentSearchQuery('');
      }
    }
  }, [isOpen, editRecord?.id, initialStudent?.id, initialClassId]);

  // -------------------------------------------------------------
  // Derived Data
  // -------------------------------------------------------------
  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedClass = classes.find((c) => c.id === (selectedClassId || selectedStudent?.classId));

  // Students belonging strictly to the selected class
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return students.filter((s) => s.classId === selectedClassId);
  }, [students, selectedClassId]);

  // Filtered students based on search query (within selected class).
  // Rule: Do NOT open full list automatically when search is empty. Only show on typed query.
  const filteredStudents = useMemo(() => {
    const query = studentSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return classStudents.filter((stu) => {
      const fullName = `${stu.firstName} ${stu.lastName}`.toLowerCase();
      const code = (stu.studentCode || '').toLowerCase();
      return fullName.includes(query) || code.includes(query);
    });
  }, [classStudents, studentSearchQuery]);

  // Parsed delay minutes
  const parsedMinutes = Number(toEnglishDigits(delayMinutesInput.trim()));
  const isDelayValid = !isNaN(parsedMinutes) && parsedMinutes > 0;

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  const handleClassChange = (newClassId: string) => {
    setSelectedClassId(newClassId);
    // If a student was already chosen and is not in the new class, clear selection
    if (selectedStudentId) {
      const stu = students.find((s) => s.id === selectedStudentId);
      if (!stu || stu.classId !== newClassId) {
        setSelectedStudentId('');
      }
    }
    setStudentSearchQuery('');
    setIsSearchDropdownOpen(false);
    setErrorMessage(null);
  };

  const handleSelectStudent = (stu: Student) => {
    setSelectedStudentId(stu.id);
    setSelectedClassId(stu.classId || selectedClassId);
    setStudentSearchQuery('');
    setIsSearchDropdownOpen(false);
    setErrorMessage(null);
  };

  const handleClearSelectedStudent = () => {
    setSelectedStudentId('');
    setStudentSearchQuery('');
    setIsSearchDropdownOpen(false);
    setErrorMessage(null);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleMinuteChipClick = (mins: number) => {
    setDelayMinutesInput(String(mins));
    setErrorMessage(null);
  };

  // -------------------------------------------------------------
  // Submission
  // -------------------------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSubmittingRef.current) return;
    setErrorMessage(null);

    // Validation 1: Class
    const effectiveClassId = selectedClassId || selectedStudent?.classId;
    if (!effectiveClassId) {
      setErrorMessage('لطفاً ابتدا کلاس را انتخاب کنید.');
      return;
    }

    // Validation 2: Student
    if (!selectedStudentId || !selectedStudent) {
      setErrorMessage('لطفاً دانش‌آموز را انتخاب کنید.');
      return;
    }

    // Validation 3: Date
    const cleanDate = toEnglishDigits(date.trim());
    if (!cleanDate || cleanDate.length < 8) {
      setErrorMessage('لطفاً تاریخ تأخیر را بررسی کنید.');
      return;
    }

    // Validation 4: Delay minutes
    if (!delayMinutesInput.trim()) {
      setErrorMessage('لطفاً مدت تأخیر را وارد کنید.');
      return;
    }

    if (isNaN(parsedMinutes) || parsedMinutes <= 0) {
      setErrorMessage('مدت تأخیر باید یک عدد مثبت باشد.');
      return;
    }

    // Duplicate check for same student on the same day
    const isDuplicate = morningDelays.some(
      (m) => m.studentId === selectedStudentId && toEnglishDigits(m.date) === cleanDate && (!editRecord || m.id !== editRecord.id)
    );
    if (isDuplicate) {
      setErrorMessage(
        `برای دانش‌آموز «${selectedStudent.firstName} ${selectedStudent.lastName}» در تاریخ ${toPersianDigits(cleanDate)} قبلاً سند تأخیر ورود ثبت شده است.`
      );
      return;
    }

    const dayOfWeek = getDayOfWeekFromShamsi(cleanDate);
    const studentFullName = `${selectedStudent.firstName} ${selectedStudent.lastName}`;

    // Current arrival time calculation
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMin = String(now.getMinutes()).padStart(2, '0');
    const arrivalTime = editRecord?.arrivalTime || `${currentHour}:${currentMin}`;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      if (editRecord) {
        updateMorningDelay(editRecord.id, {
          studentId: selectedStudentId,
          studentName: studentFullName,
          classId: selectedStudent.classId || effectiveClassId,
          date: cleanDate,
          dayOfWeek,
          arrivalTime,
          delayMinutes: parsedMinutes,
          reason: reason.trim() || undefined,
          isExcused,
        });
        showToast(`تغییرات تأخیر ${studentFullName} با موفقیت ذخیره شد.`, 'success');
      } else {
        addMorningDelay({
          studentId: selectedStudentId,
          studentName: studentFullName,
          classId: selectedStudent.classId || effectiveClassId,
          date: cleanDate,
          dayOfWeek,
          arrivalTime,
          delayMinutes: parsedMinutes,
          reason: reason.trim() || undefined,
          isExcused,
          recordedBy: `${currentUser.name} (${currentUser.roleTitle})`,
        });
        // Note: addMorningDelay already provides toast feedback
      }
      onClose();
    } catch {
      setErrorMessage('ثبت تأخیر انجام نشد. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="morning-delay-modal-backdrop"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
      dir="rtl"
    >
      <div 
        id="morning-delay-modal-container"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
      >
        
        {/* ========================================================= */}
        {/* 1. Header فرم */}
        {/* ========================================================= */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                {editRecord ? 'ویرایش تأخیر' : 'ثبت تأخیر'}
              </h2>
              <p className="text-[11px] text-slate-400">
                تأخیر ورود دانش‌آموز به مدرسه را ثبت کنید.
              </p>
            </div>
          </div>

          <button
            id="morning-delay-close-btn"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================= */}
        {/* Modal Form Body */}
        {/* ========================================================= */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-right">
          
          {/* Inline Error Message */}
          {errorMessage && (
            <div 
              role="alert" 
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ======================================================= */}
          {/* 2 & 3 & 4. بخش انتخاب دانش‌آموز (کلاس -> دانش‌آموز) */}
          {/* ======================================================= */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              دانش‌آموز <span className="text-rose-600">*</span>
            </label>

            {/* حالت الف: دانش‌آموز قبلاً انتخاب شده (کارت بسیار کوچک و جمع‌وجور) */}
            {selectedStudent ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {selectedStudent.firstName} {selectedStudent.lastName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {selectedClass ? selectedClass.name : 'بدون کلاس'}
                      {selectedStudent.fatherName ? ` • فرزند ${selectedStudent.fatherName}` : ''}
                    </div>
                  </div>
                </div>

                {!editRecord && (
                  <button
                    type="button"
                    onClick={handleClearSelectedStudent}
                    className="px-2.5 py-1 text-xs font-bold text-amber-700 hover:text-amber-800 hover:bg-amber-100/60 rounded-lg transition cursor-pointer shrink-0"
                    title="تغییر دانش‌آموز یا کلاس"
                  >
                    تغییر
                  </button>
                )}
              </div>
            ) : (
              /* حالت ب: دانش‌آموز هنوز انتخاب نشده است */
              <div className="space-y-2.5 bg-slate-50/70 border border-slate-200/80 rounded-xl p-3">
                
                {/* انتخاب کلاس */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-600">کلاس</span>
                    {selectedClassId && (
                      <span className="text-[10px] text-slate-400">
                        {toPersianDigits(classStudents.length)} دانش‌آموز
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <select
                      id="delay-class-select"
                      value={selectedClassId}
                      onChange={(e) => handleClassChange(e.target.value)}
                      className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 transition cursor-pointer"
                    >
                      <option value="">انتخاب کلاس...</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* انتخاب دانش‌آموز (فقط پس از انتخاب کلاس) */}
                {!selectedClassId ? (
                  <div className="py-2 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white/60">
                    ابتدا کلاس را انتخاب کنید.
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <input
                        ref={searchInputRef}
                        id="delay-student-search-input"
                        type="text"
                        value={studentSearchQuery}
                        onChange={(e) => {
                          setStudentSearchQuery(e.target.value);
                          setIsSearchDropdownOpen(true);
                          setErrorMessage(null);
                        }}
                        onFocus={() => setIsSearchDropdownOpen(true)}
                        placeholder="جستجوی نام دانش‌آموز..."
                        className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-lg pr-8 pl-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 transition"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                    </div>

                    {/* لیست هدفمند جستجو (فقط در زمان باز بودن یا جستجو) */}
                    {isSearchDropdownOpen && (
                      <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-44 overflow-y-auto divide-y divide-slate-100 z-20">
                        {filteredStudents.length > 0 ? (
                          filteredStudents.map((stu) => (
                            <button
                              type="button"
                              key={stu.id}
                              onClick={() => handleSelectStudent(stu)}
                              className="w-full px-3 py-2 text-right text-xs hover:bg-amber-50/70 flex items-center justify-between transition cursor-pointer group"
                            >
                              <span className="font-bold text-slate-800 group-hover:text-amber-950">
                                {stu.firstName} {stu.lastName}
                              </span>
                              {stu.fatherName && (
                                <span className="text-[11px] text-slate-400">
                                  فرزند {stu.fatherName}
                                </span>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-xs text-slate-400">
                            دانش‌آموزی با این نام در این کلاس یافت نشد.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ======================================================= */}
          {/* 5. مدت تأخیر — ورودی دستی و چیپ‌های سریع */}
          {/* ======================================================= */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              مدت تأخیر <span className="text-rose-600">*</span>
            </label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="delay-minutes-input"
                  type="number"
                  min="1"
                  step="1"
                  value={delayMinutesInput}
                  onChange={(e) => {
                    setDelayMinutesInput(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="۱۵"
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition text-center"
                />
              </div>
              <span className="text-xs font-bold text-slate-500 shrink-0">
                دقیقه
              </span>
            </div>

            {/* Quick Selection Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] text-slate-400 ml-1">انتخاب سریع:</span>
              {QUICK_MINUTE_OPTIONS.map((mins) => {
                const isActive = parsedMinutes === mins;
                return (
                  <button
                    type="button"
                    key={mins}
                    onClick={() => handleMinuteChipClick(mins)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {toPersianDigits(mins)} دقیقه
                  </button>
                );
              })}
            </div>
          </div>

          {/* ======================================================= */}
          {/* 6. تاریخ تأخیر (جمع‌وجور و ثانویه) */}
          {/* ======================================================= */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                تاریخ تأخیر
              </label>
              <span className="text-[10px] text-slate-400">
                پیش‌فرض: امروز
              </span>
            </div>

            <div className="relative">
              <input
                id="delay-date-input"
                type="text"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder={todayInfo.formattedDate}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-2 text-slate-800 font-mono outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
              />
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* ======================================================= */}
          {/* 7. توضیحات (اختیاری) */}
          {/* ======================================================= */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              توضیحات <span className="text-slate-400 font-normal">(اختیاری)</span>
            </label>
            <textarea
              id="delay-reason-textarea"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثلاً: تأخیر به دلیل ترافیک یا هماهنگی قبلی..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition resize-none"
            />
          </div>

          {/* ======================================================= */}
          {/* 8. وضعیت موجه بودن (Progressive Disclosure) */}
          {/* ======================================================= */}
          <div className="pt-1">
            <label className="inline-flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
              <input
                id="delay-excused-checkbox"
                type="checkbox"
                checked={isExcused}
                onChange={(e) => setIsExcused(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
              />
              <div>
                <span className="font-bold block text-slate-800">
                  تأخیر موجه است
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  برای تأخیرهایی که با هماهنگی مدرسه یا ارائه گواهی تأیید شده‌اند.
                </span>
              </div>
            </label>
          </div>

          {/* ======================================================= */}
          {/* 9. خلاصه قبل از ثبت (Quick Verification Summary) */}
          {/* ======================================================= */}
          {selectedStudent && isDelayValid && (
            <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3 text-xs text-slate-800 space-y-1 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">دانش‌آموز:</span>
                <span className="font-bold text-slate-900">
                  {selectedStudent.firstName} {selectedStudent.lastName} ({selectedClass?.name || 'کلاس'})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">مدت تأخیر:</span>
                <span className="font-bold text-amber-800">
                  {toPersianDigits(parsedMinutes)} دقیقه
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">وضعیت:</span>
                <span className={`font-bold ${isExcused ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {isExcused ? 'موجه' : 'عادی'}
                </span>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* 10. Footer Actions */}
          {/* ======================================================= */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              id="morning-delay-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>

            <button
              id="morning-delay-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>در حال ثبت...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editRecord ? 'ذخیره تغییرات' : 'ثبت تأخیر'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
