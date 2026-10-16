import type { AttendanceSession, MorningAttendanceRecord, MorningDelayRecord, ParentMeetingRecord, SchoolAbsenceRecord, Student, StudentObservation, WorksheetRecord, WorksheetWeek } from '../types';
import { absenceEventsOf, delayEventsOf, persianWeekdayIndex } from './attendanceStats';
import { ATTENDANCE_STATE_LABELS, attendanceState } from './parentMeetings';
import { toEnglishDigits, PERSIAN_WEEKDAYS } from './persianDate';
import { WORKSHEET_STATUS_LABEL, studentWorksheetHistory, weekTitle } from './worksheets';

export type TimelineKind = 'absence' | 'delay' | 'discipline' | 'observation' | 'parent' | 'worksheet';

export const TIMELINE_KIND_LABEL: Record<TimelineKind, string> = {
  absence: 'غیبت',
  delay: 'تأخیر',
  discipline: 'انضباطی',
  observation: 'مشاهده تربیتی',
  parent: 'حضور اولیا',
  worksheet: 'کاربرگ',
};

export interface StudentTimelineEvent {
  id: string;
  /** تاریخ شمسی با صفر پیشین؛ قابل مقایسه‌ی رشته‌ای */
  date: string;
  kind: TimelineKind;
  title: string;
  detail?: string;
  /** رویداد نگران‌کننده (برای پررنگ‌شدن در خط زمانی) */
  negative: boolean;
}

/** «۱۴۰۵/۷/۹» ← «1405/07/09» */
export const dayKey = (d: string): string => toEnglishDigits(d || '').split('/').map((p, i) => (i === 0 ? p : p.padStart(2, '0'))).join('/');

export interface TimelineSources {
  student: Student;
  morningDelays: MorningDelayRecord[];
  morningAttendance: MorningAttendanceRecord[];
  schoolAbsences: SchoolAbsenceRecord[];
  sessions: AttendanceSession[];
  observations?: StudentObservation[];
  parentMeetings?: ParentMeetingRecord[];
  worksheets?: WorksheetRecord[];
  worksheetWeeks?: WorksheetWeek[];
}

/** همه‌ی رویدادهای یک دانش‌آموز روی یک خط زمانی (جدیدترین اول) */
export function buildStudentTimeline(src: TimelineSources): StudentTimelineEvent[] {
  const { student } = src;
  const out: StudentTimelineEvent[] = [];

  absenceEventsOf(student, src).forEach((e, i) => out.push({
    id: `abs-${e.date}-${i}`, date: dayKey(e.date), kind: 'absence', negative: !e.excused,
    title: e.excused ? 'غیبت موجه' : 'غیبت غیرموجه',
    detail: PERSIAN_WEEKDAYS[(persianWeekdayIndex(e.date) + 6) % 7],
  }));

  delayEventsOf(student, src).forEach((e, i) => out.push({
    id: `dly-${e.date}-${i}`, date: dayKey(e.date), kind: 'delay', negative: e.minutes > 20,
    title: `تأخیر ${e.minutes} دقیقه‌ای`,
  }));

  (student.disciplinaryNotes || []).forEach((n) => out.push({
    id: `disc-${n.id}`, date: dayKey(n.date), kind: 'discipline', negative: true,
    title: n.title || 'مورد انضباطی',
    detail: [n.description, n.scoreDeduction ? `کسر ${n.scoreDeduction} نمره` : ''].filter(Boolean).join(' · '),
  }));

  (src.observations || []).filter((o) => o.studentId === student.id).forEach((o) => out.push({
    id: `obs-${o.id}`, date: dayKey(o.date), kind: 'observation',
    negative: o.category === 'emotional' || o.category === 'family',
    title: o.title || 'مشاهده تربیتی',
    detail: o.content,
  }));

  (src.parentMeetings || []).filter((r) => r.studentId === student.id && r.hasAttendance !== false && r.date).forEach((r) => {
    const st = attendanceState(r);
    out.push({
      id: `pm-${r.id}`, date: dayKey(r.date as string), kind: 'parent', negative: st === 'none',
      title: `جلسه‌ی عمومی اولیا (${r.meetingNo})`,
      detail: ATTENDANCE_STATE_LABELS[st],
    });
  });

  if (src.worksheets && src.worksheetWeeks) {
    studentWorksheetHistory(student.id, src.worksheets, src.worksheetWeeks).forEach((h) => out.push({
      id: `ws-${h.weekStart}`, date: dayKey(h.weekStart), kind: 'worksheet', negative: h.status === 'missing' || h.status === 'partial',
      title: `کاربرگ هفته‌ی ${weekTitle(h.weekStart)}`,
      detail: WORKSHEET_STATUS_LABEL[h.status],
    }));
  }

  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** الگوی غیبت/تأخیر: پرتکرارترین روز هفته (حداقل ۳ مورد و ≥۴۰٪ موارد) */
export function weekdayPattern(events: StudentTimelineEvent[]): { weekday: string; count: number; total: number } | null {
  const rel = events.filter((e) => e.kind === 'absence' || e.kind === 'delay');
  if (rel.length < 3) return null;
  const tally = new Array(7).fill(0) as number[];
  rel.forEach((e) => { tally[persianWeekdayIndex(e.date)] += 1; });
  const max = Math.max(...tally);
  if (max < 3 || max / rel.length < 0.4) return null;
  const idx = tally.indexOf(max);
  return { weekday: PERSIAN_WEEKDAYS[(idx + 6) % 7], count: max, total: rel.length };
}
