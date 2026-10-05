import { Workshop } from '../types';

export const DEFAULT_WORKSHOPS: Workshop[] = [
  { id: 'ws-medicine', name: 'طب', category: 'scientific', studentIds: [] },
  { id: 'ws-social', name: 'روابط اجتماعی', category: 'scientific', studentIds: [] },
  { id: 'ws-history', name: 'تاریخ', category: 'scientific', studentIds: [] },
  { id: 'ws-technical', name: 'فنی', category: 'skill', studentIds: [] },
  { id: 'ws-writing', name: 'نویسندگی', category: 'skill', studentIds: [] },
  { id: 'ws-ai', name: 'هوش مصنوعی', category: 'skill', studentIds: [] },
];

/** هر کارگاه پیش‌فرض را با رکورد ذخیره‌شده (در صورت وجود) ادغام می‌کند */
export function buildWorkshopList(stored: Workshop[]): Workshop[] {
  const byId = new Map(stored.map((w) => [w.id, w]));
  const merged = DEFAULT_WORKSHOPS.map((d) => ({ ...d, ...(byId.get(d.id) || {}), studentIds: byId.get(d.id)?.studentIds || [] }));
  const extra = stored.filter((w) => !DEFAULT_WORKSHOPS.some((d) => d.id === w.id));
  return [...merged, ...extra];
}

export const WORKSHOP_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه'];
export const WORKSHOP_PERIODS = ['زنگ اول', 'زنگ دوم', 'زنگ سوم', 'زنگ چهارم'];
