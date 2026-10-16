import type {
  AttendanceSession,
  MorningAttendanceRecord,
  MorningDelayRecord,
  ParentMeetingRecord,
  SchoolAbsenceRecord,
  Student,
  StudentObservation,
  WorksheetRecord,
  WorksheetWeek,
} from '../types';
import { absenceEventsOf, delayEventsOf } from './attendanceStats';
import { PARENT_MEETING_LABELS, attendanceState } from './parentMeetings';
import { getShamsiWeekRange, toPersianDigits } from './persianDate';
import { normalizeShamsi } from './schoolCalendar';
import { WORKSHEET_STATUS_LABEL, shiftWeek, studentWorksheetHistory, weekStartOf, weekTitle } from './worksheets';

export type TimelineKind = 'absence' | 'delay' | 'discipline' | 'observation' | 'parent' | 'worksheet';
export type TimelineTone = 'danger' | 'warn' | 'info' | 'ok' | 'neutral';

export const TIMELINE_KINDS: TimelineKind[] = ['absence', 'delay', 'discipline', 'observation', 'parent', 'worksheet'];

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  absence: 'غیبت',
  delay: 'تأخیر',
  discipline: 'مورد انضباطی',
  observation: 'مشاهدهٔ تربیتی',
  parent: 'حضور اولیا',
  worksheet: 'کاربرگ',
};

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  /** شمسی نرمال‌شده: 1405/07/09 */
  date: string;
  title: string;
  detail?: string;
  tone: TimelineTone;
}

export interface TimelineInput {
  student: Student;
  sessions: AttendanceSession[];
  morningAttendance: MorningAttendanceRecord[];
  morningDelays: MorningDelayRecord[];
  schoolAbsences: SchoolAbsenceRecord[];
  observations: StudentObservation[];
  parentMeetings: ParentMeetingRecord[];
  worksheets: WorksheetRecord[];
  worksheetWeeks: WorksheetWeek[];
  /** منبع‌هایی که کاربر اجازهٔ دیدنشان را ندارد کنار گذاشته می‌شوند */
  allowed: Record<TimelineKind, boolean>;
}

/** همهٔ رویدادهای یک دانش‌آموز روی یک محور زمانی؛ جدیدترین اول */
export function buildStudentTimeline(input: TimelineInput): TimelineEntry[] {
  const { student, allowed } = input;
  const entries: TimelineEntry[] = [];
  const src = {
    morningAttendance: input.morningAttendance,
    morningDelays: input.morningDelays,
    schoolAbsences: input.schoolAbsences,
    sessions: input.sessions,
  };

  if (allowed.absence) {
    // علت و تماس با اولیا از رکورد صبحگاه یا دفتر غیبت (هر کدام که باشد)
    const reasonOf = new Map<string, string>();
    input.schoolAbsences.filter((a) => a.studentId === student.id && a.reason).forEach((a) => reasonOf.set(normalizeShamsi(a.date), a.reason as string));
    input.morningAttendance.filter((r) => r.studentId === student.id && r.status === 'absent' && r.absenceNote).forEach((r) => reasonOf.set(normalizeShamsi(r.date), r.absenceNote as string));
    absenceEventsOf(student, src).forEach((a) => {
      const date = normalizeShamsi(a.date);
      entries.push({
        id: `abs-${date}`,
        kind: 'absence',
        date,
        title: a.excused ? 'غیبت موجه' : 'غیبت غیرموجه',
        detail: reasonOf.get(date) ? `علت: ${reasonOf.get(date)}` : undefined,
        tone: a.excused ? 'info' : 'danger',
      });
    });
  }

  if (allowed.delay) {
    delayEventsOf(student, src).forEach((d, i) => {
      const date = normalizeShamsi(d.date);
      entries.push({ id: `delay-${date}-${i}`, kind: 'delay', date, title: 'تأخیر', detail: `${toPersianDigits(d.minutes)} دقیقه`, tone: 'warn' });
    });
  }

  if (allowed.discipline) {
    (student.disciplinaryNotes || [])
      .filter((n) => n.source !== 'delay_dismissed')
      .forEach((n) => {
        const parts = [n.description, n.scoreDeduction ? `کسر ${toPersianDigits(n.scoreDeduction)} نمره` : ''].filter(Boolean);
        entries.push({ id: `disc-${n.id}`, kind: 'discipline', date: normalizeShamsi(n.date), title: n.title || 'مورد انضباطی', detail: parts.join(' • ') || undefined, tone: 'danger' });
      });
  }

  if (allowed.observation) {
    input.observations
      .filter((o) => o.studentId === student.id)
      .forEach((o) => {
        entries.push({ id: `obs-${o.id}`, kind: 'observation', date: normalizeShamsi(o.date), title: o.title || 'مشاهدهٔ تربیتی', detail: o.categoryLabel || undefined, tone: 'info' });
      });
  }

  if (allowed.parent) {
    input.parentMeetings
      .filter((m) => m.studentId === student.id && m.date && attendanceState(m) !== 'unrecorded')
      .forEach((m) => {
        const st = attendanceState(m);
        const who = st === 'both' ? 'پدر و مادر آمدند' : st === 'father' ? 'فقط پدر آمد' : st === 'mother' ? 'فقط مادر آمد' : 'هیچ‌یک از والدین نیامدند';
        entries.push({
          id: `pm-${m.id}`,
          kind: 'parent',
          date: normalizeShamsi(m.date as string),
          title: `${PARENT_MEETING_LABELS[m.meetingNo]} اولیا`,
          detail: [who, m.note].filter(Boolean).join(' • '),
          tone: st === 'none' ? 'danger' : st === 'both' ? 'ok' : 'neutral',
        });
      });
  }

  if (allowed.worksheet) {
    studentWorksheetHistory(student.id, input.worksheets, input.worksheetWeeks)
      .filter((h) => h.status === 'missing' || h.status === 'partial')
      .forEach((h) => {
        entries.push({
          id: `ws-${h.weekStart}`,
          kind: 'worksheet',
          date: normalizeShamsi(h.weekStart),
          title: `کاربرگ ${WORKSHEET_STATUS_LABEL[h.status]}`,
          detail: `هفتهٔ ${weekTitle(h.weekStart)}`,
          tone: h.status === 'missing' ? 'danger' : 'warn',
        });
      });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
}

export interface WeekBucket {
  weekStart: string;
  title: string;
  counts: Record<TimelineKind, number>;
}

const emptyCounts = (): Record<TimelineKind, number> => ({ absence: 0, delay: 0, discipline: 0, observation: 0, parent: 0, worksheet: 0 });

/** شمار رویدادها به‌تفکیک نوع در چند هفتهٔ آخر (قدیمی‌ترین اول)؛ برای دیدن الگو در یک نگاه */
export function weeklyBuckets(entries: TimelineEntry[], today: string, weeks = 10): WeekBucket[] {
  const todayStart = weekStartOf(today);
  const buckets: WeekBucket[] = [];
  const index = new Map<string, WeekBucket>();
  for (let i = weeks - 1; i >= 0; i--) {
    const start = shiftWeek(todayStart, -i);
    const b: WeekBucket = { weekStart: normalizeShamsi(start), title: weekTitle(start), counts: emptyCounts() };
    buckets.push(b);
    index.set(b.weekStart, b);
  }
  entries.forEach((e) => {
    const start = normalizeShamsi(getShamsiWeekRange(e.date).startDate);
    const b = index.get(start);
    if (b) b.counts[e.kind]++;
  });
  return buckets;
}
