import { getStandardRoleTitle } from '../utils/userRoles';
import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { AcademicSubject, SubjectCategory } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { X, Check, Loader2, AlertCircle } from 'lucide-react';

interface EditSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject?: AcademicSubject | null; // اگر خالی باشد، درس جدید تعریف می‌شود
}

const CATEGORIES: SubjectCategory[] = ['دروس یاوران', 'دروس آموزش و پرورش'];
const STANDARD_GRADES = ['پایه هفتم', 'پایه هشتم', 'پایه نهم'];
const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6];

// دروس قدیمی با گروه‌های منسوخ به «دروس آموزش و پرورش» نگاشت می‌شوند
const normalizeCategory = (c?: SubjectCategory): SubjectCategory =>
  c === 'دروس یاوران' ? 'دروس یاوران' : 'دروس آموزش و پرورش';

const fieldClass =
  'w-full text-base bg-slate-50 rounded-2xl px-4 py-3 text-slate-900 outline-none border border-transparent focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 transition';

export const EditSubjectModal: React.FC<EditSubjectModalProps> = ({ isOpen, onClose, subject }) => {
  const { assignableStaff, addAcademicSubject, updateAcademicSubject, showToast } = useSchool();

  const [name, setName] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState(2);
  const [category, setCategory] = useState<SubjectCategory>('دروس آموزش و پرورش');
  const [selectedGrades, setSelectedGrades] = useState<string[]>(STANDARD_GRADES);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEditing = !!subject;

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    setName(subject?.name || '');
    setHoursPerWeek(subject?.hoursPerWeek || 2);
    setCategory(normalizeCategory(subject?.category));
    setSelectedGrades(subject?.targetGrades?.length ? subject.targetGrades : STANDARD_GRADES);
    setSelectedTeacherId(subject?.teacherId || '');
  }, [isOpen, subject?.id]);

  if (!isOpen) return null;

  const hourChoices = HOUR_OPTIONS.includes(hoursPerWeek) ? HOUR_OPTIONS : [...HOUR_OPTIONS, hoursPerWeek].sort((a, b) => a - b);

  const toggleGrade = (grade: string) =>
    setSelectedGrades((prev) => (prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('لطفاً نام درس را وارد کنید.');
      return;
    }
    if (selectedGrades.length === 0) {
      setErrorMessage('حداقل یک پایه را انتخاب کنید.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const teacher = assignableStaff.find((t) => t.id === selectedTeacherId);
      const payload: Omit<AcademicSubject, 'id'> = {
        name: trimmedName,
        // ضریب در فرم نیست؛ مقدار قبلی حفظ می‌شود و برای درس جدید پیش‌فرض ۱ است
        coefficient: subject?.coefficient || 1,
        hoursPerWeek,
        category,
        grade: selectedGrades.join('، '),
        targetGrades: selectedGrades,
        major: 'متوسطه اول',
        teacherId: selectedTeacherId || undefined,
        defaultTeacherName: teacher?.name || undefined,
      };

      if (isEditing && subject) {
        updateAcademicSubject(subject.id, payload);
        showToast('ویرایش درس', `درس «${trimmedName}» ویرایش شد.`, 'success');
      } else {
        addAcademicSubject(payload);
        showToast('درس جدید', `درس «${trimmedName}» اضافه شد.`, 'success');
      }
      onClose();
    } catch {
      setErrorMessage('خطایی در ذخیره درس رخ داد. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/10 w-full max-w-md animate-in fade-in zoom-in-95 font-['Vazirmatn',sans-serif]">
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">{isEditing ? 'ویرایش درس' : 'تعریف درس جدید'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          {errorMessage && (
            <div role="alert" className="p-3 rounded-2xl bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              نام درس <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: ریاضی"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">گروه درسی</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`h-12 rounded-2xl text-sm font-extrabold transition cursor-pointer ${
                    category === cat
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">ساعت تدریس در هفته</label>
            <div className="flex gap-2">
              {hourChoices.map((h) => (
                <button
                  type="button"
                  key={h}
                  onClick={() => setHoursPerWeek(h)}
                  className={`flex-1 h-11 rounded-xl text-base font-extrabold transition cursor-pointer ${
                    hoursPerWeek === h
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {toPersianDigits(h)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">پایه‌های تحت پوشش</label>
            <div className="grid grid-cols-3 gap-2">
              {STANDARD_GRADES.map((g) => {
                const checked = selectedGrades.includes(g);
                return (
                  <label
                    key={g}
                    className={`h-12 rounded-2xl text-sm font-extrabold transition cursor-pointer flex items-center justify-center gap-2 select-none ${
                      checked ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGrade(g)}
                      className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    />
                    {g.replace('پایه ', '')}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">دبیر پیش‌فرض درس (برای همه کلاس‌های پایه)</label>
            <select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className={fieldClass}>
              <option value="">بدون دبیر</option>
              {assignableStaff.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({getStandardRoleTitle(t.role)})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold rounded-2xl shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            <span>{isEditing ? 'ذخیره تغییرات' : 'تعریف درس'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
