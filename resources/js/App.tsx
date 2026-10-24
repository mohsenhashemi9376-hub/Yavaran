import { ViewDateBar } from './components/ViewDateBar';
import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { lazyModal } from './utils/lazyModal';
import { useScrollTop } from './utils/useScrollTop';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from './utils/persianDate';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { Header } from './components/Header';
import { ConfidentialGuard } from './components/ConfidentialGuard';
import { SyncStatusBadge } from './components/SyncStatusBadge';
import { BrandSplash } from './components/BrandSplash';
import { LoginModal } from './components/LoginModal';
import { ForcePasswordChange } from './components/ForcePasswordChange';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SchoolClass, AttendanceSession, Student, User } from './types';
import { GraduationCap, Sparkles, CheckCircle2, Shield, Calendar, Users, ShieldAlert, BookOpen } from 'lucide-react';
import { getTodayShamsi } from './utils/persianDate';
import { useLuxScope } from './context/ThemeContext';
import { useWakeLock } from './utils/useWakeLock';
import { ActiveAttendance, clearActiveAttendance, loadActiveAttendance } from './utils/attendanceDraft';

// بارگذاری تنبل: فقط داشبورد نقش کاربر و پنجره‌هایی که باز می‌شوند دریافت می‌شوند
const TeacherDashboard = lazy(() => import('./components/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const DisciplinaryDashboard = lazy(() => import('./components/DisciplinaryDashboard').then((m) => ({ default: m.DisciplinaryDashboard })));
const EducationalDashboard = lazy(() => import('./components/EducationalDashboard').then((m) => ({ default: m.EducationalDashboard })));
const NurturingDashboard = lazy(() => import('./components/NurturingDashboard').then((m) => ({ default: m.NurturingDashboard })));
const AttendanceModal = lazyModal(() => import('./components/AttendanceModal').then((m) => ({ default: m.AttendanceModal })));
const ClassDetailModal = lazyModal(() => import('./components/ClassDetailModal').then((m) => ({ default: m.ClassDetailModal })));
const MonthlySummaryModal = lazyModal(() => import('./components/MonthlySummaryModal').then((m) => ({ default: m.MonthlySummaryModal })));
const StudentProfileModal = lazyModal(() => import('./components/StudentProfileModal').then((m) => ({ default: m.StudentProfileModal })));
const AcademicGradesModal = lazyModal(() => import('./components/AcademicGradesModal').then((m) => ({ default: m.AcademicGradesModal })));
const AddClassModal = lazyModal(() => import('./components/AddClassModal').then((m) => ({ default: m.AddClassModal })));
const AddTeacherModal = lazyModal(() => import('./components/AddTeacherModal').then((m) => ({ default: m.AddTeacherModal })));
const GlobalSearchModal = lazyModal(() => import('./components/GlobalSearchModal').then((m) => ({ default: m.GlobalSearchModal })));
const TeacherProfileModal = lazyModal(() => import('./components/TeacherProfileModal').then((m) => ({ default: m.TeacherProfileModal })));
const CoachProfileModal = lazyModal(() => import('./components/CoachProfileModal').then((m) => ({ default: m.CoachProfileModal })));
const EditTeacherModal = lazyModal(() => import('./components/EditTeacherModal').then((m) => ({ default: m.EditTeacherModal })));
const EditCoachModal = lazyModal(() => import('./components/EditCoachModal').then((m) => ({ default: m.EditCoachModal })));

const MainApp: React.FC = () => {
  const { 
    currentUser, 
    students,
    sessions,
    isTeacher, 
    isAdmin, 
    isEducationalVice, 
    isDisciplinaryVice, 
    isNurturingVice,
    isCoach,
    isAdminOrVice,
    viewDate
  } = useSchool();
  
  const todayInfo = getTodayShamsi();

  // صفحه‌ی گوشی تا زمانی که برنامه باز است خاموش نشود
  useWakeLock(true);

  // Active view tab: 'main' (Classes/Attendance), 'discipline' (Disciplinary VP), 'grades' (Educational VP), 'nurture' (Nurturing VP & Coach), 'teacher' (Coach acting as Teacher)
  const [activeTab, setActiveTab] = useState<'main' | 'discipline' | 'grades' | 'nurture' | 'teacher'>('main');
  const prevUserIdRef = useRef<string>('');
  useScrollTop(activeTab);
  const TAB_KEY = 'yv-active-tab';
  const savedTab = (): typeof activeTab | null => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(TAB_KEY) || 'null') as { u: string; t: typeof activeTab } | null;
      return raw && raw.u === currentUser.id ? raw.t : null;
    } catch { return null; }
  };

  // گارد دسترسی: مدیر مدرسه هیچ دسترسی‌ای به بخش معاونت تربیتی ندارد
  // جابه‌جایی بین پنل معاونت‌ها فقط برای مدیر مدرسه؛ سایرین فقط پنل مسئولیت خود (و پنل آموزشی در صورت داشتن درس)
  const ownTab: typeof activeTab = isTeacher
    ? 'main'
    : isCoach || isNurturingVice
    ? 'nurture'
    : currentUser.role === 'vice_disciplinary'
    ? 'discipline'
    : currentUser.role === 'vice_educational'
    ? 'grades'
    : 'main';
  const allowedTabs: (typeof activeTab)[] = isAdmin
    ? ['main', 'discipline', 'grades', ...(currentUser.isAlsoTeacher ? (['teacher'] as const) : [])]
    : [ownTab, ...(currentUser.isAlsoTeacher ? (['teacher'] as const) : [])];
  const effectiveTab = allowedTabs.includes(activeTab) ? activeTab : ownTab;

  // Auto-switch view tab when user actually changes accounts
  useEffect(() => {
    if (prevUserIdRef.current !== currentUser.id) {
      prevUserIdRef.current = currentUser.id;
      const saved = savedTab();
      if (saved) {
        // بازگشت به همان بخشی که کاربر پیش از بسته‌شدن برنامه در آن بود (اعتبار آن با allowedTabs سنجیده می‌شود)
        setActiveTab(saved);
      } else if (isTeacher) {
        setActiveTab('main');
      } else if (isCoach && currentUser.isAlsoTeacher) {
        // Multi-role coach: default to nurture panel on account switch
        setActiveTab('nurture');
      } else if (isNurturingVice || isCoach) {
        setActiveTab('nurture');
      } else if (isDisciplinaryVice) {
        setActiveTab('discipline');
      } else if (isEducationalVice && !isAdmin) {
        setActiveTab('grades');
      } else {
        setActiveTab('main');
      }
    }
  }, [currentUser.id, currentUser.role, isTeacher, isNurturingVice, isCoach, isDisciplinaryVice, isEducationalVice, isAdmin]);

  useEffect(() => {
    if (!currentUser.id) return;
    try { window.localStorage.setItem(TAB_KEY, JSON.stringify({ u: currentUser.id, t: activeTab })); } catch { /* ignore */ }
  }, [activeTab, currentUser.id]);

  // Modal states
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  // اگر پیش از بارگذاری دوباره (مثلاً خاموش‌شدن صفحه) فهرست حضور و غیاب باز بوده، همان فهرست با پیش‌نویسش بازمی‌گردد
  const [resumeAttendance] = useState<ActiveAttendance | null>(() => loadActiveAttendance(currentUser.id));
  const [resumeActive, setResumeActive] = useState<boolean>(Boolean(resumeAttendance));
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(Boolean(resumeAttendance));
  const [targetClassIdForAttendance, setTargetClassIdForAttendance] = useState<string | undefined>(resumeAttendance?.classId);
  const [targetSubjectForAttendance, setTargetSubjectForAttendance] = useState<string | undefined>(resumeAttendance?.subject);
  const [sessionToEdit, setSessionToEdit] = useState<AttendanceSession | null>(
    () => (resumeAttendance?.sessionId ? sessions.find((s) => s.id === resumeAttendance.sessionId) ?? null : null)
  );

  const [classDetailModalOpen, setClassDetailModalOpen] = useState(false);
  const [targetClassForDetail, setTargetClassForDetail] = useState<SchoolClass | null>(null);

  const [monthlySummaryModalOpen, setMonthlySummaryModalOpen] = useState(false);
  const [targetClassForSummary, setTargetClassForSummary] = useState<string | undefined>(undefined);

  const [studentProfileModalOpen, setStudentProfileModalOpen] = useState(false);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [profileInitialTab, setProfileInitialTab] = useState<'overview' | 'info' | 'attendance' | 'discipline' | 'grades' | 'timeline'>('overview');

  const [academicGradesModalOpen, setAcademicGradesModalOpen] = useState(false);
  const [targetClassForGrades, setTargetClassForGrades] = useState<string | undefined>(undefined);
  const [targetSubjectForGrades, setTargetSubjectForGrades] = useState<string | undefined>(undefined);

  const [addClassModalOpen, setAddClassModalOpen] = useState(false);
  const [addTeacherModalOpen, setAddTeacherModalOpen] = useState(false);

  // Global search & Teacher/Coach profile states
  const [globalSearchModalOpen, setGlobalSearchModalOpen] = useState(false);
  const [teacherProfileModalOpen, setTeacherProfileModalOpen] = useState(false);
  const [selectedTeacherForProfile, setSelectedTeacherForProfile] = useState<User | null>(null);
  const [coachProfileModalOpen, setCoachProfileModalOpen] = useState(false);
  const [selectedCoachForProfile, setSelectedCoachForProfile] = useState<User | null>(null);

  const [editTeacherModalOpen, setEditTeacherModalOpen] = useState(false);
  const [teacherToEdit, setTeacherToEdit] = useState<User | null>(null);
  const [editCoachModalOpen, setEditCoachModalOpen] = useState(false);
  const [coachToEdit, setCoachToEdit] = useState<User | null>(null);

  // میانبر جستجوی سراسری: Ctrl+K / ⌘K (با صفحه‌کلید فارسی هم کار می‌کند: کلید «ن»)، یا «/» وقتی در حال تایپ نیستید
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.code === 'KeyK' || key === 'k' || key === 'ن')) {
        e.preventDefault();
        setGlobalSearchModalOpen((prev) => !prev);
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === '/') {
        e.preventDefault();
        setGlobalSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // باز کردن پرونده دانش‌آموز از پیوند داخل صندوق پیام
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ studentId?: string }>).detail?.studentId;
      const st = students.find((x) => x.id === id);
      if (st) {
        setSelectedStudentForProfile(st);
        setProfileInitialTab('overview');
        setStudentProfileModalOpen(true);
      }
    };
    window.addEventListener('yavaran:open-student', onOpen);
    return () => window.removeEventListener('yavaran:open-student', onOpen);
  }, [students]);

  // Modal triggers
  const handleOpenNewAttendance = (classId?: string, subject?: string) => {
    setResumeActive(false);
    setTargetSubjectForAttendance(subject);
    // پنجره جزئیات کلاس باید بسته شود تا فهرست حضور و غیاب بلافاصله دیده شود
    setClassDetailModalOpen(false);
    setTargetClassForDetail(null);
    setSessionToEdit(null);
    setTargetClassIdForAttendance(classId);
    setAttendanceModalOpen(true);
  };

  const handleEditSession = (session: AttendanceSession) => {
    setResumeActive(false);
    setSessionToEdit(session);
    setTargetClassIdForAttendance(session.classId);
    setAttendanceModalOpen(true);
  };

  const handleOpenClassDetail = (cls: SchoolClass) => {
    setTargetClassForDetail(cls);
    setClassDetailModalOpen(true);
  };

  const handleOpenMonthlySummary = (classId?: string) => {
    setTargetClassForSummary(classId);
    setMonthlySummaryModalOpen(true);
  };

  const handleOpenStudentProfile = (
    student: Student, 
    tab: 'overview' | 'info' | 'attendance' | 'discipline' | 'grades' = 'overview'
  ) => {
    setSelectedStudentForProfile(student);
    setProfileInitialTab(tab);
    setStudentProfileModalOpen(true);
  };

  const handleOpenAcademicGrades = (classId?: string, subjectId?: string) => {
    setTargetClassForGrades(classId);
    setTargetSubjectForGrades(subjectId);
    setAcademicGradesModalOpen(true);
  };

  const handleOpenTeacherProfile = (teacher: User) => {
    setSelectedTeacherForProfile(teacher);
    setTeacherProfileModalOpen(true);
  };

  const handleOpenCoachProfile = (coach: User) => {
    setSelectedCoachForProfile(coach);
    setCoachProfileModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Vazirmatn',sans-serif]">
      {/* Top Header */}
<ErrorBoundary fallbackTitle="بارگذاری نوار بالا با مشکل مواجه شد">
      <Header
        onOpenNewClassModal={() => setAddClassModalOpen(true)}
        onOpenNewTeacherModal={() => setAddTeacherModalOpen(true)}
        onOpenAcademicGrades={() => handleOpenAcademicGrades()}
        onOpenLoginModal={() => setLoginModalOpen(true)}
        onOpenGlobalSearch={() => setGlobalSearchModalOpen(true)}
        currentActiveTab={effectiveTab}
        onSelectTab={setActiveTab}
      />
      </ErrorBoundary>

      {/* Main Content Area */}
      <main key={viewDate ?? 'today'} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 pb-28 md:pb-6">
        <ViewDateBar />
        <ErrorBoundary fallbackTitle="بارگذاری این بخش با مشکل موقت مواجه شد">
          <ConfidentialGuard />
          <SyncStatusBadge />
          <Suspense fallback={<div className="py-16 text-center text-xs font-bold text-slate-400">در حال بارگذاری…</div>}>
          {/* Render Tab Views with strict role isolation */}
          {isTeacher || (currentUser.isAlsoTeacher && effectiveTab === 'teacher') ? (
            <TeacherDashboard
              onOpenNewAttendance={handleOpenNewAttendance}
              onOpenClassDetail={handleOpenClassDetail}
              onOpenMonthlySummary={handleOpenMonthlySummary}
              onEditSession={handleEditSession}
              onSelectStudent={handleOpenStudentProfile}
              onOpenAcademicGrades={handleOpenAcademicGrades}
            />
          ) : isNurturingVice || isCoach || effectiveTab === 'nurture' ? (
            <NurturingDashboard
              onOpenClassDetail={handleOpenClassDetail}
              onSelectStudent={handleOpenStudentProfile}
            />
          ) : effectiveTab === 'discipline' ? (
            <DisciplinaryDashboard
              onSelectStudent={handleOpenStudentProfile}
              onOpenClassDetail={handleOpenClassDetail}
              onOpenNewAttendance={handleOpenNewAttendance}
              onOpenAcademicGrades={handleOpenAcademicGrades}
              onOpenMonthlySummary={handleOpenMonthlySummary}
            />
          ) : effectiveTab === 'grades' ? (
            <EducationalDashboard
              onSelectStudent={handleOpenStudentProfile}
              onOpenAcademicGradesModal={handleOpenAcademicGrades}
              onOpenClassDetail={handleOpenClassDetail}
              onOpenNewAttendance={handleOpenNewAttendance}
              onOpenMonthlySummary={handleOpenMonthlySummary}
              onOpenNewClass={() => setAddClassModalOpen(true)}
              onOpenNewTeacher={() => setAddTeacherModalOpen(true)}
              onSelectTeacherForProfile={handleOpenTeacherProfile}
            />
          ) : (
            <AdminDashboard
              onOpenNewClass={() => setAddClassModalOpen(true)}
              onOpenNewTeacher={() => setAddTeacherModalOpen(true)}
              onOpenClassDetail={handleOpenClassDetail}
              onOpenNewAttendance={handleOpenNewAttendance}
              onOpenMonthlySummary={handleOpenMonthlySummary}
              onSelectStudent={handleOpenStudentProfile}
              onOpenAcademicGrades={handleOpenAcademicGrades}
              onOpenGlobalSearch={() => setGlobalSearchModalOpen(true)}
            />
          )}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Modals: خطا در یک پنجره‌ی بازشو نباید کل صفحه را سفید کند */}
      <ErrorBoundary fallbackTitle="بارگذاری این پنجره با مشکل مواجه شد">
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      <AttendanceModal
        isOpen={attendanceModalOpen}
        onClose={() => {
          setAttendanceModalOpen(false);
          setSessionToEdit(null);
          setResumeActive(false);
          clearActiveAttendance(currentUser.id);
        }}
        targetClassId={targetClassIdForAttendance}
        targetSubject={targetSubjectForAttendance}
        existingSession={sessionToEdit}
        onSelectStudent={handleOpenStudentProfile}
        resume={resumeActive ? resumeAttendance : null}
      />

      <ClassDetailModal
        isOpen={classDetailModalOpen}
        onClose={() => {
          setClassDetailModalOpen(false);
          setTargetClassForDetail(null);
        }}
        classData={targetClassForDetail}
        onOpenNewAttendance={handleOpenNewAttendance}
        onSelectStudent={handleOpenStudentProfile}
        onOpenAcademicGrades={handleOpenAcademicGrades}
      />

      <MonthlySummaryModal
        isOpen={monthlySummaryModalOpen}
        onClose={() => {
          setMonthlySummaryModalOpen(false);
          setTargetClassForSummary(undefined);
        }}
        initialClassId={targetClassForSummary}
        onSelectStudent={handleOpenStudentProfile}
      />

      <StudentProfileModal
        isOpen={studentProfileModalOpen}
        onClose={() => {
          setStudentProfileModalOpen(false);
          setSelectedStudentForProfile(null);
        }}
        student={selectedStudentForProfile}
        initialTab={profileInitialTab}
        onOpenAttendanceForClass={handleOpenNewAttendance}
        onOpenAcademicGrades={handleOpenAcademicGrades}
      />

      <AcademicGradesModal
        isOpen={academicGradesModalOpen}
        onClose={() => {
          setAcademicGradesModalOpen(false);
          setTargetClassForGrades(undefined);
          setTargetSubjectForGrades(undefined);
        }}
        initialClassId={targetClassForGrades}
        initialSubjectId={targetSubjectForGrades}
      />

      <AddClassModal
        isOpen={addClassModalOpen}
        onClose={() => setAddClassModalOpen(false)}
      />

      <AddTeacherModal
        isOpen={addTeacherModalOpen}
        onClose={() => setAddTeacherModalOpen(false)}
      />

      {/* Global Search Modal (Command Palette) */}
      <GlobalSearchModal
        isOpen={globalSearchModalOpen}
        onClose={() => setGlobalSearchModalOpen(false)}
        onSelectStudent={handleOpenStudentProfile}
        onOpenClassDetail={handleOpenClassDetail}
        onSelectTeacher={handleOpenTeacherProfile}
        onSelectCoach={handleOpenCoachProfile}
      />

      {/* Teacher Profile & Edit Modals */}
      <TeacherProfileModal
        isOpen={teacherProfileModalOpen}
        onClose={() => {
          setTeacherProfileModalOpen(false);
          setSelectedTeacherForProfile(null);
        }}
        teacher={selectedTeacherForProfile}
        onEdit={(teacher) => {
          setTeacherToEdit(teacher);
          setEditTeacherModalOpen(true);
        }}
      />

      <EditTeacherModal
        isOpen={editTeacherModalOpen}
        onClose={() => {
          setEditTeacherModalOpen(false);
          setTeacherToEdit(null);
        }}
        teacher={teacherToEdit}
      />

      {/* Coach Profile & Edit Modals */}
      <CoachProfileModal
        isOpen={coachProfileModalOpen}
        onClose={() => {
          setCoachProfileModalOpen(false);
          setSelectedCoachForProfile(null);
        }}
        coach={selectedCoachForProfile}
        onEdit={(coach) => {
          setCoachToEdit(coach);
          setEditCoachModalOpen(true);
        }}
        onSelectStudent={(studentId) => {
          const st = students.find((s) => s.id === studentId);
          if (st) handleOpenStudentProfile(st);
        }}
      />

      <EditCoachModal
        isOpen={editCoachModalOpen}
        onClose={() => {
          setEditCoachModalOpen(false);
          setCoachToEdit(null);
        }}
        coach={coachToEdit}
      />

      </ErrorBoundary>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-8 md:mt-12 py-6 mb-20 md:mb-0 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">مدرسه یاوران ولایت</span>
            <span>• سامانه هوشمند حضور و غیاب، مدیریت انضباطی و دفتر نمرات ۴ نوبته</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>سال تحصیلی {getActiveAcademicYear()}</span>
            <span>•</span>
            <button
              onClick={() => setLoginModalOpen(true)}
              className="text-emerald-600 font-bold hover:underline cursor-pointer"
            >
              ورود با نام کاربری و رمز
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

/**
 * دروازه احراز هویت: تا زمان ورود کاربر فقط فرم ورود نمایش داده می‌شود
 * و هیچ اطلاعاتی از سرور دریافت نمی‌گردد.
 */
const AuthGate: React.FC = () => {
  const { authStatus, reloadFromServer, mustChangePassword } = useSchool();
  useLuxScope(true); // ظاهر لوکس و حالت تاریک برای همه صفحه‌ها و نقش‌ها

  if (authStatus === 'ready' && mustChangePassword) {
    return <ForcePasswordChange />;
  }

  if (authStatus === 'ready') {
    return <MainApp />;
  }

  if (authStatus === 'guest') {
    return (
      <div className="min-h-screen font-['Vazirmatn',sans-serif]">
        <LoginModal isOpen onClose={() => undefined} />
      </div>
    );
  }

  return <BrandSplash offline={authStatus === 'offline'} onRetry={() => reloadFromServer()} />;
};

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="سامانه با خطای غیرمنتظره مواجه شد">
      <SchoolProvider>
        <AuthGate />
      </SchoolProvider>
    </ErrorBoundary>
  );
}

