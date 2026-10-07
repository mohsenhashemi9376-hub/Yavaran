import React, { useState } from 'react';
import { User } from '../types';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { 
  X, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Phone, 
  BookOpen, 
  Users, 
  Calendar, 
  Check, 
  Copy, 
  GraduationCap, 
  ShieldCheck, 
  Edit3, 
  Layers,
  UserCheck
} from 'lucide-react';

interface TeacherProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: User | null;
  onEdit: (teacher: User) => void;
}

export const TeacherProfileModal: React.FC<TeacherProfileModalProps> = ({
  isOpen,
  onClose,
  teacher,
  onEdit,
}) => {
  const { classes, sessions, students, academicSubjects } = useSchool();
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !teacher) return null;

  // Permitted classes for this teacher
  const teacherClasses = classes.filter((c) => 
    teacher.assignedClassIds?.includes(c.id) || c.teacherIds?.includes(teacher.id)
  );

  // Sessions conducted by this teacher
  const teacherSessions = sessions.filter((s) => s.teacherId === teacher.id);
  const recentSessions = [...teacherSessions].reverse().slice(0, 6);

  // Academic subjects taught by or matching this teacher
  const matchingSubjects = academicSubjects.filter((sub) => 
    sub.teacherId === teacher.id || 
    sub.defaultTeacherName === teacher.name ||
    (teacher.subject && (sub.name.includes(teacher.subject) || teacher.subject.includes(sub.name)))
  );

  const handleCopyCredentials = () => {
    const textToCopy = `اطلاعات ورود به سامانه یاوران ولایت:\nنام کاربری: ${teacher.username}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const displayName = teacher.name.startsWith('استاد') ? teacher.name : `استاد ${teacher.name}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      dir="rtl"
    >
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-200 shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  پنل شخصی {displayName}
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-medium">
                  {teacherClasses.length > 0 ? 'استاد فعال' : 'در انتظار تخصیص'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                شناسنامه دبیر، دسترسی‌های کلاسی و اطلاعات تدریس
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs text-slate-700">
          
          {/* ۱. بخش اطلاعات شخصی */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-xs sm:text-sm">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>بخش اطلاعات شخصی</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs">
                <span className="text-[11px] text-slate-400 block mb-1">نام و نام خانوادگی:</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                  {teacher.name}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs">
                <span className="text-[11px] text-slate-400 block mb-1">شماره تماس:</span>
                <div className="flex items-center gap-1.5 font-mono text-slate-800 text-xs sm:text-sm">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{teacher.phone || 'ثبت‌نشده'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ۲. بخش اطلاعات ورود */}
          <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>بخش اطلاعات ورود</span>
              </h4>
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100/80 hover:bg-amber-200/90 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">کپی شد!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>کپی اطلاعات ورود</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-3.5 rounded-lg border border-amber-200/70 shadow-2xs">
                <span className="text-[11px] text-slate-400 block mb-1">نام کاربری:</span>
                <div className="font-mono font-bold text-indigo-950 text-xs sm:text-sm" dir="ltr">
                  {teacher.username}
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-amber-200/70 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">رمز شخصی:</span>
                  <div className="font-mono font-bold text-slate-900 text-xs sm:text-sm tracking-wider" dir="ltr">
                    ••••••
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 max-w-[11rem] leading-5">رمز فقط به‌صورت هش یک‌طرفه ذخیره می‌شود و قابل نمایش نیست؛ برای تغییر از «ویرایش» استفاده کنید.</span>
              </div>
            </div>
          </div>

          {/* ۳. بخش اطلاعات آموزشی */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs sm:text-sm">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>بخش اطلاعات آموزشی</span>
            </h4>

            {/* ماده‌های درسی مربوط به استاد */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs space-y-2">
              <span className="text-[11px] text-slate-400 block">ماده‌های درسی مربوط به استاد:</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-md font-bold text-xs">
                  {teacher.subject ? `درس اصلی: ${teacher.subject}` : 'عمومی'}
                </span>

                {matchingSubjects.map((sub) => (
                  <span 
                    key={sub.id}
                    className="px-2 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[11px] font-medium"
                  >
                    {sub.name} ({toPersianDigits(sub.hoursPerWeek || 2)} ساعت هفتگی)
                  </span>
                ))}
              </div>
            </div>

            {/* کلاس‌های مجاز */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 block">کلاس‌های مجاز:</span>
                <span className="text-[11px] font-bold text-indigo-700 font-mono">
                  {toPersianDigits(teacherClasses.length)} کلاس مجاز
                </span>
              </div>

              {teacherClasses.length === 0 ? (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-xs">
                  در حال حاضر هیچ کلاسی برای این استاد تعیین نشده است.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {teacherClasses.map((cls) => {
                    const classStudentCount = students.filter((s) => s.classId === cls.id).length;
                    return (
                      <div 
                        key={cls.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{cls.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            پایه {cls.grade} • رشته {cls.major}
                          </div>
                        </div>
                        <div className="text-left font-mono font-bold text-[11px] text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {toPersianDigits(classStudentCount)} دانش‌آموز
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* تعداد جلسات */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block mb-0.5">تعداد جلسات تدریس برگزارشده:</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                  مجموع جلسات ثبت‌شده در سامانه
                </span>
              </div>
              <div className="text-left font-mono font-bold text-sm text-indigo-900 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200">
                {toPersianDigits(teacherSessions.length)} جلسه
              </div>
            </div>

            {/* برنامه تدریس */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs space-y-2.5">
              <span className="text-[11px] text-slate-400 block">برنامه تدریس و آخرین جلسات ثبت‌شده:</span>

              {recentSessions.length === 0 ? (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-xs">
                  هنوز جلسه تدریسی ثبت نشده است.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentSessions.map((session) => {
                    const targetClass = classes.find((c) => c.id === session.classId);
                    return (
                      <div 
                        key={session.id}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg flex items-center justify-between gap-2 transition"
                      >
                        <div>
                          <div className="font-bold text-slate-800">
                            {session.lessonTopic || session.subject || 'تدریس کلاسی'}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            کلاس: {targetClass?.name || session.classId} {session.bellPeriodName ? `• ${session.bellPeriodName}` : ''}
                          </div>
                        </div>
                        <div className="text-left font-mono text-[11px] text-slate-600 shrink-0">
                          {session.date}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* ۴. بخش عملیات */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-xs sm:text-sm">
              <Edit3 className="w-4 h-4 text-indigo-600" />
              <span>بخش عملیات</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* ویرایش اطلاعات */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(teacher);
                }}
                className="px-3 py-2.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 hover:text-indigo-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>ویرایش اطلاعات</span>
              </button>

              {/* تغییر رمز */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(teacher);
                }}
                className="px-3 py-2.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-800 hover:text-amber-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>تغییر رمز</span>
              </button>

              {/* مدیریت کلاس‌ها */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(teacher);
                }}
                className="px-3 py-2.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 hover:text-emerald-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>مدیریت کلاس‌ها</span>
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
