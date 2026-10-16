import type {
  AttendanceSession,
  GradePeriod,
  MorningAttendanceRecord,
  MorningDelayRecord,
  ParentMeetingRecord,
  SchoolAbsenceRecord,
  SchoolClass,
  SchoolHoliday,
  Student,
  StudentAcademicGrade,
  WorksheetRecord,
  WorksheetWeek,
} from '../types';
import { ABSENCE_ALERT_PER_MONTH, DELAY_ALERT_PER_MONTH, absenceEventsOf, delayEventsOf } from './attendanceStats';
import { GRADE_DROP_LIMIT, currentAndPreviousPeriod, gradeDropOf } from './earlyWarning';
import { attendanceState, currentAcademicStartYear } from './parentMeetings';
import { dateToShamsiString, getTodayShamsi, shamsiStringToDate, toPersianDigits } from './persianDate';
import { closedReasonOf, normalizeShamsi } from './schoolCalendar';
import { compareStudents } from './studentName';
import { computeWorksheetAlerts } from './worksheets';

/**
 * هشدار ترکیبی «دانش‌آموز در خطر».
 * هر نشانه امتیاز خودش را دارد (سقف مشخص)؛ جمع امتیازها با ضریب هم‌زمانی نشانه‌ها بزرگ می‌شود،
 * چون چند نشانه‌ی هم‌زمان از یک نشانه‌ی شدید معمولاً خبر بدتری است.
 * همه‌ی ثابت‌ها اینجا جمع شده‌اند تا معاون تربیتی بتواند قاعده را در صفحه ببیند و در صورت نیاز تنظیم شود.
 */
export const RISK_CONFIG = {
  /** پنجره‌ی بررسی غیبت، تأخیر و موارد انضباطی (روز تقویمی تا تاریخ مبنا) */
  windowDays: 30,
  /** حداکثر امتیاز هر نشانه */
  caps: { absence: 30, delay: 15, grades: 25, parent: 20, worksheet: 15, discipline: 15 },
  /** امتیاز هر غیبت غیرموجه / موجه */
  absencePerUnexcused: 6,
  absencePerExcused: 1,
  /** غیبت متوالیِ روزهای ثبت‌شده که نشانه را فعال می‌کند */
  consecutiveAbsence: 3,
  delayPerEvent: 3,
  gradePerPoint: 5,
  parentFirstMiss: 10,
  parentRepeatedMiss: 20,
  worksheetPerWeek: 5,
  worksheetStreakMin: 2,
  disciplinePerNote: 5,
  /** ضریب هم‌زمانی: دو نشانه ×۱٫۲۵ و سه نشانه یا بیشتر ×۱٫۵ */
  multiplier: { 1: 1, 2: 1.25, 3: 1.5 } as Record<number, number>,
  levels: { high: 60, medium: 40, watch: 30 },
} as const;

export type RiskSignalKey = 'absence' | 'delay' | 'grades' | 'parent' | 'worksheet' | 'discipline';
export type RiskLevel = 'high' | 'medium' | 'watch';
export type RiskTrend = 'new' | 'up' | 'down' | 'same';

export const RISK_SIGNAL_LABELS: Record<RiskSignalKey, string> = {
  absence: 'غیبت',
  delay: 'تأخیر',
  grades: 'افت نمره',
  parent: 'غیبت ولی در جلسه',
  worksheet: 'کاربرگ',
  discipline: 'انضباط',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  high: 'خطر بالا',
  medium: 'خطر متوسط',
  watch: 'نیازمند توجه',
};

export const RISK_LEVEL_CLASS: Record<RiskLevel, string> = {
  high: 'bg-rose-50 text-rose-800 border-rose-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  watch: 'bg-sky-50 text-sky-800 border-sky-200',
};

export interface RiskSignal {
  key: RiskSignalKey;
  label: string;
  points: number;
  /** نشانه‌ی شدید به‌تنهایی هم دانش‌آموز را وارد فهرست می‌کند */
  severe: boolean;
}

