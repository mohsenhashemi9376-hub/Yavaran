import { AttendanceSession } from '../types';
import { toEnglishDigits, toPersianDigits } from './persianDate';

export interface ActivitySummary {
  excellent: number;
  done: number;
  incomplete: number;
  notDone: number;
  total: number;
}

/** ماه شمسی (۱..۱۲) مربوط به هر بازه ثبت نمره؛ برای جمع‌بندی تکالیف همان ماه */
export const PERIOD_MONTH: Record<string, number | undefined> = {
  mehrContinuous: 7,
  abanContinuous: 8,
  azarContinuous: 9,
  term1Continuous: 10,
  term1Final: 10,
  bahmanContinuous: 11,
  esfandContinuous: 12,
  farvardinContinuous: 1,
  ordibeheshtContinuous: 2,
  term2Continuous: 3,
  term2Final: 3,
};

export function summarizeActivity(
  sessions: AttendanceSession[],
  studentId: string,
  opts: { classId?: string; subjectId?: string; subjectName?: string; month?: number } = {}
): ActivitySummary {
  const out: ActivitySummary = { excellent: 0, done: 0, incomplete: 0, notDone: 0, total: 0 };
  sessions.forEach((s) => {
    if (opts.classId && s.classId !== opts.classId) return;
    if (opts.subjectId || opts.subjectName) {
      const same = opts.subjectId && s.subjectId ? s.subjectId === opts.subjectId : s.subject === opts.subjectName;
      if (!same) return;
    }
    if (opts.month && Number(toEnglishDigits(s.date).split('/')[1]) !== opts.month) return;
    const rec = s.records?.[studentId];
    if (!rec || rec.status === 'absent' || rec.status === 'excused') return;
    // وضعیت تکلیف (انجام شده / ناقص / انجام نشده)؛ ارزیابی قدیمی «عالی» هم همچنان شمرده می‌شود
    const a = rec.classroomActivity;
    if (a === 'excellent') out.excellent++;
    else if (rec.homeworkStatus === 'incomplete' || a === 'incomplete') out.incomplete++;
    else if (rec.homeworkStatus === 'not_done') out.notDone++;
    else out.done++;
    out.total++;
  });
  return out;
}

/** «۱۰ تکلیف انجام‌شده، ۱ ناقص» */
export function formatActivitySummary(s: ActivitySummary): string {
  if (s.total === 0) return '';
  const parts: string[] = [];
  if (s.excellent) parts.push(`${toPersianDigits(s.excellent)} عالی`);
  if (s.done) parts.push(`${toPersianDigits(s.done)} انجام‌شده`);
  if (s.incomplete) parts.push(`${toPersianDigits(s.incomplete)} ناقص`);
  if (s.notDone) parts.push(`${toPersianDigits(s.notDone)} انجام‌نشده`);
  return parts.join('، ');
}
