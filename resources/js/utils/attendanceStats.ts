import type { AttendanceSession, MorningAttendanceRecord, MorningDelayRecord, SchoolAbsenceRecord, Student, StudentAttendanceRecord } from '../types';
import { toEnglishDigits } from './persianDate';
import { delayDeductionState, summarizeStudentDelays } from './delays';

/** سقف غیبت غیرموجه در یک ماه، پیش از هشدار به مدیر و معاون انضباطی */
export const ABSENCE_ALERT_PER_MONTH = 3;
/** سقف دفعات تأخیر در یک ماه، پیش از هشدار به معاون انضباطی */
export const DELAY_ALERT_PER_MONTH = 3;

export interface AttendanceSources {
  morningDelays: MorningDelayRecord[];
  morningAttendance: MorningAttendanceRecord[];
  schoolAbsences: SchoolAbsenceRecord[];
  sessions: AttendanceSession[];
}

export interface DelayEvent { date: string; minutes: number }
export interface AbsenceEvent { date: string; excused: boolean }

const norm = (d: string) => toEnglishDigits(d || '');
/** «۱۴۰۵/۰۷» از تاریخ کامل */
export const monthKeyOf = (date: string): string => norm(date).split('/').slice(0, 2).map((p, i) => (i === 1 ? p.padStart(2, '0') : p)).join('/');

/** رویدادهای تأخیر (با تاریخ) به همان قاعده‌ی summarizeStudentDelays: دفتر تأخیر، صبحگاه تأخیردار و تأخیر زنگ کلاس */
export function delayEventsOf(student: Student, src: AttendanceSources): DelayEvent[] {
  const events: DelayEvent[] = [];
  const logged = (src.morningDelays || []).filter((d) => d.studentId === student.id);
  const loggedDates = new Set(logged.map((d) => d.date));
  logged.forEach((d) => events.push({ date: d.date, minutes: d.delayMinutes || 0 }));
  (src.morningAttendance || []).forEach((r) => {
    if (r.studentId === student.id && r.status === 'present' && (r.delayMinutes || 0) > 0 && !loggedDates.has(r.date)) {
      events.push({ date: r.date, minutes: r.delayMinutes || 0 });
    }
  });
  (src.sessions || []).forEach((sess) => {
    if (sess.classId !== student.classId || !sess.records) return;
    const rec = (Array.isArray(sess.records)
      ? (sess.records as StudentAttendanceRecord[]).find((r) => r.studentId === student.id)
      : sess.records[student.id]) as StudentAttendanceRecord | undefined;
    if (rec && rec.status === 'late' && (rec.delayMinutes || 0) > 0) events.push({ date: sess.date, minutes: rec.delayMinutes || 0 });
  });
  return events;
}

/**
 * غیبت‌های روزانه‌ی مدرسه (صبحگاه + دفتر غیبت). غیبت‌های کلاسی (زنگ‌ها) عمداً شمرده نمی‌شوند.
 * برای یک روز فقط یک غیبت شمرده می‌شود (اگر در هر دو منبع باشد، غیرموجه بر موجه غلبه دارد).
 */
export function absenceEventsOf(student: Student, src: AttendanceSources): AbsenceEvent[] {
  const byDate = new Map<string, boolean>(); // date → excused
  const put = (date: string, excused: boolean) => {
    const key = norm(date);
    byDate.set(key, byDate.has(key) ? byDate.get(key)! && excused : excused);
  };
  (src.morningAttendance || []).forEach((r) => { if (r.studentId === student.id && r.status === 'absent') put(r.date, Boolean(r.isExcused)); });
  (src.schoolAbsences || []).forEach((a) => { if (a.studentId === student.id) put(a.date, Boolean(a.isExcused)); });
  return Array.from(byDate, ([date, excused]) => ({ date, excused }));
}

export interface StudentAttendanceStat {
  student: Student;
  /** مجموع (در بازه‌ی انتخابی) */
  delayCount: number;
  delayMinutes: number;
  unexcusedAbsences: number;
  excusedAbsences: number;
  /** همین ماه جاری (برای هشدار) */
  monthUnexcused: number;
  monthDelayCount: number;
  /** کل دوره (برای کسر نمره) */
  totalDelayMinutes: number;
  pendingDeductions: number;
  approvedDeductions: number;
}

export function buildAttendanceStats(
  students: Student[],
  src: AttendanceSources,
  opts: { monthKey: string; period: 'month' | 'all' }
): StudentAttendanceStat[] {
  return students.map((student) => {
    const delays = delayEventsOf(student, src);
    const absences = absenceEventsOf(student, src);
    const inPeriod = (date: string) => opts.period === 'all' || monthKeyOf(date) === opts.monthKey;
    const periodDelays = delays.filter((e) => inPeriod(e.date));
    const periodAbsences = absences.filter((e) => inPeriod(e.date));
    const totalDelayMinutes = summarizeStudentDelays(student, src).minutes;
    const state = delayDeductionState(student.disciplinaryNotes, totalDelayMinutes);
    return {
      student,
      delayCount: periodDelays.length,
      delayMinutes: periodDelays.reduce((a, e) => a + e.minutes, 0),
      unexcusedAbsences: periodAbsences.filter((e) => !e.excused).length,
      excusedAbsences: periodAbsences.filter((e) => e.excused).length,
      monthUnexcused: absences.filter((e) => !e.excused && monthKeyOf(e.date) === opts.monthKey).length,
      monthDelayCount: delays.filter((e) => monthKeyOf(e.date) === opts.monthKey).length,
      totalDelayMinutes,
      pendingDeductions: state.pending,
      approvedDeductions: state.approved,
    };
  });
}
