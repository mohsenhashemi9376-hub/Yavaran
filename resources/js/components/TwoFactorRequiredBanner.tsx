import React, { useState } from 'react';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { ApiError, apiRequest } from '../lib/serverSync';
import { toEnglishDigits } from '../utils/persianDate';
import { TwoFactorSetupModal } from './TwoFactorSetupModal';

/** تأیید مجدد رمز عبور برای ورود به بخش محرمانه (پس از ۶ ساعت بی‌فعالیتی) */
const ReauthCard: React.FC = () => {
  const { reloadAfterSecurityChange } = useSchool();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest('POST', '/api/auth/confirm-password', { password: toEnglishDigits(password) });
      setPassword('');
      await reloadAfterSecurityChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در تأیید رمز.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-emerald-300 bg-gradient-to-l from-emerald-50 via-white to-emerald-50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm"
      role="alert"
    >
      <span className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 ring-8 ring-emerald-50">
        <KeyRound className="w-7 h-7" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-base font-black text-emerald-900">برای ادامه، رمز عبور را دوباره وارد کنید</div>
        <p className="text-xs text-emerald-800/90 mt-1 leading-6">
          پرونده‌های تربیتی محرمانه‌اند؛ پس از ۶ ساعت بی‌فعالیتی برای حفاظت از اطلاعات، تأیید مجدد رمز عبور لازم است.
        </p>
        {error && <p className="text-xs font-bold text-rose-600 mt-1.5">{error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="رمز عبور"
          aria-label="رمز عبور"
          className="h-12 w-44 rounded-2xl border border-emerald-200 bg-white px-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        <button
          type="submit"
          disabled={busy || !password}
          className="h-12 px-5 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 cursor-pointer flex items-center gap-2 disabled:opacity-60 transition active:scale-[0.98]"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>تأیید</span>
        </button>
      </div>
    </form>
  );
};

/** هشدارهای اجباری امنیتی: ورود دومرحله‌ای و تأیید مجدد رمز؛ بدون آن‌ها پرونده‌های تربیتی نمایش داده نمی‌شود */
export const TwoFactorRequiredBanner: React.FC = () => {
  const { security } = useSchool();
  const [open, setOpen] = useState(false);

  const needsTwoFactor = security.twoFactorRequired && !security.twoFactorEnabled;
  if (!needsTwoFactor && !security.reauthRequired) return null;
  if (!needsTwoFactor) return <ReauthCard />;

  return (
    <>
      <div className="rounded-3xl border border-amber-300 bg-gradient-to-l from-amber-50 via-white to-amber-50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm" role="alert">
        <span className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 ring-8 ring-amber-50">
          <ShieldAlert className="w-7 h-7" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-base font-black text-amber-900">ورود دومرحله‌ای را فعال کنید</div>
          <p className="text-xs text-amber-800/90 mt-1 leading-6">
            پرونده‌های تربیتی و مشاهدات رفتاری محرمانه‌اند. تا ورود دومرحله‌ای حساب شما فعال نشود، هیچ سابقه‌ای نمایش داده نمی‌شود؛ ثبت مشاهده‌گری جدید همچنان ممکن است.
            فعال‌سازی حدود ۲ دقیقه زمان می‌برد.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-12 px-6 rounded-2xl bg-gradient-to-l from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white font-extrabold text-sm shadow-md shadow-amber-600/25 cursor-pointer shrink-0 transition active:scale-[0.98]"
        >
          فعال‌سازی ورود دومرحله‌ای
        </button>
      </div>
      <TwoFactorSetupModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
};
