import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CheckCheck, Download, Inbox, Paperclip, PenSquare, Reply, Search, Send, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { dateToShamsiString, toPersianDigits } from '../utils/persianDate';

type Priority = 'urgent' | 'important' | 'normal';
type Box = 'inbox' | 'sent' | 'compose';

interface InboxMessage {
  id: number;
  threadId: number;
  senderId: string;
  senderName: string;
  senderRole?: string | null;
  priority: Priority;
  subject: string;
  body: string;
  createdAt: string | null;
  isMine: boolean;
  isRead: boolean;
  recipients: { id: string; name: string; readAt: string | null }[];
  attachments: { id: number; name: string; size: number }[];
}

interface InboxUser {
  id: string;
  name: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'مدیر',
  vice_principal: 'معاون',
  vice_educational: 'معاون آموزشی',
  vice_disciplinary: 'معاون انضباطی',
  vice_nurturing: 'معاون تربیتی',
  coach: 'مربی',
};

const PRIORITY: Record<Priority, { label: string; chip: string }> = {
  urgent: { label: 'فوری', chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  important: { label: 'مهم', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  normal: { label: 'عادی', chip: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const readXsrf = (): string => {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const call = async <T,>(method: 'GET' | 'POST', url: string, body?: FormData): Promise<T> => {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': readXsrf() },
    body,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const firstError = data?.errors ? (Object.values(data.errors)[0] as string[] | undefined)?.[0] : undefined;
    throw new Error(firstError || data?.message || 'عملیات انجام نشد. دوباره تلاش کنید.');
  }
  return data as T;
};

const formatWhen = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return toPersianDigits(`${dateToShamsiString(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
};

const formatSize = (b: number): string => (b >= 1048576 ? `${toPersianDigits((b / 1048576).toFixed(1))} مگابایت` : `${toPersianDigits(Math.max(1, Math.round(b / 1024)))} کیلوبایت`);

const PriorityChip: React.FC<{ p: Priority }> = ({ p }) => (
  <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${PRIORITY[p].chip}`}>{PRIORITY[p].label}</span>
);

/** فرم نوشتن پیام (پیام جدید یا پاسخ) */
const Composer: React.FC<{
  users: InboxUser[];
  fixedRecipients?: string[];
  replyTo?: number;
  initialSubject?: string;
  onSent: () => void;
}> = ({ users, fixedRecipients, replyTo, initialSubject = '', onSent }) => {
  const [selected, setSelected] = useState<string[]>(fixedRecipients || []);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const GROUPS: { label: string; match: (u: InboxUser) => boolean }[] = [
    { label: 'همه مربیان', match: (u) => u.role === 'coach' },
    { label: 'همه معاونین', match: (u) => u.role.startsWith('vice_') },
    { label: 'مدیر', match: (u) => u.role === 'admin' },
    { label: 'کادر کل', match: () => true },
  ];
  const groupIds = (g: { match: (u: InboxUser) => boolean }) => users.filter(g.match).map((u) => u.id);
  const groupActive = (g: { match: (u: InboxUser) => boolean }) => {
    const ids = groupIds(g);
    return ids.length > 0 && ids.every((id) => selected.includes(id));
  };
  const toggleGroup = (g: { match: (u: InboxUser) => boolean }) => {
    const ids = groupIds(g);
    setSelected((s) => (ids.every((id) => s.includes(id)) ? s.filter((x) => !ids.includes(x)) : Array.from(new Set([...s, ...ids]))));
  };

  const shown = users.filter((u) => !search.trim() || u.name.includes(search.trim()) || (ROLE_LABEL[u.role] || '').includes(search.trim()));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) return setError('حداقل یک گیرنده انتخاب کنید.');
    if (!body.trim()) return setError('متن پیام را بنویسید.');
    if (file && file.size > 3 * 1024 * 1024) return setError('حجم پیوست باید کمتر از ۳ مگابایت باشد.');
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      selected.forEach((id) => fd.append('recipients[]', id));
      fd.append('subject', subject.trim());
      fd.append('body', body.trim());
      fd.append('priority', priority);
      if (replyTo) fd.append('replyTo', String(replyTo));
      if (file) fd.append('attachment', file);
      await call('POST', '/api/inbox', fd);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارسال پیام انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {!fixedRecipients && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="text-[11px] font-bold text-slate-500">گیرندگان ({toPersianDigits(selected.length)} نفر)</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام یا سمت"
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-teal-500 w-40"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mb-2" role="group" aria-label="انتخاب گروهی">
            {GROUPS.map((g) => {
              const count = groupIds(g).length;
              if (count === 0) return null;
              const on = groupActive(g);
              return (
                <button
                  key={g.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleGroup(g)}
                  className={`px-3 py-1.5 rounded-full border text-[11px] font-bold cursor-pointer ${on ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {g.label} ({toPersianDigits(count)})
                </button>
              );
            })}
          </div>
          <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1 rounded-xl border border-slate-100">
            {shown.length === 0 && <div className="text-xs text-slate-400 p-3 col-span-full text-center">گیرنده‌ای یافت نشد.</div>}
            {shown.map((u) => (
              <label key={u.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer ${selected.includes(u.id) ? 'bg-teal-50 border-teal-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="accent-teal-700" />
                <span className="font-bold text-slate-800 truncate">{u.name}</span>
                <span className="text-slate-400 shrink-0">{ROLE_LABEL[u.role] || u.role}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={191}
          placeholder="موضوع (اختیاری)"
          className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-teal-500"
        />
        <div className="flex items-center gap-1" role="group" aria-label="اولویت">
          {(Object.keys(PRIORITY) as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={priority === p}
              onClick={() => setPriority(p)}
              className={`px-3 py-2 rounded-xl border text-xs font-extrabold cursor-pointer ${priority === p ? PRIORITY[p].chip + ' ring-2 ring-offset-1 ring-teal-300' : 'bg-white border-slate-200 text-slate-400'}`}
            >
              {PRIORITY[p].label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        rows={replyTo ? 3 : 6}
        placeholder="متن پیام..."
        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-teal-500 resize-y"
      />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer">
            <Paperclip className="w-4 h-4" />
            <span>پیوست (تا ۳ مگابایت)</span>
          </button>
          {file && (
            <span className="text-[11px] text-slate-600 truncate max-w-[12rem]">
              {file.name}{' '}
              <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-rose-600 font-bold cursor-pointer">حذف</button>
            </span>
          )}
        </div>
        <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer">
          <Send className="w-4 h-4" />
          <span>{busy ? 'در حال ارسال...' : 'ارسال'}</span>
        </button>
      </div>
      {error && <div role="alert" className="text-xs font-bold text-rose-600">{error}</div>}
    </form>
  );
};

/** پنجره صندوق پیام: دریافتی، ارسالی، نوشتن پیام و گفتگو با پاسخ */
export const InboxModal: React.FC<{ onClose: () => void; onUnreadChange: (n: number) => void }> = ({ onClose, onUnreadChange }) => {
  const { currentUser } = useSchool();
  const [box, setBox] = useState<Box>('inbox');
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [users, setUsers] = useState<InboxUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [thread, setThread] = useState<InboxMessage[]>([]);
  const [replying, setReplying] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent'>('all');

  const load = useCallback(async (which: 'inbox' | 'sent') => {
    setLoading(true);
    setError('');
    try {
      const data = await call<{ messages: InboxMessage[]; unread: number }>('GET', `/api/inbox?box=${which}`);
      setMessages(data.messages);
      setUnread(data.unread);
      onUnreadChange(data.unread);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری پیام‌ها انجام نشد.');
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    setQuery('');
    setFilter('all');
    if (box !== 'compose') load(box);
  }, [box, load]);

  useEffect(() => {
    call<{ users: InboxUser[] }>('GET', '/api/inbox/users').then((d) => setUsers(d.users)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (openId ? setOpenId(null) : onClose());
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, openId]);

  const openMessage = async (m: InboxMessage) => {
    setOpenId(m.id);
    setReplying(false);
    setThread([m]);
    try {
      const d = await call<{ messages: InboxMessage[] }>('GET', `/api/inbox/${m.id}/thread`);
      setThread(d.messages);
      if (!m.isMine && !m.isRead) {
        const r = await call<{ unread: number }>('POST', `/api/inbox/${m.id}/read`);
        setUnread(r.unread);
        onUnreadChange(r.unread);
        setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, isRead: true } : x)));
      }
    } catch {
      /* گفتگو بارگذاری نشد؛ خود پیام نمایش داده می‌شود */
    }
  };

  const markAllRead = async () => {
    try {
      await call('POST', '/api/inbox/read-all');
      setUnread(0);
      onUnreadChange(0);
      setMessages((list) => list.map((x) => ({ ...x, isRead: true })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'انجام نشد.');
    }
  };

  const visibleMessages = useMemo(() => {
    const q = query.trim();
    return messages.filter((m) => {
      if (filter === 'unread' && !(box === 'inbox' && !m.isRead)) return false;
      if (filter === 'urgent' && m.priority !== 'urgent') return false;
      if (!q) return true;
      return (
        m.subject.includes(q) ||
        m.body.includes(q) ||
        m.senderName.includes(q) ||
        m.recipients.some((r) => r.name.includes(q)) ||
        m.attachments.some((a) => a.name.includes(q))
      );
    });
  }, [messages, query, filter, box]);

  const root = useMemo(() => thread.find((m) => m.id === openId) || thread[0], [thread, openId]);
  const replyTargets = useMemo(() => {
    if (!root) return [];
    const last = [...thread].reverse().find((m) => !m.isMine) || root;
    return root.isMine && thread.every((m) => m.isMine) ? root.recipients.map((r) => r.id) : [last.senderId];
  }, [thread, root]);

  const tabCls = (b: Box) => `px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer inline-flex items-center gap-2 transition ${box === b ? 'bg-teal-700 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100'}`;

  return createPortal(
    <div className="fixed inset-0 z-[150] bg-slate-900/45 flex items-end sm:items-center justify-center sm:p-4" dir="rtl" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="صندوق پیام" className="bg-slate-50 w-full sm:max-w-3xl h-[92dvh] sm:h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-white px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            {openId ? (
              <button type="button" onClick={() => setOpenId(null)} aria-label="بازگشت" className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"><ArrowRight className="w-5 h-5" /></button>
            ) : (
              <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center"><Inbox className="w-5 h-5" /></span>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-900">صندوق پیام</h2>
              <div className="text-[11px] text-slate-500">
                {box === 'inbox' ? `${toPersianDigits(messages.length)} پیام دریافتی • ${toPersianDigits(unread)} خوانده‌نشده` : box === 'sent' ? `${toPersianDigits(messages.length)} پیام ارسالی` : 'پیام جدید'}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن" className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {!openId && (
          <div className="px-4 sm:px-6 pt-3 flex items-center gap-2 flex-wrap">
            <button type="button" className={tabCls('inbox')} onClick={() => setBox('inbox')}>
              <Inbox className="w-4 h-4" />
              <span>دریافتی</span>
              <span className={`min-w-[1.4rem] px-1.5 py-0.5 rounded-full text-[10px] font-extrabold text-center ${unread > 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{toPersianDigits(unread)}</span>
            </button>
            <button type="button" className={tabCls('sent')} onClick={() => setBox('sent')}><Send className="w-4 h-4" /><span>ارسالی</span></button>
            <button type="button" className={tabCls('compose')} onClick={() => setBox('compose')}><PenSquare className="w-4 h-4" /><span>پیام جدید</span></button>
            {box === 'inbox' && unread > 0 && (
              <button type="button" onClick={markAllRead} className="mr-auto px-3 py-2 rounded-xl text-xs font-bold text-teal-800 hover:bg-teal-50 inline-flex items-center gap-1.5 cursor-pointer">
                <CheckCheck className="w-4 h-4" /><span>همه خوانده شد</span>
              </button>
            )}
          </div>
        )}

        {!openId && box !== 'compose' && (
          <div className="px-4 sm:px-6 pt-3 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[10rem]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو در موضوع، متن، نام و پیوست"
                className="w-full text-xs bg-white border border-slate-200 focus:border-teal-500 rounded-xl pr-9 pl-3 py-2.5 outline-none"
              />
            </div>
            {([['all', 'همه'], ['unread', 'خوانده‌نشده'], ['urgent', 'فوری']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={`px-3 py-2 rounded-full border text-[11px] font-bold cursor-pointer ${filter === k ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3">
          {openId && root ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-900">{thread[0]?.subject}</h3>
                <PriorityChip p={thread.reduce<Priority>((best, m) => (['urgent', 'important', 'normal'].indexOf(m.priority) < ['urgent', 'important', 'normal'].indexOf(best) ? m.priority : best), 'normal')} />
              </div>
              {thread.map((m) => (
                <div key={m.id} className={`rounded-2xl border p-3.5 ${m.isMine ? 'bg-teal-50/60 border-teal-100' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                    <div className="font-extrabold text-slate-800">
                      {m.isMine ? 'شما' : m.senderName}
                      {!m.isMine && m.senderRole && <span className="text-slate-400 font-normal"> • {ROLE_LABEL[m.senderRole] || m.senderRole}</span>}
                    </div>
                    <div className="flex items-center gap-2"><PriorityChip p={m.priority} /><span className="text-slate-400">{formatWhen(m.createdAt)}</span></div>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">به: {m.recipients.map((r) => (r.id === String(currentUser.id) ? 'شما' : r.name)).join('، ')}</div>
                  <p className="text-sm text-slate-800 leading-7 mt-2 whitespace-pre-wrap break-words">{m.body}</p>
                  {m.attachments.map((a) => (
                    <a key={a.id} href={`/api/inbox/attachments/${a.id}`} className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700">
                      <Download className="w-4 h-4 text-teal-700" /><span className="truncate max-w-[14rem]">{a.name}</span><span className="text-slate-400 font-normal">{formatSize(a.size)}</span>
                    </a>
                  ))}
                  {m.isMine && m.recipients.length > 0 && (
                    <div className="text-[10px] text-slate-400 mt-2">{m.recipients.map((r) => `${r.name}: ${r.readAt ? 'خوانده شد' : 'خوانده‌نشده'}`).join(' • ')}</div>
                  )}
                </div>
              ))}
              {replying ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
                  <Composer
                    users={users}
                    fixedRecipients={replyTargets}
                    replyTo={thread[thread.length - 1]?.id}
                    initialSubject={thread[0]?.subject.startsWith('پاسخ:') ? thread[0].subject : `پاسخ: ${thread[0]?.subject || ''}`}
                    onSent={async () => {
                      setReplying(false);
                      const d = await call<{ messages: InboxMessage[] }>('GET', `/api/inbox/${thread[thread.length - 1].id}/thread`).catch(() => null);
                      if (d) setThread(d.messages);
                    }}
                  />
                </div>
              ) : (
                <button type="button" onClick={() => setReplying(true)} className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer">
                  <Reply className="w-4 h-4" /><span>پاسخ</span>
                </button>
              )}
            </div>
          ) : box === 'compose' ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <Composer users={users} onSent={() => setBox('sent')} />
            </div>
          ) : loading ? (
            <div className="py-16 text-center text-sm text-slate-400">در حال بارگذاری...</div>
          ) : error ? (
            <div role="alert" className="py-16 text-center text-sm font-bold text-rose-600">{error}</div>
          ) : visibleMessages.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              {messages.length > 0 ? 'پیامی با این جستجو یا فیلتر پیدا نشد.' : box === 'inbox' ? 'پیامی دریافت نشده است.' : 'هنوز پیامی نفرستاده‌اید.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {visibleMessages.map((m) => {
                const unreadRow = box === 'inbox' && !m.isRead;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => openMessage(m)}
                      className={`w-full text-right rounded-2xl border p-3.5 transition cursor-pointer hover:shadow-sm ${unreadRow ? 'bg-white border-teal-300' : 'bg-white/70 border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {unreadRow && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" aria-label="خوانده‌نشده" />}
                          <span className={`text-sm truncate ${unreadRow ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                            {box === 'sent' ? `به: ${m.recipients.map((r) => r.name).join('، ')}` : m.senderName}
                          </span>
                          {box === 'inbox' && m.senderRole && <span className="text-[10px] text-slate-400 shrink-0">{ROLE_LABEL[m.senderRole] || ''}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.attachments.length > 0 && <Paperclip className="w-3.5 h-3.5 text-slate-400" />}
                          <PriorityChip p={m.priority} />
                        </div>
                      </div>
                      <div className={`text-xs mt-1 truncate ${unreadRow ? 'font-extrabold text-slate-800' : 'text-slate-600'}`}>{m.subject}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{formatWhen(m.createdAt)}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
