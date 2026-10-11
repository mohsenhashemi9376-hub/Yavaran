import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Mail, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { dateToShamsiString, toPersianDigits } from '../utils/persianDate';
import { InboxModal } from './InboxModal';

const POLL_MS = 45_000;
export const INBOX_ROLES = ['admin', 'vice_principal', 'vice_educational', 'vice_disciplinary', 'vice_nurturing', 'coach'];

interface UrgentMessage {
  id: number;
  senderName: string;
  subject: string;
  body: string;
  createdAt: string | null;
}

const readXsrf = (): string => {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

/** کادر هشدار وسط صفحه برای پیام فوریِ خوانده‌نشده */
const UrgentAlert: React.FC<{ item: UrgentMessage; remaining: number; onAck: () => void; onOpen: () => void; onLater: () => void }> = ({ item, remaining, onAck, onOpen, onLater }) => {
  const d = item.createdAt ? new Date(item.createdAt) : null;
  const when = d && !isNaN(d.getTime()) ? toPersianDigits(`${dateToShamsiString(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`) : '';
  return createPortal(
    <div className="fixed inset-0 z-[210] h-[100dvh] w-screen bg-slate-900/55 backdrop-blur-[4px] flex items-center justify-center p-4" dir="rtl" role="alertdialog" aria-modal="true" aria-labelledby="inbox-urgent-title">
      <div className="relative w-full max-w-md max-h-[88dvh] flex flex-col bg-white rounded-[28px] shadow-2xl overflow-hidden">
        <div className="h-2 shrink-0 bg-gradient-to-l from-rose-500 via-orange-400 to-amber-300" />
        <button type="button" onClick={onLater} aria-label="بستن موقت" title="بستن (بعداً یادآوری می‌شود)" className="absolute top-5 left-4 w-9 h-9 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer">
          <X className="w-5 h-5" />
        </button>
        <div className="px-6 pt-6 pb-3 text-center shrink-0">
          <div className="w-16 h-16 mx-auto rounded-2xl ring-8 bg-rose-50 text-rose-600 ring-rose-100 flex items-center justify-center"><AlertTriangle className="w-8 h-8" /></div>
          <div className="mt-4 inline-flex px-3 py-1 rounded-full border bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-extrabold">پیام فوری{remaining > 1 ? ` • ${toPersianDigits(remaining)} پیام فوری` : ''}</div>
          <h3 id="inbox-urgent-title" className="mt-3 text-base font-black text-slate-900 break-words">{item.subject}</h3>
          <div className="text-[11px] text-slate-500 mt-1">از {item.senderName}{when ? ` • ${when}` : ''}</div>
        </div>
        <div className="px-6 pb-4 overflow-y-auto"><p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap break-words text-right">{item.body}</p></div>
        <div className="px-6 pb-6 pt-2 flex items-center gap-2 shrink-0">
          <button type="button" onClick={onAck} className="flex-1 h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold cursor-pointer">متوجه شدم</button>
          <button type="button" onClick={onOpen} className="h-12 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold cursor-pointer">باز کردن صندوق</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/** دکمه صندوق پیام در هدر با شمارنده پیام‌های خوانده‌نشده */
export const InboxButton: React.FC = () => {
  const { currentUser, isAuthenticated } = useSchool();
  const allowed = isAuthenticated && INBOX_ROLES.includes(currentUser.role);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [urgent, setUrgent] = useState<UrgentMessage[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/summary', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
      if (!res.ok) return;
      const data = await res.json();
      setUnread(Number(data?.unread) || 0);
      setUrgent(Array.isArray(data?.urgent) ? data.urgent : []);
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

  const acknowledge = async (id: number) => {
    setUrgent((list) => list.filter((m) => m.id !== id));
    try {
      await fetch(`/api/inbox/${id}/read`, { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': readXsrf() } });
    } catch {
      /* در بازخوانی بعدی دوباره نمایش داده می‌شود */
    }
    refresh();
  };

  if (!allowed) return null;

  const pendingUrgent = urgent.filter((m) => !dismissed.includes(m.id));
  const alertItem = !open ? pendingUrgent[0] : undefined;

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
      {alertItem && (
        <UrgentAlert
          item={alertItem}
          remaining={pendingUrgent.length}
          onAck={() => acknowledge(alertItem.id)}
          onOpen={() => { setDismissed((d) => [...d, alertItem.id]); setOpen(true); }}
          onLater={() => setDismissed((d) => [...d, alertItem.id])}
        />
      )}
      {open && <InboxModal onClose={() => { setOpen(false); refresh(); }} onUnreadChange={setUnread} />}
    </>
  );
};
