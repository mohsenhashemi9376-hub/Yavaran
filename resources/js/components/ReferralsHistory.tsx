import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock, Inbox, Search, X } from 'lucide-react';
import { apiRequest } from '../lib/serverSync';
import { toPersianDigits } from '../utils/persianDate';

export interface ReferralRecord {
  refId: string;
  studentId: string;
  studentName: string;
  className: string;
  kind: 'absence' | 'delay' | 'warning' | 'attention';
  month: string;
  title: string;
  message: string;
  senderName: string;
  seen: boolean;
  createdAt: string;
}

export const REFERRAL_KIND_LABEL: Record<ReferralRecord['kind'], string> = {
  absence: 'غیبت غیرموجه',
  delay: 'تأخیر مکرر',
  warning: 'هشدار انضباطی',
  attention: 'نیازمند توجه',
};

const KIND_TONE: Record<ReferralRecord['kind'], string> = {
  absence: 'bg-rose-50 text-rose-700 border-rose-200',
  delay: 'bg-amber-50 text-amber-700 border-amber-200',
  warning: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  attention: 'bg-violet-50 text-violet-700 border-violet-200',
};

const fmtDate = (iso: string) => {
  try { return new Date(iso.replace(' ', 'T') + (iso.includes('Z') || iso.includes('+') ? '' : 'Z')).toLocaleDateString('fa-IR'); } catch { return ''; }
};

/** متن ارجاع: بخش «خلاصه» و «توضیح» از پیام اعلان جدا می‌شود */
const split = (message: string) => {
  const [head, noteRaw] = message.split('\n\nتوضیح: ');
  const lines = head.split('\n');
  return { summary: lines.slice(1).join(' ').trim(), note: (noteRaw || '').trim() };
};

function useReferralHistory(studentId?: string, enabled = true, refreshKey?: unknown) {
  const [items, setItems] = useState<ReferralRecord[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setItems(null);
    setError(false);
    apiRequest<{ referrals: ReferralRecord[] }>('GET', `/api/referrals/history${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`)
      .then((r) => alive && setItems(r.referrals || []))
      .catch(() => alive && (setError(true), setItems([])));
    return () => { alive = false; };
  }, [studentId, enabled, refreshKey]);
  return { items, error };
}

const Card: React.FC<{ r: ReferralRecord; showStudent: boolean }> = ({ r, showStudent }) => {
  const { summary, note } = split(r.message);
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {showStudent && <span className="text-sm font-black text-slate-900">{r.studentName}</span>}
        {showStudent && r.className && <span className="text-[11px] text-slate-500">{r.className}</span>}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${KIND_TONE[r.kind]}`}>{REFERRAL_KIND_LABEL[r.kind]}</span>
        <span className={`mr-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${r.seen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {r.seen ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {r.seen ? 'دیده شد' : 'در انتظار بررسی'}
        </span>
      </div>
      {summary && <p className="text-xs text-slate-700 leading-6">{summary}</p>}
      {note && <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 leading-6"><b>توضیح:</b> {note}</p>}
      <div className="text-[10px] text-slate-400 flex gap-3">
        {r.senderName && <span>ارجاع‌دهنده: {r.senderName}</span>}
        <span>{toPersianDigits(fmtDate(r.createdAt))}</span>
      </div>
    </li>
  );
};

/** دکمه + پنجره‌ی فهرست ارجاع‌ها برای معاون انضباطی (ارسالی‌ها) و معاون تربیتی (دریافتی‌ها) */
export const ReferralsHistoryButton: React.FC<{
  label?: string;
  /** اگر داده شود به‌جای دکمه‌ی پیش‌فرض، این کاشی نمایش داده می‌شود (با شمار کل و بررسی‌نشده‌ها) */
  renderTrigger?: (info: { open: () => void; total: number; unseen: number }) => React.ReactNode;
}> = ({ label = 'فهرست ارجاع‌ها', renderTrigger }) => {
  const [open, setOpen] = useState(false);
  const { items, error } = useReferralHistory(undefined, open || !!renderTrigger, open);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | ReferralRecord['kind']>('all');
  const [seen, setSeen] = useState<'all' | 'seen' | 'unseen'>('all');
  const [month, setMonth] = useState('all');

  const months = useMemo(() => [...new Set((items || []).map((r) => r.month))].sort().reverse(), [items]);
  const filtered = useMemo(() => (items || []).filter((r) => {
    if (kind !== 'all' && r.kind !== kind) return false;
    if (seen === 'seen' && !r.seen) return false;
    if (seen === 'unseen' && r.seen) return false;
    if (month !== 'all' && r.month !== month) return false;
    const n = q.trim();
    return !n || `${r.studentName} ${r.className} ${r.message}`.includes(n);
  }), [items, kind, seen, month, q]);

  const sel = 'text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none';
  return (
    <>
      {renderTrigger ? renderTrigger({ open: () => setOpen(true), total: (items || []).length, unseen: (items || []).filter((r) => !r.seen).length }) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 cursor-pointer whitespace-nowrap">
          <Inbox className="w-4 h-4" /> {label}
        </button>
      )}
      {open && createPortal(
        <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" dir="rtl" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-4 bg-white border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2"><Inbox className="w-5 h-5 text-violet-600" /> فهرست ارجاع‌ها</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 flex flex-wrap gap-2 bg-white border-b border-slate-100">
              <div className="relative flex-1 min-w-[150px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی دانش‌آموز، کلاس یا متن…" className={`${sel} w-full pr-9`} />
              </div>
              <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={sel} aria-label="نوع">
                <option value="all">همه انواع</option>
                {Object.entries(REFERRAL_KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select value={seen} onChange={(e) => setSeen(e.target.value as typeof seen)} className={sel} aria-label="وضعیت">
                <option value="all">همه وضعیت‌ها</option>
                <option value="unseen">در انتظار بررسی</option>
                <option value="seen">دیده‌شده</option>
              </select>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className={sel} aria-label="ماه">
                <option value="all">همه ماه‌ها</option>
                {months.map((m) => <option key={m} value={m}>{toPersianDigits(m)}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {items === null ? (
                <p className="text-center text-xs text-slate-500 py-10">در حال بارگذاری…</p>
              ) : error ? (
                <p className="text-center text-xs text-rose-600 py-10">دریافت فهرست ناموفق بود.</p>
              ) : filtered.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-10">ارجاعی یافت نشد.</p>
              ) : (
                <ul className="space-y-2.5">{filtered.map((r) => <Card key={r.refId} r={r} showStudent />)}</ul>
              )}
            </div>
            {items && items.length > 0 && <div className="px-5 py-2.5 bg-white border-t border-slate-100 text-[11px] text-slate-500">{toPersianDigits(filtered.length)} از {toPersianDigits(items.length)} ارجاع</div>}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

/** سابقه‌ی ارجاع‌های یک دانش‌آموز برای پرونده‌ی تربیتی؛ اگر ارجاعی نبود چیزی نمایش نمی‌دهد */
export const StudentReferralsCard: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { items } = useReferralHistory(studentId);
  if (!items || items.length === 0) return null;
  return (
    <section className="bg-white rounded-2xl border border-violet-200 shadow-xs p-5 space-y-3">
      <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
        <Inbox className="w-4 h-4 text-violet-600" /> ارجاع‌های معاون انضباطی
        <span className="text-[11px] font-bold text-violet-700 bg-violet-50 rounded-full px-2">{toPersianDigits(items.length)}</span>
      </h3>
      <ul className="space-y-2">{items.map((r) => <Card key={r.refId} r={r} showStudent={false} />)}</ul>
    </section>
  );
};
