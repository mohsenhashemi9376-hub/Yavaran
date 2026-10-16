import type { AttendanceSession, MorningAttendanceRecord, MorningDelayRecord, ParentMeetingRecord, SchoolAbsenceRecord, Student, StudentAcademicGrade, StudentObservation, WorksheetRecord, WorksheetWeek } from '../types';
import { ABSENCE_ALERT_PER_MONTH, DELAY_ALERT_PER_MONTH, absenceEventsOf, delayEventsOf } from './attendanceStats';
import { attendanceState, studentParentSummary } from './parentMeetings';
import { dateToShamsiString, getTodayShamsi, shamsiStringToDate, toPersianDigits } from './persianDate';
import { studentWorksheetHistory } from './worksheets';
import { dayKey } from './studentTimeline';

export type RiskSignalKey = 'absence' | 'delay' | 'discipline' | 'grades' | 'worksheet' | 'parent' | 'observation';

export interface RiskSignal {
  key: RiskSignalKey;
  label: string;
  points: number;
}

export type RiskLevel = 'high' | 'medium';

export interface StudentRisk {
  student: Student;
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
}

/** حداقل امتیاز و حداقل تعداد نشانه‌ی هم‌زمان برای ورود به فهرست «در خطر» */
export const RISK_MIN_SCORE = 4;
export const RISK_MIN_SIGNALS = 2;
export const RISK_HIGH_SCORE = 7;
/** افت نمره‌ی مستمر (بین دو ماه آخر) که نشانه حساب می‌شود */
export const GRADE_DROP_POINTS = 2;

export interface RiskSources {
  morningDelays: MorningDelayRecord[];
  morningAttendance: MorningAttendanceRecord[];
  schoolAbsences: SchoolAbsenceRecord[];
  sessions: AttendanceSession[];
  academicGrades: StudentAcademicGrade[];
  /** خالی بدهید اگر کاربر مجوز یا دسترسی مشاهدات تربیتی ندارد */
  observations?: StudentObservation[];
  parentMeetings?: ParentMeetingRecord[];
  worksheets?: WorksheetRecord[];
  worksheetWeeks?: WorksheetWeek[];
}

const MONTHLY_KEYS = ['mehrContinuous', 'abanContinuous', 'azarContinuous', 'bahmanContinuous', 'esfandContinuous', 'farvardinContinuous', 'ordibeheshtContinuous'] as const;

/** میانگین نمره‌ی مستمر ماهانه (همه‌ی دروس)؛ فقط ماه‌هایی که نمره دارند */
export function monthlyContinuousAverages(grades: StudentAcademicGrade[]): { key: string; avg: number }[] {
  return MONTHLY_KEYS.flatMap((key) => {
    const vals = grades.map((g) => g[key]).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    return vals.length ? [{ key, avg: vals.reduce((a, b) => a + b, 0) / vals.length }] : [];
  });
}

const daysAgo = (n: number): string => {
  const d = shamsiStringToDate(getTodayShamsi().formattedDate);
  d.setDate(d.getDate() - n);
  return dateToShamsiString(d);
};

const fa = (n: number) => toPersianDigits(n);

