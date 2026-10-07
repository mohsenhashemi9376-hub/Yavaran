import React, { useState, useMemo, useEffect } from 'react';
import { User, Student, TeachingAssignment } from '../types';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { 
  X, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Phone, 
  HeartHandshake, 
  Users, 
  Check, 
  Copy, 
  ShieldCheck, 
  Edit3, 
  Layers, 
  UserCheck, 
  Compass, 
  Sparkles, 
  Sliders,
  Search,
  ChevronDown,
  ChevronUp,
  User as UserIcon,
  GraduationCap,
  Loader2,
  Plus,
  Trash2,
  BookOpen
} from 'lucide-react';
import { studentFullName } from '../utils/studentName';

interface CoachProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  coach: User | null;
  onEdit: (coach: User) => void;
  onSelectStudent?: (studentId: string) => void;
}

export const CoachProfileModal: React.FC<CoachProfileModalProps> = ({
  isOpen,
  onClose,
  coach,
  onEdit,
  onSelectStudent,
}) => {
  const { classes, students, coachEvaluations, updateCoach, showToast } = useSchool();
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isStudentsExpanded, setIsStudentsExpanded] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');

  // Multi-role state (Coach + Teacher)
  const [isEditingRoles, setIsEditingRoles] = useState(false);
  const [tempIsTeacher, setTempIsTeacher] = useState(false);
  const [tempAssignments, setTempAssignments] = useState<TeachingAssignment[]>([]);
  const [isSavingRoles, setIsSavingRoles] = useState(false);

  useEffect(() => {
    if (coach) {
      setTempIsTeacher(Boolean(coach.isAlsoTeacher));
      if (coach.teachingAssignments && coach.teachingAssignments.length > 0) {
        setTempAssignments(coach.teachingAssignments);
      } else if (coach.teachingSubject || coach.teachingClassIds?.length) {
        setTempAssignments([
          {
            id: 'ta-1',
            subjectName: coach.teachingSubject || coach.subject || 'درس تخصصی',
            classIds: coach.teachingClassIds || [],
          }
        ]);
      } else {
        setTempAssignments([
          {
            id: 'ta-1',
            subjectName: '',
            classIds: [],
          }
        ]);
      }
      setIsEditingRoles(false);
    }
  }, [coach]);

  // Permitted classes for this coach
  const coachClasses = useMemo(() => {
    if (!coach) return [];
    return classes.filter((c) => 
      (coach.assignedClassIds || []).includes(c.id)
    );
  }, [coach, classes]);

  // Distinct grades covered
  const distinctGrades = Array.from(new Set(coachClasses.map((c) => c.grade).filter(Boolean)));

  // Students under coach's care
  const studentsUnderCare = useMemo(() => {
    if (!coach) return [];
    if (coachClasses.length === 0) {
      return students;
    }
    const classIds = new Set(coachClasses.map((c) => c.id));
    return students.filter((s) => classIds.has(s.classId));
  }, [coach, coachClasses, students]);

  // Filtered students for display
  const filteredStudents = useMemo(() => {
    return studentsUnderCare.filter((s) => {
      if (selectedClassFilter !== 'all' && s.classId !== selectedClassFilter) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.trim().toLowerCase();
        const fullName = `${studentFullName(s)}`.toLowerCase();
        const nid = s.nationalId || '';
        return fullName.includes(q) || nid.includes(q);
      }
      return true;
    });
  }, [studentsUnderCare, selectedClassFilter, studentSearch]);

  if (!isOpen || !coach) return null;

  // Growth evaluations registered by this coach
  const evaluationsByCoach = (coachEvaluations || []).filter((e) => e.coachId === coach.id);

  const handleCopyCredentials = () => {
    const textToCopy = `اطلاعات ورود به سامانه یاوران ولایت (معاونت تربیتی):\nنام کاربری: ${coach.username}\nرمز عبور: ${coach.password || '123'}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const hasActiveClasses = coachClasses.length > 0;

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
        <div className="px-6 py-4.5 bg-gradient-to-r from-teal-950 via-teal-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  پنل شخصی {coach.name}
                </h3>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-200 border border-teal-400/30 font-medium">
                  {hasActiveClasses ? 'مربی فعال' : 'در انتظار تخصیص'}
                </span>
              </div>
              <p className="text-xs text-teal-200/80 mt-0.5">
                شناسنامه مربی، دسترسی‌های کلاسی و مسئولیت‌های تربیتی
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-teal-200 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs text-slate-700">
          
          {/* ۱. 👤 اطلاعات شخصی */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-xs sm:text-sm">
              <UserCheck className="w-4 h-4 text-teal-700" />
              <span>اطلاعات شخصی</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs">
                <span className="text-[11px] text-slate-400 block mb-1">نام و نام خانوادگی مربی:</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                  {coach.name}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs">
                <span className="text-[11px] text-slate-400 block mb-1">شماره تماس:</span>
                <div className="flex items-center gap-1.5 font-mono text-slate-800 text-xs sm:text-sm">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{coach.phone || 'ثبت‌نشده'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* نقش‌های فرد در سامانه (مربی + معلم) */}
          <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-700" />
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                  نقش‌های فرد در سامانه
                </h4>
              </div>
              {!isEditingRoles && (
                <button
                  type="button"
                  onClick={() => {
                    setTempIsTeacher(Boolean(coach.isAlsoTeacher));
                    if (coach.teachingAssignments && coach.teachingAssignments.length > 0) {
                      setTempAssignments(coach.teachingAssignments);
                    } else if (coach.teachingSubject || coach.teachingClassIds?.length) {
                      setTempAssignments([
                        {
                          id: 'ta-1',
                          subjectName: coach.teachingSubject || coach.subject || 'درس تخصصی',
                          classIds: coach.teachingClassIds || [],
                        }
                      ]);
                    } else {
                      setTempAssignments([
                        {
                          id: 'ta-1',
                          subjectName: '',
                          classIds: [],
                        }
                      ]);
                    }
                    setIsEditingRoles(true);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{coach.isAlsoTeacher ? 'ویرایش نقش‌ها' : '+ افزودن نقش معلم'}</span>
                </button>
              )}
            </div>

            {!isEditingRoles ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <Check className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="font-bold">مربی پرورشی و تربیتی (طرح یاوران ولایت)</span>
                </div>
                {coach.isAlsoTeacher ? (
                  <div className="p-3 rounded-lg bg-white border border-amber-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-xs text-slate-800">
                        <Check className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-bold">نقش فعال معلم (تدریس درس):</span>
                      </div>
                      <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        دسترسی محدود فقط به کلاس‌ها و دروس اختصاص‌یافته
                      </span>
                    </div>

                    {/* لیست دروس و کلاس‌های تخصیص‌داده‌شده */}
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      {(coach.teachingAssignments && coach.teachingAssignments.length > 0 ? (
                        coach.teachingAssignments.map((assignment, aIdx) => (
                          <div key={assignment.id || aIdx} className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/70 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                                <span>درس: {assignment.subjectName}</span>
                              </span>
                              <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                                {toPersianDigits(assignment.classIds.length)} کلاس
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-1 flex-wrap">
                              <span className="text-slate-400">کلاس‌ها:</span>
                              {assignment.classIds.length > 0 ? (
                                classes
                                  .filter(c => assignment.classIds.includes(c.id))
                                  .map(c => (
                                    <span key={c.id} className="bg-white border border-amber-200 px-1.5 py-0.5 rounded text-slate-800 font-medium text-[10px]">
                                      {c.name}
                                    </span>
                                  ))
                              ) : (
                                <span className="text-rose-600 text-[10px]">کلاسی تخصیص نیافته است</span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-slate-600">
                          <span className="font-bold text-slate-800">
                            تدریس درس {coach.teachingSubject || coach.subject || 'عمومی'} در کلاس‌های:{' '}
                            {classes.filter(c => coach.teachingClassIds?.includes(c.id)).map(c => c.name).join('، ') || 'نامشخص'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 bg-white/70 p-2.5 rounded-lg border border-dashed border-slate-300 flex items-center justify-between">
                    <span>این مربی در حال حاضر نقش معلم ندارد.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTempIsTeacher(true);
                        setIsEditingRoles(true);
                      }}
                      className="text-amber-800 hover:text-amber-900 font-bold hover:underline cursor-pointer"
                    >
                      + افزودن نقش معلم
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white p-3.5 rounded-xl border border-amber-300 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tempIsTeacher}
                      onChange={(e) => setTempIsTeacher(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>فعال‌سازی نقش معلم (تدریس درس) برای این مربی</span>
                  </label>
                </div>

                {tempIsTeacher && (
                  <div className="space-y-4 pt-1">
                    <div className="text-[11px] text-slate-500 bg-amber-50/60 p-2 rounded-lg border border-amber-200/60 leading-relaxed">
                      شما می‌توانید یک یا چند درس برای این مربی تعریف کنید و برای هر درس، کلاس‌های تحت تدریس را مشخص نمایید.
                    </div>

                    {tempAssignments.map((assignment, aIdx) => (
                      <div key={assignment.id || aIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 relative">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                            <span>درس شماره {toPersianDigits(aIdx + 1)}</span>
                          </span>
                          {tempAssignments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setTempAssignments(prev => prev.filter((_, idx) => idx !== aIdx));
                              }}
                              className="text-rose-600 hover:text-rose-700 p-1 text-xs hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="حذف این درس"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            عنوان درس تدریسی *
                          </label>
                          <input
                            type="text"
                            value={assignment.subjectName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempAssignments(prev =>
                                prev.map((item, idx) => idx === aIdx ? { ...item, subjectName: val } : item)
                              );
                            }}
                            placeholder="مثلاً: ریاضی، دین و زندگی، فیزیک، قرآن، علوم تجربی..."
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 transition"
                          />
                          {/* Quick subject suggestions */}
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {['ریاضی', 'علوم تجربی', 'فیزیک', 'قرآن', 'پیام‌های آسمان', 'عربی', 'ادبیات فارسی', 'زبان انگلیسی'].map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  setTempAssignments(prev =>
                                    prev.map((item, idx) => idx === aIdx ? { ...item, subjectName: s } : item)
                                  );
                                }}
                                className="text-[10px] px-1.5 py-0.5 bg-white hover:bg-amber-100 text-slate-600 hover:text-amber-900 rounded border border-slate-200 transition cursor-pointer"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            کلاس‌های این درس *
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                            {classes.map((c) => {
                              const isChecked = assignment.classIds.includes(c.id);
                              return (
                                <label
                                  key={c.id}
                                  className={`p-1.5 rounded border text-[11px] flex items-center gap-1.5 cursor-pointer transition ${
                                    isChecked
                                      ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setTempAssignments(prev =>
                                        prev.map((item, idx) => {
                                          if (idx !== aIdx) return item;
                                          const newClassIds = item.classIds.includes(c.id)
                                            ? item.classIds.filter(id => id !== c.id)
                                            : [...item.classIds, c.id];
                                          return { ...item, classIds: newClassIds };
                                        })
                                      );
                                    }}
                                    className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                                  />
                                  <span className="truncate">{c.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setTempAssignments(prev => [
                          ...prev,
                          {
                            id: `ta-${Date.now()}-${prev.length + 1}`,
                            subjectName: '',
                            classIds: [],
                          }
                        ]);
                      }}
                      className="w-full py-2 border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 text-amber-900 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن درس دیگر برای این مربی</span>
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditingRoles(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={isSavingRoles}
                    onClick={async () => {
                      try {
                        setIsSavingRoles(true);
                        const validAssignments = tempAssignments
                          .filter(a => a.subjectName.trim() !== '' && a.classIds.length > 0)
                          .map(a => ({ ...a, subjectName: a.subjectName.trim() }));
                        
                        const allClassIds = Array.from(new Set(validAssignments.flatMap(a => a.classIds)));
                        const primarySubject = validAssignments[0]?.subjectName || undefined;

                        updateCoach(coach.id, {
                          isAlsoTeacher: tempIsTeacher && validAssignments.length > 0,
                          teachingAssignments: tempIsTeacher ? validAssignments : [],
                          teachingSubject: tempIsTeacher ? primarySubject : undefined,
                          subject: tempIsTeacher ? primarySubject : coach.subject,
                          teachingClassIds: tempIsTeacher ? allClassIds : [],
                        });
                        setIsEditingRoles(false);
                        showToast('نقش‌های مربی با موفقیت به‌روزرسانی شد.', 'success');
                      } finally {
                        setIsSavingRoles(false);
                      }
                    }}
                    className="px-4 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {isSavingRoles ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>ذخیره نقش‌ها</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ۲. 🌱 اطلاعات تربیتی */}
          <div className="bg-teal-50/40 border border-teal-200/80 rounded-xl p-4 space-y-4">
            <h4 className="font-bold text-teal-950 flex items-center gap-2 text-xs sm:text-sm">
              <Compass className="w-4 h-4 text-teal-700" />
              <span>اطلاعات تربیتی و مسئولیت‌ها</span>
            </h4>

            {/* حوزه فعالیت و پایه‌های تحت پوشش */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-3.5 rounded-lg border border-teal-200/70 shadow-2xs">
                <span className="text-[11px] text-slate-400 block mb-1">حوزه فعالیت:</span>
                <span className="font-bold text-teal-900 text-xs sm:text-sm">
                  {coach.roleTitle || 'معاونت تربیتی و پرورشی (طرح یاوران ولایت)'}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-teal-200/70 shadow-2xs">
                <span className="text-[11px] text-slate-400 block mb-1">پایه‌های تحت پوشش:</span>
                <span className="font-bold text-teal-900 text-xs sm:text-sm">
                  {distinctGrades.length > 0 
                    ? distinctGrades.map(g => `پایه ${g}`).join(' و ')
                    : 'دسترسی عمومی / همه پایه‌ها'}
                </span>
              </div>
            </div>

            {/* کلاس‌های منتسب */}
            <div className="bg-white p-3.5 rounded-lg border border-teal-200/70 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 block">کلاس‌های منتسب:</span>
                <span className="text-[11px] font-bold text-teal-800 font-mono">
                  {toPersianDigits(coachClasses.length)} کلاس تحت پوشش
                </span>
              </div>

              {coachClasses.length === 0 ? (
                <div className="p-3 bg-teal-50/50 border border-dashed border-teal-200 rounded-lg text-center text-teal-700 text-xs">
                  دسترسی عمومی به تمام کلاس‌های مدرسه (هیچ کلاس اختصاصی فیلتر نشده است)
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {coachClasses.map((cls) => {
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
                        <div className="text-left font-mono font-bold text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {toPersianDigits(classStudentCount)} دانش‌آموز
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* جزئیات مسئولیت تربیتی */}
            <div className="bg-white p-3.5 rounded-lg border border-teal-200/70 shadow-2xs">
              <span className="text-[11px] text-slate-400 block mb-2">جزئیات مسئولیت تربیتی:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-teal-50/60 border border-teal-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-700 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-500">دانش‌آموزان تحت نظر</div>
                    <div className="font-bold text-teal-950 font-mono text-xs mt-0.5">
                      {toPersianDigits(studentsUnderCare.length)} نفر
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-500">ارزیابی‌های ثبت‌شده</div>
                    <div className="font-bold text-emerald-950 font-mono text-xs mt-0.5">
                      {toPersianDigits(evaluationsByCoach.length)} ارزیابی
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-500">سطح دسترسی تربیتی</div>
                    <div className="font-bold text-indigo-950 text-xs mt-0.5">
                      مشاهده و ثبت محرمانه
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ۳. 👥 دانش‌آموزان تحت مسئولیت مربی (اتصال مستقیم به دانش‌آموز) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div 
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsStudentsExpanded(!isStudentsExpanded)}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-700" />
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                  دانش‌آموزان تحت مسئولیت مربی
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                  {toPersianDigits(studentsUnderCare.length)} دانش‌آموز
                </span>
              </div>
              <button
                type="button"
                className="text-xs text-teal-800 hover:text-teal-900 flex items-center gap-1 font-bold cursor-pointer"
              >
                <span>{isStudentsExpanded ? 'بستن لیست' : 'مشاهده لیست دانش‌آموزان'}</span>
                {isStudentsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {isStudentsExpanded && (
              <div className="pt-2 space-y-3 border-t border-slate-200">
                {/* Search & Class Filter */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="جستجوی نام یا کد ملی دانش‌آموز..."
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg pr-8 pl-3 py-1.5 outline-hidden focus:ring-2 focus:ring-teal-700"
                    />
                  </div>
                  {coachClasses.length > 1 && (
                    <select
                      value={selectedClassFilter}
                      onChange={(e) => setSelectedClassFilter(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-hidden focus:ring-2 focus:ring-teal-700 cursor-pointer"
                    >
                      <option value="all">همه کلاس‌های مربی ({toPersianDigits(studentsUnderCare.length)})</option>
                      {coachClasses.map((c) => {
                        const count = studentsUnderCare.filter((s) => s.classId === c.id).length;
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name} ({toPersianDigits(count)} نفر)
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {/* Students List */}
                {filteredStudents.length === 0 ? (
                  <div className="p-4 bg-white border border-dashed border-slate-200 rounded-lg text-center text-slate-400 text-xs">
                    دانش‌آموزی با این مشخصات یافت نشد.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-0.5">
                    {filteredStudents.map((stu) => {
                      const stuClass = classes.find((c) => c.id === stu.classId);
                      return (
                        <div
                          key={stu.id}
                          onClick={() => {
                            if (onSelectStudent) {
                              onClose();
                              onSelectStudent(stu.id);
                            }
                          }}
                          className={`p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2 transition ${
                            onSelectStudent ? 'hover:border-teal-400 hover:bg-teal-50/30 cursor-pointer' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-[10px]">
                              {stu.firstName?.[0]}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs">
                                {studentFullName(stu)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {stuClass?.name || 'کلاس نامشخص'}
                              </div>
                            </div>
                          </div>
                          {onSelectStudent && (
                            <span className="text-[10px] text-teal-700 font-bold">
                              پروفایل ←
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ۴. 🔐 اطلاعات ورود */}
          <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>اطلاعات ورود به سامانه</span>
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
                <div className="font-mono font-bold text-teal-950 text-xs sm:text-sm" dir="ltr">
                  {coach.username}
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-amber-200/70 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">رمز شخصی:</span>
                  <div className="font-mono font-bold text-slate-900 text-xs sm:text-sm tracking-wider" dir="ltr">
                    {showPassword ? (coach.password || '123') : '••••••'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="px-2.5 py-1 text-slate-500 hover:text-teal-700 bg-slate-100 hover:bg-teal-50 border border-slate-200 rounded-lg text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>مخفی‌سازی رمز</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-teal-600" />
                      <span>نمایش رمز</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ۴. ⚙️ مدیریت */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-xs sm:text-sm">
              <Sliders className="w-4 h-4 text-teal-700" />
              <span>مدیریت و تنظیمات</span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* ویرایش اطلاعات */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(coach);
                }}
                className="px-3 py-2.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-800 hover:text-teal-800 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 shadow-2xs cursor-pointer text-center"
              >
                <Edit3 className="w-4 h-4 text-teal-600" />
                <span>ویرایش اطلاعات</span>
              </button>

              {/* تغییر رمز */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(coach);
                }}
                className="px-3 py-2.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-800 hover:text-amber-800 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 shadow-2xs cursor-pointer text-center"
              >
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>تغییر رمز</span>
              </button>

              {/* مدیریت کلاس‌ها */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(coach);
                }}
                className="px-3 py-2.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 hover:text-emerald-800 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 shadow-2xs cursor-pointer text-center"
              >
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>مدیریت کلاس‌ها</span>
              </button>

              {/* تغییر دسترسی‌ها */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(coach);
                }}
                className="px-3 py-2.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-800 hover:text-indigo-800 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-1.5 shadow-2xs cursor-pointer text-center"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>تغییر دسترسی‌ها</span>
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
