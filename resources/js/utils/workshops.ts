import { Workshop } from '../types';

const BASE: { slug: string; name: string; category: Workshop['category'] }[] = [
  { slug: 'medicine', name: 'طب', category: 'scientific' },
  { slug: 'social', name: 'روابط اجتماعی', category: 'scientific' },
  { slug: 'history', name: 'تاریخ', category: 'scientific' },
  { slug: 'technical', name: 'فنی', category: 'skill' },
  { slug: 'writing', name: 'نویسندگی', category: 'skill' },
  { slug: 'ai', name: 'هوش مصنوعی', category: 'skill' },
];

/** ۱۲ کارگاه مستقل: ۶ کارگاه پایه هشتم (شناسه‌های ws-*) و ۶ کارگاه پایه نهم (ws9-*) */
export const DEFAULT_WORKSHOPS: Workshop[] = [
  ...BASE.map((b) => ({ id: `ws-${b.slug}`, name: b.name, category: b.category, gradeLevel: 8 as const, studentIds: [] })),
  ...BASE.map((b) => ({ id: `ws9-${b.slug}`, name: b.name, category: b.category, gradeLevel: 9 as const, studentIds: [] })),
];

/**
 * فهرست کارگاه‌ها دقیقاً همان رکوردهای ذخیره‌شده در سرور است (قابل ویرایش، حذف و افزودن).
 * کارگاه‌های پیش‌فرض فقط هنگام ساخت جدول در سرور بذر می‌شوند.
 */
export function buildWorkshopList(stored: Workshop[]): Workshop[] {
  return stored.map((w) => ({ ...w, studentIds: w.studentIds || [] }));
}

/** «کارگاه مهارتی هوش مصنوعی (پایه نهم)» */
export function workshopTitle(w: Pick<Workshop, 'name' | 'category' | 'gradeLevel'>): string {
  return `کارگاه ${w.category === 'scientific' ? 'علمی' : 'مهارتی'} ${w.name} (پایه ${w.gradeLevel === 9 ? 'نهم' : 'هشتم'})`;
}

export const WORKSHOP_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
export const WORKSHOP_PERIODS = ['زنگ اول', 'زنگ دوم', 'زنگ سوم', 'زنگ چهارم'];

const normalize = (v: string) => (v || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک');

/** پایه کلاس (۸ یا ۹) از نام یا پایه؛ null برای سایر پایه‌ها */
export function gradeLevelOfClass(cls?: { name: string; grade?: string }): 8 | 9 | null {
  const t = normalize(`${cls?.name || ''} ${cls?.grade || ''}`);
  if (t.includes('هشتم')) return 8;
  if (t.includes('نهم')) return 9;
  return null;
}
