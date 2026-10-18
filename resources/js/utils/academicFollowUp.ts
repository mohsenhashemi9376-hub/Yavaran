import {
  ComprehensiveExamRecord,
  MONTHLY_EVALUATION_PERIODS,
  Student,
  StudentAcademicGrade,
  WorksheetRecord,
  WorksheetWeek,
} from '../types';
import { isDeadlinePassed, worksheetKey } from './worksheets';
import { activeExamSubjects, examMonthLabel, examMonthsWithData, examScoresOf, examSubjectScore } from './examReport';

export const FOLLOW_UP_THRESHOLD = 12;

/** مستمرهای ماهانه‌ی دفتر نمرات (بدون پایانی ترم‌ها) */
const CONTINUOUS_KEYS = MONTHLY_EVALUATION_PERIODS.filter((p) => !['term1Final', 'term2Continuous'].includes(p.key));

export type FollowUpKind = 'low_continuous' | 'low_continuous_avg' | 'worksheet_streak' | 'low_exam' | 'low_exam_avg';

export interface FollowUpReason {
  kind: FollowUpKind;
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

export interface FollowUpInput {
  students: Student[];
  grades: StudentAcademicGrade[];
  exams: ComprehensiveExamRecord[];
  worksheets: WorksheetRecord[];
  worksheetWeeks: WorksheetWeek[];
}

/** دلایل نیاز به پیگیری هر دانش‌آموز (فقط دانش‌آموزانی که دست‌کم یک دلیل دارند) */
export function computeFollowUps({ students, grades, exams, worksheets, worksheetWeeks }: FollowUpInput): Map<string, FollowUpReason[]> {
  const result = new Map<string, FollowUpReason[]>();
  const add = (id: string, r: FollowUpReason) => result.set(id, [...(result.get(id) || []), r]);

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
      const vals = CONTINUOUS_KEYS.map((p) => g[p.key]).filter(num);
      all.push(...vals);
      if (vals.some((v) => v < FOLLOW_UP_THRESHOLD)) lowSubjects.push(g.subjectName);
    });
    if (lowSubjects.length) add(st.id, { kind: 'low_continuous', label: 'مستمر زیر ۱۲', detail: lowSubjects.join('، ') });
    const avg = mean(all);
    if (avg !== undefined && avg < FOLLOW_UP_THRESHOLD) add(st.id, { kind: 'low_continuous_avg', label: 'میانگین مستمر زیر ۱۲', detail: String(round2(avg)) });

    // ۳: دو هفته‌ی متوالی کاربرگ تحویل‌نشده (غایب، رشته را قطع می‌کند)
    if (!weeksByClass.has(st.classId)) weeksByClass.set(st.classId, worksheetWeeksOf(st.classId, worksheetWeeks, byKey, idsByClass.get(st.classId) || []));
    let streak = 0;
    let worst = 0;
    for (const ws of weeksByClass.get(st.classId) || []) {
      const r = byKey.get(worksheetKey(st.id, ws));
      streak = !r || r.status === 'none' ? streak + 1 : 0;
      worst = Math.max(worst, streak);
    }
    if (worst >= 2) add(st.id, { kind: 'worksheet_streak', label: 'کاربرگ تحویل‌نداده', detail: `${worst} هفته متوالی` });

    // ۴ و ۵: آزمون جامع (هر ماه جدا؛ میانگین روی همه‌ی ماه‌های ثبت‌شده)
    const exam = examByClass.get(st.classId);
    if (exam) {
      const low: string[] = [];
      examMonthsWithData(exam).forEach((month) => {
        const scores = examScoresOf(exam, month)[st.id];
        if (!scores) return;
        activeExamSubjects(exam, month).forEach((sub) => {
          const v = scores[sub.key];
          if (num(v) && v < FOLLOW_UP_THRESHOLD) low.push(month === 'legacy' ? sub.label : `${sub.label} (${examMonthLabel(month)})`);
        });
      });
      if (low.length) add(st.id, { kind: 'low_exam', label: 'آزمون جامع زیر ۱۲', detail: low.join('، ') });
      const examAvg = mean(activeExamSubjects(exam, 'all').map((sub) => examSubjectScore(exam, st.id, sub.key, 'all')).filter(num));
      if (examAvg !== undefined && examAvg < FOLLOW_UP_THRESHOLD) add(st.id, { kind: 'low_exam_avg', label: 'میانگین آزمون جامع زیر ۱۲', detail: String(round2(examAvg)) });
    }
  }
  return result;
}
