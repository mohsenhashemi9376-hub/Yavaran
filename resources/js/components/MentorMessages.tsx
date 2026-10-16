import { createPortal } from 'react-dom';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { apiRequest, ApiError } from '../lib/serverSync';
import { dateToShamsiString, toPersianDigits } from '../utils/persianDate';
import { Plus, X, Send, Check, Loader2, AlertCircle } from 'lucide-react';

type Priority = 'urgent' | 'important' | 'normal';

interface MentorMessage {
  id: number;
  priority: Priority;
  title: string;
  content: string;
  createdAt: string | null;
}

interface SentMessage extends MentorMessage {
  targetType: 'all' | 'single';
  targetMentorId: string | null;
  recipients: { mentorId: string; name: string; acknowledgedAt: string | null }[];
}

const PRIORITY_META: Record<Priority, { label: string; emoji: string; bar: string; active: string }> = {
  urgent: { label: 'فوری', emoji: '🔴', bar: 'bg-rose-500', active: 'bg-rose-50 text-rose-700 ring-2 ring-rose-300' },
  important: { label: 'مهم', emoji: '🟡', bar: 'bg-amber-400', active: 'bg-amber-50 text-amber-700 ring-2 ring-amber-300' },
  normal: { label: 'عادی', emoji: '🟢', bar: 'bg-emerald-500', active: 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-300' },
};

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return toPersianDigits(`${dateToShamsiString(d)} ${time}`);
};

const fieldClass =
  'w-full text-base bg-slate-50 rounded-2xl px-4 py-3 text-slate-900 outline-none border border-transparent focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 transition';

