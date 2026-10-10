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
