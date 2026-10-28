import React, { useEffect, useRef, useState } from 'react';
import { BadgeSettings, StudentBadgeResult, badgeReason } from '../utils/studentBadges';
import { toPersianDigits } from '../utils/persianDate';

type BadgeKey = 'discipline' | 'academic';

const BADGES: Record<BadgeKey, { icon: string; label: string; chip: string; pop: string }> = {
  discipline: {
    icon: '🛡️',
    label: 'ممتاز انضباطی',
    chip: 'bg-teal-50 text-teal-800 border-teal-200 shadow-sm hover:bg-teal-100',
    pop: 'border-teal-200 bg-teal-50 text-teal-900',
  },
  academic: {
    icon: '🏆',
    label: 'ممتاز آموزشی',
    chip: 'bg-amber-50 text-amber-800 border-amber-200 shadow-sm hover:bg-amber-100',
    pop: 'border-amber-200 bg-amber-50 text-amber-900',
  },
};

/** نشان‌های افتخار زیر نام دانش‌آموز؛ با لمس هر نشان، دلیل دریافت در یک پاپ‌آپ کوچک نمایش داده می‌شود */
export const StudentBadges: React.FC<{ badges: StudentBadgeResult; settings: BadgeSettings }> = ({ badges, settings }) => {
  const [open, setOpen] = useState<BadgeKey | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // بستن با لمس بیرون یا Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const earned = (Object.keys(BADGES) as BadgeKey[]).filter((k) => badges[k]);
  if (earned.length === 0) return null;

  return (
    <div ref={root} className="relative mt-1.5 flex items-center gap-1.5 flex-wrap">
      {earned.map((key) => {
        const b = BADGES[key];
        const isOpen = open === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setOpen(isOpen ? null : key)}
            aria-expanded={isOpen}
            aria-controls={`badge-pop-${key}`}
            className={`min-h-11 sm:min-h-9 px-3 rounded-full border text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition active:scale-95 ${b.chip}`}
          >
            <span aria-hidden="true" className="text-sm">{b.icon}</span>
            {b.label}
          </button>
        );
      })}

      {earned.map((key) => {
        const b = BADGES[key];
        const isOpen = open === key;
        return (
          <div
            key={key}
            id={`badge-pop-${key}`}
            role="status"
            aria-hidden={!isOpen}
            className={`absolute right-0 top-full z-30 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-2xl border p-3 text-xs leading-6 font-bold shadow-lg transition duration-200 ease-out origin-top-right ${b.pop} ${
              isOpen ? 'opacity-100 translate-y-0 scale-100' : 'pointer-events-none opacity-0 -translate-y-1 scale-95'
            }`}
          >
            <span aria-hidden="true" className="ml-1">{b.icon}</span>
            {toPersianDigits(badgeReason(key, settings))}
          </div>
        );
      })}
    </div>
  );
};
