import React, { useState } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';
import { BellPeriod } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { 
  Clock, 
  Plus, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Check, 
  X, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  Layers, 
  CheckCircle2,
  Calendar,
  Info
} from 'lucide-react';

export const BellPeriodsManagementSection: React.FC = () => {
  const { 
    bellPeriods, 
    updateBellPeriod, 
    addBellPeriod, 
    deleteBellPeriod, 
    resetBellPeriodsToDefault,
    classes,
    isAdminOrVice,
    isEducationalVice,
    isAdmin, showConfirm
  } = useSchool();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    startTime: string;
    endTime: string;
    order: number;
    description: string;
  }>({
    name: '',
    startTime: '08:00',
    endTime: '09:30',
    order: 1,
    description: '',
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState<{
    name: string;
    startTime: string;
    endTime: string;
    order: number;
    description: string;
  }>({
    name: '',
    startTime: '08:00',
    endTime: '09:30',
    order: bellPeriods.length + 1,
    description: '',
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Determine current active bell in real time
  const now = tehranNow();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

  const currentActiveBell = bellPeriods.find(
    (b) => currentTimeStr >= b.startTime && currentTimeStr <= b.endTime
  );

  const startEdit = (bell: BellPeriod) => {
    setEditingId(bell.id);
    setEditForm({
      name: bell.name,
      startTime: bell.startTime,
      endTime: bell.endTime,
      order: bell.order,
      description: bell.description || '',
    });
    setErrorMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setErrorMsg(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.name.trim()) {
      setErrorMsg('نام زنگ نمی‌تواند خالی باشد.');
      return;
    }
    if (!editForm.startTime || !editForm.endTime) {
      setErrorMsg('ساعت شروع و پایان الزامی است.');
      return;
    }
    if (editForm.startTime >= editForm.endTime) {
      setErrorMsg('ساعت پایان باید پس از ساعت شروع باشد.');
      return;
    }

    updateBellPeriod(id, {
      name: editForm.name.trim(),
      startTime: editForm.startTime,
      endTime: editForm.endTime,
      order: Number(editForm.order) || 1,
      description: editForm.description.trim() || undefined,
    });

    setEditingId(null);
    setErrorMsg(null);
    setSuccessMsg('ساعت و مشخصات زنگ کلاسی با موفقیت ذخیره شد.');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.name.trim()) {
      setErrorMsg('نام زنگ را وارد کنید.');
      return;
    }
    if (!newForm.startTime || !newForm.endTime) {
      setErrorMsg('ساعت شروع و پایان الزامی است.');
      return;
    }
    if (newForm.startTime >= newForm.endTime) {
      setErrorMsg('ساعت پایان باید پس از ساعت شروع باشد.');
      return;
    }

    addBellPeriod({
      name: newForm.name.trim(),
      startTime: newForm.startTime,
      endTime: newForm.endTime,
      order: Number(newForm.order) || bellPeriods.length + 1,
      description: newForm.description.trim() || undefined,
    });

    setIsAdding(false);
    setNewForm({
      name: '',
      startTime: '08:00',
      endTime: '09:30',
      order: bellPeriods.length + 2,
      description: '',
    });
    setErrorMsg(null);
    setSuccessMsg('زنگ آموزشی جدید با موفقیت به برنامه مصوب اضافه شد.');
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleDelete = (id: string, name: string) => {
    showConfirm({
      title: 'حذف شود؟',
      message: `آیا از حذف "${name}" از فهرست ساعات مصوب مدرسه مطمئن هستید؟`,
      confirmLabel: 'بله، حذف شود',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => {
      deleteBellPeriod(id);
      setSuccessMsg(`زنگ ${name} با موفقیت حذف شد.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    
      },
    });
  };

  const handleResetDefaults = () => {
    showConfirm({
      title: 'تأیید عملیات',
      message: 'آیا مایلید ساعات و زنگ‌های مدرسه به تنظیمات استاندارد اولیه (۴ زنگ مصوب متوسطه اول) بازگردانده شوند؟',
      confirmLabel: 'بله، انجام شود',
      cancelLabel: 'انصراف',
      isDangerous: false,
      onConfirm: () => {
      resetBellPeriodsToDefault();
      setSuccessMsg('زنگ‌های مصوب با موفقیت به مقادیر پیش‌فرض استاندارد بازنشانی شدند.');
      setTimeout(() => setSuccessMsg(null), 3500);
    
      },
    });
  };

  return (
    <div className="space-y-6 font-['Vazirmatn',sans-serif]">
      {/* Top Banner & Explanation */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-700/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-semibold text-blue-200">
              <Clock className="w-3.5 h-3.5" />
              <span>تنظیمات ساعات و زنگ‌های رسمی • ویژه مدیر و معاونت آموزش</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              مدیریت زنگ‌های درسی و ساعت پیش‌فرض کلاس‌ها
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed max-w-3xl">
              با تنظیم ساعات شروع و پایان هر زنگ، هنگام ثبت حضور و غیاب توسط دبیران گرامی، ساعت شروع و پایان جلسه تدریس <strong>به صورت خودکار و بدون نیاز به وارد کردن دستی</strong> بر اساس این زنگ‌ها تنظیم و درج می‌گردد.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isAdminOrVice && (
              <button
                id="btn-add-bell-period"
                onClick={() => {
                  setIsAdding(!isAdding);
                  setErrorMsg(null);
                }}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن زنگ جدید</span>
              </button>
            )}

            {isAdmin && (
              <button
                id="btn-reset-bell-periods"
                onClick={handleResetDefaults}
                className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs rounded-xl transition border border-white/20 flex items-center gap-1.5 cursor-pointer"
                title="بازنشانی به ساعات پیش‌فرض متوسطه اول"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازنشانی به استاندارد</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="mt-5 pt-4 border-t border-indigo-700/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-indigo-200">وضعیت کنونی زمان مدرسه:</span>
            {currentActiveBell ? (
              <span className="bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-bold px-2.5 py-0.5 rounded-md">
                هم‌اکنون: {currentActiveBell.name} ({toPersianDigits(currentActiveBell.startTime)} الی {toPersianDigits(currentActiveBell.endTime)})
              </span>
            ) : (
              <span className="bg-slate-700/60 border border-slate-600 text-slate-300 px-2.5 py-0.5 rounded-md">
                خارج از ساعات زنگ آموزشی (ساعت سیستم: {toPersianDigits(currentTimeStr)})
              </span>
            )}
          </div>

          <div className="text-indigo-200 text-[11px]">
            تعداد زنگ‌های مصوب: <strong>{toPersianDigits(bellPeriods.length)} زنگ فعال</strong>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add New Period Form Drawer/Card */}
      {isAdding && (
        <form 
          onSubmit={handleCreateNew}
          className="bg-white border-2 border-emerald-500/40 rounded-2xl p-5 shadow-md space-y-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-800">تعریف زنگ درسی یا فوق‌برنامه جدید</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نام زنگ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="مثال: زنگ پنجم / فوق برنامه"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ساعت شروع (فرمت 24 ساعته) <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={newForm.startTime}
                onChange={(e) => setNewForm({ ...newForm, startTime: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ساعت پایان (فرمت 24 ساعته) <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={newForm.endTime}
                onChange={(e) => setNewForm({ ...newForm, endTime: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ترتیب زنگ
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={newForm.order}
                onChange={(e) => setNewForm({ ...newForm, order: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
              />
            </div>

            <div className="sm:col-span-2 md:col-span-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                توضیحات و یادداشت زنگ (اختیاری)
              </label>
              <input
                type="text"
                value={newForm.description}
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                placeholder="مثال: کلاس‌های تقویتی بعدازظهر، آزمایشگاه، کارگاه و ..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>ثبت و ذخیره زنگ جدید</span>
            </button>
          </div>
        </form>
      )}

      {/* Grid of Bell Period Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bellPeriods.map((bell, idx) => {
          const isEditing = editingId === bell.id;
          const isCurrent = currentActiveBell?.id === bell.id;
          
          // Find which classes are assigned to this bell
          const assignedClasses = classes.filter(c => c.defaultBellPeriodId === bell.id);

          return (
            <div
              key={bell.id}
              className={`bg-white rounded-2xl p-5 border transition shadow-xs relative flex flex-col justify-between ${
                isCurrent 
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-gradient-to-b from-emerald-50/20 to-white' 
                  : isEditing
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isCurrent 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    }`}>
                      {toPersianDigits(idx + 1)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                          {bell.name}
                        </h3>
                        {isCurrent && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 animate-pulse">
                            هم‌اکنون در حال برگزاری
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {bell.description || 'زنگ مصوب آموزشی دبیرستان'}
                      </p>
                    </div>
                  </div>

                  {isAdminOrVice && !isEditing && (
                    <div className="flex items-center gap-1">
                      <button
                        id={`btn-edit-bell-${bell.id}`}
                        onClick={() => startEdit(bell)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        title="ویرایش ساعت و مشخصات زنگ"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        id={`btn-delete-bell-${bell.id}`}
                        onClick={() => handleDelete(bell.id, bell.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="حذف زنگ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Edit Mode inline */}
                {isEditing ? (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">نام زنگ</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">ترتیب</label>
                        <input
                          type="number"
                          value={editForm.order}
                          onChange={(e) => setEditForm({ ...editForm, order: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">ساعت شروع</label>
                        <input
                          type="time"
                          value={editForm.startTime}
                          onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">ساعت پایان</label>
                        <input
                          type="time"
                          value={editForm.endTime}
                          onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">توضیحات</label>
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="توضیح اختیاری..."
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                      >
                        انصراف
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(bell.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>ذخیره تغییرات</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Time Badge */
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-medium">ساعت شروع مصوب:</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                        {toPersianDigits(bell.startTime)}
                      </span>
                    </div>

                    <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-medium">ساعت پایان مصوب:</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-200">
                        {toPersianDigits(bell.endTime)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Assigned classes count & footer */}
              {!isEditing && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>کلاس‌های متصل به این زنگ:</span>
                  </div>
                  {assignedClasses.length > 0 ? (
                    <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-md text-[11px] border border-blue-200">
                      {toPersianDigits(assignedClasses.length)} کلاس ({assignedClasses.map(c => c.name).join('، ')})
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">
                      پیش‌فرض عمومی همه کلاس‌ها
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info helper note */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-800">
            راهنمای زمان‌بندی هوشمند حضور و غیاب:
          </p>
          <p className="leading-relaxed text-slate-500">
            معلمان هنگام شروع ثبت جلسه جدید، نیازی به درج یا محاسبه ساعت شروع و پایان ندارند. سیستم به صورت پیش‌فرض ساعات مصوب بالا را در فرم درج کرده و دبیر فقط مبحث درسی، تکالیف و وضعیت حضور دانش‌آموزان را تکمیل می‌نماید. در صورت برگزاری زنگ‌های فوق‌برنامه، با یک کلیک می‌توان زنگ مورد نظر را انتخاب کرد.
          </p>
        </div>
      </div>
    </div>
  );
};
