import React, { useEffect, useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';

export interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface MobileBottomNavProps {
  /** تب‌های اصلی (حداکثر ۴ مورد) */
  items: MobileNavItem[];
  /** سایر بخش‌ها که داخل برگه «بیشتر» نمایش داده می‌شوند */
  moreItems?: MobileNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

/**
 * نوار ناوبری پایین مخصوص موبایل (کمتر از 768px) شبیه اپلیکیشن‌های بومی.
 * در دسکتاپ کاملاً مخفی است.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  items,
  moreItems = [],
  activeId,
  onSelect,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreItems.some((i) => i.id === activeId);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const pick = (id: string) => {
    setMoreOpen(false);
    onSelect(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tabClass = (active: boolean) =>
    `relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 text-[11px] font-bold transition-colors cursor-pointer select-none ${
      active ? 'text-emerald-800' : 'text-slate-500 active:text-slate-800'
    }`;

  return (
    <>
      <nav
        aria-label="ناوبری اصلی"
        dir="rtl"
        className="yv-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-40 bg-white rounded-t-3xl border-t border-slate-200/80 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] flex items-stretch px-2"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item.id)}
              aria-current={active ? 'page' : undefined}
              className={tabClass(active)}
            >
              <span
                className={`relative flex items-center justify-center h-8 w-14 rounded-full transition-colors ${
                  active ? 'bg-emerald-100' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.badge ? (
                  <span className="absolute -top-0.5 right-2 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                    {toPersianDigits(item.badge > 99 ? 99 : item.badge)}
                  </span>
                ) : null}
              </span>
              <span className="truncate max-w-full px-0.5">{item.label}</span>
            </button>
          );
        })}
        {moreItems.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={tabClass(moreActive)}
          >
            <span
              className={`flex items-center justify-center h-8 w-14 rounded-full transition-colors ${
                moreActive ? 'bg-emerald-100' : ''
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
            </span>
            <span>بیشتر</span>
          </button>
        )}
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 flex items-end justify-center z-50 md:hidden"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-label="سایر بخش‌ها"
          onClick={(e) => e.target === e.currentTarget && setMoreOpen(false)}
        >
          <div className="bg-white w-full rounded-t-3xl shadow-2xl p-4 pb-6 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-slate-900">سایر بخش‌ها</h3>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pick(item.id)}
                    className={`relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3.5 text-[11px] font-bold cursor-pointer transition-colors ${
                      active
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 active:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-center leading-snug">{item.label}</span>
                    {item.badge ? (
                      <span className="absolute top-1.5 left-1.5 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                        {toPersianDigits(item.badge > 99 ? 99 : item.badge)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
