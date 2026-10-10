import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, ShieldAlert } from 'lucide-react';

// ==========================================
// 1. Toast Notification Component
// ==========================================
interface ToastNotificationProps {
  toast: { id: string; message: string; type: 'success' | 'error' | 'info' } | null;
  onClose: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const bgStyles = {
    success: 'bg-emerald-800 text-white border-emerald-700 shadow-emerald-950/20',
    error: 'bg-rose-800 text-white border-rose-700 shadow-rose-950/20',
    info: 'bg-teal-900 text-white border-teal-800 shadow-teal-950/20',
  }[toast.type];

  const IconComponent = {
    success: CheckCircle2,
    error: AlertTriangle,
    info: Info,
  }[toast.type];

  return (
    <div 
      className="fixed left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] sm:w-auto animate-in fade-in slide-in-from-top-4 duration-200"
      style={{ top: 'max(1.25rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))' }}
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      <div className={`relative overflow-hidden flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-xl ${bgStyles}`}>
        <div className="flex items-center gap-2.5">
          <IconComponent className="w-5 h-5 shrink-0 yv-pop" />
          <span className="text-xs sm:text-sm font-bold leading-normal">{toast.message}</span>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="p-1 hover:bg-white/20 rounded-lg transition cursor-pointer shrink-0"
          title="بستن پیام"
          aria-label="بستن پیام"
        >
          <X className="w-4 h-4" />
        </button>
        <span className="yv-toast-bar" aria-hidden="true" />
      </div>
    </div>
  );
};

// ==========================================
// 2. Global Confirmation Modal Component
// ==========================================
interface ConfirmationModalProps {
  dialog: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    isDangerous?: boolean;
  } | null;
  onClose: () => void;
}

export const GlobalConfirmModal: React.FC<ConfirmationModalProps> = ({ dialog, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialog?.isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, onClose]);

  if (!dialog || !dialog.isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[90] animate-in fade-in duration-150" 
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4">
        {/* Header with icon */}
        <div className="flex items-start gap-3.5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
            dialog.isDangerous ? 'bg-rose-100 text-rose-700' : 'bg-teal-50 text-teal-800'
          }`}>
            {dialog.isDangerous ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1">
            <h3 id="confirm-modal-title" className="text-base font-bold text-slate-900 leading-tight">
              {dialog.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
              {dialog.message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer min-h-[44px]"
          >
            {dialog.cancelLabel || 'انصراف و بازگشت'}
          </button>
          
          <button
            type="button"
            onClick={() => {
              dialog.onConfirm();
              onClose();
            }}
            className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer min-h-[44px] ${
              dialog.isDangerous 
                ? 'bg-rose-700 hover:bg-rose-800 focus:ring-4 focus:ring-rose-200' 
                : 'bg-teal-800 hover:bg-teal-900 focus:ring-4 focus:ring-teal-200'
            }`}
          >
            {dialog.confirmLabel || (dialog.isDangerous ? 'حذف شود' : 'تأیید')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. User Quick-Help Guide Modal (راهنمای کاربر تازه‌وارد)
// ==========================================
interface HelpGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToStudents?: () => void;
  onGoToClasses?: () => void;
  onGoToAttendance?: () => void;
}

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({
  isOpen,
  onClose,
  onGoToStudents,
  onGoToClasses,
  onGoToAttendance,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[80] animate-in fade-in duration-150" 
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-lg">
              💡
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                راهنمای سریع سامانه مدرسه یاوران ولایت
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                راهنمای ۳ مرحله‌ای برای شروع آسان و سریع بدون نیاز به آموزش
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            aria-label="بستن راهنما"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed pr-1">
          
          {/* گام ۱ */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              ۱
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-900 text-sm">کلاس‌ها و پایه‌ها</h4>
              <p className="text-xs text-slate-500 mt-1">
                کلاس‌های مدرسه از قبل تعریف شده‌اند. می‌توانید از بخش کلاس‌ها، اسامی دانش‌آموزان هر کلاس یا دبیران را مشاهده کرده یا کلاس جدید اضافه کنید.
              </p>
              {onGoToClasses && (
                <button
                  onClick={() => {
                    onClose();
                    onGoToClasses();
                  }}
                  className="mt-2 text-xs font-bold text-teal-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>ورود به بخش کلاس‌ها ←</span>
                </button>
              )}
            </div>
          </div>

          {/* گام ۲ */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              ۲
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-900 text-sm">دانش‌آموزان و پرونده‌ها</h4>
              <p className="text-xs text-slate-500 mt-1">
                برای جستجوی هر دانش‌آموز یا افزودن دانش‌آموز جدید، روی دکمه «+ ثبت‌نام دانش‌آموز» یا منوی دانش‌آموزان کلیک کنید. با کلیک روی نام هر دانش‌آموز، پرونده کامل، شماره تماس ولی و غیبت‌ها را می‌بینید.
              </p>
              {onGoToStudents && (
                <button
                  onClick={() => {
                    onClose();
                    onGoToStudents();
                  }}
                  className="mt-2 text-xs font-bold text-teal-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>ورود به بخش دانش‌آموزان ←</span>
                </button>
              )}
            </div>
          </div>

          {/* گام ۳ */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-full bg-teal-800 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
              ۳
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-slate-900 text-sm">ثبت روزانه: حضور و غیاب، تأخیر و انضباط</h4>
              <p className="text-xs text-slate-500 mt-1">
                در صفحه اصلی دکمه‌های بزرگ برای کارهای روزمره تعبیه شده‌اند:
                <br />
                • <b>ثبت حضور و غیاب:</b> انتخاب کلاس و علامت زدن حاضر/غایب.
                <br />
                • <b>ثبت تأخیر:</b> ثبت ورود دیرهنگام دانش‌آموز با انتخاب دقایق.
                <br />
                • <b>ثبت مورد انضباطی:</b> درج تذکر، اخطار و کسر نمره در پرونده دانش‌آموز.
              </p>
              {onGoToAttendance && (
                <button
                  onClick={() => {
                    onClose();
                    onGoToAttendance();
                  }}
                  className="mt-2 text-xs font-bold text-teal-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>ورود به بخش حضور و غیاب ←</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            برای راهنمایی بیشتر می‌توانید با مدیر سیستم تماس بگیرید.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition cursor-pointer min-h-[44px]"
          >
            متوجه شدم، بستن راهنما
          </button>
        </div>
      </div>
    </div>
  );
};
