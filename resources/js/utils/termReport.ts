import { AcademicSubject, MonthlyContinuousKey, SchoolClass, Student, StudentAcademicGrade } from '../types';
import { subjectAppliesToClass } from './courseAssignments';
import { bandCounts, mean, round2, stdDev, EXAM_WEAK_BELOW } from './examReport';
import { compareByLastName } from './morningAttendance';

export type TermKey = 1 | 2 | 'year';

/** نیمسال اول: مستمر مهر، آبان، آذر + پایانی اول • نیمسال دوم: مستمر بهمن، اسفند، فروردین، اردیبهشت + پایانی دوم */
export const TERMS: Record<1 | 2, { title: string; months: MonthlyContinuousKey[]; final: MonthlyContinuousKey }> = {
  1: { title: 'نیمسال اول', months: ['mehrContinuous', 'abanContinuous', 'azarContinuous'], final: 'term1Final' },
  2: { title: 'نیمسال دوم', months: ['bahmanContinuous', 'esfandContinuous', 'farvardinContinuous', 'ordibeheshtContinuous'], final: 'term2Final' },
};
export const termTitle = (t: TermKey) => (t === 'year' ? 'کل سال' : TERMS[t].title);

const num = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);

export interface SubjectTermScore {
  /** میانگین مستمرهای ماه‌های نیمسال */
  cont?: number;
  /** نمره‌ی پایانی نیمسال */
  final?: number;
  /** نمره‌ی نیمسال: ترکیب مستمر و پایانی با وزن پایانی (پیش‌فرض ۵۰٪)؛ اگر یکی نباشد همان یکی */
  score?: number;
}

/** @param finalWeight سهم نمره‌ی پایانی از نمره‌ی نیمسال (۰ تا ۱) */
export function subjectTermScore(g: StudentAcademicGrade | undefined, term: TermKey, finalWeight: number): SubjectTermScore {
  if (!g) return {};
  if (term === 'year') {
    const a = subjectTermScore(g, 1, finalWeight);
    const b = subjectTermScore(g, 2, finalWeight);
    return {
      cont: mean([a.cont, b.cont].filter(num)),
      final: mean([a.final, b.final].filter(num)),
      score: mean([a.score, b.score].filter(num)),
    };
  }
  const t = TERMS[term];
  const cont = mean(t.months.map((m) => g[m]).filter(num));
  const fin = num(g[t.final]) ? (g[t.final] as number) : undefined;
  const score = cont !== undefined && fin !== undefined ? cont * (1 - finalWeight) + fin * finalWeight : cont ?? fin;
  return { cont, final: fin, score };
}

export interface TermStudentRow {
  student: Student;
  bySubject: Record<string, SubjectTermScore>;
  avg?: number;
  rank?: number;
  /** فقط در «کل سال»: میانگین هر نیمسال و تغییر نیمسال دوم نسبت به اول */
  avgTerm1?: number;
  avgTerm2?: number;
  delta?: number;
}

export interface TermSubjectStat {
  subject: AcademicSubject;
  contAvg?: number;
  finalAvg?: number;
  scoreAvg?: number;
  sd?: number;
  bands: ReturnType<typeof bandCounts>;
  weakCount: number;
  graded: number;
}

export interface TermAnalysis {
  subjects: AcademicSubject[];
  rows: TermStudentRow[];
  stats: TermSubjectStat[];
  classAvg?: number;
  top: TermStudentRow[];
  weak: TermStudentRow[];
  improved: TermStudentRow[];
  declined: TermStudentRow[];
  hasData: boolean;
}

export function analyzeTerm(opts: {
  cls: SchoolClass;
  students: Student[];
  subjects: AcademicSubject[];
  grades: StudentAcademicGrade[];
  term: TermKey;
  finalWeight: number;
}): TermAnalysis {
  const { cls, term, finalWeight } = opts;
  const subjects = opts.subjects.filter((s) => subjectAppliesToClass(s, cls));
  const byKey = new Map(opts.grades.map((g) => [`${g.studentId}|${g.subjectId}`, g]));
  const classStudents = opts.students.filter((s) => s.classId === cls.id).sort(compareByLastName);

  const rows: TermStudentRow[] = classStudents.map((student) => {
    const bySubject: Record<string, SubjectTermScore> = {};
    subjects.forEach((sub) => { bySubject[sub.id] = subjectTermScore(byKey.get(`${student.id}|${sub.id}`), term, finalWeight); });
    const avg = mean(Object.values(bySubject).map((s) => s.score).filter(num));
    const row: TermStudentRow = { student, bySubject, avg };
    if (term === 'year') {
      const t1 = mean(subjects.map((sub) => subjectTermScore(byKey.get(`${student.id}|${sub.id}`), 1, finalWeight).score).filter(num));
      const t2 = mean(subjects.map((sub) => subjectTermScore(byKey.get(`${student.id}|${sub.id}`), 2, finalWeight).score).filter(num));
      row.avgTerm1 = t1;
      row.avgTerm2 = t2;
      row.delta = t1 !== undefined && t2 !== undefined ? round2(t2 - t1) : undefined;
    }
    return row;
  });

  const ranked = rows.filter((r) => r.avg !== undefined).sort((a, b) => (b.avg as number) - (a.avg as number));
  ranked.forEach((r, i) => { r.rank = i > 0 && ranked[i - 1].avg === r.avg ? ranked[i - 1].rank : i + 1; });

  const stats: TermSubjectStat[] = subjects.map((subject) => {
    const parts = rows.map((r) => r.bySubject[subject.id]);
    const scores = parts.map((p) => p.score).filter(num);
    return {
      subject,
      contAvg: mean(parts.map((p) => p.cont).filter(num)),
      finalAvg: mean(parts.map((p) => p.final).filter(num)),
      scoreAvg: mean(scores),
      sd: stdDev(scores),
      bands: bandCounts(scores),
      weakCount: scores.filter((v) => v < EXAM_WEAK_BELOW).length,
      graded: scores.length,
    };
  });

  return {
    subjects,
    rows,
    stats,
    classAvg: mean(ranked.map((r) => r.avg as number)),
    top: ranked.length ? ranked.filter((r) => r.avg === ranked[0].avg) : [],
    weak: ranked.filter((r) => (r.avg as number) < EXAM_WEAK_BELOW).reverse(),
    improved: rows.filter((r) => (r.delta ?? 0) >= 1).sort((a, b) => (b.delta as number) - (a.delta as number)),
    declined: rows.filter((r) => (r.delta ?? 0) <= -1).sort((a, b) => (a.delta as number) - (b.delta as number)),
    hasData: ranked.length > 0,
  };
}
