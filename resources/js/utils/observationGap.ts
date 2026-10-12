import { SchoolHoliday, Student, StudentObservation } from '../types';
import { dateToShamsiString, shamsiStringToDate, tehranNow } from './persianDate';
import { closedReasonOf, normalizeShamsi } from './schoolCalendar';

/** «۲ هفته» = ۱۲ روز درسی (جمعه‌ها و تعطیلی‌های اعلام‌شده شمرده نمی‌شوند) با سقف ۴۵ روز تقویمی */
export const OBSERVATION_GAP_SCHOOL_DAYS = 12;
const MAX_LOOKBACK_DAYS = 45;
/** دانش‌آموز تازه‌ثبت‌شده در این مدت (روز) هشدار نمی‌گیرد */
export const NEW_STUDENT_GRACE_DAYS = 14;

export interface StaleObservationEntry {
  student: Student;
  lastDate: string | null;
  /** روزهای تقویمی از آخرین مشاهده؛ null = هرگز */
  daysSince: number | null;
}

/** اولین روز بازه‌ی بررسی (شمسی نرمال‌شده) */
export function observationWindowStart(holidays: Pick<SchoolHoliday, 'date'>[]): string {
  const d = tehranNow();
  let open = 0;
  let start = normalizeShamsi(dateToShamsiString(d));
  for (let i = 0; i < MAX_LOOKBACK_DAYS && open < OBSERVATION_GAP_SCHOOL_DAYS; i++) {
    const day = new Date(d.getTime());
    day.setDate(day.getDate() - i);
    start = normalizeShamsi(dateToShamsiString(day));
    if (!closedReasonOf(start, holidays)) open++;
  }
  return start;
}

/** دانش‌آموزان بدون مشاهده‌گری در بازه‌ی اخیر؛ بیشترین فاصله از آخرین مشاهده در ابتدا */
export function staleObservationStudents(
  students: Student[],
  observations: StudentObservation[],
  holidays: Pick<SchoolHoliday, 'date'>[]
): StaleObservationEntry[] {
  const start = observationWindowStart(holidays);
  const last = new Map<string, string>();
  observations.forEach((o) => {
    const n = normalizeShamsi(o.date || '');
    if (n > (last.get(o.studentId) || '')) last.set(o.studentId, n);
  });
  const now = tehranNow().getTime();
  const grace = NEW_STUDENT_GRACE_DAYS * 86400000;

  return students
    .filter((s) => {
      const created = (s as Student & { createdAt?: string }).createdAt;
      if (created) {
        const t = Date.parse(created);
        if (!Number.isNaN(t) && Date.now() - t < grace) return false;
      }
      return (last.get(s.id) || '') < start;
    })
    .map((s) => {
      const lastDate = last.get(s.id) || null;
      const daysSince = lastDate ? Math.max(0, Math.floor((now - shamsiStringToDate(lastDate).getTime()) / 86400000)) : null;
      return { student: s, lastDate, daysSince };
    })
    .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity));
}
