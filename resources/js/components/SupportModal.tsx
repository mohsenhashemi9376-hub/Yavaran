import React from 'react';
import { 
  X, 
  HelpCircle, 
  Phone, 
  Clock, 
  MessageSquare, 
  ShieldCheck, 
  ExternalLink,
  BookOpen,
  CheckCircle2
} from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

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
        aria-labelledby="support-modal-title"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-l from-blue-50/60 via-slate-50 to-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-center font-black shadow-xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="support-modal-title" className="text-base font-black text-slate-900">
                پشتیبانی و راهنمای سامانه
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                مجتمع تربیتی آموزشی یاوران ولایت • واحد فناوری اطلاعات
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
          
          {/* Working hours banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Clock className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900">
                ساعات پاسخگویی واحد فناوری مدرسه
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                شنبه تا چهارشنبه از ساعت {toPersianDigits('07:30')} الی {toPersianDigits('14:30')} (روزهای کاری رسمی)
              </div>
            </div>
          </div>

          {/* Contact Cards */}
          <div className="space-y-2.5">
            <div className="text-slate-700 font-bold text-xs flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-blue-700" />
              <span>راه‌های ارتباط و تماس مستقیم</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 text-xs">داخلی فناوری و اتوماسیون مدرسه</div>
                <div className="text-[11px] text-slate-400 mt-0.5">اتاق سرور و پشتیبانی مستقر در مدرسه</div>
              </div>
              <div className="font-mono text-sm font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200" dir="ltr">
                {toPersianDigits('104')}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 text-xs">خط ویژه راهنمایی و رفع مشکل</div>
                <div className="text-[11px] text-slate-400 mt-0.5">پشتیبان فنی سامانه یاوران ولایت</div>
              </div>
              <div className="font-mono text-sm font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200" dir="ltr">
                {toPersianDigits('021-88776655')}
              </div>
            </div>
          </div>

          {/* Quick FAQ / Guidance */}
          <div className="space-y-2 pt-1">
            <div className="text-slate-700 font-bold text-xs flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-700" />
              <span>نکات و راهنمایی‌های متداول</span>
            </div>

            <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>ثبت حضور و غیاب:</strong> در پایان هر زنگ کلاسی ثبت و تایید فرمایید تا نمرات انضباطی به صورت سیستمی محاسبه شوند.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>تغییر نقش یا حساب:</strong> با زدن گزینه «تغییر حساب» در منوی کاربری می‌توانید به سایر حساب‌ها یا نقش‌های تخصیص‌یافته جابجا شوید.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>امنیت اطلاعات:</strong> پس از اتمام کار در رایانه‌های مشترک مدرسه، حتماً با دکمه «خروج از حساب» جلسه خود را پایان دهید.
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
};
