import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Send, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { apiRequest } from '../lib/serverSync';
import { getTodayShamsi } from '../utils/persianDate';
import { monthKeyOf } from '../utils/attendanceStats';
import { studentFullName } from '../utils/studentName';
import type { Student } from '../types';

export type GenericReferralKind = 'warning' | 'attention';

const refId = (studentId: string, kind: string, monthKey: string) => `ref-${studentId}-${kind}-${monthKey.replace('/', '-')}`;

/** فهرست ارجاع‌های ثبت‌شده؛ یک‌بار برای همه‌ی دکمه‌ها بارگذاری می‌شود */
let cache: Set<string> | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const load = () => {
  if (!inflight) {
    inflight = apiRequest<{ referrals: string[] }>('GET', '/api/referrals')
      .then((r) => { cache = new Set(r.referrals || []); })
      .catch(() => { cache = cache || new Set(); })
      .finally(() => { inflight = null; listeners.forEach((l) => l()); });
  }
};

function useReferred(enabled: boolean): Set<string> {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    if (!cache) load();
    return () => { listeners.delete(l); };
  }, [enabled]);
  return cache || new Set();
}

interface Props {
  student: Student;
  kind: GenericReferralKind;
  /** خلاصه‌ی دلیل ارجاع که برای معاون تربیتی ارسال می‌شود */
  summary: string;
  compact?: boolean;
}

/** دکمه‌ی «ارجاع به معاون تربیتی» با توضیح اختیاری؛ فقط برای معاون انضباطی نمایش داده می‌شود */
export const ReferStudentButton: React.FC<Props> = ({ student, kind, summary, compact }) => {
  const { isDisciplinaryVice, showToast } = useSchool();
  const referred = useReferred(isDisciplinaryVice);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!isDisciplinaryVice) return null;

  const monthKey = monthKeyOf(getTodayShamsi().formattedDate);
  const id = refId(student.id, kind, monthKey);
  const done = referred.has(id);

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" /> ارجاع شد
      </span>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      await apiRequest('POST', '/api/referrals', { studentId: student.id, kind, month: monthKey, summary, note: note.trim() || undefined });
      cache = new Set(cache || []).add(id);
      listeners.forEach((l) => l());
      showToast('ارجاع به معاون تربیتی ثبت شد.', 'success');
      setOpen(false);
      setNote('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ثبت ارجاع ناموفق بود.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`inline-flex items-center gap-1 font-bold rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition cursor-pointer whitespace-nowrap ${compact ? 'text-[11px] px-2.5 py-1.5' : 'text-xs px-3 py-2'}`}
      >
        <Send className="w-3.5 h-3.5" /> ارجاع به معاون تربیتی
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-slate-900">ارجاع به معاون تربیتی</h3>
                <p className="text-xs text-slate-500 mt-1">{studentFullName(student)}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="text-[11px] text-slate-600 bg-slate-50 rounded-xl px-3 py-2 leading-6">{summary}</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="توضیح برای معاون تربیتی (اختیاری)"
              className="w-full text-sm bg-slate-50 rounded-2xl px-4 py-3 outline-none focus:bg-white focus:ring-4 focus:ring-violet-100"
            />
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="w-full h-11 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-4 h-4" /> ثبت ارجاع
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

/* ───────────── ارجاع گروهی ───────────── */

export interface BulkReferItem {
  student: Student;
  summary: string;
}

/** ارجاع چند دانش‌آموز با یک توضیح مشترک؛ ارجاع‌شده‌های همین ماه غیرفعال‌اند */
export const BulkReferButton: React.FC<{ items: BulkReferItem[]; kind: GenericReferralKind; label?: string }> = ({ items, kind, label = 'ارجاع گروهی' }) => {
  const { isDisciplinaryVice, showToast } = useSchool();
  const referred = useReferred(isDisciplinaryVice);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const monthKey = monthKeyOf(getTodayShamsi().formattedDate);
  const isDone = (s: Student) => referred.has(refId(s.id, kind, monthKey));
  const pending = items.filter((i) => !isDone(i.student));

  useEffect(() => {
    if (open) { setPicked(new Set(pending.map((i) => i.student.id))); setNote(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!isDisciplinaryVice || items.length === 0) return null;

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = async () => {
    const chosen = pending.filter((i) => picked.has(i.student.id));
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const created: string[] = [];
      for (let i = 0; i < chosen.length; i += 100) {
        const res = await apiRequest<{ created: string[]; duplicates: string[] }>('POST', '/api/referrals/bulk', {
          kind,
          month: monthKey,
          note: note.trim() || undefined,
          items: chosen.slice(i, i + 100).map((x) => ({ studentId: x.student.id, summary: x.summary })),
        });
        const done = [...(res.created || []), ...(res.duplicates || [])];
        created.push(...(res.created || []));
        cache = new Set([...(cache || []), ...done.map((id) => refId(id, kind, monthKey))]);
        listeners.forEach((l) => l());
      }
      showToast(`${created.length} ارجاع به معاون تربیتی ثبت شد.`, 'success');
      setOpen(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ثبت ارجاع ناموفق بود.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending.length === 0}
        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white transition cursor-pointer whitespace-nowrap"
      >
        <Send className="w-3.5 h-3.5" /> {label}
        {pending.length > 0 && <span className="bg-white/25 rounded-full px-1.5">{pending.length}</span>}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-2 p-6 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900">ارجاع گروهی به معاون تربیتی</h3>
                <p className="text-xs text-slate-500 mt-1">دانش‌آموزان را انتخاب کنید؛ توضیح زیر برای همه ارسال می‌شود.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 flex items-center gap-3 text-[11px] font-bold">
              <button type="button" onClick={() => setPicked(new Set(pending.map((i) => i.student.id)))} className="text-violet-700 cursor-pointer">انتخاب همه</button>
              <button type="button" onClick={() => setPicked(new Set())} className="text-slate-500 cursor-pointer">هیچ‌کدام</button>
              <span className="mr-auto text-slate-500">{picked.size} انتخاب‌شده</span>
            </div>
            <ul className="flex-1 overflow-y-auto px-6 py-2 divide-y divide-slate-100">
              {items.map((i) => {
                const done = isDone(i.student);
                return (
                  <li key={i.student.id}>
                    <label className={`flex items-start gap-3 py-2.5 ${done ? 'opacity-50' : 'cursor-pointer'}`}>
                      <input type="checkbox" disabled={done} checked={!done && picked.has(i.student.id)} onChange={() => toggle(i.student.id)} className="mt-1 accent-violet-600" />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900">{studentFullName(i.student)} {done && <em className="text-[10px] text-emerald-700 not-italic">(قبلاً ارجاع شده)</em>}</span>
                        <span className="block text-[11px] text-slate-500 leading-5">{i.summary}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="p-6 pt-3 space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="توضیح مشترک برای معاون تربیتی (اختیاری)"
                className="w-full text-sm bg-slate-50 rounded-2xl px-4 py-3 outline-none focus:bg-white focus:ring-4 focus:ring-violet-100"
              />
              <button
                type="button"
                disabled={busy || picked.size === 0}
                onClick={submit}
                className="w-full h-11 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" /> ارجاع {picked.size} دانش‌آموز
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
