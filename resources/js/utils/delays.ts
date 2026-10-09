import type { AttendanceSession, MorningAttendanceRecord, MorningDelayRecord, StudentAttendanceRecord } from '../types';

/** هر این‌قدر دقیقه تأخیر تجمعی، پس از تأیید معاون انضباطی یک نمره از نمره انضباط کم می‌شود */
export const DELAY_MINUTES_PER_POINT = 120;
/** کسرهای خودکار قدیمی (پیش از الزام تأیید) هر یک معادل این‌قدر دقیقه بودند */
export const LEGACY_AUTO_DELAY_MINUTES = 60;
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

/** شناسه‌ی پیشنهاد کسر k‌ام (۱، ۲، …) برای یک دانش‌آموز */
export const delayDeductionId = (studentId: string, k: number): string => `delay-ded-${studentId}-${k}`;

export interface DelayDeductionState {
  /** تعداد کسرهای تأییدشده */
  approved: number;
  /** تعداد پیشنهادهای ردشده */
  dismissed: number;
  /** تعداد پیشنهادهای منتظر تأیید */
  pending: number;
  /** شماره‌ی k بعدی که در صورت تأیید ثبت می‌شود */
  nextIndex: number;
  /** دقیقه‌ی مانده تا پیشنهاد بعدی */
  minutesToNext: number;
}

/**
 * وضعیت کسر نمره بابت تأخیر: هر ۱۲۰ دقیقه‌ی تجمعی یک پیشنهاد کسر یک‌نمره‌ای می‌سازد که تا تأیید معاون انضباطی اعمال نمی‌شود.
 * کسرهای خودکار قدیمی (هر ۶۰ دقیقه) همان‌طور که اعمال شده‌اند می‌مانند و دقایقشان از شمارش کم می‌شود تا دوبار کسر نشود.
 */
export function delayDeductionState(
  notes: { source?: string }[] | undefined,
  totalMinutes: number
): DelayDeductionState {
  const list = notes || [];
  const legacy = list.filter((n) => n.source === 'auto_delay').length;
  const approved = list.filter((n) => n.source === 'approved_delay').length;
  const dismissed = list.filter((n) => n.source === 'delay_dismissed').length;
  const effective = Math.max(0, totalMinutes - legacy * LEGACY_AUTO_DELAY_MINUTES);
  const earned = Math.floor(effective / DELAY_MINUTES_PER_POINT);
  const handled = approved + dismissed;
  return {
    approved,
    dismissed,
    pending: Math.max(0, earned - handled),
    nextIndex: handled + 1,
    minutesToNext: DELAY_MINUTES_PER_POINT - (effective % DELAY_MINUTES_PER_POINT),
  };
}

/** «۱ ساعت و ۱۵ دقیقه» */
export function formatMinutesLong(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ساعت`);
  if (m > 0 || h === 0) parts.push(`${m} دقیقه`);
  return parts.join(' و ');
}