export interface RiskStudent {
  student: Student;
  className: string;
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
  /** امتیاز هفته‌ی پیش (۰ = در فهرست نبود) */
  previousScore: number;
  trend: RiskTrend;
}

export interface RiskInput {
  students: Student[];
  classes: SchoolClass[];
  sessions: AttendanceSession[];
  morningAttendance: MorningAttendanceRecord[];
  morningDelays: MorningDelayRecord[];
  schoolAbsences: SchoolAbsenceRecord[];
  academicGrades: StudentAcademicGrade[];
  gradePeriods: GradePeriod[];
  parentMeetings: ParentMeetingRecord[];
  worksheets: WorksheetRecord[];
  worksheetWeeks: WorksheetWeek[];
  /** جمعه‌ها و تعطیلی‌های اعلام‌شده بین دو غیبت، آن‌ها را از «متوالی» بودن نمی‌اندازد */
  holidays?: Pick<SchoolHoliday, 'date'>[];
  /** تاریخ مبنا (شمسی)؛ پیش‌فرض امروز */
  asOf?: string;
}

const dayNumber = (d: string) => Math.round(shamsiStringToDate(normalizeShamsi(d)).getTime() / 86_400_000);

const addDays = (d: string, delta: number) => {
  const date = shamsiStringToDate(normalizeShamsi(d));
  date.setDate(date.getDate() + delta);
  return dateToShamsiString(date);
};

/** بین دو تاریخ (نه خودشان) فقط روزهای تعطیل است؟ */
const onlyClosedBetween = (from: string, to: string, holidays: Pick<SchoolHoliday, 'date'>[]) => {
  for (let d = addDays(from, 1); normalizeShamsi(d) < normalizeShamsi(to); d = addDays(d, 1)) {
    if (!closedReasonOf(d, holidays)) return false;
  }
  return true;
};

const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));

interface StudentFacts {
  absences: { date: string; excused: boolean }[];
  delays: { date: string }[];
  disciplineDates: string[];
  grades: StudentAcademicGrade[];
  meetings: ParentMeetingRecord[];
}

