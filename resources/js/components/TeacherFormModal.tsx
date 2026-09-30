import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { User } from '../types';
import { 
  X, 
  UserCheck, 
  KeyRound, 
  Phone, 
  BookOpen, 
  GraduationCap, 
  Check, 
  Eye, 
  EyeOff, 
  Trash2, 
  AlertCircle,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

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
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

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
        setSelectedClassIds(teacher.assignedClassIds || []);
      } else {
        setName('');
        setSubject('');
        setPhone('');
        setUsername('');
        setPassword('123');
        setSelectedClassIds([]);
      }
      setErrors({});
      setDeleteError(null);
      setIsConfirmingDelete(false);
      setShowPassword(false);
    }
  }, [isOpen, teacher]);

  if (!isOpen) return null;

  // Toggle class selection
  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSelectAllClasses = () => {
    if (selectedClassIds.length === classes.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map((c) => c.id));
    }
  };

  // Validation
  const validateForm = () => {
    const newErrors: typeof errors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'لطفاً نام و نام خانوادگی معلم را وارد نمایید.';
    }

    const trimmedUsername = username.trim() || phone.trim();
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
    const finalPhone = phone.trim() || undefined;
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
          assignedClassIds: selectedClassIds,
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
          assignedClassIds: selectedClassIds,
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

  // Group classes by grade for clean scannable display
  const distinctGrades = Array.from(new Set(classes.map((c) => c.grade)));

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in"
      dir="rtl"
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {isEditMode ? 'ویرایش مشخصات و دسترسی معلم' : 'افزودن معلم جدید'}
              </h2>
              <p className="text-xs text-teal-200/80">
                {isEditMode 
                  ? `به‌روزرسانی اطلاعات، درس تدریسی و کلاس‌های ${teacher?.name}`
                  : 'تعریف دبیر، ماده درسی، مشخصات ورود و اختصاص کلاس‌ها'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs text-slate-700">
          
          {/* General Duplicate / Submission Error Banner */}
          {errors.general && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-bold">{errors.general}</span>
            </div>
          )}

          {deleteError && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span className="font-bold leading-relaxed">{deleteError}</span>
            </div>
          )}

          {/* ۱. مشخصات هویتی و ارتباطی */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-teal-700" />
              <span>مشخصات فردی و ارتباطی</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  نام و نام خانوادگی معلم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                    if (errors.general) setErrors((prev) => ({ ...prev, general: undefined }));
                  }}
                  placeholder="مثلاً: محمد احمدی، استاد رضایی"
                  className={`w-full text-xs bg-white border rounded-xl px-3 py-2.5 outline-hidden transition ${
                    errors.name ? 'border-red-500 focus:ring-2 focus:ring-red-300' : 'border-slate-200 focus:ring-2 focus:ring-teal-700'
                  }`}
                />
                {errors.name && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  شماره تماس همراه
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 font-mono outline-hidden focus:ring-2 focus:ring-teal-700 transition"
                />
              </div>
            </div>
          </div>

          {/* ۲. تخصص و ماده درسی */}
          <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-200/80 space-y-3">
            <h3 className="font-bold text-teal-950 text-xs flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-teal-700" />
              <span>ماده درسی و تخصص تدریس</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  عنوان درس تدریسی
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="مثلاً: ریاضی، علوم تجربی، عربی"
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:ring-2 focus:ring-teal-700 transition"
                />
              </div>

              {academicSubjects.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    یا انتخاب سریع از چارت مصوب:
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) setSubject(e.target.value);
                    }}
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
                  >
                    <option value="">-- انتخاب از عناوین درسی --</option>
                    {academicSubjects.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.category || 'عمومی'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ۳. اطلاعات ورود به سامانه */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-teal-700" />
              <span>اطلاعات ورود اختصاصی معلم</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  نام کاربری <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                    if (errors.general) setErrors((prev) => ({ ...prev, general: undefined }));
                  }}
                  placeholder={phone || 'مثلاً: m_ahmadi یا 09121234567'}
                  className={`w-full text-xs bg-white border rounded-xl px-3 py-2.5 font-mono outline-hidden transition ${
                    errors.username ? 'border-red-500 focus:ring-2 focus:ring-red-300' : 'border-slate-200 focus:ring-2 focus:ring-teal-700'
                  }`}
                />
                {errors.username && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.username}</p>
                )}
                {!isEditMode && !username && (
                  <p className="text-[10px] text-slate-400 mt-0.5">در صورت خالی بودن، شماره تماس یا کد سیستمی اعمال می‌شود.</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  رمز عبور ورود <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="رمز عبور"
                    className={`w-full text-xs bg-white border rounded-xl pl-9 pr-3 py-2.5 font-mono outline-hidden transition ${
                      errors.password ? 'border-red-500 focus:ring-2 focus:ring-red-300' : 'border-slate-200 focus:ring-2 focus:ring-teal-700'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'مخفی کردن' : 'نمایش رمز'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.password}</p>
                )}
              </div>
            </div>
          </div>

          {/* ۴. تخصیص کلاس‌های تحت تدریس */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-teal-700" />
                  <span>کلاس‌های تحت تدریس معلم ({toPersianDigits(selectedClassIds.length)} کلاس انتخاب شده)</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  دبیر در پنل شخصی خود فقط به لیست حضور و غیاب و ثبت نمرات کلاس‌های منتخب دسترسی خواهد داشت.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSelectAllClasses}
                className="text-[11px] font-bold text-teal-800 hover:text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 cursor-pointer transition"
              >
                {selectedClassIds.length === classes.length ? 'لغو انتخاب همه' : 'انتخاب همه کلاس‌ها'}
              </button>
            </div>

            {classes.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-400 text-xs">
                هنوز کلاسی در سامانه ثبت نشده است. ابتدا از بخش کلاس‌ها، کلاس ایجاد نمایید.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                {classes.map((cls) => {
                  const isChecked = selectedClassIds.includes(cls.id);
                  return (
                    <div
                      key={cls.id}
                      onClick={() => toggleClass(cls.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition select-none ${
                        isChecked
                          ? 'bg-teal-50/80 border-teal-300 text-teal-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                          isChecked ? 'bg-teal-700 border-teal-700 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs">{cls.name}</span>
                      </div>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        {cls.grade}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            {isEditMode && (
              isConfirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600 font-bold">آیا از حذف مطمئنید؟</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{isSubmitting ? 'در حال حذف...' : 'بله، حذف کن'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    disabled={isSubmitting}
                    className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    انصراف
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="حذف معلم از سامانه"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف معلم</span>
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              انصراف
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{isSubmitting ? 'در حال ذخیره...' : isEditMode ? 'ذخیره تغییرات' : 'افزودن معلم'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
