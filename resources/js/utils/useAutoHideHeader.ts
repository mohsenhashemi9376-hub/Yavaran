import { useEffect, useRef, useState } from 'react';

/**
 * هدر هوشمند: با اسکرول به پایین پنهان و با اسکرول به بالا (یا در بالای صفحه) نمایان می‌شود.
 * لرزش‌های کوچک (کمتر از ۸ پیکسل) نادیده گرفته می‌شود. وقتی `locked` درست باشد (منو باز است) هدر پنهان نمی‌شود.
 */
export function useAutoHideHeader(locked = false): boolean {
  const [show, setShow] = useState(true);
  const last = useRef(0);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY);
      if (y <= 0) setShow(true);
      else if (lockedRef.current) setShow(true);
      else if (Math.abs(y - last.current) >= 8) setShow(y < last.current);
      else return;
      last.current = y;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    last.current = Math.max(0, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return show || locked;
}
