import { subjectAppliesToClass } from '../utils/courseAssignments';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  User, 
  SchoolClass, 
  Student, 
  AttendanceSession, 
  AcademicSubject, 
  StudentAcademicGrade, 
  DisciplinaryNote, 
  DisciplinaryStatus, 
  MorningDelayRecord,
  MorningAttendanceRecord,
  SchoolAbsenceRecord,
  StudentObservation,
  StudentNurturingDossier,
  NurturingSectionKey,
  DossierSectionEntry,
  CoachGrowthEvaluation,
  TeacherEvaluation,
  SchoolAnnouncement,
  BellPeriod,
  SchoolSettings,
  SchoolGradeItem,
  ComprehensiveExamRecord,
  CourseAssignment,
} from '../types';
import { ToastNotification, GlobalConfirmModal } from '../components/FeedbackSystem';
import { 
  INITIAL_USERS, 
  INITIAL_CLASSES, 
  INITIAL_STUDENTS, 
  INITIAL_SESSIONS, 
  INITIAL_ACADEMIC_SUBJECTS, 
  JUNIOR_HIGH_STANDARD_SUBJECTS,
  INITIAL_ACADEMIC_GRADES,
  INITIAL_MORNING_DELAYS,
  INITIAL_SCHOOL_ABSENCES,
  INITIAL_OBSERVATIONS,
  INITIAL_NURTURING_DOSSIERS,
  INITIAL_COACH_EVALUATIONS,
  INITIAL_TEACHER_EVALUATIONS,
  INITIAL_SCHOOL_ANNOUNCEMENTS,
  INITIAL_BELL_PERIODS,
  INITIAL_SCHOOL_SETTINGS,
  INITIAL_SCHOOL_GRADES
} from '../utils/sampleData';
import { toEnglishDigits, tehranNow, setServerClock, setActiveAcademicYear, getTodayShamsi } from '../utils/persianDate';
import { delayFromEntryTime } from '../utils/morningAttendance';
import { SyncEngine, apiRequest, ApiError, BootstrapPayload, SyncRow } from '../lib/serverSync';

interface SchoolContextType {
  currentUser: User;
  allUsers: User[];
  users: User[];
  allTeachers: User[];
  allCoaches: User[];
  classes: SchoolClass[];
  students: Student[];
  sessions: AttendanceSession[];
  academicSubjects: AcademicSubject[];
  academicGrades: StudentAcademicGrade[];
  morningDelays: MorningDelayRecord[];
  morningAttendance: MorningAttendanceRecord[];
  /** تغییر وضعیت با یک ضربه: غایب ⇄ حاضر (با ثبت خودکار ساعت ورود و محاسبه تأخیر نسبت به ۰۷:۰۰) */
  toggleMorningAttendance: (student: Student) => void;
  /** اصلاح دستی دقیقه تأخیر صبحگاه */
  setMorningDelayMinutes: (recordId: string, minutes: number) => void;
  /** تأیید پیگیری غیبت/تأخیر (is_acknowledged = true) */
  acknowledgeMorningRecord: (student: Student, kind: 'absence' | 'delay') => void;
  schoolAbsences: SchoolAbsenceRecord[];
  observations: StudentObservation[];
  nurturingDossiers: Record<string, StudentNurturingDossier>;
  coachEvaluations: CoachGrowthEvaluation[];
  teacherEvaluations: TeacherEvaluation[];
  schoolAnnouncements: SchoolAnnouncement[];
  comprehensiveExams: ComprehensiveExamRecord[];
  saveComprehensiveExam: (record: ComprehensiveExamRecord) => void;
  courseAssignments: CourseAssignment[];
  /** انتساب (یا لغو انتساب با teacherId=null) استاد به یک درس در یک کلاس */
  assignCourseTeacher: (classId: string, subjectId: string, teacherId: string | null) => void;
  /** تمام کاربران فعال کادر مدرسه برای انتخاب استاد درس */
  assignableStaff: User[];
  /** استاد مؤثر هر (کلاس، درس) */
  getCourseTeacherId: (classId: string, subjectId: string) => string | undefined;
  bellPeriods: BellPeriod[];
  
  // School Settings & Academic Base Structure
  schoolSettings: SchoolSettings;
  updateSchoolSettings: (updated: Partial<SchoolSettings>) => void;
  updateAcademicYear: (newYear: string) => void;
  grades: SchoolGradeItem[];
  addGrade: (name: string, stage?: string) => string;
  updateGrade: (id: string, updated: Partial<SchoolGradeItem>) => void;
  toggleGradeStatus: (id: string) => void;
  deleteGrade: (id: string) => boolean;

  // Generalized User Management
  addUser: (user: Omit<User, 'id'>) => string;
  updateUser: (id: string, updated: Partial<User>) => void;
  deleteUser: (id: string) => boolean;

