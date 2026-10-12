import { AttendanceSession } from '../types';
import { toEnglishDigits } from './persianDate';
import { homeworkOutcome } from './classroomActivity';

const norm = (d: string) => toEnglishDigits(d || '').replace(/-/g, '/');

const sameCourse = (a: AttendanceSession, b: AttendanceSession) =>
  a.classId === b.classId && (a.subjectId && b.subjectId ? a.subjectId === b.subjectId : a.subject === b.subject);

/** کلید ترتیب زمانی جلسه: تاریخ شمسی + شماره زنگ */
const orderKey = (date: string, period?: number) => `${norm(date)}#${String(period ?? 1).padStart(2, '0')}`;

/**
 * جلسه قبلی همان درس در همان کلاس (قبل از تاریخ/زنگ داده‌شده).
 * وضعیت «انجام‌شده / ناقص / انجام‌نشده» هر دانش‌آموز در یک جلسه، مربوط به تکلیف همین جلسه قبلی است.
 */
export function previousCourseSession(
  sessions: AttendanceSession[],
  ref: Pick<AttendanceSession, 'id' | 'classId' | 'subjectId' | 'subject' | 'date' | 'periodNumber'>
): AttendanceSession | undefined {
  const refKey = orderKey(ref.date, ref.periodNumber);
  let best: AttendanceSession | undefined;
  let bestKey = '';
  sessions.forEach((s) => {
    if (s.id === ref.id || !sameCourse(s, ref as AttendanceSession)) return;
    const k = orderKey(s.date, s.periodNumber);
    if (k < refKey && k > bestKey) {
      best = s;
      bestKey = k;
    }
  });
  return best;
}

/** تعداد دانش‌آموزانی که در n روز اخیر تکلیف جلسه قبل را انجام‌نشده/ناقص تحویل داده‌اند */
export function homeworkProblemStudentCount(sessions: AttendanceSession[], days: string[]): number {
  const inRange = new Set(days.map(norm));
  const ids = new Set<string>();
  sessions.forEach((s) => {
    if (!inRange.has(norm(s.date)) || !previousCourseSession(sessions, s)) return;
    Object.values(s.records || {}).forEach((r) => {
      const o = homeworkOutcome(r);
      if (o === 'not_done' || o === 'incomplete') ids.add(r.studentId);
    });
  });
  return ids.size;
}

/**
 * وضعیت‌های «انجام شده»ی بی‌مبنا: جلسه‌ای که تکلیفی برای ارزیابی نداشته (جلسه قبل نبوده یا تکلیفی در آن ثبت نشده)
 * ولی وضعیت «انجام شده» برای دانش‌آموز ثبت شده است؛ یعنی مقدار پیش‌فرض قدیمی فرم، نه ارزیابی استاد.
 * @returns نگاشت شناسه‌ی جلسه ← شناسه‌ی دانش‌آموزان
 */
export function baselessHomeworkRecords(sessions: AttendanceSession[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  sessions.forEach((s) => {
    const prev = previousCourseSession(sessions, s);
    if (prev && (prev.homeworkDescription || '').trim()) return;
    const ids = Object.entries(s.records || {})
      .filter(([, r]) => r.homeworkStatus === 'done' && !r.classroomActivity)
      .map(([id]) => id);
    if (ids.length > 0) out.set(s.id, ids);
  });
  return out;
}
