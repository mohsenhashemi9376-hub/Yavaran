import React, { useState } from 'react';
import { apiRequest, ApiError } from '../lib/serverSync';
import { toEnglishDigits } from '../utils/persianDate';
import { 
  X, 
  User as UserIcon, 
  ShieldCheck, 
  Phone, 
  BookOpen, 
  GraduationCap, 
  Hash, 
  Clock, 
  CheckCircle2,
  Calendar,
  Lock
} from 'lucide-react';
import { minPasswordLength, passwordTooShortMessage } from '../utils/passwordRules';
import { useSchool } from '../context/SchoolContext';
import { TwoFactorSetupModal } from './TwoFactorSetupModal';
import { getUserGreeting } from '../utils/userRoles';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, classes, reloadFromServer, showToast, security } = useSchool();
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [logoutOthersOpen, setLogoutOthersOpen] = useState(false);
  const [logoutOthersPassword, setLogoutOthersPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    setUsername(currentUser.username || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
    setEditing(true);
  };

  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setErrors({});
    const nextErrors: Record<string, string> = {};
    if (!currentPassword) nextErrors.current_password = 'لطفاً رمز عبور فعلی خود را وارد کنید.';
    if (newPassword && newPassword.length < minPasswordLength(currentUser.role)) nextErrors.new_password = passwordTooShortMessage(minPasswordLength(currentUser.role));
    if (newPassword && newPassword !== confirmPassword) nextErrors.new_password_confirmation = 'تکرار رمز عبور جدید یکسان نیست.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest<{ message: string }>('POST', '/api/profile', {
        current_password: currentPassword,
        username: toEnglishDigits(username.trim()),
        new_password: newPassword ? toEnglishDigits(newPassword) : undefined,
        new_password_confirmation: newPassword ? toEnglishDigits(confirmPassword) : undefined,
      });
      await reloadFromServer();
      showToast('ذخیره شد', res?.message || 'اطلاعات حساب کاربری به‌روزرسانی شد.', 'success');
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else setErrors({ general: err instanceof ApiError ? err.message : 'ذخیره اطلاعات با خطا مواجه شد.' });
    } finally {
      setSaving(false);
    }
  };
  const todayInfo = getTodayShamsi();
  const userGreeting = getUserGreeting(currentUser);

  if (!isOpen) return null;

  // Find assigned classes names
  const assignedClassNames = (currentUser.assignedClassIds || [])
    .map(cId => classes.find(c => c.id === cId)?.name)
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      <div 
        className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] z-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-l from-teal-50/70 via-slate-50 to-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center font-black text-sm shadow-xs">
              {currentUser?.name ? currentUser.name.slice(0, 2) : 'کا'}
            </div>
            <div>
              <h2 id="profile-modal-title" className="text-base font-black text-slate-900">
                حساب کاربری من
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                اطلاعات پرسنلی، سطح دسترسی و کلاس‌های تخصیص‌یافته
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="بستن (ESC)"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          
          {/* Identity Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-teal-800 flex items-center justify-center font-black text-base shadow-xs shrink-0">
                {currentUser?.name ? currentUser.name.slice(0, 2) : 'کا'}
              </div>
              <div>
                <div className="text-sm font-black text-slate-900">
                  {currentUser?.name || 'کاربر گرامی'}
                </div>
                <div className="text-[11px] font-semibold text-teal-800 mt-0.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{userGreeting.roleLabel}</span>
                  {currentUser.roleTitle && currentUser.roleTitle !== userGreeting.roleLabel && (
                    <span className="text-slate-400">({currentUser.roleTitle})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-left shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3" />
                <span>حساب فعال</span>
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Username */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white">
              <div className="text-slate-400 text-[10px] font-medium flex items-center gap-1 mb-1">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>شناسه کاربری</span>
              </div>
              <div className="text-xs font-bold text-slate-800 font-mono" dir="ltr">
                {currentUser.username || 'admin'}
              </div>
            </div>

            {/* Phone */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white">
              <div className="text-slate-400 text-[10px] font-medium flex items-center gap-1 mb-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>شماره تماس</span>
              </div>
              <div className="text-xs font-bold text-slate-800" dir="ltr">
                {currentUser.phone ? toPersianDigits(currentUser.phone) : 'ثبت‌نشده'}
              </div>
            </div>

            {/* Subject / Specialty (if applicable) */}
            {(currentUser.subject || currentUser.subjectSpecialty) && (
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <div className="text-slate-400 text-[10px] font-medium flex items-center gap-1 mb-1">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  <span>درس / زمینه تخصصی</span>
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {currentUser.subject || currentUser.subjectSpecialty}
                </div>
              </div>
            )}

            {/* Coach Specialty */}
            {currentUser.coachRoleTitle && (
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <div className="text-slate-400 text-[10px] font-medium flex items-center gap-1 mb-1">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  <span>سمت تربیتی</span>
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {currentUser.coachRoleTitle}
                </div>
              </div>
            )}

            {/* Date */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white">
              <div className="text-slate-400 text-[10px] font-medium flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>تاریخ امروز</span>
              </div>
              <div className="text-xs font-bold text-slate-800">
                {todayInfo.dayOfWeek}، {todayInfo.displayDate}
              </div>
            </div>
          </div>

          {/* Assigned Classes (if any) */}
          {assignedClassNames.length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="text-slate-500 text-[11px] font-bold flex items-center gap-1.5 mb-2">
                <GraduationCap className="w-4 h-4 text-teal-700" />
                <span>کلاس‌های تحت پوشش / تخصیص‌یافته</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assignedClassNames.map((cName, idx) => (
                  <span 
                    key={idx} 
                    className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[11px] font-medium"
                  >
                    {cName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* خروج از همه‌ی دستگاه‌های دیگر */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-slate-800">خروج از دستگاه‌های دیگر</div>
                <div className="text-[11px] text-slate-500 mt-0.5">اگر فکر می‌کنید حساب شما در دستگاه دیگری باز مانده یا لو رفته، همه‌ی نشست‌های دیگر را ببندید.</div>
              </div>
              {!logoutOthersOpen && (
                <button type="button" onClick={() => setLogoutOthersOpen(true)} className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold cursor-pointer whitespace-nowrap">
                  خروج از بقیه
                </button>
              )}
            </div>
            {logoutOthersOpen && (
              <form
                className="flex items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!logoutOthersPassword) return;
                  try {
                    await apiRequest('POST', '/api/auth/logout-others', { password: toEnglishDigits(logoutOthersPassword) });
                    showToast('از همه‌ی دستگاه‌های دیگر خارج شدید.', 'success');
                    setLogoutOthersOpen(false);
                    setLogoutOthersPassword('');
                  } catch (err) {
                    showToast(err instanceof ApiError ? err.message : 'خطا در انجام عملیات.', 'error');
                  }
                }}
              >
                <input
                  type="password"
                  autoFocus
                  autoComplete="current-password"
                  dir="ltr"
                  value={logoutOthersPassword}
                  onChange={(e) => setLogoutOthersPassword(e.target.value)}
                  placeholder="رمز عبور فعلی"
                  className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                <button type="submit" disabled={!logoutOthersPassword} className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer">تأیید</button>
                <button type="button" onClick={() => setLogoutOthersOpen(false)} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer">انصراف</button>
              </form>
            )}
          </div>

          {/* ورود دومرحله‌ای */}
          <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${security.twoFactorEnabled ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-slate-800">ورود دومرحله‌ای</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {security.twoFactorEnabled
                  ? 'فعال است؛ هنگام ورود کد برنامه‌ی احراز هویت خواسته می‌شود.'
                  : security.twoFactorRequired
                  ? 'برای نقش شما اجباری است و هنوز فعال نشده.'
                  : 'امنیت حساب را با کد یک‌بارمصرف گوشی بالا ببرید.'}
              </div>
            </div>
            {security.twoFactorEnabled ? (
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">فعال</span>
            ) : (
              <button
                type="button"
                onClick={() => setTwoFactorOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                فعال‌سازی
              </button>
            )}
          </div>
          <TwoFactorSetupModal isOpen={twoFactorOpen} onClose={() => setTwoFactorOpen(false)} />

          {/* ویرایش نام کاربری و رمز عبور */}
          {!editing ? (
            <button
              type="button"
              onClick={openEdit}
              className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>تغییر نام کاربری و رمز عبور</span>
            </button>
          ) : (
            <form onSubmit={saveCredentials} className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-3">
              <div className="text-xs font-black text-slate-800">ویرایش اطلاعات ورود</div>
              {errors.general && <div role="alert" className="text-[11px] font-bold text-rose-700 bg-rose-50 rounded-lg p-2">{errors.general}</div>}
              {([
                ['username', 'نام کاربری', username, setUsername, 'text', 'username'],
                ['current_password', 'رمز عبور فعلی', currentPassword, setCurrentPassword, 'password', 'current-password'],
                ['new_password', 'رمز عبور جدید (اختیاری)', newPassword, setNewPassword, 'password', 'new-password'],
                ['new_password_confirmation', 'تکرار رمز عبور جدید', confirmPassword, setConfirmPassword, 'password', 'new-password'],
              ] as const).map(([key, label, value, setter, type, ac]) => (
                <div key={key}>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    autoComplete={ac}
                    dir="ltr"
                    className={`w-full px-3 py-2 rounded-xl bg-white border text-xs outline-none transition focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${errors[key] ? 'border-rose-300' : 'border-slate-200'}`}
                  />
                  {errors[key] && <p className="text-[11px] text-rose-600 font-bold mt-1">{errors[key]}</p>}
                </div>
              ))}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">انصراف</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60">
                  {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </form>
          )}

          {/* Security & Access Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed flex items-start gap-2">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              سطح دسترسی شما مطابق با سیاست‌های امنیتی مجتمع تنظیم شده است. نام و کلاس‌ها را معاونت مربوطه تغییر می‌دهد؛ نام کاربری و رمز عبور را خودتان می‌توانید عوض کنید.
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div />

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
