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

/** هر کارگاه پیش‌فرض را با رکورد ذخیره‌شده (در صورت وجود) ادغام می‌کند؛ پایه همیشه از تعریف پیش‌فرض می‌آید */
export function buildWorkshopList(stored: Workshop[]): Workshop[] {
  const byId = new Map(stored.map((w) => [w.id, w]));
  const merged = DEFAULT_WORKSHOPS.map((d) => {
    const rec = byId.get(d.id);
    return { ...d, ...(rec || {}), gradeLevel: d.gradeLevel, category: d.category, name: d.name, studentIds: rec?.studentIds || [] };
  });
  const extra = stored.filter((w) => !DEFAULT_WORKSHOPS.some((d) => d.id === w.id));
  return [...merged, ...extra];
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