  // Auth state
  isAuthenticated: boolean;
  authStatus: 'loading' | 'guest' | 'ready' | 'offline';
  reloadFromServer: () => Promise<void>;
  login: (username: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;

  // Role & Scope Helpers
  isTeacher: boolean;
  isAdmin: boolean;
  isEducationalVice: boolean;
  isDisciplinaryVice: boolean;
  isNurturingVice: boolean;
  isCoach: boolean;
  isNurturingTeam: boolean;
  isAdminOrVice: boolean;
  isVicePrincipal: boolean;
  accessibleClasses: SchoolClass[];
  accessibleSessions: AttendanceSession[];
  teachingAccessibleClasses: SchoolClass[];
  teachingAccessibleSessions: AttendanceSession[];
  canTeachClassAndSubject: (classId: string, subjectNameOrId?: string) => boolean;
  
  // Actions
  addClass: (newClass: Omit<SchoolClass, 'id'>) => string;
  updateClass: (id: string, updatedData: Partial<SchoolClass>) => void;
  deleteClass: (id: string) => boolean;
  
  addStudent: (newStudent: Omit<Student, 'id'>) => string;
  addStudentsBatch: (classId: string, fullNames: string[]) => void;
  updateStudent: (id: string, updatedData: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  purgeStudentsAndStaff: () => void;
  removeStudentFromClass: (studentId: string) => void;
  transferStudentClass: (studentId: string, newClassId: string) => void;
  assignStudentToClass: (studentId: string, classId: string) => void;
  
  // Disciplinary Actions (معاونت انضباطی)
  addDisciplinaryNote: (studentId: string, note: Omit<DisciplinaryNote, 'id'>) => void;
  updateStudentDiscipline: (studentId: string, score: number, status?: DisciplinaryStatus) => void;
  deleteDisciplinaryNote: (studentId: string, noteId: string) => void;

  // Morning & School Entrance Delays (ثبت و مدیریت تاخیرهای ورود به مدرسه)
  addMorningDelay: (delay: Omit<MorningDelayRecord, 'id' | 'createdAt'>) => string;
  updateMorningDelay: (id: string, updatedData: Partial<MorningDelayRecord>) => void;
  deleteMorningDelay: (id: string) => void;
  addMorningDelaysBatch: (records: Omit<MorningDelayRecord, 'id' | 'createdAt'>[]) => void;

  // School Absences (ثبت و مدیریت غیبت در مدرسه)
  addSchoolAbsence: (absence: Omit<SchoolAbsenceRecord, 'id' | 'createdAt'>) => string;
  updateSchoolAbsence: (id: string, updatedData: Partial<SchoolAbsenceRecord>) => void;
  deleteSchoolAbsence: (id: string) => void;
  addSchoolAbsencesBatch: (records: Omit<SchoolAbsenceRecord, 'id' | 'createdAt'>[]) => void;

  addTeacher: (teacher: Omit<User, 'id' | 'role'>) => string;
  updateTeacher: (id: string, updatedData: Partial<User>) => void;
  updateTeacherCredentials: (teacherId: string, username: string, password: string, assignedClassIds?: string[]) => void;
  deleteTeacher: (id: string) => boolean;

  // Coaches / Mentors Actions (مربیان یاوران ولایت)
  addCoach: (coach: Omit<User, 'id' | 'role'>) => string;
  updateCoach: (id: string, updatedData: Partial<User>) => void;
  deleteCoach: (id: string) => boolean;
  
  saveAttendanceSession: (session: Omit<AttendanceSession, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => string;
  deleteAttendanceSession: (id: string) => void;

  // Official Term Grades Actions (معاونت آموزش)
  saveAcademicGrade: (grade: StudentAcademicGrade) => void;
  saveBatchAcademicGrades: (grades: StudentAcademicGrade[]) => void;
  deleteAcademicGrade: (id: string) => void;
  addAcademicSubject: (subject: Omit<AcademicSubject, 'id'>) => string;
  updateAcademicSubject: (id: string, updated: Partial<AcademicSubject>) => void;
  assignTeacherToSubject: (subjectId: string, teacherId: string | null, teacherName?: string) => void;
  deleteAcademicSubject: (id: string) => void;
  resetSubjectsToJuniorHighStandards: () => void;
  getStudentAcademicGrades: (studentId: string) => StudentAcademicGrade[];
  
  // Nurturing & Counseling Actions (معاونت تربیتی)
  addStudentObservation: (obs: Omit<StudentObservation, 'id' | 'createdAt'>) => string;
  updateStudentObservation: (id: string, updated: Partial<StudentObservation>) => void;
  deleteStudentObservation: (id: string) => void;
  getStudentObservations: (studentId: string) => StudentObservation[];
  getStudentNurturingDossier: (studentId: string) => StudentNurturingDossier;
  saveDossierSectionEntry: (studentId: string, sectionKey: NurturingSectionKey, entry: Omit<DossierSectionEntry, 'id' | 'createdAt'> & { id?: string }) => string;
  deleteDossierSectionEntry: (studentId: string, sectionKey: NurturingSectionKey, entryId: string) => void;
  updateTemperamentOverview: (studentId: string, dominantType?: string, physicalTraits?: string, behavioralTraits?: string) => void;
  updateNurturingSummaryOverview: (studentId: string, overallSummary?: string, strengths?: string[], growthOpportunities?: string[]) => void;

  // Coach Developmental Evaluations (ارزیابی‌های رشدی-تربیتی مربیان یاوران ولایت)
  saveCoachEvaluation: (evaluation: Omit<CoachGrowthEvaluation, 'id' | 'createdAt'> & { id?: string }) => string;
  deleteCoachEvaluation: (id: string) => void;
  getStudentCoachEvaluations: (studentId: string) => CoachGrowthEvaluation[];

  // Teacher Evaluation & Growth (ارتباط و ارتقاء اساتید توسط معاونت آموزش)
  saveTeacherEvaluation: (evaluation: Omit<TeacherEvaluation, 'id' | 'createdAt'> & { id?: string }) => string;
  deleteTeacherEvaluation: (id: string) => void;
  getTeacherEvaluations: (teacherId: string) => TeacherEvaluation[];

  // Bell Periods & Default Class Schedule (ساعات و زنگ‌های مصوب مدرسه)
  updateBellPeriod: (id: string, updated: Partial<BellPeriod>) => void;
  addBellPeriod: (period: Omit<BellPeriod, 'id'>) => string;
  deleteBellPeriod: (id: string) => void;
  resetBellPeriodsToDefault: () => void;
  getBellPeriodById: (id: string) => BellPeriod | undefined;
  getCurrentOrNextBellPeriod: () => BellPeriod;

  // School Public Announcements (اطلاعیه‌های عمومی مدرسه یاوران ولایت)
  addSchoolAnnouncement: (announcement: Omit<SchoolAnnouncement, 'id' | 'createdAt'>) => string;
  deleteSchoolAnnouncement: (id: string) => void;
  updateSchoolAnnouncement: (id: string, updates: Partial<SchoolAnnouncement>) => void;

  resetToDemoData: () => void;
  exportDatabaseJson: () => void;
  importDatabaseJson: (jsonData: string) => boolean;

  // Feedback Toast & Confirmation System (راهنمای کاربر و بازخورد عملیات)
  toast: { id: string; message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (messageOrTitle: string, messageOrType?: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  confirmDialog: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    isDangerous?: boolean;
  } | null;
  showConfirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    isDangerous?: boolean;
  }) => void;
  closeConfirm: () => void;
}

const STORAGE_KEY = 'school_attendance_system_v1';

// کاربر موقت پیش از ورود (برای جلوگیری از خطای رندر)
const GUEST_USER: User = {
  id: 'guest',
  username: '',
  name: '',
  role: 'teacher',
  roleTitle: '',
  assignedClassIds: [],
};

// تبدیل ساختارهای غیرآرایه‌ای به ردیف‌های قابل ذخیره در دیتابیس
const dossiersToRows = (record: Record<string, StudentNurturingDossier>): SyncRow[] =>
  Object.keys(record).map((key) => ({ ...(record[key] as unknown as Record<string, unknown>), id: key }) as SyncRow);

const rowsToDossiers = (rows: SyncRow[]): Record<string, StudentNurturingDossier> => {
  const result: Record<string, StudentNurturingDossier> = {};
  rows.forEach((row) => {
    result[row.id] = row as unknown as StudentNurturingDossier;
  });
  return result;
};

const settingsToRows = (settings: SchoolSettings): SyncRow[] => [
  { ...(settings as unknown as Record<string, unknown>), id: 'default' } as SyncRow,
];

const rowsToSettings = (rows: SyncRow[]): SchoolSettings => {
  if (!rows.length) return INITIAL_SCHOOL_SETTINGS;
  const { id: _id, ...rest } = rows[0];
  return rest as unknown as SchoolSettings;
};

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ------------------------------------------------------------------
  // وضعیت داده‌ها — منبع اصلی داده، دیتابیس سرور (Laravel/MySQL) است
  // ------------------------------------------------------------------
  const [authStatus, setAuthStatus] = useState<'loading' | 'guest' | 'ready' | 'offline'>('loading');
  const isAuthenticated = authStatus === 'ready';
  const [rawUsers, setAllUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [rawClasses, setClasses] = useState<SchoolClass[]>([]);
  const [bellPeriods, setBellPeriods] = useState<BellPeriod[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [academicSubjects, setAcademicSubjects] = useState<AcademicSubject[]>([]);
  const [academicGrades, setAcademicGrades] = useState<StudentAcademicGrade[]>([]);
  const [morningDelays, setMorningDelays] = useState<MorningDelayRecord[]>([]);
  const [morningAttendance, setMorningAttendance] = useState<MorningAttendanceRecord[]>([]);
  const [schoolAbsences, setSchoolAbsences] = useState<SchoolAbsenceRecord[]>([]);
  const [observations, setObservations] = useState<StudentObservation[]>([]);
  const [nurturingDossiers, setNurturingDossiers] = useState<Record<string, StudentNurturingDossier>>({});
  const [coachEvaluations, setCoachEvaluations] = useState<CoachGrowthEvaluation[]>([]);
  const [teacherEvaluations, setTeacherEvaluations] = useState<TeacherEvaluation[]>([]);
  const [schoolAnnouncements, setSchoolAnnouncements] = useState<SchoolAnnouncement[]>([]);
  const [comprehensiveExams, setComprehensiveExams] = useState<ComprehensiveExamRecord[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<CourseAssignment[]>([]);

  // ------------------------------------------------------------------
  // انتساب آموزشی سه‌طرفه (کلاس + درس + استاد) — مستقل از مربی تربیتی کلاس
  // درس، کلاس‌های تدریس و دسترسی آموزشی هر کاربر فقط از «برنامه دروس» استخراج می‌شود.
  // ------------------------------------------------------------------
  /** نگاشت «کلاس|درس» ← شناسه استاد (انتساب صریح، سپس دبیر پیش‌فرض درس) */
  const effectiveCourses = useMemo(() => {
    const explicit = new Map<string, string>();
    courseAssignments.forEach((a) => explicit.set(`${a.classId}|${a.subjectId}`, a.teacherId));
    const list: { classId: string; subjectId: string; subjectName: string; teacherId: string }[] = [];
    rawClasses.forEach((cls) => {
      academicSubjects.forEach((sub) => {
        const key = `${cls.id}|${sub.id}`;
        const teacherId = explicit.get(key) ?? (subjectAppliesToClass(sub, cls) ? sub.teacherId : undefined);
        if (teacherId) list.push({ classId: cls.id, subjectId: sub.id, subjectName: sub.name, teacherId });
      });
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawClasses, academicSubjects, courseAssignments]);

  const allUsers = useMemo<User[]>(
    () =>
      rawUsers.map((u) => {
        const mine = effectiveCourses.filter((c) => c.teacherId === u.id);
        const bySubject = new Map<string, { subjectId: string; subjectName: string; classIds: string[] }>();
        mine.forEach((c) => {
          const cur = bySubject.get(c.subjectId) || { subjectId: c.subjectId, subjectName: c.subjectName, classIds: [] };
          cur.classIds.push(c.classId);
          bySubject.set(c.subjectId, cur);
        });
        const assignments = Array.from(bySubject.values());
        const names = assignments.map((a) => a.subjectName);
        const subject = names.length ? Array.from(new Set(names)).join('، ') : undefined;
        const classIds = Array.from(new Set(mine.map((c) => c.classId)));

        if (u.role === 'teacher') {
          return {
            ...u,
            subject,
            subjectSpecialty: subject,
            roleTitle: subject ? `دبیر ${subject}` : 'استاد و دبیر',
            assignedClassIds: Array.from(new Set([...(u.assignedClassIds || []), ...classIds])),
            teachingClassIds: classIds,
            teachingAssignments: assignments.map((a) => ({ id: `ta-${u.id}-${a.subjectId}`, ...a })),
            teachingSubject: subject,
          };
        }
        if (assignments.length === 0) return u;
        // سایر نقش‌ها (مدیر، معاون، مربی): ادغام با انتساب‌های قدیمی مربی
        const legacy = (u.teachingAssignments || []).filter((ta) => !bySubject.has(ta.subjectId || ''));
        return {
          ...u,
          isAlsoTeacher: true,
          subject: u.subject || subject,
          teachingSubject: subject,
          teachingClassIds: Array.from(new Set([...(u.teachingClassIds || []), ...classIds])),
          teachingAssignments: [
            ...legacy,
            ...assignments.map((a) => ({ id: `ta-${u.id}-${a.subjectId}`, ...a })),
          ],
        };
      }),
    [rawUsers, effectiveCourses]
  );

  const classes = useMemo<SchoolClass[]>(
    () =>
      rawClasses.map((raw) => {
        // فقط نام خالص کلاس (بدون عبارت داخل پرانتز)
        const cleaned = (raw.name || '').replace(/\s*[(（][^)）]*[)）]\s*/g, ' ').replace(/\s+/g, ' ').trim();
        const c = cleaned && cleaned !== raw.name ? { ...raw, name: cleaned } : raw;
        const extra = effectiveCourses.filter((e) => e.classId === c.id).map((e) => e.teacherId);
        if (extra.length === 0) return c;
        return { ...c, teacherIds: Array.from(new Set([...(c.teacherIds || []), ...extra])) };
      }),
    [rawClasses, effectiveCourses]
  );

  const assignableStaff = useMemo(
    () =>
      allUsers
        .filter((u) => u.isActive !== false)
        .sort((a, b) => a.name.localeCompare(b.name, 'fa')),
    [allUsers]
  );

  const getCourseTeacherId = (classId: string, subjectId: string): string | undefined =>
    effectiveCourses.find((c) => c.classId === classId && c.subjectId === subjectId)?.teacherId;

  const assignCourseTeacher = (classId: string, subjectId: string, teacherId: string | null) => {
    setCourseAssignments((prev) => {
      const rest = prev.filter((a) => !(a.classId === classId && a.subjectId === subjectId));
      if (!teacherId) return rest;
      return [...rest, { id: `ca-${classId}-${subjectId}`, classId, subjectId, teacherId }];
    });
    // اگر دبیر پیش‌فرض درس داشته و لغو شد، انتساب صریح خالی لازم نیست؛ لغو یعنی حذف انتساب کلاس
    if (!teacherId) {
      const sub = academicSubjects.find((x) => x.id === subjectId);
      if (sub?.teacherId) {
        // پیش‌فرض سراسری درس را برای سایر کلاس‌ها نگه می‌داریم و فقط این کلاس را مستثنی می‌کنیم
        showToast('این کلاس از دبیر پیش‌فرض درس مستثنی نشد؛ برای تغییر، استاد دیگری انتخاب کنید.', 'info');
      }
    }
  };
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(INITIAL_SCHOOL_SETTINGS);
  const [grades, setGrades] = useState<SchoolGradeItem[]>([]);

  const authStatusRef = useRef(authStatus);
  authStatusRef.current = authStatus;
  const lastRefreshRef = useRef<number>(0);
  const syncErrorHandlerRef = useRef<(error: ApiError) => void>(() => undefined);
  const syncRef = useRef<SyncEngine | null>(null);
  if (!syncRef.current) {
    syncRef.current = new SyncEngine((error) => syncErrorHandlerRef.current(error));
  }
  const syncEngine = syncRef.current;

  const applyServerData = useCallback((payload: BootstrapPayload) => {
    const d = (payload.data || {}) as NonNullable<BootstrapPayload['data']>;
    const nextUsers = (d.users || []) as unknown as User[];
    const nextClasses = (d.classes || []) as unknown as SchoolClass[];
    const nextBells = (d.bellPeriods || []) as unknown as BellPeriod[];
    const nextStudents = (d.students || []) as unknown as Student[];
    const nextSessions = (d.sessions || []) as unknown as AttendanceSession[];
    const nextSubjects = (d.academicSubjects || []) as unknown as AcademicSubject[];
    const nextAcademicGrades = (d.academicGrades || []) as unknown as StudentAcademicGrade[];
    const nextDelays = (d.morningDelays || []) as unknown as MorningDelayRecord[];
    const nextMorningAttendance = (d.morningAttendance || []) as unknown as MorningAttendanceRecord[];
    const nextAbsences = (d.schoolAbsences || []) as unknown as SchoolAbsenceRecord[];
    const nextObservations = (d.observations || []) as unknown as StudentObservation[];
    const nextDossiers = rowsToDossiers(d.nurturingDossiers || []);
    const nextCoachEvals = (d.coachEvaluations || []) as unknown as CoachGrowthEvaluation[];
    const nextTeacherEvals = (d.teacherEvaluations || []) as unknown as TeacherEvaluation[];
    const nextAnnouncements = (d.schoolAnnouncements || []) as unknown as SchoolAnnouncement[];
    const nextExams = (d.comprehensiveExams || []) as unknown as ComprehensiveExamRecord[];
    const nextCourseAssignments = (d.courseAssignments || []) as unknown as CourseAssignment[];
    const nextGrades = (d.grades || []) as unknown as SchoolGradeItem[];
    const nextSettings = rowsToSettings(d.settings || []);

    syncEngine.reset({
      users: nextUsers as unknown as SyncRow[],
      classes: nextClasses as unknown as SyncRow[],
      bellPeriods: nextBells as unknown as SyncRow[],
      students: nextStudents as unknown as SyncRow[],
      sessions: nextSessions as unknown as SyncRow[],
      academicSubjects: nextSubjects as unknown as SyncRow[],
      academicGrades: nextAcademicGrades as unknown as SyncRow[],
      morningDelays: nextDelays as unknown as SyncRow[],
      morningAttendance: nextMorningAttendance as unknown as SyncRow[],
      schoolAbsences: nextAbsences as unknown as SyncRow[],
      observations: nextObservations as unknown as SyncRow[],
      nurturingDossiers: dossiersToRows(nextDossiers),
      coachEvaluations: nextCoachEvals as unknown as SyncRow[],
      teacherEvaluations: nextTeacherEvals as unknown as SyncRow[],
      schoolAnnouncements: nextAnnouncements as unknown as SyncRow[],
      comprehensiveExams: nextExams as unknown as SyncRow[],
      courseAssignments: nextCourseAssignments as unknown as SyncRow[],
      grades: nextGrades as unknown as SyncRow[],
      settings: settingsToRows(nextSettings),
    });

    setAllUsers(nextUsers);
    setClasses(nextClasses);
    setBellPeriods(nextBells);
    setStudents(nextStudents);
    setSessions(nextSessions);
    setAcademicSubjects(nextSubjects);
    setAcademicGrades(nextAcademicGrades);
    setMorningDelays(nextDelays);
    setMorningAttendance(nextMorningAttendance);
    setSchoolAbsences(nextAbsences);
    setObservations(nextObservations);
    setNurturingDossiers(nextDossiers);
    setCoachEvaluations(nextCoachEvals);
    setTeacherEvaluations(nextTeacherEvals);
    setSchoolAnnouncements(nextAnnouncements);
    setComprehensiveExams(nextExams);
    setCourseAssignments(nextCourseAssignments);
    setGrades(nextGrades);
    setSchoolSettings(nextSettings);
    if (typeof payload.serverTime === 'number') setServerClock(payload.serverTime);
    setCurrentUserId(payload.userId || '');
    lastRefreshRef.current = Date.now();
    setAuthStatus('ready');
  }, [syncEngine]);

  const resetClientState = useCallback(() => {
    syncEngine.clear();
    setAllUsers([]);
    setCurrentUserId('');
    setClasses([]);
    setBellPeriods([]);
    setStudents([]);
    setSessions([]);
    setAcademicSubjects([]);
    setAcademicGrades([]);
    setMorningDelays([]);
    setMorningAttendance([]);
    setSchoolAbsences([]);
    setObservations([]);
    setNurturingDossiers({});
    setCoachEvaluations([]);
    setTeacherEvaluations([]);
    setSchoolAnnouncements([]);
    setComprehensiveExams([]);
    setCourseAssignments([]);
    setGrades([]);
    setSchoolSettings(INITIAL_SCHOOL_SETTINGS);
  }, [syncEngine]);

  /** دریافت کامل اطلاعات از سرور؛ در حالت بروزرسانی پس‌زمینه، اگر در این فاصله تغییری ثبت شده باشد نتیجه نادیده گرفته می‌شود */
  const loadFromServer = useCallback(async (background: boolean = false): Promise<void> => {
    const versionBefore = syncEngine.version;
    try {
      const payload = await apiRequest<BootstrapPayload>('GET', '/api/bootstrap');
      if (background && (versionBefore !== syncEngine.version || !syncEngine.isIdle)) return;
      if (payload && payload.authenticated && payload.data) {
        applyServerData(payload);
      } else {
        resetClientState();
        setAuthStatus('guest');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setAuthStatus((prev) => (prev === 'ready' ? 'ready' : 'offline'));
      } else if (!background) {
        resetClientState();
        setAuthStatus('guest');
      }
    }
  }, [applyServerData, resetClientState, syncEngine]);

  const reloadFromServer = useCallback(() => loadFromServer(false), [loadFromServer]);

  // بارگذاری اولیه اطلاعات
  useEffect(() => {
    loadFromServer(false);
  }, [loadFromServer]);

  // بروزرسانی خودکار هنگام بازگشت به برنامه (همگام‌سازی بین کاربران)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (authStatusRef.current !== 'ready' || !syncEngine.isIdle) return;
      if (Date.now() - lastRefreshRef.current < 60_000) return;
      loadFromServer(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [loadFromServer, syncEngine]);

  // هشدار خروج در صورت وجود تغییرات ارسال‌نشده
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!syncEngine.isIdle) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncEngine]);

  // ذخیره خودکار تغییرات در دیتابیس سرور
  useEffect(() => { syncEngine.push('settings', settingsToRows(schoolSettings)); }, [schoolSettings, syncEngine]);
  useEffect(() => { syncEngine.push('grades', grades as unknown as SyncRow[]); }, [grades, syncEngine]);
  useEffect(() => { syncEngine.push('users', rawUsers as unknown as SyncRow[]); }, [rawUsers, syncEngine]);
  useEffect(() => { syncEngine.push('classes', rawClasses as unknown as SyncRow[]); }, [rawClasses, syncEngine]);
  useEffect(() => { syncEngine.push('students', students as unknown as SyncRow[]); }, [students, syncEngine]);
  useEffect(() => { syncEngine.push('sessions', sessions as unknown as SyncRow[]); }, [sessions, syncEngine]);
  useEffect(() => { syncEngine.push('academicSubjects', academicSubjects as unknown as SyncRow[]); }, [academicSubjects, syncEngine]);
  useEffect(() => { syncEngine.push('academicGrades', academicGrades as unknown as SyncRow[]); }, [academicGrades, syncEngine]);
  useEffect(() => { syncEngine.push('morningDelays', morningDelays as unknown as SyncRow[]); }, [morningDelays, syncEngine]);
  useEffect(() => { syncEngine.push('morningAttendance', morningAttendance as unknown as SyncRow[]); }, [morningAttendance, syncEngine]);
  useEffect(() => { syncEngine.push('schoolAbsences', schoolAbsences as unknown as SyncRow[]); }, [schoolAbsences, syncEngine]);
  useEffect(() => { syncEngine.push('observations', observations as unknown as SyncRow[]); }, [observations, syncEngine]);
  useEffect(() => { syncEngine.push('nurturingDossiers', dossiersToRows(nurturingDossiers)); }, [nurturingDossiers, syncEngine]);
  useEffect(() => { syncEngine.push('coachEvaluations', coachEvaluations as unknown as SyncRow[]); }, [coachEvaluations, syncEngine]);
  useEffect(() => { syncEngine.push('teacherEvaluations', teacherEvaluations as unknown as SyncRow[]); }, [teacherEvaluations, syncEngine]);
  useEffect(() => { syncEngine.push('schoolAnnouncements', schoolAnnouncements as unknown as SyncRow[]); }, [schoolAnnouncements, syncEngine]);
  useEffect(() => { syncEngine.push('courseAssignments', courseAssignments as unknown as SyncRow[]); }, [courseAssignments, syncEngine]);
  useEffect(() => { syncEngine.push('comprehensiveExams', comprehensiveExams as unknown as SyncRow[]); }, [comprehensiveExams, syncEngine]);
  useEffect(() => { syncEngine.push('bellPeriods', bellPeriods as unknown as SyncRow[]); }, [bellPeriods, syncEngine]);

  // Toast & Confirm System
  const [toast, setToast] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const lastToastRef = React.useRef<{ message: string; time: number } | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    isDangerous?: boolean;
  } | null>(null);

  const showToast = (arg1: string, arg2?: string | 'success' | 'error' | 'info', arg3?: 'success' | 'error' | 'info') => {
    let message = arg1;
    let type: 'success' | 'error' | 'info' = 'success';

    if (arg3 !== undefined) {
      message = arg2 ? `${arg1}: ${arg2}` : arg1;
      type = arg3;
    } else if (arg2 === 'success' || arg2 === 'error' || arg2 === 'info') {
      message = arg1;
      type = arg2;
    } else if (typeof arg2 === 'string' && arg2.trim()) {
      message = `${arg1}: ${arg2}`;
      type = 'success';
    }

    // Deduplicate identical toasts fired within 1500ms
    const now = Date.now();
    if (lastToastRef.current && lastToastRef.current.message === message && (now - lastToastRef.current.time) < 1500) {
      return;
    }
    lastToastRef.current = { message, time: now };

    setToast({ id: String(now), message, type });
  };

  const hideToast = () => {
    setToast(null);
  };

  const showConfirm = (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    isDangerous?: boolean;
  }) => {
    setConfirmDialog({
      isOpen: true,
      ...options,
    });
  };

