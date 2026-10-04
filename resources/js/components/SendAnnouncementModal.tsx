import React, { useMemo, useState } from 'react';
import { X, Send, Loader2, Search } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { apiRequest, ApiError } from '../lib/serverSync';
import { toPersianDigits } from '../utils/persianDate';

type Audience = 'all' | 'selected' | 'single';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const AUDIENCES: { key: Audience; label: string }[] = [
  { key: 'all', label: 'همه معلمان و مربیان' },
  { key: 'selected', label: 'انتخاب چند نفر' },
  { key: 'single', label: 'یک کاربر خاص' },
];

/** ارسال اطلاعیه توسط مدیر مدرسه به همه، چند نفر یا یک کاربر */
export const SendAnnouncementModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { allTeachers, allCoaches, showToast, currentUser } = useSchool();

  const staff = useMemo(() => {
    const map = new Map<string, { id: string; name: string; roleLabel: string }>();
    [...allTeachers, ...allCoaches].forEach((u) => {
      if (u.isActive === false || u.id === currentUser.id) return;
      const existing = map.get(u.id);
      const roleLabel = u.role === 'coach' ? 'مربی' : 'دبیر';
      map.set(u.id, { id: u.id, name: u.name, roleLabel: existing ? 'دبیر و مربی' : roleLabel });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  }, [allTeachers, allCoaches, currentUser.id]);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [audience, setAudience] = useState<Audience>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [single, setSingle] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const filtered = staff.filter((u) => !query.trim() || u.name.includes(query.trim()));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const reset = () => {
    setTitle('');
    setMessage('');
    setPriority('normal');
    setAudience('all');
    setSelected(new Set());
    setSingle('');
    setQuery('');
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (title.trim().length < 2) return setError('عنوان اطلاعیه را وارد کنید.');
    if (message.trim().length < 2) return setError('متن اطلاعیه را وارد کنید.');
    const userIds = audience === 'selected' ? Array.from(selected) : audience === 'single' && single ? [single] : [];
    if (audience !== 'all' && userIds.length === 0) return setError('حداقل یک مخاطب انتخاب کنید.');

    setSending(true);
    setError('');
    try {
      const res = await apiRequest<{ count: number }>('POST', '/api/notifications', {
        audience,
        userIds,
        priority,
        title: title.trim(),
        message: message.trim(),
      });
      showToast(`اطلاعیه برای ${toPersianDigits(res.count)} نفر ارسال شد.`, 'success');
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'ارسال اطلاعیه انجام نشد. دوباره تلاش کنید.');
    } finally {
      setSending(false);
    }
  };

  const fieldClass =
    'w-full text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 outline-none transition';

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
      <form
        onSubmit={submit}
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
          <h3 className="text-base font-extrabold text-slate-900">ارسال اطلاعیه جدید</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-4 space-y-3.5 overflow-y-auto flex-1 min-h-0">
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">عنوان پیام</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">متن کامل اطلاعیه</span>
            <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={`${fieldClass} resize-none`} />
          </label>

          <div>
            <div className="text-[11px] font-bold text-slate-500 mb-1.5">اولویت</div>
            <div className="flex gap-2">
              {([
                ['normal', 'عادی', 'bg-sky-50 text-sky-800 border-sky-200 ring-sky-300'],
                ['urgent', 'فوری', 'bg-rose-50 text-rose-800 border-rose-200 ring-rose-300'],
              ] as const).map(([key, label, cls]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={priority === key}
                  onClick={() => setPriority(key)}
                  className={`flex-1 px-3 py-2 rounded-2xl text-xs font-bold border transition cursor-pointer ${cls} ${
                    priority === key ? 'ring-2' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-500 mb-1.5">مخاطبین</div>
            <div className="grid grid-cols-3 gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={audience === a.key}
                  onClick={() => setAudience(a.key)}
                  className={`px-2 py-2.5 rounded-2xl text-[11px] font-bold border transition cursor-pointer leading-snug ${
                    audience === a.key
                      ? 'bg-emerald-100/70 text-emerald-900 border-emerald-300 ring-2 ring-emerald-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {audience === 'all' && (
              <p className="mt-2 text-[11px] text-slate-500">
                اطلاعیه برای {toPersianDigits(staff.length)} معلم و مربی فعال ارسال می‌شود.
              </p>
            )}

            {audience !== 'all' && (
              <div className="mt-2.5 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="جستجوی نام..."
                    className={`${fieldClass} pr-9`}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100">
                  {filtered.map((u) => (
                    <label key={u.id} className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-slate-50 text-sm">
                      {audience === 'selected' ? (
                        <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} className="w-4 h-4 accent-emerald-600" />
                      ) : (
                        <input type="radio" name="single-user" checked={single === u.id} onChange={() => setSingle(u.id)} className="w-4 h-4 accent-emerald-600" />
                      )}
                      <span className="flex-1 font-bold text-slate-800">{u.name}</span>
                      <span className="text-[11px] text-slate-400">{u.roleLabel}</span>
                    </label>
                  ))}
                  {filtered.length === 0 && <div className="py-6 text-center text-xs text-slate-400">موردی یافت نشد.</div>}
                </div>
                {audience === 'selected' && (
                  <p className="text-[11px] text-slate-500">{toPersianDigits(selected.size)} نفر انتخاب شده است.</p>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          <button
            type="submit"
            disabled={sending}
            className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-extrabold rounded-2xl shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            <span>{sending ? 'در حال ارسال...' : 'ارسال اطلاعیه'}</span>
          </button>
          <button type="button" onClick={onClose} className="h-12 px-5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-2xl cursor-pointer">
            انصراف
          </button>
        </div>
      </form>
    </div>
  );
};
