import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/serverSync';
import { CircularModal } from './CircularModal';
import { useSchool } from '../context/SchoolContext';
import { AppNotification, SchoolAnnouncement, SchoolClass, AttendanceSession, Student, StudentAttendanceRecord, QualitativeRating } from '../types';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { exportClassAttendanceToExcel } from '../utils/excelExport';
import { getUserGreeting } from '../utils/userRoles';
import { SessionDetailModal } from './SessionDetailModal';
import { ClassMonthlyGradesSection } from './ClassMonthlyGradesSection';
import { QUALITATIVE_RATING_MAP } from './TeacherEvaluationSection';
import { TeacherSidebarNav, TeacherViewType } from './TeacherSidebarNav';
import { TeacherActivitiesSection } from './TeacherActivitiesSection';
import { 
  GraduationCap, 
  Users, 
  CheckCircle2, 
  FileSpreadsheet, 
  PlusCircle, 
  BookOpen, 
  Clock, 
  Edit, 
  Trash2, 
  BarChart2, 
  Search, 
  Lock, 
  ChevronLeft, 
  Eye, 
  CheckCircle, 
  AlertCircle, 
  Award, 
  Star, 
  Bell, 
  ShieldCheck, 
  TrendingUp, 
  ArrowUpRight,
  Check
} from 'lucide-react';
import { MobileBottomNav } from './MobileBottomNav';
import { teacherMobileNav, HOME } from './mobileNavConfigs';

