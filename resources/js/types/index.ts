export type UserRole = 'admin' | 'vice_educational' | 'vice_disciplinary' | 'vice_nurturing' | 'coach' | 'vice_principal' | 'teacher';

export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late';

export type HomeworkStatus = 'done' | 'incomplete' | 'not_done';

export type DisciplinaryStatus = 'normal' | 'verbal_warning' | 'written_warning' | 'parents_summoned' | 'parent_called';

export interface DisciplinaryNote {
  id: string;
  date: string; // Shamsi: "1404/08/15"
  title: string;
  description: string;
  scoreDeduction: number; // e.g. 0.5, 1, 2
  recordedBy: string; // e.g. "معاون انضباطی"
  author?: string; // alias for recordedBy
  type: 'delay' | 'absence' | 'behavior' | 'uniform' | 'other';
  source?: 'class_warning'; // اخطار ثبت‌شده توسط استاد در جلسه کلاسی
  warningKind?: string; // نوع تذکر: عدم انجام تکلیف، بی‌انضباطی کلاسی، ...
  subject?: string; // درس مربوط به اخطار کلاسی
  sessionRef?: string; // شناسه جلسه کلاسی (جلوگیری از ثبت تکراری)
}

export interface ClassDisciplinaryWarning {
  hasWarning: boolean;
  title: string;
  description: string;
  scoreDeduction: number;
  type: 'delay' | 'absence' | 'behavior' | 'uniform' | 'other';
  kind?: string;
}

export interface TeachingAssignment {
  id: string;
  subjectId?: string; // شناسه درس از جدول academicSubjects
  subjectName: string; // عنوان درس تدریسی مثلاً: ریاضی، علوم تجربی
  classIds: string[]; // کلاس‌های تخصیص‌یافته به این درس مثلاً: cls-101, cls-102
}

/** انتساب آموزشی سه‌طرفه: کلاس + درس + استاد (مستقل از مربی تربیتی کلاس) */
export interface CourseAssignment {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string; // شناسه کاربر (user_id) استاد درس
}

export interface User {
  id: string;
  username: string; // نام کاربری برای ورود
  password?: string; // رمز عبور تعیین شده توسط مدیر
  name: string;
  role: UserRole;
  roleTitle: string; // مدیر دبیرستان | معاون آموزشی | معاون انضباطی | معاون تربیتی | مربی یاوران ولایت | دبیر
  subject?: string; // مثلاً: فیزیک، ریاضی، شیمی
  subjectSpecialty?: string; // تخصص و گرایش تدریس
  coachRoleTitle?: string; // سمت تخصصی مربی
  isActive?: boolean; // وضعیت فعالیت
  phone?: string;
  avatar?: string;
  assignedClassIds: string[]; // Class IDs teacher or coach is allowed to access
  assignedSubjectIds?: string[]; // شناسه دروس تخصیص یافته
  isAlsoTeacher?: boolean; // آیا علاوه بر مربی، نقش معلم نیز دارد؟
  teachingSubject?: string; // عنوان درس تدریسی مربی (سازگار با نسخه قبل)
  teachingClassIds?: string[]; // کلاس‌هایی که مربی در آن‌ها معلم است (سازگار با نسخه قبل)
  teachingAssignments?: TeachingAssignment[]; // پشتیبانی کامل از چند درس و چند کلاس
  permissions?: string[]; // کلیدهای دسترسی اختصاصی کاربر (ماتریس دسترسی)
}

export interface Student {
  id: string;
  classId: string;
  studentCode: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  fatherName?: string;
  parentPhone: string;
  fatherPhone?: string; // alias for parentPhone
  avatar?: string;
  notes?: string;
  disciplineScore?: number; // نمره انضباط (پایه ۲۰)
  disciplinaryScore?: number; // alias for disciplineScore
  disciplinaryStatus?: DisciplinaryStatus; // وضعیت انضباطی
  disciplinaryNotes?: DisciplinaryNote[]; // لیست سوابق و یادداشت‌های انضباطی
}

