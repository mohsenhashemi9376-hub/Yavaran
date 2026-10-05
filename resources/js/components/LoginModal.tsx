import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { YavaranLogo } from './YavaranLogo';
import { ThemeToggle } from './ThemeToggle';
import { Lock, User, KeyRound, AlertCircle, X, Eye, EyeOff, Loader2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClass =
  'w-full text-sm font-[inherit] bg-slate-50 border border-slate-200 rounded-2xl py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login } = useSchool();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg('');
    setIsSubmitting(true);

    const res = await login(username, password);
    setIsSubmitting(false);
    if (res.success) {
      setPassword('');
      onClose();
    } else {
      setErrorMsg(res.message || 'نام کاربری یا رمز عبور اشتباه است.');
    }
  };

  return (
    <div
      className="yv-login fixed inset-0 flex items-center justify-center p-4 z-50 overflow-y-auto"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <ThemeToggle className="yv-login__theme" />

      <div className="yv-login__card w-full max-w-md font-['Vazirmatn',sans-serif] animate-in fade-in zoom-in-95 duration-300">
        <div className="yv-login__hero text-white px-6 pt-8 pb-7 relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="absolute left-4 top-4 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center space-y-4 relative">
            <div className="yv-login__logo">
              <YavaranLogo size="lg" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">مدرسه یاوران ولایت</h3>
              <p className="text-xs text-teal-100/80 mt-1.5 leading-relaxed">
                ورود به سامانه جامع مدیریت آموزشی، انضباطی و تربیتی
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {errorMsg && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="on">
            <div>
              <label htmlFor="login-username" className="block text-xs font-bold text-slate-700 mb-1.5">نام کاربری یا شماره همراه</label>
              <div className="relative">
                <User className="w-4 h-4 text-teal-700/70 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-username"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="نام کاربری یا شماره همراه"
                  className={`${inputClass} pr-10 pl-3 text-right`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-700 mb-1.5">کلمه عبور</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-teal-700/70 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="رمز عبور خود را وارد کنید"
                  className={`${inputClass} pr-10 pl-11 text-right`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? 'مخفی کردن' : 'نمایش رمز'}
                  aria-label={showPassword ? 'مخفی کردن رمز' : 'نمایش رمز'}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="yv-btn-primary w-full py-3.5 text-white font-bold text-sm rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{isSubmitting ? 'در حال ورود…' : 'ورود امن به سامانه'}</span>
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-400">اطلاعات شما به‌صورت رمزنگاری‌شده منتقل می‌شود.</p>
        </div>
      </div>
    </div>
  );
};
