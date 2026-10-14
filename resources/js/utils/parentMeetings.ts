import type { ParentMeetingNo, ParentMeetingRecord } from '../types';
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

export function attendanceState(r: Pick<ParentMeetingRecord, 'father' | 'mother'> | undefined): ParentAttendanceState {
  if (!r) return 'unrecorded';
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
