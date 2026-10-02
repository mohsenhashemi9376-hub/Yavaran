import { AcademicSubject, SchoolClass } from '../types';

const normalizeGrade = (g?: string) => (g || '').replace('پایه', '').trim();

/** آیا این درس برای پایه‌ی کلاس تعریف شده است؟ (دروس عمومی/بدون پایه برای همه‌ی کلاس‌ها) */
export function subjectAppliesToClass(subject: AcademicSubject, cls: SchoolClass): boolean {
  const grades = [...(subject.targetGrades || []), ...(subject.grade ? [subject.grade] : [])]
    .map(normalizeGrade)
    .filter((g) => g && !g.includes('عمومی'));
  if (grades.length === 0) return true;
  const cg = normalizeGrade(cls.grade);
  return grades.some((g) => g === cg || cg.includes(g) || g.includes(cg));
}
