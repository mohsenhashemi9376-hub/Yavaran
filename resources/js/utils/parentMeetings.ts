import type { ParentMeetingNo, ParentMeetingRecord, ParentMeetingState } from '../types';
import { getRealTodayShamsiString, toEnglishDigits } from './persianDate';

/** سه جلسه‌ی عمومی اولیاء در هر سال تحصیلی */
export const PARENT_MEETING_NUMBERS: ParentMeetingNo[] = [1, 2, 3];

export const PARENT_MEETING_LABELS: Record<ParentMeetingNo, string> = {
  1: 'جلسه‌ی اول',
  2: 'جلسه‌ی دوم',
  3: 'جلسه‌ی سوم',
};

/** سال شروع سال تحصیلی جاری (از اول مهر)؛ هم‌راستا با AcademicYear::current در سرور */
export function currentAcademicStartYear(): number {
  const [y, m] = toEnglishDigits(getRealTodayShamsiString()).split('/').map(Number);
  return m >= 7 ? y : y - 1;
}

export const parentMeetingId = (year: string, meetingNo: ParentMeetingNo, studentId: string): string =>
  `pm-${year}-${meetingNo}-${studentId}`;

export type ParentAttendanceState = 'unrecorded' | 'both' | 'father' | 'mother' | 'none';

export function attendanceState(r: Pick<ParentMeetingRecord, 'father' | 'mother' | 'hasAttendance'> | undefined): ParentAttendanceState {
  if (!r || r.hasAttendance === false) return 'unrecorded';
  if (r.father && r.mother) return 'both';
  if (r.father) return 'father';
  if (r.mother) return 'mother';
  return 'none';
}

export const ATTENDANCE_STATE_LABELS: Record<ParentAttendanceState, string> = {
  unrecorded: 'ثبت‌نشده',
  both: 'پدر و مادر',
  father: 'فقط پدر',
  mother: 'فقط مادر',
  none: 'هیچ‌کدام حاضر نبودند',
};

export interface ParentMeetingSummary {
  total: number;
  recorded: number;
  both: number;
  father: number;
  mother: number;
  none: number;
  /** دانش‌آموزانی که دست‌کم یکی از والدینشان آمده است */
  attended: number;
  /** درصد حضور (حداقل یک ولی) از کل دانش‌آموزان */
  rate: number;
}

export function summarizeMeeting(studentIds: string[], records: ParentMeetingRecord[]): ParentMeetingSummary {
  const byStudent = new Map(records.map((r) => [r.studentId, r]));
  const s: ParentMeetingSummary = { total: studentIds.length, recorded: 0, both: 0, father: 0, mother: 0, none: 0, attended: 0, rate: 0 };
  for (const id of studentIds) {
    const st = attendanceState(byStudent.get(id));
    if (st === 'unrecorded') continue;
    s.recorded++;
    s[st]++;
  }
  s.attended = s.both + s.father + s.mother;
  s.rate = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
  return s;
}

export interface StudentParentSummary {
  /** تعداد جلسه‌های ثبت‌شده (از سه جلسه) */
  recorded: number;
  fatherCount: number;
  motherCount: number;
  /** جلسه‌هایی که دست‌کم یکی از والدین آمده است */
  attendedCount: number;
  bothCount: number;
  /** هیچ ولی‌ای در جلسه‌های ثبت‌شده نیامده است */
  neverAttended: boolean;
  meetings: { no: ParentMeetingNo; record?: ParentMeetingRecord; state: ParentAttendanceState }[];
}

/** آمار تجمیعی حضور پدر و مادر یک دانش‌آموز در سال تحصیلی جاری (برای پرونده فردی) */
export function studentParentSummary(studentId: string, records: ParentMeetingRecord[], yearKey = String(currentAcademicStartYear())): StudentParentSummary {
  const mine = records.filter((r) => r.studentId === studentId && r.academicYear === yearKey);
  const meetings = PARENT_MEETING_NUMBERS.map((no) => {
    const record = mine.find((r) => r.meetingNo === no);
    return { no, record, state: attendanceState(record) };
  });
  const rec = meetings.filter((m) => m.state !== 'unrecorded');
  const attendedCount = rec.filter((m) => m.state !== 'none').length;
  return {
    recorded: rec.length,
    fatherCount: rec.filter((m) => m.record?.father).length,
    motherCount: rec.filter((m) => m.record?.mother).length,
    attendedCount,
    bothCount: rec.filter((m) => m.state === 'both').length,
    neverAttended: rec.length > 0 && attendedCount === 0,
    meetings,
  };
}

export type MeetingStatus = 'open' | 'held' | 'pending';

/**
 * وضعیت جلسه در سال تحصیلی: open = باز (حضور ثبت می‌شود)، held = برگزارشده و بسته، pending = هنوز باز نشده.
 * جلسه‌ای که دست‌کم برای یک نفر حضورش ثبت شده «برگزارشده» حساب می‌شود؛ جلسه‌ی بدون رکورد وضعیت که قبلاً حضور دارد، باز است.
 */
export function meetingStatus(no: ParentMeetingNo, states: ParentMeetingState[], records: ParentMeetingRecord[], yearKey = String(currentAcademicStartYear())): MeetingStatus {
  const st = states.find((s) => s.academicYear === yearKey && s.meetingNo === no);
  if (st) return st.open ? 'open' : st.closedAt ? 'held' : records.some((r) => r.academicYear === yearKey && r.meetingNo === no && r.hasAttendance !== false) ? 'held' : 'pending';
  return records.some((r) => r.academicYear === yearKey && r.meetingNo === no && r.hasAttendance !== false) ? 'open' : 'pending';
}

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  open: 'باز',
  held: 'برگزار شد · بسته',
  pending: 'هنوز باز نشده',
};

/** جلسه‌ی «برگزارشده» برای هشدار: بسته‌شده یا دست‌کم یک نفر در آن ثبت شده باشد */
export const isMeetingHeld = (no: ParentMeetingNo, states: ParentMeetingState[], records: ParentMeetingRecord[], yearKey?: string): boolean => {
  const key = yearKey ?? String(currentAcademicStartYear());
  const st = states.find((s) => s.academicYear === key && s.meetingNo === no);
  return !!st?.closedAt || records.some((r) => r.academicYear === key && r.meetingNo === no && r.hasAttendance !== false);
};
