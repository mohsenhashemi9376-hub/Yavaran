import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { TwoFactorSetupModal } from './TwoFactorSetupModal';

/** هشدار اجباری: مربی و معاون تربیتی بدون ورود دومرحله‌ای به پرونده‌های تربیتی دسترسی ندارند */
export const TwoFactorRequiredBanner: React.FC = () => {
  const { security } = useSchool();
  const [open, setOpen] = useState(false);

  if (!security.twoFactorRequired || security.twoFactorEnabled) return null;

  return (
    <>
      <div className="rounded-3xl border border-amber-300 bg-gradient-to-l from-amber-50 via-white to-amber-50 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm" role="alert">
        <span className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 ring-8 ring-amber-50">
          <ShieldAlert className="w-7 h-7" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-base font-black text-amber-900">ورود دومرحله‌ای را فعال کنید</div>
          <p className="text-xs text-amber-800/90 mt-1 leading-6">
            پرونده‌های تربیتی و مشاهدات رفتاری محرمانه‌اند. تا ورود دومرحله‌ای حساب شما فعال نشود، این اطلاعات نمایش داده نمی‌شود.
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
