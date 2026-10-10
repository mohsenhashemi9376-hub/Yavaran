import type { AttendanceSession, Student } from '../types';
import { dateToShamsiString, tehranNow, toEnglishDigits } from './persianDate';
import { AttendanceSources, absenceEventsOf, delayEventsOf } from './attendanceStats';

/** تاریخ‌های شمسی n روز اخیر (جدیدترین اول) */
export function lastShamsiDays(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = tehranNow();
    d.setDate(d.getDate() - i);
    out.push(dateToShamsiString(d));
  }
  return out;
}

const norm = (d: string) => toEnglishDigits(d || '');

const count = (days: string[], dates: string[]): number[] => {
  const m = new Map<string, number>();
  dates.forEach((d) => m.set(norm(d), (m.get(norm(d)) || 0) + 1));
  return days.map((d) => m.get(d) || 0);
};

/** روند روزانه‌ی تأخیر (تعداد و دقیقه) و غیبت غیرموجه روزانه در n روز اخیر (جدیدترین اول) */
export function attendanceTrends(students: Student[], src: AttendanceSources, n = 14) {
  const days = lastShamsiDays(n);
  const delayDates: string[] = [];
  const delayMinutes = new Map<string, number>();
  const absenceDates: string[] = [];
  students.forEach((s) => {
    delayEventsOf(s, src).forEach((e) => {
      delayDates.push(e.date);
      delayMinutes.set(norm(e.date), (delayMinutes.get(norm(e.date)) || 0) + e.minutes);
    });
    absenceEventsOf(s, src).forEach((e) => { if (!e.excused) absenceDates.push(e.date); });
  });
  return {
    days,
    delays: count(days, delayDates),
    minutes: days.map((d) => delayMinutes.get(d) || 0),
    absences: count(days, absenceDates),
  };
}

/** روند ثبت جلسه و جلسات دارای تکلیف در n روز اخیر (جدیدترین اول) */
export function sessionTrends(sessions: AttendanceSession[], n = 14) {
  const days = lastShamsiDays(n);
  return {
    days,
    sessions: count(days, sessions.map((s) => s.date)),
    homework: count(days, sessions.filter((s) => (s.homeworkDescription || '').trim()).map((s) => s.date)),
  };
}

export interface TrendDetail { id: string; date: string; studentId?: string; sessionId?: string; title: string; subtitle?: string; badge?: string }

/** فهرست رویدادهای تأخیر و غیبت غیرموجه n روز اخیر (جدیدترین اول) */
export function attendanceDetails(
  students: Student[],
  src: AttendanceSources,
  kind: 'delays' | 'absences',
  classNameOf: (classId: string) => string,
  n = 14
): TrendDetail[] {
  const days = new Set(lastShamsiDays(n));
  const rows: TrendDetail[] = [];
  students.forEach((s) => {
    const base = { studentId: s.id, title: `${s.lastName || ''} ${s.firstName || ''}`.trim(), subtitle: classNameOf(s.classId) };
    if (kind === 'delays') {
      delayEventsOf(s, src).forEach((e, i) => {
        if (days.has(norm(e.date))) rows.push({ ...base, id: `d-${s.id}-${e.date}-${i}`, date: e.date, badge: `${e.minutes} دقیقه` });
      });
    } else {
      absenceEventsOf(s, src).forEach((e, i) => {
        if (!e.excused && days.has(norm(e.date))) rows.push({ ...base, id: `a-${s.id}-${e.date}-${i}`, date: e.date, badge: 'غیرموجه' });
      });
    }
  });
  return rows.sort((a, b) => norm(b.date).localeCompare(norm(a.date)));
}

/** جلسات n روز اخیر؛ در حالت homework فقط جلسات دارای تکلیف (جدیدترین اول) */
export function sessionDetails(
  sessions: AttendanceSession[],
  onlyHomework: boolean,
  classNameOf: (classId: string) => string,
  n = 14
): TrendDetail[] {
  const days = new Set(lastShamsiDays(n));
  return sessions
    .filter((s) => days.has(norm(s.date)) && (!onlyHomework || (s.homeworkDescription || '').trim()))
    .map((s) => ({
      id: s.id,
      sessionId: s.id,
      date: s.date,
      title: `${classNameOf(s.classId)} • ${s.subject}${s.teacherName ? ` • ${s.teacherName}` : ''}`,
      subtitle: onlyHomework ? `تکلیف: ${(s.homeworkDescription || '').trim()}` : s.lessonTopic || undefined,
    }))
    .sort((a, b) => norm(b.date).localeCompare(norm(a.date)));
}
