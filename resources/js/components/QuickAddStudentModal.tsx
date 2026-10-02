import React, { useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { X, UserPlus, Users, Check, Loader2 } from 'lucide-react';

interface QuickAddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClassId?: string;
}

export const QuickAddStudentModal: React.FC<QuickAddStudentModalProps> = ({
  isOpen,
  onClose,
  defaultClassId,
}) => {
  const { classes, addStudent, addStudentsBatch } = useSchool();
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [selectedClassId, setSelectedClassId] = useState(defaultClassId || classes[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Single mode state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [nationalId, setNationalId] = useState('');

  // Batch mode state
  const [batchNames, setBatchNames] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!firstName.trim() || !lastName.trim() || !selectedClassId) {
      setErrorText('لطفاً نام، نام خانوادگی و کلاس را مشخص نمایید.');
      return;
    }

    setIsSubmitting(true);
    try {
      addStudent({
        classId: selectedClassId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fatherName: fatherName.trim(),
        parentPhone: parentPhone.trim() || '۰۹۱۲۰۰۰۰۰۰۰',
        nationalId: nationalId.trim() || '۰۰۰۰۰۰۰۰۰۰',
        studentCode: String(Math.floor(100000 + Math.random() * 900000)),
        disciplineScore: 20,
      });

      onClose();
      setFirstName('');
      setLastName('');
      setFatherName('');
      setParentPhone('');
      setNationalId('');
      setErrorText(null);
    } catch {
      setErrorText('خطا در ثبت دانش‌آموز. لطفاً مجدداً تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!batchNames.trim() || !selectedClassId) {
      setErrorText('لطفاً اسامی دانش‌آموزان و کلاس را وارد کنید.');
      return;
    }

    const names = batchNames
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) return;

    setIsSubmitting(true);
    try {
      addStudentsBatch(selectedClassId, names);
      onClose();
      setBatchNames('');
      setErrorText(null);
    } catch {
      setErrorText('خطا در ثبت گروهی دانش‌آموزان. لطفاً اطلاعات را بررسی کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">ثبت‌نام سریع دانش‌آموز</h3>
              <p className="text-xs text-slate-500">افزودن فردی یا گروهی به کلاس</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 pt-4 pb-2">
          <button
            type="button"
            onClick={() => {
              setMode('single');
              setErrorText(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
              mode === 'single'
                ? 'bg-teal-800 text-white border-teal-800'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            ثبت انفرادی با مشخصات
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('batch');
              setErrorText(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
              mode === 'batch'
                ? 'bg-teal-800 text-white border-teal-800'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            ثبت گروهی (لیست اسامی)
          </button>
        </div>

        {errorText && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-2.5 rounded-xl font-medium mt-2">
            {errorText}
          </div>
        )}

        {/* Class selector */}
        <div className="pt-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            کلاس مقصد <span className="text-rose-500">*</span>:
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
          >
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Forms */}
        {mode === 'single' ? (
          <form onSubmit={handleSubmitSingle} className="space-y-3 pt-3 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نام <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="مثال: علی"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نام خانوادگی <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="مثال: حسینی"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نام پدر:
                </label>
                <input
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="مثال: رضا"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شماره تماس اولیاء:
                </label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="۰۹۱۲..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-left focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                کد ملی:
              </label>
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="۱۰ رقم"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-left focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition"
                dir="ltr"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5 ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت دانش‌آموز'}</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitBatch} className="space-y-3 pt-3 overflow-y-auto">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                لیست اسامی (هر دانش‌آموز در یک خط):
              </label>
              <textarea
                rows={6}
                value={batchNames}
                onChange={(e) => setBatchNames(e.target.value)}
                placeholder={`محمد رضایی\nعلی کاظمی\nحسین صادقی\nامیرحسین مرادی`}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition resize-none leading-relaxed"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                می‌توانید ستون اسامی را مستقیماً از فایل اکسل کپی و در کادر بالا جای‌گذاری کنید.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5 ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isSubmitting ? 'در حال ثبت...' : 'ثبت گروهی دانش‌آموزان'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
