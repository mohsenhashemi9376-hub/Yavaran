import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { AcademicSubject, SubjectCategory } from '../types';
import { X, BookOpen, UserCheck, Award, Clock, Layers, Check, Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface EditSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject?: AcademicSubject | null; // If null/undefined, we are creating a new subject
}

const CATEGORIES: { label: SubjectCategory; color: string }[] = [
  { label: 'علوم پایه', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'ادبیات و معارف', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'زبان‌های خارجی', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { label: 'علوم اجتماعی و فرهنگ', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'مهارتی و فناوری', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { label: 'تربیت بدنی و سلامت', color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

const STANDARD_GRADES = ['پایه هفتم', 'پایه هشتم', 'پایه نهم'];

export const EditSubjectModal: React.FC<EditSubjectModalProps> = ({
  isOpen,
  onClose,
  subject,
}) => {
  const { allTeachers, addAcademicSubject, updateAcademicSubject, showToast } = useSchool();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [coefficient, setCoefficient] = useState('3');
  const [hoursPerWeek, setHoursPerWeek] = useState('3');
  const [category, setCategory] = useState<SubjectCategory>('علوم پایه');
  const [selectedGrades, setSelectedGrades] = useState<string[]>(['پایه هفتم', 'پایه هشتم', 'پایه نهم']);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [customTeacherName, setCustomTeacherName] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEditing = !!subject;

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (subject) {
        setName(subject.name || '');
        setCode(subject.code || '');
        setCoefficient(subject.coefficient?.toString() || '3');
        setHoursPerWeek(subject.hoursPerWeek?.toString() || '3');
        setCategory(subject.category || 'علوم پایه');
        setSelectedGrades(subject.targetGrades && subject.targetGrades.length > 0 ? subject.targetGrades : ['پایه هفتم', 'پایه هشتم', 'پایه نهم']);
        setSelectedTeacherId(subject.teacherId || '');
        setCustomTeacherName(subject.defaultTeacherName || '');
        setDescription(subject.description || '');
      } else {
        setName('');
        setCode('');
        setCoefficient('3');
        setHoursPerWeek('3');
        setCategory('علوم پایه');
        setSelectedGrades(['پایه هفتم', 'پایه هشتم', 'پایه نهم']);
        setSelectedTeacherId('');
        setCustomTeacherName('');
        setDescription('');
      }
    }
  }, [isOpen, subject]);

  if (!isOpen) return null;

  const toggleGrade = (grade: string) => {
    setSelectedGrades((prev) =>
      prev.includes(grade)
        ? prev.filter((g) => g !== grade)
        : [...prev, grade]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('لطفاً نام درس را وارد فرمایید.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const coeffNum = Math.max(1, parseInt(coefficient, 10) || 1);
      const hoursNum = Math.max(1, parseInt(hoursPerWeek, 10) || 1);

      // Resolve teacher name
      let teacherName = customTeacherName.trim();
      if (selectedTeacherId) {
        const foundTeacher = allTeachers.find((t) => t.id === selectedTeacherId);
        if (foundTeacher) {
          teacherName = foundTeacher.name;
        }
      }

      const subjectPayload: Omit<AcademicSubject, 'id'> = {
        name: trimmedName,
        code: code.trim() || undefined,
        coefficient: coeffNum,
        hoursPerWeek: hoursNum,
        category,
        grade: selectedGrades.join('، ') || 'عمومی متوسطه اول',
        targetGrades: selectedGrades.length > 0 ? selectedGrades : ['پایه هفتم', 'پایه هشتم', 'پایه نهم'],
        major: 'متوسطه اول',
        teacherId: selectedTeacherId || undefined,
        defaultTeacherName: teacherName || undefined,
        description: description.trim() || undefined,
      };

      if (isEditing && subject) {
        updateAcademicSubject(subject.id, subjectPayload);
        showToast('ویرایش درس', `درس «${trimmedName}» با موفقیت ویرایش شد.`, 'success');
      } else {
        addAcademicSubject(subjectPayload);
        showToast('درس جدید', `درس «${trimmedName}» با موفقیت به برنامه درسی افزوده شد.`, 'success');
      }

      onClose();
    } catch {
      setErrorMessage('خطایی در ذخیره درس رخ داد. لطفاً مجدداً تلاش نمایید.');
      showToast('خطا در ذخیره درس', 'لطفاً مقادیر وارد شده را بررسی کنید.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-8">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {isEditing ? `ویرایش درس: ${subject?.name}` : 'تعریف درس جدید (متوسطه اول)'}
              </h2>
              <p className="text-xs text-slate-400">
                تنظیمات برنامه درسی مصوب و انتساب مستقیم دبیر مربوطه
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Row 1: Name and Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نام رسمی درس <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: ریاضی، علوم تجربی، ادبیات فارسی"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                کد اختصاری درس
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثال: MATH"
                dir="ltr"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-left"
              />
            </div>
          </div>

          {/* Row 2: Coefficient, Hours, Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                ضریب واحد درسی
              </label>
              <select
                value={coefficient}
                onChange={(e) => setCoefficient(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              >
                <option value="1">ضریب ۱ (سبک)</option>
                <option value="2">ضریب ۲ (عمومی / مهارتی)</option>
                <option value="3">ضریب ۳ (تخصصی اصلی)</option>
                <option value="4">ضریب ۴ (تخصصی پایه - ریاضی/ادبیات)</option>
                <option value="5">ضریب ۵</option>
                <option value="6">ضریب ۶</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                ساعت تدریس در هفته
              </label>
              <select
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              >
                <option value="1">۱ ساعت در هفته</option>
                <option value="2">۲ ساعت در هفته</option>
                <option value="3">۳ ساعت در هفته</option>
                <option value="4">۴ ساعت در هفته</option>
                <option value="5">۵ ساعت در هفته</option>
                <option value="6">۶ ساعت در هفته</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                گروه درسی
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SubjectCategory)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.label} value={c.label}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Target Grades (پایه‌های تحت پوشش در متوسطه اول) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <label className="block text-xs font-bold text-slate-700 mb-2">
              پایه‌های تحصیلی تحت پوشش این درس (متوسطه اول):
            </label>
            <div className="flex flex-wrap gap-2.5">
              {STANDARD_GRADES.map((grade) => {
                const isSelected = selectedGrades.includes(grade);
                return (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => toggleGrade(grade)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                        isSelected ? 'bg-white text-indigo-600 border-white' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span>{grade}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 4: Teacher Assignment (اختصاص معلم به درس) */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">اختصاص دبیر مسئول به این درس</h4>
                  <p className="text-[11px] text-indigo-700">انتخاب استاد مسئول از کادر دبیری مدرسه یا ثبت نام آزاد</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  انتخاب از دبیران ثبت‌شده در سامانه
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => {
                    setSelectedTeacherId(e.target.value);
                    if (e.target.value) {
                      const t = allTeachers.find((tch) => tch.id === e.target.value);
                      if (t) setCustomTeacherName(t.name);
                    }
                  }}
                  className="w-full text-xs bg-white border border-indigo-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                >
                  <option value="">-- بدون انتخاب (یا تعیین نام دستی) --</option>
                  {allTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.roleTitle ? `(${t.roleTitle})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  نام نمایش داده‌شده دبیر در کارنامه و دفتر نمرات
                </label>
                <input
                  type="text"
                  value={customTeacherName}
                  onChange={(e) => setCustomTeacherName(e.target.value)}
                  placeholder="مثال: استاد احمد رضایی"
                  className="w-full text-xs bg-white border border-indigo-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {selectedTeacherId && (
              <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  دبیر انتخابی ({customTeacherName || 'استاد'}) مستقیماً با سرفصل‌های این درس در دفتر ثبت نمرات و کارنامه متصل می‌گردد.
                </span>
              </div>
            )}
          </div>

          {/* Row 5: Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              توضیحات، سرفصل‌ها یا اهداف آموزشی درس (اختیاری)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: سرفصل‌های هندسه تحلیلی، جبر، محاسبات، کارگاه‌های عملی و آزمایشگاهی..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-rose-700 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isSubmitting ? 'در حال ثبت...' : isEditing ? 'ذخیره تغییرات درس' : 'ثبت درس در چارت آموزشی'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
