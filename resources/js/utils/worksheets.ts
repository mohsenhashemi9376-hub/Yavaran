import { SchoolClass, Student, WorksheetRecord, WorksheetStatus, WorksheetWeek } from '../types';
import { dateToShamsiString, getShamsiWeekRange, getTodayShamsi, shamsiStringToDate } from './persianDate';

export const WORKSHEET_STATUS_LABEL: Record<WorksheetStatus | 'missing', string> = {
  complete: 'کامل',
  partial: 'ناقص',
  absent: 'غایب',
  missing: 'تحویل نداده',
};

/** شنبه‌ی هفته‌ی شامل یک تاریخ شمسی (پیش‌فرض: امروز) */
export const weekStartOf = (shamsiDate?: string): string =>
  getShamsiWeekRange(shamsiDate || getTodayShamsi().formattedDate).startDate;

export const shiftWeek = (weekStart: string, delta: number): string => {
  const d = shamsiStringToDate(weekStart);
  d.setDate(d.getDate() + delta * 7);
  return weekStartOf(dateToShamsiString(d));
};

export const weekTitle = (weekStart: string): string => getShamsiWeekRange(weekStart).title;

export const weekKey = (weekStart: string): string => weekStart.replace(/\//g, '-');

export const worksheetKey = (studentId: string, weekStart: string): string => `ws-${studentId}-${weekKey(weekStart)}`;

/** مهلت پایان‌یافته؟ (پس از پایان روز مهلت) */
export const isDeadlinePassed = (deadline?: string | null): boolean =>
  !!deadline && getTodayShamsi().formattedDate > deadline;

export interface WeekClassSummary {
  total: number;
  complete: number;
  partial: number;
  absent: number;
  missing: number;
  /** هنوز هیچ رکوردی برای کلاس در این هفته ثبت نشده */
  untouched: boolean;
}

export const summarizeClassWeek = (
  students: Pick<Student, 'id'>[],
  records: Map<string, WorksheetRecord>,
  weekStart: string,
): WeekClassSummary => {
  const s: WeekClassSummary = { total: students.length, complete: 0, partial: 0, absent: 0, missing: 0, untouched: true };
  for (const st of students) {
    const r = records.get(worksheetKey(st.id, weekStart));
    if (!r) s.missing++;
    else {
      s[r.status]++;
      s.untouched = false;
    }
  }
  return s;
};

export interface WorksheetAlertClass {
  classId: string;
  className: string;
  /** پس از مهلت هیچ کاربرگی برای این کلاس ثبت نشده */
  untouched: boolean;
  missing: Student[];
  partial: Student[];
}

export interface WorksheetAlertWeek {
  weekStart: string;
  deadline: string;
  classes: WorksheetAlertClass[];
}

export interface WorksheetAlerts {
  weeks: WorksheetAlertWeek[];
  /** تعداد دانش‌آموزان تحویل‌نداده/ناقص در آخرین هفته‌ی دارای مهلت گذشته */
  latestIssueCount: number;
  /** تعداد کلاس‌های ثبت‌نشده در آخرین هفته */
  latestUntouchedClasses: number;
  /** دانش‌آموزان با ۲ هفته‌ی پیاپی (یا بیشتر) تحویل‌نداده/ناقص: studentId ← تعداد هفته */
  streaks: Map<string, number>;
}

/**
 * هشدار فقط برای هفته‌هایی است که معاونت آموزش مهلت تعیین کرده و مهلتشان گذشته است
 * (هفته‌ی تعطیل یا بدون کاربرگ، مهلت ندارد و هشدار هم ندارد).
 * دانش‌آموز «غایب» به حساب نمی‌آید و هفته‌ی ثبت‌نشده‌ی یک کلاس در پیاپی بودن نادیده گرفته می‌شود.
 */
export const computeWorksheetAlerts = (
  students: Student[],
  classes: SchoolClass[],
  worksheets: WorksheetRecord[],
  weeks: WorksheetWeek[],
  maxWeeks = 8,
): WorksheetAlerts => {
  const records = new Map(worksheets.map((r) => [r.id, r]));
  const due = weeks
    .filter((w) => !!w.deadline && isDeadlinePassed(w.deadline))
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
    .slice(0, maxWeeks);

  const byClass = new Map<string, Student[]>();
  students.forEach((s) => byClass.set(s.classId, [...(byClass.get(s.classId) || []), s]));

  const result: WorksheetAlertWeek[] = [];
  const streakChain = new Map<string, { count: number; broken: boolean }>();

  for (const w of due) {
    const alertClasses: WorksheetAlertClass[] = [];
    for (const c of classes) {
      const list = byClass.get(c.id) || [];
      if (list.length === 0) continue;
      const sum = summarizeClassWeek(list, records, w.weekStart);
      if (sum.untouched) {
        alertClasses.push({ classId: c.id, className: c.name, untouched: true, missing: [], partial: [] });
        continue; // هفته‌ی ثبت‌نشده: وضعیت دانش‌آموزان مشخص نیست
      }
      const missing: Student[] = [];
      const partial: Student[] = [];
      for (const st of list) {
        const r = records.get(worksheetKey(st.id, w.weekStart));
        const chain = streakChain.get(st.id) || { count: 0, broken: false };
        if (!r || r.status === 'partial') {
          (r ? partial : missing).push(st);
          if (!chain.broken) chain.count++;
        } else if (r.status === 'complete') {
          chain.broken = true;
        } // غایب: بی‌اثر
        streakChain.set(st.id, chain);
      }
      if (missing.length || partial.length) {
        alertClasses.push({ classId: c.id, className: c.name, untouched: false, missing, partial });
      }
    }
    if (alertClasses.length) result.push({ weekStart: w.weekStart, deadline: w.deadline as string, classes: alertClasses });
  }

  const streaks = new Map<string, number>();
  streakChain.forEach((v, k) => v.count >= 2 && streaks.set(k, v.count));

  const latest = due[0] ? result.find((w) => w.weekStart === due[0].weekStart) : undefined;
  return {
    weeks: result,
    latestIssueCount: latest ? latest.classes.reduce((n, c) => n + c.missing.length + c.partial.length, 0) : 0,
    latestUntouchedClasses: latest ? latest.classes.filter((c) => c.untouched).length : 0,
    streaks,
  };
};

/** سابقه‌ی کاربرگ دانش‌آموز: هفته‌های دارای مهلت گذشته + هفته‌هایی که رکورد دارند (جدیدترین اول) */
export const studentWorksheetHistory = (
  studentId: string,
  worksheets: WorksheetRecord[],
  weeks: WorksheetWeek[],
): { weekStart: string; status: WorksheetStatus | 'missing' }[] => {
  const records = new Map(worksheets.map((r) => [r.id, r]));
  const starts = new Set<string>();
  weeks.forEach((w) => w.deadline && isDeadlinePassed(w.deadline) && starts.add(w.weekStart));
  worksheets.forEach((r) => r.studentId === studentId && starts.add(r.weekStart));
  return Array.from(starts)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((weekStart) => ({ weekStart, status: records.get(worksheetKey(studentId, weekStart))?.status ?? ('missing' as const) }));
};
