import React, { useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { 
  X, 
  Search, 
  UserPlus, 
  ArrowRightLeft, 
  Check, 
  AlertCircle, 
  UserCheck, 
  Users, 
  Plus, 
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface AddStudentToClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  classData: SchoolClass;
}

export const AddStudentToClassModal: React.FC<AddStudentToClassModalProps> = ({
  isOpen,
  onClose,
  classData,
}) => {
  const { 
    students, 
    classes, 
    assignStudentToClass, 
    transferStudentClass, 
    addStudent, 
    addStudentsBatch,
    showToast
  } = useSchool();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeMode, setActiveMode] = useState<'search' | 'create_new' | 'batch'>('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [studentToTransfer, setStudentToTransfer] = useState<Student | null>(null);

  // New Student Form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  // Batch text
  const [batchText, setBatchText] = useState('');

  if (!isOpen) return null;

  // Filter students from the entire school
  const filteredStudents = searchTerm.trim().length > 0 
    ? students.filter((s) => {
        const full = `${s.firstName} ${s.lastName} ${s.studentCode || ''} ${s.nationalId || ''}`.toLowerCase();
        return full.includes(searchTerm.toLowerCase().trim());
      })
    : [];

  const handleAssignExisting = async (stu: Student) => {
    if (isSubmitting) return;
    if (!stu.classId) {
      try {
        setIsSubmitting(true);
        assignStudentToClass(stu.id, classData.id);
        showToast('افزودن دانش‌آموز', `دانش‌آموز «${stu.firstName} ${stu.lastName}» به کلاس اضافه شد.`, 'success');
        onClose();
      } catch (err) {
        console.error('Assign student error:', err);
        showToast('خطا', 'هنگام افزودن دانش‌آموز به کلاس خطایی رخ داد.', 'error');
      } finally {
        setIsSubmitting(false);
      }
    } else if (stu.classId !== classData.id) {
      setStudentToTransfer(stu);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!studentToTransfer || isSubmitting) return;
    try {
      setIsSubmitting(true);
      transferStudentClass(studentToTransfer.id, classData.id);
      showToast('انتقال دانش‌آموز', `دانش‌آموز «${studentToTransfer.firstName} ${studentToTransfer.lastName}» با حفظ سوابق به ${classData.name} منتقل شد.`, 'success');
      setStudentToTransfer(null);
      onClose();
    } catch (err) {
      console.error('Transfer student error:', err);
      showToast('خطا', 'هنگام انتقال دانش‌آموز خطایی رخ داد.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!firstName.trim() || !lastName.trim()) {
      setErrorText('لطفاً نام و نام خانوادگی دانش‌آموز را وارد کنید.');
      return;
    }

    try {
      setIsSubmitting(true);
      const generatedCode = studentCode.trim() || Math.floor(10000000 + Math.random() * 90000000).toString();
      addStudent({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fatherName: fatherName.trim() || undefined,
        nationalId: nationalId.trim() || '',
        studentCode: generatedCode,
        parentPhone: parentPhone.trim() || '09120000000',
        classId: classData.id,
      });

      showToast('ثبت موفق', `دانش‌آموز جدید «${firstName.trim()} ${lastName.trim()}» با موفقیت در کلاس ثبت شد.`, 'success');
      onClose();
    } catch (err) {
      console.error('Create student error:', err);
      setErrorText('خطا در ثبت دانش‌آموز. لطفاً مجدداً بررسی و اقدام کنید.');
      showToast('خطا', 'هنگام ثبت دانش‌آموز مشکلی رخ داد.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const names = batchText
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      setErrorText('لطفاً حداقل یک نام وارد کنید.');
      return;
    }

    try {
      setIsSubmitting(true);
      addStudentsBatch(classData.id, names);
      showToast('ثبت گروهی موفق', `${toPersianDigits(names.length)} دانش‌آموز به کلاس اضافه شدند.`, 'success');
      onClose();
    } catch (err) {
      console.error('Batch add error:', err);
      setErrorText('خطا در ثبت گروهی دانش‌آموزان.');
      showToast('خطا', 'هنگام ثبت گروهی خطایی رخ داد.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 font-['Vazirmatn',sans-serif]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">افزودن دانش‌آموز به {classData.name}</h2>
              <p className="text-xs text-slate-400">جستجوی دانش‌آموزان موجود در مدرسه یا ثبت عضو جدید</p>
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

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveMode('search');
              setErrorText(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'search'
                ? 'border-teal-800 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>جستجو در دانش‌آموزان مدرسه</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('create_new');
              setErrorText(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'create_new'
                ? 'border-teal-800 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ثبت دانش‌آموز جدید</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('batch');
              setErrorText(null);
            }}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'batch'
                ? 'border-teal-800 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>افزودن گروهی (متنی)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[75vh] overflow-y-auto">

          {/* TAB 1: SEARCH & ASSIGN / TRANSFER */}
          {activeMode === 'search' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  جستجوی دانش‌آموز بر اساس نام، نام خانوادگی، کد ملی یا شماره پرونده:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="نام یا کد دانش‌آموز را جستجو کنید..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition font-medium"
                  />
                </div>
              </div>

              {/* Transfer Confirmation Box if user clicked transfer */}
              {studentToTransfer && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>انتقال دانش‌آموز بین کلاس‌ها</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    دانش‌آموز <b>{studentToTransfer.firstName} {studentToTransfer.lastName}</b> در حال حاضر در{' '}
                    <b>{classes.find((c) => c.id === studentToTransfer.classId)?.name || 'کلاس دیگری'}</b> عضو است.
                  </p>
                  <p className="text-[11px] text-amber-700">
                    با انتقال به کلاس <b>{classData.name}</b>، کلیه سوابق قبلی او (حضور و غیاب، تاخیرها، انضباط و پرونده) به صورت یکپارچه حفظ خواهد شد و رکورد تکراری ایجاد نمی‌شود.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleConfirmTransfer}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                      <span>{isSubmitting ? 'در حال انتقال...' : 'انتقال به این کلاس'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentToTransfer(null)}
                      disabled={isSubmitting}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}

              {/* Search Results */}
              {searchTerm.trim().length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-500">
                    نتایج جستجو ({toPersianDigits(filteredStudents.length)} مورد):
                  </div>

                  {filteredStudents.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                      دانش‌آموزی با این مشخصات یافت نشد. می‌توانید از تب «ثبت دانش‌آموز جدید» او را به مدرسه اضافه کنید.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {filteredStudents.map((stu) => {
                        const currentCls = classes.find((c) => c.id === stu.classId);
                        const isInThisClass = stu.classId === classData.id;
                        const isUnassigned = !stu.classId;

                        return (
                          <div
                            key={stu.id}
                            className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-teal-200 transition"
                          >
                            <div>
                              <div className="font-bold text-xs text-slate-900">
                                {stu.firstName} {stu.lastName}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                {stu.studentCode && <span>کد: {toPersianDigits(stu.studentCode)}</span>}
                                {stu.nationalId && <span>کد ملی: {toPersianDigits(stu.nationalId)}</span>}
                              </div>
                              <div className="mt-1">
                                {isInThisClass ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    <Check className="w-3 h-3" />
                                    <span>عضو همین کلاس است</span>
                                  </span>
                                ) : isUnassigned ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                                    <span>کلاس فعلی: بدون کلاس</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                                    <span>کلاس فعلی: {currentCls?.name || 'کلاس دیگر'}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              {isInThisClass ? (
                                <button
                                  disabled
                                  className="px-3 py-1.5 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed"
                                >
                                  عضو کلاس
                                </button>
                              ) : isUnassigned ? (
                                <button
                                  onClick={() => handleAssignExisting(stu)}
                                  disabled={isSubmitting}
                                  className="px-3.5 py-1.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                                  <span>افزودن به این کلاس</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAssignExisting(stu)}
                                  disabled={isSubmitting}
                                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                  <span>انتقال به این کلاس</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {searchTerm.trim().length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                  برای یافتن دانش‌آموزان مدرسه، نام یا شماره دانش‌آموزی را در کادر بالا تایپ کنید.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CREATE NEW STUDENT */}
          {activeMode === 'create_new' && (
            <form onSubmit={handleCreateNewStudent} className="space-y-3.5">
              {errorText && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorText}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="مثلاً: علی"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام خانوادگی <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="مثلاً: محمدی"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام پدر
                  </label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="مثلاً: رضا"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره همراه ولی
                  </label>
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    کد ملی
                  </label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="۱۰ رقمی"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره دانش‌آموزی (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    placeholder="تولید خودکار در صورت خالی بودن"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
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
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت و افزودن به کلاس'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: BATCH NAMES */}
          {activeMode === 'batch' && (
            <form onSubmit={handleBatchSubmit} className="space-y-3">
              {errorText && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorText}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نام و نام خانوادگی دانش‌آموزان (هر دانش‌آموز در یک خط):
                </label>
                <textarea
                  rows={6}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder={`محمد محمدی\nعلی رضایی\nحسین حسینی`}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-teal-700 outline-none font-medium leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  سامانه برای هر فرد کد دانش‌آموزی و مشخصات اولیه را به صورت خودکار ایجاد و به کلاس تخصیص می‌دهد.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
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
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'در حال ثبت گروهی...' : 'ثبت گروهی در کلاس'}</span>
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
