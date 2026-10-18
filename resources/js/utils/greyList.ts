import { GreyListRecord, GreySnapshot, StudentAcademicGrade } from '../types';
import { CONTINUOUS_MONTHS, mean, round2 } from './examReport';
import { FollowUpReason } from './academicFollowUp';
import { toEnglishDigits } from './persianDate';

/** علت‌های ضعف قابل انتخاب در لیست خاکستری آموزش */
export const GREY_CAUSES: { key: string; label: string }[] = [
  { key: 'bad_teaching', label: 'استاد بد درس می‌دهد' },
  { key: 'not_understanding', label: 'تدریس استاد را نمی‌فهمد' },
  { key: 'temperament', label: 'مشکل مزاجی دارد' },
  { key: 'weak_base', label: 'پایه ضعیف است' },
  { key: 'not_studying', label: 'درس نخوانده است' },
  { key: 'weak_memory', label: 'حافظه و هوش ضعیفی دارد' },
  { key: 'no_interest', label: 'به درس علاقه‌مند نیست' },
  { key: 'noisy_class', label: 'کلاس شلوغ و پر سر و صداست' },
  { key: 'anxiety', label: 'استرس و اضطراب بالا' },
  { key: 'not_learning', label: 'می‌خواند ولی یاد نمی‌گیرد' },
  { key: 'distracted', label: 'حواسش زیاد پرت می‌شود' },
  { key: 'hopeless', label: 'امیدی به موفقیت ندارد' },
];
export const GREY_OTHER = { key: 'other', label: 'سایر' };
export const causeLabel = (key: string): string => [...GREY_CAUSES, GREY_OTHER].find((c) => c.key === key)?.label ?? key;

/** نمره‌ی زیر این حد «ضعیف» حساب می‌شود و کنار نام درس می‌آید */
export const GREY_SUBJECT_BELOW = 16;

/** تصویر وضعیت آموزشی دانش‌آموز: میانگین مستمر، دروس زیر ۱۶ (با نمره‌ی میانگین همان درس) و دلایل ورود به لیست */
export function buildGreySnapshot(grades: StudentAcademicGrade[], reasons: FollowUpReason[]): GreySnapshot {
  const subjects = grades
    .map((g) => ({ name: g.subjectName, score: mean(CONTINUOUS_MONTHS.map((m) => g[m.key]).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))) }))
    .filter((s): s is { name: string; score: number } => s.score !== undefined);
  const average = mean(subjects.map((s) => s.score));
  return {
    average: average === undefined ? null : round2(average),
    weakSubjects: subjects.filter((s) => s.score < GREY_SUBJECT_BELOW).map((s) => ({ name: s.name, score: round2(s.score) })).sort((a, b) => a.score - b.score),
    reasons: reasons.map((r) => ({ kind: r.kind, group: r.group, label: r.label, detail: r.detail })),
  };
}

/** «۱۴۰۵/۷/۹» ← «1405/07/09» (قابل مقایسه‌ی رشته‌ای) */
export const normShamsi = (d?: string | null): string =>
  toEnglishDigits(d || '').split('/').map((p, i) => (i === 0 ? p : p.padStart(2, '0'))).join('/');

/** سررسید پیگیری بعدی رسیده یا گذشته است؟ */
export const isFollowUpDue = (r: Pick<GreyListRecord, 'nextFollowUp'>, today: string): boolean =>
  Boolean(r.nextFollowUp) && normShamsi(r.nextFollowUp) <= normShamsi(today);
