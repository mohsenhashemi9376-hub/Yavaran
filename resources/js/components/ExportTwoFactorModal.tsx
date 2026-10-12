import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { ApiError, apiRequest } from '../lib/serverSync';
import { toEnglishDigits } from '../utils/persianDate';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** پس از تأیید موفق کد دومرحله‌ای فراخوانی می‌شود */
  onConfirmed: () => void;
}

/** گرفتن خروجی اکسل از اطلاعات محرمانه‌ی تربیتی فقط پس از وارد کردن دوباره‌ی کد ورود دومرحله‌ای */
export const ExportTwoFactorModal: React.FC<Props> = ({ isOpen, onClose, onConfirmed }) => {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError('');
      setBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest('POST', '/api/auth/confirm-export', { code: toEnglishDigits(code.trim()) });
      onConfirmed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در تأیید کد.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100]" dir="rtl">
      <form onSubmit={submit} className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h3 className="text-sm font-black text-slate-900">تأیید ورود دومرحله‌ای</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-600 leading-6">
          خروجی اکسل شامل اطلاعات محرمانه‌ی تربیتی است. برای ادامه، کد ۶ رقمی برنامه‌ی احراز هویت (یا یکی از کدهای بازیابی) را وارد کنید. این خروجی در دفتر دسترسی ثبت می‌شود.
        </p>
        <input
          autoFocus
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="کد تأیید"
          aria-label="کد تأیید"
          className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-center text-lg tracking-widest outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="h-12 w-full rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 text-white font-extrabold text-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>تأیید و دریافت خروجی</span>
        </button>
      </form>
    </div>,
    document.body
  );
};