export interface BellPeriod {
  id: string; // e.g. 'bell-1', 'bell-2', 'bell-3', 'bell-4'
  name: string; // e.g. 'زنگ اول', 'زنگ دوم', 'زنگ سوم', 'زنگ چهارم'
  startTime: string; // e.g. '07:45'
  endTime: string; // e.g. '09:15'
  order: number;
  description?: string; // e.g. 'نوبت اول صبحگاهی مصوب'
}

export interface SchoolClass {
  id: string;
  name: string; // e.g. "پایه دهم ریاضی الف"
  grade: string; // e.g. "دهم"
  major: string; // e.g. "ریاضی و فیزیک", "علوم تجربی", "انسانی"
  academicYear: string; // e.g. "۱۴۰۴-۱۴۰۵"
  roomNumber?: string;
  room?: string; // شماره یا نام اتاق کلاس
  academicAdvisor?: string; // مشاور تحصیلی کلاس
  teacherIds: string[]; // Assigned teachers
  coachId?: string; // Assigned coach ID (مربی تربیتی یاوران ولایت)
  coachIds?: string[]; // Multiple coaches if applicable
  defaultStartTime?: string; // ساعت شروع پیش‌فرض مصوب (مثلاً: 07:45)
  defaultEndTime?: string; // ساعت پایان پیش‌فرض مصوب (مثلاً: 09:15)
  defaultBellPeriodId?: string; // زنگ پیش‌فرض (مثلاً: bell-1)
}

export interface StudentAttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  delayMinutes?: number; // For 'late' status
  note?: string;
  score?: number; // 0 to 20 continuous score
  homeworkStatus?: HomeworkStatus;
  disciplinaryWarning?: ClassDisciplinaryWarning;
}

export interface AttendanceSession {
  id: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  subjectId?: string; // شناسه درس تخصیص‌یافته (Subject-Class Assignment)
  date: string; // Shamsi format: "1404/08/15"
  dayOfWeek: string; // e.g. "شنبه", "یکشنبه"
  startTime?: string; // e.g. "08:00"
  endTime?: string; // e.g. "09:30"
  bellPeriodId?: string; // شناسه زنگ مصوب
  bellPeriodName?: string; // نام زنگ مصوب مانند «زنگ اول»
  periodNumber?: number; // شماره زنگ (۱، ۲، ۳، ۴)
  lessonTopic: string; // مبحث تدریس شده
  homeworkDescription?: string; // تکالیف داده شده
  sessionNotes?: string; // یادداشت جلسه
  records: Record<string, StudentAttendanceRecord>; // key is studentId
  createdAt: string;
  updatedAt: string;
}

export interface StudentMonthlyStat {
  student: Student;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  lateCount: number;
  totalDelayMinutes: number;
  attendanceRate: number; // percentage 0 - 100
  averageScore?: number;
  warningFlag: boolean; // if absent > threshold (e.g. 3)
}

export interface ClassMonthlySummary {
  classId: string;
  className: string;
  monthName: string;
  monthIndex: number; // 1 to 12
  year: number;
  totalSessions: number;
  overallAttendanceRate: number;
  studentsStats: StudentMonthlyStat[];
  sessions: AttendanceSession[];
}

export type SubjectCategory = 
  | 'علوم پایه' 
  | 'ادبیات و معارف' 
  | 'زبان‌های خارجی' 
  | 'علوم اجتماعی و فرهنگ' 
  | 'مهارتی و فناوری' 
  | 'تربیت بدنی و سلامت'
  | 'دروس یاوران'
  | 'دروس آموزش و پرورش';

export interface AcademicSubject {
  id: string;
  code?: string; // کد درس مثلاً: M101
  name: string; // نام درس: ریاضی، علوم تجربی، پیام‌های آسمان، آموزش قرآن، فارسی، نگارش و ...
  coefficient?: number; // (منسوخ) دروس ضریب ندارند
  grade?: string; // پایه تحصیلی (هفتم، هشتم، نهم، یا عمومی متوسطه اول)
  targetGrades?: string[]; // e.g. ['پایه هفتم', 'پایه هشتم', 'پایه نهم']
  category?: SubjectCategory; // گروه درسی
  hoursPerWeek?: number; // ساعت تدریس در هفته
  teacherId?: string; // شناسه دبیر اختصاص داده شده
  teacherName?: string; // نام دبیر درس (نام مستعار defaultTeacherName)
  defaultTeacherName?: string; // نام دبیر تخصیص یافته
  major?: string; // دوره یا گرایش (عمومی متوسطه اول)
  description?: string; // توضیحات سرفصل یا نکات درس
}