/* ------------------------------------------------------------------ */
/* پنل معاون تربیتی: ارسال پیام و مشاهده وضعیت تأیید مربیان              */
/* ------------------------------------------------------------------ */
const VicePanel: React.FC<{ glass?: boolean }> = ({ glass }) => {
  const { allCoaches, showToast } = useSchool();
  const [messages, setMessages] = useState<SentMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [targetType, setTargetType] = useState<'all' | 'single'>('all');
  const [targetMentorId, setTargetMentorId] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => {
    apiRequest<{ messages: SentMessage[] }>('GET', '/api/mentor-messages/sent')
      .then((res) => setMessages(res.messages || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const open = () => openModalRef.current();
    window.addEventListener('yv:new-mentor-message', open);
    return () => window.removeEventListener('yv:new-mentor-message', open);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const openModalRef = useRef<() => void>(() => undefined);
  const openModal = () => {
    setTargetType('all');
    setTargetMentorId('');
    setPriority('normal');
    setContent('');
    setError(null);
    setIsOpen(true);
  };
  openModalRef.current = openModal;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    if (!content.trim()) {
      setError('متن پیام را بنویسید.');
      return;
    }
    if (targetType === 'single' && !targetMentorId) {
      setError('مربی گیرنده را انتخاب کنید.');
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await apiRequest('POST', '/api/mentor-messages', {
        targetType,
        targetMentorId: targetType === 'single' ? targetMentorId : null,
        priority,
        content: content.trim(),
      });
      showToast('پیام برای مربیان ارسال شد.', 'success');
      setIsOpen(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ارسال پیام انجام نشد.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className={glass
        ? 'rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white/70 to-indigo-50/70 shadow-sm backdrop-blur-sm p-4 sm:p-5 space-y-4'
        : 'bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5 space-y-4'}
      dir="rtl"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
          {glass && <Send className="w-4 h-4 text-sky-600" />}
          {glass ? 'مأموریت‌ها و پیام‌ها به مربیان' : 'آخرین مأموریت‌ها و پیام‌ها'}
        </h2>
        <button
          type="button"
          onClick={openModal}
          className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl flex items-center gap-1 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>پیام جدید</span>
        </button>
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">هنوز پیامی ارسال نشده است.</p>
      ) : (
        <div className="space-y-3">
          {(showAll ? messages : messages.slice(0, 3)).map((m) => {
            const meta = PRIORITY_META[m.priority] || PRIORITY_META.normal;
            const ackCount = m.recipients.filter((r) => r.acknowledgedAt).length;
            return (
              <div key={m.id} className={`relative ${glass ? 'bg-white/80 border border-sky-100' : 'bg-slate-50/70'} rounded-xl p-4 pr-5 space-y-2.5 overflow-hidden`}>
                <span className={`absolute right-0 top-0 bottom-0 w-1.5 ${meta.bar}`} />
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-line">{m.content}</p>
                  <span className="text-[11px] text-slate-400 shrink-0">{formatDate(m.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
                  <span className="text-slate-500">
                    {m.targetType === 'all' ? 'همه مربیان' : m.recipients[0]?.name || 'یک مربی'} • {toPersianDigits(ackCount)} از {toPersianDigits(m.recipients.length)} تأیید
                  </span>
                  {m.recipients.map((r) => (
                    <span
                      key={r.mentorId}
                      className={`px-2 py-0.5 rounded-full ${
                        r.acknowledgedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-400 border border-slate-200'
                      }`}
                      title={r.acknowledgedAt ? `تأیید: ${formatDate(r.acknowledgedAt.replace(' ', 'T'))}` : 'هنوز تأیید نکرده'}
                    >
                      {r.acknowledgedAt ? '✓ ' : ''}
                      {r.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {messages.length > 3 && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full h-9 text-xs font-bold text-emerald-700 cursor-pointer">
              {showAll ? 'نمایش کمتر ↑' : `مشاهده همه (${toPersianDigits(messages.length)}) ←`}
            </button>
          )}
        </div>
      )}

      {isOpen && createPortal(
        <>
          <div className="fixed inset-0 bg-black/60 z-[90]" aria-hidden="true" />
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
            dir="rtl"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col overflow-hidden font-['Vazirmatn',sans-serif]">
              <div className="px-5 pt-5 pb-2 flex items-center justify-between shrink-0">
                <h3 className="text-base font-extrabold text-slate-900">پیام یا مأموریت جدید به مربیان</h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
                  aria-label="بستن"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="mentor-message-form" onSubmit={handleSend} className="px-5 pb-4 pt-2 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {error && (
                  <div role="alert" className="p-3 rounded-2xl bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">گیرنده</label>
                  <select
                    value={targetType === 'all' ? 'all' : targetMentorId}
                    onChange={(e) => {
                      if (e.target.value === 'all') {
                        setTargetType('all');
                        setTargetMentorId('');
                      } else {
                        setTargetType('single');
                        setTargetMentorId(e.target.value);
                      }
                    }}
                    className={fieldClass}
                  >
                    <option value="all">همه مربیان</option>
                    {allCoaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">اولویت</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`h-12 rounded-2xl text-sm font-extrabold transition cursor-pointer ${
                          priority === p ? PRIORITY_META[p].active : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {PRIORITY_META[p].emoji} {PRIORITY_META[p].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">متن پیام</label>
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="پیام یا مأموریت را بنویسید..."
                    className={`${fieldClass} resize-none`}
                  />
                </div>
              </form>

              {/* دکمه‌ی ارسال همیشه پایین پنجره دیده می‌شود (نیازی به اسکرول نیست) */}
              <div className="shrink-0 border-t border-slate-100 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
                <button
                  type="submit"
                  form="mentor-message-form"
                  disabled={isSending}
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold rounded-2xl shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  <span>ارسال</span>
                </button>
                <button type="button" onClick={() => setIsOpen(false)} className="h-12 px-5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* داشبورد مربی: پیام‌های فعال با تأیید تک‌کلیکی                        */
/* ------------------------------------------------------------------ */
const CoachCard: React.FC = () => {
  const { showToast } = useSchool();
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [leaving, setLeaving] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    apiRequest<{ messages: MentorMessage[] }>('GET', '/api/mentor-messages/active')
      .then((res) => setMessages(res.messages || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const acknowledge = async (id: number) => {
    setLeaving((prev) => new Set(prev).add(id));
    try {
      await apiRequest('POST', `/api/mentor-messages/${id}/acknowledge`);
      setTimeout(() => setMessages((prev) => prev.filter((m) => m.id !== id)), 250);
    } catch (err) {
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showToast(err instanceof ApiError ? err.message : 'ثبت تأیید انجام نشد.', 'error');
    }
  };

  if (messages.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50 p-5 space-y-3" dir="rtl">
      <h2 className="text-base font-extrabold text-slate-900">پیام‌های معاونت تربیتی</h2>
      <div className="space-y-3">
        {messages.map((m) => {
          const meta = PRIORITY_META[m.priority] || PRIORITY_META.normal;
          return (
            <div
              key={m.id}
              className={`relative bg-slate-50/70 rounded-xl p-4 pr-5 overflow-hidden transition-all duration-200 ${
                leaving.has(m.id) ? 'opacity-0 scale-95' : 'opacity-100'
              }`}
            >
              <span className={`absolute right-0 top-0 bottom-0 w-1.5 ${meta.bar}`} />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-line">{m.content}</p>
                  <span className="text-[11px] text-slate-400 mt-1 inline-block">
                    {meta.label} • {formatDate(m.createdAt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => acknowledge(m.id)}
                  disabled={leaving.has(m.id)}
                  className="h-11 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0 disabled:opacity-60"
                >
                  <span>متوجه شدم</span>
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const MentorMessagesSection: React.FC<{ glass?: boolean }> = ({ glass }) => {
  const { isNurturingVice, isCoach } = useSchool();
  if (isNurturingVice) return <VicePanel glass={glass} />;
  if (isCoach) return <CoachCard />;
  return null;
};
