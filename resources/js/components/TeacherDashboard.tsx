import React, { useEffect, useState } from 'react';
import { useScrollTop } from '../utils/useScrollTop';
import { apiRequest } from '../lib/serverSync';
import { CircularModal } from './CircularModal';
import { CircularAlertCard } from './CircularAlertCard';
import { useSchool } from '../context/SchoolContext';
import { AppNotification, SchoolAnnouncement, SchoolClass, AttendanceSession, Student, StudentAttendanceRecord, QualitativeRating } from '../types';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { exportClassAttendanceToExcel } from '../utils/excelExport';
import { getUserGreeting } from '../utils/userRoles';
import { SessionDetailModal } from './SessionDetailModal';
import { ClassMonthlyGradesSection } from './ClassMonthlyGradesSection';
import { QUALITATIVE_RATING_MAP } from './TeacherEvaluationSection';
import { WorkspaceTitleBar, HeaderAction } from './ui/WorkspaceHeader';
import { TeacherSidebarNav, TeacherViewType } from './TeacherSidebarNav';
import { GraduationCap, Users, CheckCircle2, PlusCircle, BookOpen, Clock, Edit, Trash2, Search, ChevronLeft, Eye, Award, Star, Bell, CalendarCheck, SearchX, Calendar, FileText } from 'lucide-react';
import { MobileBottomNav } from './MobileBottomNav';
import { EmptyState } from './EmptyState';
import { teacherMobileNav, HOME } from './mobileNavConfigs';
import { TeacherSubjectsView } from './TeacherSubjectsView';
import { TeacherReportCardsView } from './TeacherReportCardsView';
import { TeacherReportsView } from './TeacherReportsView';
import { TeacherGradesView } from './TeacherGradesView';
import { TeacherLessonPlans } from './TeacherLessonPlans';
import { TeacherExamSection, examKeyOfSubjectName } from './TeacherExamSection';
import { FitTable } from './ui/FitTable';
import { Tile } from './ui/Tile';
import { TeacherPunchTile } from './TeacherPunchTile';
import { TimesheetWorkspace } from './TimesheetWorkspace';
import { TeacherExamCard } from './TeacherExamCard';

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
    teachingAccessibleSessions,
    workshopAssignments,
    studentsOfClass,
    teacherEvaluations,
    schoolAnnouncements: allAnnouncements,
    deleteAttendanceSession, showConfirm,
    lessonPlans
  } = useSchool();

  const schoolAnnouncements = (allAnnouncements || []).filter((a) => a.status !== 'archived');
  const [activeView, setActiveView] = useState<TeacherViewType>('dashboard');
  const [examFocus, setExamFocus] = useState(false);
  useScrollTop(activeView);
  const [showGradeAnalytics, setShowGradeAnalytics] = useState(false);

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

  // کادر وسط صفحه: بخشنامه‌های خوانده‌نشده یکی‌یکی نمایش داده می‌شوند تا استاد «متوجه شدم» بزند
  const [dismissedCirculars, setDismissedCirculars] = useState<string[]>([]);
  const pendingCirculars = schoolAnnouncements.filter((a) => unreadCirculars[a.id]);
  const alertCircular = pendingCirculars.find((a) => !dismissedCirculars.includes(a.id)) || null;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Use strictly the teacher's permitted classes and sessions
  const teacherClasses = teachingAccessibleClasses && teachingAccessibleClasses.length > 0 
    ? teachingAccessibleClasses 
    : accessibleClasses;

  // فقط جلسات درس‌های خود استاد (بدون بازگشت به فهرست همه جلسات)
  const teacherSessions = teachingAccessibleSessions;

  const [selectedClassForMonthlyGrades, setSelectedClassForMonthlyGrades] = useState<string>(
    (teacherClasses.find((c) => !c.isWorkshop) || teacherClasses[0])?.id ?? ''
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
    // هر کارگاه یک درس مستقل (با کلاس مجازی خودش) است
    const workshopGroups = workshopAssignments.map((a) => ({
      subjectId: a.subjectId,
      subjectName: a.subjectName,
      classes: teacherClasses.filter((c) => a.classIds.includes(c.id)),
    }));
    const regularClasses = teacherClasses.filter((c) => !c.isWorkshop);
    if (currentUser.teachingAssignments && currentUser.teachingAssignments.length > 0) {
      return [
        ...currentUser.teachingAssignments.map(a => ({
          subjectId: a.subjectId || a.subjectName,
          subjectName: a.subjectName,
          classes: regularClasses.filter(c => a.classIds.includes(c.id)),
        })),
        ...workshopGroups,
      ];
    }
    if (regularClasses.length === 0) return workshopGroups;
    const defaultSubject = currentUser.teachingSubject || currentUser.subject || 'درس تخصصی';
    return [
      {
        subjectId: defaultSubject,
        subjectName: defaultSubject,
        classes: regularClasses,
      },
      ...workshopGroups,
    ];
  }, [currentUser, teacherClasses, workshopAssignments]);

  // آزمون جامع: فقط دبیران فارسی، ریاضی، علوم، عربی و انگلیسی
  const hasExam = React.useMemo(() => subjectGroups.some((g) => !!examKeyOfSubjectName(g.subjectName) && g.classes.some((c) => !c.isWorkshop)), [subjectGroups]);

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
  const totalStudentsTaught = new Set(teacherClasses.flatMap((c) => studentsOfClass(c.id).map((s) => s.id))).size;

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

  // دفتر نمرات مستمر مخصوص کلاس‌های درسی است (کارگاه‌ها درس ثبت‌شده ندارند)
  const gradeClasses = teacherClasses.filter((c) => !c.isWorkshop);
  const currentGradeClass = gradeClasses.find(c => c.id === selectedClassForMonthlyGrades) || gradeClasses[0];
  const userGreeting = getUserGreeting(currentUser);
  const myLessonPlans = (lessonPlans || []).filter((p) => p.teacherId === currentUser.id);
  const pendingLessonPlans = myLessonPlans.filter((p) => p.status === 'submitted').length;

  return (
    <div className="font-['Vazirmatn',sans-serif] space-y-6">
      
      {/* Teacher Top Navigation & View Switcher Layout */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        
        {/* RIGHT SIDEBAR NAV (Desktop + Mobile Drawer) */}
        <div className="hidden md:block w-full lg:w-auto shrink-0 lg:sticky lg:top-20 yv-sidebar-dock">
          <TeacherSidebarNav
            activeView={activeView}
            onSelectView={(view) => {
              setActiveView(view);
              if (view !== 'exam') setExamFocus(false);
              if (view === 'grades' && !selectedClassForMonthlyGrades && teacherClasses.length > 0) {
                setSelectedClassForMonthlyGrades(teacherClasses[0].id);
              }
            }}
            currentUser={currentUser}
            teachingClasses={teacherClasses}
            teachingSubjects={subjectGroups.map(g => g.subjectName)}
            hasExam={hasExam}
            totalSessionsCount={teacherSessions.length}
            totalStudentsCount={totalStudentsTaught}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        {/* نوار ناوبری پایین (فقط موبایل) */}
        {(() => {
          const nav = teacherMobileNav(hasExam);
          return (
            <MobileBottomNav
              items={nav.primary}
              moreItems={nav.more}
              activeId={activeView}
              onSelect={(id) => {
                if (id !== 'exam') setExamFocus(false);
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

                {!cls.isWorkshop && (
                  <ClassMonthlyGradesSection
                    classData={cls}
                    onSelectStudent={onSelectStudent}
                    initialSubjectId={selectedCourse.subjectId}
                  />
                )}

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
            <div className="space-y-5">
              
              {/* کادر خوشامد شیشه‌ای (هم‌سبک پنل معاونین) */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base sm:text-xl font-black text-slate-900">{userGreeting.greeting} 👋</h2>
                  <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-gradient-to-l from-emerald-50 to-teal-50 text-teal-800 border border-teal-200/80 shadow-2xs whitespace-nowrap">دبیر</span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>امروز: {todayInfo.dayOfWeek}، {todayInfo.displayDate}</span>
                  <span className="text-slate-300">·</span>
                  <span>مدیریت تدریس، جلسات کلاسی و ثبت نمرات مستمر</span>
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => onOpenNewAttendance()} className="min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer transition">
                    <CheckCircle2 className="w-4 h-4" />
                    حضور و غیاب
                  </button>
                  <button type="button" onClick={() => { if (!selectedClassForMonthlyGrades && teacherClasses.length > 0) setSelectedClassForMonthlyGrades(teacherClasses[0].id); setActiveView('grades'); }} className="min-h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer transition">
                    <Award className="w-4 h-4" />
                    ثبت نمره
                  </button>
                </div>
              </section>

              {/* کادر آزمون جامع: معدل ماه قبل */}
              {hasExam && <TeacherExamCard groups={subjectGroups} onOpen={() => { setExamFocus(true); setActiveView('exam'); }} />}

              {/* کاشی‌های شیشه‌ای رنگی */}
              <div data-stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <Tile tone="emerald" label="کلاس‌های من" value={toPersianDigits(teacherClasses.length)} hint={`${toPersianDigits(courseCards.length)} درس`} icon={<GraduationCap className="w-4 h-4" />} onClick={() => document.getElementById('teacher-classes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
                <Tile tone="sky" label="دانش‌آموزان" value={toPersianDigits(totalStudentsTaught)} hint="در کلاس‌های شما" icon={<Users className="w-4 h-4" />} onClick={() => document.getElementById('teacher-classes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
                <Tile tone="violet" label="جلسات ثبت‌شده" value={toPersianDigits(teacherSessions.length)} hint="مدیریت جلسات" icon={<CalendarCheck className="w-4 h-4" />} onClick={() => setActiveView('attendance')} />
                <TeacherPunchTile onOpenTimesheet={() => setActiveView('activities')} />
                <Tile tone="teal" label="طرح درس" value={toPersianDigits(myLessonPlans.length)} hint={pendingLessonPlans > 0 ? `${toPersianDigits(pendingLessonPlans)} در انتظار تأیید` : 'نوشتن و پیگیری طرح درس'} icon={<FileText className="w-4 h-4" />} onClick={() => setActiveView('lesson_plans')} />
                <Tile
                  tone="rose"
                  label="اطلاعیه‌ها"
                  value={toPersianDigits(pendingCirculars.length)}
                  hint={pendingCirculars.length > 0 ? 'خوانده‌نشده' : 'همه خوانده شده'}
                  badge={pendingCirculars.length > 0 ? `${toPersianDigits(pendingCirculars.length)} خوانده‌نشده` : undefined}
                  icon={<Bell className="w-4 h-4" />}
                  onClick={() => (firstUnreadCircular ? setCircularModal(firstUnreadCircular) : setActiveView('evaluations'))}
                />
              </div>

              {/* SECTION: دروس و کلاس‌های تدریس (هر کارت = یک درس در یک کلاس) */}
              <div id="teacher-classes-section" className="space-y-3 scroll-mt-24">
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
                      const classStudents = studentsOfClass(cls.id);
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
                          className="rounded-2xl p-4 border border-emerald-200/80 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all space-y-4 flex flex-col justify-between cursor-pointer text-right"
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

                          <div className="grid grid-cols-5 gap-2 pt-3 border-t border-emerald-100/80">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openCourse();
                              }}
                              className="col-span-3 min-h-12 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
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
                              className="col-span-2 min-h-12 py-2 px-2 bg-white/80 border border-emerald-100 hover:bg-white text-emerald-900 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
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
              <div className="rounded-2xl p-4 sm:p-5 border border-slate-200 bg-white shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
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
                  <EmptyState
                    icon={CalendarCheck}
                    title="هنوز جلسه‌ای ثبت نشده است"
                    description="با ثبت اولین حضور و غیاب، سوابق جلسات این‌جا نمایش داده می‌شود."
                  />
                ) : (
                  <>
                  {/* موبایل: کارت‌های فشرده */}
                  <div className="space-y-2 md:hidden">
                    {teacherSessions.slice(0, 5).map((session) => {
                      const cls = teacherClasses.find((c) => c.id === session.classId);
                      const list: StudentAttendanceRecord[] = Object.values(session.records || {});
                      const present = list.filter((r) => r.status === 'present').length;
                      const absent = list.filter((r) => r.status === 'absent').length;
                      return (
                        <div key={session.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-sm backdrop-blur-sm">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-black text-emerald-900 truncate">{cls?.name || 'کلاس نامشخص'} <span className="font-medium text-slate-500">· {session.subject || getSubjectForClass(session.classId)}</span></span>
                            <span className="font-mono text-slate-400 shrink-0">{toPersianDigits(session.date)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-xs text-slate-600">{session.lessonTopic || 'بدون مبحث ثبت‌شده'}</p>
                            <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-black">
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">{toPersianDigits(present)} حاضر</span>
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">{toPersianDigits(absent)} غایب</span>
                              <button type="button" onClick={() => setSelectedSessionForModal(session)} className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 cursor-pointer" aria-label="مشاهده جلسه">
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <FitTable className="hidden md:block">
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
                  </FitTable>
                  </>
                )}
              </div>

            </div>
          )}

          {/* VIEW 3: MY SUBJECTS (دروس تدریسی من) */}
          {activeView === 'subjects' && <TeacherSubjectsView subjectGroups={subjectGroups} onOpenClassDetail={onOpenClassDetail} onOpenNewAttendance={onOpenNewAttendance} />}

          {/* VIEW 4: ATTENDANCE MANAGEMENT (حضور و غیاب) */}
          {activeView === 'attendance' && (
            <div className="space-y-4">
              <WorkspaceTitleBar
                title="حضور و غیاب کلاس‌های شما"
                icon={CheckCircle2}
                subtitle="فهرست جلسات برگزار شده در کلاس‌های تحت تدریس شما"
                actions={<HeaderAction variant="primary" icon={PlusCircle} label="ثبت جلسه جدید" onClick={() => onOpenNewAttendance()} className="!h-11" />}
              />

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
                  <EmptyState
                    icon={SearchX}
                    title="موردی پیدا نشد"
                    description="فیلترها را تغییر دهید یا جست‌وجو را پاک کنید."
                  />
                ) : (
                  <FitTable className="">
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
                                      showConfirm({
                                        title: 'حذف شود؟',
                                        message: 'آیا از حذف این جلسه اطمینان دارید؟',
                                        confirmLabel: 'بله، حذف شود',
                                        cancelLabel: 'انصراف',
                                        isDangerous: true,
                                        onConfirm: () => {
                                        deleteAttendanceSession(session.id);
                                      
                                        },
                                      });
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
                  </FitTable>
                )}
              </div>
            </div>
          )}

          {/* VIEW 5: MONTHLY CONTINUOUS GRADES (ثبت نمره) */}
          {activeView === 'grades' && <TeacherGradesView gradeClasses={gradeClasses} currentGradeClass={currentGradeClass} selectedClassForMonthlyGrades={selectedClassForMonthlyGrades} setSelectedClassForMonthlyGrades={setSelectedClassForMonthlyGrades} showGradeAnalytics={showGradeAnalytics} setShowGradeAnalytics={setShowGradeAnalytics} onOpenAcademicGrades={onOpenAcademicGrades} onSelectStudent={onSelectStudent} />}

          {/* VIEW: طرح درس روزانه */}
          {activeView === 'lesson_plans' && (
            <TeacherLessonPlans classes={teacherClasses.filter((c) => !c.isWorkshop)} subjectNames={Array.from(new Set(subjectGroups.map((g) => g.subjectName)))} />
          )}

          {/* VIEW: آزمون جامع (فقط درس خود دبیر) */}
          {activeView === 'activities' && <TimesheetWorkspace />}

          {activeView === 'exam' && hasExam && <TeacherExamSection groups={subjectGroups} focusReport={examFocus} />}

          {/* VIEW 6: REPORT CARDS (کارنامه) */}
          {activeView === 'report_cards' && <TeacherReportCardsView teacherSessions={teacherSessions} onSelectStudent={onSelectStudent} gradeClasses={gradeClasses} currentGradeClass={currentGradeClass} selectedClassForMonthlyGrades={selectedClassForMonthlyGrades} setSelectedClassForMonthlyGrades={setSelectedClassForMonthlyGrades} onOpenAcademicGrades={onOpenAcademicGrades} />}

          {/* VIEW 7: REPORTS (گزارش‌های آموزشی) */}
          {activeView === 'reports' && <TeacherReportsView teacherClasses={teacherClasses} teacherSessions={teacherSessions} totalStudentsTaught={totalStudentsTaught} />}


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
                  <div className="bg-white rounded-2xl border border-slate-200">
                    <EmptyState
                      icon={Bell}
                      title="اطلاعیه‌ی جدیدی ندارید"
                      description="اطلاعیه‌های معاونت آموزش از همین‌جا به شما می‌رسد."
                    />
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

      <CircularAlertCard
        announcement={circularModal ? null : alertCircular}
        position={{ index: alertCircular ? pendingCirculars.indexOf(alertCircular) + 1 : 0, total: pendingCirculars.length }}
        onAcknowledge={acknowledgeCircular}
        onDismiss={() => alertCircular && setDismissedCirculars((prev) => [...prev, alertCircular.id])}
      />
      <CircularModal announcement={circularModal} onAcknowledge={acknowledgeCircular} onClose={() => setCircularModal(null)} />
    </div>
  );
};
