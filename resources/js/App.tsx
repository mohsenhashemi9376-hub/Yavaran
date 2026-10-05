import React, { useState, useEffect, useRef } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from './utils/persianDate';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { Header } from './components/Header';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { DisciplinaryDashboard } from './components/DisciplinaryDashboard';
import { EducationalDashboard } from './components/EducationalDashboard';
import { NurturingDashboard } from './components/NurturingDashboard';
import { LoginModal } from './components/LoginModal';
import { AttendanceModal } from './components/AttendanceModal';
import { ClassDetailModal } from './components/ClassDetailModal';
import { MonthlySummaryModal } from './components/MonthlySummaryModal';
import { StudentProfileModal } from './components/StudentProfileModal';
import { AcademicGradesModal } from './components/AcademicGradesModal';
import { AddClassModal } from './components/AddClassModal';
import { AddTeacherModal } from './components/AddTeacherModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { TeacherProfileModal } from './components/TeacherProfileModal';
import { CoachProfileModal } from './components/CoachProfileModal';
import { EditTeacherModal } from './components/EditTeacherModal';
import { EditCoachModal } from './components/EditCoachModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { YavaranLogo } from './components/YavaranLogo';
import { SchoolClass, AttendanceSession, Student, User } from './types';
import { GraduationCap, Sparkles, CheckCircle2, Shield, Calendar, Users, ShieldAlert, BookOpen } from 'lucide-react';
import { getTodayShamsi } from './utils/persianDate';
import { useLuxScope } from './context/ThemeContext';

const MainApp: React.FC = () => {
  const { 
    currentUser, 
    students,
    isTeacher, 
    isAdmin, 
    isEducationalVice, 
    isDisciplinaryVice, 
    isNurturingVice,
    isCoach,
    isAdminOrVice 
  } = useSchool();
  
  const todayInfo = getTodayShamsi();

  // Active view tab: 'main' (Classes/Attendance), 'discipline' (Disciplinary VP), 'grades' (Educational VP), 'nurture' (Nurturing VP & Coach), 'teacher' (Coach acting as Teacher)
  const [activeTab, setActiveTab] = useState<'main' | 'discipline' | 'grades' | 'nurture' | 'teacher'>('main');
  const prevUserIdRef = useRef<string>('');

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
      if (isTeacher) {
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

  // Modal states
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [targetClassIdForAttendance, setTargetClassIdForAttendance] = useState<string | undefined>(undefined);
  const [targetSubjectForAttendance, setTargetSubjectForAttendance] = useState<string | undefined>(undefined);
  const [sessionToEdit, setSessionToEdit] = useState<AttendanceSession | null>(null);

  const [classDetailModalOpen, setClassDetailModalOpen] = useState(false);
  const [targetClassForDetail, setTargetClassForDetail] = useState<SchoolClass | null>(null);

  const [monthlySummaryModalOpen, setMonthlySummaryModalOpen] = useState(false);
  const [targetClassForSummary, setTargetClassForSummary] = useState<string | undefined>(undefined);

  const [studentProfileModalOpen, setStudentProfileModalOpen] = useState(false);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [profileInitialTab, setProfileInitialTab] = useState<'overview' | 'info' | 'attendance' | 'discipline' | 'grades'>('overview');

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

  // Global keyboard shortcut: Ctrl+K or Cmd+K for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Modal triggers
  const handleOpenNewAttendance = (classId?: string, subject?: string) => {
    setTargetSubjectForAttendance(subject);
    // پنجره جزئیات کلاس باید بسته شود تا فهرست حضور و غیاب بلافاصله دیده شود
    setClassDetailModalOpen(false);
    setTargetClassForDetail(null);
    setSessionToEdit(null);
    setTargetClassIdForAttendance(classId);
    setAttendanceModalOpen(true);
  };

  const handleEditSession = (session: AttendanceSession) => {
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
      <Header
        onOpenNewClassModal={() => setAddClassModalOpen(true)}
        onOpenNewTeacherModal={() => setAddTeacherModalOpen(true)}
        onOpenAcademicGrades={() => handleOpenAcademicGrades()}
        onOpenLoginModal={() => setLoginModalOpen(true)}
        onOpenGlobalSearch={() => setGlobalSearchModalOpen(true)}
        currentActiveTab={effectiveTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 pb-28 md:pb-6">
        <ErrorBoundary fallbackTitle="بارگذاری این بخش با مشکل موقت مواجه شد">
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
        </ErrorBoundary>
      </main>

      {/* Modals */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      <AttendanceModal
        isOpen={attendanceModalOpen}
        onClose={() => {
          setAttendanceModalOpen(false);
          setSessionToEdit(null);
        }}
        targetClassId={targetClassIdForAttendance}
        targetSubject={targetSubjectForAttendance}
        existingSession={sessionToEdit}
        onSelectStudent={handleOpenStudentProfile}
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
  const { authStatus, reloadFromServer } = useSchool();
  useLuxScope(true); // ظاهر لوکس و حالت تاریک برای همه صفحه‌ها و نقش‌ها

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-5 font-['Vazirmatn',sans-serif] p-6 text-center">
      <YavaranLogo size="xl" />
      <div className="text-sm font-black text-slate-800">مدرسه یاوران ولایت</div>
      {authStatus === 'offline' ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.</p>
          <button
            type="button"
            onClick={() => reloadFromServer()}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            تلاش مجدد
          </button>
        </div>
      ) : (
        <div className="w-8 h-8 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
      )}
    </div>
  );
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

