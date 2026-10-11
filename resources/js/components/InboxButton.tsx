import React, { useCallback, useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { InboxModal } from './InboxModal';

const POLL_MS = 45_000;
export const INBOX_ROLES = ['admin', 'vice_principal', 'vice_educational', 'vice_disciplinary', 'vice_nurturing', 'coach'];

/** دکمه صندوق پیام در هدر با شمارنده پیام‌های خوانده‌نشده */
export const InboxButton: React.FC = () => {
  const { currentUser, isAuthenticated } = useSchool();
  const allowed = isAuthenticated && INBOX_ROLES.includes(currentUser.role);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/summary', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
      if (!res.ok) return;
      const data = await res.json();
      setUnread(Number(data?.unread) || 0);
    } catch {
      /* خطای شبکه: شمارنده قبلی می‌ماند */
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    refresh();
    const t = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(t);
  }, [allowed, refresh]);

  if (!allowed) return null;

  return (
    <>
      <button
        type="button"
        id="btn-header-inbox"
        onClick={() => setOpen(true)}
        className="relative p-2.5 hover:bg-slate-100 text-slate-600 hover:text-teal-800 rounded-xl transition cursor-pointer"
        aria-label={unread > 0 ? `صندوق پیام (${unread} پیام خوانده‌نشده)` : 'صندوق پیام'}
        title="صندوق پیام"
      >
        <Mail className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center">
            {toPersianDigits(unread > 99 ? '99+' : unread)}
          </span>
        )}
      </button>
      {open && <InboxModal onClose={() => { setOpen(false); refresh(); }} onUnreadChange={setUnread} />}
    </>
  );
};
