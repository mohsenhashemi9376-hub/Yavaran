import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, CheckCircle2, Megaphone, ScrollText, Send, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { apiRequest } from '../lib/serverSync';
import { AppNotification } from '../types';
import { dateToShamsiString, toPersianDigits } from '../utils/persianDate';
import { SendAnnouncementModal } from './SendAnnouncementModal';

const POLL_MS = 45_000;

const formatWhen = (iso: string | null) => {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: toPersianDigits(dateToShamsiString(d)),
    time: toPersianDigits(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`),
  };
};

interface Props {
  /** تعداد دانش‌آموزان دارای هشدار غیبت (اطلاع‌رسانی قدیمی هدر) */
  warningCount?: number;
}

/** زنگوله اعلان‌ها: شمارنده خوانده‌نشده، دراور اعلان‌ها، پاپ‌آپ اعلان جدید */
export const NotificationBell: React.FC<Props> = ({ warningCount = 0 }) => {
  const { currentUser } = useSchool();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AppNotification | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const knownIds = useRef<Set<number> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ unread: number; notifications: AppNotification[] }>('GET', '/api/notifications');
      const list = res.notifications || [];
      const known = knownIds.current;
      if (known === null) {
        knownIds.current = new Set(list.map((n) => n.id));
      } else {
        list
          .filter((n) => !n.isRead && !known.has(n.id))
          .forEach((n) => {
            known.add(n.id);
            // اعلان سیستم‌عامل فقط وقتی تب در پس‌زمینه است؛ در تب فعال کادر وسط صفحه نمایش داده می‌شود
            try {
              if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(n.title, { body: n.message.slice(0, 160), dir: 'rtl', lang: 'fa' });
              }
            } catch {
              /* نمایش اعلان سیستم‌عامل ممکن نیست */
            }
          });
      }
      setItems(list);
      setUnread(res.unread || 0);
    } catch {
      /* خطای شبکه: در نوبت بعدی دوباره تلاش می‌شود */
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open]);

  const markRead = (n: AppNotification) => {
    if (n.isRead) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    apiRequest('POST', `/api/notifications/${n.id}/read`).catch(() => undefined);
  };

  const markAll = () => {
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
    apiRequest('POST', '/api/notifications/read-all').catch(() => undefined);
  };

  const toggleOpen = () => {
    setOpen((v) => !v);
    try {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch {
      /* مرورگر از اعلان سیستمی پشتیبانی نمی‌کند */
    }
  };

  // گروه‌بندی بر اساس تاریخ
  const groups: { date: string; list: AppNotification[] }[] = [];
  items.forEach((n) => {
    const date = formatWhen(n.createdAt).date;
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.list.push(n);
    else groups.push({ date, list: [n] });
  });

  const badge = unread + warningCount;

  // بخشنامه‌ها برای استاد با کادر اختصاصی خودش نمایش داده می‌شود
  const alertQueue = items.filter(
    (n) => !n.isRead && !dismissed.includes(n.id) && !(currentUser.role === 'teacher' && n.type === 'circular'),
  );
  const alertItem = detail ? null : alertQueue[0] || null;

  useEffect(() => {
    if (!alertItem) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDismissed((prev) => [...prev, alertItem.id]);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alertItem]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        id="btn-header-notifications"
        type="button"
        onClick={toggleOpen}
        className={`relative p-2 rounded-xl border transition cursor-pointer ${
          open ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
        title="اعلانات و پیام‌ها"
        aria-label="اعلانات"
        aria-expanded={open}
      >
        <Bell className={`w-4 h-4 ${unread > 0 ? 'text-rose-600' : ''}`} />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-full flex items-center justify-center">
            {toPersianDigits(badge > 99 ? '99+' : badge)}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute inset-x-3 sm:inset-x-auto top-16 sm:top-auto sm:left-0 sm:mt-2 sm:w-96 max-h-[75vh] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 shrink-0">
            <span className="text-sm font-extrabold text-slate-900">اعلان‌ها</span>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold">
                {toPersianDigits(unread)} جدید
              </span>
            )}
            <button
              type="button"
              onClick={markAll}
              disabled={unread === 0}
              className="mr-auto px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 disabled:opacity-40 text-emerald-700 border border-emerald-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>علامت‌گذاری همه به عنوان خوانده‌شده</span>
            </button>
          </div>

          <div className="overflow-y-auto overscroll-contain flex-1 p-3 space-y-3 min-h-[120px]">
            {warningCount > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                <span className="font-bold">هشدار غیبت: </span>
                {toPersianDigits(warningCount)} دانش‌آموز دارای ۲ جلسه غیبت یا بیشتر هستند.
              </div>
            )}

            {groups.map((g) => (
              <div key={g.date} className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-400 px-1">{g.date}</div>
                {g.list.map((n) => {
                  const when = formatWhen(n.createdAt);
                  const Icon = n.type === 'circular' ? ScrollText : Megaphone;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setDetail(n);
                        markRead(n);
                        setOpen(false);
                      }}
                      className={`w-full text-right p-3 rounded-2xl border transition cursor-pointer flex gap-2.5 ${
                        n.isRead
                          ? 'bg-white border-slate-200 hover:bg-slate-50'
                          : 'bg-sky-50/80 border-sky-200 hover:bg-sky-50'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          n.priority === 'urgent' ? 'bg-rose-100 text-rose-700' : n.type === 'circular' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs truncate ${n.isRead ? 'font-bold text-slate-700' : 'font-extrabold text-slate-900'}`}>{n.title}</span>
                          {n.priority === 'urgent' && (
                            <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold shrink-0">فوری</span>
                          )}
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mr-auto" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed whitespace-normal">{n.message}</p>
                        <div className="text-[10px] text-slate-400 mt-1">{when.time}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}

            {items.length === 0 && warningCount === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">اعلانی برای نمایش وجود ندارد.</div>
            )}
          </div>

          {currentUser.role === 'admin' && (
            <div className="p-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSendOpen(true);
                }}
                className="w-full h-11 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>ارسال اطلاعیه جدید</span>
              </button>
            </div>
          )}
        </div>
      )}

      {alertItem && (
        <div
          className="fixed inset-0 z-[95] bg-slate-900/45 backdrop-blur-[3px] flex items-center justify-center p-4 animate-in fade-in duration-200"
          dir="rtl"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="notif-alert-title"
        >
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl shadow-slate-900/20 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className={`h-1.5 bg-gradient-to-l ${alertItem.priority === 'urgent' ? 'from-rose-500 to-orange-400' : 'from-emerald-600 to-teal-400'}`} />
            <button
              type="button"
              onClick={() => setDismissed((prev) => [...prev, alertItem.id])}
              aria-label="بستن موقت"
              title="بستن (بعداً یادآوری می‌شود)"
              className="absolute top-4 left-3 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="px-5 pt-5 pb-4 text-center">
              <div
                className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
                  alertItem.priority === 'urgent' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                {alertItem.type === 'circular' ? <ScrollText className="w-7 h-7" /> : <Megaphone className="w-7 h-7" />}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                {alertItem.priority === 'urgent' && (
                  <span className="px-2.5 py-0.5 rounded-full border text-[11px] font-bold bg-rose-100 text-rose-700 border-rose-200">فوری</span>
                )}
                <span className="text-[11px] text-slate-400">{formatWhen(alertItem.createdAt).date}</span>
                {alertQueue.length > 1 && (
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                    {toPersianDigits(1)} از {toPersianDigits(alertQueue.length)}
                  </span>
                )}
              </div>
              <h3 id="notif-alert-title" className="mt-2.5 text-base font-extrabold text-slate-900 leading-snug">
                {alertItem.title}
              </h3>
              <div className="mt-2 max-h-52 overflow-y-auto text-[13px] leading-7 text-slate-600 whitespace-pre-line break-words text-right">
                {alertItem.message}
              </div>
              {alertItem.senderName && <div className="mt-2 text-[11px] text-slate-400">{alertItem.senderName}</div>}
            </div>
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => markRead(alertItem)}
                autoFocus
                className="w-full h-12 rounded-2xl bg-gradient-to-l from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-extrabold text-sm shadow-md shadow-emerald-600/25 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>متوجه شدم</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-start gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-slate-900">{detail.title}</h3>
                <div className="text-[11px] text-slate-400 mt-1">
                  {formatWhen(detail.createdAt).date} • {formatWhen(detail.createdAt).time}
                  {detail.senderName ? ` • ${detail.senderName}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="بستن"
                className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 pb-6 overflow-y-auto text-sm text-slate-700 leading-loose whitespace-pre-line">{detail.message}</div>
          </div>
        </div>
      )}

      <SendAnnouncementModal isOpen={sendOpen} onClose={() => setSendOpen(false)} />
    </div>
  );
};