export interface StudentAcademicGrade {
  id: string;
  studentId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  coefficient?: number; // (منسوخ) دروس ضریب ندارند
  
  // نمرات مستمر ماهانه نیمسال اول
  mehrContinuous?: number; // نمره مستمر مهر (۰ تا ۲۰)
  abanContinuous?: number; // نمره مستمر آبان (۰ تا ۲۰)
  azarContinuous?: number; // نمره مستمر آذر (۰ تا ۲۰)
  term1Continuous?: number; // نمره مستمر ترم اول (۰ تا ۲۰)
  continuousScoreTerm1?: number; // alias
  term1Final?: number; // نمره پایانی ترم اول (۰ تا ۲۰)
  finalScoreTerm1?: number; // alias

  // نمرات مستمر ماهانه نیمسال دوم
  bahmanContinuous?: number; // نمره مستمر بهمن (۰ تا ۲۰)
  esfandContinuous?: number; // نمره مستمر اسفند (۰ تا ۲۰)
  farvardinContinuous?: number; // نمره مستمر فروردین (۰ تا ۲۰)
  ordibeheshtContinuous?: number; // نمره مستمر اردیبهشت (۰ تا ۲۰)
  term2Continuous?: number; // نمره مستمر ترم دوم (۰ تا ۲۰)
  continuousScoreTerm2?: number; // alias
  term2Final?: number; // نمره پایانی ترم دوم (۰ تا ۲۰)
  finalScoreTerm2?: number; // alias

  teacherName?: string;
  notes?: string;
  updatedAt?: string;
}

export type MonthlyContinuousKey = 
  | 'mehrContinuous' 
  | 'abanContinuous' 
  | 'azarContinuous' 
  | 'term1Continuous' 
  | 'term1Final' 
  | 'bahmanContinuous' 
  | 'esfandContinuous' 
  | 'farvardinContinuous' 
  | 'ordibeheshtContinuous' 
  | 'term2Continuous' 
  | 'term2Final';

export type MonthlyPeriodKey = MonthlyContinuousKey;

export interface MonthlyPeriodInfo {
  key: MonthlyContinuousKey;
  monthName: string;
  label: string;
  shortLabel: string;
  term: 1 | 2;
  semester?: 1 | 2;
  order: number;
}

export const MONTHLY_EVALUATION_PERIODS: MonthlyPeriodInfo[] = [
  { key: 'mehrContinuous', monthName: 'مهر', label: 'مستمر مهر', shortLabel: 'مهر', term: 1, order: 1 },
  { key: 'abanContinuous', monthName: 'آبان', label: 'مستمر آبان', shortLabel: 'آبان', term: 1, order: 2 },
  { key: 'azarContinuous', monthName: 'آذر', label: 'مستمر آذر', shortLabel: 'آذر', term: 1, order: 3 },
  { key: 'term1Continuous', monthName: 'دی', label: 'مستمر ترم اول', shortLabel: 'مستمر ۱', term: 1, order: 4 },
  { key: 'term1Final', monthName: 'دی', label: 'پایانی ترم اول', shortLabel: 'پایانی ۱', term: 1, order: 5 },
  { key: 'bahmanContinuous', monthName: 'بهمن', label: 'مستمر بهمن', shortLabel: 'بهمن', term: 2, order: 6 },
  { key: 'esfandContinuous', monthName: 'اسفند', label: 'مستمر اسفند', shortLabel: 'اسفند', term: 2, order: 7 },
  { key: 'farvardinContinuous', monthName: 'فروردین', label: 'مستمر فروردین', shortLabel: 'فروردین', term: 2, order: 8 },
  { key: 'ordibeheshtContinuous', monthName: 'اردیبهشت', label: 'مستمر اردیبهشت', shortLabel: 'اردیبهشت', term: 2, order: 9 },
  { key: 'term2Continuous', monthName: 'خرداد', label: 'مستمر ترم دوم', shortLabel: 'مستمر ۲', term: 2, order: 10 },
  { key: 'term2Final', monthName: 'خرداد', label: 'پایانی ترم دوم', shortLabel: 'پایانی ۲', term: 2, order: 11 },
];

