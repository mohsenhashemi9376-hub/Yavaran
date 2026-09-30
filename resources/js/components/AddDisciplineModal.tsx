import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Student, SchoolClass, DisciplinaryNote } from '../types';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';
import { 
  X, 
  ShieldAlert, 
  Search, 
  Check, 
  ChevronDown, 
  UserCheck, 
  RefreshCw,
  AlertCircle,
  Loader2
} from 'lucide-react';

export interface AddDisciplineModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classes: SchoolClass[];
  initialStudent?: Student | null;
  onAddNote?: (studentId: string, note: Omit<DisciplinaryNote, 'id'>) => void;
}

const QUICK_SUGGESTIONS = [
  'تأخیر',
  'بی‌نظمی',
  'عدم رعایت قوانین',
  'بی‌احترامی',
  'ایجاد مزاحمت در کلاس',
  'غیبت غیرموجه',
];

export const AddDisciplineModal: React.FC<AddDisciplineModalProps> = ({
  isOpen,
  onClose,
  students = [],
  classes = [],
  initialStudent = null,
  onAddNote,
}) => {
  const { addDisciplinaryNote, currentUser } = useSchool();
  const todayInfo = getTodayShamsi();

  // Selected Student State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [classFilter, setClassFilter] = useState('');

  // Form Fields
  const [incidentTitle, setIncidentTitle] = useState('');
  const [deductionInput, setDeductionInput] = useState('');
  const [details, setDetails] = useState('');
  const [date, setDate] = useState(todayInfo.formattedDate);

  // Field Errors (Inline Validation)
  const [studentError, setStudentError] = useState('');
  const [titleError, setTitleError] = useState('');
  const [deductionError, setDeductionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Synchronize initialStudent on open
  useEffect(() => {
    if (isOpen) {
      if (initialStudent) {
        setSelectedStudent(initialStudent);
      } else {
        setSelectedStudent(null);
      }
      setStudentSearch('');
      setIsDropdownOpen(false);
      setClassFilter('');
      setIncidentTitle('');
      setDeductionInput('');
      setDetails('');
      setDate(todayInfo.formattedDate);
      setStudentError('');
      setTitleError('');
      setDeductionError('');
    }
  }, [isOpen, initialStudent, todayInfo.formattedDate]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Filter students for search
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (classFilter && s.classId !== classFilter) {
        return false;
      }
      if (studentSearch.trim()) {
        const query = studentSearch.trim().toLowerCase();
        const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
        const code = (s.studentCode || '').toLowerCase();
        const nationalId = (s.nationalId || '').toLowerCase();
        return fullName.includes(query) || code.includes(query) || nationalId.includes(query);
      }
      return true;
    });
  }, [students, classFilter, studentSearch]);

  if (!isOpen) return null;

  // Selected student's class name
  const selectedStudentClass = selectedStudent
    ? classes.find((c) => c.id === selectedStudent.classId)
    : null;

  // Validate Score Deduction (only positive numbers allowed)
  const handleDeductionChange = (val: string) => {
    setDeductionInput(val);
    setDeductionError('');

    if (val.trim() === '') return;

    const parsed = Number(val);
    if (isNaN(parsed) || parsed < 0) {
      setDeductionError('تعداد امتیاز را به صورت یک عدد مثبت وارد کنید.');
    } else if (parsed > 20) {
      setDeductionError('تعداد امتیاز نمی‌تواند بیشتر از ۲۰ باشد.');
    }
  };

  // Form Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    let hasError = false;

    if (!selectedStudent) {
      setStudentError('لطفاً یک دانش‌آموز انتخاب کنید.');
      hasError = true;
    } else {
      setStudentError('');
    }

    if (!incidentTitle.trim()) {
      setTitleError('لطفاً مورد انضباطی را وارد کنید.');
      hasError = true;
    } else {
      setTitleError('');
    }

    let deductionNumber = 0;
    if (deductionInput.trim() !== '') {
      const parsed = Number(deductionInput);
      if (isNaN(parsed) || parsed < 0) {
        setDeductionError('تعداد امتیاز را به صورت یک عدد مثبت وارد کنید.');
        hasError = true;
      } else if (parsed > 20) {
        setDeductionError('تعداد امتیاز نمی‌تواند بیشتر از ۲۰ باشد.');
        hasError = true;
      } else {
        deductionNumber = parsed;
        setDeductionError('');
      }
    }

    if (hasError || !selectedStudent) return;

    // Detect incident category
    const lowerTitle = incidentTitle.toLowerCase();
    let detectedType: 'delay' | 'absence' | 'behavior' | 'uniform' | 'other' = 'behavior';
    if (lowerTitle.includes('تأخیر') || lowerTitle.includes('تاخیر')) {
      detectedType = 'delay';
    } else if (lowerTitle.includes('غیبت')) {
      detectedType = 'absence';
    } else if (lowerTitle.includes('پوشش') || lowerTitle.includes('لباس') || lowerTitle.includes('مو')) {
      detectedType = 'uniform';
    }

    const recorderName = currentUser
      ? `${currentUser.name} (${currentUser.roleTitle})`
      : 'معاونت انضباطی';

    const notePayload: Omit<DisciplinaryNote, 'id'> = {
      date: date.trim() || todayInfo.formattedDate,
      title: incidentTitle.trim(),
      description: details.trim(),
      scoreDeduction: deductionNumber,
      recordedBy: recorderName,
      type: detectedType,
    };

    setIsSubmitting(true);
    try {
      // Store in Single Source of Truth
      if (onAddNote) {
        onAddNote(selectedStudent.id, notePayload);
      } else {
        addDisciplinaryNote(selectedStudent.id, notePayload);
      }
      onClose();
    } catch {
      setTitleError('ذخیره مورد انضباطی با مشکل مواجه شد. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const parsedDeduction = deductionInput.trim() !== '' ? Number(deductionInput) : 0;
  const isDeductionValid = !isNaN(parsedDeduction) && parsedDeduction > 0 && parsedDeduction <= 20;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in"
      dir="rtl"
      id="unified-add-discipline-modal"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">ثبت مورد انضباطی</h3>
              <p className="text-[11px] text-slate-500">ثبت و کسر امتیاز در کارنامه و پرونده دانش‌آموز</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="بستن"
            id="close-add-discipline-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* ========================================================= */}
          {/* 1. انتخاب دانش‌آموز */}
          {/* ========================================================= */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <span>دانش‌آموز</span>
                <span className="text-rose-500">*</span>
              </label>

              {/* فیلتر کلاس (اختیاری) */}
              {!selectedStudent && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">کلاس:</span>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 outline-hidden focus:ring-1 focus:ring-purple-600 cursor-pointer"
                    id="discipline-class-filter-select"
                  >
                    <option value="">همه کلاس‌ها</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {selectedStudent ? (
              /* کارت دانش‌آموز انتخاب‌شده */
              <div 
                className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 flex items-center justify-between transition"
                id="selected-student-summary-card"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                      {selectedStudent.firstName} {selectedStudent.lastName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {selectedStudentClass ? selectedStudentClass.name : 'کلاس نامشخص'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudent(null);
                      setStudentSearch('');
                      setStudentError('');
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                        setIsDropdownOpen(true);
                      }, 50);
                    }}
                    className="px-2.5 py-1 text-[11px] font-bold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    id="change-selected-student-btn"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>تغییر دانش‌آموز</span>
                  </button>
                </div>
              </div>
            ) : (
              /* جستجو و انتخاب دانش‌آموز (Combobox) */
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setIsDropdownOpen(true);
                      if (studentError) setStudentError('');
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="نام دانش‌آموز را جستجو کنید..."
                    className={`w-full pl-9 pr-9 py-2.5 bg-slate-50 border rounded-xl text-xs transition outline-hidden ${
                      studentError
                        ? 'border-rose-300 bg-rose-50/40 focus:ring-2 focus:ring-rose-400'
                        : 'border-slate-200 focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20'
                    }`}
                    id="search-student-discipline-input"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="absolute left-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-md transition cursor-pointer"
                    tabIndex={-1}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Dropdown List */}
                {isDropdownOpen && (
                  <div 
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto z-30 divide-y divide-slate-100 animate-in fade-in zoom-in-95"
                    id="student-combobox-dropdown"
                  >
                    {filteredStudents.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs">
                        دانش‌آموزی با این مشخصات یافت نشد.
                      </div>
                    ) : (
                      filteredStudents.map((st) => {
                        const stClass = classes.find((c) => c.id === st.classId);
                        return (
                          <button
                            type="button"
                            key={st.id}
                            onClick={() => {
                              setSelectedStudent(st);
                              setIsDropdownOpen(false);
                              setStudentSearch('');
                              setStudentError('');
                            }}
                            className="w-full px-3.5 py-2.5 text-right hover:bg-purple-50 transition flex items-center justify-between cursor-pointer group"
                          >
                            <div>
                              <div className="font-bold text-slate-900 group-hover:text-purple-900">
                                {st.firstName} {st.lastName}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {stClass ? stClass.name : 'کلاس نامشخص'}
                              </div>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              نمره: {toPersianDigits(st.disciplineScore ?? 20)}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Student Inline Error */}
            {studentError && (
              <p className="text-[11px] text-rose-600 font-medium mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{studentError}</span>
              </p>
            )}
          </div>

          {/* ========================================================= */}
          {/* 2. ثبت مورد انضباطی */}
          {/* ========================================================= */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              <span>مورد انضباطی</span>
              <span className="text-rose-500 mr-1">*</span>
            </label>
            <input
              type="text"
              value={incidentTitle}
              onChange={(e) => {
                setIncidentTitle(e.target.value);
                if (titleError) setTitleError('');
              }}
              placeholder="مثلاً: تأخیر، بی‌نظمی، عدم رعایت قوانین..."
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs transition outline-hidden ${
                titleError
                  ? 'border-rose-300 bg-rose-50/40 focus:ring-2 focus:ring-rose-400'
                  : 'border-slate-200 focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20'
              }`}
              id="discipline-incident-title-input"
            />

            {/* Quick Suggestions Chips */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <span className="text-[10px] text-slate-400">پیشنهاد سریع:</span>
              {QUICK_SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => {
                    setIncidentTitle(suggestion);
                    if (titleError) setTitleError('');
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    incidentTitle === suggestion
                      ? 'bg-purple-600 text-white border-purple-600 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Title Inline Error */}
            {titleError && (
              <p className="text-[11px] text-rose-600 font-medium mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{titleError}</span>
              </p>
            )}
          </div>

          {/* ========================================================= */}
          {/* 3. کسر امتیاز انضباطی (اختیاری) */}
          {/* ========================================================= */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800">
                کسر امتیاز انضباطی
              </label>
              <span className="text-[11px] text-slate-400">(اختیاری)</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
              در صورت نیاز، تعداد امتیازی که باید از انضباط دانش‌آموز کم شود را وارد کنید.
            </p>

            <div className="relative">
              <input
                type="number"
                step="0.25"
                min="0"
                max="20"
                value={deductionInput}
                onChange={(e) => handleDeductionChange(e.target.value)}
                placeholder="مثلاً ۱"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-mono transition outline-hidden ${
                  deductionError
                    ? 'border-rose-300 bg-rose-50/40 focus:ring-2 focus:ring-rose-400'
                    : 'border-slate-200 focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20'
                }`}
                id="discipline-score-deduction-input"
              />
            </div>

            {/* Dynamic Confirmation Message */}
            {isDeductionValid && (
              <p className="text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5 mt-2 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                <span>{toPersianDigits(deductionInput)} امتیاز از انضباط دانش‌آموز کسر می‌شود.</span>
              </p>
            )}

            {/* Deduction Inline Error */}
            {deductionError && (
              <p className="text-[11px] text-rose-600 font-medium mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{deductionError}</span>
              </p>
            )}
          </div>

          {/* ========================================================= */}
          {/* 4. توضیحات تکمیلی (اختیاری) */}
          {/* ========================================================= */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800">
                توضیحات تکمیلی
              </label>
              <span className="text-[11px] text-slate-400">(اختیاری)</span>
            </div>
            <textarea
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="در صورت نیاز، جزئیات بیشتری درباره این مورد بنویسید..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition outline-hidden resize-none"
              id="discipline-details-textarea"
            />
          </div>

          {/* ========================================================= */}
          {/* 5. تاریخ ثبت (پیش‌فرض امروز، قابل تغییر با تأکید بصری کمتر) */}
          {/* ========================================================= */}
          <div className="pt-1">
            <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
              <span className="text-[11px] text-slate-500 font-medium">تاریخ ثبت:</span>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-[11px] font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center w-28 focus:outline-hidden focus:border-purple-600"
                id="discipline-date-input"
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* 6. دکمه‌ها */}
          {/* ========================================================= */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              id="cancel-add-discipline-btn"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
              id="submit-add-discipline-btn"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت مورد انضباطی'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
