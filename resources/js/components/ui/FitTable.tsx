import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { Modal } from './Modal';

export interface FitTableProps {
  children: React.ReactNode;
  /** Classes for the wrapper (border, rounded, ...). */
  className?: string;
  /** Title shown in the "full view" dialog. */
  title?: string;
}

/**
 * Wraps a <table> so the page never scrolls horizontally. The table is forced
 * to fit its container (text wraps); if it still does not fit, a
 * "مشاهده کامل" button opens the same table as stacked cards in a dialog.
 */
export const FitTable: React.FC<FitTableProps> = ({ children, className = '', title = 'مشاهده کامل جدول' }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState(false);

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (el) setOverflowing(el.scrollWidth > el.clientWidth + 2);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const table = el.querySelector('table');
    if (table) ro.observe(table);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure]);

  return (
    <>
      <div ref={wrapRef} className={`yv-fit overflow-hidden ${className}`}>
        {children}
      </div>
      {overflowing && (
        <div className="flex justify-center px-3 py-2 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-800 text-white text-xs font-bold hover:bg-teal-900 transition cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            مشاهده کامل
          </button>
        </div>
      )}
      <Modal isOpen={open} onClose={() => setOpen(false)} title={title} size="full">
        <StackedView>{children}</StackedView>
      </Modal>
    </>
  );
};

/** Renders the table as label/value cards, labelling cells from the <th> text. */
const StackedView: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const label = () => {
      el.querySelectorAll('table').forEach((table) => {
        const heads = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent || '').trim());
        table.querySelectorAll('tbody tr').forEach((tr) => {
          Array.from(tr.children).forEach((td, i) => {
            if (heads[i] && td.getAttribute('data-label') !== heads[i]) td.setAttribute('data-label', heads[i]);
          });
        });
      });
    };
    label();
    const mo = new MutationObserver(label);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  return (
    <div ref={ref} className="yv-stack">
      {children}
    </div>
  );
};
