import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ArchiveRestore, ArrowRight, BellRing, CheckCheck, Download, Eye, GraduationCap, Inbox, Paperclip, PenSquare, Reply, Search, Send, Star, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { studentFullName } from '../utils/studentName';
import { dateToShamsiString, toPersianDigits } from '../utils/persianDate';

type Priority = 'urgent' | 'important' | 'normal';
type Box = 'inbox' | 'sent' | 'archived' | 'compose';

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
  attachments: { id: number; name: string; size: number; mime?: string }[];
  studentId?: string | null;
  starred?: boolean;
  archived?: boolean;
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

/** ساخت FormData از یک شیء ساده (با مقدار بولی 1/0 برای اعتبارسنجی لاراول) */
const jsonForm = (o: Record<string, boolean | undefined>): FormData => {
  const fd = new FormData();
  Object.entries(o).forEach(([k, v]) => v !== undefined && fd.append(k, v ? '1' : '0'));
  return fd;
};

const formatWhen = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return toPersianDigits(`${dateToShamsiString(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
};

const formatSize = (b: number): string => (b >= 1048576 ? `${toPersianDigits((b / 1048576).toFixed(1))} مگابایت` : `${toPersianDigits(Math.max(1, Math.round(b / 1024)))} کیلوبایت`);


/** تیک تکی/دوتایی به سبک پیام‌رسان‌ها؛ تیک دوم هنگام خوانده‌شدن با انیمیشن کشیده می‌شود */
const TICK_CSS = '@keyframes yv-tick{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}.yv-tick{stroke-dasharray:1;animation:yv-tick .45s .1s ease-out both}@media (prefers-reduced-motion:reduce){.yv-tick{animation:none}}';
const Ticks: React.FC<{ read: boolean; className?: string }> = ({ read, className = '' }) => (
  <svg viewBox="0 0 20 12" className={`w-4 h-3 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.5 6.5 5 10l7-8.5" />
    {read && <path className="yv-tick" d="M8 8.5 9.5 10l8-8.5" pathLength={1} />}
  </svg>
);

const readTime = (iso: string | null): string => (iso ? formatWhen(iso) : '');

/**
 * نشان «خوانده شد» برای فرستنده: برچسب فشرده در فهرست (compact) و کارت جزئیات با وضعیت هر گیرنده در مشاهده‌ی پیام.
 */