/** نشانه‌های یک دانش‌آموز در تاریخ مبنا (فقط داده‌هایی که تا آن روز ثبت شده‌اند) */
function signalsOf(
  f: StudentFacts,
  asOf: string,
  gradeCtx: { current: string | undefined; order: string[] },
  worksheetStreak: number,
  academicYear: string,
  holidays: Pick<SchoolHoliday, 'date'>[]
): RiskSignal[] {
  const C = RISK_CONFIG;
  const end = dayNumber(asOf);
  const inWindow = (d: string) => {
    const diff = end - dayNumber(d);
    return diff >= 0 && diff < C.windowDays;
  };
  const upToNow = (d: string) => normalizeShamsi(d) <= normalizeShamsi(asOf);
  const signals: RiskSignal[] = [];

  // غیبت: غیرموجه‌ها سنگین‌ترند؛ غیبت متوالی (بدون روز حضورِ ثبت‌شده بین آن‌ها) نشانه‌ی شدیدتری است
  const abs = f.absences.filter((a) => inWindow(a.date));
  const unexcused = abs.filter((a) => !a.excused).length;
  const excused = abs.length - unexcused;
  const sortedDays = Array.from(new Set(abs.map((a) => normalizeShamsi(a.date)))).sort();
  let run = 0;
  let best = 0;
  sortedDays.forEach((d, i) => {
    run = i > 0 && onlyClosedBetween(sortedDays[i - 1], d, holidays) ? run + 1 : 1;
    best = Math.max(best, run);
  });
  if (unexcused >= ABSENCE_ALERT_PER_MONTH || best >= C.consecutiveAbsence) {
    const points = clamp(unexcused * C.absencePerUnexcused + excused * C.absencePerExcused + (best >= C.consecutiveAbsence ? 6 : 0), C.caps.absence);
    const parts = [`${toPersianDigits(unexcused)} غیبت غیرموجه`];
    if (excused) parts.push(`${toPersianDigits(excused)} موجه`);
    if (best >= C.consecutiveAbsence) parts.push(`${toPersianDigits(best)} روز متوالی`);
    signals.push({ key: 'absence', label: `${parts.join('، ')} در ${toPersianDigits(C.windowDays)} روز`, points, severe: unexcused >= 6 || best >= 5 });
  }

  // تأخیر
  const delayDays = new Set(f.delays.filter((d) => inWindow(d.date)).map((d) => normalizeShamsi(d.date))).size;
  if (delayDays >= DELAY_ALERT_PER_MONTH) {
    signals.push({ key: 'delay', label: `${toPersianDigits(delayDays)} روز تأخیر در ${toPersianDigits(C.windowDays)} روز`, points: clamp(delayDays * C.delayPerEvent, C.caps.delay), severe: false });
  }

  // افت نمره (نمره تاریخ ندارد؛ نسبت به بازه‌ی فعالِ ثبت‌شده سنجیده می‌شود)
  const drop = gradeDropOf(f.grades, gradeCtx.current, gradeCtx.order);
  if (drop !== null && drop > GRADE_DROP_LIMIT) {
    const shown = (Math.round(drop * 100) / 100).toString().replace('.', '٫');
    signals.push({ key: 'grades', label: `افت میانگین ${toPersianDigits(shown)} نمره`, points: clamp(Math.round(drop * C.gradePerPoint), C.caps.grades), severe: drop >= 4 });
  }

  // غیبت ولی: جلسه‌هایی از سال جاری که حضور ثبت شده و هیچ‌یک از والدین نیامده‌اند
  const recorded = f.meetings
    .filter((m) => m.academicYear === academicYear && attendanceState(m) !== 'unrecorded' && (!m.date || upToNow(m.date)))
    .sort((a, b) => a.meetingNo - b.meetingNo);
  const missed = recorded.filter((m) => attendanceState(m) === 'none').length;
  const lastMissed = recorded.length > 0 && attendanceState(recorded[recorded.length - 1]) === 'none';
  if (missed >= 2 || lastMissed) {
    signals.push({
      key: 'parent',
      label: missed >= 2 ? `هیچ‌یک از والدین در ${toPersianDigits(missed)} جلسه نیامده‌اند` : 'هیچ‌یک از والدین در آخرین جلسه نیامده‌اند',
      points: missed >= 2 ? C.parentRepeatedMiss : C.parentFirstMiss,
      severe: missed >= 2,
    });
  }

  // کاربرگ: هفته‌های پیاپی تحویل‌نداده یا ناقص
  if (worksheetStreak >= C.worksheetStreakMin) {
    signals.push({ key: 'worksheet', label: `${toPersianDigits(worksheetStreak)} هفته‌ی پیاپی کاربرگ ناقص یا تحویل‌نشده`, points: clamp(worksheetStreak * C.worksheetPerWeek, C.caps.worksheet), severe: worksheetStreak >= 4 });
  }

  // انضباط: موارد ثبت‌شده در پنجره (تأخیر و غیبت خودکار جداگانه شمرده شده‌اند)
  const disc = f.disciplineDates.filter(inWindow).length;
  if (disc >= 2) {
    signals.push({ key: 'discipline', label: `${toPersianDigits(disc)} مورد انضباطی در ${toPersianDigits(C.windowDays)} روز`, points: clamp(disc * C.disciplinePerNote, C.caps.discipline), severe: disc >= 4 });
  }

  return signals;
}

export function combinedScore(signals: RiskSignal[]): number {
  if (!signals.length) return 0;
  const sum = signals.reduce((n, s) => n + s.points, 0);
  const mult = RISK_CONFIG.multiplier[Math.min(3, signals.length)] ?? 1;
  return Math.min(100, Math.round(sum * mult));
}

