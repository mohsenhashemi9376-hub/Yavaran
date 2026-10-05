import {
  AttendanceSession,
  GradePeriod,
  MONTHLY_EVALUATION_PERIODS,
  MorningAttendanceRecord,
  MorningDelayRecord,
  SchoolAbsenceRecord,
  SchoolClass,
  Student,
  StudentAcademicGrade,
} from '../types';
import { getShamsiWeekRange, getTodayShamsi, shamsiStringToDate, toEnglishDigits, toPersianDigits } from './persianDate';

export type WarningType = 'consecutive_absence' | 'weekly_delays' | 'grade_drop';

export interface EarlyWarningItem {
  type: WarningType;
  label: string;
}

export interface EarlyWarningStudent {
  student: Student;
  className: string;
  items: EarlyWarningItem[];
}

export const CONSECUTIVE_ABSENCE_LIMIT = 3;
export const WEEKLY_DELAY_LIMIT = 2; // بیش از ۲ بار
export const GRADE_DROP_LIMIT = 2; // بیش از ۲ نمره

const en = (d: string) => toEnglishDigits(d || '');
const dayNumber = (d: string) => Math.floor(shamsiStringToDate(en(d)).getTime() / 86_400_000);

/** طول بلندترین دنباله پایانی غیبت‌های متوالی (جدیدترین‌ها) در فهرست زمانی [غایب؟] */
const trailingRun = (flags: boolean[]) => {
  let n = 0;
  for (let i = flags.length - 1; i >= 0 && flags[i]; i--) n++;
  return n;
};

export interface EarlyWarningInput {
  students: Student[];
  classes: SchoolClass[];
  sessions: AttendanceSession[];
  morningAttendance: MorningAttendanceRecord[];
  morningDelays: MorningDelayRecord[];
  schoolAbsences: SchoolAbsenceRecord[];
  academicGrades: StudentAcademicGrade[];
  gradePeriods: GradePeriod[];
}

/** بازه فعال جاری و بازه قبلی آن (به ترتیب سال تحصیلی) */
function currentAndPreviousPeriod(gradePeriods: GradePeriod[]) {
  const order = MONTHLY_EVALUATION_PERIODS.map((p) => p.key);
  const activeKeys = gradePeriods.filter((p) => p.isActive).map((p) => p.code);
  const current = [...order].reverse().find((k) => activeKeys.includes(k));
  return { current, order };
}

export function computeEarlyWarnings(input: EarlyWarningInput): EarlyWarningStudent[] {
  const { students, classes, sessions, morningAttendance, morningDelays, schoolAbsences, academicGrades, gradePeriods } = input;
  const classById = new Map(classes.map((c) => [c.id, c]));
  const today = getTodayShamsi().formattedDate;
  const week = getShamsiWeekRange(today);
  const weekStart = en(week.startDate);
  const todayEn = en(today);

  const sessionsByClass = new Map<string, AttendanceSession[]>();
  sessions.forEach((s) => sessionsByClass.set(s.classId, [...(sessionsByClass.get(s.classId) || []), s]));
  sessionsByClass.forEach((list) =>
    list.sort((a, b) => en(a.date).localeCompare(en(b.date)) || (a.periodNumber ?? 0) - (b.periodNumber ?? 0))
  );

  const { current, order } = currentAndPreviousPeriod(gradePeriods);
  const gradesByStudent = new Map<string, StudentAcademicGrade[]>();
  academicGrades.forEach((g) => gradesByStudent.set(g.studentId, [...(gradesByStudent.get(g.studentId) || []), g]));

  const result: EarlyWarningStudent[] = [];

  students.forEach((student) => {
    const items: EarlyWarningItem[] = [];

    // الف) غیبت‌های متوالی — جلسات کلاسی
    const classFlags = (sessionsByClass.get(student.classId) || [])
      .filter((s) => s.records?.[student.id])
      .map((s) => {
        const st = s.records[student.id].status;
        return st === 'absent' || st === 'excused';
      });
    let run = trailingRun(classFlags);

    // غیبت‌های صبحگاه: روزهای ثبت‌شده (رکورد غایب جدید + دفتر غیبت قدیمی) و حضورها
    const morningDays = new Map<string, boolean>();
    morningAttendance
      .filter((r) => r.studentId === student.id)
      .forEach((r) => morningDays.set(en(r.date), r.status === 'absent'));
    schoolAbsences
      .filter((a) => a.studentId === student.id)
      .forEach((a) => {
        if (!morningDays.has(en(a.date))) morningDays.set(en(a.date), true);
      });
    const morningFlags = Array.from(morningDays.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, absent]) => absent);
    run = Math.max(run, trailingRun(morningFlags));

    if (run >= CONSECUTIVE_ABSENCE_LIMIT) {
      items.push({ type: 'consecutive_absence', label: `⚠️ ${toPersianDigits(run)} غیبت متوالی` });
    }

    // ب) تأخیر ورود در هفته جاری (از شنبه تا امروز)
    const inWeek = (d: string) => en(d) >= weekStart && en(d) <= todayEn;
    const lateDays = new Set<string>();
    morningAttendance
      .filter((r) => r.studentId === student.id && r.status === 'present' && r.delayMinutes > 0 && inWeek(r.date))
      .forEach((r) => lateDays.add(en(r.date)));
    morningDelays.filter((d) => d.studentId === student.id && inWeek(d.date)).forEach((d) => lateDays.add(en(d.date)));
    if (lateDays.size > WEEKLY_DELAY_LIMIT) {
      items.push({ type: 'weekly_delays', label: `⏱️ ${toPersianDigits(lateDays.size)} تأخیر در هفته جاری` });
    }

    // ج) افت ناگهانی: میانگین بازه فعال جاری نسبت به نزدیک‌ترین بازه قبلی دارای نمره
    if (current) {
      const grades = gradesByStudent.get(student.id) || [];
      const avgOf = (key: string) => {
        const vals = grades.map((g) => g[key as keyof StudentAcademicGrade]).filter((v): v is number => typeof v === 'number');
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
      };
      const currentAvg = avgOf(current);
      if (currentAvg !== undefined) {
        const idx = order.indexOf(current);
        for (let i = idx - 1; i >= 0; i--) {
          const prevAvg = avgOf(order[i]);
          if (prevAvg !== undefined) {
            const drop = prevAvg - currentAvg;
            if (drop > GRADE_DROP_LIMIT) {
              items.push({ type: 'grade_drop', label: `📉 افت معدل ${toPersianDigits((Math.round(drop * 100) / 100).toString().replace('.', '٫'))} نمره` });
            }
            break;
          }
        }
      }
    }

    if (items.length > 0) {
      result.push({ student, className: classById.get(student.classId)?.name || '—', items });
    }
  });

  return result.sort((a, b) => b.items.length - a.items.length || a.student.lastName.localeCompare(b.student.lastName, 'fa'));
}

export const WARNING_BADGE_CLASS: Record<WarningType, string> = {
  consecutive_absence: 'bg-rose-50 text-rose-800 border border-rose-200',
  weekly_delays: 'bg-amber-50 text-amber-800 border border-amber-200',
  grade_drop: 'bg-violet-50 text-violet-800 border border-violet-200',
};
