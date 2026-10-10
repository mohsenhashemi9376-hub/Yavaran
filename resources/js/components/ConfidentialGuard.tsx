import React, { useEffect, useMemo } from 'react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { useTheme } from '../context/ThemeContext';

const ROLES = ['coach', 'vice_nurturing'];

const isEditable = (el: EventTarget | null): boolean => {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

/**
 * محافظت ظاهری از اطلاعات محرمانه‌ی تربیتی برای مربی و معاون تربیتی:
 * واترمارک پخش‌شده با نام کاربر و ساعت (برای بازدارندگی از عکس گرفتن)، غیرفعال‌شدن چاپ،
 * و جلوگیری از کپی/برش/منوی راست‌کلیک خارج از فیلدهای ورودی.
 * این لایه فقط بازدارنده است؛ حفاظت اصلی در سرور اعمال می‌شود.
 */
export const ConfidentialGuard: React.FC = () => {
  const { currentUser } = useSchool();
  const { theme } = useTheme();
  const active = !!currentUser && ROLES.includes(currentUser.role);

  useEffect(() => {
    if (!active) return;
    document.documentElement.classList.add('yv-confidential');
    const block = (e: Event) => { if (!isEditable(e.target)) e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's'].includes(e.key.toLowerCase())) e.preventDefault();
    };
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('contextmenu', block);
    document.addEventListener('dragstart', block);
    document.addEventListener('keydown', onKey);
    return () => {
      document.documentElement.classList.remove('yv-confidential');
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('dragstart', block);
      document.removeEventListener('keydown', onKey);
    };
  }, [active]);

  const background = useMemo(() => {
    if (!active) return '';
    const now = new Date();
    const stamp = toPersianDigits(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    const esc = (s: string) => s.replace(/[<>&"']/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><text x="160" y="100" text-anchor="middle" transform="rotate(-24 160 100)" font-family="Vazirmatn,sans-serif" font-size="15" font-weight="700" fill="${theme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.07)'}">${esc(currentUser.name)} · ${stamp} · محرمانه</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, [active, currentUser?.name, theme]);

  if (!active) return null;
  return <div aria-hidden="true" className="yv-watermark" style={{ backgroundImage: background }} />;
};
