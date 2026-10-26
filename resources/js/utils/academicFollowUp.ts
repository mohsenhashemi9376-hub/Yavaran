import {
  AttendanceSession,
  ComprehensiveExamRecord,
  MONTHLY_EVALUATION_PERIODS,
  Student,
  StudentAcademicGrade,
  WorksheetRecord,
  WorksheetWeek,
} from '../types';
import { isDeadlinePassed, worksheetKey } from './worksheets';
import { monthKeyOf } from './attendanceStats';
import { PERSIAN_MONTHS, toPersianDigits } from './persianDate';
import { CONTINUOUS_MONTHS, ExamMonth, activeExamSubjects, examMonthLabel, examMonthsWithData, examScoresOf, examSubjectScore } from './examReport';

export const FOLLOW_UP_THRESHOLD = 12;

/** مستمرهای ماهانه‌ی دفتر نمرات (بدون پایانی ترم‌ها) */
const CONTINUOUS_KEYS = CONTINUOUS_MONTHS;

/** آستانه‌ی قانون‌های پیگیری آموزشی (همه در یک جا) */
export const FOLLOW_UP_RULES = {
  /** تکلیف انجام‌نشده در یک درس در یک ماه */
  homeworkNotDonePerMonth: 3,
  /** تکلیف ناقص در یک درس در یک ماه */
  homeworkIncompletePerMonth: 4,
  /** تکلیف انجام‌نشده در چند جلسه‌ی پشت‌سرهم یک درس */
  homeworkNotDoneStreak: 3,
  /** غیبت در یک درس در یک ماه */
  subjectAbsencesPerMonth: 3,
  /** تأخیر ورود به کلاس (همه‌ی دروس) در یک ماه */
  classLatesPerMonth: 3,
  /** اخطار کلاسیِ «عدم انجام تکلیف» یا «بی‌انضباطی» در یک ماه */
  classWarningsPerMonth: 2,
  /** افت نمره‌ی مستمر نسبت به ماه قبل */
  dropFromPreviousMonth: 2,
  /** اختلاف میانگین مستمر و آزمون جامع */
  continuousVsExamGap: 5,
};

/** تنظیمات قابل تغییر معیارهای «نیازمند پیگیری» (پیشرفته)؛ پیش‌فرض همان معیارهای توافق‌شده است */
export interface FollowUpConfig {
  /** هر قانون روشن / خاموش */
  enabled: Record<FollowUpKind, boolean>;
  /** نمره‌ی مستمر یا آزمون جامع کمتر از این مقدار «ضعیف» است */
  lowScore: number;
  homeworkNotDonePerMonth: number;
  homeworkIncompletePerMonth: number;
  homeworkNotDoneStreak: number;
  subjectAbsencesPerMonth: number;
  classLatesPerMonth: number;
  classWarningsPerMonth: number;
  dropFromPreviousMonth: number;
  continuousVsExamGap: number;
  /** تعداد هفته‌ی متوالی عدم تحویل کاربرگ */
  worksheetStreakWeeks: number;
}

export type FollowUpGroup = 'grades' | 'homework' | 'worksheet' | 'attendance';
export const FOLLOW_UP_GROUP_LABEL: Record<FollowUpGroup, string> = {
  grades: 'نمره',
  homework: 'تکلیف',
  worksheet: 'کاربرگ',
  attendance: 'حضور و رفتار کلاسی',
};

export type FollowUpKind =
  | 'low_continuous' | 'low_continuous_avg' | 'worksheet_streak' | 'low_exam' | 'low_exam_avg'
  | 'score_decline' | 'exam_gap'
  | 'homework_not_done' | 'homework_incomplete' | 'homework_streak'
  | 'subject_absences' | 'class_lates' | 'class_warnings';