const ReadReceipt: React.FC<{ recipients: InboxMessage['recipients']; variant: 'chip' | 'detail' }> = ({ recipients, variant }) => {
  if (recipients.length === 0) return null;
  const readCount = recipients.filter((r) => r.readAt).length;
  const all = readCount === recipients.length;
  const none = readCount === 0;
  const label = all ? 'خوانده شد' : none ? 'ارسال شد' : `${toPersianDigits(readCount)} از ${toPersianDigits(recipients.length)} خوانده‌اند`;

  if (variant === 'chip') {
    const lastRead = all ? recipients.map((r) => r.readAt as string).sort().pop() || null : null;
    return (
      <span
        className={`inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[10px] font-extrabold transition-colors ${
          all ? 'bg-teal-50 text-teal-700 border-teal-200' : none ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}
        title={lastRead ? `خوانده شد: ${readTime(lastRead)}` : label}
      >
        <Ticks read={!none} className={all ? 'text-teal-600' : none ? 'text-slate-400' : 'text-amber-600'} />
        {label}
      </span>
    );
  }

  return (
    <div className={`mt-3 rounded-2xl border px-3 py-2.5 backdrop-blur-xs ${all ? 'border-teal-200/80 bg-gradient-to-l from-teal-50/80 to-white' : 'border-slate-200/80 bg-slate-50/60'}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
        <Ticks read={!none} className={all ? 'text-teal-600' : none ? 'text-slate-400' : 'text-amber-600'} />
        <span className={all ? 'text-teal-800' : none ? 'text-slate-500' : 'text-amber-800'}>{label}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {recipients.map((r) => (
          <li key={r.id} className={`inline-flex items-center gap-1.5 min-h-7 ps-1 pe-2.5 rounded-full border text-[11px] ${r.readAt ? 'bg-white border-teal-200 text-slate-700' : 'bg-white/60 border-slate-200 text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${r.readAt ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{r.name.trim().charAt(0)}</span>
            <span className="font-bold">{r.name}</span>
            {r.readAt ? <span className="text-[10px] text-teal-700">{readTime(r.readAt)}</span> : <span className="text-[10px]">هنوز نخوانده</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

const PriorityChip: React.FC<{ p: Priority }> = ({ p }) => (
  <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${PRIORITY[p].chip}`}>{PRIORITY[p].label}</span>
);

/** پیوست‌های پیام: تصویر با پیش‌نمایش، PDF با باز کردن در تب جدید، بقیه دانلود */
const AttachmentList: React.FC<{ items: InboxMessage['attachments'] }> = ({ items }) => (
  <div className="mt-2 flex flex-wrap gap-2">
    {items.map((a) => {
      const isImage = (a.mime || '').startsWith('image/');
      const isPdf = a.mime === 'application/pdf';
      return (
        <div key={a.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden max-w-full">
          {isImage && (
            <a href={`/api/inbox/attachments/${a.id}?inline=1`} target="_blank" rel="noopener noreferrer" aria-label={`پیش‌نمایش ${a.name}`}>
              <img src={`/api/inbox/attachments/${a.id}?inline=1`} alt={a.name} loading="lazy" className="max-h-40 w-auto object-contain bg-slate-50" />
            </a>
          )}
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700">
            <span className="truncate max-w-[12rem]">{a.name}</span>
            <span className="text-slate-400 font-normal shrink-0">{formatSize(a.size)}</span>
            {isPdf && (
              <a href={`/api/inbox/attachments/${a.id}?inline=1`} target="_blank" rel="noopener noreferrer" className="text-teal-700 inline-flex items-center gap-1 shrink-0"><Eye className="w-4 h-4" />پیش‌نمایش</a>
            )}
            <a href={`/api/inbox/attachments/${a.id}`} className="text-teal-700 inline-flex items-center gap-1 shrink-0" aria-label={`دانلود ${a.name}`}><Download className="w-4 h-4" />دانلود</a>
          </div>
        </div>
      );
    })}
  </div>
);

/** پیوند به پرونده دانش‌آموزِ موضوع پیام */
const StudentChip: React.FC<{ studentId: string; onOpen: () => void }> = ({ studentId, onOpen }) => {
  const { students, classes } = useSchool();
  const st = students.find((x) => x.id === studentId);
  return (
    <button
      type="button"
      onClick={() => {
        if (!st) return;
        onOpen();
        window.dispatchEvent(new CustomEvent('yavaran:open-student', { detail: { studentId } }));
      }}
      disabled={!st}
      className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-xs font-bold text-violet-800 disabled:opacity-70 cursor-pointer"
    >
      <GraduationCap className="w-4 h-4" />
      <span>{st ? `پرونده ${studentFullName(st)} • ${classes.find((c) => c.id === st.classId)?.name || ''}` : 'دانش‌آموز (بدون دسترسی به پرونده)'}</span>
    </button>
  );
};

const urlBase64ToUint8Array = (b64: string): Uint8Array => {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** فعال/غیرفعال‌کردن اعلان فوری روی همین دستگاه (فقط پیام فوری؛ بدون نمایش متن) */
const PushToggle: React.FC = () => {
  const [key, setKey] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  useEffect(() => {
    if (!supported) return;
    call<{ key: string | null }>('GET', '/api/inbox/push-key').then((d) => setKey(d.key)).catch(() => undefined);
    navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((sub) => setOn(Boolean(sub))).catch(() => undefined);
  }, [supported]);

  if (!supported || !key) return null;

  const toggle = async () => {
    setBusy(true);
    setNote('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        const fd = new FormData();
        fd.append('endpoint', existing.endpoint);
        await call('POST', '/api/inbox/push/remove', fd).catch(() => undefined);
        await existing.unsubscribe();
        setOn(false);
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setNote('اجازه اعلان در مرورگر داده نشد.');
        return;
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const fd = new FormData();
      fd.append('endpoint', sub.endpoint);
      await call('POST', '/api/inbox/push', fd);
      setOn(true);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'فعال‌سازی اعلان انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${on ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
        <BellRing className="w-4 h-4" />
        <span>{on ? 'اعلان فوری روی گوشی: فعال' : 'فعال‌سازی اعلان فوری روی این دستگاه'}</span>
      </button>
      {note && <span role="alert" className="text-[11px] font-bold text-rose-600">{note}</span>}
    </span>
  );
};

/** فرم نوشتن پیام (پیام جدید یا پاسخ) */
const Composer: React.FC<{
  users: InboxUser[];
  fixedRecipients?: string[];
  replyTo?: number;
  initialSubject?: string;
  draftKey: string;
  onSent: () => void;
}> = ({ users, fixedRecipients, replyTo, initialSubject = '', draftKey, onSent }) => {
  const { currentUser, students, classes } = useSchool();
  const storageKey = `inbox-draft:${currentUser.id}:${draftKey}`;
  const draft = useMemo(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as { selected?: string[]; subject?: string; body?: string; priority?: Priority; studentId?: string }) : null;
    } catch {
      return null;
    }
  }, [storageKey]);
  const [selected, setSelected] = useState<string[]>(fixedRecipients || draft?.selected || []);
  const [subject, setSubject] = useState(draft?.subject ?? initialSubject);
  const [body, setBody] = useState(draft?.body ?? '');
  const [priority, setPriority] = useState<Priority>(draft?.priority ?? 'normal');
  const [files, setFiles] = useState<File[]>([]);
  const [studentId, setStudentId] = useState<string>(draft?.studentId || '');
  const [studentSearch, setStudentSearch] = useState('');
  const [search, setSearch] = useState('');

  // پیش‌نویس خودکار (فقط متن؛ پیوست‌ها ذخیره نمی‌شوند)
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (!body.trim() && !subject.trim() && selected.length === 0 && !studentId) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, JSON.stringify({ selected: fixedRecipients ? undefined : selected, subject, body, priority, studentId }));
      } catch {
        /* فضای ذخیره‌سازی در دسترس نیست */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [selected, subject, body, priority, studentId, storageKey, fixedRecipients]);

  const studentMatches = useMemo(() => {
    const q = studentSearch.trim();
    if (!q) return [];
    return students.filter((st) => `${st.lastName} ${st.firstName}`.includes(q)).slice(0, 6);
  }, [students, studentSearch]);
  const pickedStudent = students.find((st) => st.id === studentId);
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
    if (files.some((f) => f.size > 3 * 1024 * 1024)) return setError('حجم هر پیوست باید کمتر از ۳ مگابایت باشد.');
    if (files.reduce((n, f) => n + f.size, 0) > 10 * 1024 * 1024) return setError('مجموع حجم پیوست‌ها باید کمتر از ۱۰ مگابایت باشد.');
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      selected.forEach((id) => fd.append('recipients[]', id));
      fd.append('subject', subject.trim());
      fd.append('body', body.trim());
      fd.append('priority', priority);
      if (replyTo) fd.append('replyTo', String(replyTo));
      if (studentId) fd.append('studentId', studentId);
      files.forEach((f) => fd.append('attachments[]', f));
      await call('POST', '/api/inbox', fd);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* بدون ذخیره‌سازی */
      }
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

      {!replyTo && (
        <div>
          {pickedStudent ? (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-xs font-bold text-violet-800">
              <GraduationCap className="w-4 h-4" />
              <span>درباره: {studentFullName(pickedStudent)} • {classes.find((c) => c.id === pickedStudent.classId)?.name || ''}</span>
              <button type="button" onClick={() => setStudentId('')} className="text-rose-600 cursor-pointer" aria-label="حذف دانش‌آموز">×</button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="پیام درباره یک دانش‌آموز؟ (اختیاری — نام را جستجو کنید)"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400"
              />
              {studentMatches.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {studentMatches.map((st) => (
                    <li key={st.id}>
                      <button type="button" onClick={() => { setStudentId(st.id); setStudentSearch(''); }} className="w-full text-right px-3 py-2 text-xs hover:bg-violet-50 cursor-pointer">
                        <span className="font-bold text-slate-800">{studentFullName(st)}</span>
                        <span className="text-slate-400"> • {classes.find((c) => c.id === st.classId)?.name || ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

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
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              setFiles((cur) => [...cur, ...picked].slice(0, 5));
              if (fileRef.current) fileRef.current.value = '';
            }}
          />
          <button type="button" disabled={files.length >= 5} onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer">
            <Paperclip className="w-4 h-4" />
            <span>پیوست (تا ۵ فایل، هرکدام ۳ مگابایت)</span>
          </button>
        </div>
        <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer">
          <Send className="w-4 h-4" />
          <span>{busy ? 'در حال ارسال...' : 'ارسال'}</span>
        </button>
      </div>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 text-[11px] text-slate-700">
              <span className="truncate max-w-[10rem]">{f.name}</span>
              <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} className="text-rose-600 font-bold cursor-pointer" aria-label="حذف پیوست">حذف</button>
            </li>
          ))}
        </ul>
      )}
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
  const [filter, setFilter] = useState<'all' | 'unread' | 'urgent' | 'starred'>('all');

  const load = useCallback(async (which: 'inbox' | 'sent' | 'archived') => {
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

  // به‌روزرسانی بی‌صدای وضعیت «خوانده شد» برای فرستنده (بدون اسپینر)
  useEffect(() => {
    if (box === 'compose') return;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      if (openId) {
        const last = thread[thread.length - 1];
        if (last && thread.some((m) => m.isMine && m.recipients.some((r) => !r.readAt))) {
          call<{ messages: InboxMessage[] }>('GET', `/api/inbox/${last.id}/thread`).then((d) => setThread(d.messages)).catch(() => undefined);
        }
      } else if (box === 'sent') {
        call<{ messages: InboxMessage[] }>('GET', '/api/inbox?box=sent').then((d) => setMessages(d.messages)).catch(() => undefined);
      }
    }, 20000);
    return () => window.clearInterval(t);
  }, [box, openId, thread]);

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

  const setFlag = async (m: InboxMessage, patch: { starred?: boolean; archived?: boolean }) => {
    try {
      const res = await call<{ unread: number }>('POST', `/api/inbox/${m.id}/flag`, jsonForm(patch));
      setUnread(res.unread);
      onUnreadChange(res.unread);
      if (patch.archived !== undefined) {
        // پیام از فهرست جاری خارج می‌شود (بایگانی یا بازگردانی)
        setMessages((list) => list.filter((x) => x.id !== m.id));
        setOpenId(null);
      } else {
        setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
        setThread((list) => list.map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'انجام نشد.');
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
      if (filter === 'starred' && !m.starred) return false;
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
      <style>{TICK_CSS}</style>
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
                {box === 'archived' ? `${toPersianDigits(messages.length)} پیام بایگانی‌شده` : box === 'inbox' ? `${toPersianDigits(messages.length)} پیام دریافتی • ${toPersianDigits(unread)} خوانده‌نشده` : box === 'sent' ? `${toPersianDigits(messages.length)} پیام ارسالی` : 'پیام جدید'}
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
            <button type="button" className={tabCls('archived')} onClick={() => setBox('archived')}><Archive className="w-4 h-4" /><span>بایگانی</span></button>
            <button type="button" className={tabCls('compose')} onClick={() => setBox('compose')}><PenSquare className="w-4 h-4" /><span>پیام جدید</span></button>
            <PushToggle />
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
            {([['all', 'همه'], ['unread', 'خوانده‌نشده'], ['urgent', 'فوری'], ['starred', 'ستاره‌دار']] as const).map(([k, label]) => (
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

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-3">
          {openId && root ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-900">{thread[0]?.subject}</h3>
                <span className="mr-auto inline-flex items-center gap-1">
                  <button type="button" onClick={() => setFlag(root, { starred: !root.starred })} aria-pressed={Boolean(root.starred)} aria-label="ستاره‌دار" title="ستاره‌دار" className={`p-2 rounded-xl hover:bg-slate-100 cursor-pointer ${root.starred ? 'text-amber-500' : 'text-slate-400'}`}>
                    <Star className="w-4 h-4" fill={root.starred ? 'currentColor' : 'none'} />
                  </button>
                  <button type="button" onClick={() => setFlag(root, { archived: !root.archived })} aria-label={root.archived ? 'بازگردانی از بایگانی' : 'بایگانی'} title={root.archived ? 'بازگردانی از بایگانی' : 'بایگانی'} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer">
                    {root.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  </button>
                </span>
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
                  {m.studentId && <StudentChip studentId={m.studentId} onOpen={onClose} />}
                  {m.attachments.length > 0 && <AttachmentList items={m.attachments} />}
                  {m.isMine && <ReadReceipt recipients={m.recipients} variant="detail" />}
                </div>
              ))}
              {replying ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
                  <Composer
                    draftKey={`reply-${root.threadId}`}
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
              <Composer draftKey="new" users={users} onSent={() => setBox('sent')} />
            </div>
          ) : loading ? (
            <div className="py-16 text-center text-sm text-slate-400">در حال بارگذاری...</div>
          ) : error ? (
            <div role="alert" className="py-16 text-center text-sm font-bold text-rose-600">{error}</div>
          ) : visibleMessages.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              {messages.length > 0 ? 'پیامی با این جستجو یا فیلتر پیدا نشد.' : box === 'inbox' ? 'پیامی دریافت نشده است.' : box === 'archived' ? 'پیام بایگانی‌شده‌ای وجود ندارد.' : 'هنوز پیامی نفرستاده‌اید.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {visibleMessages.map((m) => {
                const unreadRow = box === 'inbox' && !m.isRead;
                return (
                  <li key={m.id} className="relative">
                    <button
                      type="button"
                      onClick={() => openMessage(m)}
                      className={`w-full text-right rounded-2xl border p-3.5 pl-20 transition cursor-pointer hover:shadow-sm ${unreadRow ? 'bg-white border-teal-300' : 'bg-white/70 border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {unreadRow && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" aria-label="خوانده‌نشده" />}
                          <span className={`text-sm truncate ${unreadRow ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>
                            {box === 'sent' || m.isMine ? `به: ${m.recipients.map((r) => r.name).join('، ')}` : m.senderName}
                          </span>
                          {!m.isMine && m.senderRole && <span className="text-[10px] text-slate-400 shrink-0">{ROLE_LABEL[m.senderRole] || ''}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.studentId && <GraduationCap className="w-3.5 h-3.5 text-violet-500" aria-label="درباره دانش‌آموز" />}
                          {m.attachments.length > 0 && <Paperclip className="w-3.5 h-3.5 text-slate-400" />}
                          <PriorityChip p={m.priority} />
                        </div>
                      </div>
                      <div className={`text-xs mt-1 truncate ${unreadRow ? 'font-extrabold text-slate-800' : 'text-slate-600'}`}>{m.subject}</div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-[11px] text-slate-400">{formatWhen(m.createdAt)}</span>
                        {m.isMine && <ReadReceipt recipients={m.recipients} variant="chip" />}
                      </div>
                    </button>
                    <div className="absolute left-2 top-2 flex items-center gap-0.5">
                      <button type="button" onClick={() => setFlag(m, { starred: !m.starred })} aria-pressed={Boolean(m.starred)} aria-label="ستاره‌دار" className={`p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer ${m.starred ? 'text-amber-500' : 'text-slate-300'}`}>
                        <Star className="w-4 h-4" fill={m.starred ? 'currentColor' : 'none'} />
                      </button>
                      <button type="button" onClick={() => setFlag(m, { archived: box !== 'archived' })} aria-label={box === 'archived' ? 'بازگردانی' : 'بایگانی'} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-slate-600 cursor-pointer">
                        {box === 'archived' ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                      </button>
                    </div>
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
