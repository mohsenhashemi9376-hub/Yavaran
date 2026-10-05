import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/** دکمه تک‌کلیکی تغییر بین حالت روشن و تاریک */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      id="btn-theme-toggle"
      onClick={toggleTheme}
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
      title={dark ? 'حالت روشن' : 'حالت تاریک'}
      className={`yv-theme-toggle ${className}`}
    >
      <span className="yv-theme-toggle__thumb">
        {dark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      </span>
    </button>
  );
};