export interface MorningDelayRecord {
  id: string;
  studentId: string;
  studentName?: string; // نام دانش‌آموز (جهت جستجو یا نمایش مستقیم)
  classId: string;
  date: string; // Shamsi: "1404/08/15"
  dayOfWeek: string; // e.g. "شنبه"
  arrivalTime?: string; // e.g. "07:45"
  delayMinutes: number; // minutes of delay e.g. 15, 20, 35
  reason?: string; // e.g. "ترافیک", "کسالت", "بدون عذر موجه", "مشکل سرویس"
  isExcused?: boolean; // موجه / غیرموجه
  recordedBy: string; // e.g. "معاون انضباطی"
  disciplinaryActionTaken?: string; // e.g. "تذکر شفاهی", "تماس با ولی", "کسر ۰.۵ نمره"
  actionTaken?: string; // alias for disciplinaryActionTaken
  parentContacted?: boolean; // وضعیت تماس با اولیا
  isParentNotified?: boolean; // alias for parentContacted
  notes?: string;
  createdAt: string;
}

/** حضور و غیاب صبحگاه (ناظم / معاون اجرایی) — یک رکورد برای هر دانش‌آموز در هر روز */
export interface MorningAttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string; // Shamsi: "1404/08/15"
  dayOfWeek: string;
  status: 'present' | 'absent';
  entryTime?: string; // ساعت ثبت حضور "HH:MM" (entry_time)
  delayMinutes: number; // دقیقه تأخیر نسبت به ۰۷:۰۰ (delay_minutes)
  delayManuallyAdjusted?: boolean;
  isAcknowledged: boolean; // تأیید پیگیری (is_acknowledged)
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolAbsenceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string; // Shamsi: "1404/08/15"
  dayOfWeek: string; // e.g. "شنبه"
  isExcused?: boolean; // موجه / غیرموجه
  reason?: string; // علت یا توضیحات غیبت در مدرسه
  recordedBy: string; // e.g. "معاون انضباطی" یا "مدیر مدرسه"
  parentContacted?: boolean; // وضعیت تماس با اولیا
  notes?: string;
  createdAt: string;
}

export interface StudentUnifiedDelayItem {
  id: string;
  type: 'morning_gate' | 'class_session';
  date: string; // "1404/08/15"
  dayOfWeek: string;
  delayMinutes: number;
  arrivalTime?: string;
  subjectOrSession?: string;
  reason?: string;
  isExcused?: boolean;
  recordedBy: string;
  notes?: string;
}

// ----------------------------------------------------
// Nurturing & Counseling Types (معاونت تربیتی و پرورشی)
// ----------------------------------------------------

export type ObservationCategory = 
  | 'behavioral' // رفتاری
  | 'social' // اجتماعی و ارتباطی
  | 'emotional' // عاطفی و هیجانی
  | 'moral' // اخلاقی و ارزشی
  | 'learning_attitude' // نگرش و انگیزش تحصیلی
  | 'family' // خانوادگی
  | 'other'; // سایر

export interface StudentObservation {
  id: string;
  studentId: string;
  date: string; // تاریخ شمسی: "1404/08/20"
  time?: string; // ساعت: "10:30"
  title: string; // عنوان / موضوع مشاهده
  category: ObservationCategory;
  categoryLabel?: string;
  content: string; // متن مشروح مشاهده
  tags?: string[]; // برچسب‌های کلیدی
  location?: string; // مکان مشاهده: کلاس، حیاط، نمازخانه، اردو
  recordedBy: string; // ثبت‌کننده (معاون تربیتی)
  createdAt: string;
  updatedAt?: string;
}

