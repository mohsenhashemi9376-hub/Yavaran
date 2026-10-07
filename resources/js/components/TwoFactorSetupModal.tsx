import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, CheckCircle2, Copy, Download, Loader2, ShieldCheck, X } from 'lucide-react';
import { ApiError, apiRequest } from '../lib/serverSync';
import { toEnglishDigits } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** فعال‌سازی ورود دومرحله‌ای (TOTP): دریافت کلید ← تأیید کد ← ذخیره‌ی کدهای بازیابی */
export const TwoFactorSetupModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { reloadAfterSecurityChange, showToast } = useSchool();
  const [step, setStep] = useState<'intro' | 'verify' | 'done'>('intro');
  const [secret, setSecret] = useState('');
  const [uri, setUri] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'secret' | 'codes' | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep('intro');
    setSecret('');
    setUri('');
    setCode('');
    setCodes([]);
    setError('');
    setSaved(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const copy = async (text: string, what: 'secret' | 'codes') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* کپی در این مرورگر ممکن نیست */
    }
  };

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest<{ secret: string; uri: string }>('POST', '/api/two-factor/setup');
      setSecret(res.secret);
      setUri(res.uri);
      setStep('verify');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'خطا در شروع تنظیم.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiRequest<{ recoveryCodes: string[] }>('POST', '/api/two-factor/confirm', { code: toEnglishDigits(code.trim()) });
      setCodes(res.recoveryCodes || []);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.fieldErrors.code || err.message : 'خطا در تأیید کد.');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    await reloadAfterSecurityChange();
    showToast('ورود دومرحله‌ای فعال شد.', 'success');
    onClose();
  };

  const downloadCodes = () => {
    const blob = new Blob([`کدهای بازیابی ورود دومرحله‌ای — یاوران ولایت\n\n${codes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'yavaran-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[210] h-[100dvh] w-screen bg-slate-900/55 backdrop-blur-[4px] flex items-center justify-center p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && step !== 'done' && onClose()}
    >
      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white rounded-[28px] shadow-2xl">
        <div className="h-2 bg-gradient-to-l from-emerald-600 via-teal-500 to-sky-400" />
        {step !== 'done' && (
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="absolute top-5 left-4 w-9 h-9 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="px-6 pt-6 pb-6 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-900">ورود دومرحله‌ای</h3>
          </div>

          {error && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'intro' && (
            <div className="space-y-4">
              <p className="text-sm leading-7 text-slate-600 text-center">
                علاوه بر رمز عبور، هنگام ورود یک کد ۶ رقمی از گوشی شما خواسته می‌شود. حتی اگر رمز شما لو برود، بدون گوشی شما کسی وارد نمی‌شود.
              </p>
              <ol className="text-xs text-slate-600 leading-7 list-decimal pr-5 space-y-0.5">
                <li>یک برنامه‌ی احراز هویت نصب کنید (Google Authenticator، Microsoft Authenticator، Authy و ...).</li>
                <li>کلید نمایش‌داده‌شده را در برنامه وارد کنید («Enter a setup key»).</li>
                <li>کد ۶ رقمی برنامه را اینجا وارد کنید.</li>
              </ol>
              <button
                type="button"
                onClick={start}
                disabled={busy}
                className="w-full h-12 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>شروع تنظیم</span>
              </button>
            </div>
          )}

          {step === 'verify' && (
            <form onSubmit={confirm} className="space-y-4">
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-1.5">کلید تنظیم (Setup key)</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-sm font-bold tracking-wider text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 break-all text-left" dir="ltr">
                    {secret}
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(secret.replace(/\s/g, ''), 'secret')}
                    className="w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center cursor-pointer"
                    aria-label="کپی کلید"
                  >
                    {copied === 'secret' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <a href={uri} className="mt-2 inline-block text-[11px] font-bold text-teal-700 hover:text-teal-900">
                  باز کردن مستقیم در برنامه‌ی احراز هویت (موبایل)
                </a>
              </div>
              <div>
                <label htmlFor="tfa-code" className="block text-[11px] font-bold text-slate-500 mb-1.5">کد ۶ رقمی برنامه</label>
                <input
                  id="tfa-code"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="------"
                  className="w-full text-center text-xl font-mono tracking-[0.4em] bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 rounded-2xl py-3 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !code.trim()}
                className="w-full h-12 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>تأیید و فعال‌سازی</span>
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-6 font-medium">
                <b>کدهای بازیابی را همین حالا ذخیره کنید.</b> اگر گوشی خود را گم کنید، با این کدها می‌توانید وارد شوید. هر کد فقط یک‌بار کار می‌کند و دوباره نمایش داده نمی‌شود.
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm font-bold text-slate-800" dir="ltr">
                {codes.map((c) => (
                  <div key={c} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center">{c}</div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copy(codes.join('\n'), 'codes')}
                  className="flex-1 h-11 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copied === 'codes' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>کپی</span>
                </button>
                <button
                  type="button"
                  onClick={downloadCodes}
                  className="flex-1 h-11 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود</span>
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                <span>کدهای بازیابی را در جای امن ذخیره کردم</span>
              </label>
              <button
                type="button"
                onClick={finish}
                disabled={!saved}
                className="w-full h-12 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>پایان</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
