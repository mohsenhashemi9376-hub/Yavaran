import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
  onClose: () => void;
}

/** خطای ۴۰۳ — دسترسی غیرمجاز */
export const AccessDeniedNotice: React.FC<Props> = ({ onClose }) => (
  <div
    role="alert"
    dir="rtl"
    className="bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-3 shadow-xs font-['Vazirmatn',sans-serif]"
  >
    <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
      <ShieldAlert className="w-6 h-6" />
    </div>
    <div className="text-sm font-black text-slate-900">خطای ۴۰۳ — دسترسی غیرمجاز</div>
    <p className="text-xs text-slate-600 leading-relaxed">
      متأسفیم، شما اجازه‌ی ورود به این بخش را ندارید. اگر فکر می‌کنید این یک اشتباه است، لطفاً با مدیر مدرسه هماهنگ کنید.
    </p>
    <button
      type="button"
      onClick={onClose}
      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
    >
      بازگشت به پیشخوان
    </button>
  </div>
);
