import React, { useState } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';
import { X, GraduationCap, PlusCircle, Clock, Sparkles, User, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

interface AddClassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddClassModal: React.FC<AddClassModalProps> = ({ isOpen, onClose }) => {
  const { addClass, classes, allTeachers, allCoaches, bellPeriods } = useSchool();

  const [grade, setGrade] = useState('پایه هفتم');
  const [name, setName] = useState('');
  const [major, setMajor] = useState('متوسطه اول');
  const [roomNumber, setRoomNumber] = useState('');
  const [academicYear, setAcademicYear] = useState(getActiveAcademicYear());
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Inline validation errors
  const [errorName, setErrorName] = useState<string | null>(null);

  // Default Bell Period / Time
  const defaultBell = bellPeriods[0];
  const [selectedBellId, setSelectedBellId] = useState<string>(defaultBell ? defaultBell.id : 'bell-1');
  const [defaultStartTime, setDefaultStartTime] = useState<string>(defaultBell ? defaultBell.startTime : '07:45');
  const [defaultEndTime, setDefaultEndTime] = useState<string>(defaultBell ? defaultBell.endTime : '09:15');
  const [isCustomTime, setIsCustomTime] = useState(false);

  if (!isOpen) return null;

  const handleBellChange = (bellId: string) => {
    setSelectedBellId(bellId);
    if (bellId === 'custom') {
      setIsCustomTime(true);
    } else {
      setIsCustomTime(false);
      const target = bellPeriods.find(b => b.id === bellId);
      if (target) {
        setDefaultStartTime(target.startTime);
        setDefaultEndTime(target.endTime);
      }
    }
  };

  const handleGradeChange = (newGrade: string) => {
    setGrade(newGrade);
    setErrorName(null);
    if (newGrade === 'پایه هفتم' || newGrade === 'پایه هشتم' || newGrade === 'پایه نهم') {
      setMajor('متوسطه اول');
    } else if (major === 'متوسطه اول') {
      setMajor('علوم تجربی');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const cleanName = name.trim();

    if (!cleanName) {
      setErrorName('لطفاً نام کلاس را وارد کنید.');
      return;
    }

    // Check duplicate name in the same grade (مرحله ۸: پیشگیری از تکرار نام در یک پایه)
    const isDuplicate = classes.some(
      (c) => c.grade === grade && c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (isDuplicate) {
      setErrorName(`کلاسی با نام «${cleanName}» در ${grade} قبلاً ثبت شده است.`);
      return;
    }

    setIsSubmitting(true);
    try {
      addClass({
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

      handleClose();
    } catch {
      setErrorName('خطا در ایجاد کلاس. لطفاً مجدداً تلاش کنید.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setErrorName(null);
    setRoomNumber('');
    setSelectedTeacherIds([]);
    setSelectedCoachId('');
    onClose();
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
              <h2 className="text-base font-bold">افزودن کلاس جدید</h2>
              <p className="text-xs text-slate-400">تعریف کلاس به عنوان موجودیت هماهنگ با دانش‌آموزان و دبیران</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          
          {/* مقطع و پایه تحصیلی (اولین انتخاب طبق استاندارد) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                پایه تحصیلی <span className="text-red-500">*</span>
              </label>
              <select
                value={grade}
                onChange={(e) => handleGradeChange(e.target.value)}
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
                رشته / گرایش
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

          {/* نام کلاس همراه با اعتبارسنجی درون‌خطی */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              نام کلاس <span className="text-red-500">*</span>
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
                شماره اتاق / کد کلاسی (اختیاری)
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="مثلاً: ۱۰۲"
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
                placeholder={getActiveAcademicYear()}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-teal-700 outline-none font-mono"
              />
            </div>
          </div>

          {/* انتصاب مربی تربیتی (یاوران ولایت) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              مربی تربیتی کلاس:
            </label>
            <div className="relative">
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
          </div>

          {/* ساعات پیش‌فرض و زنگ درسی مصوب */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                <Clock className="w-4 h-4 text-teal-800" />
                <span>ساعت پیش‌فرض جلسات کلاسی</span>
              </div>
              <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 font-bold px-2 py-0.5 rounded-full">
                ثبت خودکار در حضور و غیاب
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

          {/* تخصیص اساتید و دبیران */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                تخصیص دبیران به کلاس:
              </label>
              <span className="text-[11px] text-slate-400">
                {toPersianDigits(selectedTeacherIds.length)} دبیر انتخاب شده
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 text-xs font-bold bg-teal-800 hover:bg-teal-900 text-white rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PlusCircle className="w-4 h-4" />
              )}
              <span>{isSubmitting ? 'در حال ایجاد...' : 'ایجاد کلاس'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
