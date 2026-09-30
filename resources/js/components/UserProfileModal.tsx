import React from 'react';
import { 
  X, 
  User as UserIcon, 
  ShieldCheck, 
  Phone, 
  BookOpen, 
  GraduationCap, 
  Hash, 
  Clock, 
  CheckCircle2,
  Calendar,
  Lock
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { getUserGreeting } from '../utils/userRoles';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSwitcher?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenSwitcher,
}) => {
  const { currentUser, classes } = useSchool();
  const todayInfo = getTodayShamsi();
  const userGreeting = getUserGreeting(currentUser);

  if (!isOpen) return null;

  // Find assigned classes names
  const assignedClassNames = (currentUser.assignedClassIds || [])
    .map(cId => classes.find(c => c.id === cId)?.name)
    .filter(Boolean);

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
        aria-labelledby="profile-modal-title"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-l from-teal-50/70 via-slate-50 to-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center font-black text-sm shadow-xs">
              {currentUser?.name ? currentUser.name.slice(0, 2) : 'کا'}
            </div>
            <div>
              <h2 id="profile-modal-title" className="text-base font-black text-slate-900">
                حساب کاربری من
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                اطلاعات پرسنلی، سطح دسترسی و کلاس‌های تخصیص‌یافته
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
          
          {/* Identity Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-teal-800 flex items-center justify-center font-black text-base shadow-xs shrink-0">
                {currentUser?.name ? currentUser.name.slice(0, 2) : 'کا'}
              </div>
              <div>
                <div className="text-sm font-black text-slate-900">
                  {currentUser?.name || 'کاربر گرامی'}
                </div>
                <div className="text-[11px] font-semibold text-teal-800 mt-0.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{userGreeting.roleLabel}</span>
                  {currentUser.roleTitle && currentUser.roleTitle !== userGreeting.roleLabel && (
                    <span className="text-slate-400">({currentUser.roleTitle})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-left shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                <CheckCircle2 className="w-3 h-3" />
                <span>حساب فعال</span>
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Username */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white">
              <div className="text-slate-400 text-[10px] font-medium flex items-center gap-1 mb-1">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>شناسه کاربری</span>
              </div>
              <div className="text-xs font-bold text-slate-800 font-mono" dir="ltr">
                {currentUser.username || 'admin'}
              </div>
            </div>

            {/* Phone */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white">
              <div className="text-slate-400 text-[10px] font-medium flex items-center gap-1 mb-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>شماره تماس</span>
              </div>
              <div className="text-xs font-bold text-slate-800" dir="ltr">
                {currentUser.phone ? toPersianDigits(currentUser.phone) : 'ثبت‌نشده'}
              </div>
            </div>

            {/* Subject / Specialty (if applicable) */}
            {(currentUser.subject || currentUser.subjectSpecialty) && (
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <div className="text-slate-400 text-[10px] font-medium flex items-center gap-1 mb-1">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  <span>درس / زمینه تخصصی</span>
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {currentUser.subject || currentUser.subjectSpecialty}
                </div>
              </div>
            )}

            {/* Coach Specialty */}
            {currentUser.coachRoleTitle && (
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <div className="text-slate-400 text-[10px] font-medium flex items-center gap-1 mb-1">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  <span>سمت تربیتی</span>
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {currentUser.coachRoleTitle}
                </div>
              </div>
            )}

            {/* Date */}
            <div className="p-3 rounded-xl border border-slate-200 bg-white">
              <div className="text-slate-400 text-[10px] font-medium flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>تاریخ امروز</span>
              </div>
              <div className="text-xs font-bold text-slate-800">
                {todayInfo.dayOfWeek}، {todayInfo.displayDate}
              </div>
            </div>
          </div>

          {/* Assigned Classes (if any) */}
          {assignedClassNames.length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <div className="text-slate-500 text-[11px] font-bold flex items-center gap-1.5 mb-2">
                <GraduationCap className="w-4 h-4 text-teal-700" />
                <span>کلاس‌های تحت پوشش / تخصیص‌یافته</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assignedClassNames.map((cName, idx) => (
                  <span 
                    key={idx} 
                    className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[11px] font-medium"
                  >
                    {cName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Security & Access Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed flex items-start gap-2">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              سطح دسترسی شما مطابق با سیاست‌های امنیتی مجتمع تربیتی آموزشی یاوران ولایت تنظیم گردیده است. برای تغییر مشخصات پرسنلی یا کلاس‌ها با معاونت مربوطه هماهنگ فرمایید.
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          {onOpenSwitcher ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSwitcher();
              }}
              className="text-xs font-bold text-teal-800 hover:text-teal-900 transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>تغییر حساب / نقش</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