export function computeStudentRisk(student: Student, src: RiskSources, gradeMap?: Map<string, StudentAcademicGrade[]>): StudentRisk | null {
  const from30 = dayKey(daysAgo(30));
  const from14 = dayKey(daysAgo(14));
  const signals: RiskSignal[] = [];

  // غیبت غیرموجه در ۳۰ روز اخیر
  const unexcused = absenceEventsOf(student, src).filter((e) => !e.excused && dayKey(e.date) >= from30).length;
  if (unexcused >= ABSENCE_ALERT_PER_MONTH) signals.push({ key: 'absence', label: `${fa(unexcused)} غیبت غیرموجه در ۳۰ روز اخیر`, points: 3 });
  else if (unexcused === 2) signals.push({ key: 'absence', label: '۲ غیبت غیرموجه در ۳۰ روز اخیر', points: 1 });

  // تأخیر
  const delays = delayEventsOf(student, src).filter((e) => dayKey(e.date) >= from30).length;
  if (delays >= DELAY_ALERT_PER_MONTH) signals.push({ key: 'delay', label: `${fa(delays)} تأخیر در ۳۰ روز اخیر`, points: 2 });

  // انضباط
  const score = student.disciplineScore ?? student.disciplinaryScore ?? 20;
  const recentNotes = (student.disciplinaryNotes || []).filter((n) => dayKey(n.date) >= from30).length;
  if (score < 15) signals.push({ key: 'discipline', label: `نمره انضباط ${fa(score)}`, points: 3 });
  else if (score < 18 || recentNotes >= 2) signals.push({ key: 'discipline', label: recentNotes >= 2 ? `${fa(recentNotes)} مورد انضباطی در ۳۰ روز اخیر` : `نمره انضباط ${fa(score)}`, points: 2 });

  // افت نمره مستمر بین دو ماه آخر
  const avgs = monthlyContinuousAverages(gradeMap ? gradeMap.get(student.id) || [] : src.academicGrades.filter((g) => g.studentId === student.id));
  if (avgs.length >= 2) {
    const drop = avgs[avgs.length - 2].avg - avgs[avgs.length - 1].avg;
    if (drop >= GRADE_DROP_POINTS * 2) signals.push({ key: 'grades', label: `افت ${fa(Math.round(drop * 10) / 10)} نمره‌ای میانگین مستمر`, points: 3 });
    else if (drop >= GRADE_DROP_POINTS) signals.push({ key: 'grades', label: `افت ${fa(Math.round(drop * 10) / 10)} نمره‌ای میانگین مستمر`, points: 2 });
  }

  // کاربرگ: هفته‌های اخیر بدون تحویل کامل
  if (src.worksheets && src.worksheetWeeks) {
    const hist = studentWorksheetHistory(student.id, src.worksheets, src.worksheetWeeks).filter((h) => h.status !== 'absent');
    let streak = 0;
    for (const h of hist) { if (h.status === 'missing' || h.status === 'partial') streak += 1; else break; }
    if (streak >= 3) signals.push({ key: 'worksheet', label: `${fa(streak)} هفته‌ی پیاپی کاربرگ ناقص/تحویل‌نشده`, points: 3 });
    else if (streak === 2) signals.push({ key: 'worksheet', label: '۲ هفته‌ی پیاپی کاربرگ ناقص/تحویل‌نشده', points: 2 });
  }

  // حضور اولیا
  if (src.parentMeetings) {
    const sum = studentParentSummary(student.id, src.parentMeetings);
    const recorded = sum.meetings.filter((m) => m.state !== 'unrecorded');
    const last = recorded[recorded.length - 1];
    if (sum.neverAttended && sum.recorded >= 2) signals.push({ key: 'parent', label: `ولی در هیچ‌یک از ${fa(sum.recorded)} جلسه حاضر نبوده`, points: 3 });
    else if (last && attendanceState(last.record) === 'none') signals.push({ key: 'parent', label: 'غیبت ولی در آخرین جلسه‌ی عمومی', points: 2 });
  }

  // مشاهده‌ی عاطفی/خانوادگی در ۲ هفته اخیر
  if (src.observations) {
    const concerns = src.observations.filter((o) => o.studentId === student.id && (o.category === 'emotional' || o.category === 'family') && dayKey(o.date) >= from14).length;
    if (concerns > 0) signals.push({ key: 'observation', label: `${fa(concerns)} مشاهده‌ی عاطفی/خانوادگی در ۲ هفته اخیر`, points: concerns >= 2 ? 2 : 1 });
  }

  const total = signals.reduce((s, x) => s + x.points, 0);
  if (signals.length < RISK_MIN_SIGNALS || total < RISK_MIN_SCORE) return null;
  return { student, score: total, level: total >= RISK_HIGH_SCORE ? 'high' : 'medium', signals };
}

/** فهرست دانش‌آموزان در خطر (امتیاز بیشتر اول) */
export function computeAtRiskList(students: Student[], src: RiskSources): StudentRisk[] {
  const gradeMap = new Map<string, StudentAcademicGrade[]>();
  src.academicGrades.forEach((g) => gradeMap.set(g.studentId, [...(gradeMap.get(g.studentId) || []), g]));
  return students
    .map((s) => computeStudentRisk(s, src, gradeMap))
    .filter((r): r is StudentRisk => r !== null)
    .sort((a, b) => b.score - a.score || b.signals.length - a.signals.length);
}
