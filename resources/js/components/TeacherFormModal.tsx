import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { User } from '../types';
import { X, Check, Eye, EyeOff, Trash2, AlertCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { toPersianDigits, toEnglishDigits } from '../utils/persianDate';

const fieldClass =
  'w-full text-base bg-slate-50 rounded-2xl px-4 py-3 text-slate-900 outline-none border border-transparent focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 transition';

interface TeacherFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher?: User | null;
}

export const TeacherFormModal: React.FC<TeacherFormModalProps> = ({
  isOpen,
  onClose,
  teacher,
}) => {
  const { addTeacher, updateTeacher, deleteTeacher, classes, academicSubjects, allUsers, showToast } = useSchool();

  const isEditMode = Boolean(teacher);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);

  // Validation & Error States
  const [errors, setErrors] = useState<{
    name?: string;
    username?: string;
    password?: string;
    general?: string;
  }>({});
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Initialize or reset form on open / teacher change
  useEffect(() => {
    if (isOpen) {
      if (teacher) {
        setName(teacher.name || '');
        setSubject(teacher.subjectSpecialty || teacher.subject || '');
        setPhone(teacher.phone || '');
        setUsername(teacher.username || '');
        setPassword(teacher.password || '123');
      } else {
        setName('');
        setSubject('');
        setPhone('');
        setUsername('');
        setPassword('123');
      }
      setErrors({});
      setDeleteError(null);
      setIsConfirmingDelete(false);
      setShowPassword(false);
    }
  }, [isOpen, teacher]);

  if (!isOpen) return null;

  // Validation
  const validateForm = () => {
    const newErrors: typeof errors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'لطفاً نام و نام خانوادگی معلم را وارد نمایید.';
    }

    const trimmedUsername = username.trim() || toEnglishDigits(phone.trim());
    if (isEditMode && !username.trim()) {
      newErrors.username = 'لطفاً نام کاربری را وارد نمایید.';
    }

    if (!password.trim()) {
      newErrors.password = 'لطفاً رمز عبور را وارد نمایید.';
    }

    // Check for duplicate teacher (same name or same username)
    const duplicate = allUsers.find((u) => {
      if (isEditMode && u.id === teacher?.id) return false;
      const isSameName = u.name.trim().toLowerCase() === trimmedName.toLowerCase();
      const isSameUsername = trimmedUsername && u.username.trim().toLowerCase() === trimmedUsername.toLowerCase();
      return isSameName || isSameUsername;
    });

    if (duplicate) {
      newErrors.general = 'فردی با این نام یا نام کاربری قبلاً در سامانه ثبت شده است.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) return;

    const trimmedName = name.trim();
    const finalSubject = subject.trim() || undefined;
    const finalPhone = toEnglishDigits(phone.trim()) || undefined;
    const finalPassword = password.trim() || '123';

    try {
      setIsSubmitting(true);
      if (isEditMode && teacher) {
        const finalUsername = username.trim() || teacher.username;
        updateTeacher(teacher.id, {
          name: trimmedName,
          subject: finalSubject,
          subjectSpecialty: finalSubject,
          roleTitle: finalSubject ? `دبیر ${finalSubject}` : 'استاد و دبیر',
          phone: finalPhone,
          username: finalUsername,
          password: finalPassword,
        });
        showToast('ویرایش موفق', `اطلاعات معلم «${trimmedName}» با موفقیت به‌روزرسانی شد.`, 'success');
      } else {
        const generatedUsername = username.trim() || finalPhone || `tea_${Date.now().toString().slice(-4)}`;
        addTeacher({
          name: trimmedName,
          username: generatedUsername,
          password: finalPassword,
          roleTitle: finalSubject ? `دبیر ${finalSubject}` : 'استاد و دبیر',
          subject: finalSubject,
          subjectSpecialty: finalSubject,
          phone: finalPhone,
          assignedClassIds: [],
        });
        showToast('ثبت موفق', `معلم جدید «${trimmedName}» با موفقیت تعریف شد.`, 'success');
      }

      onClose();
    } catch (err) {
      console.error('Save teacher error:', err);
      showToast('خطا در ذخیره', 'هنگام ذخیره اطلاعات معلم خطایی رخ داد.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!teacher || isSubmitting) return;
    setDeleteError(null);

    try {
      setIsSubmitting(true);
      const success = deleteTeacher(teacher.id);
      if (success) {
        showToast('حذف معلم', `معلم «${teacher.name}» با موفقیت حذف شد.`, 'info');
        onClose();
      } else {
        const assigned = classes.filter(
          (c) => c.teacherIds?.includes(teacher.id) || teacher.assignedClassIds?.includes(c.id)
        );
        setDeleteError(
          `این معلم هنوز به ${assigned.length} کلاس متصل است. ابتدا ارتباط او با کلاس‌ها را مشخص یا لغو کنید.`
        );
        setIsConfirmingDelete(false);
      }
    } catch (err) {
      console.error('Delete teacher error:', err);
      showToast('خطا در حذف', 'هنگام حذف معلم خطایی رخ داد.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // عناوین یکتای درس‌ها برای انتخاب تخصص (در صورت ویرایش، تخصص فعلی هم حفظ می‌شود)
  const specialtyOptions = Array.from(
    new Set([...academicSubjects.map((s) => s.name), ...(subject ? [subject] : [])])
  );

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/10 w-full max-w-md font-['Vazirmatn',sans-serif]">
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">{isEditMode ? 'ویرایش معلم' : 'افزودن معلم جدید'}</h2>
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
          {errors.general && (
            <div role="alert" className="p-3 bg-rose-50 text-rose-700 rounded-2xl flex items-center gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}
          {deleteError && (
            <div className="p-3 bg-amber-50 text-amber-900 rounded-2xl flex items-center gap-2 text-xs font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="leading-relaxed">{deleteError}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5">
              نام و نام خانوادگی <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name || errors.general) setErrors((prev) => ({ ...prev, name: undefined, general: undefined }));
              }}
              placeholder="مثلاً: محمد احمدی"
              className={`${fieldClass} ${errors.name ? '!border-rose-400 !ring-4 !ring-rose-100' : ''}`}
            />
            {errors.name && <p className="text-xs text-rose-600 mt-1.5 font-medium">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">شماره تماس</label>
              <input
                type="text"
                inputMode="tel"
                value={toPersianDigits(phone)}
                onChange={(e) => setPhone(toEnglishDigits(e.target.value).replace(/[^0-9]/g, ''))}
                placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                className={`${fieldClass} text-left`}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">تخصص / درس</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass}>
                <option value="">انتخاب کنید</option>
                {specialtyOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">نام کاربری</label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username || errors.general) setErrors((prev) => ({ ...prev, username: undefined, general: undefined }));
                }}
                placeholder={phone ? 'پیش‌فرض: شماره تماس' : 'مثلاً: m_ahmadi'}
                className={`${fieldClass} text-left ${errors.username ? '!border-rose-400 !ring-4 !ring-rose-100' : ''}`}
                dir="ltr"
              />
              {errors.username && <p className="text-xs text-rose-600 mt-1.5 font-medium">{errors.username}</p>}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">رمز عبور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={`${fieldClass} pl-11 text-left ${errors.password ? '!border-rose-400 !ring-4 !ring-rose-100' : ''}`}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'مخفی کردن' : 'نمایش رمز'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-rose-600 mt-1.5 font-medium">{errors.password}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold rounded-2xl shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            <span>{isEditMode ? 'ذخیره تغییرات' : 'افزودن معلم'}</span>
          </button>

          {isEditMode && (
            <div className="flex justify-start">
              {isConfirmingDelete ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-rose-600 font-bold">حذف شود؟</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    بله
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 text-xs font-medium text-rose-300 hover:text-rose-500 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف معلم</span>
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
