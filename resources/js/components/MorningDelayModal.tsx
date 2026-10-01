import React, { useState, useEffect, useMemo, useRef } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';
import { Student, MorningDelayRecord } from '../types';
import { toPersianDigits, toEnglishDigits, getTodayShamsi, getDayOfWeekFromShamsi } from '../utils/persianDate';
import { X, Search, Calendar, AlertCircle, Loader2, Check, Plus } from 'lucide-react';

interface MorningDelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStudent?: Student | null;
  initialClassId?: string | null;
  editRecord?: MorningDelayRecord | null;
}

const QUICK_MINUTE_OPTIONS = [5, 10, 15, 20, 30, 45];

// یکسان‌سازی حروف عربی/فارسی و حذف فاصله‌های اضافی برای جستجوی دقیق‌تر
const normalizeText = (value: string) =>
  toEnglishDigits(value || '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

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
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const [date, setDate] = useState<string>(todayInfo.formattedDate);
  const [delayMinutesInput, setDelayMinutesInput] = useState<string>('15');
  const [reason, setReason] = useState<string>('');
  const [isExcused, setIsExcused] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [isEditingDate, setIsEditingDate] = useState<boolean>(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(0);
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
      setShowDetails(false);
      setIsEditingDate(false);
      setHighlightIndex(0);

      if (editRecord) {
        // Editing existing delay record
        setSelectedStudentId(editRecord.studentId);
        setDate(toEnglishDigits(editRecord.date));
        setDelayMinutesInput(String(editRecord.delayMinutes || 15));
        setReason(editRecord.reason || '');
        setIsExcused(editRecord.isExcused ?? false);
        setShowDetails(Boolean(editRecord.reason) || Boolean(editRecord.isExcused));
        setStudentSearchQuery('');
      } else if (initialStudent) {
        // Opened with preselected student (e.g. from Student Profile)
        setSelectedStudentId(initialStudent.id);
        setDate(todayInfo.formattedDate);
        setDelayMinutesInput('15');
        setReason('');
        setIsExcused(false);
        setStudentSearchQuery('');
      } else if (initialClassId) {
        // Opened with preselected class (e.g. from Class Profile)
        setSelectedStudentId('');
        setDate(todayInfo.formattedDate);
        setDelayMinutesInput('15');
        setReason('');
        setIsExcused(false);
        setStudentSearchQuery('');
      } else {
        // Fresh empty registration
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
  const classNameOf = (classId?: string) => classes.find((c) => c.id === classId)?.name || 'بدون کلاس';

  // جستجوی مستقیم در بین تمام دانش‌آموزان (نام، نام خانوادگی، کد دانش‌آموزی)
  const filteredStudents = useMemo(() => {
    const query = normalizeText(studentSearchQuery);
    if (!query) return [];
    const words = query.split(' ');
    return students
      .filter((stu) => {
        const haystack = normalizeText(`${stu.firstName} ${stu.lastName} ${stu.studentCode || ''}`);
        return words.every((w) => haystack.includes(w));
      })
      .slice(0, 8);
  }, [students, studentSearchQuery]);

  const parsedMinutes = Number(toEnglishDigits(delayMinutesInput.trim()));
  const isDelayValid = !isNaN(parsedMinutes) && parsedMinutes > 0;
  const isQuickValue = QUICK_MINUTE_OPTIONS.includes(parsedMinutes);

  // -------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------
  const handleSelectStudent = (stu: Student) => {
    setSelectedStudentId(stu.id);
    setStudentSearchQuery('');
    setIsSearchDropdownOpen(false);
    setErrorMessage(null);
  };

  const handleClearSelectedStudent = () => {
    setSelectedStudentId('');
    setStudentSearchQuery('');
    setErrorMessage(null);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filteredStudents.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % filteredStudents.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + filteredStudents.length) % filteredStudents.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectStudent(filteredStudents[Math.min(highlightIndex, filteredStudents.length - 1)]);
    }
  };

  // فوکوس خودکار روی جستجو هنگام باز شدن فرم ثبت جدید
  useEffect(() => {
    if (isOpen && !editRecord && !initialStudent) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen, editRecord?.id, initialStudent?.id]);

  // -------------------------------------------------------------
  // Submission
  // -------------------------------------------------------------
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSubmittingRef.current) return;
    setErrorMessage(null);

    if (!selectedStudentId || !selectedStudent) {
      setErrorMessage('لطفاً دانش‌آموز را انتخاب کنید.');
      return;
    }

    const cleanDate = toEnglishDigits(date.trim());
    if (!cleanDate || cleanDate.length < 8) {
      setErrorMessage('لطفاً تاریخ تأخیر را بررسی کنید.');
      return;
    }

    if (!isDelayValid) {
      setErrorMessage('مدت تأخیر را انتخاب کنید.');
      return;
    }

    const isDuplicate = morningDelays.some(
      (m) => m.studentId === selectedStudentId && toEnglishDigits(m.date) === cleanDate && (!editRecord || m.id !== editRecord.id)
    );
    if (isDuplicate) {
      setErrorMessage(
        `برای «${selectedStudent.firstName} ${selectedStudent.lastName}» در تاریخ ${toPersianDigits(cleanDate)} قبلاً تأخیر ثبت شده است.`
      );
      return;
    }

    const dayOfWeek = getDayOfWeekFromShamsi(cleanDate);
    const studentFullName = `${selectedStudent.firstName} ${selectedStudent.lastName}`;

    const now = tehranNow();
    const arrivalTime =
      editRecord?.arrivalTime ||
      `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const payload = {
        studentId: selectedStudentId,
        studentName: studentFullName,
        classId: selectedStudent.classId || '',
        date: cleanDate,
        dayOfWeek,
        arrivalTime,
        delayMinutes: parsedMinutes,
        reason: reason.trim() || undefined,
        isExcused,
      };
      if (editRecord) {
        updateMorningDelay(editRecord.id, payload);
        showToast(`تغییرات تأخیر ${studentFullName} با موفقیت ذخیره شد.`, 'success');
      } else {
        addMorningDelay({ ...payload, recordedBy: `${currentUser.name} (${currentUser.roleTitle})` });
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

  const isToday = toEnglishDigits(date) === todayInfo.formattedDate;

  return (
    <div
      id="morning-delay-modal-backdrop"
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="morning-delay-modal-container"
        className="bg-white rounded-3xl shadow-2xl shadow-slate-900/10 w-full max-w-md flex flex-col max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">
            {editRecord ? 'ویرایش تأخیر' : 'ثبت تأخیر'}
          </h2>
          <button
            id="morning-delay-close-btn"
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-5 text-right">
          {errorMessage && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* دانش‌آموز */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">دانش‌آموز</label>

            {selectedStudent ? (
              <div className="bg-emerald-50 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900 text-sm truncate">
                    {selectedStudent.firstName} {selectedStudent.lastName}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{classNameOf(selectedStudent.classId)}</div>
                </div>
                {!editRecord && (
                  <button
                    type="button"
                    onClick={handleClearSelectedStudent}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 rounded-xl transition cursor-pointer shrink-0"
                  >
                    تغییر
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  id="delay-student-search-input"
                  type="text"
                  autoComplete="off"
                  value={studentSearchQuery}
                  onChange={(e) => {
                    setStudentSearchQuery(e.target.value);
                    setIsSearchDropdownOpen(true);
                    setHighlightIndex(0);
                    setErrorMessage(null);
                  }}
                  onFocus={() => setIsSearchDropdownOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="نام یا نام خانوادگی دانش‌آموز..."
                  className="w-full text-base bg-slate-50 rounded-2xl pr-12 pl-4 py-3.5 text-slate-900 outline-none border border-transparent focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 transition"
                />

                {isSearchDropdownOpen && studentSearchQuery.trim() && (
                  <div className="absolute top-full right-0 left-0 mt-2 bg-white rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-100 max-h-64 overflow-y-auto p-1.5 z-20">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((stu, idx) => (
                        <button
                          type="button"
                          key={stu.id}
                          onClick={() => handleSelectStudent(stu)}
                          onMouseEnter={() => setHighlightIndex(idx)}
                          className={`w-full px-3 py-2.5 text-right rounded-xl flex items-center justify-between gap-3 transition cursor-pointer ${
                            idx === highlightIndex ? 'bg-emerald-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-bold text-sm text-slate-900 truncate">
                            {stu.firstName} {stu.lastName}
                          </span>
                          <span className="text-xs text-slate-500 shrink-0 bg-slate-100 rounded-lg px-2 py-0.5">
                            {classNameOf(stu.classId)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-400">دانش‌آموزی یافت نشد.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* مدت تأخیر */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">مدت تأخیر (دقیقه)</label>
            <div className="grid grid-cols-3 gap-2.5">
              {QUICK_MINUTE_OPTIONS.map((mins) => {
                const active = parsedMinutes === mins;
                return (
                  <button
                    type="button"
                    key={mins}
                    onClick={() => {
                      setDelayMinutesInput(String(mins));
                      setErrorMessage(null);
                    }}
                    className={`h-14 rounded-2xl text-xl font-extrabold transition cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {toPersianDigits(mins)}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>مقدار دیگر:</span>
              <input
                id="delay-minutes-input"
                type="text"
                inputMode="numeric"
                value={isQuickValue ? '' : toPersianDigits(delayMinutesInput)}
                onChange={(e) => {
                  setDelayMinutesInput(toEnglishDigits(e.target.value).replace(/[^0-9]/g, ''));
                  setErrorMessage(null);
                }}
                placeholder="مثلاً ۲۵"
                className="w-24 text-center text-sm font-bold bg-slate-50 rounded-xl px-3 py-2 text-slate-900 outline-none border border-transparent focus:border-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* تاریخ */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-700">تاریخ</span>
            {isEditingDate ? (
              <input
                id="delay-date-input"
                type="text"
                autoFocus
                value={toPersianDigits(date)}
                onChange={(e) => {
                  setDate(toEnglishDigits(e.target.value));
                  setErrorMessage(null);
                }}
                onBlur={() => setIsEditingDate(false)}
                className="w-36 text-center text-sm font-bold bg-slate-50 rounded-xl px-3 py-2 text-slate-900 outline-none border border-emerald-500"
              />
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingDate(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold transition cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{isToday ? 'امروز' : ''} {toPersianDigits(date)}</span>
              </button>
            )}
          </div>

          {/* توضیحات و موجه بودن (در صورت نیاز) */}
          {showDetails ? (
            <div className="space-y-3 animate-in fade-in">
              <textarea
                id="delay-reason-textarea"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="توضیحات (اختیاری)"
                className="w-full text-sm bg-slate-50 rounded-2xl p-3 text-slate-800 outline-none border border-transparent focus:border-emerald-500 focus:bg-white transition resize-none"
              />
              <label className="flex items-center gap-3 text-sm font-bold text-slate-700 cursor-pointer select-none">
                <input
                  id="delay-excused-checkbox"
                  type="checkbox"
                  checked={isExcused}
                  onChange={(e) => setIsExcused(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                />
                تأخیر موجه است
              </label>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-emerald-700 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              توضیحات / تأخیر موجه
            </button>
          )}

          {/* ثبت */}
          <button
            id="morning-delay-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className={`w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-base font-extrabold rounded-2xl shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>در حال ثبت...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>{editRecord ? 'ذخیره تغییرات' : 'ثبت تأخیر'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
