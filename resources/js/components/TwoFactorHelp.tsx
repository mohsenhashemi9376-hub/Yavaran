import React from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

/** راهنمای کوتاه ورود دومرحله‌ای برای مربیان و معاون تربیتی (در صفحه‌ی ورود) */
export const TwoFactorHelp: React.FC = () => (
  <details className="group rounded-2xl border border-slate-200 bg-slate-50/70 text-xs text-slate-600">
    <summary className="flex items-center gap-2 px-3.5 py-3 cursor-pointer select-none list-none font-bold text-slate-700 [&::-webkit-details-marker]:hidden">
      <HelpCircle className="w-4 h-4 text-teal-700 shrink-0" />
      <span className="flex-1">راهنمای ورود مربیان و معاون تربیتی</span>
      <ChevronDown className="w-4 h-4 text-slate-400 transition group-open:rotate-180" />
    </summary>

    <div className="px-3.5 pb-3.5 space-y-3 leading-6 border-t border-slate-200 pt-3">
      <p>
        مربی و معاون تربیتی علاوه بر رمز عبور، با یک <b>کد ۶ رقمی از برنامه‌ی احراز هویت</b> گوشی وارد می‌شوند
        (Google Authenticator، Microsoft Authenticator یا Authy). معلم‌ها فقط با رمز وارد می‌شوند.
      </p>

      <div>
        <div className="font-black text-slate-800 mb-1">فعال‌سازی (فقط یک‌بار)</div>
        <ol className="list-decimal pr-5 space-y-0.5">
          <li>برنامه‌ی احراز هویت را روی گوشی نصب کنید.</li>
          <li>با نام کاربری و رمز وارد شوید و از بنر بالای پنل «فعال‌سازی ورود دومرحله‌ای» را بزنید.</li>
          <li>کلید نمایش‌داده‌شده را در برنامه وارد کنید («Enter a setup key»).</li>
          <li>کد ۶ رقمی برنامه را در سامانه بزنید و ۸ کد بازیابی را جای امنی نگه دارید.</li>
        </ol>
      </div>

      <div>
        <div className="font-black text-slate-800 mb-1">هر بار ورود</div>
        <p>نام کاربری و رمز را بزنید، سپس کد ۶ رقمی فعلیِ برنامه را وارد کنید. کد هر ۳۰ ثانیه عوض می‌شود و اینترنت نمی‌خواهد.</p>
      </div>

      <div>
        <div className="font-black text-slate-800 mb-1">مشکل دارید؟</div>
        <ul className="list-disc pr-5 space-y-0.5">
          <li>کد قبول نمی‌شود: ساعت گوشی را روی «خودکار» بگذارید.</li>
          <li>گوشی را گم کرده‌اید: در صفحه‌ی کد «استفاده از کد بازیابی» را بزنید (هر کد فقط یک‌بار).</li>
          <li>کدهای بازیابی را هم ندارید: به مدیر سامانه اطلاع دهید.</li>
          <li>بعد از ۵ کد اشتباه، ورود چند دقیقه قفل می‌شود.</li>
        </ul>
      </div>

      <p className="text-slate-500">کد برنامه و کدهای بازیابی را به هیچ‌کس نگویید.</p>
    </div>
  </details>
);
