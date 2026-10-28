import { useEffect, useRef } from 'react';

/** فرم‌های دارای تغییر ذخیره‌نشده‌ی فعال؛ هر فرم با یک کلید یکتا ثبت می‌شود */
const dirtyKeys = new Set<string>();
let counter = 0;

export const hasUnsavedChanges = (): boolean => dirtyKeys.size > 0;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (dirtyKeys.size === 0) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

/** تا وقتی dirty برقرار است، بستن/رفرش صفحه و جابه‌جایی بین بخش‌ها هشدار می‌دهد */
export function useUnsavedGuard(dirty: boolean): void {
  const key = useRef(`guard-${++counter}`);
  useEffect(() => {
    const k = key.current;
    if (dirty) dirtyKeys.add(k);
    else dirtyKeys.delete(k);
    return () => { dirtyKeys.delete(k); };
  }, [dirty]);
}
