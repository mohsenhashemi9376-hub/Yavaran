import type { Student } from '../types';

const LEGACY_BATCH_PHONE = '09120000000';

/**
 * فهرست‌های کلاسی به‌صورت «نام‌خانوادگی نام» نوشته می‌شوند (مثلاً «امامی‌فر سیدمحمدسجاد»).
 * ثبت گروهی قدیمی اولین کلمه را «نام» و بقیه را «نام خانوادگی» ذخیره می‌کرد؛ این تابع
 * همان متن را دوباره تقسیم می‌کند: آخرین کلمه نام، بقیه نام خانوادگی.
 */
export function splitListName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts[parts.length - 1], lastName: parts.slice(0, -1).join(' ') };
}

/** اصلاح نام دانش‌آموزانی که با ثبت گروهی قدیمی ذخیره شده‌اند (بدون تغییر در دیتابیس) */
export function normalizeStudentName<T extends Student>(s: T): T {
  if (s.nameFormat === 'v2' || s.parentPhone !== LEGACY_BATCH_PHONE) return s;
  if (/^شماره \d+$/.test(s.lastName || '')) return s;
  const { firstName, lastName } = splitListName(`${s.firstName || ''} ${s.lastName || ''}`);
  if (!firstName || !lastName) return s;
  return { ...s, firstName, lastName };
}

/** نمایش یکسان نام در همه‌جا: نام خانوادگی و سپس نام */
export function studentFullName(s: { firstName?: string; lastName?: string } | null | undefined): string {
  if (!s) return '';
  return `${s.lastName || ''} ${s.firstName || ''}`.trim();
}

const normKey = (v?: string) =>
  (v || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c\u200f]+/g, '');

/** ترتیب الفبایی فارسی: نام خانوادگی، سپس نام (بدون توجه به فاصله و نیم‌فاصله، یکسان‌سازی ي/ك) */
export function compareStudents(a: { firstName?: string; lastName?: string }, b: { firstName?: string; lastName?: string }): number {
  return (
    normKey(a.lastName).localeCompare(normKey(b.lastName), 'fa') ||
    normKey(a.firstName).localeCompare(normKey(b.firstName), 'fa')
  );
}
