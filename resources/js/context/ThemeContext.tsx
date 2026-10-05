import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'yv-theme';

const readStored = (): ThemeMode => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* حافظه مرورگر در دسترس نیست */
  }
  return 'light';
};

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggleTheme: () => undefined });

/**
 * تم روشن/تاریک. انتخاب کاربر ذخیره می‌شود و روی <html> به‌صورت data-theme قرار می‌گیرد.
 * ظاهر «لوکس» (data-lux) برای همه صفحه‌ها و نقش‌ها فعال است (useLuxScope).
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(readStored);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'dark' ? '#0a1315' : '#0f766e');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* نادیده گرفته می‌شود */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

/** ظاهر لوکس را روی کل صفحه (هدر، مودال‌ها، پس‌زمینه) فعال می‌کند */
export function useLuxScope(active: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    if (active) root.setAttribute('data-lux', '');
    else root.removeAttribute('data-lux');
    return () => root.removeAttribute('data-lux');
  }, [active]);
}