  const closeConfirm = () => {
    setConfirmDialog(null);
  };

  // در صورت خطای ذخیره‌سازی، پیام نمایش داده شده و داده‌ها از سرور بازخوانی می‌شوند
  syncErrorHandlerRef.current = (error: ApiError) => {
    showToast(error.message, 'error');
    if (error.status === 401 || error.status === 419) {
      resetClientState();
      setAuthStatus('guest');
      return;
    }
    if (error.status !== 0) {
      loadFromServer(false);
    }
  };

  // Current User Object & Roles
  const currentUser = allUsers.find((u) => u.id === currentUserId) || allUsers[0] || GUEST_USER;
  const isTeacher = currentUser.role === 'teacher';
  const isAdmin = currentUser.role === 'admin';
  const isEducationalVice = currentUser.role === 'vice_educational' || currentUser.role === 'vice_principal';
  const isDisciplinaryVice = currentUser.role === 'vice_disciplinary' || currentUser.role === 'vice_principal';
  const isNurturingVice = currentUser.role === 'vice_nurturing';
  const isCoach = currentUser.role === 'coach';
  const isNurturingTeam = isNurturingVice || isCoach;
  const isAdminOrVice = isAdmin || isEducationalVice || isDisciplinaryVice || isNurturingVice;
  const isVicePrincipal = isEducationalVice || isDisciplinaryVice || isNurturingVice;

  const allTeachers = allUsers.filter((u) => u.role === 'teacher' || Boolean(u.isAlsoTeacher));
  const allCoaches = allUsers.filter((u) => u.role === 'coach');

  const accessibleClasses = isTeacher
    ? classes.filter(
        (c) =>
          currentUser.assignedClassIds.includes(c.id) ||
          c.teacherIds.includes(currentUser.id)
      )
    : isCoach
    ? classes.filter(
        (c) =>
          currentUser.assignedClassIds.includes(c.id) ||
          (currentUser.isAlsoTeacher && (
            (currentUser.teachingClassIds && currentUser.teachingClassIds.includes(c.id)) ||
            c.teacherIds.includes(currentUser.id)
          ))
      )
    : classes;

  const accessibleClassIds = new Set(accessibleClasses.map((c) => c.id));

  const accessibleSessions = isTeacher
    ? sessions.filter(
        (s) =>
          accessibleClassIds.has(s.classId) &&
          (s.teacherId === currentUser.id || currentUser.assignedClassIds.includes(s.classId))
      )
    : isCoach && currentUser.isAlsoTeacher
    ? sessions.filter(
        (s) =>
          s.teacherId === currentUser.id ||
          (currentUser.teachingClassIds && currentUser.teachingClassIds.includes(s.classId))
      )
    : sessions;

