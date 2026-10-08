import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, KeyRound, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { ApiError, apiRequest } from '../lib/serverSync';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { minPasswordLength, passwordTooShortMessage } from '../utils/passwordRules';
import { YavaranLogo } from './YavaranLogo';

const inputClass =
  'w-full text-sm bg-slate-50 border border-slate-200 rounded-2xl py-3 pr-10 pl-11 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 text-left';

/** صفحه‌ی تمام‌صفحه‌ی تغییر اجباری رمز عبور؛ تا تغییر رمز هیچ بخشی از سامانه باز نمی‌شود */
export const ForcePasswordChange: React.FC = () => {
  const { reloadAfterSecurityChange, logout, showToast, currentUser } = useSchool();
  const minLength = minPasswordLength(currentUser?.role, true);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const strength = (() => {
    let score = 0;
    if (next.length >= minLength) score++;
    if (/[A-Za-z]/.test(next) && /\d/.test(next)) score++;
    if (next.length >= 12 || /[^A-Za-z0-9]/.test(next)) score++;
    return score;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    if (!current) errs.current_password = 'رمز عبور فعلی را وارد کنید.';
    if (next.length < minLength) errs.new_password = passwordTooShortMessage(minLength);
    if (next !== confirm) errs.new_password_confirmation = 'تکرار رمز جدید یکسان نیست.';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await apiRequest('POST', '/api/profile', {
        current_password: toEnglishDigits(current),
        new_password: toEnglishDigits(next),
        new_password_confirmation: toEnglishDigits(confirm),
      });
      showToast('رمز عبور شما تغییر کرد.', 'success');
      await reloadAfterSecurityChange();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else setErrors({ general: err instanceof ApiError ? err.message : 'خطا در تغییر رمز عبور.' });
    } finally {
      setBusy(false);
    }
  };

  const field = (
    key: 'current_password' | 'new_password' | 'new_password_confirmation',
    label: string,
    value: string,
    setter: (v: string) => void,
    autoComplete: string
  ) => (
    <div>
      <label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <KeyRound className="w-4 h-4 text-teal-700/70 absolute right-3.5 top-1/2 -translate-y-1/2" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => setter(e.target.value)}
          autoComplete={autoComplete}
          dir="ltr"
          className={`${inputClass} ${errors[key] ? '!border-rose-300' : ''}`}
        />
        {key === 'current_password' && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'مخفی کردن رمز' : 'نمایش رمز'}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {errors[key] && <p className="text-[11px] text-rose-600 font-bold mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="yv-login fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
      <div className="yv-login__card w-full max-w-md font-['Vazirmatn',sans-serif]">
        <div className="yv-login__hero text-white px-6 pt-8 pb-7">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="yv-login__logo">
              <YavaranLogo size="lg" />
            </div>
            <h3 className="text-xl font-black">تغییر رمز عبور</h3>
            <p className="text-xs text-teal-100/80 leading-6">
              رمز فعلی شما پیش‌فرض یا توسط شخص دیگری تعیین شده است. برای ادامه، رمز دلخواه و امن خود را انتخاب کنید.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="p-6 sm:p-7 space-y-4" autoComplete="off">
          {errors.general && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errors.general}</span>
            </div>
          )}
          {field('current_password', 'رمز عبور فعلی', current, setCurrent, 'current-password')}
          {field('new_password', `رمز عبور جدید (حداقل ${toPersianDigits(minLength)} کاراکتر)`, next, setNext, 'new-password')}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition ${
                  next && strength >= i ? (strength === 1 ? 'bg-rose-400' : strength === 2 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          {field('new_password_confirmation', 'تکرار رمز عبور جدید', confirm, setConfirm, 'new-password')}

          <button
            type="submit"
            disabled={busy}
            className="yv-btn-primary w-full py-3.5 text-white font-bold text-sm rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{busy ? 'در حال ذخیره…' : 'ثبت رمز جدید و ورود'}</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full text-[11px] font-bold text-slate-500 hover:text-slate-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </form>
      </div>
    </div>
  );
};
