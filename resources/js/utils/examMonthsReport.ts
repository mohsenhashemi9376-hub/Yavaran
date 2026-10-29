import { ComprehensiveExamRecord, Student } from '../types';
import { analyzeClassExam, examMaxOf, examMonthLabel, examScoresOf, examLevelOf, isExamAbsent, ExamMonth, EXAM_ACCEPTABLE_FROM, EXAM_NEEDS_EFFORT_BELOW } from './examReport';
import { toPersianDigits } from './persianDate';
import { studentFullName } from './studentName';

export type ScoreTone = 'good' | 'ok' | 'mid' | 'bad' | 'none';

/** گزارش آماده‌ی چاپ یک ماه آزمون جامع (نمرات + تحلیل) از روی داده‌ی ذخیره‌شده */
export interface ExamMonthSection {
  month: Exclude<ExamMonth, 'all'>;
  title: string;
  landscape: boolean;
  head: string[];
  rows: { cells: string[]; tone: ScoreTone }[];
  /** خطوط تحلیل: معدل، درس قوت/ضعف، توزیع سطوح، میانگین دروس */
  analysis: string[];
  stats: { classAvg: string; strongest: string; weakest: string };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const fa = (n?: number | null) => (n === null || n === undefined ? '—' : toPersianDigits(String(r2(n)).replace('.', '٫')));
const faPct = (avg?: number | null) => (avg === null || avg === undefined ? '—' : `${toPersianDigits(String(r2(avg * 5)).replace('.', '٫'))}٪`);

const LEVEL_LABEL = { excellent: 'ممتاز', acceptable: 'قابل قبول', medium: 'متوسط', weak: 'نیازمند تلاش' } as const;
const toneOf = (v?: number | null): ScoreTone => (v === undefined || v === null ? 'none' : v >= 16 ? 'good' : v >= EXAM_ACCEPTABLE_FROM ? 'ok' : v >= EXAM_NEEDS_EFFORT_BELOW ? 'mid' : 'bad');

export function buildExamMonthSection(
  record: ComprehensiveExamRecord | undefined,
  classStudents: Student[],
  month: Exclude<ExamMonth, 'all'>
): ExamMonthSection {
  const a = analyzeClassExam(record, classStudents, month);
  const raw = examScoresOf(record, month);
  const subjects = a.subjects;
  const absentCount = classStudents.filter((s) => isExamAbsent(record, s.id, month)).length;

  const scored = subjects.filter((s) => a.subjectAverages[s.key] !== undefined);
  const strongest = scored.length ? scored.reduce((x, y) => (a.subjectAverages[y.key]! > a.subjectAverages[x.key]! ? y : x)) : null;
  const weakest = scored.length > 1 ? scored.reduce((x, y) => (a.subjectAverages[y.key]! < a.subjectAverages[x.key]! ? y : x)) : null;

  const counts = { excellent: 0, acceptable: 0, medium: 0, weak: 0 };
  a.rows.forEach((r) => { const l = examLevelOf(r.avg); if (l) counts[l]++; });

  const head = ['ردیف', 'نام دانش‌آموز', ...subjects.map((s) => {
    const max = examMaxOf(record, month, s.key);
    return month === 'legacy' || max === 20 ? s.label : `${s.label} (از ${toPersianDigits(max)})`;
  }), 'معدل (٪)', 'وضعیت'];

  const rows = a.rows.map((r, i) => {
    const absent = isExamAbsent(record, r.student.id, month);
    const lvl = examLevelOf(r.avg);
    return {
      cells: [
        toPersianDigits(i + 1),
        studentFullName(r.student),
        ...subjects.map((s) => (absent ? '—' : fa(raw[r.student.id]?.[s.key]))),
        absent ? '—' : faPct(r.avg),
        absent ? 'غایب در آزمون' : lvl ? LEVEL_LABEL[lvl] : '—',
      ],
      tone: absent ? ('none' as const) : toneOf(r.avg),
    };
  });

  const analysis = [
    `معدل کلاس: ${faPct(a.classAverage)}   |   درس قوت: ${strongest ? `${strongest.label} (${faPct(a.subjectAverages[strongest.key])})` : '—'}   |   نیازمند تقویت: ${weakest ? `${weakest.label} (${faPct(a.subjectAverages[weakest.key])})` : '—'}`,
    `توزیع سطوح: ممتاز ${toPersianDigits(counts.excellent)} نفر، قابل قبول ${toPersianDigits(counts.acceptable)} نفر، متوسط ${toPersianDigits(counts.medium)} نفر، نیازمند تلاش ${toPersianDigits(counts.weak)} نفر${absentCount ? `، غایب ${toPersianDigits(absentCount)} نفر` : ''}`,
    `میانگین دروس: ${subjects.map((s) => `${s.label} ${faPct(a.subjectAverages[s.key])}`).join('، ') || '—'}`,
  ];

  return {
    month,
    title: `کارنامه آزمون جامع ${examMonthLabel(month)}`,
    landscape: subjects.length > 5,
    head,
    rows,
    analysis,
    stats: { classAvg: faPct(a.classAverage), strongest: strongest ? strongest.label : '—', weakest: weakest ? weakest.label : '—' },
  };
}
