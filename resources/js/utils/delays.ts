import type { AttendanceSession, MorningAttendanceRecord, MorningDelayRecord, StudentAttendanceRecord } from '../types';

/** هر این‌قدر دقیقه تأخیر تجمعی، یک نمره از نمره انضباط کم می‌شود */
export const DELAY_MINUTES_PER_POINT = 60;
/** نمره‌ای که به‌ازای هر بازه کسر می‌شود */
export const DELAY_POINTS_DEDUCTED = 1;

export interface StudentDelaySummary {
  count: number;
  minutes: number;
}

/**
 * مجموع تأخیر یک دانش‌آموز از همه‌ی منابع: دفتر تأخیر، حضور صبحگاهِ تأخیردار و تأخیر زنگ‌های کلاسی.
 * اگر برای یک روز هم دفتر تأخیر و هم حضور صبحگاه ثبت شده باشد، فقط دفتر تأخیر شمرده می‌شود.
 */
export function summarizeStudentDelays(
  student: { id: string; classId?: string },
  sources: {
    morningDelays: MorningDelayRecord[];
    morningAttendance: MorningAttendanceRecord[];
    sessions: AttendanceSession[];
  }
): StudentDelaySummary {
  let count = 0;
  let minutes = 0;

  const logged = (sources.morningDelays || []).filter((d) => d.studentId === student.id);
  const loggedDates = new Set(logged.map((d) => d.date));
  logged.forEach((d) => {
    count++;
    minutes += d.delayMinutes || 0;
  });

  (sources.morningAttendance || []).forEach((r) => {
    if (r.studentId === student.id && r.status === 'present' && (r.delayMinutes || 0) > 0 && !loggedDates.has(r.date)) {
      count++;
      minutes += r.delayMinutes || 0;
    }
  });

  (sources.sessions || []).forEach((sess) => {
    if (sess.classId !== student.classId || !sess.records) return;
    const rec = (Array.isArray(sess.records)
      ? (sess.records as StudentAttendanceRecord[]).find((r) => r.studentId === student.id)
      : sess.records[student.id]) as StudentAttendanceRecord | undefined;
    if (rec && rec.status === 'late' && (rec.delayMinutes || 0) > 0) {
      count++;
      minutes += rec.delayMinutes || 0;
    }
  });

  return { count, minutes };
}

/** تعداد نمره‌ای که تا این مجموع دقایق باید کسر شده باشد */
export const expectedDelayDeductions = (minutes: number): number => Math.floor(minutes / DELAY_MINUTES_PER_POINT);

/** «۱ ساعت و ۱۵ دقیقه» */
export function formatMinutesLong(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ساعت`);
  if (m > 0 || h === 0) parts.push(`${m} دقیقه`);
  return parts.join(' و ');
}
