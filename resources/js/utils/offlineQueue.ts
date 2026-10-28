/**
 * صف آفلاین سادهٔ ساعت کاری: وقتی اینترنت قطع است آخرین نسخهٔ هر ماه روی دستگاه نگه داشته می‌شود
 * و با برگشتن اتصال ارسال می‌شود. برای هر ماه فقط آخرین نسخه می‌ماند.
 */
const KEY = 'yv-timesheet-pending';

type Pending = Record<string, unknown>;

const read = (): Pending => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Pending) : {};
  } catch {
    return {};
  }
};

const write = (data: Pending) => {
  try {
    if (Object.keys(data).length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* حافظه پر یا مسدود است؛ صف کار نمی‌کند ولی برنامه ادامه می‌دهد */
  }
};

export const queuePending = (month: string, payload: unknown): void => write({ ...read(), [month]: payload });
export const getPending = <T,>(month: string): T | undefined => read()[month] as T | undefined;
export const hasPending = (): boolean => Object.keys(read()).length > 0;

/** هر ماه در صف را با send ارسال می‌کند؛ موفق‌ها از صف حذف می‌شوند. true یعنی صف خالی شد. */
export const flushPending = async (send: (month: string, payload: unknown) => Promise<void>): Promise<boolean> => {
  const data = read();
  for (const month of Object.keys(data)) {
    try {
      await send(month, data[month]);
      const rest = read();
      delete rest[month];
      write(rest);
    } catch {
      return false;
    }
  }
  return true;
};
