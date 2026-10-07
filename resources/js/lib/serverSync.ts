/**
 * لایه ارتباط رابط کاربری با سرور لاراول.
 * هر تغییر در state کانتکست به‌صورت خودکار با آخرین نسخه دریافتی از سرور
 * مقایسه می‌شود و فقط رکوردهای افزوده/ویرایش/حذف‌شده به سرور ارسال می‌گردد.
 */

export type CollectionKey =
  | 'users'
  | 'classes'
  | 'bellPeriods'
  | 'students'
  | 'sessions'
  | 'academicSubjects'
  | 'academicGrades'
  | 'morningDelays'
  | 'morningAttendance'
  | 'schoolAbsences'
  | 'observations'
  | 'nurturingDossiers'
  | 'coachEvaluations'
  | 'teacherEvaluations'
  | 'schoolAnnouncements'
  | 'comprehensiveExams'
  | 'courseAssignments'
  | 'teacherActivities'
  | 'gradePeriods'
  | 'workshops'
  | 'loanItems'
  | 'grades'
  | 'settings';

export const COLLECTION_KEYS: CollectionKey[] = [
  'users',
  'classes',
  'bellPeriods',
  'students',
  'sessions',
  'academicSubjects',
  'academicGrades',
  'morningDelays',
  'morningAttendance',
  'schoolAbsences',
  'observations',
  'nurturingDossiers',
  'coachEvaluations',
  'teacherEvaluations',
  'schoolAnnouncements',
  'comprehensiveExams',
  'courseAssignments',
  'teacherActivities',
  'gradePeriods',
  'workshops',
  'loanItems',
  'grades',
  'settings',
];

export interface SyncRow {
  id: string;
  [key: string]: unknown;
}

export interface BootstrapPayload {
  authenticated: boolean;
  userId?: string;
  serverTime?: number;
  data?: Record<CollectionKey, SyncRow[]>;
}

export class ApiError extends Error {
  status: number;
  /** خطاهای اعتبارسنجی هر فیلد (کد ۴۲۲) */
  fieldErrors: Record<string, string> = {};

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const readXsrfToken = (): string => {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const defaultMessage = (status: number): string => {
  if (status === 0) return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.';
  if (status === 401 || status === 419) return 'نشست کاربری شما منقضی شده است. لطفاً دوباره وارد شوید.';
  if (status === 403) return 'شما مجوز انجام این عملیات را ندارید.';
  if (status === 413) return 'حجم اطلاعات ارسالی بیش از حد مجاز هاست است.';
  if (status === 429) return 'تعداد درخواست‌ها بیش از حد مجاز است. لحظاتی بعد دوباره تلاش کنید.';
  return 'خطای سرور در ذخیره اطلاعات رخ داد.';
};

export async function apiRequest<T = unknown>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': readXsrfToken(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, defaultMessage(0));
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    // فقط پیام‌های فارسی سرور نمایش داده می‌شوند؛ پیام‌های پیش‌فرض انگلیسی فریم‌ورک با پیام فارسی جایگزین می‌شوند
    const serverMessage = data && typeof data.message === 'string' ? data.message.trim() : '';
    const message = serverMessage && /[\u0600-\u06FF]/.test(serverMessage) && (response.status < 500 || response.status === 503)
      ? serverMessage
      : defaultMessage(response.status);
    const apiError = new ApiError(response.status, message);
    if (response.status === 422 && data && data.errors && typeof data.errors === 'object') {
      for (const [field, msgs] of Object.entries<any>(data.errors)) {
        if (Array.isArray(msgs) && typeof msgs[0] === 'string') apiError.fieldErrors[field] = msgs[0];
      }
    }
    throw apiError;
  }

  return data as T;
}

interface UpsertItem {
  id: string;
  data: SyncRow;
  prepend?: boolean;
}

const MAX_CHUNK_BYTES = 900_000;

export class SyncEngine {
  private snapshots = new Map<CollectionKey, Map<string, string>>();
  private chain: Promise<void> = Promise.resolve();
  private pendingCount = 0;
  /** شمارنده تغییرات ارسال‌شده (برای تشخیص تداخل با بروزرسانی پس‌زمینه) */
  version = 0;
  private onError: (error: ApiError, collection: CollectionKey) => void;

  constructor(onError: (error: ApiError, collection: CollectionKey) => void) {
    this.onError = onError;
  }

  get isIdle(): boolean {
    return this.pendingCount === 0;
  }

  /** ثبت نسخه دریافتی از سرور به‌عنوان مبنای مقایسه */
  reset(collections: Partial<Record<CollectionKey, SyncRow[]>>): void {
    this.snapshots.clear();
    (Object.keys(collections) as CollectionKey[]).forEach((key) => {
      const map = new Map<string, string>();
      (collections[key] || []).forEach((row) => {
        if (row && typeof row.id === 'string' && row.id) map.set(row.id, JSON.stringify(row));
      });
      this.snapshots.set(key, map);
    });
  }

  clear(): void {
    this.snapshots.clear();
  }

  /** محاسبه تفاوت و ارسال تغییرات یک مجموعه به سرور */
  push(collection: CollectionKey, rows: SyncRow[]): void {
    const snapshot = this.snapshots.get(collection);
    if (!snapshot) return;

    const next = new Map<string, string>();
    const upserts: UpsertItem[] = [];

    rows.forEach((row, index) => {
      if (!row || typeof row.id !== 'string' || !row.id) return;
      const json = JSON.stringify(row);
      next.set(row.id, json);
      if (snapshot.get(row.id) !== json) {
        const isNew = !snapshot.has(row.id);
        upserts.push({ id: row.id, data: row, prepend: isNew && index === 0 && rows.length > 1 });
      }
    });

    const deletes: string[] = [];
    snapshot.forEach((_json, id) => {
      if (!next.has(id)) deletes.push(id);
    });

    if (upserts.length === 0 && deletes.length === 0) return;

    this.snapshots.set(collection, next);
    this.version += 1;

    // تقسیم به بسته‌های کوچک‌تر برای سازگاری با محدودیت‌های هاست اشتراکی
    const batches: { upserts: UpsertItem[]; deletes: string[] }[] = [];
    let current: UpsertItem[] = [];
    let size = 0;
    upserts.forEach((item) => {
      const itemSize = JSON.stringify(item).length;
      if (current.length > 0 && (size + itemSize > MAX_CHUNK_BYTES || current.length >= 400)) {
        batches.push({ upserts: current, deletes: [] });
        current = [];
        size = 0;
      }
      current.push(item);
      size += itemSize;
    });
    if (current.length > 0 || deletes.length > 0) {
      batches.push({ upserts: current, deletes: [] });
    }
    for (let i = 0; i < deletes.length; i += 400) {
      batches.push({ upserts: [], deletes: deletes.slice(i, i + 400) });
    }

    batches
      .filter((batch) => batch.upserts.length > 0 || batch.deletes.length > 0)
      .forEach((batch) => this.enqueue(collection, batch));
  }

  private enqueue(collection: CollectionKey, batch: { upserts: UpsertItem[]; deletes: string[] }): void {
    this.pendingCount += 1;
    this.chain = this.chain
      .then(() => apiRequest('POST', '/api/sync', { collection, ...batch }))
      .then(
        () => undefined,
        (error: unknown) => {
          const apiError = error instanceof ApiError ? error : new ApiError(500, defaultMessage(500));
          this.onError(apiError, collection);
        }
      )
      .finally(() => {
        this.pendingCount -= 1;
      });
  }

  /** انتظار برای ارسال کامل تغییرات در صف */
  flush(): Promise<void> {
    return this.chain;
  }
}