// 8 Specific Sections requested for Nurturing Dossier (پرونده تربیتی):
// ۱. نقاط تفکری  ۲. جلسات خصوصی  ۳. مصاحبه والدین  ۴. مزاج شناسی
// ۵. مسیر رشد  ۶. سبک زندگی  ۷. مصاحبه‌ها  ۸. جمعبندی تربیتی
export type NurturingSectionKey = 
  | 'thinkingPoints' // نقاط تفکری
  | 'privateSessions' // جلسات خصوصی
  | 'parentInterviews' // مصاحبه والدین
  | 'temperament' // مزاج شناسی
  | 'growthPath' // مسیر رشد
  | 'lifestyle' // سبک زندگی
  | 'interviews' // مصاحبه ها
  | 'nurturingSummary'; // جمعبندی تربیتی

export interface DossierSectionEntry {
  id: string;
  date: string; // تاریخ شمسی: "1404/08/20"
  title: string; // تیتر / محور یادداشت
  content: string; // متن مشروح یادداشت
  tags?: string[];
  keyTakeaways?: string[]; // نکات کلیدی و توصیه‌ها
  attachments?: string[];
  recordedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StudentNurturingDossier {
  studentId: string;
  thinkingPoints: DossierSectionEntry[]; // ۱. نقاط تفکری
  privateSessions: DossierSectionEntry[]; // ۲. جلسات خصوصی
  parentInterviews: DossierSectionEntry[]; // ۳. مصاحبه والدین
  temperament: {
    dominantType?: string; // دموی، صفراوی، بلغمی، سوداوی، مرکب یا معتدل
    physicalTraits?: string;
    behavioralTraits?: string;
    entries: DossierSectionEntry[];
  }; // ۴. مزاج شناسی
  growthPath: DossierSectionEntry[]; // ۵. مسیر رشد
  lifestyle: DossierSectionEntry[]; // ۶. سبک زندگی
  interviews: DossierSectionEntry[]; // ۷. مصاحبه ها
  nurturingSummary: {
    overallSummary?: string;
    strengths?: string[];
    growthOpportunities?: string[];
    entries: DossierSectionEntry[];
  }; // ۸. جمعبندی تربیتی
  updatedAt: string;
}

// ----------------------------------------------------
// Qualitative Rating & Shared Evaluation Types
// ----------------------------------------------------

export type QualitativeRating = 'excellent' | 'very_good' | 'good' | 'needs_improvement';

// ----------------------------------------------------
// Coach Growth & Nurturing Evaluations (ارزیابی‌های رشدی-تربیتی مربیان یاوران ولایت)
// ----------------------------------------------------

export interface GrowthEvaluationCriteria {
  responsibility: QualitativeRating; // مسئولیت‌پذیری و نظم فردی
  teamwork: QualitativeRating; // روحیه کار گروهی و تشکیلاتی
  moralSpiritual: QualitativeRating; // پایبندی به ارزش‌های اخلاقی و معنوی
  problemSolving: QualitativeRating; // بینش فکری، خلاقیت و حل مسئله
  socialEtiquette: QualitativeRating; // ادب و تعامل با همسالان و کادر
  academicMotivation: QualitativeRating; // انگیزش، پشتکار و نگرش تحصیلی
}

export interface CoachGrowthEvaluation {
  id: string;
  studentId: string;
  coachId: string;
  coachName: string;
  date: string; // تاریخ شمسی: "1404/08/20"
  period: string; // مثلاً: ارزیابی فصل پاییز، ترم اول، فصل بهار
  criteria: GrowthEvaluationCriteria;
  overallRating: QualitativeRating;
  strengths: string[]; // نقاط قوت بارز
  growthRecommendations: string[]; // توصیه‌های مربی برای ارتقا و رشد
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// Teacher Evaluation & Growth (ارتباط و ارتقاء اساتید)
// ----------------------------------------------------

export interface TeacherEvaluationCriterionDetail {
  rating: QualitativeRating; // 'excellent' | 'very_good' | 'good' | 'needs_improvement'
  comment?: string; // توضیحات و یادداشت تفصیلی برای این شاخص
}

export interface TeacherEvaluationCriteria {
  lessonPlanning?: QualitativeRating | number | TeacherEvaluationCriterionDetail; // طرح درس نویسی و بودجه‌بندی
  teachingQuality?: QualitativeRating | number | TeacherEvaluationCriterionDetail; // کیفیت تدریس، تفهیم مطالب و تعامل کلاسی
  punctualityAndDiscipline?: QualitativeRating | number | TeacherEvaluationCriterionDetail; // نظم، حضور به موقع و مدیریت کلاس
  continuousAssessment?: QualitativeRating | number | TeacherEvaluationCriterionDetail; // ارزشیابی مستمر و ثبت به موقع نمرات
  parentAndSchoolCommunication?: QualitativeRating | number | TeacherEvaluationCriterionDetail; // ارتباط موثر با اولیا و معاونت
  criteriaComments?: Record<string, string>; // توضیحات اختصاصی برای هر یک از شاخص‌ها
  // Legacy compatibility fields
  punctuality?: QualitativeRating | number;
  creativity?: QualitativeRating | number;
  academicFollowUp?: QualitativeRating | number;
  classroomManagement?: QualitativeRating | number;
  studentSatisfaction?: QualitativeRating | number;
}

export interface TeacherEvaluation {
  id: string;
  teacherId: string;
  teacherName: string;
  evaluatorId?: string;
  evaluatorName: string; // e.g. "مهندس کاظمی (معاون آموزشی)"
  date: string; // تاریخ شمسی: "1404/08/20"
  period?: string; // مثلاً: ارزیابی آبان‌ماه، نیمسال اول، فصل پاییز
  academicYear?: string;
  term?: 'term1' | 'term2' | 'annual';
  criteria: TeacherEvaluationCriteria;
  overallRating?: QualitativeRating;
  overallScore?: number;
  strengths: string[] | string; // نقاط قوت بارز دبیر
  growthRecommendations?: string[] | string; // توصیه‌های ارتقاء و توانمندسازی
  areasForImprovement?: string;
  generalNotes?: string; // یادداشت و رهنمودهای تکمیلی معاونت آموزشی
  createdAt?: string;
  updatedAt?: string;
}

// ----------------------------------------------------
// School Settings & Base Information (تنظیمات و اطلاعات پایه سامانه)
// ----------------------------------------------------

export interface SchoolSettings {
  schoolName: string; // نام مدرسه
  phone: string; // شماره تماس
  address: string; // آدرس
  academicYear: string; // سال تحصیلی جاری: "۱۴۰۴-۱۴۰۵"
  schoolCode?: string; // کد مدرسه / مرکز
  principalName?: string; // نام مدیر
  logoUrl?: string; // نشان یا لوگوی مدرسه
}

export interface SchoolGradeItem {
  id: string;
  name: string; // مثلاً: "پایه هفتم", "پایه هشتم", "پایه نهم"
  stage: string; // مثلاً: "دوره اول متوسطه"
  status: 'active' | 'inactive';
}


export interface SchoolAnnouncement {
  id: string;
  title: string;
  content: string;
  date: string; // "1404/08/20"
  category?: 'educational' | 'general' | 'disciplinary' | 'cultural';
  priority: 'urgent' | 'important' | 'normal';
  targetRoles?: UserRole[];
  targetRole?: 'all_teachers' | 'coaches' | 'everyone';
  author?: string;
  authorName?: string;
  createdAt?: string;
  status?: 'active' | 'archived'; // فعال / آرشیو
  attachments?: { name: string; type: string; dataUrl: string }[]; // پیوست‌ها
}



// ------------------------------------------------------------------
// آزمون جامع (ثبت نمرات و تحلیل) — یک رکورد برای هر کلاس
// ------------------------------------------------------------------
export type ExamSubjectKey = 'math' | 'science' | 'persian' | 'english' | 'arabic';

export const EXAM_SUBJECTS: { key: ExamSubjectKey; label: string }[] = [
  { key: 'math', label: 'ریاضی' },
  { key: 'science', label: 'علوم تجربی' },
  { key: 'persian', label: 'فارسی' },
  { key: 'english', label: 'زبان انگلیسی' },
  { key: 'arabic', label: 'عربی' },
];

export interface ComprehensiveExamRecord {
  id: string; // cexam-{classId}
  classId: string;
  activeSubjects: ExamSubjectKey[];
  scores: Record<string, Partial<Record<ExamSubjectKey, number>>>; // studentId -> نمرات
  updatedAt?: string;
}
