const RELOAD_KEY = 'yv_chunk_reload_at';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * دریافت ماژول با تلاش مجدد. در موبایل، قطعی لحظه‌ای شبکه یا فایل قدیمی (hash عوض‌شده بعد از انتشار نسخه‌ی جدید
 * که هنوز در کش PWA است) باعث خطای «بارگذاری با مشکل مواجه شد» می‌شد و دکمه‌ی «تلاش دوباره» هم جواب نمی‌داد
 * چون React.lazy نتیجه‌ی ردشده را نگه می‌دارد. پس: چند بار تلاش می‌کنیم و در نهایت یک بار صفحه را تازه می‌کنیم.
 */
export async function retryImport<T>(loader: () => Promise<T>, retries = 2): Promise<T> {
  try {
    const mod = await loader();
    try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ }
    return mod;
  } catch (err) {
    if (retries > 0) {
      await sleep(600 * (3 - retries));
      return retryImport(loader, retries - 1);
    }
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      if (!last || Date.now() - last > 60_000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        return new Promise<T>(() => undefined); // تا بارگذاری مجدد صفحه، نمای «در حال بارگذاری» می‌ماند
      }
    } catch { /* ignore */ }
    throw err;
  }
}
