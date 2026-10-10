import React, { useEffect, useRef, useState } from 'react';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** عدد شمارشی: از صفر تا مقدار نهایی بالا می‌رود (در حالت «کاهش حرکت» مستقیم نشان داده می‌شود) */
export const AnimatedNumber: React.FC<{ value: number; duration?: number }> = ({ value, duration = 700 }) => {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (reducedMotion() || !Number.isFinite(value)) { setShown(value); return; }
    const start = performance.now();
    const base = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(base + (value - base) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{toPersianDigits(shown)}</>;
};

/** اگر متن فقط یک عدد صحیح (فارسی یا لاتین) باشد، شمارشی نشان می‌دهد؛ وگرنه همان متن */
export const MaybeAnimated: React.FC<{ text: string | number }> = ({ text }) => {
  const raw = toEnglishDigits(String(text)).trim();
  return /^\d{1,7}$/.test(raw) ? <AnimatedNumber value={parseInt(raw, 10)} /> : <>{text}</>;
};