export function levelOf(score: number): RiskLevel | null {
  const L = RISK_CONFIG.levels;
  return score >= L.high ? 'high' : score >= L.medium ? 'medium' : score >= L.watch ? 'watch' : null;
}

/** دانش‌آموز وقتی در فهرست می‌آید که دست‌کم دو نشانه‌ی هم‌زمان داشته باشد یا یک نشانه‌ی شدید */
const isListed = (signals: RiskSignal[], score: number) => levelOf(score) !== null && (signals.length >= 2 || signals.some((s) => s.severe));

/** فهرست دانش‌آموزان در خطر (امتیاز بیشتر اول) همراه با روند نسبت به یک هفته‌ی پیش */
export function computeAtRisk(input: RiskInput): RiskStudent[] {
  const { students, classes, sessions, morningAttendance, morningDelays, schoolAbsences, academicGrades, gradePeriods, parentMeetings, worksheets, worksheetWeeks } = input;
  const holidays = input.holidays || [];
  const asOf = input.asOf || getTodayShamsi().formattedDate;
  const prevAsOf = addDays(asOf, -7);
  const classById = new Map(classes.map((c) => [c.id, c]));
  const src = { morningDelays, morningAttendance, schoolAbsences, sessions };
  const { current, order } = currentAndPreviousPeriod(gradePeriods);
  const academicYear = String(currentAcademicStartYear());

  const gradesBy = new Map<string, StudentAcademicGrade[]>();
  academicGrades.forEach((g) => gradesBy.set(g.studentId, [...(gradesBy.get(g.studentId) || []), g]));
  const meetingsBy = new Map<string, ParentMeetingRecord[]>();
  parentMeetings.forEach((m) => meetingsBy.set(m.studentId, [...(meetingsBy.get(m.studentId) || []), m]));

  // کاربرگ به تاریخ مبنا وابسته است (مهلت‌های گذشته تا همان روز)
  const streaksAt = (date: string) =>
    computeWorksheetAlerts(students, classes, worksheets, worksheetWeeks, 8, date).streaks;
  const streakNow = streaksAt(asOf);
  const streakPrev = streaksAt(prevAsOf);

  const result: RiskStudent[] = [];
  students.forEach((student) => {
    const facts: StudentFacts = {
      absences: absenceEventsOf(student, src),
      delays: delayEventsOf(student, src),
      disciplineDates: (student.disciplinaryNotes || [])
        .filter((n) => n.source !== 'auto_delay' && n.source !== 'approved_delay' && n.source !== 'delay_dismissed')
        .map((n) => n.date),
      grades: gradesBy.get(student.id) || [],
      meetings: meetingsBy.get(student.id) || [],
    };
    const signals = signalsOf(facts, asOf, { current, order }, streakNow.get(student.id) || 0, academicYear, holidays);
    const score = combinedScore(signals);
    const level = levelOf(score);
    if (!level || !isListed(signals, score)) return;

    const prevSignals = signalsOf(facts, prevAsOf, { current, order }, streakPrev.get(student.id) || 0, academicYear, holidays);
    const prevScoreRaw = combinedScore(prevSignals);
    const previousScore = isListed(prevSignals, prevScoreRaw) ? prevScoreRaw : 0;
    const trend: RiskTrend = previousScore === 0 ? 'new' : score - previousScore >= 8 ? 'up' : previousScore - score >= 8 ? 'down' : 'same';

    result.push({
      student,
      className: classById.get(student.classId)?.name || '—',
      score,
      level,
      signals: [...signals].sort((a, b) => b.points - a.points),
      previousScore,
      trend,
    });
  });

  return result.sort((a, b) => b.score - a.score || b.signals.length - a.signals.length || compareStudents(a.student, b.student));
}
