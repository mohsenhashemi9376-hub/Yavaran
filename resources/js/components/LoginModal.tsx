import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { YavaranLogo } from './YavaranLogo';
import { ThemeToggle } from './ThemeToggle';
import { TwoFactorHelp } from './TwoFactorHelp';
import { Lock, User, KeyRound, AlertCircle, X, Eye, EyeOff, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClass =
  'w-full text-sm font-[inherit] bg-slate-50 border border-slate-200 rounded-2xl py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-400';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, verifyTwoFactor } = useSchool();
  const [step, setStep] = useState<'credentials' | 'code'>('credentials');
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep('credentials');
      setCode('');
      setUseRecovery(false);
    }
  }, [isOpen]);

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
    } else if (res.requiresTwoFactor) {
      setStep('code');
      setCode('');
      setUseRecovery(false);
    } else {
      setErrorMsg(res.message || 'نام کاربری یا رمز عبور اشتباه است.');
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !code.trim()) return;
    setErrorMsg('');
    setIsSubmitting(true);
    const res = await verifyTwoFactor(code, trustDevice);
    setIsSubmitting(false);
    if (res.success) {
      setPassword('');
      setCode('');
      setStep('credentials');
      onClose();
    } else {
      setErrorMsg(res.message || 'کد وارد‌شده درست نیست.');
      setCode('');
      if (res.restart) {
        setStep('credentials');
        setPassword('');
      }
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

      {/* موبایل: آرم رسمی بزرگ بالای برگهٔ ورود (در دسکتاپ پنهان است) */}
      <section className="yv-login-hero" aria-hidden="true">
        <img src="/brand/logo-full.png" alt="" width={741} height={1219} decoding="async" />
        <p className="yv-login-hero__title">مجتمع تربیتی آموزشی یاوران ولایت</p>
        <p className="yv-login-hero__sub">سامانه مدیریت آموزشی، انضباطی و تربیتی</p>
      </section>

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
              <YavaranLogo variant="full" size="sm" />
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

          {step === 'code' ? (
            <form onSubmit={handleCodeSubmit} className="space-y-4" autoComplete="off">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-50/60">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h4 className="text-base font-black text-slate-900">تأیید ورود دومرحله‌ای</h4>
                <p className="text-xs text-slate-500 leading-6">
                  {useRecovery
                    ? 'یکی از کدهای بازیابی خود را وارد کنید (هر کد فقط یک‌بار قابل استفاده است).'
                    : 'کد ۶ رقمی را از برنامه‌ی احراز هویت (Google Authenticator یا مشابه) وارد کنید.'}
                </p>
              </div>
              <input
                id="login-code"
                autoFocus
                inputMode={useRecovery ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                maxLength={useRecovery ? 12 : 6}
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={useRecovery ? 'xxxxx-xxxxx' : '------'}
                className={`${inputClass} text-center text-xl font-mono tracking-[0.4em] px-3`}
              />
              <label className="flex items-start gap-2 text-[11px] text-slate-600 leading-5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="mt-1 accent-emerald-600"
                />
                <span>این دستگاه را مطمئن بدان؛ دفعه‌های بعد در همین دستگاه فقط رمز عبور کافی است. (روی رایانه‌ی مشترک فعال نکنید.)</span>
              </label>
              <button
                type="submit"
                disabled={isSubmitting || !code.trim()}
                className="yv-btn-primary w-full py-3.5 text-white font-bold text-sm rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{isSubmitting ? 'در حال بررسی…' : 'تأیید و ورود'}</span>
              </button>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setCode('');
                    setErrorMsg('');
                  }}
                  className="text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>بازگشت</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseRecovery((v) => !v);
                    setCode('');
                  }}
                  className="text-teal-700 hover:text-teal-900 cursor-pointer"
                >
                  {useRecovery ? 'استفاده از کد برنامه' : 'استفاده از کد بازیابی'}
                </button>
              </div>
            </form>
          ) : (
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
          )}

          <TwoFactorHelp />

          <p className="text-center text-[11px] text-slate-400">اطلاعات شما به‌صورت رمزنگاری‌شده منتقل می‌شود.</p>
        </div>
      </div>
    </div>
  );
};
