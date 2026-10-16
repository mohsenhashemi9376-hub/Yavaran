import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CloudOff, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';

/**
 * نشانگر کوچک وضعیت ذخیره: در حال ذخیره / ذخیره شد / ذخیره نشد / آفلاین (در حالت عادی دیده نمی‌شود).
 * در حالت آفلاین، ثبت‌ها روی همین دستگاه می‌مانند و با برگشتن اینترنت خودکار ارسال می‌شوند.
 */
export const SyncStatusBadge: React.FC = () => {
  const { syncState, syncErrorStatus, syncQueuedCount, retrySync } = useSchool();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [justSaved, setJustSaved] = useState(false);
  const prev = useRef(syncState);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    if ((prev.current === 'saving' || prev.current === 'offline') && syncState === 'idle') {
      setJustSaved(true);
      timer = window.setTimeout(() => setJustSaved(false), 2200);
    }
    if (syncState !== 'idle') setJustSaved(false);
    prev.current = syncState;
    return () => window.clearTimeout(timer);
  }, [syncState]);

  let tone = '';
  let icon: React.ReactNode = null;
  let text = '';
  let canRetry = false;
  if (syncState === 'offline') {
    tone = 'bg-amber-500 text-white';
    icon = <WifiOff className="w-3.5 h-3.5" />;
    text = `آفلاین؛ ${toPersianDigits(syncQueuedCount)} ثبت روی این دستگاه ذخیره شد و با وصل‌شدن اینترنت ارسال می‌شود`;
    canRetry = true;
  } else if (syncState === 'error') {
    tone = 'bg-rose-600 text-white';
    icon = <CloudOff className="w-3.5 h-3.5" />;
    // «اتصال» را فقط وقتی بگو که واقعاً ارتباط قطع است؛ رد دسترسی یا خطای سرور پیام جدا دارد
    text = syncErrorStatus === 403
      ? 'ذخیره نشد؛ شما دسترسی ثبت این مورد را ندارید'
      : syncErrorStatus === 0 || syncErrorStatus === null
      ? 'ذخیره نشد؛ اتصال را بررسی کنید و دوباره تلاش کنید'
      : 'ذخیره نشد؛ خطای سرور. دوباره تلاش کنید';
  } else if (!online) {
    tone = 'bg-amber-500 text-white';
    icon = <WifiOff className="w-3.5 h-3.5" />;
    text = syncState === 'saving' ? 'آفلاین؛ در انتظار اتصال برای ذخیره' : 'اتصال اینترنت قطع است؛ ثبت‌ها روی همین دستگاه می‌مانند';
  } else if (syncState === 'saving') {
    tone = 'bg-slate-800 text-white';
    icon = <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    text = 'در حال ذخیره…';
  } else if (justSaved) {
    tone = 'bg-emerald-600 text-white';
    icon = <CheckCircle2 className="w-3.5 h-3.5" />;
    text = 'همه‌ی تغییرات ذخیره شد';
  } else {
    return null;
  }

  return (
    <div className="fixed z-[90] left-3 bottom-24 md:bottom-4 pointer-events-none" dir="rtl" role="status" aria-live="polite">
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold shadow-lg max-w-[calc(100vw-1.5rem)] ${tone}`}>
        {icon}
        <span className="leading-5">{text}</span>
        {canRetry && (
          <button
            type="button"
            onClick={retrySync}
            className="pointer-events-auto mr-1 shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>تلاش دوباره</span>
          </button>
        )}
      </div>
    </div>
  );
};
