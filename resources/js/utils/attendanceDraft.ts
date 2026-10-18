import type { StudentAttendanceRecord } from '../types';

/**
 * پیش‌نویس موقت حضور و غیاب کلاسی روی حافظه‌ی دستگاه (localStorage).
 * هر تغییر استاد در لحظه ذخیره می‌شود تا با خاموش‌شدن صفحه یا بازشدن دوباره‌ی برنامه از بین نرود؛
 * فقط پس از ثبت نهایی پاک می‌شود. پیش‌نویس هر کاربر جداست.
 */
export interface AttendanceDraft {
  lessonTopic: string;
  homeworkDescription: string;
  sessionNotes: string;
  records: Record<string, StudentAttendanceRecord>;
  updatedAt: number;
}

/** آخرین فهرستی که باز بوده؛ برای بازگشتن به همان فهرست پس از بارگذاری دوباره */
export interface ActiveAttendance {
  classId: string;
  subject?: string;
  courseKey: string;
  period: number;
  date: string;
  /** در حالت ویرایش یک جلسه‌ی ثبت‌شده */
  sessionId?: string;
  updatedAt: number;
}

const MAX_AGE_MS = 36 * 60 * 60 * 1000;
const draftKey = (userId: string, courseKey: string, date: string, period: number) =>
  `yavaran:att-draft:${userId}:${courseKey}:${date}:${period}`;
const activeKey = (userId: string) => `yavaran:att-active:${userId}`;

const read = <T extends { updatedAt: number }>(key: string): T | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    if (!parsed || Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const write = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // حافظه‌ی دستگاه پر یا غیرفعال است
  }
};

const remove = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

export const loadAttendanceDraft = (userId: string, courseKey: string, date: string, period: number) =>
  read<AttendanceDraft>(draftKey(userId, courseKey, date, period));

export const saveAttendanceDraft = (
  userId: string,
  courseKey: string,
  date: string,
  period: number,
  draft: Omit<AttendanceDraft, 'updatedAt'>
) => write(draftKey(userId, courseKey, date, period), { ...draft, updatedAt: Date.now() });

export const clearAttendanceDraft = (userId: string, courseKey: string, date: string, period: number) =>
  remove(draftKey(userId, courseKey, date, period));

export const loadActiveAttendance = (userId: string) => read<ActiveAttendance>(activeKey(userId));

export const saveActiveAttendance = (userId: string, active: Omit<ActiveAttendance, 'updatedAt'>) =>
  write(activeKey(userId), { ...active, updatedAt: Date.now() });

export const clearActiveAttendance = (userId: string) => remove(activeKey(userId));
