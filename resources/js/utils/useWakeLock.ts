import { useEffect } from 'react';

/**
 * مانع خاموش‌شدن خودکار صفحه‌ی گوشی تا زمانی که برنامه باز و در دید است.
 * قفل با رفتن به پس‌زمینه آزاد می‌شود، پس هنگام برگشتن دوباره گرفته می‌شود.
 */
export function useWakeLock(active: boolean = true): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinel || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // مرورگر یا حالت صرفه‌جویی باتری اجازه نمی‌دهد؛ بی‌صدا نادیده گرفته می‌شود
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    // برخی مرورگرها قفل را فقط پس از یک لمس کاربر می‌دهند
    const onTouch = () => void acquire();

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pointerdown', onTouch, { passive: true });
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pointerdown', onTouch);
      if (sentinel) void sentinel.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
