import React, { useState, useEffect } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass } from '../types';
import { X, GraduationCap, Save, Trash2, AlertTriangle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

interface EditClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  classData?: SchoolClass | null;
  schoolClass?: SchoolClass | null;
}

export const EditClassModal: React.FC<EditClassModalProps> = ({ isOpen, onClose, classData, schoolClass }) => {
  const currentClass = classData || schoolClass || null;
  const { updateClass, deleteClass, classes, allTeachers, allCoaches, bellPeriods, students, sessions, showToast } = useSchool();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('پایه هفتم');
  const [major, setMajor] = useState('متوسطه اول');
  const [roomNumber, setRoomNumber] = useState('');
  const [academicYear, setAcademicYear] = useState('۱۴۰۴-۱۴۰۵');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  // Inline validation errors
  const [errorName, setErrorName] = useState<string | null>(null);

  // Bell period and default times
  const [selectedBellId, setSelectedBellId] = useState<string>('bell-1');
  const [defaultStartTime, setDefaultStartTime] = useState<string>('07:45');
  const [defaultEndTime, setDefaultEndTime] = useState<string>('09:15');
  const [isCustomTime, setIsCustomTime] = useState(false);

  useEffect(() => {
    if (currentClass) {
      setName(currentClass.name);
      setGrade(currentClass.grade);
      setMajor(currentClass.major);
      setRoomNumber(currentClass.roomNumber || '');
      setAcademicYear(currentClass.academicYear);
      setSelectedTeacherIds(currentClass.teacherIds || []);
      setSelectedCoachId(currentClass.coachId || '');
      setShowDeleteConfirm(false);
      setDeleteWarning(null);
      setErrorName(null);

      if (currentClass.defaultBellPeriodId) {
        setSelectedBellId(currentClass.defaultBellPeriodId);
        setIsCustomTime(false);
      } else if (currentClass.defaultStartTime && currentClass.defaultEndTime) {
        const matchingBell = bellPeriods.find(
          (b) => b.startTime === currentClass.defaultStartTime && b.endTime === currentClass.defaultEndTime
        );
        if (matchingBell) {
          setSelectedBellId(matchingBell.id);
          setIsCustomTime(false);
        } else {
          setSelectedBellId('custom');
          setIsCustomTime(true);
        }
      } else {
        setSelectedBellId(bellPeriods[0]?.id || 'bell-1');
        setIsCustomTime(false);
      }

      setDefaultStartTime(currentClass.defaultStartTime || bellPeriods[0]?.startTime || '07:45');
      setDefaultEndTime(currentClass.defaultEndTime || bellPeriods[0]?.endTime || '09:15');
    }
  }, [currentClass, isOpen, bellPeriods]);

  if (!isOpen || !currentClass) return null;

  const classStudents = students.filter((s) => s.classId === currentClass.id);
  const classSessions = sessions.filter((s) => s.classId === currentClass.id);

  const handleBellChange = (bellId: string) => {
    setSelectedBellId(bellId);
    if (bellId === 'custom') {
      setIsCustomTime(true);
    } else {
      setIsCustomTime(false);
      const target = bellPeriods.find((b) => b.id === bellId);
      if (target) {
        setDefaultStartTime(target.startTime);
        setDefaultEndTime(target.endTime);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setErrorName('لطفاً نام کلاس را وارد کنید.');
      return;
    }

    // Check duplicate in same grade (excluding this class)
    const isDuplicate = classes.some(
      (c) => c.id !== currentClass.id && c.grade === grade && c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (isDuplicate) {
      setErrorName(`کلاسی با نام «${cleanName}» در ${grade} قبلاً ثبت شده است.`);
      return;
    }

    try {
      setIsSubmitting(true);
      updateClass(currentClass.id, {
        name: cleanName,
        grade,
        major,
        academicYear,
        roomNumber: roomNumber.trim() || undefined,
        teacherIds: selectedTeacherIds,
        coachId: selectedCoachId || undefined,
        defaultBellPeriodId: selectedBellId !== 'custom' ? selectedBellId : undefined,
        defaultStartTime: defaultStartTime || '07:45',
        defaultEndTime: defaultEndTime || '09:15',
      });

      showToast('ویرایش موفق', `اطلاعات کلاس «${cleanName}» با موفقیت به‌روزرسانی شد.`, 'success');
      onClose();
    } catch (err) {
      console.error('Failed to update class:', err);
      showToast('خطا در ذخیره اطلاعات', 'هنگام ذخیره تغییرات کلاس مشکلی رخ داد. لطفاً دوباره تلاش کنید.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    // Phase 20: Prevent deleting class if it has students!
    if (classStudents.length > 0) {
      setDeleteWarning(
        `این کلاس دارای ${toPersianDigits(classStudents.length)} دانش‌آموز است. برای حذف کلاس ابتدا وضعیت دانش‌آموزان را مشخص یا آن‌ها را به کلاس دیگری منتقل کنید.`
      );
      return;
    }
    setDeleteWarning(null);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsSubmitting(true);
      const success = deleteClass(currentClass.id);
      if (success) {
        showToast('حذف کلاس', `کلاس «${currentClass.name}» با موفقیت حذف شد.`, 'info');
        onClose();
      } else {
        showToast('خطا در حذف کلاس', 'امکان حذف کلاس وجود ندارد.', 'error');
      }
    } catch (err) {
      console.error('Failed to delete class:', err);
      showToast('خطا در حذف کلاس', 'هنگام حذف کلاس خطایی رخ داد.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(teacherId)
        ? prev.filter((id) => id !== teacherId)
        : [...prev, teacherId]
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 font-['Vazirmatn',sans-serif]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">ویرایش کلاس {classData.name}</h2>
              <p className="text-xs text-slate-400">تغییر مشخصات، مربی، اساتید و ساعات پیش‌فرض کلاسی</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                پایه تحصیلی <span className="text-red-500">*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                  setErrorName(null);
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-medium text-slate-800"
              >
                <option value="پایه هفتم">پایه هفتم (متوسطه اول)</option>
                <option value="پایه هشتم">پایه هشتم (متوسطه اول)</option>
                <option value="پایه نهم">پایه نهم (متوسطه اول)</option>
                <option value="پایه دهم">پایه دهم (متوسطه دوم)</option>
                <option value="پایه یازدهم">پایه یازدهم (متوسطه دوم)</option>
                <option value="پایه دوازدهم">پایه دوازدهم (متوسطه دوم)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رشته تحصیلی
              </label>
              <select
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-medium text-slate-800"
              >
                <option value="متوسطه اول">متوسطه اول (عمومی)</option>
                <option value="علوم تجربی">علوم تجربی</option>
                <option value="ریاضی و فیزیک">ریاضی و فیزیک</option>
                <option value="ادبیات و علوم انسانی">ادبیات و علوم انسانی</option>
                <option value="علوم و معارف اسلامی">علوم و معارف اسلامی</option>
                <option value="فنی و حرفه‌ای">فنی و حرفه‌ای</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              نام کامل کلاس <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorName) setErrorName(null);
              }}
              placeholder="مثلاً: کلاس ۸/۲ یا هفتم ۱ (شهید باکری)"
              className={`w-full text-xs bg-slate-50 border rounded-xl px-3 py-2.5 focus:bg-white outline-none font-bold transition ${
                errorName 
                  ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/20' 
                  : 'border-slate-200 focus:ring-2 focus:ring-teal-700'
              }`}
            />
            {errorName && (
              <div className="flex items-center gap-1 text-rose-600 text-[11px] mt-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorName}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                شماره اتاق / کد کلاسی
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="مثلاً: ۱۰۱"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سال تحصیلی
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="۱۴۰۴-۱۴۰۵"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-mono"
              />
            </div>
          </div>

          {/* مربی تربیتی */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              مربی تربیتی کلاس:
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-medium text-slate-800"
            >
              <option value="">-- بدون مربی اختصاصی / تعیین بعداً --</option>
              {allCoaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.roleTitle})
                </option>
              ))}
            </select>
          </div>

          {/* ساعت پیش‌فرض و زنگ درسی مصوب */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                <Clock className="w-4 h-4 text-teal-800" />
                <span>ساعت پیش‌فرض جلسات کلاسی</span>
              </div>
              <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 font-bold px-2 py-0.5 rounded-full">
                پیش‌فرض خودکار
              </span>
            </div>

            <div>
              <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                انتخاب زنگ درسی مصوب مدرسه:
              </label>
              <select
                value={selectedBellId}
                onChange={(e) => handleBellChange(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-700 outline-none font-bold text-slate-800"
              >
                {bellPeriods.map((bp) => (
                  <option key={bp.id} value={bp.id}>
                    {bp.name} ({toPersianDigits(bp.startTime)} الی {toPersianDigits(bp.endTime)}) {bp.description ? `• ${bp.description}` : ''}
                  </option>
                ))}
                <option value="custom">⏱ ساعت سفارشی برای این کلاس</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  ساعت شروع:
                </label>
                <input
                  type="time"
                  value={defaultStartTime}
                  onChange={(e) => setDefaultStartTime(e.target.value)}
                  disabled={!isCustomTime}
                  className={`w-full text-xs border rounded-lg px-2.5 py-1.5 font-mono ${
                    isCustomTime 
                      ? 'bg-white border-teal-500 text-teal-900 focus:ring-2 focus:ring-teal-700' 
                      : 'bg-slate-100 border-slate-200 text-slate-800 font-bold cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                  ساعت پایان:
                </label>
                <input
                  type="time"
                  value={defaultEndTime}
                  onChange={(e) => setDefaultEndTime(e.target.value)}
                  disabled={!isCustomTime}
                  className={`w-full text-xs border rounded-lg px-2.5 py-1.5 font-mono ${
                    isCustomTime 
                      ? 'bg-white border-teal-500 text-teal-900 focus:ring-2 focus:ring-teal-700' 
                      : 'bg-slate-100 border-slate-200 text-slate-800 font-bold cursor-not-allowed'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* تخصیص دبیران */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                تخصیص دبیران به کلاس:
              </label>
              <span className="text-[11px] text-slate-400">
                {toPersianDigits(selectedTeacherIds.length)} دبیر
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-36 overflow-y-auto">
              {allTeachers.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer p-1.5 rounded hover:bg-white transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedTeacherIds.includes(t.id)}
                    onChange={() => toggleTeacher(t.id)}
                    className="rounded text-teal-800 focus:ring-teal-700"
                  />
                  <span className="truncate">
                    {t.name} <span className="text-[10px] text-slate-400">({t.subject || 'دبیر'})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* آمار خلاصه کلاس */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 flex items-center justify-between">
            <span>تعداد دانش‌آموزان: <b>{toPersianDigits(classStudents.length)}</b> نفر</span>
            <span>جلسات برگزارشده: <b>{toPersianDigits(classSessions.length)}</b> جلسه</span>
          </div>

          {/* خطای حذف کلاس دارای دانش‌آموز */}
          {deleteWarning && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-bold">امکان حذف کلاس وجود ندارد</p>
                <p className="mt-0.5 leading-relaxed">{deleteWarning}</p>
              </div>
            </div>
          )}

          {/* تاییدیه حذف در صورت خالی بودن کلاس */}
          {showDeleteConfirm && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>تایید نهایی حذف کلاس</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                آیا مطمئن هستید که می‌خواهید کلاس خالی «{classData.name}» را از سامانه حذف کنید؟ این عمل غیرقابل بازگشت است.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  بله، کلاس را حذف کن
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          )}

          {/* Footer with Delete and Save */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isSubmitting}
              className="px-3.5 py-2.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>حذف کلاس</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold bg-teal-800 hover:bg-teal-900 text-white rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSubmitting ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
