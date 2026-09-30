import React, { useState } from 'react';
import { 
  Settings, 
  Download, 
  Upload, 
  RotateCcw, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Shield, 
  User as UserIcon, 
  Info,
  Building,
  Calendar,
  LogOut,
  FileJson,
  HelpCircle
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';
import { getUserGreeting } from '../utils/userRoles';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({ isOpen, onClose }) => {
  const { 
    currentUser, 
    logout, 
    exportDatabaseJson, 
    importDatabaseJson, 
    resetToDemoData,
    showToast,
    students,
    classes,
    allTeachers,
    allCoaches,
    sessions,
    morningDelays,
    schoolAbsences
  } = useSchool();

  const [activeTab, setActiveTab] = useState<'backup' | 'school_info' | 'reset'>('backup');
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [resetInputMatch, setResetInputMatch] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const todayInfo = getTodayShamsi();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const jsonContent = event.target?.result as string;
      
      // Strict confirmation before restoring
      showToast('آماده بازیابی', 'لطفاً عملیات جایگزینی داده‌ها را تأیید کنید.', 'info');
      if (window.confirm('بازیابی اطلاعات:\nبا این کار اطلاعات فعلی مدرسه با داده‌های فایل انتخاب‌شده جایگزین خواهند شد.\nآیا ادامه می‌دهید؟')) {
        try {
          setIsImporting(true);
          const success = importDatabaseJson(jsonContent);
          if (success) {
            showToast('بازیابی موفق', 'اطلاعات سامانه با موفقیت از فایل پشتیبان بازیابی شد.', 'success');
            onClose();
          } else {
            showToast('خطا در بازیابی', 'ساختار فایل پشتیبان معتبر نیست.', 'error');
          }
        } catch (err) {
          showToast('خطا در خواندن فایل', 'فایل انتخاب‌شده نامعتبر است.', 'error');
        } finally {
          setIsImporting(false);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmReset = () => {
    if (resetInputMatch.trim() !== 'یاوران ولایت') {
      showToast('خطا در تایید', 'لطفاً عبارت «یاوران ولایت» را دقیق وارد کنید.', 'error');
      return;
    }
    resetToDemoData();
    showToast('بازنشانی انجام شد', 'اطلاعات سامانه به داده‌های اولیه بازنشانی شد.', 'success');
    setIsConfirmingReset(false);
    setResetInputMatch('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      <div 
        className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] z-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-l from-slate-50 to-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base sm:text-lg font-black text-slate-900">
                تنظیمات و مدیریت سامانه
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                پشتیبان‌گیری از داده‌ها، بازیابی فایل، مشخصات مدرسه و حساب کاربری
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="بستن (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'backup'
                ? 'bg-white text-teal-900 border-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-white/60'
            }`}
          >
            <FileJson className="w-4 h-4" />
            <span>پشتیبان‌گیری و بازیابی</span>
          </button>

          <button
            onClick={() => setActiveTab('school_info')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'school_info'
                ? 'bg-white text-teal-900 border-teal-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-white/60'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>مشخصات مدرسه و آمار</span>
          </button>

          <button
            onClick={() => setActiveTab('reset')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border-b-2 ${
              activeTab === 'reset'
                ? 'bg-white text-rose-800 border-rose-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-white/60'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-rose-600" />
            <span>بازنشانی اطلاعات</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-teal-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-teal-900">
                  <Info className="w-4 h-4" />
                  <span>امنیت و استقلال اطلاعات</span>
                </div>
                <p className="text-teal-900/80 leading-relaxed">
                  تمام اطلاعات مدرسه (دانش‌آموزان، جلسات حضور و غیاب، تأخیرها، غیبت‌ها و موارد انضباطی) در حافظه محلی ذخیره شده است. با دانلود منظم فایل پشتیبان، همیشه نسخه امنی از داده‌ها نزد خود داشته باشید.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Export Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <Download className="w-4 h-4 text-teal-800" />
                    <span>پشتیبان‌گیری از اطلاعات</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    یک نسخه کامل پشتیبان شامل تمام سوابق انضباطی، آموزشی، اساتید و کلاس‌ها برای بایگانی در دستگاه شما ذخیره می‌شود.
                  </p>
                  <button
                    onClick={exportDatabaseJson}
                    className="w-full py-2.5 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>پشتیبان‌گیری از داده‌ها</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                    <Upload className="w-4 h-4 text-indigo-700" />
                    <span>بازیابی اطلاعات از فایل</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    فایل پشتیبان از پیش دانلود شده را انتخاب کنید تا اطلاعات در سامانه جایگزین شوند.
                  </p>
                  <label className="w-full py-2.5 px-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                    <Upload className="w-4 h-4" />
                    <span>{isImporting ? 'در حال بازیابی...' : 'انتخاب فایل JSON'}</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isImporting}
                    />
                  </label>
                </div>
              </div>

              {/* Current User Details */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      کاربر وارد شده: {currentUser?.name || 'کاربر محترم'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      نام کاربری: {currentUser?.username || 'admin'} • نقش: {getUserGreeting(currentUser).roleLabel}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج از حساب</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: School Info & Metrics */}
          {activeTab === 'school_info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] text-slate-500">نام مجتمع آموزشی</div>
                  <div className="text-xs font-bold text-slate-900">دبیرستان دوره اول یاوران ولایت</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] text-slate-500">سال تحصیلی جاری</div>
                  <div className="text-xs font-bold text-slate-900">۱۴۰۴ - ۱۴۰۵</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] text-slate-500">تاریخ جاری سامانه</div>
                  <div className="text-xs font-bold text-teal-800">
                    {todayInfo.dayOfWeek}، {todayInfo.displayDate}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[11px] text-slate-500">نسخه نرم‌افزار</div>
                  <div className="text-xs font-bold text-slate-700">نسخه هوشمند ۴.۲.۰ (پایدار)</div>
                </div>
              </div>

              {/* Data Summary */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="text-xs font-bold text-slate-800 mb-2">خلاصه اطلاعات ذخیره‌شده:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-between">
                    <span>تعداد دانش‌آموزان:</span>
                    <span className="font-bold font-mono">{toPersianDigits(students.length)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-between">
                    <span>تعداد کلاس‌ها:</span>
                    <span className="font-bold font-mono">{toPersianDigits(classes.length)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-between">
                    <span>تعداد دبیران:</span>
                    <span className="font-bold font-mono">{toPersianDigits(allTeachers.length)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-between">
                    <span>جلسات کلاسی:</span>
                    <span className="font-bold font-mono">{toPersianDigits(sessions.length)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-between">
                    <span>تأخیرهای ورود:</span>
                    <span className="font-bold font-mono">{toPersianDigits(morningDelays.length)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 flex items-center justify-between">
                    <span>غیبت‌های مدرسه:</span>
                    <span className="font-bold font-mono">{toPersianDigits(schoolAbsences?.length || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Reset Demo Data */}
          {activeTab === 'reset' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span>هشدار بازنشانی داده‌های سامانه</span>
                </div>
                <p className="text-rose-800/90 leading-relaxed">
                  با بازنشانی داده‌ها، تمام تغییرات ایجادشده پاک شده و اطلاعات به حالت نمونه اولیه مدرسه یاوران ولایت برمی‌گردد. قبل از انجام این کار، توصیه می‌شود ابتدا یک نسخه پشتیبان از تب اول دانلود فرمایید.
                </p>
              </div>

              {!isConfirmingReset ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingReset(true)}
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>آغاز فرآیند بازنشانی به اطلاعات نمونه</span>
                </button>
              ) : (
                <div className="p-4 rounded-xl border-2 border-rose-300 bg-rose-50/50 space-y-3">
                  <p className="text-xs text-slate-700 font-medium">
                    جهت تایید نهایی، عبارت <span className="font-black text-rose-700 underline">یاوران ولایت</span> را در کادر زیر تایپ کنید:
                  </p>
                  <input
                    type="text"
                    value={resetInputMatch}
                    onChange={(e) => setResetInputMatch(e.target.value)}
                    placeholder="یاوران ولایت"
                    className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl text-xs font-bold text-center focus:outline-hidden focus:ring-2 focus:ring-rose-600"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmReset}
                      disabled={resetInputMatch.trim() !== 'یاوران ولایت'}
                      className="flex-1 py-2 px-3 bg-rose-700 hover:bg-rose-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      تایید و بازنشانی قطعی
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsConfirmingReset(false);
                        setResetInputMatch('');
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      انصراف
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            سامانه هوشمند مدیریت مدارس یاوران ولایت
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