  // Classes where current user is authorized to teach (strictly for Educational/Teacher panel)
  // کاربران غیر دبیر (مدیر، معاون، مربی) که درسی به آن‌ها واگذار شده نیز پنل آموزشی دارند
  const hasTeachingLoad =
    !isTeacher &&
    (Boolean(currentUser.isAlsoTeacher) ||
      (currentUser.teachingClassIds || []).length > 0 ||
      (currentUser.teachingAssignments || []).some((ta) => ta.classIds.length > 0));

  const teachingAccessibleClasses = isTeacher
    ? classes.filter(
        (c) =>
          currentUser.assignedClassIds.includes(c.id) ||
          c.teacherIds.includes(currentUser.id)
      )
    : hasTeachingLoad
    ? classes.filter((c) => {
        const directClassIds = currentUser.teachingClassIds || [];
        const assignmentClassIds = (currentUser.teachingAssignments || []).flatMap((ta) => ta.classIds);
        return (
          directClassIds.includes(c.id) ||
          assignmentClassIds.includes(c.id) ||
          c.teacherIds.includes(currentUser.id)
        );
      })
    : isAdminOrVice
    ? classes
    : [];

  const teachingClassIdsSet = new Set(teachingAccessibleClasses.map((c) => c.id));

  // Sessions accessible for teaching view
  const teachingAccessibleSessions = isTeacher
    ? sessions.filter(
        (s) =>
          teachingClassIdsSet.has(s.classId) &&
          (s.teacherId === currentUser.id || currentUser.assignedClassIds.includes(s.classId))
      )
    : hasTeachingLoad
    ? sessions.filter(
        (s) =>
          teachingClassIdsSet.has(s.classId) &&
          (s.teacherId === currentUser.id ||
            (currentUser.teachingClassIds && currentUser.teachingClassIds.includes(s.classId)) ||
            (currentUser.teachingAssignments && currentUser.teachingAssignments.some((ta) => ta.classIds.includes(s.classId))))
      )
    : sessions;

  const canTeachClassAndSubject = (classId: string, subjectNameOrId?: string): boolean => {
    if (isAdmin || isEducationalVice) return true;
    if (isTeacher) {
      const teachesClass = currentUser.assignedClassIds.includes(classId) || classes.find((c) => c.id === classId)?.teacherIds.includes(currentUser.id);
      if (!teachesClass) return false;
      if (!subjectNameOrId) return true;
      if (currentUser.subject && (subjectNameOrId === currentUser.subject || subjectNameOrId.includes(currentUser.subject))) return true;
      return true;
    }
    if (hasTeachingLoad) {
      const teachesClass = teachingClassIdsSet.has(classId);
      if (!teachesClass) return false;
      if (!subjectNameOrId) return true;
      if (currentUser.teachingAssignments && currentUser.teachingAssignments.length > 0) {
        return currentUser.teachingAssignments.some(
          (ta) =>
            ta.classIds.includes(classId) &&
            (ta.subjectId === subjectNameOrId || ta.subjectName === subjectNameOrId || subjectNameOrId.includes(ta.subjectName))
        );
      }
      if (currentUser.teachingSubject) {
        return currentUser.teachingSubject === subjectNameOrId || subjectNameOrId.includes(currentUser.teachingSubject);
      }
      return true;
    }
    return false;
  };