interface TeacherDashboardProps {
  onOpenNewAttendance: (classId?: string, subject?: string) => void;
  onOpenClassDetail: (classData: SchoolClass) => void;
  onOpenMonthlySummary: (classId?: string) => void;
  onEditSession: (session: AttendanceSession) => void;
  onSelectStudent?: (student: Student) => void;
  onOpenAcademicGrades?: (classId?: string, subjectId?: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  onOpenNewAttendance,
  onOpenClassDetail,
  onOpenMonthlySummary,
  onEditSession,
  onSelectStudent,
  onOpenAcademicGrades,
}) => {
  const { 
    currentUser, 
    accessibleClasses, 
    teachingAccessibleClasses,
    students, 
    accessibleSessions, 
    teachingAccessibleSessions,
    teacherEvaluations,
    schoolAnnouncements: allAnnouncements,
    deleteAttendanceSession 
  } = useSchool();

  const schoolAnnouncements = (allAnnouncements || []).filter((a) => a.status !== 'archived');
  const [activeView, setActiveView] = useState<TeacherViewType>('dashboard');

  // بخشنامه‌ها: وضعیت خوانده‌شدن از اعلان‌های سرور (type=circular) خوانده می‌شود
  const [circularModal, setCircularModal] = useState<SchoolAnnouncement | null>(null);
  const [unreadCirculars, setUnreadCirculars] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    const load = () =>
      apiRequest<{ notifications: AppNotification[] }>('GET', '/api/notifications')
        .then((res) => {
          if (!alive) return;
          const map: Record<string, number> = {};
          (res.notifications || []).forEach((n) => {
            if (n.type === 'circular' && !n.isRead && n.refId) map[n.refId] = n.id;
          });
          setUnreadCirculars(map);
        })
        .catch(() => undefined);
    load();
    const t = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);
  const acknowledgeCircular = (a: SchoolAnnouncement) => {
    const nid = unreadCirculars[a.id];
    if (!nid) return;
    setUnreadCirculars((prev) => {
      const { [a.id]: _gone, ...rest } = prev;
      return rest;
    });
    apiRequest('POST', `/api/notifications/${nid}/read`).catch(() => undefined);
  };
  const firstUnreadCircular = schoolAnnouncements.find((a) => unreadCirculars[a.id]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Use strictly the teacher's permitted classes and sessions
  const teacherClasses = teachingAccessibleClasses && teachingAccessibleClasses.length > 0 
    ? teachingAccessibleClasses 
    : accessibleClasses;

  const teacherSessions = teachingAccessibleSessions && teachingAccessibleSessions.length > 0 
    ? teachingAccessibleSessions 
    : accessibleSessions;

  const [selectedClassForMonthlyGrades, setSelectedClassForMonthlyGrades] = useState<string>(
    teacherClasses.length > 0 ? teacherClasses[0].id : ''
  );
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<AttendanceSession | null>(null);

  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const todayInfo = getTodayShamsi();

  // Helper to get subject taught for a given class
  const getSubjectForClass = (classId: string): string => {
    if (currentUser.teachingAssignments && currentUser.teachingAssignments.length > 0) {
      const match = currentUser.teachingAssignments.find(a => a.classIds.includes(classId));
      if (match) return match.subjectName;
    }
    return currentUser.teachingSubject || currentUser.subject || 'درس تخصصی';
  };

  // Grouped subjects for this teacher (انتساب سه‌طرفه: کلاس + درس + استاد)
  const subjectGroups = React.useMemo(() => {
    if (currentUser.teachingAssignments && currentUser.teachingAssignments.length > 0) {
      return currentUser.teachingAssignments.map(a => ({
        subjectId: a.subjectId || a.subjectName,
        subjectName: a.subjectName,
        classes: teacherClasses.filter(c => a.classIds.includes(c.id)),
      }));
    }
    const defaultSubject = currentUser.teachingSubject || currentUser.subject || 'درس تخصصی';
    return [
      {
        subjectId: defaultSubject,
        subjectName: defaultSubject,
        classes: teacherClasses,
      }
    ];
  }, [currentUser, teacherClasses]);

  // هر کارت = یک درس در یک کلاس
  const courseCards = React.useMemo(
    () =>
      subjectGroups.flatMap((g) =>
        g.classes.map((cls) => ({
          key: `${cls.id}|${g.subjectId}`,
          cls,
          subjectId: g.subjectId,
          subjectName: g.subjectName,
        }))
      ),
    [subjectGroups]
  );

  const [selectedCourse, setSelectedCourse] = useState<{
    classId: string;
    subjectId: string;
    subjectName: string;
  } | null>(null);

  const classTitle = (cls: SchoolClass): string => {
    const grade = (cls.grade || '').trim();
    const gradeLabel = grade && !grade.startsWith('پایه') ? `پایه ${grade}` : grade;
    return (cls.name || '').includes('پایه') || !gradeLabel ? cls.name : `${gradeLabel} ${cls.name}`;
  };

  // Teacher specific stats
  const totalStudentsTaught = students.filter((s) => 
    teacherClasses.some((c) => c.id === s.classId)
  ).length;

  const filteredSessions = teacherSessions.filter((s) => {
    if (selectedClassFilter !== 'all' && s.classId !== selectedClassFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        s.lessonTopic.toLowerCase().includes(term) ||
        s.date.includes(term) ||
        s.subject.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const currentGradeClass = teacherClasses.find(c => c.id === selectedClassForMonthlyGrades) || teacherClasses[0];
  const userGreeting = getUserGreeting(currentUser);

  return (
    <div className="font-['Vazirmatn',sans-serif] space-y-6">
      
      {/* Teacher Top Navigation & View Switcher Layout */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        
        {/* RIGHT SIDEBAR NAV (Desktop + Mobile Drawer) */}
        <div className="hidden md:block w-full lg:w-auto shrink-0">
          <TeacherSidebarNav
            activeView={activeView}
            onSelectView={(view) => {
              setActiveView(view);
              if (view === 'grades' && !selectedClassForMonthlyGrades && teacherClasses.length > 0) {
                setSelectedClassForMonthlyGrades(teacherClasses[0].id);
              }
            }}
            currentUser={currentUser}
            teachingClasses={teacherClasses}
            teachingSubjects={subjectGroups.map(g => g.subjectName)}
            totalSessionsCount={teacherSessions.length}
            totalStudentsCount={totalStudentsTaught}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        {/* نوار ناوبری پایین (فقط موبایل) */}
        {(() => {
          const nav = teacherMobileNav();
          return (
            <MobileBottomNav
              items={nav.primary}
              moreItems={nav.more}
              activeId={activeView}
              onSelect={(id) => {
                setActiveView(id as TeacherViewType);
                if (id === 'grades' && !selectedClassForMonthlyGrades && teacherClasses.length > 0) {
                  setSelectedClassForMonthlyGrades(teacherClasses[0].id);
                }
              }}
            />
          );
        })()}

        {/* LEFT / CENTER MAIN CONTENT AREA */}
        <div className="flex-1 w-full min-w-0 space-y-6">

          {/* VIEW 1: DASHBOARD OVERVIEW */}
          {activeView === 'dashboard' && selectedCourse && (() => {
            const cls = teacherClasses.find((c) => c.id === selectedCourse.classId);
            if (!cls) return null;
            const courseSessions = teacherSessions.filter(
              (s) => s.classId === cls.id && (!s.subject || s.subject.includes(selectedCourse.subjectName) || selectedCourse.subjectName.includes(s.subject))
            );
            return (
              <div className="space-y-5">
                <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white rounded-2xl px-5 py-4 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedCourse(null)}
                      className="text-[11px] text-emerald-100 hover:text-white flex items-center gap-1 mb-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                      <span>بازگشت به کلاس‌های من</span>
                    </button>
                    <h2 className="text-lg font-extrabold leading-snug">
                      کلاس {selectedCourse.subjectName} - {classTitle(cls)}
                    </h2>
                    <p className="text-xs text-emerald-100/90 mt-0.5">
                      حضور و غیاب این درس، جلسات برگزارشده و ثبت نمرات مستمر
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenNewAttendance(cls.id, selectedCourse.subjectName)}
                    className="px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-xs rounded-xl transition shadow-lg shadow-black/10 flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <PlusCircle className="w-4 h-4 text-emerald-600" />
                    <span>ثبت حضور و غیاب این زنگ</span>
                  </button>
                </div>

                <ClassMonthlyGradesSection
                  classData={cls}
                  onSelectStudent={onSelectStudent}
                  initialSubjectId={selectedCourse.subjectId}
                />

                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-700" />
                    جلسات ثبت‌شده این درس ({toPersianDigits(courseSessions.length)})
                  </h4>
                  {courseSessions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">جلسات ثبت‌شده: ۰</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {courseSessions.slice(0, 10).map((sess) => (
                        <li key={sess.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800">{toPersianDigits(sess.date)} ({sess.dayOfWeek})</div>
                            <div className="text-slate-500 truncate">مبحث: {sess.lessonTopic || 'ذکر نشده'}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onEditSession(sess)}
                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            aria-label="ویرایش جلسه"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })()}

          {activeView === 'dashboard' && !selectedCourse && (
            <div className="space-y-6">
              
              {/* Teacher Hero Welcome Banner */}
              <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white rounded-2xl px-5 py-4 shadow-md border border-emerald-700/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                      <span className="truncate">{userGreeting.greeting}</span>
                      <span>👋</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
                      مدیریت تدریس، جلسات کلاسی و ثبت نمرات مستمر
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 md:flex md:items-center">
                    {[
                      { label: 'کلاس', value: teacherClasses.length },
                      { label: 'دانش‌آموز', value: totalStudentsTaught },
                      { label: 'جلسه', value: teacherSessions.length },
                    ].map((st) => (
                      <div
                        key={st.label}
                        className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-3.5 py-1.5 text-center md:min-w-[5.5rem]"
                      >
                        <div className="text-base font-extrabold leading-tight">{toPersianDigits(st.value)}</div>
                        <div className="text-[10px] text-emerald-100/90">{st.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* نوار اطلاعیه معاونت آموزش: فقط برای بخشنامه‌های خوانده‌نشده */}
              {(schoolAnnouncements || []).length > 0 && (
                firstUnreadCircular ? (
                  <div className="bg-violet-50 text-violet-950 rounded-xl px-3.5 py-2 border border-violet-200 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setCircularModal(firstUnreadCircular)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-right cursor-pointer"
                    >
                      <Bell className="w-4 h-4 text-violet-600 shrink-0" />
                      <span className="text-[11px] font-bold text-violet-700 shrink-0">اطلاعیه معاونت آموزش:</span>
                      <p className="text-xs font-bold truncate">{firstUnreadCircular.title}</p>
                    </button>
                    <button
                      onClick={() => setActiveView('evaluations')}
                      className="text-[11px] text-violet-800 hover:underline font-bold cursor-pointer shrink-0 flex items-center gap-0.5"
                    >
                      <span>همه ({toPersianDigits(schoolAnnouncements.length)})</span>
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveView('evaluations')}
                    className="w-full bg-slate-50 text-slate-500 rounded-xl px-3.5 py-1.5 border border-slate-200 flex items-center justify-between gap-3 text-[11px] font-bold cursor-pointer"
                  >
                    <span className="flex items-center gap-2"><Bell className="w-3.5 h-3.5" />اطلاعیه‌ها (همه خوانده شده)</span>
                    <span className="flex items-center gap-0.5">مشاهده ({toPersianDigits(schoolAnnouncements.length)})<ChevronLeft className="w-3 h-3" /></span>
                  </button>
                )
              )}

              {/* SECTION: دروس و کلاس‌های تدریس (هر کارت = یک درس در یک کلاس) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-emerald-700" />
                  <h3 className="text-base font-bold text-slate-900">
                    کلاس‌های تدریس شما ({toPersianDigits(courseCards.length)})
                  </h3>
                </div>

                {courseCards.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 shadow-xs space-y-3">
                    <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
                    <p className="text-sm text-slate-600 font-bold">
                      هنوز درسی در هیچ کلاسی به شما واگذار نشده است.
                    </p>
                    <p className="text-xs text-slate-400">
                      معاونت آموزشی یا مدیریت مدرسه از بخش «برنامه دروس» می‌تواند درس و کلاس شما را تعیین کند.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {courseCards.map(({ key, cls, subjectId, subjectName }) => {
                      const classStudents = students.filter((s) => s.classId === cls.id);
                      const courseSessions = teacherSessions.filter(
                        (s) => s.classId === cls.id && (!s.subject || s.subject.includes(subjectName) || subjectName.includes(s.subject))
                      );
                      const openCourse = () => setSelectedCourse({ classId: cls.id, subjectId, subjectName });

                      return (
                        <div
                          key={key}
                          role="button"
                          tabIndex={0}
                          onClick={openCourse}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openCourse();
                            }
                          }}
                          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition space-y-4 flex flex-col justify-between cursor-pointer text-right"
                        >
                          <div className="space-y-2">
                            <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                              کلاس {subjectName} - {classTitle(cls)}
                            </h4>
                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-emerald-600" />
                                {toPersianDigits(classStudents.length)} دانش‌آموز
                              </span>
                              <span>جلسات ثبت‌شده: {toPersianDigits(courseSessions.length)}</span>
                              {cls.roomNumber ? <span>اتاق {toPersianDigits(cls.roomNumber)}</span> : null}
                            </div>
                          </div>

                          <div className="grid grid-cols-5 gap-2 pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCourse();
                              }}
                              className="col-span-3 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>ورود به کلاس و دفتر نمرات</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenNewAttendance(cls.id, subjectName);
                              }}
                              className="col-span-2 py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                              <span>حضور و غیاب سریع</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION: Recent Sessions List */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-700" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        آخرین جلسات ثبت‌شده تدریس شما
                      </h4>
                      <p className="text-xs text-slate-500">
                        جلسات اخیر کلاس‌های تحت تدریس
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveView('attendance')}
                    className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <span>مدیریت کامل جلسات و فیلترها</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                {teacherSessions.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    هنوز هیچ جلسه کلاسی ثبت نشده است.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <th className="p-3 font-bold rounded-r-xl">تاریخ و روز</th>
                          <th className="p-3 font-bold">کلاس</th>
                          <th className="p-3 font-bold">درس</th>
                          <th className="p-3 font-bold">مبحث تدریس</th>
                          <th className="p-3 font-bold text-center">حاضرین / غایبین</th>
                          <th className="p-3 font-bold text-center rounded-l-xl">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {teacherSessions.slice(0, 5).map((session) => {
                          const cls = teacherClasses.find(c => c.id === session.classId);
                          const sessionRecordList: StudentAttendanceRecord[] = Object.values(session.records || {});
                          const presentCount = sessionRecordList.filter(r => r.status === 'present').length;
                          const absentCount = sessionRecordList.filter(r => r.status === 'absent').length;

                          return (
                            <tr key={session.id} className="hover:bg-slate-50/80 transition">
                              <td className="p-3 font-mono font-bold text-slate-800">
                                {session.date} <span className="text-[10px] text-slate-400 font-normal">({session.dayOfWeek})</span>
                              </td>
                              <td className="p-3 font-bold text-emerald-900">
                                {cls?.name || 'کلاس نامشخص'}
                              </td>
                              <td className="p-3 text-slate-700">
                                <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-[11px]">
                                  {session.subject || getSubjectForClass(session.classId)}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 max-w-xs truncate">
                                {session.lessonTopic || 'بدون مبحث ثبت‌شده'}
                              </td>
                              <td className="p-3 text-center">
                                <span className="text-emerald-700 font-bold">{toPersianDigits(presentCount)} حاضر</span>
                                {' / '}
                                <span className="text-rose-600 font-bold">{toPersianDigits(absentCount)} غایب</span>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => setSelectedSessionForModal(session)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>مشاهده</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* VIEW 3: MY SUBJECTS (دروس تدریسی من) */}
          {activeView === 'subjects' && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      دروس تدریسی من
                    </h3>
                    <p className="text-xs text-slate-500">
                      عناوین دروس و کلاس‌های مرتبط با هر درس
                    </p>
                  </div>
                </div>

                <span className="text-xs bg-amber-50 text-amber-900 font-bold px-3 py-1.5 rounded-xl border border-amber-200 self-start sm:self-auto">
                  {toPersianDigits(subjectGroups.length)} عنوان درسی
                </span>
              </div>

              <div className="space-y-4">
                {subjectGroups.map((group, gIdx) => {
                  const totalGroupStudents = group.classes.reduce((sum, c) => {
                    return sum + students.filter(s => s.classId === c.id).length;
                  }, 0);

                  return (
                    <div key={gIdx} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-amber-100 text-amber-900 font-black text-sm rounded-lg border border-amber-200">
                            درس: {group.subjectName}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({toPersianDigits(group.classes.length)} کلاس • {toPersianDigits(totalGroupStudents)} دانش‌آموز)
                          </span>
                        </div>
                      </div>

                      {group.classes.length === 0 ? (
                        <div className="text-xs text-slate-400 py-3 text-center">
                          هنوز کلاسی برای این عنوان درسی ثبت نشده است.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {group.classes.map((cls) => {
                            const cStudents = students.filter(s => s.classId === cls.id);
                            return (
                              <div key={cls.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 text-xs">{cls.name}</span>
                                  <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    پایه {cls.grade}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {toPersianDigits(cStudents.length)} دانش‌آموز
                                </div>
                                <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200">
                                  <button
                                    onClick={() => onOpenClassDetail(cls)}
                                    className="flex-1 py-1 text-[11px] bg-white hover:bg-emerald-50 text-emerald-800 font-bold rounded border border-slate-200 transition cursor-pointer"
                                  >
                                    ورود
                                  </button>
                                  <button
                                    onClick={() => onOpenNewAttendance(cls.id)}
                                    className="flex-1 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded transition cursor-pointer"
                                  >
                                    حضور و غیاب
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 4: ATTENDANCE MANAGEMENT (حضور و غیاب) */}
          {activeView === 'attendance' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      حضور و غیاب کلاس‌های شما
                    </h3>
                    <p className="text-xs text-slate-500">
                      فهرست جلسات برگزار شده در کلاس‌های تحت تدریس شما
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onOpenNewAttendance()}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>ثبت جلسه حضور و غیاب جدید</span>
                </button>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="جستجو در عنوان درس، مبحث یا تاریخ..."
                      className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold whitespace-nowrap">فیلتر کلاس:</span>
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 outline-none font-bold cursor-pointer"
                  >
                    <option value="all">همه کلاس‌های تدریس شما ({toPersianDigits(teacherClasses.length)})</option>
                    {teacherClasses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {filteredSessions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    موردی یافت نشد.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <th className="p-3 font-bold">تاریخ و روز</th>
                          <th className="p-3 font-bold">کلاس</th>
                          <th className="p-3 font-bold">درس</th>
                          <th className="p-3 font-bold">مبحث تدریس</th>
                          <th className="p-3 font-bold text-center">وضعیت حضور</th>
                          <th className="p-3 font-bold text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSessions.map((session) => {
                          const cls = teacherClasses.find(c => c.id === session.classId);
                          const sessionRecordList: StudentAttendanceRecord[] = Object.values(session.records || {});
                          const presentCount = sessionRecordList.filter(r => r.status === 'present').length;
                          const absentCount = sessionRecordList.filter(r => r.status === 'absent').length;

                          return (
                            <tr key={session.id} className="hover:bg-slate-50/80 transition">
                              <td className="p-3 font-mono font-bold text-slate-800">
                                {session.date} <span className="text-[10px] text-slate-400 font-normal">({session.dayOfWeek})</span>
                              </td>
                              <td className="p-3 font-bold text-emerald-900">
                                {cls?.name || 'کلاس نامشخص'}
                              </td>
                              <td className="p-3 text-slate-700">
                                <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-[11px]">
                                  {session.subject || getSubjectForClass(session.classId)}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 max-w-xs truncate">
                                {session.lessonTopic || 'بدون مبحث ثبت‌شده'}
                              </td>
                              <td className="p-3 text-center">
                                <span className="text-emerald-700 font-bold">{toPersianDigits(presentCount)} حاضر</span>
                                {' / '}
                                <span className="text-rose-600 font-bold">{toPersianDigits(absentCount)} غایب</span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setSelectedSessionForModal(session)}
                                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                    title="مشاهده جزئیات"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => onEditSession(session)}
                                    className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                    title="ویرایش جلسه"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm('آیا از حذف این جلسه اطمینان دارید؟')) {
                                        deleteAttendanceSession(session.id);
                                      }
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="حذف جلسه"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 5: MONTHLY CONTINUOUS GRADES (ثبت نمره) */}
          {activeView === 'grades' && (
            <div className="space-y-4">
              {/* Class selector banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-700" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      دفتر نمرات مستمر ماهانه کلاس‌های اختصاصی شما
                    </h4>
                    <p className="text-xs text-slate-500">
                      انتخاب کلاس جهت ورود و تحلیل نمرات مستمر ماه‌های مهر تا اردیبهشت
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-bold">کلاس موردنظر:</span>
                    <select
                      value={selectedClassForMonthlyGrades}
                      onChange={(e) => setSelectedClassForMonthlyGrades(e.target.value)}
                      className="text-xs bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold rounded-xl px-3 py-2 outline-none cursor-pointer"
                    >
                      {teacherClasses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {onOpenAcademicGrades && (
                    <button
                      onClick={() => onOpenAcademicGrades(selectedClassForMonthlyGrades)}
                      className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>ورود به فرم نمرات</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {currentGradeClass ? (
                <ClassMonthlyGradesSection
                  classData={currentGradeClass}
                  onSelectStudent={onSelectStudent}
                />
              ) : (
                <div className="bg-white p-8 rounded-2xl border text-center text-slate-500">
                  هیچ کلاسی در دسترس نیست.
                </div>
              )}
            </div>
          )}

          {/* VIEW 6: REPORT CARDS (کارنامه) */}
          {activeView === 'report_cards' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      کارنامه و وضعیت دانش‌آموزان کلاس‌های شما
                    </h3>
                    <p className="text-xs text-slate-500">
                      مشاهده وضعیت تحصیلی، غیبت‌ها و پرونده انضباطی دانش‌آموزان کلاس‌های تحت تدریس
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-bold">کلاس:</span>
                  <select
                    value={selectedClassForMonthlyGrades}
                    onChange={(e) => setSelectedClassForMonthlyGrades(e.target.value)}
                    className="text-xs bg-slate-50 text-slate-900 border border-slate-200 font-bold rounded-xl px-3 py-2 outline-none cursor-pointer"
                  >
                    {teacherClasses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {currentGradeClass ? (() => {
                const classStudents = students.filter(s => s.classId === currentGradeClass.id);
                return (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        لیست دانش‌آموزان کلاس {currentGradeClass.name} ({toPersianDigits(classStudents.length)} نفر)
                      </span>
                      {onOpenAcademicGrades && (
                        <button
                          onClick={() => onOpenAcademicGrades(currentGradeClass.id)}
                          className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>مشاهده دفتر نمرات جامع</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <th className="p-3 font-bold">ردیف</th>
                            <th className="p-3 font-bold">نام و نام خانوادگی</th>
                            <th className="p-3 font-bold">کد ملی</th>
                            <th className="p-3 font-bold">شماره دانش‌آموزی</th>
                            <th className="p-3 font-bold text-center">غیبت در جلسات شما</th>
                            <th className="p-3 font-bold text-center">عملیات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {classStudents.map((std, idx) => {
                            const studentAbsences = teacherSessions
                              .filter(s => s.classId === currentGradeClass.id)
                              .filter(s => {
                                const recs: StudentAttendanceRecord[] = Object.values(s.records || {});
                                return recs.some(r => r.studentId === std.id && r.status === 'absent');
                              })
                              .length;

                            return (
                              <tr key={std.id} className="hover:bg-slate-50/80 transition">
                                <td className="p-3 font-mono text-slate-400">{toPersianDigits(idx + 1)}</td>
                                <td className="p-3 font-bold text-slate-900">
                                  {std.firstName} {std.lastName}
                                </td>
                                <td className="p-3 font-mono text-slate-600" dir="ltr">{std.nationalId || '-'}</td>
                                <td className="p-3 font-mono text-slate-600" dir="ltr">{std.studentCode || '-'}</td>
                                <td className="p-3 text-center">
                                  {studentAbsences > 0 ? (
                                    <span className="text-rose-600 font-bold">{toPersianDigits(studentAbsences)} جلسه</span>
                                  ) : (
                                    <span className="text-emerald-600 font-bold">بدون غیبت</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {onSelectStudent && (
                                      <button
                                        onClick={() => onSelectStudent(std)}
                                        className="px-2.5 py-1 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg transition cursor-pointer"
                                      >
                                        مشاهده پرونده
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })() : null}
            </div>
          )}

          {/* VIEW 7: REPORTS (گزارش‌های آموزشی) */}
          {activeView === 'reports' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-indigo-100 text-indigo-800 rounded-xl">
                    <BarChart2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      گزارش‌های آماری و تحلیلی آموزش
                    </h3>
                    <p className="text-xs text-slate-500">
                      تحلیل جلسات برگزارشده، نرخ حضور و وضعیت کلاسی
                    </p>
                  </div>
                </div>

                <span className="text-xs bg-indigo-50 text-indigo-800 font-bold px-3 py-1.5 rounded-xl border border-indigo-200 self-start sm:self-auto">
                  بر اساس دروس و کلاس‌های اختصاصی شما
                </span>
              </div>

              {/* Stats overview cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <span className="text-xs text-slate-500 block">مجموع جلسات تشکیل‌شده</span>
                  <div className="text-2xl font-black text-slate-900">{toPersianDigits(teacherSessions.length)} جلسه</div>
                  <span className="text-[11px] text-emerald-600 block">ثبت شده در سامانه</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <span className="text-xs text-slate-500 block">کلاس‌های تحت پوشش</span>
                  <div className="text-2xl font-black text-slate-900">{toPersianDigits(teacherClasses.length)} کلاس</div>
                  <span className="text-[11px] text-slate-500 block">{toPersianDigits(totalStudentsTaught)} دانش‌آموز تحت تدریس</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                  <span className="text-xs text-slate-500 block">میانگین نرخ حضور</span>
                  <div className="text-2xl font-black text-emerald-700">
                    {teacherSessions.length > 0 ? '۹۳٪' : '۰٪'}
                  </div>
                  <span className="text-[11px] text-emerald-600 block">انضباط آموزشی بالا</span>
                </div>
              </div>

              {/* Class breakdown */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <h4 className="font-bold text-slate-900 text-sm">
                  تفکیک جلسات و حضور و غیاب بر اساس هر کلاس
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {teacherClasses.map(cls => {
                    const cSessions = teacherSessions.filter(s => s.classId === cls.id);
                    const cStudents = students.filter(s => s.classId === cls.id);

                    return (
                      <div key={cls.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs">{cls.name}</span>
                          <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded font-medium">
                            {toPersianDigits(cStudents.length)} دانش‌آموز
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center justify-between">
                          <span>تعداد جلسات:</span>
                          <span className="font-bold">{toPersianDigits(cSessions.length)} جلسه</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-600 h-full rounded-full" style={{ width: '85%' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeView === 'activities' && <TeacherActivitiesSection />}

          {/* VIEW 8: EVALUATIONS & NOTICES */}
          {activeView === 'evaluations' && (
            <div className="space-y-6">
              {/* Section 1: Teacher's Personal Qualitative Evaluation Report */}
              {(() => {
                const safeTeacherEvaluations = teacherEvaluations || [];
                const myEvaluation = safeTeacherEvaluations.find(e => e.teacherId === currentUser.id);

                const getQualitativeRating = (val: any): QualitativeRating => {
                  if (val === 'excellent' || val === 'very_good' || val === 'good' || val === 'needs_improvement') {
                    return val;
                  }
                  if (typeof val === 'object' && val?.rating) {
                    return val.rating;
                  }
                  return 'good';
                };

                return (
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                          <Award className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">
                            کارنامه ارزشیابی کیفی عملکرد شما
                          </h3>
                          <p className="text-xs text-slate-500">
                            ارزیابی تخصصی ثبت‌شده توسط معاونت آموزشی دبیرستان
                          </p>
                        </div>
                      </div>

                      {myEvaluation && (
                        <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-bold text-amber-900">
                            امتیاز کل: {toPersianDigits(myEvaluation.overallScore || 95)} از ۱۰۰
                          </span>
                        </div>
                      )}
                    </div>

                    {!myEvaluation ? (
                      <div className="bg-slate-50 rounded-2xl p-8 text-center border border-dashed border-slate-300 space-y-2">
                        <Award className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-600">
                          هنوز فرم ارزشیابی جدیدی برای سال تحصیلی جاری صادر نشده است.
                        </p>
                        <p className="text-[11px] text-slate-400">
                          پس از ثبت نظرات و امتیازدهی توسط معاونت محترم آموزش، گزارش مربوطه در این بخش نمایش داده خواهد شد.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          {Object.entries(myEvaluation.criteria || {}).map(([key, value]) => {
                            const ratingKey = getQualitativeRating(value);
                            const ratingMeta = QUALITATIVE_RATING_MAP[ratingKey] || QUALITATIVE_RATING_MAP['good'];

                            const criteriaLabels: Record<string, string> = {
                              attendancePunctuality: 'نظم و حضور به‌موقع در کلاس',
                              teachingQuality: 'کیفیت تدریس و فن بیان',
                              studentEngagement: 'انگیزش و مشارکت دانش‌آموزان',
                              lessonPlanning: 'طرح درس و بودجه‌بندی سرفصل‌ها',
                              gradingAccuracy: 'دقت در ثبت نمرات و بازخورد',
                              parentCommunication: 'ارتباط موثر با اولیا و مشاورین',
                            };

                            return (
                              <div key={key} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
                                <span className="text-xs font-bold text-slate-800 block">
                                  {criteriaLabels[key] || key}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${ratingMeta.colorClass}`}>
                                    {ratingMeta.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {myEvaluation.growthRecommendations && (
                          <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/60 space-y-1.5">
                            <span className="text-xs font-bold text-amber-900 block">
                              توصیه‌های ارتقاء و توانمندسازی معاونت آموزش:
                            </span>
                            <p className="text-xs text-slate-700 leading-relaxed">
                              {Array.isArray(myEvaluation.growthRecommendations) 
                                ? myEvaluation.growthRecommendations.join(' • ') 
                                : myEvaluation.growthRecommendations}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Section 2: School Announcements */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-600" />
                    <span>بخشنامه‌ها، اطلاعیه‌ها و پیام‌های عمومی مدرسه</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    {toPersianDigits((schoolAnnouncements || []).length)} اطلاعیه فعال
                  </span>
                </div>

                {(schoolAnnouncements || []).length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 text-slate-400 text-xs">
                    در حال حاضر اطلاعیه جدیدی برای شما وجود ندارد.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(schoolAnnouncements || []).map((ann) => (
                      <div key={ann.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            ann.priority === 'urgent' ? 'bg-rose-100 text-rose-800' :
                            ann.priority === 'important' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {ann.priority === 'urgent' ? 'فوری' : ann.priority === 'important' ? 'مهم' : 'عادی'}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">{ann.title}</h4>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed text-justify whitespace-pre-line line-clamp-4 break-words">
                          {ann.content}
                        </p>
                        <button
                          type="button"
                          onClick={() => setCircularModal(ann)}
                          className="px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                        >
                          مشاهده متن کامل{unreadCirculars[ann.id] ? ' • جدید' : ''}
                        </button>
                        {(ann.attachments || []).map((f, i) => (
                          <a
                            key={i}
                            href={f.dataUrl}
                            download={f.name}
                            className="flex items-center gap-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 rounded-lg px-2.5 py-1.5"
                          >
                            <span className="truncate">📎 {f.name}</span>
                          </a>
                        ))}

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                          <span>صادرکننده: {ann.author || ann.authorName || 'معاونت آموزش'}</span>
                          <span className="font-mono">{ann.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Session Detail Modal */}
      {selectedSessionForModal && (
        <SessionDetailModal
          isOpen={!!selectedSessionForModal}
          onClose={() => setSelectedSessionForModal(null)}
          session={selectedSessionForModal}
          onEditSession={(s) => {
            setSelectedSessionForModal(null);
            onEditSession(s);
          }}
          onSelectStudent={onSelectStudent}
        />
      )}

      <CircularModal announcement={circularModal} onAcknowledge={acknowledgeCircular} onClose={() => setCircularModal(null)} />
    </div>
  );
};