const GROUP_OF: Record<FollowUpKind, FollowUpGroup> = {
  low_continuous: 'grades', low_continuous_avg: 'grades', low_exam: 'grades', low_exam_avg: 'grades', score_decline: 'grades', exam_gap: 'grades',
  worksheet_streak: 'worksheet',
  homework_not_done: 'homework', homework_incomplete: 'homework', homework_streak: 'homework',
  subject_absences: 'attendance', class_lates: 'attendance', class_warnings: 'attendance',
};

const ALL_KINDS: FollowUpKind[] = [
  'low_continuous', 'low_continuous_avg', 'score_decline', 'low_exam', 'low_exam_avg', 'exam_gap',
  'homework_not_done', 'homework_incomplete', 'homework_streak', 'worksheet_streak',
  'subject_absences', 'class_lates', 'class_warnings',
];

export const DEFAULT_FOLLOW_UP_CONFIG: FollowUpConfig = {
  enabled: Object.fromEntries(ALL_KINDS.map((k) => [k, true])) as Record<FollowUpKind, boolean>,
  lowScore: 12,
  ...FOLLOW_UP_RULES,
  worksheetStreakWeeks: 2,
};

/** ادغام تنظیمات ذخیره‌شده با پیش‌فرض (کلیدهای جاافتاده پیش‌فرض می‌گیرند) */
export function mergeFollowUpConfig(stored?: Partial<FollowUpConfig> | null): FollowUpConfig {
  return {
    ...DEFAULT_FOLLOW_UP_CONFIG,
    ...(stored || {}),
    enabled: { ...DEFAULT_FOLLOW_UP_CONFIG.enabled, ...(stored?.enabled || {}) },
  };
}

export const isDefaultFollowUpConfig = (c: FollowUpConfig): boolean => JSON.stringify(c) === JSON.stringify(DEFAULT_FOLLOW_UP_CONFIG);

export interface FollowUpReason {
  kind: FollowUpKind;
  group: FollowUpGroup;
  label: string;
  /** جزئیات برای نمایش (نام دروس، میانگین …) */
  detail: string;
}

const num = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** هفته‌هایی که مهلتشان گذشته و برای آن کلاس دست‌کم یک رکورد ثبت شده است، به ترتیب زمان */
function worksheetWeeksOf(classId: string, weeks: WorksheetWeek[], byKey: Map<string, WorksheetRecord>, classStudentIds: string[]): string[] {
  return weeks
    .filter((w) => isDeadlinePassed(w.deadline))
    .map((w) => w.weekStart)
    .sort()
    .filter((ws) => classStudentIds.some((id) => {
      const r = byKey.get(worksheetKey(id, ws));
      return r && r.status !== 'none';
    }));
}

/** ماه‌های سال تحصیلی به ترتیب (شماره‌ی ماه شمسی) برای فیلتر ماه */
export const FOLLOW_UP_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3];

/** ستون نمره‌ی مستمرِ هر ماه (دی و خرداد ستون مستمر ندارند) */
const MONTH_COLUMN: Record<number, string> = {
  7: 'mehrContinuous', 8: 'abanContinuous', 9: 'azarContinuous', 11: 'bahmanContinuous',
  12: 'esfandContinuous', 1: 'farvardinContinuous', 2: 'ordibeheshtContinuous',
};

export interface FollowUpInput {
  students: Student[];
  grades: StudentAcademicGrade[];
  exams: ComprehensiveExamRecord[];
  worksheets: WorksheetRecord[];
  worksheetWeeks: WorksheetWeek[];
  sessions: AttendanceSession[];
  config?: FollowUpConfig;
  /** شماره‌ی ماه شمسی (۱ تا ۱۲) برای محدود کردن همه‌ی معیارها به همان ماه؛ بدون مقدار = همه‌ی ماه‌ها */
  month?: number | null;
}

