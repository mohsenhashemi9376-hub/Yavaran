import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, FilePlus2, List, Pencil, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/serverSync';
import { dateToShamsiString, toPersianDigits } from '../utils/persianDate';

interface AuditRow {
  id: number;
  userId: string;
  userName: string;
  userRole: string;
  action: 'view' | 'list' | 'create' | 'update' | 'delete' | string;
  collection: string;
  studentId: string | null;
  studentName: string | null;
  targetName?: string | null;
  allowed: boolean;
  items: number | null;
  ip: string | null;
  createdAt: string | null;
}

const ACTIONS: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
  view: { label: 'مشاهده پرونده', icon: Eye, tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  list: { label: 'دریافت فهرست', icon: List, tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  create: { label: 'ثبت', icon: FilePlus2, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  update: { label: 'ویرایش', icon: Pencil, tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  delete: { label: 'حذف', icon: Trash2, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const COLLECTIONS: Record<string, string> = {
  observations: 'مشاهده رفتاری',
  nurturingDossiers: 'پرونده تربیتی',
  coachEvaluations: 'ارزیابی رشد',
  users: 'حساب کاربری',
};

const ROLES: Record<string, string> = {
  admin: 'مدیر سامانه',
  vice_nurturing: 'معاون تربیتی',
  vice_educational: 'معاون آموزشی',
  vice_disciplinary: 'معاون انضباطی',
  vice_principal: 'معاون مدرسه',
  coach: 'مربی',
  teacher: 'دبیر',
};

const formatWhen = (iso: string | null) => {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: toPersianDigits(dateToShamsiString(d)),
    time: toPersianDigits(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`),
  };
};

/** گزارش دسترسی به پرونده‌های تربیتی و مشاهدات رفتاری (فقط معاون تربیتی؛ فقط‌خواندنی) */
export const NurturingAuditLog: React.FC = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyDenied, setOnlyDenied] = useState(false);
  const [onlyWrites, setOnlyWrites] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ logs: AuditRow[] }>('GET', '/api/nurturing-audit');
      setRows(res.logs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت گزارش.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const denied = useMemo(() => rows.filter((r) => !r.allowed).length, [rows]);
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (onlyDenied && r.allowed) return false;
        if (onlyWrites && !['create', 'update', 'delete'].includes(r.action)) return false;
        return true;
      }),
    [rows, onlyDenied, onlyWrites]
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-black text-slate-900">گزارش دسترسی به پرونده‌های تربیتی</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              هر مشاهده، ثبت، ویرایش و حذف و هر تلاش ردشده ثبت می‌شود. این گزارش قابل ویرایش یا حذف نیست.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border border-slate-200"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>تازه‌سازی</span>
        </button>
      </div>

      {denied > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-l from-rose-50 to-white p-4 flex items-center gap-3" role="alert">
          <span className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="text-xs">
            <div className="font-black text-rose-800">{toPersianDigits(denied)} تلاش دسترسی ردشده ثبت شده است</div>
            <div className="text-rose-700/90 mt-0.5">برای بررسی، فیلتر «فقط تلاش‌های ردشده» را بزنید.</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center gap-2 flex-wrap text-xs font-bold">
          {([
            ['فقط تلاش‌های ردشده', onlyDenied, setOnlyDenied],
            ['فقط ثبت / ویرایش / حذف', onlyWrites, setOnlyWrites],
          ] as const).map(([label, active, set]) => (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              onClick={() => set(!active)}
              className={`px-3.5 py-2 rounded-xl border cursor-pointer transition ${
                active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="mr-auto text-slate-400 font-medium">{toPersianDigits(visible.length)} مورد (آخرین ۵۰۰ رویداد)</span>
        </div>

        {error ? (
          <div className="py-12 text-center text-xs font-bold text-rose-700">{error}</div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">{loading ? 'در حال دریافت...' : 'رویدادی ثبت نشده است.'}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((r) => {
              const a = ACTIONS[r.action] || { label: r.action, icon: Eye, tone: 'bg-slate-100 text-slate-700 border-slate-200' };
              const Icon = a.icon;
              const when = formatWhen(r.createdAt);
              return (
                <li key={r.id} className={`px-4 py-3 flex items-start gap-3 ${r.allowed ? '' : 'bg-rose-50/60'}`}>
                  <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${r.allowed ? a.tone : 'bg-rose-100 text-rose-700 border-rose-200'}`}>
                    {r.allowed ? <Icon className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </span>
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900">{r.userName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">{ROLES[r.userRole] || r.userRole}</span>
                      {!r.allowed && <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">ردشد (۴۰۳)</span>}
                    </div>
                    <div className="mt-1 text-slate-600">
                      {a.label} • {COLLECTIONS[r.collection] || r.collection}
                      {r.studentName ? <> • دانش‌آموز: <b className="text-slate-800">{r.studentName}</b></> : null}
                      {r.collection === 'users' && r.targetName ? <> • حساب: <b className="text-slate-800">{r.targetName}</b></> : null}
                      {r.action === 'list' && r.items !== null ? ` • ${toPersianDigits(r.items)} رکورد` : ''}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400 font-mono" dir="ltr">
                      {when.date} {when.time} • {r.ip || '—'}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
