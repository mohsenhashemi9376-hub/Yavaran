import { compareStudents } from './studentName';
import { toPersianDigits } from './persianDate';

/** ساعت مرجع ورود: ۰۷:۰۰ صبح (دقیقه از نیمه‌شب) */
export const MORNING_REFERENCE_MINUTES = 7 * 60;

/** محاسبه دقیقه تأخیر از ساعت ورود "HH:MM" نسبت به ۰۷:۰۰ */
export function delayFromEntryTime(entryTime?: string): number {
  const m = (entryTime || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return Math.max(0, Number(m[1]) * 60 + Number(m[2]) - MORNING_REFERENCE_MINUTES);
}

/** «X ساعت و Y دقیقه تأخیر» — فقط ساعت، فقط دقیقه یا ترکیبی؛ suffix مثلاً «صبحگاه» */
export function formatDelayText(minutes: number, suffix = ''): string {
  if (!minutes || minutes <= 0) return 'بدون تأخیر';
  const h = Math.floor(minutes / 60);
  const r = minutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${toPersianDigits(h)} ساعت`);
  if (r > 0) parts.push(`${toPersianDigits(r)} دقیقه`);
  return `${parts.join(' و ')} تأخیر${suffix ? ` ${suffix}` : ''}`;
}

const norm = (v: string) =>
  (v || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‏]/g, ' ').replace(/\s+/g, ' ');

export type MorningFilterKey = 'all' | 'seventh-sanagoo' | 'seventh-moein' | 'eighth' | 'ninth';

export const MORNING_FILTERS: { key: MorningFilterKey; label: string; hint: string }[] = [
  { key: 'all', label: 'لیست کل مدرسه', hint: 'ترتیب الفبایی بر اساس نام خانوادگی' },
  { key: 'seventh-sanagoo', label: 'هفتم شهید ثناگو', hint: 'کلاس هفتم' },
  { key: 'seventh-moein', label: 'هفتم معین', hint: 'کلاس هفتم' },
  { key: 'eighth', label: 'هشتم', hint: 'کلاس هشتم' },
  { key: 'ninth', label: 'نهم', hint: 'کلاس نهم' },
];

/** آیا کلاس (بر اساس نام/پایه) در این فیلتر قرار می‌گیرد؟ */
export function classMatchesMorningFilter(cls: { name: string; grade?: string }, key: MorningFilterKey): boolean {
  if (key === 'all') return true;
  const text = norm(`${cls.name} ${cls.grade || ''}`);
  if (key === 'eighth') return text.includes('هشتم');
  if (key === 'ninth') return text.includes('نهم');
  if (!text.includes('هفتم')) return false;
  if (key === 'seventh-moein') return text.includes('معین');
  return text.includes('ثناگو');
}

/** مقایسه الفبایی فارسی بر اساس نام خانوادگی و سپس نام */
export const compareByLastName = compareStudents;

/** آمار صبحگاه امروز: غایب = دانش‌آموزی که حضورش ثبت نشده؛ متأخر = حاضر با delay_minutes > 0 */
export function getMorningTodayStats(
  students: { id: string }[],
  records: { studentId: string; date: string; status: string; delayMinutes: number }[],
  todayDate: string,
  /** جمعه یا تعطیلی: لیست بسته است و کسی غایب حساب نمی‌شود */
  closed = false
): { absent: number; late: number; present: number } {
  if (closed) return { absent: 0, late: 0, present: 0 };
  const presentIds = new Set<string>();
  let late = 0;
  records.forEach((r) => {
    if (r.date === todayDate && r.status === 'present') {
      presentIds.add(r.studentId);
      if (r.delayMinutes > 0) late++;
    }
  });
  const present = students.filter((s) => presentIds.has(s.id)).length;
  return { absent: students.length - present, late, present };
}
