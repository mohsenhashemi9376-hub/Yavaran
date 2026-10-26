import { subjectAppliesToClass } from '../utils/courseAssignments';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { baselessHomeworkRecords } from '../utils/homework';
import { 
  User, 
  SchoolClass, 
  Student, 
  AttendanceSession, 
  AcademicSubject, 
  StudentAcademicGrade, 
  DisciplinaryNote, 
  DisciplinaryStatus, 
  TeachingAssignment,
  MorningDelayRecord,
  MorningAttendanceRecord,
  GradePeriod,
  Workshop,
  LoanItem,
  ParentMeetingRecord,
  ReflectionPointRecord,
  AcademicFollowUpRecord,
  AcademicFollowUpStatus,
  GreyListRecord,
  GreySnapshot,
  ParentMeetingState,
  ParentMeetingNo,
  WorksheetRecord,
  WorksheetWeek,
  WorksheetStatus,
  SchoolHoliday,
  EntryTimeRecord,
  AcademicTerm,
  LessonPlan,
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
import { FollowUpConfig, mergeFollowUpConfig } from '../utils/academicFollowUp';
import { parentMeetingId, currentAcademicStartYear } from '../utils/parentMeetings';
import { toEnglishDigits, toPersianDigits, tehranNow, setServerClock, setActiveAcademicYear, getTodayShamsi, setViewDate as applyViewDate, setLateEntry as applyLateEntry, getEntryClock, getRealTodayShamsiString, getDaysInShamsiMonth } from '../utils/persianDate';
import { DEFAULT_ENTRY_TIME, delayFromEntryTime } from '../utils/morningAttendance';
import { closedReasonOf, normalizeShamsi, ClosedReason } from '../utils/schoolCalendar';
import { buildGradePeriodList, isPeriodOpenForSubject, openSubjectIdsOf } from '../utils/gradePeriods';
import { buildWorkshopList, workshopAsClass, workshopSubjectName } from '../utils/workshops';
import { SyncEngine, apiRequest, ApiError, BootstrapPayload, SyncRow } from '../lib/serverSync';
import { studentFullName, compareStudents, splitListName } from '../utils/studentName';
import { summarizeStudentDelays, delayDeductionState, delayDeductionId, DELAY_MINUTES_PER_POINT, DELAY_POINTS_DEDUCTED, formatMinutesLong } from '../utils/delays';

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
  /** ثبت ساعت واقعی ورود دانش‌آموز (HH:MM)؛ تأخیر نسبت به ۰۷:۰۰ دوباره محاسبه می‌شود */
  setMorningEntryTime: (recordId: string, entryTime: string) => void;
  /** ثبت موجه/غیرموجه و علت غیبت صبحگاه */
  setMorningAbsenceInfo: (student: Student, info: { isExcused?: boolean; absenceNote?: string }) => void;
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
  /** فهرست کامل بازه‌های ثبت نمره (فعال/قفل) */
  gradePeriods: GradePeriod[];
  workshops: Workshop[];
  loanItems: LoanItem[];
  parentMeetings: ParentMeetingRecord[];
  /** وضعیت پیگیری آموزشی دانش‌آموزان (فقط مدیر و معاونت آموزش) */
  academicFollowUps: AcademicFollowUpRecord[];
  /** تغییر وضعیت / یادداشت پیگیری؛ «باز» بدون یادداشت = حذف رکورد */
  setAcademicFollowUp: (student: Pick<Student, 'id' | 'classId'>, patch: { status?: AcademicFollowUpStatus; note?: string }) => void;
  /** معیارهای «نیازمند پیگیری آموزشی» (پیش‌فرض یا تنظیم‌شده‌ی معاون آموزش در بخش «پیشرفته») */
  followUpConfig: FollowUpConfig;
  saveFollowUpConfig: (config: FollowUpConfig) => void;
  /** لیست خاکستری آموزش (هر دانش‌آموز در هر ماه یک رکورد) */
  greyList: GreyListRecord[];
  /** ارسال دانش‌آموز به لیست خاکستری مربیان برای یک ماه (معاونت آموزش)؛ تصویر وضعیت آموزشی همان لحظه ثابت می‌ماند */
  sendToGreyList: (student: Pick<Student, 'id' | 'classId'>, snapshot: GreySnapshot, month: string) => void;
  /** برگرداندن دانش‌آموز از لیست خاکستری یک ماه (معاونت آموزش) */
  withdrawFromGreyList: (id: string) => void;
  /** علت ضعف، تاریخ پیگیری بعدی و افزودن اقدام (مربی / معاون تربیتی / معاونت آموزش) */
  updateGreyEntry: (id: string, patch: { causes?: string[]; causeOther?: string; nextFollowUp?: string | null; addAction?: string }) => void;
  /** گزارش نقاط تفکر (فقط معاون تربیتی و مربی) */
  reflectionPoints: ReflectionPointRecord[];
  /** ثبت تحویل / عدم تحویل و یادداشت نقاط تفکر برای یک دانش‌آموز در یک هفته؛ بدون تحویل و بدون یادداشت = حذف رکورد */
  setReflectionPoint: (student: Pick<Student, 'id' | 'classId'>, weekStart: string, patch: { delivered?: boolean; note?: string }) => void;
  parentMeetingStates: ParentMeetingState[];
  /** باز/بسته کردن جلسه‌ی عمومی اولیاء (فقط مدیر و معاون اجرایی) */
  setParentMeetingOpen: (meetingNo: ParentMeetingNo, open: boolean) => void;
  worksheets: WorksheetRecord[];
  worksheetWeeks: WorksheetWeek[];
  /** تعطیلی‌های اعلام‌شده؛ جمعه‌ها همیشه تعطیل‌اند و در این فهرست نیستند */
  schoolHolidays: SchoolHoliday[];
  /** جمعه یا تعطیلی اعلام‌شده؟ (حضور و غیاب آن روز بسته است و در محاسبات نمی‌آید) */
  isClosedDay: (date: string) => boolean;
  closedReasonOf: (date: string) => ClosedReason | null;
  /** امروز تعطیل است؟ */
  todayClosedReason: ClosedReason | null;
  /** روز انتخاب‌شده برای مشاهده‌ی اطلاعات گذشته (YYYY/MM/DD)؛ null = امروز */
  viewDate: string | null;
  /** مشاهده‌ی اطلاعات یک روز گذشته (فقط‌مشاهده)؛ null برای بازگشت به امروز */
  changeViewDate: (date: string | null) => Promise<boolean>;
  /** ثبت دیرهنگام: اجازه‌ی ثبت و ویرایش برای روز گذشته‌ی انتخاب‌شده */
  lateEntry: boolean;
  changeLateEntry: (on: boolean) => void;
  /** ساعت ورود تعیین‌شده برای هر روز (پیش‌فرض ۰۷:۰۰)؛ ورود پس از آن تأخیر است */
  entryTimes: EntryTimeRecord[];
  entryTimeFor: (date: string) => string;
  /** time = null: بازگشت به ساعت پیش‌فرض */
  setEntryTime: (date: string, time: string | null) => void;
  addSchoolHoliday: (date: string, title?: string | null) => void;
  removeSchoolHoliday: (date: string) => void;
  /** علامت‌گذاری کاربرگ هفتگی: status=null یعنی «تحویل نداده» (حذف رکورد) */
  setWorksheetStatus: (student: Pick<Student, 'id' | 'classId'>, weekStart: string, status: WorksheetStatus | null, note?: string | null) => void;
  markWorksheetsComplete: (students: Pick<Student, 'id' | 'classId'>[], weekStart: string) => void;
  setWorksheetDeadline: (weekStart: string, deadline: string | null) => void;
  /** ثبت حضور پدر/مادر در جلسه‌ی عمومی اولیاء (تاریخ را سرور خودکار می‌گذارد) */
  setParentMeetingAttendance: (student: Pick<Student, 'id' | 'classId'>, meetingNo: ParentMeetingNo, attendance: { father: boolean; mother: boolean }) => void;
  setParentMeetingAttendanceBulk: (students: Pick<Student, 'id' | 'classId'>[], meetingNo: ParentMeetingNo, attendance: { father: boolean; mother: boolean }) => void;
  clearParentMeetingAttendance: (studentId: string, meetingNo: ParentMeetingNo) => void;
  /** یادداشت مربی / معاون تربیتی روی گزارش حضور أولیا (بدون تغییر در حضور ثبت‌شده) */
  setParentMeetingNote: (student: Pick<Student, 'id' | 'classId'>, meetingNo: ParentMeetingNo, note: string) => void;
  addLoanItem: (data: Pick<LoanItem, 'itemName' | 'loanDate' | 'recipientName'> & { note?: string }) => string;
  updateLoanItem: (id: string, patch: Partial<Omit<LoanItem, 'id'>>) => void;
  deleteLoanItem: (id: string) => void;
  updateWorkshop: (id: string, patch: Partial<Omit<Workshop, 'id'>>) => void;
  addWorkshop: (data: Pick<Workshop, 'name' | 'category' | 'gradeLevel'> & { teacherId?: string; teacherName?: string }) => string;
  deleteWorkshop: (id: string) => void;
  setGradePeriodActive: (code: string, isActive: boolean) => void;
  /** باز/بسته کردن نمره‌ی یک ماه (بازه) برای یک درس مشخص */
  setGradePeriodSubjectOpen: (code: string, subjectId: string, open: boolean) => void;
  /** آیا ثبت نمره برای این بازه باز است؟ (مدیر و معاونین همیشه مجازند) */
  isGradePeriodOpen: (code: string, subjectId?: string) => boolean;
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
  /** طرح درس روزانه‌ی استاد (دبیر: طرح‌های خودش؛ معاونت آموزش: طرح‌های ارسال‌شده) */
  lessonPlans: LessonPlan[];
  saveLessonPlan: (plan: LessonPlan) => void;
  deleteLessonPlan: (id: string) => void;
  /** ثبت بازخورد و تأیید معاونت آموزش (تأیید نهایی با approved=true) */
  reviewLessonPlan: (id: string, review: { feedback: string; approved: boolean }) => void;
  /** تعریف دوره‌ی تحصیلی جدید (بدون انتقال خودکار دانش‌آموزان) */
  addAcademicTerm: (term: { name: string; startDate: string; endDate: string }) => boolean;
  /** انتقال انتخابی دانش‌آموزان به کلاس‌های دوره‌ی مقصد؛ تعداد انتقال‌های انجام‌شده را برمی‌گرداند */
  transferStudentsToTerm: (items: { studentId: string; destClassId: string }[]) => number;
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
  login: (username: string, password?: string) => Promise<{ success: boolean; message?: string; requiresTwoFactor?: boolean }>;
  verifyTwoFactor: (code: string, trustDevice?: boolean) => Promise<{ success: boolean; message?: string; restart?: boolean }>;
  security: { twoFactorEnabled: boolean; twoFactorRequired: boolean; reauthRequired: boolean; reauthEnabled: boolean; reauthMinutes: number };
  /** ورود دومرحله‌ای هنوز فعال نشده: سابقه‌ی مشاهده‌گری و پرونده‌های تربیتی نمایش داده نمی‌شود (ثبت مشاهده‌گری جدید آزاد است) */
  nurturingLocked: boolean;
  reloadAfterSecurityChange: () => Promise<void>;
  mustChangePassword: boolean;
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
  /** کلاس‌های تحت مسئولیت تربیتی مربی (بدون کلاس‌هایی که فقط درس می‌دهد) */
  nurturingClasses: SchoolClass[];
  accessibleSessions: AttendanceSession[];
  teachingAccessibleClasses: SchoolClass[];
  teachingAccessibleSessions: AttendanceSession[];
  /** کلاس‌های تحت مسئولیت تربیتی + کارگاه‌هایی که دانش‌آموز این کلاس‌ها در آن‌ها عضوند (برای گزارش درس و تکلیف) */
  nurturingSessionClasses: SchoolClass[];
  /** کلاس‌های عادی + کلاس‌های مجازی کارگاه‌ها (برای نمایش نام کلاس جلسه‌ها و گزارش‌ها) */
  sessionClasses: SchoolClass[];
  /** کلاس‌های مجازی همه کارگاه‌ها */
  workshopClasses: SchoolClass[];
  /** کلاس‌های مجازی کارگاه‌هایی که کاربر جاری مسئول آن‌هاست (مدیر/معاونین: همه) */
  myWorkshopClasses: SchoolClass[];
  /** انتساب «کلاس + درس» کارگاه‌های کاربر جاری (معادل teachingAssignments) */
  workshopAssignments: { subjectId: string; subjectName: string; classIds: string[] }[];
  /** دانش‌آموزان یک کلاس؛ برای کارگاه، اعضای تخصیص‌یافته به همان کارگاه */
  studentsOfClass: (classId: string) => Student[];
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
  resolveDelayDeduction: (studentId: string, approve: boolean) => void;
  updateStudentDiscipline: (studentId: string, score: number, status?: DisciplinaryStatus) => void;
  deleteDisciplinaryNote: (studentId: string, noteId: string) => void;
  /** ویرایش مورد انضباطی ثبت‌شده (فقط مدیر و معاون انضباطی)؛ نمره‌ی انضباط با اختلاف کسر جدید و قدیم تنظیم می‌شود */
  updateDisciplinaryNote: (studentId: string, noteId: string, patch: Partial<Pick<DisciplinaryNote, 'title' | 'description' | 'date' | 'type' | 'scoreDeduction'>>) => boolean;

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
  
  /** پاک‌سازی وضعیت‌های تکلیفِ بی‌مبنا؛ خروجی: تعداد رکورد اصلاح‌شده */
  clearBaselessHomeworkStatuses: () => number;
  /** تعداد رکوردهای تکلیفِ بی‌مبنا (بدون تغییر) */
  countBaselessHomeworkStatuses: () => number;
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
  /** وضعیت ذخیره‌ی تغییرات روی سرور */
  syncState: 'idle' | 'saving' | 'offline' | 'error';
  /** تعداد بسته‌های ذخیره‌نشده (مثلاً هنگام قطع اینترنت) */
  syncQueuedCount: number;
  /** تلاش فوری برای ارسال تغییرات در صف */
  retrySync: () => void;
  /** کد وضعیت آخرین ذخیره‌ی ناموفق (۰ = قطع ارتباط، ۴۰۳ = نبود دسترسی) */
  syncErrorStatus: number | null;
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
/** آرایه‌ی امن: مقدار null/undefined/نادرست از سرور به آرایه‌ی خالی تبدیل می‌شود تا هیچ بخشی از برنامه کرش نکند */
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** فیلدهای فهرستی کاربر (کلاس‌ها و انتساب‌های تدریس) همیشه آرایه‌ی معتبر باشند؛ داده‌ی ناقص قدیمی/همگام‌شده کل صفحه را سفید نکند */
const normalizeUser = (u: User): User => ({
  ...u,
  assignedClassIds: arr<string>(u.assignedClassIds),
  ...(u.teachingClassIds !== undefined ? { teachingClassIds: arr<string>(u.teachingClassIds) } : {}),
  ...(u.teachingAssignments !== undefined
    ? {
        teachingAssignments: arr<TeachingAssignment>(u.teachingAssignments)
          .filter((ta) => ta && typeof ta === 'object')
          .map((ta) => ({ ...ta, subjectName: ta.subjectName ?? '', classIds: arr<string>(ta.classIds) })),
      }
    : {}),
});

const normalizeClass = (c: SchoolClass): SchoolClass =>
  Array.isArray(c.teacherIds) && (c.coachIds === undefined || Array.isArray(c.coachIds))
    ? c
    : { ...c, teacherIds: arr<string>(c.teacherIds), ...(c.coachIds !== undefined ? { coachIds: arr<string>(c.coachIds) } : {}) };

/** رکوردهای حضور و غیاب خالی (null) یا ساختار نادرست حذف می‌شوند */
const normalizeSession = (s: AttendanceSession): AttendanceSession => {
  const r = s.records as unknown;
  if (r && typeof r === 'object' && !Array.isArray(r) && !Object.values(r as object).some((v) => !v)) return s;
  const entries = r && typeof r === 'object' && !Array.isArray(r) ? Object.entries(r as Record<string, unknown>).filter(([, v]) => v) : [];
  return { ...s, records: Object.fromEntries(entries) as AttendanceSession['records'] };
};

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
  const [rawStudents, setStudents] = useState<Student[]>([]);
  // همان‌چه در کادر «نام خانوادگی» و «نام» وارد شده بدون تغییر نگه داشته می‌شود و الفبایی بر اساس نام خانوادگی مرتب می‌شود
  const students = useMemo<Student[]>(
    () => [...rawStudents].sort(compareStudents),
    [rawStudents]
  );
  const [rawSessions, setSessions] = useState<AttendanceSession[]>([]);
  const [academicSubjects, setAcademicSubjects] = useState<AcademicSubject[]>([]);
  const [academicGrades, setAcademicGrades] = useState<StudentAcademicGrade[]>([]);
  const [rawMorningDelays, setMorningDelays] = useState<MorningDelayRecord[]>([]);
  const [rawMorningAttendance, setMorningAttendance] = useState<MorningAttendanceRecord[]>([]);
  const [rawSchoolAbsences, setSchoolAbsences] = useState<SchoolAbsenceRecord[]>([]);
  const [schoolHolidays, setSchoolHolidays] = useState<SchoolHoliday[]>([]);
  const [entryTimes, setEntryTimes] = useState<EntryTimeRecord[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const entryTimeFor = useCallback(
    (date: string) => entryTimes.find((e) => e.id === `ent-${normalizeShamsi(date).replace(/\//g, '-')}`)?.time || DEFAULT_ENTRY_TIME,
    [entryTimes]
  );

  // جمعه‌ها و روزهای تعطیل اعلام‌شده روز درسی نیستند: حضور و غیاب آن روزها در هیچ محاسبه‌ای نمی‌آید
  // (state خام فقط برای همگام‌سازی با سرور نگه داشته می‌شود)
  const isClosedDay = useCallback((date: string) => closedReasonOf(date, schoolHolidays) !== null, [schoolHolidays]);
  const sessions = useMemo(() => rawSessions.filter((r) => !isClosedDay(r.date)).map(normalizeSession), [rawSessions, isClosedDay]);
  const morningDelays = useMemo(() => rawMorningDelays.filter((r) => !isClosedDay(r.date)), [rawMorningDelays, isClosedDay]);
  const morningAttendance = useMemo(() => rawMorningAttendance.filter((r) => !isClosedDay(r.date)), [rawMorningAttendance, isClosedDay]);
  const schoolAbsences = useMemo(() => rawSchoolAbsences.filter((r) => !isClosedDay(r.date)), [rawSchoolAbsences, isClosedDay]);
  const [observations, setObservations] = useState<StudentObservation[]>([]);
  const [nurturingDossiers, setNurturingDossiers] = useState<Record<string, StudentNurturingDossier>>({});
  const [coachEvaluations, setCoachEvaluations] = useState<CoachGrowthEvaluation[]>([]);
  const [teacherEvaluations, setTeacherEvaluations] = useState<TeacherEvaluation[]>([]);
  const [schoolAnnouncements, setSchoolAnnouncements] = useState<SchoolAnnouncement[]>([]);
  const [comprehensiveExams, setComprehensiveExams] = useState<ComprehensiveExamRecord[]>([]);
  const [courseAssignments, setCourseAssignments] = useState<CourseAssignment[]>([]);
  const [storedGradePeriods, setStoredGradePeriods] = useState<GradePeriod[]>([]);
  const [storedWorkshops, setStoredWorkshops] = useState<Workshop[]>([]);
  const [viewDate, setViewDateState] = useState<string | null>(null);
  const [lateEntry, setLateEntryState] = useState(false);
  const [loanItems, setLoanItems] = useState<LoanItem[]>([]);
  const [parentMeetings, setParentMeetings] = useState<ParentMeetingRecord[]>([]);
  const [reflectionPoints, setReflectionPoints] = useState<ReflectionPointRecord[]>([]);
  const [academicFollowUps, setAcademicFollowUps] = useState<AcademicFollowUpRecord[]>([]);
  const [greyList, setGreyList] = useState<GreyListRecord[]>([]);
  const [parentMeetingStates, setParentMeetingStates] = useState<ParentMeetingState[]>([]);
  const [worksheets, setWorksheets] = useState<WorksheetRecord[]>([]);
  const [worksheetWeeks, setWorksheetWeeks] = useState<WorksheetWeek[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [security, setSecurity] = useState<{ twoFactorEnabled: boolean; twoFactorRequired: boolean; reauthRequired: boolean; reauthEnabled: boolean; reauthMinutes: number }>({ twoFactorEnabled: false, twoFactorRequired: false, reauthRequired: false, reauthEnabled: false, reauthMinutes: 30 });
  const nurturingLocked = (security.twoFactorRequired && !security.twoFactorEnabled) || security.reauthRequired;
  const workshops = useMemo(() => buildWorkshopList(storedWorkshops), [storedWorkshops]);
  const gradePeriods = useMemo(() => buildGradePeriodList(storedGradePeriods), [storedGradePeriods]);

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
      rawUsers.map(normalizeUser).map((u) => {
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
        const c = normalizeClass(cleaned && cleaned !== raw.name ? { ...raw, name: cleaned } : raw);
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
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'offline' | 'error'>('idle');
  const [syncErrorStatus, setSyncErrorStatus] = useState<number | null>(null);
  const [syncQueuedCount, setSyncQueuedCount] = useState(0);
  useEffect(() => {
    setSyncState(syncEngine.state);
    return syncEngine.subscribe(() => {
      setSyncState(syncEngine.state);
      setSyncErrorStatus(syncEngine.lastErrorStatus);
      setSyncQueuedCount(syncEngine.queuedCount);
    });
  }, [syncEngine]);

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
    const nextGradePeriods = (d.gradePeriods || []) as unknown as GradePeriod[];
    const nextWorkshops = (d.workshops || []) as unknown as Workshop[];
    const nextLoanItems = (d.loanItems || []) as unknown as LoanItem[];
    const nextParentMeetings = (d.parentMeetings || []) as unknown as ParentMeetingRecord[];
    const nextParentMeetingStates = (d.parentMeetingStates || []) as unknown as ParentMeetingState[];
    const nextReflectionPoints = (d.reflectionPoints || []) as unknown as ReflectionPointRecord[];
    const nextAcademicFollowUps = (d.academicFollowUps || []) as unknown as AcademicFollowUpRecord[];
    const nextGreyList = (d.greyList || []) as unknown as GreyListRecord[];
    const nextHolidays = (d.schoolHolidays || []) as unknown as SchoolHoliday[];
    const nextEntryTimes = (d.entryTimes || []) as unknown as EntryTimeRecord[];
    const nextLessonPlans = (d.lessonPlans || []) as unknown as LessonPlan[];
    const nextWorksheets = (d.worksheets || []) as unknown as WorksheetRecord[];
    const nextWorksheetWeeks = (d.worksheetWeeks || []) as unknown as WorksheetWeek[];
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
      gradePeriods: nextGradePeriods as unknown as SyncRow[],
      workshops: nextWorkshops as unknown as SyncRow[],
      loanItems: nextLoanItems as unknown as SyncRow[],
      parentMeetings: nextParentMeetings as unknown as SyncRow[],
      parentMeetingStates: nextParentMeetingStates as unknown as SyncRow[],
      reflectionPoints: nextReflectionPoints as unknown as SyncRow[],
      academicFollowUps: nextAcademicFollowUps as unknown as SyncRow[],
      greyList: nextGreyList as unknown as SyncRow[],
      worksheets: nextWorksheets as unknown as SyncRow[],
      schoolHolidays: nextHolidays as unknown as SyncRow[],
      entryTimes: nextEntryTimes as unknown as SyncRow[],
      lessonPlans: nextLessonPlans as unknown as SyncRow[],
      worksheetWeeks: nextWorksheetWeeks as unknown as SyncRow[],
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
    setStoredGradePeriods(nextGradePeriods);
    setStoredWorkshops(nextWorkshops);
    setLoanItems(nextLoanItems);
    setParentMeetings(nextParentMeetings);
    setParentMeetingStates(nextParentMeetingStates);
    setReflectionPoints(nextReflectionPoints);
    setAcademicFollowUps(nextAcademicFollowUps);
    setGreyList(nextGreyList);
    setWorksheets(nextWorksheets);
    setSchoolHolidays(nextHolidays);
    setEntryTimes(nextEntryTimes);
    setLessonPlans(nextLessonPlans);
    setWorksheetWeeks(nextWorksheetWeeks);
    setSecurity({ twoFactorEnabled: false, twoFactorRequired: false, reauthRequired: false, reauthEnabled: false, reauthMinutes: 30, ...(payload.security || {}) });
    setMustChangePassword(Boolean(payload.mustChangePassword));
    setGrades(nextGrades);
    setSchoolSettings(nextSettings);
    if (typeof payload.serverTime === 'number') setServerClock(payload.serverTime);
    setCurrentUserId(payload.userId || '');
    // تغییراتی که روی همین دستگاه (مثلاً در حالت آفلاین) ذخیره نشده‌اند، اول ارسال می‌شوند
    if (payload.userId) syncEngine.setUser(payload.userId);
    lastRefreshRef.current = Date.now();
    setAuthStatus('ready');
  }, [syncEngine]);

  const resetClientState = useCallback(() => {
    syncEngine.clear();
    syncEngine.setReadOnly(false);
    applyViewDate(null);
    applyLateEntry(false);
    setViewDateState(null);
    setLateEntryState(false);
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
    setStoredGradePeriods([]);
    setStoredWorkshops([]);
    setLoanItems([]);
    setParentMeetings([]);
    setParentMeetingStates([]);
    setReflectionPoints([]);
    setAcademicFollowUps([]);
    setGreyList([]);
    setWorksheets([]);
    setSchoolHolidays([]);
    setEntryTimes([]);
    setLessonPlans([]);
    setWorksheetWeeks([]);
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

  // پس از ارسال صفِ مانده از نشست قبلی، اطلاعات تازه از سرور گرفته می‌شود تا تغییرات ارسال‌شده دیده شوند
  useEffect(() => {
    syncEngine.onRestoredFlushed = () => { void loadFromServer(false); };
    return () => { syncEngine.onRestoredFlushed = null; };
  }, [syncEngine, loadFromServer]);

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

  // قفل خودکار پرونده‌های تربیتی پس از بی‌فعالیتی: فعالیت واقعی کاربر مهلت را در سرور تمدید می‌کند،
  // و در نبود فعالیت، پس از مهلت اطلاعات محرمانه از حافظه‌ی مرورگر پنهان و رمز دوباره خواسته می‌شود
  const reauthEnabled = security.reauthEnabled;
  const reauthLocked = security.reauthRequired;
  const reauthMinutes = security.reauthMinutes;
  useEffect(() => {
    if (authStatus !== 'ready' || !reauthEnabled || reauthLocked) return;
    const limit = Math.max(1, reauthMinutes) * 60_000;
    let lastActivity = Date.now();
    let lastPing = Date.now();
    const lockNow = () => setSecurity((prev) => (prev.reauthRequired ? prev : { ...prev, reauthRequired: true }));
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivity > limit) {
        lockNow();
        return;
      }
      lastActivity = now;
      // تمدید مهلت سرور حداکثر هر ۲ دقیقه، تا بدون فعالیت واقعی تمدید نشود
      if (now - lastPing > 120_000) {
        lastPing = now;
        apiRequest<{ fresh: boolean }>('POST', '/api/auth/keep-alive')
          .then((r) => { if (r && r.fresh === false) lockNow(); })
          .catch(() => {});
      }
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity > limit) lockNow();
    }, 15_000);
    return () => {
      events.forEach((name) => window.removeEventListener(name, onActivity));
      window.clearInterval(timer);
    };
  }, [authStatus, reauthEnabled, reauthLocked, reauthMinutes]);

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
  useEffect(() => { syncEngine.push('students', rawStudents as unknown as SyncRow[]); }, [rawStudents, syncEngine]);
  useEffect(() => { syncEngine.push('sessions', rawSessions as unknown as SyncRow[]); }, [rawSessions, syncEngine]);
  useEffect(() => { syncEngine.push('academicSubjects', academicSubjects as unknown as SyncRow[]); }, [academicSubjects, syncEngine]);
  useEffect(() => { syncEngine.push('academicGrades', academicGrades as unknown as SyncRow[]); }, [academicGrades, syncEngine]);
  useEffect(() => { syncEngine.push('morningDelays', rawMorningDelays as unknown as SyncRow[]); }, [rawMorningDelays, syncEngine]);
  useEffect(() => { syncEngine.push('morningAttendance', rawMorningAttendance as unknown as SyncRow[]); }, [rawMorningAttendance, syncEngine]);
  useEffect(() => { syncEngine.push('schoolAbsences', rawSchoolAbsences as unknown as SyncRow[]); }, [rawSchoolAbsences, syncEngine]);
  useEffect(() => { syncEngine.push('schoolHolidays', schoolHolidays as unknown as SyncRow[]); }, [schoolHolidays, syncEngine]);
  useEffect(() => { syncEngine.push('entryTimes', entryTimes as unknown as SyncRow[]); }, [entryTimes, syncEngine]);
  useEffect(() => { syncEngine.push('lessonPlans', lessonPlans as unknown as SyncRow[]); }, [lessonPlans, syncEngine]);
  useEffect(() => { syncEngine.push('observations', observations as unknown as SyncRow[]); }, [observations, syncEngine]);
  useEffect(() => { syncEngine.push('nurturingDossiers', dossiersToRows(nurturingDossiers)); }, [nurturingDossiers, syncEngine]);
  useEffect(() => { syncEngine.push('coachEvaluations', coachEvaluations as unknown as SyncRow[]); }, [coachEvaluations, syncEngine]);
  useEffect(() => { syncEngine.push('teacherEvaluations', teacherEvaluations as unknown as SyncRow[]); }, [teacherEvaluations, syncEngine]);
  useEffect(() => { syncEngine.push('schoolAnnouncements', schoolAnnouncements as unknown as SyncRow[]); }, [schoolAnnouncements, syncEngine]);
  useEffect(() => { syncEngine.push('courseAssignments', courseAssignments as unknown as SyncRow[]); }, [courseAssignments, syncEngine]);
  useEffect(() => { syncEngine.push('workshops', storedWorkshops as unknown as SyncRow[]); }, [storedWorkshops, syncEngine]);
  useEffect(() => { syncEngine.push('loanItems', loanItems as unknown as SyncRow[]); }, [loanItems, syncEngine]);
  useEffect(() => { syncEngine.push('parentMeetings', parentMeetings as unknown as SyncRow[]); }, [parentMeetings, syncEngine]);
  useEffect(() => { syncEngine.push('greyList', greyList as unknown as SyncRow[]); }, [greyList, syncEngine]);
  useEffect(() => { syncEngine.push('academicFollowUps', academicFollowUps as unknown as SyncRow[]); }, [academicFollowUps, syncEngine]);
  useEffect(() => { syncEngine.push('reflectionPoints', reflectionPoints as unknown as SyncRow[]); }, [reflectionPoints, syncEngine]);
  useEffect(() => { syncEngine.push('parentMeetingStates', parentMeetingStates as unknown as SyncRow[]); }, [parentMeetingStates, syncEngine]);
  useEffect(() => { syncEngine.push('worksheets', worksheets as unknown as SyncRow[]); }, [worksheets, syncEngine]);
  useEffect(() => { syncEngine.push('worksheetWeeks', worksheetWeeks as unknown as SyncRow[]); }, [worksheetWeeks, syncEngine]);
  useEffect(() => { syncEngine.push('gradePeriods', storedGradePeriods as unknown as SyncRow[]); }, [storedGradePeriods, syncEngine]);
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

  const lastBlockedToastRef = useRef(0);

  const enterReadOnly = () =>
    syncEngine.setReadOnly(true, () => {
      if (Date.now() - lastBlockedToastRef.current < 4000) return;
      lastBlockedToastRef.current = Date.now();
      showToast('در حالت مشاهده‌ی روزهای گذشته، تغییرات ذخیره نمی‌شود. برای ثبت، «ثبت دیرهنگام» را فعال کنید.', 'info');
    });

  /** ثبت دیرهنگام برای روز گذشته‌ی انتخاب‌شده را روشن/خاموش می‌کند (فقط وقتی روزی برای مشاهده انتخاب شده) */
  const changeLateEntry = (on: boolean) => {
    if (on && !viewDate) return;
    applyLateEntry(on);
    setLateEntryState(on);
    if (on) syncEngine.setReadOnly(false);
    else enterReadOnly();
  };

  /**
   * مشاهده‌ی اطلاعات ثبت‌شده در یک روز گذشته. «امروز» در کل سامانه همان روز می‌شود و داشبوردها داده‌ی آن روز را نشان می‌دهند.
   * در این حالت ویرایش و ثبت (با تاریخ همان روز) آزاد است؛ با بازگشت به امروز، داده‌ی سرور دوباره بارگذاری می‌شود.
   */
  const changeViewDate = async (date: string | null): Promise<boolean> => {
    const clean = date ? toEnglishDigits(date).trim() : null;
    const today = getRealTodayShamsiString();
    if (clean) {
      const hit = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(clean);
      if (!hit || Number(hit[2]) < 1 || Number(hit[2]) > 12 || Number(hit[3]) < 1 || Number(hit[3]) > getDaysInShamsiMonth(Number(hit[1]), Number(hit[2]))) {
        showToast('تاریخ را مثل 1405/07/19 وارد کنید.', 'error');
        return false;
      }
      const norm = `${hit[1]}/${hit[2].padStart(2, '0')}/${hit[3].padStart(2, '0')}`;
      if (norm > today) { showToast('تاریخ آینده قابل مشاهده نیست.', 'error'); return false; }
      if (norm === today) return changeViewDate(null);
      await syncEngine.flush(); // تغییرات در صف، پیش از ورود به حالت مشاهده ذخیره شود
      // روز گذشته به‌صورت پیش‌فرض قابل ویرایش است (ثبت با تاریخ همان روز)؛ با «توقف ثبت دیرهنگام» می‌شود فقط‌مشاهده کرد
      applyViewDate(norm);
      setViewDateState(norm);
      applyLateEntry(true);
      setLateEntryState(true);
      syncEngine.setReadOnly(false);
      return true;
    }
    applyViewDate(null);
    applyLateEntry(false);
    setViewDateState(null);
    setLateEntryState(false);
    await loadFromServer(false); // حذف هر تغییر محلیِ ذخیره‌نشده و بازگشت به داده‌ی سرور
    syncEngine.setReadOnly(false);
    return true;
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

  const nurturingClasses = isCoach
    ? classes.filter(
        (c) =>
          (currentUser.assignedClassIds || []).includes(c.id) ||
          c.coachId === currentUser.id ||
          (c.coachIds || []).includes(currentUser.id)
      )
    : classes;

  // کارگاه‌ها: هر کارگاه یک کلاس مجازی است (جلسه، حضور و غیاب و گزارش دقیقاً مثل کلاس‌های عادی)
  const workshopClasses = useMemo(() => workshops.map(workshopAsClass), [workshops]);
  const sessionClasses = useMemo(() => [...classes, ...workshopClasses], [classes, workshopClasses]);
  const isManagerRole = isAdmin || isEducationalVice || isDisciplinaryVice || isNurturingVice;
  const myWorkshops = isManagerRole ? workshops : workshops.filter((w) => w.teacherId === currentUser.id);
  const myWorkshopClasses = myWorkshops.map(workshopAsClass);
  const workshopAssignments = workshops
    .filter((w) => w.teacherId === currentUser.id)
    .map((w) => ({ subjectId: `ws-subject-${w.id}`, subjectName: workshopSubjectName(w), classIds: [w.id] }));
  const studentsOfClass = (classId: string): Student[] => {
    const w = workshops.find((x) => x.id === classId);
    if (!w) return students.filter((s) => s.classId === classId);
    const members = new Set(w.studentIds);
    return students.filter((s) => members.has(s.id));
  };

  const nurturingSessionClasses = (() => {
    if (!isCoach) return [...nurturingClasses, ...workshopClasses];
    const own = new Set(nurturingClasses.map((c) => c.id));
    const ownStudentIds = new Set(students.filter((st) => own.has(st.classId)).map((st) => st.id));
    const related = workshops.filter((w) => w.studentIds.some((id) => ownStudentIds.has(id))).map(workshopAsClass);
    return [...nurturingClasses, ...related];
  })();

  const accessibleClassIds = new Set([...accessibleClasses, ...myWorkshopClasses].map((c) => c.id));

  // دبیر فقط جلسات خودش را می‌بیند: جلسه‌ای که خودش ثبت کرده یا درسی که در همان کلاس به او واگذار شده
  // (جلسات سایر دبیران در همان کلاس‌ها نمایش داده نمی‌شود)
  const isOwnTeachingSession = (s: AttendanceSession): boolean =>
    s.teacherId === currentUser.id ||
    (currentUser.teachingAssignments || []).some(
      (ta) =>
        ta.classIds.includes(s.classId) &&
        ((s.subjectId && ta.subjectId === s.subjectId) || (!s.subjectId && ta.subjectName === s.subject))
    );

  const accessibleSessions = isTeacher
    ? sessions.filter((s) => accessibleClassIds.has(s.classId) && isOwnTeachingSession(s))
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
      myWorkshopClasses.length > 0 ||
      (currentUser.teachingClassIds || []).length > 0 ||
      (currentUser.teachingAssignments || []).some((ta) => ta.classIds.length > 0));

  const teachingAccessibleClasses = isTeacher
    ? classes.filter(
        (c) =>
          currentUser.assignedClassIds.includes(c.id) ||
          c.teacherIds.includes(currentUser.id)
      ).concat(myWorkshopClasses)
    : hasTeachingLoad
    ? classes.filter((c) => {
        const directClassIds = currentUser.teachingClassIds || [];
        const assignmentClassIds = (currentUser.teachingAssignments || []).flatMap((ta) => ta.classIds);
        return (
          directClassIds.includes(c.id) ||
          assignmentClassIds.includes(c.id) ||
          c.teacherIds.includes(currentUser.id)
        );
      }).concat(myWorkshopClasses)
    : isAdminOrVice
    ? [...classes, ...workshopClasses]
    : [];

  const teachingClassIdsSet = new Set(teachingAccessibleClasses.map((c) => c.id));

  // Sessions accessible for teaching view
  const teachingAccessibleSessions = isTeacher
    ? sessions.filter((s) => teachingClassIdsSet.has(s.classId) && isOwnTeachingSession(s))
    : hasTeachingLoad
    ? sessions.filter((s) => teachingClassIdsSet.has(s.classId) && isOwnTeachingSession(s))
    : isAdminOrVice
    ? sessions
    : [];

  const canTeachClassAndSubject = (classId: string, subjectNameOrId?: string): boolean => {
    if (isAdmin || isEducationalVice) return true;
    if (workshops.some((w) => w.id === classId && w.teacherId === currentUser.id)) return true;
    // مربی: برای کلاس‌های تحت پوشش خودش نمره‌ی همه‌ی دروس را می‌بیند و ویرایش می‌کند
    if (isCoach) return nurturingClasses.some((c) => c.id === classId);
    if (isTeacher) {
      const teachesClass = currentUser.assignedClassIds.includes(classId) || classes.find((c) => c.id === classId)?.teacherIds.includes(currentUser.id);
      if (!teachesClass) return false;
      if (!subjectNameOrId) return true;
      // فقط درسی که در همین کلاس به این دبیر واگذار شده است
      return (currentUser.teachingAssignments || []).some(
        (ta) =>
          ta.classIds.includes(classId) &&
          (ta.subjectId === subjectNameOrId || ta.subjectName === subjectNameOrId)
      );
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
  const login = async (username: string, password?: string): Promise<{ success: boolean; message?: string; requiresTwoFactor?: boolean }> => {
    const cleanUsername = username.trim();
    const cleanPassword = (password || '').trim();

    if (!cleanUsername) {
      return { success: false, message: 'کاربری با این نام کاربری یافت نشد.' };
    }

    try {
      await syncEngine.flush();
      const res = await apiRequest<{ requiresTwoFactor?: boolean }>('POST', '/api/auth/login', { username: cleanUsername, password: cleanPassword });
      if (res && res.requiresTwoFactor) {
        // رمز درست است؛ منتظر کد مرحله‌ی دوم
        return { success: false, requiresTwoFactor: true };
      }
      await loadFromServer(false);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof ApiError ? error.message : 'نام کاربری یا رمز عبور اشتباه است.',
      };
    }
  };

  const verifyTwoFactor = async (code: string, trustDevice = false): Promise<{ success: boolean; message?: string; restart?: boolean }> => {
    try {
      await apiRequest('POST', '/api/auth/two-factor', { code: code.trim(), trustDevice });
      await loadFromServer(false);
      return { success: true };
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      const message = error instanceof ApiError ? error.message : 'کد وارد‌شده درست نیست.';
      return { success: false, message, restart: status === 429 || message.includes('دوباره وارد شوید') };
    }
  };

  /** پس از فعال‌سازی ورود دومرحله‌ای، داده‌های محافظت‌شده (پرونده‌های تربیتی) دوباره دریافت می‌شود */
  const reloadAfterSecurityChange = async () => {
    await loadFromServer(false);
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
    showToast(`دانش‌آموز «${targetStudent ? `${studentFullName(targetStudent)}` : ''}» از کلاس خارج شد (سوابق و پرونده در سامانه حفظ گردید).`, 'info');
  };

  const transferStudentClass = (studentId: string, newClassId: string) => {
    const targetStudent = students.find((s) => s.id === studentId);
    const targetClass = classes.find((c) => c.id === newClassId);
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, classId: newClassId } : s))
    );
    showToast(`دانش‌آموز «${targetStudent ? `${studentFullName(targetStudent)}` : ''}» به کلاس «${targetClass ? targetClass.name : ''}» منتقل شد.`);
  };

  const assignStudentToClass = (studentId: string, classId: string) => {
    const targetStudent = students.find((s) => s.id === studentId);
    const targetClass = classes.find((c) => c.id === classId);
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, classId } : s))
    );
    showToast(`دانش‌آموز «${targetStudent ? `${studentFullName(targetStudent)}` : ''}» به کلاس «${targetClass ? targetClass.name : ''}» اضافه شد.`);
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
    showToast(`دانش‌آموز «${studentFullName(newStudent)}» با موفقیت ثبت شد.`);
    return id;
  };

  const addStudentsBatch = (classId: string, fullNames: string[]) => {
    const newStudents: Student[] = fullNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((fullName, idx) => {
        // فهرست کلاسی: «نام‌خانوادگی نام» ← آخرین کلمه نام، بقیه نام خانوادگی
        const split = splitListName(fullName);
        const firstName = split.firstName || 'دانش‌آموز';
        const lastName = split.lastName || `شماره ${idx + 1}`;
        const randomCode = Math.floor(10000000 + Math.random() * 90000000).toString();
        return {
          id: `stu-${Date.now()}-${idx}`,
          classId,
          studentCode: randomCode.slice(0, 8),
          nationalId: `00${randomCode}`,
          firstName,
          lastName,
          nameFormat: 'v2',
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
        ? `دانش‌آموز «${studentFullName(target)}» و تمام سوابق او حذف شد.`
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

  /**
   * تأیید یا رد پیشنهاد کسر نمره بابت مجموع تأخیرها (هر ۱۲۰ دقیقه، ۱ نمره) توسط معاون انضباطی.
   * تأیید: نمره کم می‌شود و یادداشت انضباطی ثبت می‌شود؛ رد: فقط پیشنهاد بسته می‌شود (نمره‌ی صفر).
   */
  const resolveDelayDeduction = (studentId: string, approve: boolean) => {
    if (!(isAdmin || isDisciplinaryVice)) {
      showToast('فقط معاون انضباطی می‌تواند کسر نمره بابت تأخیر را تأیید کند.', 'error');
      return;
    }
    const today = getTodayShamsi().formattedDate;
    let applied = false;
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const { minutes } = summarizeStudentDelays(s, { morningDelays, morningAttendance, sessions });
        const state = delayDeductionState(s.disciplinaryNotes, minutes);
        if (state.pending <= 0) return s;
        applied = true;
        const note: DisciplinaryNote = {
          id: delayDeductionId(s.id, state.nextIndex),
          date: today,
          title: approve ? 'کسر نمره انضباط بابت مجموع تأخیرها' : 'پیشنهاد کسر نمره بابت تأخیر رد شد',
          description: approve
            ? `مجموع تأخیرها به ${toPersianDigits(formatMinutesLong(state.nextIndex * DELAY_MINUTES_PER_POINT))} رسید؛ ${toPersianDigits(DELAY_POINTS_DEDUCTED)} نمره با تأیید معاون انضباطی کسر شد.`
            : 'معاون انضباطی کسر نمره‌ی این بازه از تأخیرها را تأیید نکرد.',
          scoreDeduction: approve ? DELAY_POINTS_DEDUCTED : 0,
          recordedBy: currentUser.name,
          type: 'delay',
          source: approve ? 'approved_delay' : 'delay_dismissed',
        };
        const score = Math.max(0, Math.min(20, (s.disciplineScore ?? 20) - note.scoreDeduction));
        return { ...s, disciplineScore: score, disciplinaryNotes: [note, ...(s.disciplinaryNotes || [])] };
      })
    );
    if (applied) showToast(approve ? 'کسر نمره تأیید و ثبت شد.' : 'پیشنهاد کسر نمره رد شد.');
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

  const updateDisciplinaryNote = (studentId: string, noteId: string, patch: Partial<Pick<DisciplinaryNote, 'title' | 'description' | 'date' | 'type' | 'scoreDeduction'>>): boolean => {
    if (!(isAdmin || isDisciplinaryVice)) {
      showToast('فقط مدیر و معاون انضباطی می‌تواند مورد انضباطی را ویرایش کند.', 'error');
      return false;
    }
    const target = students.find((s) => s.id === studentId)?.disciplinaryNotes?.find((n) => n.id === noteId);
    if (!target) return false;
    if (target.source === 'auto_delay' || target.source === 'approved_delay' || target.source === 'delay_dismissed') {
      showToast('کسر نمره‌ی تأخیر خودکار است و از این بخش قابل ویرایش نیست.', 'info');
      return false;
    }
    const nextDeduction = patch.scoreDeduction !== undefined ? Math.max(0, Math.min(20, Number(patch.scoreDeduction) || 0)) : target.scoreDeduction || 0;
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const delta = (target.scoreDeduction || 0) - nextDeduction;
        return {
          ...s,
          disciplineScore: Math.max(0, Math.min(20, (s.disciplineScore ?? 20) + delta)),
          disciplinaryNotes: (s.disciplinaryNotes || []).map((n) =>
            n.id === noteId ? { ...n, ...patch, scoreDeduction: nextDeduction, editedBy: currentUser.name, editedAt: new Date().toISOString() } : n
          ),
        };
      })
    );
    showToast('مورد انضباطی ویرایش شد.');
    return true;
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
    const nowIso = new Date().toISOString();
    const entryTime = getEntryClock();

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
        delayMinutes: delayFromEntryTime(entryTime, entryTimeFor(today.formattedDate)),
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

  const setMorningEntryTime = (recordId: string, entryTime: string) => {
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(entryTime)) return;
    const hhmm = entryTime.padStart(5, '0');
    setMorningAttendance((prev) =>
      prev.map((r) =>
        r.id === recordId && r.status === 'present'
          ? { ...r, entryTime: hhmm, delayMinutes: delayFromEntryTime(hhmm, entryTimeFor(r.date)), delayManuallyAdjusted: false, updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const setMorningAbsenceInfo = (student: Student, info: { isExcused?: boolean; absenceNote?: string }) => {
    const today = getTodayShamsi();
    const id = morningRecordId(today.formattedDate, student.id);
    const nowIso = new Date().toISOString();
    setMorningAttendance((prev) => {
      const existing = prev.find((r) => r.id === id);
      if (existing) {
        return prev.map((r) => (r.id === id ? { ...r, ...info, updatedAt: nowIso } : r));
      }
      // غیبتِ ضمنی با ثبت موجه/یادداشت به رکورد غایب تبدیل می‌شود
      const created: MorningAttendanceRecord = {
        id,
        studentId: student.id,
        classId: student.classId,
        date: today.formattedDate,
        dayOfWeek: today.dayOfWeek,
        status: 'absent',
        delayMinutes: 0,
        isAcknowledged: false,
        isExcused: false,
        ...info,
        recordedBy: currentUser.name,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      return [created, ...prev];
    });
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

  // ------------------------------------------------------------------
  // بازه‌های ثبت نمره (فعال/قفل توسط معاون آموزش)
  // ------------------------------------------------------------------
  const setGradePeriodActive = (code: string, isActive: boolean) => {
    const base = gradePeriods.find((p) => p.code === code);
    if (!base) return;
    setStoredGradePeriods((prev) => {
      const exists = prev.some((p) => (p.code || p.id) === code);
      // باز کردن کل بازه یعنی همه‌ی دروس؛ بستن آن، انتخاب دروس را هم پاک می‌کند
      const next: GradePeriod = { ...base, isActive, openSubjectIds: null };
      return exists ? prev.map((p) => ((p.code || p.id) === code ? { ...p, ...next } : p)) : [...prev, next];
    });
  };

  const setGradePeriodSubjectOpen = (code: string, subjectId: string, open: boolean) => {
    const base = gradePeriods.find((p) => p.code === code);
    if (!base) return;
    const all = academicSubjects.map((s) => s.id);
    const current = new Set(openSubjectIdsOf(base, academicSubjects));
    if (open) current.add(subjectId);
    else current.delete(subjectId);
    const ids = all.filter((id) => current.has(id));
    const next: GradePeriod = {
      ...base,
      isActive: ids.length > 0,
      openSubjectIds: ids.length === 0 || ids.length === all.length ? null : ids,
    };
    setStoredGradePeriods((prev) => {
      const exists = prev.some((p) => (p.code || p.id) === code);
      return exists ? prev.map((p) => ((p.code || p.id) === code ? { ...p, ...next } : p)) : [...prev, next];
    });
  };

  const updateWorkshop = (id: string, patch: Partial<Omit<Workshop, 'id'>>) => {
    const base = workshops.find((w) => w.id === id);
    if (!base) return;
    setStoredWorkshops((prev) => {
      const exists = prev.some((w) => w.id === id);
      return exists ? prev.map((w) => (w.id === id ? { ...w, ...patch } : w)) : [...prev, { ...base, ...patch }];
    });
  };

  // حضور اولیا در جلسات عمومی: تاریخ ثبت خودکار است (امروزِ واقعی)؛ پس از اولین ثبت تغییر نمی‌کند
  const upsertParentMeeting = (
    list: ParentMeetingRecord[],
    student: Pick<Student, 'id' | 'classId'>,
    meetingNo: ParentMeetingNo,
    attendance: { father: boolean; mother: boolean },
  ): ParentMeetingRecord[] => {
    const year = String(currentAcademicStartYear());
    const id = parentMeetingId(year, meetingNo, student.id);
    const old = list.find((r) => r.id === id);
    const record: ParentMeetingRecord = {
      id,
      studentId: student.id,
      classId: student.classId,
      academicYear: year,
      meetingNo,
      father: attendance.father,
      mother: attendance.mother,
      hasAttendance: true,
      date: old?.hasAttendance !== false && old?.date ? old.date : getRealTodayShamsiString(),
      note: old?.note ?? null,
      noteBy: old?.noteBy ?? null,
      noteById: old?.noteById ?? null,
      noteAt: old?.noteAt ?? null,
      recordedById: currentUser.id,
      recordedBy: currentUser.name,
      updatedAt: new Date().toISOString(),
    };
    return old ? list.map((r) => (r.id === id ? record : r)) : [...list, record];
  };

  const setParentMeetingAttendance: SchoolContextType['setParentMeetingAttendance'] = (student, meetingNo, attendance) => {
    setParentMeetings((prev) => upsertParentMeeting(prev, student, meetingNo, attendance));
  };

  const setParentMeetingAttendanceBulk: SchoolContextType['setParentMeetingAttendanceBulk'] = (list, meetingNo, attendance) => {
    setParentMeetings((prev) => list.reduce((acc, st) => upsertParentMeeting(acc, st, meetingNo, attendance), prev));
  };

  const clearParentMeetingAttendance: SchoolContextType['clearParentMeetingAttendance'] = (studentId, meetingNo) => {
    const id = parentMeetingId(String(currentAcademicStartYear()), meetingNo, studentId);
    // اگر یادداشت دارد، فقط حضور پاک می‌شود و یادداشت می‌ماند
    setParentMeetings((prev) =>
      prev.flatMap((r) => (r.id !== id ? [r] : r.note ? [{ ...r, father: false, mother: false, hasAttendance: false, date: null }] : []))
    );
  };

  const setParentMeetingNote: SchoolContextType['setParentMeetingNote'] = (student, meetingNo, note) => {
    const year = String(currentAcademicStartYear());
    const id = parentMeetingId(year, meetingNo, student.id);
    const text = note.trim();
    setParentMeetings((prev) => {
      const old = prev.find((r) => r.id === id);
      if (!old && !text) return prev;
      const base: ParentMeetingRecord = old ?? {
        id, studentId: student.id, classId: student.classId, academicYear: year, meetingNo,
        father: false, mother: false, hasAttendance: false, date: null,
      };
      // یادداشت پاک‌شده روی رکوردِ بدون حضور → کل رکورد حذف می‌شود
      if (!text && base.hasAttendance === false) return prev.filter((r) => r.id !== id);
      const next: ParentMeetingRecord = {
        ...base,
        note: text || null,
        noteBy: text ? currentUser.name : null,
        noteById: text ? currentUser.id : null,
        noteAt: text ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };
      return old ? prev.map((r) => (r.id === id ? next : r)) : [...prev, next];
    });
  };

  const setParentMeetingOpen: SchoolContextType['setParentMeetingOpen'] = (meetingNo, open) => {
    const year = String(currentAcademicStartYear());
    const id = `pms-${year}-${meetingNo}`;
    const now = new Date().toISOString();
    setParentMeetingStates((prev) => {
      const old = prev.find((s) => s.id === id);
      const next: ParentMeetingState = {
        id, academicYear: year, meetingNo, open,
        openedAt: open ? (old?.open ? old.openedAt : now) : old?.openedAt ?? null,
        closedAt: open ? null : old?.open ? now : old?.closedAt ?? null,
        changedBy: currentUser.name, changedById: currentUser.id, updatedAt: now,
      };
      return old ? prev.map((s) => (s.id === id ? next : s)) : [...prev, next];
    });
  };

  const setAcademicFollowUp: SchoolContextType['setAcademicFollowUp'] = (student, patch) => {
    const id = `afu-${student.id}`;
    setAcademicFollowUps((prev) => {
      const old = prev.find((r) => r.id === id);
      const status = patch.status ?? old?.status ?? 'open';
      const note = (patch.note !== undefined ? patch.note : old?.note ?? '').trim();
      if (status === 'open' && !note) return old ? prev.filter((r) => r.id !== id) : prev;
      const next: AcademicFollowUpRecord = { id, studentId: student.id, classId: student.classId, status, note: note || null, updatedById: currentUser.id, updatedBy: currentUser.name, updatedAt: new Date().toISOString() };
      return old ? prev.map((r) => (r.id === id ? next : r)) : [...prev, next];
    });
  };

  const followUpConfig = useMemo(
    () => mergeFollowUpConfig((academicFollowUps.find((r) => r.id === 'afu-config') as unknown as { config?: Partial<FollowUpConfig> } | undefined)?.config),
    [academicFollowUps]
  );
  const saveFollowUpConfig: SchoolContextType['saveFollowUpConfig'] = (config) => {
    const record = { id: 'afu-config', studentId: '', classId: '', status: 'open', config, updatedBy: currentUser.name, updatedAt: new Date().toISOString() } as unknown as AcademicFollowUpRecord;
    setAcademicFollowUps((prev) => (prev.some((r) => r.id === 'afu-config') ? prev.map((r) => (r.id === 'afu-config' ? record : r)) : [...prev, record]));
  };

  const greyId = (studentId: string, month: string) => `gl-${studentId}-${month.replace('/', '-')}`;

  const sendToGreyList: SchoolContextType['sendToGreyList'] = (student, snapshot, month) => {
    const id = greyId(student.id, month);
    setGreyList((prev) =>
      prev.some((r) => r.id === id)
        ? prev
        : [...prev, { id, studentId: student.id, classId: student.classId, month, snapshot, causes: [], actions: [], nextFollowUp: null, sentBy: currentUser.name, sentById: currentUser.id, sentAt: new Date().toISOString() }]
    );
  };

  const withdrawFromGreyList: SchoolContextType['withdrawFromGreyList'] = (id) => setGreyList((prev) => prev.filter((r) => r.id !== id));

  const updateGreyEntry: SchoolContextType['updateGreyEntry'] = (id, patch) => {
    const now = new Date().toISOString();
    setGreyList((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const actions = patch.addAction?.trim()
          ? [...r.actions, { id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`, text: patch.addAction.trim(), at: now, by: currentUser.name, byId: currentUser.id }]
          : r.actions;
        return {
          ...r,
          causes: patch.causes ?? r.causes,
          causeOther: patch.causeOther !== undefined ? patch.causeOther.trim() || null : r.causeOther,
          nextFollowUp: patch.nextFollowUp !== undefined ? patch.nextFollowUp : r.nextFollowUp,
          actions,
          updatedBy: currentUser.name,
          updatedAt: now,
        };
      })
    );
  };

  // نقاط تفکر: پیش‌فرض «تحویل نداده» است؛ رکورد فقط وقتی ساخته می‌شود که تحویل داده شده یا یادداشتی هست
  const setReflectionPoint: SchoolContextType['setReflectionPoint'] = (student, weekStart, patch) => {
    const id = `rp-${student.id}-${weekStart.replace(/\//g, '-')}`;
    setReflectionPoints((prev) => {
      const old = prev.find((r) => r.id === id);
      const delivered = patch.delivered ?? old?.delivered ?? false;
      const note = (patch.note !== undefined ? patch.note : old?.note ?? '').trim();
      if (!delivered && !note) return old ? prev.filter((r) => r.id !== id) : prev;
      const next: ReflectionPointRecord = {
        id, studentId: student.id, classId: student.classId, weekStart, delivered, note: note || null,
        recordedById: currentUser.id, recordedBy: currentUser.name, updatedAt: new Date().toISOString(),
      };
      return old ? prev.map((r) => (r.id === id ? next : r)) : [...prev, next];
    });
  };

  // امانات و لوازم
  const addLoanItem: SchoolContextType['addLoanItem'] = (data) => {
    const id = `loan-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const item: LoanItem = {
      id,
      itemName: data.itemName.trim(),
      loanDate: data.loanDate,
      recipientName: data.recipientName.trim(),
      note: data.note?.trim() || undefined,
      returned: false,
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name,
    };
    setLoanItems((prev) => [item, ...prev]);
    return id;
  };

  const updateLoanItem = (id: string, patch: Partial<Omit<LoanItem, 'id'>>) => {
    setLoanItems((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const deleteLoanItem = (id: string) => {
    setLoanItems((prev) => prev.filter((l) => l.id !== id));
  };

  const addWorkshop: SchoolContextType['addWorkshop'] = (data) => {
    const id = `ws-c${Date.now()}`;
    setStoredWorkshops((prev) => [...prev, { id, studentIds: [], ...data, name: data.name.trim() }]);
    return id;
  };

  const deleteWorkshop = (id: string) => {
    setStoredWorkshops((prev) => prev.filter((w) => w.id !== id));
  };

  const isGradePeriodOpen = (code: string, subjectId?: string): boolean => {
    const managerRole = ['admin', 'vice_educational', 'vice_principal'].includes(currentUser.role);
    if (managerRole) return true;
    return isPeriodOpenForSubject(gradePeriods.find((p) => p.code === code), subjectId);
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
    const studentName = delayData.studentName || (targetStudent ? `${studentFullName(targetStudent)}` : undefined);

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

  const saveLessonPlan = (plan: LessonPlan) => {
    const next: LessonPlan = { ...plan, teacherId: currentUser.id, teacherName: currentUser.name, updatedAt: new Date().toISOString() };
    setLessonPlans((prev) => (prev.some((p) => p.id === next.id) ? prev.map((p) => (p.id === next.id ? next : p)) : [next, ...prev]));
  };

  const deleteLessonPlan = (id: string) => setLessonPlans((prev) => prev.filter((p) => p.id !== id));

  const reviewLessonPlan = (id: string, review: { feedback: string; approved: boolean }) => {
    setLessonPlans((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: review.approved ? 'approved' : 'submitted', review: { ...review, reviewerId: currentUser.id, reviewerName: currentUser.name, reviewedAt: new Date().toISOString() } }
          : p
      )
    );
  };

  const addAcademicTerm = (term: { name: string; startDate: string; endDate: string }): boolean => {
    const name = toEnglishDigits(term.name.trim());
    const start = Number((name.match(/^(\d{4})-(\d{4})$/) || [])[1]);
    if (!start || Number(name.slice(5)) !== start + 1) {
      showToast('نام دوره را به‌صورت «۱۴۰۶-۱۴۰۷» وارد کنید.', 'error');
      return false;
    }
    const exists = (schoolSettings.academicTerms || []).some((t) => toEnglishDigits(t.name) === name) || toEnglishDigits(schoolSettings.academicYear || '') === name;
    if (exists) {
      showToast(`دوره‌ی «${toPersianDigits(name)}» قبلاً تعریف شده است.`, 'info');
      return false;
    }
    const entry: AcademicTerm = { id: `term-${start}`, name: toPersianDigits(name), startDate: toEnglishDigits(term.startDate), endDate: toEnglishDigits(term.endDate), createdAt: new Date().toISOString() };
    setSchoolSettings((prev) => ({ ...prev, academicTerms: [...(prev.academicTerms || []), entry] }));
    showToast(`دوره‌ی تحصیلی «${entry.name}» ایجاد شد. دانش‌آموزی به‌صورت خودکار منتقل نمی‌شود.`, 'success');
    return true;
  };

  const transferStudentsToTerm = (items: { studentId: string; destClassId: string }[]): number => {
    const nowIso = new Date().toISOString();
    const already = new Set(rawStudents.map((s) => s.rolledOverFromId).filter(Boolean) as string[]);
    const created: Student[] = [];
    items.forEach((it, i) => {
      const src = rawStudents.find((s) => s.id === it.studentId);
      if (!src || already.has(src.id) || !rawClasses.some((c) => c.id === it.destClassId)) return;
      already.add(src.id);
      created.push({
        ...src,
        id: `stu-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
        classId: it.destClassId,
        disciplineScore: 20,
        disciplinaryStatus: 'normal',
        disciplinaryNotes: [],
        rolledOverFromId: src.id,
        rolledOverAt: nowIso,
        createdAt: undefined,
      });
    });
    if (created.length === 0) return 0;
    setStudents((prev) => [...prev, ...created]);
    showToast(`${created.length} دانش‌آموز به دوره‌ی جدید منتقل شد.`, 'success');
    return created.length;
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

  /** حذف وضعیت‌های «انجام شده»ی پیش‌فرض قدیمی که تکلیفی برای ارزیابی نداشته‌اند؛ تعداد رکوردهای اصلاح‌شده را برمی‌گرداند */
  const clearBaselessHomeworkStatuses = (): number => {
    const targets = baselessHomeworkRecords(sessions);
    if (targets.size === 0) return 0;
    let count = 0;
    targets.forEach((ids) => { count += ids.length; });
    setSessions((prev) =>
      prev.map((s) => {
        const ids = targets.get(s.id);
        if (!ids) return s;
        const records = { ...s.records };
        ids.forEach((id) => {
          const { homeworkStatus: _removed, ...rest } = records[id];
          records[id] = rest;
        });
        return { ...s, records };
      })
    );
    return count;
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
  // ----------------------------------------------------------------
  // کاربرگ هفتگی
  // ----------------------------------------------------------------
  const worksheetId = (studentId: string, weekStart: string) => `ws-${studentId}-${weekStart.replace(/\//g, '-')}`;

  const setWorksheetStatus = (
    student: Pick<Student, 'id' | 'classId'>,
    weekStart: string,
    status: WorksheetStatus | null,
    note?: string | null,
  ) => {
    const id = worksheetId(student.id, weekStart);
    setWorksheets((prev) => {
      const rest = prev.filter((r) => r.id !== id);
      const old = prev.find((r) => r.id === id);
      const nextNote = note === undefined ? old?.note ?? null : note;
      // «تحویل نداده» = بدون رکورد؛ مگر یادداشت فردی داشته باشد (رکورد فقط‌یادداشت)
      if (status === null && !nextNote) return rest;
      return [
        ...rest,
        {
          id,
          studentId: student.id,
          classId: student.classId,
          weekStart,
          status: status ?? 'none',
          note: nextNote,
          recordedById: currentUser.id,
          recordedBy: currentUser.name,
          updatedAt: new Date().toISOString(),
        },
      ];
    });
  };

  const markWorksheetsComplete = (list: Pick<Student, 'id' | 'classId'>[], weekStart: string) => {
    setWorksheets((prev) => {
      const next = [...prev];
      for (const s of list) {
        const id = worksheetId(s.id, weekStart);
        const idx = next.findIndex((r) => r.id === id);
        if (idx >= 0 && next[idx].status !== 'none') continue; // فقط «تحویل نداده»ها
        next.splice(idx >= 0 ? idx : next.length, idx >= 0 ? 1 : 0, { id, studentId: s.id, classId: s.classId, weekStart, status: 'complete', note: idx >= 0 ? next[idx].note ?? null : null, recordedById: currentUser.id, recordedBy: currentUser.name, updatedAt: new Date().toISOString() });
      }
      return next;
    });
  };

  const addSchoolHoliday = (date: string, title?: string | null) => {
    const normalized = normalizeShamsi(date);
    const id = `hol-${normalized.replace(/\//g, '-')}`;
    setSchoolHolidays((prev) => [
      ...prev.filter((h) => h.id !== id),
      { id, date: normalized, title: title?.trim() || null, setById: currentUser.id, setBy: currentUser.name, updatedAt: new Date().toISOString() },
    ]);
  };

  const setEntryTime = (date: string, time: string | null) => {
    const normalized = normalizeShamsi(date);
    const id = `ent-${normalized.replace(/\//g, '-')}`;
    const clean = time && /^([01]?\d|2[0-3]):[0-5]\d$/.test(time) ? time.padStart(5, '0') : null;
    setEntryTimes((prev) => [
      ...prev.filter((e) => e.id !== id),
      ...(clean && clean !== DEFAULT_ENTRY_TIME
        ? [{ id, date: normalized, time: clean, setById: currentUser.id, setBy: currentUser.name, updatedAt: new Date().toISOString() }]
        : []),
    ]);
    // ورودی‌های ثبت‌شده‌ی همان روز با ساعت ورود جدید دوباره سنجیده می‌شوند (به‌جز تأخیرهای دستی)
    const reference = clean || DEFAULT_ENTRY_TIME;
    setMorningAttendance((prev) =>
      prev.map((r) =>
        normalizeShamsi(r.date) === normalized && r.status === 'present' && r.entryTime && !r.delayManuallyAdjusted
          ? { ...r, delayMinutes: delayFromEntryTime(r.entryTime, reference), updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const removeSchoolHoliday = (date: string) => {
    const id = `hol-${normalizeShamsi(date).replace(/\//g, '-')}`;
    setSchoolHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  const setWorksheetDeadline = (weekStart: string, deadline: string | null) => {
    const id = `wk-${weekStart.replace(/\//g, '-')}`;
    setWorksheetWeeks((prev) => {
      const rest = prev.filter((w) => w.id !== id);
      return deadline ? [...rest, { id, weekStart, deadline, setById: currentUser.id, setBy: currentUser.name, updatedAt: new Date().toISOString() }] : rest;
    });
  };

  const addStudentObservation = (obsData: Omit<StudentObservation, 'id' | 'createdAt'>): string => {
    const id = `obs-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newObs: StudentObservation = {
      ...obsData,
      id,
      // نویسنده را سرور نهایی می‌کند؛ این مقدار فقط تا بازخوانی، دکمه‌های ویرایش/حذف را برای ثبت‌کننده نشان می‌دهد
      authorId: currentUser.id,
      authorRole: currentUser.role,
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
    if (nurturingLocked) return [];
    return observations.filter((o) => o.studentId === studentId);
  };

  const getStudentNurturingDossier = (studentId: string): StudentNurturingDossier => {
    if (!nurturingLocked && nurturingDossiers[studentId]) {
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
    if (nurturingLocked) return [];
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
        observations: nurturingLocked ? [] : observations,
        nurturingDossiers: nurturingLocked ? {} : nurturingDossiers,
        coachEvaluations: nurturingLocked ? [] : coachEvaluations,
        nurturingLocked,
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
        addAcademicTerm,
        transferStudentsToTerm,
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
        verifyTwoFactor,
        security,
        reloadAfterSecurityChange,
        mustChangePassword,
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
        nurturingClasses,
        accessibleSessions,
        teachingAccessibleClasses,
        teachingAccessibleSessions,
        sessionClasses,
        workshopClasses,
        nurturingSessionClasses,
        myWorkshopClasses,
        workshopAssignments,
        studentsOfClass,
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
        resolveDelayDeduction,
        updateStudentDiscipline,
        deleteDisciplinaryNote,
        updateDisciplinaryNote,
        addMorningDelay,
        updateMorningDelay,
        deleteMorningDelay,
        morningAttendance,
        toggleMorningAttendance,
        setMorningDelayMinutes,
        setMorningEntryTime,
        acknowledgeMorningRecord,
        setMorningAbsenceInfo,
        gradePeriods,
        workshops,
        loanItems,
        parentMeetings,
        reflectionPoints,
        setReflectionPoint,
        academicFollowUps,
        setAcademicFollowUp,
        followUpConfig,
        saveFollowUpConfig,
        greyList,
        sendToGreyList,
        withdrawFromGreyList,
        updateGreyEntry,
        parentMeetingStates,
        setParentMeetingOpen,
        setParentMeetingAttendance,
        setParentMeetingAttendanceBulk,
        clearParentMeetingAttendance,
        setParentMeetingNote,
        worksheets,
        worksheetWeeks,
        schoolHolidays,
        entryTimes,
        lessonPlans,
        saveLessonPlan,
        deleteLessonPlan,
        reviewLessonPlan,
        entryTimeFor,
        setEntryTime,
        isClosedDay,
        closedReasonOf: (date: string) => closedReasonOf(date, schoolHolidays),
        todayClosedReason: closedReasonOf(getTodayShamsi().formattedDate, schoolHolidays),
        viewDate,
        changeViewDate,
        lateEntry,
        changeLateEntry,
        addSchoolHoliday,
        removeSchoolHoliday,
        setWorksheetStatus,
        markWorksheetsComplete,
        setWorksheetDeadline,
        addLoanItem,
        updateLoanItem,
        deleteLoanItem,
        updateWorkshop,
        addWorkshop,
        deleteWorkshop,
        setGradePeriodActive,
        setGradePeriodSubjectOpen,
        isGradePeriodOpen,
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
        syncState,
        syncErrorStatus,
        syncQueuedCount,
        retrySync: () => syncEngine.retryNow(),
        clearBaselessHomeworkStatuses,
        countBaselessHomeworkStatuses: () => Array.from(baselessHomeworkRecords(sessions).values()).reduce((n, ids) => n + ids.length, 0),
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
