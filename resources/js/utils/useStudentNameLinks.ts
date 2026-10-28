import { useEffect } from 'react';
import type { Student } from '../types';
import { studentFullName } from './studentName';

const norm = (v: string) => v.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\s‌‏]+/g, ' ').trim();
const SKIP = 'button, a, input, select, textarea, label, summary, [role="button"], [role="tab"], [contenteditable="true"], [data-no-student-link]';

/**
 * هر جای برنامه که نام کامل یک دانش‌آموز نمایش داده شود، ضربه روی آن پرونده‌ی او را باز می‌کند
 * (برای مدیر، معاونین و مربی). نام‌های تکراری در مدرسه نادیده گرفته می‌شوند تا پرونده‌ی اشتباه باز نشود.
 */
export function useStudentNameLinks(enabled: boolean, students: Student[], open: (student: Student) => void): void {
  useEffect(() => {
    if (!enabled) return;
    const byName = new Map<string, Student | null>();
    students.forEach((s) => {
      const key = norm(studentFullName(s));
      if (!key) return;
      byName.set(key, byName.has(key) ? null : s);
    });

    /** عنصری که متن آن دقیقاً نام یک دانش‌آموز است (خود هدف یا یکی از دو والد نزدیک) */
    const resolve = (target: EventTarget | null): { el: HTMLElement; student: Student } | null => {
      let el = target instanceof HTMLElement ? target : (target as Node | null)?.parentElement ?? null;
      for (let depth = 0; el && depth < 3; depth++, el = el.parentElement) {
        if (el.closest(SKIP)) return null;
        const text = el.textContent || '';
        if (text.length > 80) return null;
        const student = byName.get(norm(text));
        if (student) return { el, student };
      }
      return null;
    };

    const onOver = (e: MouseEvent) => {
      const hit = resolve(e.target);
      if (hit && !hit.el.hasAttribute('data-student-link')) {
        hit.el.setAttribute('data-student-link', '');
        hit.el.style.cursor = 'pointer';
      }
    };
    const onClick = (e: MouseEvent) => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const hit = resolve(e.target);
      if (hit) open(hit.student);
    };
    document.addEventListener('mouseover', onOver);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('click', onClick, true);
    };
  }, [enabled, students, open]);
}
