import type { LoanItem } from '../types';
import { shamsiStringToDate, toEnglishDigits } from './persianDate';

/** اگر وسیله بعد از این تعداد روز برنگردد، سایت هشدار می‌دهد */
export const LOAN_ALERT_DAYS = 2;

/** قالب‌بندی و اعتبارسنجی تاریخ شمسی YYYY/MM/DD (ارقام فارسی هم پذیرفته می‌شود) */
export function normalizeShamsi(input: string): string | null {
  const m = toEnglishDigits((input || '').trim()).replace(/[-.]/g, '/').match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}/${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
}

/** تعداد روزهای گذشته از تاریخ «from» تا «to» (هر دو شمسی) */
export function daysBetweenShamsi(from: string, to: string): number {
  const a = shamsiStringToDate(from);
  const b = shamsiStringToDate(to);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export type LoanState = 'returned' | 'overdue' | 'active';

export function loanElapsedDays(item: LoanItem, today: string): number {
  return Math.max(0, daysBetweenShamsi(item.loanDate, item.returned && item.returnedDate ? item.returnedDate : today));
}

export function loanState(item: LoanItem, today: string): LoanState {
  if (item.returned) return 'returned';
  return loanElapsedDays(item, today) >= LOAN_ALERT_DAYS ? 'overdue' : 'active';
}

export function overdueLoans(items: LoanItem[], today: string): LoanItem[] {
  return items.filter((l) => loanState(l, today) === 'overdue');
}