/** دلایل نیاز به پیگیری هر دانش‌آموز (فقط دانش‌آموزانی که دست‌کم یک دلیل دارند) */
export function computeFollowUps({ students, grades, exams, worksheets, worksheetWeeks, sessions: allSessions, config = DEFAULT_FOLLOW_UP_CONFIG, month = null }: FollowUpInput): Map<string, FollowUpReason[]> {
  const result = new Map<string, FollowUpReason[]>();
  const add = (id: string, r: Omit<FollowUpReason, 'group'>) => {
    if (!config.enabled[r.kind]) return;
    result.set(id, [...(result.get(id) || []), { ...r, group: GROUP_OF[r.kind] }]);
  };
  const T = config.lowScore;

  // محدودیت به یک ماه: جلسات، هفته‌های کاربرگ و ستون‌های نمره‌ی همان ماه
  const monthOnly = month !== null && month !== undefined;
  const inMonth = (date: string) => Number(monthKeyOf(date).split('/')[1]) === month;
  const sessions = monthOnly ? allSessions.filter((s) => inMonth(s.date)) : allSessions;
  if (monthOnly) worksheetWeeks = worksheetWeeks.filter((w) => inMonth(w.weekStart));
  const selKey = monthOnly ? MONTH_COLUMN[month as number] : undefined;
  const lowKeys = monthOnly ? CONTINUOUS_KEYS.filter((p) => p.key === selKey) : CONTINUOUS_KEYS;
  const upToKeys = monthOnly ? CONTINUOUS_KEYS.slice(0, CONTINUOUS_KEYS.findIndex((p) => p.key === selKey) + 1) : CONTINUOUS_KEYS;
  const examMonth = (monthOnly ? selKey : 'all') as ExamMonth | undefined;
  const tl = toPersianDigits(T);

  const byKey = new Map(worksheets.map((r) => [worksheetKey(r.studentId, r.weekStart), r]));
  const examByClass = new Map(exams.map((e) => [e.classId, e]));
  const idsByClass = new Map<string, string[]>();
  students.forEach((s) => idsByClass.set(s.classId, [...(idsByClass.get(s.classId) || []), s.id]));
  const weeksByClass = new Map<string, string[]>();

  for (const st of students) {
    // ۱ و ۲: مستمر
    const lowSubjects: string[] = [];
    const all: number[] = [];
    grades.filter((g) => g.studentId === st.id).forEach((g) => {
      const vals = lowKeys.map((p) => g[p.key]).filter(num);
      all.push(...vals);
      if (vals.some((v) => v < T)) lowSubjects.push(g.subjectName);
    });
    if (lowSubjects.length) add(st.id, { kind: 'low_continuous', label: `مستمر زیر ${tl}`, detail: lowSubjects.join('، ') });
    const avg = mean(all);
    if (avg !== undefined && avg < T) add(st.id, { kind: 'low_continuous_avg', label: `میانگین مستمر زیر ${tl}`, detail: String(round2(avg)) });

    // ۳: دو هفته‌ی متوالی کاربرگ تحویل‌نشده (غایب، رشته را قطع می‌کند)
    if (!weeksByClass.has(st.classId)) weeksByClass.set(st.classId, worksheetWeeksOf(st.classId, worksheetWeeks, byKey, idsByClass.get(st.classId) || []));
    let streak = 0;
    let worst = 0;
    for (const ws of weeksByClass.get(st.classId) || []) {
      const r = byKey.get(worksheetKey(st.id, ws));
      streak = !r || r.status === 'none' ? streak + 1 : 0;
      worst = Math.max(worst, streak);
    }
    if (worst >= config.worksheetStreakWeeks) add(st.id, { kind: 'worksheet_streak', label: 'کاربرگ تحویل‌نداده', detail: `${worst} هفته متوالی` });

    // ۴ و ۵: آزمون جامع (هر ماه جدا؛ میانگین روی همه‌ی ماه‌های ثبت‌شده)
    const exam = examByClass.get(st.classId);
    if (exam) {
      const low: string[] = [];
      examMonthsWithData(exam).filter((m) => !monthOnly || m === selKey).forEach((em) => {
        const scores = examScoresOf(exam, em)[st.id];
        if (!scores) return;
        activeExamSubjects(exam, em).forEach((sub) => {
          const v = scores[sub.key];
          if (num(v) && v < T) low.push(em === 'legacy' ? sub.label : `${sub.label} (${examMonthLabel(em)})`);
        });
      });
      if (low.length) add(st.id, { kind: 'low_exam', label: `آزمون جامع زیر ${tl}`, detail: low.join('، ') });
      const examAvg = examMonth ? mean(activeExamSubjects(exam, examMonth).map((sub) => examSubjectScore(exam, st.id, sub.key, examMonth)).filter(num)) : undefined;
      if (examAvg !== undefined && examAvg < T) add(st.id, { kind: 'low_exam_avg', label: `میانگین آزمون جامع زیر ${tl}`, detail: String(round2(examAvg)) });
    }
  }

  // ---- قانون‌های مبتنی بر نمره: افت روند و اختلاف مستمر با آزمون جامع ----
  const studentIds = new Set(students.map((s) => s.id));
  const fa = (n: number) => String(round2(n));
  for (const st of students) {
    const own = grades.filter((g) => g.studentId === st.id);
    const declines: string[] = [];
    own.forEach((g) => {
      if (monthOnly && !num(g[selKey as keyof typeof g])) return; // افت فقط وقتی نمره‌ی همین ماه ثبت شده باشد
      const vals = upToKeys.map((p) => g[p.key]).filter(num);
      const n = vals.length;
      const last3 = vals.slice(-3);
      const steady = n >= 3 && last3[0] > last3[1] && last3[1] > last3[2];
      const bigDrop = n >= 2 && vals[n - 2] - vals[n - 1] > config.dropFromPreviousMonth;
      if (steady || bigDrop) declines.push(`${g.subjectName}: ${(steady ? last3 : vals.slice(-2)).map(fa).join(' ← ')}`);
    });
    if (declines.length) add(st.id, { kind: 'score_decline', label: 'افت نمره', detail: declines.join('، ') });

    const exam = examByClass.get(st.classId);
    if (exam) {
      const all = own.flatMap((g) => lowKeys.map((p) => g[p.key]).filter(num));
      const contAvg = mean(all);
      const examAvg = examMonth ? mean(activeExamSubjects(exam, examMonth).map((sub) => examSubjectScore(exam, st.id, sub.key, examMonth)).filter(num)) : undefined;
      if (contAvg !== undefined && examAvg !== undefined && Math.abs(contAvg - examAvg) >= config.continuousVsExamGap) {
        add(st.id, { kind: 'exam_gap', label: 'اختلاف مستمر و آزمون جامع', detail: `مستمر ${fa(contAvg)} / جامع ${fa(examAvg)}` });
      }
    }
  }

  // ---- قانون‌های مبتنی بر جلسات کلاسی: تکلیف، غیبت درس، تأخیر و اخطار ----
  type Counter = { notDone: number; incomplete: number; absent: number };
  const perSubjectMonth = new Map<string, Counter>(); // studentId|subject|month
  const lates = new Map<string, number>(); // studentId|month
  const warnings = new Map<string, number>(); // studentId|month
  const counter = (key: string): Counter => {
    let c = perSubjectMonth.get(key);
    if (!c) perSubjectMonth.set(key, (c = { notDone: 0, incomplete: 0, absent: 0 }));
    return c;
  };
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1);
  const monthLabel = (mk: string) => PERSIAN_MONTHS[Number(mk.split('/')[1]) - 1] ?? mk;

  const ordered = sessions.slice().sort((a, b) => `${monthKeyOf(a.date)}${a.date}${a.periodNumber ?? 1}`.localeCompare(`${monthKeyOf(b.date)}${b.date}${b.periodNumber ?? 1}`));
  const streaks = new Map<string, { run: number; best: number }>(); // studentId|class|subject
  for (const sess of ordered) {
    const mk = monthKeyOf(sess.date);
    for (const [sid, rec] of Object.entries(sess.records || {})) {
      if (!studentIds.has(sid)) continue;
      const base = `${sid}|${sess.subject}|${mk}`;
      if (rec.status === 'absent') counter(base).absent++;
      if (rec.status === 'late') bump(lates, `${sid}|${mk}`);
      if (rec.disciplinaryWarning?.hasWarning && ['عدم انجام تکلیف', 'بی‌انضباطی کلاسی'].includes(rec.disciplinaryWarning.kind || rec.disciplinaryWarning.title || '')) bump(warnings, `${sid}|${mk}`);
      if (rec.homeworkStatus === 'not_done') counter(base).notDone++;
      if (rec.homeworkStatus === 'incomplete') counter(base).incomplete++;
      if (rec.homeworkStatus) {
        const sk = `${sid}|${sess.classId}|${sess.subject}`;
        const st = streaks.get(sk) || { run: 0, best: 0 };
        st.run = rec.homeworkStatus === 'not_done' ? st.run + 1 : 0;
        st.best = Math.max(st.best, st.run);
        streaks.set(sk, st);
      }
    }
  }

  const listed = (rows: string[]) => rows.join('، ');
  const notDone = new Map<string, string[]>();
  const incomplete = new Map<string, string[]>();
  const absences = new Map<string, string[]>();
  perSubjectMonth.forEach((c, key) => {
    const [sid, subject, mk] = key.split('|');
    const put = (m: Map<string, string[]>, n: number) => m.set(sid, [...(m.get(sid) || []), `${subject} (${n} بار در ${monthLabel(mk)})`]);
    if (c.notDone >= config.homeworkNotDonePerMonth) put(notDone, c.notDone);
    if (c.incomplete >= config.homeworkIncompletePerMonth) put(incomplete, c.incomplete);
    if (c.absent >= config.subjectAbsencesPerMonth) put(absences, c.absent);
  });
  notDone.forEach((rows, sid) => add(sid, { kind: 'homework_not_done', label: 'تکلیف انجام‌نشده', detail: listed(rows) }));
  incomplete.forEach((rows, sid) => add(sid, { kind: 'homework_incomplete', label: 'تکلیف ناقص', detail: listed(rows) }));
  absences.forEach((rows, sid) => add(sid, { kind: 'subject_absences', label: 'غیبت در یک درس', detail: listed(rows) }));
  const streakRows = new Map<string, string[]>();
  streaks.forEach((v, key) => {
    if (v.best >= config.homeworkNotDoneStreak) {
      const [sid, , subject] = key.split('|');
      streakRows.set(sid, [...(streakRows.get(sid) || []), `${subject} (${v.best} جلسه پشت‌سرهم)`]);
    }
  });
  streakRows.forEach((rows, sid) => add(sid, { kind: 'homework_streak', label: 'تکلیف چندجلسه‌ای انجام‌نشده', detail: listed(rows) }));
  const lateRows = new Map<string, string[]>();
  lates.forEach((n, key) => {
    if (n >= config.classLatesPerMonth) {
      const [sid, mk] = key.split('|');
      lateRows.set(sid, [...(lateRows.get(sid) || []), `${n} بار در ${monthLabel(mk)}`]);
    }
  });
  lateRows.forEach((rows, sid) => add(sid, { kind: 'class_lates', label: 'تأخیر ورود به کلاس', detail: listed(rows) }));
  const warnRows = new Map<string, string[]>();
  warnings.forEach((n, key) => {
    if (n >= config.classWarningsPerMonth) {
      const [sid, mk] = key.split('|');
      warnRows.set(sid, [...(warnRows.get(sid) || []), `${n} بار در ${monthLabel(mk)}`]);
    }
  });
  warnRows.forEach((rows, sid) => add(sid, { kind: 'class_warnings', label: 'اخطار کلاسی', detail: listed(rows) }));

  return result;
}