  // Authentication logic (احراز هویت سمت سرور لاراول)
  const login = async (username: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    const cleanUsername = username.trim();
    const cleanPassword = (password || '').trim();

    if (!cleanUsername) {
      return { success: false, message: 'کاربری با این نام کاربری یافت نشد.' };
    }

    try {
      await syncEngine.flush();
      await apiRequest('POST', '/api/auth/login', { username: cleanUsername, password: cleanPassword });
      await loadFromServer(false);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof ApiError ? error.message : 'نام کاربری یا رمز عبور اشتباه است.',
      };
    }
  };

  const logout = () => {
    syncEngine
      .flush()
      .then(() => apiRequest('POST', '/api/auth/logout'))
      .catch(() => undefined)
      .finally(() => {
        resetClientState();
        setAuthStatus('guest');
      });
  };

  // Actions
  const saveComprehensiveExam = (record: ComprehensiveExamRecord) => {
    const next = { ...record, updatedAt: new Date().toISOString() };
    setComprehensiveExams((prev) =>
      prev.some((r) => r.id === next.id) ? prev.map((r) => (r.id === next.id ? next : r)) : [...prev, next]
    );
  };

  const addClass = (newClass: Omit<SchoolClass, 'id'>): string => {
    const id = `cls-${Date.now()}`;
    const createdClass: SchoolClass = { ...newClass, id };
    setClasses((prev) => [createdClass, ...prev]);

    if (isTeacher) {
      setAllUsers((prev) =>
        prev.map((u) =>
          u.id === currentUser.id
            ? { ...u, assignedClassIds: [...u.assignedClassIds, id] }
            : u
        )
      );
    }
    showToast(`کلاس «${newClass.name}» با موفقیت اضافه شد.`);
    return id;
  };

  const updateClass = (id: string, updatedData: Partial<SchoolClass>) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updatedData } : c))
    );
    showToast('تغییرات کلاس با موفقیت ذخیره شد.');
  };

  const deleteClass = (id: string): boolean => {
    const classStudents = students.filter((s) => s.classId === id);
    if (classStudents.length > 0) {
      showToast(`این کلاس دارای ${classStudents.length} دانش‌آموز است. برای حذف کلاس ابتدا وضعیت دانش‌آموزان را مشخص یا آن‌ها را منتقل کنید.`, 'error');
      return false;
    }
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setCourseAssignments((prev) => prev.filter((a) => a.classId !== id));
    setSessions((prev) => prev.filter((s) => s.classId !== id));
    showToast('کلاس با موفقیت حذف شد.', 'info');
    return true;
  };

  const removeStudentFromClass = (studentId: string) => {
    const targetStudent = students.find((s) => s.id === studentId);
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, classId: '' } : s))
    );
    showToast(`دانش‌آموز «${targetStudent ? `${targetStudent.firstName} ${targetStudent.lastName}` : ''}» از کلاس خارج شد (سوابق و پرونده در سامانه حفظ گردید).`, 'info');
  };

  const transferStudentClass = (studentId: string, newClassId: string) => {
    const targetStudent = students.find((s) => s.id === studentId);
    const targetClass = classes.find((c) => c.id === newClassId);
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, classId: newClassId } : s))
    );
    showToast(`دانش‌آموز «${targetStudent ? `${targetStudent.firstName} ${targetStudent.lastName}` : ''}» به کلاس «${targetClass ? targetClass.name : ''}» منتقل شد.`);
  };

  const assignStudentToClass = (studentId: string, classId: string) => {
    const targetStudent = students.find((s) => s.id === studentId);
    const targetClass = classes.find((c) => c.id === classId);
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, classId } : s))
    );
    showToast(`دانش‌آموز «${targetStudent ? `${targetStudent.firstName} ${targetStudent.lastName}` : ''}» به کلاس «${targetClass ? targetClass.name : ''}» اضافه شد.`);
  };

  const addStudent = (newStudent: Omit<Student, 'id'>): string => {
    const id = `stu-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const student: Student = { 
      ...newStudent, 
      id,
      disciplineScore: newStudent.disciplineScore ?? 20,
      disciplinaryStatus: newStudent.disciplinaryStatus ?? 'normal',
      disciplinaryNotes: newStudent.disciplinaryNotes ?? [],
    };
    setStudents((prev) => [...prev, student]);
    showToast(`دانش‌آموز «${newStudent.firstName} ${newStudent.lastName}» با موفقیت ثبت شد.`);
    return id;
  };

  const addStudentsBatch = (classId: string, fullNames: string[]) => {
    const newStudents: Student[] = fullNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((fullName, idx) => {
        const parts = fullName.split(' ');
        const firstName = parts[0] || 'دانش‌آموز';
        const lastName = parts.slice(1).join(' ') || `شماره ${idx + 1}`;
        const randomCode = Math.floor(10000000 + Math.random() * 90000000).toString();
        return {
          id: `stu-${Date.now()}-${idx}`,
          classId,
          studentCode: randomCode.slice(0, 8),
          nationalId: `00${randomCode}`,
          firstName,
          lastName,
          parentPhone: '09120000000',
          disciplineScore: 20,
          disciplinaryStatus: 'normal',
          disciplinaryNotes: [],
        };
      });

    setStudents((prev) => [...prev, ...newStudents]);
    showToast(`${newStudents.length} دانش‌آموز جدید به کلاس افزوده شدند.`);
  };

  const updateStudent = (id: string, updatedData: Partial<Student>) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updatedData } : s))
    );
    showToast('اطلاعات دانش‌آموز بروزرسانی شد.');
  };

  const deleteStudent = (id: string) => {
    const target = students.find((s) => s.id === id);
    setStudents((prev) => prev.filter((s) => s.id !== id));
    // حذف کامل سوابق وابسته به دانش‌آموز
    setAcademicGrades((prev) => (prev.some((g) => g.studentId === id) ? prev.filter((g) => g.studentId !== id) : prev));
    setMorningDelays((prev) => (prev.some((d) => d.studentId === id) ? prev.filter((d) => d.studentId !== id) : prev));
    setMorningAttendance((prev) => (prev.some((d) => d.studentId === id) ? prev.filter((d) => d.studentId !== id) : prev));
    setSchoolAbsences((prev) => (prev.some((a) => a.studentId === id) ? prev.filter((a) => a.studentId !== id) : prev));
    setObservations((prev) => (prev.some((o) => o.studentId === id) ? prev.filter((o) => o.studentId !== id) : prev));
    setCoachEvaluations((prev) => (prev.some((e) => e.studentId === id) ? prev.filter((e) => e.studentId !== id) : prev));
    setNurturingDossiers((prev) => {
      if (!prev[id]) return prev;
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setSessions((prev) =>
      prev.some((ses) => ses.records && ses.records[id])
        ? prev.map((ses) => {
            if (!ses.records || !ses.records[id]) return ses;
            const records = { ...ses.records };
            delete records[id];
            return { ...ses, records };
          })
        : prev
    );
    showToast(
      target
        ? `دانش‌آموز «${target.firstName} ${target.lastName}» و تمام سوابق او حذف شد.`
        : 'دانش‌آموز با موفقیت حذف شد.',
      'info'
    );
  };

  // پاک‌سازی کامل دانش‌آموزان، دبیران و مربیان جهت ورود اطلاعات از ابتدا
  const purgeStudentsAndStaff = () => {
    const staffIds = new Set(
      allUsers.filter((u) => (u.role === 'teacher' || u.role === 'coach') && u.id !== currentUser.id).map((u) => u.id)
    );
    setAllUsers((prev) => prev.filter((u) => !staffIds.has(u.id)));
    setCourseAssignments((prev) => prev.filter((a) => !staffIds.has(a.teacherId)));
    setStudents([]);
    setSessions([]);
    setAcademicGrades([]);
    setMorningDelays([]);
    setMorningAttendance([]);
    setSchoolAbsences([]);
    setObservations([]);
    setNurturingDossiers({});
    setCoachEvaluations([]);
    setTeacherEvaluations([]);
    setClasses((prev) =>
      prev.map((c) =>
        (c.teacherIds && c.teacherIds.length > 0) || c.coachId || (c.coachIds && c.coachIds.length > 0)
          ? { ...c, teacherIds: [], coachId: undefined, coachIds: [] }
          : c
      )
    );
    setAcademicSubjects((prev) =>
      prev.map((sub) =>
        sub.teacherId || sub.teacherName || sub.defaultTeacherName
          ? { ...sub, teacherId: undefined, teacherName: undefined, defaultTeacherName: undefined }
          : sub
      )
    );
    showToast('اطلاعات همه دانش‌آموزان، دبیران و مربیان پاک شد. اکنون می‌توانید اطلاعات را از ابتدا وارد کنید.', 'success');
  };

  // Disciplinary Methods
  const addDisciplinaryNote = (studentId: string, noteData: Omit<DisciplinaryNote, 'id'>) => {
    const noteId = `dn-${Date.now()}`;
    const newNote: DisciplinaryNote = { ...noteData, id: noteId };
    
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const currentNotes = s.disciplinaryNotes || [];
        const currentScore = s.disciplineScore ?? 20;
        const newScore = Math.max(0, Math.min(20, currentScore - (noteData.scoreDeduction || 0)));
        let newStatus = s.disciplinaryStatus || 'normal';
        if (noteData.type === 'absence' || noteData.scoreDeduction >= 2) {
          newStatus = 'written_warning';
        } else if (noteData.scoreDeduction > 0) {
          newStatus = 'verbal_warning';
        }
        return {
          ...s,
          disciplineScore: newScore,
          disciplinaryStatus: newStatus,
          disciplinaryNotes: [newNote, ...currentNotes],
        };
      })
    );
    showToast('مورد انضباطی با موفقیت ثبت شد.');
  };

  const updateStudentDiscipline = (studentId: string, score: number, status?: DisciplinaryStatus) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          disciplineScore: score,
          disciplinaryStatus: status || s.disciplinaryStatus || 'normal',
        };
      })
    );
    showToast('نمره و وضعیت انضباطی بروزرسانی شد.');
  };

  const deleteDisciplinaryNote = (studentId: string, noteId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const noteToDelete = (s.disciplinaryNotes || []).find((n) => n.id === noteId);
        const restoredScore = noteToDelete ? (s.disciplineScore ?? 20) + (noteToDelete.scoreDeduction || 0) : (s.disciplineScore ?? 20);
        return {
          ...s,
          disciplineScore: Math.min(20, restoredScore),
          disciplinaryNotes: (s.disciplinaryNotes || []).filter((n) => n.id !== noteId),
        };
      })
    );
    showToast('مورد انضباطی حذف شد.', 'info');
  };

  // ------------------------------------------------------------------
  // حضور و غیاب صبحگاه (ناظم / معاون اجرایی)
  // ------------------------------------------------------------------
  const morningRecordId = (date: string, studentId: string) => `ma-${toEnglishDigits(date).replace(/\//g, '')}-${studentId}`;

  const toggleMorningAttendance = (student: Student) => {
    const today = getTodayShamsi();
    const id = morningRecordId(today.formattedDate, student.id);
    const now = tehranNow();
    const nowIso = new Date().toISOString();
    const entryTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setMorningAttendance((prev) => {
      const existing = prev.find((r) => r.id === id);
      if (existing?.status === 'present') {
        // بازگشت به «غایب»: ساعت ورود و تأخیر پاک می‌شود
        return prev.map((r) =>
          r.id === id
            ? { ...r, status: 'absent', entryTime: undefined, delayMinutes: 0, delayManuallyAdjusted: false, isAcknowledged: false, acknowledgedAt: undefined, acknowledgedBy: undefined, updatedAt: nowIso }
            : r
        );
      }
      const present: MorningAttendanceRecord = {
        ...(existing || {
          id,
          studentId: student.id,
          classId: student.classId,
          date: today.formattedDate,
          dayOfWeek: today.dayOfWeek,
          createdAt: nowIso,
        }),
        status: 'present',
        entryTime,
        delayMinutes: delayFromEntryTime(entryTime),
        delayManuallyAdjusted: false,
        isAcknowledged: false,
        acknowledgedAt: undefined,
        acknowledgedBy: undefined,
        recordedBy: currentUser.name,
        updatedAt: nowIso,
      };
      return existing ? prev.map((r) => (r.id === id ? present : r)) : [present, ...prev];
    });
  };

  const setMorningDelayMinutes = (recordId: string, minutes: number) => {
    const clean = Math.max(0, Math.min(600, Math.round(Number.isFinite(minutes) ? minutes : 0)));
    setMorningAttendance((prev) =>
      prev.map((r) =>
        r.id === recordId
          ? { ...r, delayMinutes: clean, delayManuallyAdjusted: true, updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const acknowledgeMorningRecord = (student: Student, _kind: 'absence' | 'delay') => {
    const today = getTodayShamsi();
    const id = morningRecordId(today.formattedDate, student.id);
    const nowIso = new Date().toISOString();
    setMorningAttendance((prev) => {
      const existing = prev.find((r) => r.id === id);
      if (existing) {
        return prev.map((r) =>
          r.id === id ? { ...r, isAcknowledged: true, acknowledgedAt: nowIso, acknowledgedBy: currentUser.name, updatedAt: nowIso } : r
        );
      }
      // غیبتِ ضمنی (هنوز رکوردی ندارد) با تأیید، به‌صورت رکورد غایبِ تأییدشده ثبت می‌شود
      const created: MorningAttendanceRecord = {
        id,
        studentId: student.id,
        classId: student.classId,
        date: today.formattedDate,
        dayOfWeek: today.dayOfWeek,
        status: 'absent',
        delayMinutes: 0,
        isAcknowledged: true,
        acknowledgedAt: nowIso,
        acknowledgedBy: currentUser.name,
        recordedBy: currentUser.name,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      return [created, ...prev];
    });
  };

  // Morning Entrance Delays CRUD
  const addMorningDelay = (delayData: Omit<MorningDelayRecord, 'id' | 'createdAt'>): string => {
    const cleanDate = toEnglishDigits(delayData.date);

    // Prevent duplicate morning delay for same student and date
    const existing = morningDelays.find(
      (m) => m.studentId === delayData.studentId && toEnglishDigits(m.date) === cleanDate
    );
    if (existing) {
      showToast('برای این دانش‌آموز در این تاریخ قبلاً سند تأخیر ورود ثبت شده است.', 'info');
      return existing.id;
    }

    const id = `md-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const targetStudent = students.find((s) => s.id === delayData.studentId);
    const studentName = delayData.studentName || (targetStudent ? `${targetStudent.firstName} ${targetStudent.lastName}` : undefined);

    const newRecord: MorningDelayRecord = {
      ...delayData,
      date: cleanDate,
      studentName,
      id,
      createdAt: new Date().toISOString(),
    };
    setMorningDelays((prev) => [newRecord, ...prev]);

    // Automatically add note if non-excused or >= 15 mins delay
    if (!delayData.isExcused && delayData.delayMinutes >= 15) {
      addDisciplinaryNote(delayData.studentId, {
        date: cleanDate,
        title: `تاخیر در ورود به مدرسه (${delayData.delayMinutes} دقیقه)`,
        description: `ثبت ورود در ساعت ${delayData.arrivalTime || 'نامشخص'} - علت: ${delayData.reason || 'بدون عذر موجه'}`,
        scoreDeduction: delayData.delayMinutes >= 30 ? 0.5 : 0.25,
        recordedBy: delayData.recordedBy || 'معاونت انضباطی',
        type: 'delay',
      });
    } else {
      showToast('سند تأخیر صبحگاهی با موفقیت ثبت شد.');
    }

    return id;
  };

  const updateMorningDelay = (id: string, updatedData: Partial<MorningDelayRecord>) => {
    setMorningDelays((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updatedData } : d))
    );
    showToast('اطلاعات تأخیر بروزرسانی شد.');
  };

  const deleteMorningDelay = (id: string) => {
    setMorningDelays((prev) => prev.filter((d) => d.id !== id));
    showToast('سند تأخیر با موفقیت حذف شد.', 'info');
  };

  const addMorningDelaysBatch = (records: Omit<MorningDelayRecord, 'id' | 'createdAt'>[]) => {
    const nowIso = new Date().toISOString();
    const newRecords: MorningDelayRecord[] = records.map((rec, idx) => ({
      ...rec,
      id: `md-${Date.now()}-${idx}`,
      createdAt: nowIso,
    }));
    setMorningDelays((prev) => [...newRecords, ...prev]);
    showToast(`${newRecords.length} مورد تأخیر ثبت شد.`);
  };

  // School Absences CRUD (غیبت در مدرسه)
  const addSchoolAbsence = (absenceData: Omit<SchoolAbsenceRecord, 'id' | 'createdAt'>): string => {
    // Prevent duplicate school absence for same student and date
    const existing = schoolAbsences.find(
      (a) => a.studentId === absenceData.studentId && a.date === absenceData.date
    );
    if (existing) {
      showToast('برای این دانش‌آموز در این تاریخ قبلاً سند غیبت مدرسه ثبت شده است.', 'info');
      return existing.id;
    }

    const id = `abs-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newRecord: SchoolAbsenceRecord = {
      ...absenceData,
      id,
      createdAt: new Date().toISOString(),
    };
    setSchoolAbsences((prev) => [newRecord, ...prev]);

    // If unexcused absence, automatically record note in disciplinary profile
    if (!absenceData.isExcused) {
      addDisciplinaryNote(absenceData.studentId, {
        date: absenceData.date,
        title: 'غیبت در مدرسه',
        description: `عدم حضور در مدرسه - علت: ${absenceData.reason || 'غیبت غیرموجه'}`,
        scoreDeduction: 0.5,
        recordedBy: absenceData.recordedBy || 'معاونت انضباطی',
        type: 'absence',
      });
    }

    showToast('غیبت در مدرسه با موفقیت ثبت شد.');
    return id;
  };

  const updateSchoolAbsence = (id: string, updatedData: Partial<SchoolAbsenceRecord>) => {
    setSchoolAbsences((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updatedData } : a))
    );
    showToast('اطلاعات غیبت بروزرسانی شد.');
  };

  const deleteSchoolAbsence = (id: string) => {
    setSchoolAbsences((prev) => prev.filter((a) => a.id !== id));
    showToast('سند غیبت با موفقیت حذف شد.', 'info');
  };

  const addSchoolAbsencesBatch = (records: Omit<SchoolAbsenceRecord, 'id' | 'createdAt'>[]) => {
    const nowIso = new Date().toISOString();
    const newRecords: SchoolAbsenceRecord[] = records.map((rec, idx) => ({
      ...rec,
      id: `abs-${Date.now()}-${idx}`,
      createdAt: nowIso,
    }));
    setSchoolAbsences((prev) => [...newRecords, ...prev]);
    showToast(`${newRecords.length} مورد غیبت ثبت شد.`);
  };

  const addTeacher = (teacherData: Omit<User, 'id' | 'role'>): string => {
    const id = `usr-tea-${Date.now()}`;
    const newTeacher: User = {
      ...teacherData,
      id,
      username: teacherData.username || `tea_${Date.now().toString().slice(-4)}`,
      password: teacherData.password || '123',
      role: 'teacher',
      roleTitle: teacherData.roleTitle || `دبیر ${teacherData.subject || ''}`,
    };
    setAllUsers((prev) => [...prev, newTeacher]);
    showToast(`دبیر «${newTeacher.name}» با موفقیت اضافه شد.`);
    return id;
  };

  const updateTeacher = (id: string, updatedData: Partial<User>) => {
    setAllUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updatedData } : u))
    );
    showToast('مشخصات دبیر بروزرسانی شد.');
  };

  const updateTeacherCredentials = (teacherId: string, username: string, password: string, assignedClassIds?: string[]) => {
    setAllUsers((prev) =>
      prev.map((u) => {
        if (u.id !== teacherId) return u;
        return {
          ...u,
          username: username.trim(),
          password: password.trim(),
          assignedClassIds: assignedClassIds !== undefined ? assignedClassIds : u.assignedClassIds,
        };
      })
    );
    showToast('نام کاربری و رمز عبور دبیر ذخیره شد.');
  };

  const deleteTeacher = (id: string): boolean => {
    const teacherUser = allUsers.find((u) => u.id === id);
    const assignedClasses = classes.filter(
      (c) => c.teacherIds?.includes(id) || teacherUser?.assignedClassIds?.includes(c.id)
    );
    if (assignedClasses.length > 0) {
      showToast(
        `این معلم هنوز به ${assignedClasses.length} کلاس («${assignedClasses.map((c) => c.name).join('»، «')}») متصل است. ابتدا ارتباط او با کلاس‌ها را مشخص یا لغو کنید.`,
        'error'
      );
      return false;
    }
    setAllUsers((prev) => prev.filter((u) => u.id !== id));
    setCourseAssignments((prev) => prev.filter((a) => a.teacherId !== id));
    // Also cleanly dissociate from any academic subjects without deleting subjects
    setAcademicSubjects((prev) =>
      prev.map((s) => (s.teacherId === id ? { ...s, teacherId: undefined, defaultTeacherName: undefined } : s))
    );
    showToast('معلم با موفقیت از سیستم حذف شد.', 'info');
    return true;
  };

  const addCoach = (coachData: Omit<User, 'id' | 'role'>): string => {
    const id = `usr-coach-${Date.now()}`;
    const newCoach: User = {
      ...coachData,
      id,
      username: coachData.username || `coach_${Date.now().toString().slice(-4)}`,
      password: coachData.password || '123',
      role: 'coach',
      roleTitle: coachData.roleTitle || 'مربی یاوران ولایت',
      assignedClassIds: coachData.assignedClassIds || [],
    };
    setAllUsers((prev) => [...prev, newCoach]);
    showToast(`مربی «${newCoach.name}» با موفقیت ثبت گردید.`);
    return id;
  };

  const updateCoach = (id: string, updatedData: Partial<User>) => {
    let derivedData = { ...updatedData };
    if (updatedData.teachingAssignments) {
      const allClassIds = Array.from(new Set(updatedData.teachingAssignments.flatMap((ta) => ta.classIds)));
      const subjects = updatedData.teachingAssignments.map((ta) => ta.subjectName).filter(Boolean);
      derivedData.teachingClassIds = allClassIds;
      derivedData.teachingSubject = subjects.join('، ');
      if (updatedData.teachingAssignments.length > 0) {
        derivedData.isAlsoTeacher = true;
      }
    }

    if (updatedData.isAlsoTeacher === false) {
      derivedData.teachingClassIds = [];
      derivedData.teachingAssignments = [];
      derivedData.teachingSubject = undefined;
    }

    setAllUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...derivedData } : u))
    );

    // Synchronize class teacherIds
    if (derivedData.isAlsoTeacher !== undefined || derivedData.teachingClassIds !== undefined) {
      const isTeacher = derivedData.isAlsoTeacher;
      const tClassIds = derivedData.teachingClassIds || [];
      setClasses((prev) =>
        prev.map((c) => {
          const shouldTeach = isTeacher && tClassIds.includes(c.id);
          const alreadyTeaches = c.teacherIds.includes(id);
          if (shouldTeach && !alreadyTeaches) {
            return { ...c, teacherIds: [...c.teacherIds, id] };
          } else if (!shouldTeach && alreadyTeaches) {
            return { ...c, teacherIds: c.teacherIds.filter((tId) => tId !== id) };
          }
          return c;
        })
      );
    }
    showToast('مشخصات مربی بروزرسانی شد.');
  };

  const deleteCoach = (id: string): boolean => {
    const coachUser = allUsers.find((u) => u.id === id);
    const assignedClasses = classes.filter(
      (c) => c.coachId === id || coachUser?.assignedClassIds?.includes(c.id)
    );
    if (assignedClasses.length > 0) {
      showToast(
        `این مربی هنوز به ${assignedClasses.length} کلاس («${assignedClasses.map((c) => c.name).join('»، «')}») متصل است. ابتدا کلاس‌های تحت پوشش را تغییر دهید.`,
        'error'
      );
      return false;
    }
    setAllUsers((prev) => prev.filter((u) => u.id !== id));
    setCourseAssignments((prev) => prev.filter((a) => a.teacherId !== id));
    showToast('مربی از سیستم حذف گردید.', 'info');
    return true;
  };

  // ----------------------------------------------------
  // تنظیمات مدرسه، سال تحصیلی و پایه‌های آموزشی
  // ----------------------------------------------------

  const updateSchoolSettings = (updated: Partial<SchoolSettings>) => {
    setSchoolSettings((prev) => ({ ...prev, ...updated }));

    // هماهنگ‌سازی نام حساب کاربری مدیر با نام مدیر مدرسه در تنظیمات
    const newPrincipal = typeof updated.principalName === 'string' ? updated.principalName.trim() : '';
    if (newPrincipal && newPrincipal !== schoolSettings.principalName) {
      const admins = allUsers.filter((u) => u.role === 'admin');
      const principalUser =
        admins.find((u) => u.name === schoolSettings.principalName) ||
        (admins.length === 1 ? admins[0] : isAdmin ? currentUser : undefined);
      if (principalUser && principalUser.name !== newPrincipal) {
        setAllUsers((prev) => prev.map((u) => (u.id === principalUser.id ? { ...u, name: newPrincipal } : u)));
      }
    }
    showToast('اطلاعات مدرسه با موفقیت به‌روزرسانی شد.', 'success');
  };

  const updateAcademicYear = (newYear: string) => {
    const trimmed = newYear.trim();
    if (!trimmed) return;
    setSchoolSettings((prev) => ({ ...prev, academicYear: trimmed }));
    showToast(`سال تحصیلی جاری با موفقیت به «${trimmed}» تغییر یافت.`, 'success');
  };

  const addGrade = (name: string, stage: string = 'دوره اول متوسطه'): string => {
    const trimmed = name.trim();
    const newId = `grd-${Date.now()}`;
    const newGrade: SchoolGradeItem = {
      id: newId,
      name: trimmed,
      stage,
      status: 'active',
    };
    setGrades((prev) => [...prev, newGrade]);
    showToast(`پایه تحصیلی «${trimmed}» با موفقیت افزوده شد.`, 'success');
    return newId;
  };

  const updateGrade = (id: string, updated: Partial<SchoolGradeItem>) => {
    setGrades((prev) => prev.map((g) => (g.id === id ? { ...g, ...updated } : g)));
    showToast('اطلاعات پایه تحصیلی با موفقیت به‌روزرسانی شد.', 'success');
  };

  const toggleGradeStatus = (id: string) => {
    setGrades((prev) =>
      prev.map((g) => (g.id === id ? { ...g, status: g.status === 'active' ? 'inactive' : 'active' } : g))
    );
    showToast('وضعیت فعال بودن پایه تحصیلی تغییر یافت.', 'info');
  };

  const deleteGrade = (id: string): boolean => {
    const target = grades.find((g) => g.id === id);
    if (!target) return false;
    // Check if any class is associated with this grade
    const hasActiveClasses = classes.some(
      (c) => c.grade.includes(target.name) || target.name.includes(c.grade)
    );
    if (hasActiveClasses) {
      showToast(
        `امکان حذف پایه «${target.name}» وجود ندارد؛ کلاس‌هایی برای این پایه ثبت شده‌اند. ابتدا کلاس‌ها را تغییر دهید.`,
        'error'
      );
      return false;
    }
    setGrades((prev) => prev.filter((g) => g.id !== id));
    showToast(`پایه تحصیلی «${target.name}» با موفقیت حذف شد.`, 'success');
    return true;
  };

  // ----------------------------------------------------
  // مدیریت یکپارچه کاربران سامانه (مدیر، معاونین، مربیان، معلمان)
  // ----------------------------------------------------

  const addUser = (userData: Omit<User, 'id'>): string => {
    const newId = `usr-${Date.now()}`;
    const newUser: User = {
      ...userData,
      id: newId,
    };
    setAllUsers((prev) => [...prev, newUser]);
    showToast(`کاربر جدید «${newUser.name}» با موفقیت ایجاد شد.`, 'success');
    return newId;
  };

  const updateUser = (id: string, updated: Partial<User>) => {
    const target = allUsers.find((u) => u.id === id);
    setAllUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));

    // هماهنگ‌سازی نام مدیر مدرسه در تنظیمات با حساب کاربری مدیر
    if (target && typeof updated.name === 'string' && updated.name.trim()) {
      const finalRole = updated.role || target.role;
      const admins = allUsers.filter((u) => u.role === 'admin');
      const isPrincipal =
        finalRole === 'admin' &&
        (admins.length <= 1 || target.name === schoolSettings.principalName || !schoolSettings.principalName);
      if (isPrincipal && updated.name.trim() !== schoolSettings.principalName) {
        setSchoolSettings((prev) => ({ ...prev, principalName: updated.name!.trim() }));
      }
    }
    showToast('اطلاعات کاربر با موفقیت به‌روزرسانی شد.', 'success');
  };

  const deleteUser = (id: string): boolean => {
    const target = allUsers.find((u) => u.id === id);
    if (!target) return false;
    if (target.id === currentUserId) {
      showToast('امکان حذف کاربری که در حال حاضر با آن وارد شده‌اید وجود ندارد.', 'error');
      return false;
    }
    if (target.role === 'admin' && allUsers.filter((u) => u.role === 'admin').length <= 1) {
      showToast('سامانه همواره نیازمند حداقل یک حساب کاربری مدیر کل است.', 'error');
      return false;
    }
    setAllUsers((prev) => prev.filter((u) => u.id !== id));
    setCourseAssignments((prev) => prev.filter((a) => a.teacherId !== id));
    showToast(`کاربر «${target.name}» با موفقیت حذف شد.`, 'success');
    return true;
  };


  const saveAttendanceSession = (
    sessionData: Omit<AttendanceSession, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): string => {
    const nowIso = new Date().toISOString();
    if (sessionData.id) {
      const existingId = sessionData.id;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === existingId
            ? {
                ...s,
                ...sessionData,
                updatedAt: nowIso,
              }
            : s
        )
      );
      showToast('جلسه حضور و غیاب بروزرسانی شد.');
      return existingId;
    } else {
      // جلوگیری از ثبت تکراری: یک زنگ از یک درس در یک کلاس و تاریخ مشخص فقط یک‌بار ثبت می‌شود
      const sameSubject = (s: AttendanceSession) =>
        sessionData.subjectId && s.subjectId ? s.subjectId === sessionData.subjectId : s.subject === sessionData.subject;
      const duplicateSession = sessions.find(
        (s) =>
          s.classId === sessionData.classId &&
          s.date === sessionData.date &&
          sameSubject(s) &&
          (sessionData.periodNumber ?? 0) === (s.periodNumber ?? 0)
      );

      if (duplicateSession) {
        showToast('جلسه حضور و غیاب برای این کلاس و زنگ قبلاً در این تاریخ ثبت شده است.', 'info');
        return duplicateSession.id;
      }

      const newId = `ses-${Date.now()}`;
      const newSession: AttendanceSession = {
        ...sessionData,
        id: newId,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setSessions((prev) => [newSession, ...prev]);
      showToast('جلسه حضور و غیاب با موفقیت ثبت شد.');
      return newId;
    }
  };

  const deleteAttendanceSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    showToast('جلسه حضور و غیاب حذف شد.', 'info');
  };

  // Official Term Academic Grades Methods
  const saveAcademicGrade = (gradeData: StudentAcademicGrade) => {
    const nowIso = new Date().toISOString();
    setAcademicGrades((prev) => {
      const idx = prev.findIndex(
        (g) => g.id === gradeData.id || (g.studentId === gradeData.studentId && g.subjectId === gradeData.subjectId)
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          ...gradeData,
          updatedAt: nowIso,
        };
        return updated;
      } else {
        const newGrade: StudentAcademicGrade = {
          ...gradeData,
          id: gradeData.id || `grd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          updatedAt: nowIso,
        };
        return [...prev, newGrade];
      }
    });
  };

  const saveBatchAcademicGrades = (incomingGrades: StudentAcademicGrade[]) => {
    const nowIso = new Date().toISOString();
    setAcademicGrades((prev) => {
      const copy = [...prev];
      incomingGrades.forEach((incoming) => {
        const idx = copy.findIndex(
          (g) => g.id === incoming.id || (g.studentId === incoming.studentId && g.subjectId === incoming.subjectId)
        );
        if (idx >= 0) {
          copy[idx] = {
            ...copy[idx],
            ...incoming,
            updatedAt: nowIso,
          };
        } else {
          copy.push({
            ...incoming,
            id: incoming.id || `grd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            updatedAt: nowIso,
          });
        }
      });
      return copy;
    });
  };

  const deleteAcademicGrade = (id: string) => {
    setAcademicGrades((prev) => prev.filter((g) => g.id !== id));
  };

  const addAcademicSubject = (subject: Omit<AcademicSubject, 'id'>): string => {
    const id = `sub-${Date.now()}`;
    // If teacherId is passed, also ensure defaultTeacherName is synced
    let teacherName = subject.defaultTeacherName;
    if (subject.teacherId && !teacherName) {
      const teacher = allUsers.find(u => u.id === subject.teacherId);
      if (teacher) teacherName = teacher.name;
    }
    const newSubject: AcademicSubject = { 
      ...subject, 
      id,
      defaultTeacherName: teacherName
    };
    setAcademicSubjects((prev) => [...prev, newSubject]);
    return id;
  };

  const updateAcademicSubject = (id: string, updated: Partial<AcademicSubject>) => {
    let finalUpdated = { ...updated };
    if (updated.teacherId !== undefined) {
      if (updated.teacherId) {
        const teacher = allUsers.find(u => u.id === updated.teacherId);
        if (teacher && !updated.defaultTeacherName) {
          finalUpdated.defaultTeacherName = teacher.name;
        }
      } else {
        finalUpdated.defaultTeacherName = '';
      }
    }

    setAcademicSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...finalUpdated } : s))
    );
  };

  const assignTeacherToSubject = (subjectId: string, teacherId: string | null, teacherName?: string) => {
    let finalTeacherName = teacherName;
    if (teacherId && !finalTeacherName) {
      const teacher = allUsers.find(u => u.id === teacherId);
      if (teacher) finalTeacherName = teacher.name;
    }

    setAcademicSubjects((prev) =>
      prev.map((s) => {
        if (s.id === subjectId) {
          return {
            ...s,
            teacherId: teacherId || undefined,
            defaultTeacherName: teacherId ? (finalTeacherName || '') : '',
          };
        }
        return s;
      })
    );
  };

  const resetSubjectsToJuniorHighStandards = () => {
    setAcademicSubjects(JUNIOR_HIGH_STANDARD_SUBJECTS);
  };

  const deleteAcademicSubject = (id: string) => {
    setAcademicSubjects((prev) => prev.filter((s) => s.id !== id));
    setCourseAssignments((prev) => prev.filter((a) => a.subjectId !== id));
    setAcademicGrades((prev) => prev.filter((g) => g.subjectId !== id));
  };

  const getStudentAcademicGrades = (studentId: string): StudentAcademicGrade[] => {
    return academicGrades.filter((g) => g.studentId === studentId);
  };

  // ----------------------------------------------------------------
  // Bell Periods & Approved Timetable (ساعات و زنگ‌های مصوب مدرسه)
  // ----------------------------------------------------------------
  const updateBellPeriod = (id: string, updatedData: Partial<BellPeriod>) => {
    setBellPeriods((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updatedData } : b))
    );
  };

  const addBellPeriod = (period: Omit<BellPeriod, 'id'>): string => {
    const id = `bell-${Date.now()}`;
    const newBell: BellPeriod = { ...period, id };
    setBellPeriods((prev) => [...prev, newBell].sort((a, b) => a.order - b.order));
    return id;
  };

  const deleteBellPeriod = (id: string) => {
    setBellPeriods((prev) => prev.filter((b) => b.id !== id));
  };

  const resetBellPeriodsToDefault = () => {
    setBellPeriods(INITIAL_BELL_PERIODS);
  };

  const getBellPeriodById = (id: string): BellPeriod | undefined => {
    return bellPeriods.find((b) => b.id === id);
  };

  const getCurrentOrNextBellPeriod = (): BellPeriod => {
    const now = tehranNow();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

    // 1. Is there an active bell right now?
    const active = bellPeriods.find(
      (b) => currentTimeStr >= b.startTime && currentTimeStr <= b.endTime
    );
    if (active) return active;

    // 2. Next upcoming bell today
    const upcoming = bellPeriods.find((b) => currentTimeStr < b.startTime);
    if (upcoming) return upcoming;

    // 3. Default to first bell
    return bellPeriods[0] || INITIAL_BELL_PERIODS[0];
  };

  // ----------------------------------------------------------------
  // Nurturing & Counseling Actions (معاونت تربیتی)
  // ----------------------------------------------------------------
  const addStudentObservation = (obsData: Omit<StudentObservation, 'id' | 'createdAt'>): string => {
    const id = `obs-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newObs: StudentObservation = {
      ...obsData,
      id,
      createdAt: new Date().toISOString(),
    };
    setObservations((prev) => [newObs, ...prev]);
    return id;
  };

  const updateStudentObservation = (id: string, updated: Partial<StudentObservation>) => {
    setObservations((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updated, updatedAt: new Date().toISOString() } : o))
    );
  };

  const deleteStudentObservation = (id: string) => {
    setObservations((prev) => prev.filter((o) => o.id !== id));
  };

  const getStudentObservations = (studentId: string): StudentObservation[] => {
    return observations.filter((o) => o.studentId === studentId);
  };

  const getStudentNurturingDossier = (studentId: string): StudentNurturingDossier => {
    if (nurturingDossiers[studentId]) {
      return nurturingDossiers[studentId];
    }
    // Return blank default template
    return {
      studentId,
      thinkingPoints: [],
      privateSessions: [],
      parentInterviews: [],
      temperament: {
        dominantType: undefined,
        physicalTraits: '',
        behavioralTraits: '',
        entries: [],
      },
      growthPath: [],
      lifestyle: [],
      interviews: [],
      nurturingSummary: {
        overallSummary: '',
        strengths: [],
        growthOpportunities: [],
        entries: [],
      },
      updatedAt: new Date().toISOString(),
    };
  };

  const saveDossierSectionEntry = (
    studentId: string,
    sectionKey: NurturingSectionKey,
    entryData: Omit<DossierSectionEntry, 'id' | 'createdAt'> & { id?: string }
  ): string => {
    const nowIso = new Date().toISOString();
    const entryId = entryData.id || `ent-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fullEntry: DossierSectionEntry = {
      id: entryId,
      date: entryData.date,
      title: entryData.title,
      content: entryData.content,
      tags: entryData.tags || [],
      keyTakeaways: entryData.keyTakeaways || [],
      recordedBy: entryData.recordedBy || currentUser.name,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setNurturingDossiers((prev) => {
      const current = prev[studentId] || getStudentNurturingDossier(studentId);
      const copy = { ...current, updatedAt: nowIso };

      if (sectionKey === 'temperament') {
        const existingEntries = copy.temperament?.entries || [];
        const index = existingEntries.findIndex((e) => e.id === entryId);
        if (index >= 0) {
          existingEntries[index] = { ...existingEntries[index], ...fullEntry };
        } else {
          existingEntries.unshift(fullEntry);
        }
        copy.temperament = { ...copy.temperament, entries: existingEntries };
      } else if (sectionKey === 'nurturingSummary') {
        const existingEntries = copy.nurturingSummary?.entries || [];
        const index = existingEntries.findIndex((e) => e.id === entryId);
        if (index >= 0) {
          existingEntries[index] = { ...existingEntries[index], ...fullEntry };
        } else {
          existingEntries.unshift(fullEntry);
        }
        copy.nurturingSummary = { ...copy.nurturingSummary, entries: existingEntries };
      } else {
        const list = (copy[sectionKey] as DossierSectionEntry[]) || [];
        const index = list.findIndex((e) => e.id === entryId);
        if (index >= 0) {
          list[index] = { ...list[index], ...fullEntry };
        } else {
          list.unshift(fullEntry);
        }
        (copy[sectionKey] as DossierSectionEntry[]) = list;
      }

      return {
        ...prev,
        [studentId]: copy,
      };
    });

    return entryId;
  };

  const deleteDossierSectionEntry = (
    studentId: string,
    sectionKey: NurturingSectionKey,
    entryId: string
  ) => {
    setNurturingDossiers((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      const copy = { ...current, updatedAt: new Date().toISOString() };

      if (sectionKey === 'temperament') {
        copy.temperament = {
          ...copy.temperament,
          entries: (copy.temperament?.entries || []).filter((e) => e.id !== entryId),
        };
      } else if (sectionKey === 'nurturingSummary') {
        copy.nurturingSummary = {
          ...copy.nurturingSummary,
          entries: (copy.nurturingSummary?.entries || []).filter((e) => e.id !== entryId),
        };
      } else {
        (copy[sectionKey] as DossierSectionEntry[]) = (
          (copy[sectionKey] as DossierSectionEntry[]) || []
        ).filter((e) => e.id !== entryId);
      }

      return {
        ...prev,
        [studentId]: copy,
      };
    });
  };

  const updateTemperamentOverview = (
    studentId: string,
    dominantType?: string,
    physicalTraits?: string,
    behavioralTraits?: string
  ) => {
    setNurturingDossiers((prev) => {
      const current = prev[studentId] || getStudentNurturingDossier(studentId);
      return {
        ...prev,
        [studentId]: {
          ...current,
          temperament: {
            ...current.temperament,
            dominantType: dominantType !== undefined ? dominantType : current.temperament?.dominantType,
            physicalTraits: physicalTraits !== undefined ? physicalTraits : current.temperament?.physicalTraits,
            behavioralTraits: behavioralTraits !== undefined ? behavioralTraits : current.temperament?.behavioralTraits,
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const updateNurturingSummaryOverview = (
    studentId: string,
    overallSummary?: string,
    strengths?: string[],
    growthOpportunities?: string[]
  ) => {
    setNurturingDossiers((prev) => {
      const current = prev[studentId] || getStudentNurturingDossier(studentId);
      return {
        ...prev,
        [studentId]: {
          ...current,
          nurturingSummary: {
            ...current.nurturingSummary,
            overallSummary: overallSummary !== undefined ? overallSummary : current.nurturingSummary?.overallSummary,
            strengths: strengths !== undefined ? strengths : current.nurturingSummary?.strengths,
            growthOpportunities: growthOpportunities !== undefined ? growthOpportunities : current.nurturingSummary?.growthOpportunities,
          },
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const saveCoachEvaluation = (
    evalData: Omit<CoachGrowthEvaluation, 'id' | 'createdAt'> & { id?: string }
  ): string => {
    const nowIso = new Date().toISOString();
    if (evalData.id) {
      const existingId = evalData.id;
      setCoachEvaluations((prev) =>
        prev.map((item) =>
          item.id === existingId
            ? { ...item, ...evalData, updatedAt: nowIso }
            : item
        )
      );
      return existingId;
    } else {
      const newId = `ce-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newEvaluation: CoachGrowthEvaluation = {
        ...evalData,
        id: newId,
        createdAt: nowIso,
      };
      setCoachEvaluations((prev) => [newEvaluation, ...prev]);

      // Automatically also attach a note to Dossier section 5 (growthPath) for holistic tracking
      const strengthsText = Array.isArray(evalData.strengths) ? evalData.strengths.join('، ') : (evalData.strengths || '');
      const growthText = Array.isArray(evalData.growthRecommendations) ? evalData.growthRecommendations.join('، ') : (evalData.growthRecommendations || '');
      const takeawaysList = Array.isArray(evalData.growthRecommendations) ? evalData.growthRecommendations : (evalData.growthRecommendations ? [evalData.growthRecommendations] : []);

      saveDossierSectionEntry(evalData.studentId, 'growthPath', {
        date: evalData.date,
        title: `ارزیابی رشد یاوران ولایت: ${evalData.period} (${evalData.coachName})`,
        content: `نقاط قوت: ${strengthsText}\nتوصیه‌های ارتقا: ${growthText}${evalData.notes ? `\nیادداشت مربی: ${evalData.notes}` : ''}`,
        tags: ['ارزیابی مربی', 'رشد فردی'],
        keyTakeaways: takeawaysList,
        recordedBy: evalData.coachName,
      });

      return newId;
    }
  };

  const deleteCoachEvaluation = (id: string) => {
    setCoachEvaluations((prev) => prev.filter((item) => item.id !== id));
  };

  const getStudentCoachEvaluations = (studentId: string): CoachGrowthEvaluation[] => {
    return coachEvaluations.filter((item) => item.studentId === studentId);
  };

  // Teacher Evaluations & Growth Methods (معاونت آموزش)
  const saveTeacherEvaluation = (evalData: Omit<TeacherEvaluation, 'id' | 'createdAt'> & { id?: string }): string => {
    const nowIso = new Date().toISOString();
    if (evalData.id) {
      setTeacherEvaluations((prev) =>
        prev.map((item) =>
          item.id === evalData.id
            ? { ...item, ...evalData, updatedAt: nowIso }
            : item
        )
      );
      return evalData.id;
    } else {
      const newId = `te-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newEvaluation: TeacherEvaluation = {
        ...evalData,
        id: newId,
        createdAt: nowIso,
      };
      setTeacherEvaluations((prev) => [newEvaluation, ...prev]);
      return newId;
    }
  };

  const deleteTeacherEvaluation = (id: string) => {
    setTeacherEvaluations((prev) => prev.filter((item) => item.id !== id));
  };

  const getTeacherEvaluations = (teacherId: string): TeacherEvaluation[] => {
    return teacherEvaluations.filter((item) => item.teacherId === teacherId);
  };

  // School Announcements Methods
  const addSchoolAnnouncement = (announcement: Omit<SchoolAnnouncement, 'id' | 'createdAt'>): string => {
    const newId = `ann-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newAnn: SchoolAnnouncement = {
      ...announcement,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setSchoolAnnouncements((prev) => [newAnn, ...prev]);
    return newId;
  };

  const updateSchoolAnnouncement = (id: string, updates: Partial<SchoolAnnouncement>) => {
    setSchoolAnnouncements((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const deleteSchoolAnnouncement = (id: string) => {
    setSchoolAnnouncements((prev) => prev.filter((item) => item.id !== id));
  };

  const resetToDemoData = () => {
    setAllUsers(INITIAL_USERS);
    setClasses(INITIAL_CLASSES);
    setBellPeriods(INITIAL_BELL_PERIODS);
    setStudents(INITIAL_STUDENTS);
    setSessions(INITIAL_SESSIONS);
    setAcademicSubjects(INITIAL_ACADEMIC_SUBJECTS);
    setAcademicGrades(INITIAL_ACADEMIC_GRADES);
    setMorningDelays(INITIAL_MORNING_DELAYS);
    setMorningAttendance([]);
    setObservations(INITIAL_OBSERVATIONS);
    setNurturingDossiers(INITIAL_NURTURING_DOSSIERS);
    setCoachEvaluations(INITIAL_COACH_EVALUATIONS);
    setTeacherEvaluations(INITIAL_TEACHER_EVALUATIONS);
    setSchoolAnnouncements(INITIAL_SCHOOL_ANNOUNCEMENTS);
    setSchoolSettings(INITIAL_SCHOOL_SETTINGS);
    setGrades(INITIAL_SCHOOL_GRADES);
    localStorage.clear();
  };

  const exportDatabaseJson = () => {
    const data = {
      allUsers,
      classes,
      bellPeriods,
      students,
      sessions,
      academicSubjects,
      academicGrades,
      morningDelays,
      observations,
      nurturingDossiers,
      coachEvaluations,
      teacherEvaluations,
      schoolAnnouncements,
      schoolSettings,
      grades,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `پشتیبان_مدرسه_یاوران_ولایت_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDatabaseJson = (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.classes && parsed.students && parsed.sessions) {
        if (parsed.allUsers) setAllUsers(parsed.allUsers);
        setClasses(parsed.classes);
        if (parsed.bellPeriods) setBellPeriods(parsed.bellPeriods);
        setStudents(parsed.students);
        setSessions(parsed.sessions);
        if (parsed.academicSubjects) setAcademicSubjects(parsed.academicSubjects);
        if (parsed.academicGrades) setAcademicGrades(parsed.academicGrades);
        if (parsed.morningDelays) setMorningDelays(parsed.morningDelays);
        if (parsed.observations) setObservations(parsed.observations);
        if (parsed.nurturingDossiers) setNurturingDossiers(parsed.nurturingDossiers);
        if (parsed.coachEvaluations) setCoachEvaluations(parsed.coachEvaluations);
        if (parsed.teacherEvaluations) setTeacherEvaluations(parsed.teacherEvaluations);
        if (parsed.schoolAnnouncements) setSchoolAnnouncements(parsed.schoolAnnouncements);
        if (parsed.schoolSettings) setSchoolSettings(parsed.schoolSettings);
        if (parsed.grades) setGrades(parsed.grades);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // سال تحصیلی فعال برای نمایش در تمام بخش‌های سامانه
  setActiveAcademicYear(schoolSettings.academicYear);

  return (
    <SchoolContext.Provider
      value={{
        currentUser,
        allUsers,
        users: allUsers,
        allTeachers,
        allCoaches,
        classes,
        students,
        sessions,
        academicSubjects,
        academicGrades,
        morningDelays,
        schoolAbsences,
        observations,
        nurturingDossiers,
        coachEvaluations,
        teacherEvaluations,
        schoolAnnouncements,
        comprehensiveExams,
        courseAssignments,
        assignCourseTeacher,
        assignableStaff,
        getCourseTeacherId,
        saveComprehensiveExam,
        bellPeriods,
        schoolSettings,
        updateSchoolSettings,
        updateAcademicYear,
        grades,
        addGrade,
        updateGrade,
        toggleGradeStatus,
        deleteGrade,
        addUser,
        updateUser,
        deleteUser,
        isAuthenticated,
        authStatus,
        reloadFromServer,
        login,
        logout,
        isTeacher,
        isAdmin,
        isEducationalVice,
        isDisciplinaryVice,
        isNurturingVice,
        isCoach,
        isNurturingTeam,
        isAdminOrVice,
        isVicePrincipal,
        accessibleClasses,
        accessibleSessions,
        teachingAccessibleClasses,
        teachingAccessibleSessions,
        canTeachClassAndSubject,
        addClass,
        updateClass,
        deleteClass,
        addStudent,
        addStudentsBatch,
        updateStudent,
        deleteStudent,
        purgeStudentsAndStaff,
        removeStudentFromClass,
        transferStudentClass,
        assignStudentToClass,
        addDisciplinaryNote,
        updateStudentDiscipline,
        deleteDisciplinaryNote,
        addMorningDelay,
        updateMorningDelay,
        deleteMorningDelay,
        morningAttendance,
        toggleMorningAttendance,
        setMorningDelayMinutes,
        acknowledgeMorningRecord,
        addMorningDelaysBatch,
        addSchoolAbsence,
        updateSchoolAbsence,
        deleteSchoolAbsence,
        addSchoolAbsencesBatch,
        addTeacher,
        updateTeacher,
        updateTeacherCredentials,
        deleteTeacher,
        addCoach,
        updateCoach,
        deleteCoach,
        saveAttendanceSession,
        deleteAttendanceSession,
        saveAcademicGrade,
        saveBatchAcademicGrades,
        deleteAcademicGrade,
        addAcademicSubject,
        updateAcademicSubject,
        assignTeacherToSubject,
        deleteAcademicSubject,
        resetSubjectsToJuniorHighStandards,
        getStudentAcademicGrades,
        updateBellPeriod,
        addBellPeriod,
        deleteBellPeriod,
        resetBellPeriodsToDefault,
        getBellPeriodById,
        getCurrentOrNextBellPeriod,
        addStudentObservation,
        updateStudentObservation,
        deleteStudentObservation,
        getStudentObservations,
        getStudentNurturingDossier,
        saveDossierSectionEntry,
        deleteDossierSectionEntry,
        updateTemperamentOverview,
        updateNurturingSummaryOverview,
        saveCoachEvaluation,
        deleteCoachEvaluation,
        getStudentCoachEvaluations,
        saveTeacherEvaluation,
        deleteTeacherEvaluation,
        getTeacherEvaluations,
        addSchoolAnnouncement,
        deleteSchoolAnnouncement,
        updateSchoolAnnouncement,
        resetToDemoData,
        exportDatabaseJson,
        importDatabaseJson,
        toast,
        showToast,
        hideToast,
        confirmDialog,
        showConfirm,
        closeConfirm,
      }}
    >
      {children}
      <ToastNotification toast={toast} onClose={hideToast} />
      <GlobalConfirmModal dialog={confirmDialog} onClose={closeConfirm} />
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};
