import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, FilePlus2, List, LogOut, Pencil, RefreshCw, ShieldCheck, Trash2, UserX, Users } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { ApiError, apiRequest } from '../lib/serverSync';
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
  recordId?: string | null;
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
  alert: { label: 'هشدار امنیتی', icon: AlertTriangle, tone: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const ALERT_TYPES: Record<string, string> = {
  new_device: 'ورود از دستگاه جدید',
  off_hours: 'دسترسی خارج از ساعت مدرسه',
  bulk_read: 'باز کردن انبوه پرونده‌ها',
  failed_logins: 'تلاش‌های ناموفق پیاپی برای ورود',
  lockout: 'قفل شدن حساب پس از تلاش ناموفق',
};

const COLLECTIONS: Record<string, string> = {
  observations: 'مشاهده رفتاری',
  nurturingDossiers: 'پرونده تربیتی',
  coachEvaluations: 'ارزیابی رشد',
  users: 'حساب کاربری',
  security: 'امنیت حساب',
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
const EventsView: React.FC = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyDenied, setOnlyDenied] = useState(false);
  const [onlyWrites, setOnlyWrites] = useState(false);
  const [integrity, setIntegrity] = useState<{ ok: boolean; checked: number; unprotected: number; brokenAt: number | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ logs: AuditRow[]; integrity?: { ok: boolean; checked: number; unprotected: number; brokenAt: number | null } | null }>('GET', '/api/nurturing-audit');
      setRows(res.logs || []);
      setIntegrity(res.integrity ?? null);
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

      {integrity && (integrity.ok ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs font-bold text-emerald-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>یکپارچگی گزارش تأیید شد: {toPersianDigits(integrity.checked)} رکورد زنجیره‌ای بدون دست‌کاری.</span>
        </div>
      ) : (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs flex items-center gap-3" role="alert">
          <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0" />
          <div>
            <div className="font-black text-rose-800">هشدار: در گزارش دسترسی‌ها دست‌کاری یا حذف رکورد تشخیص داده شد</div>
            <div className="text-rose-700/90 mt-0.5">اولین ناهماهنگی در رکورد شماره‌ی {toPersianDigits(integrity.brokenAt ?? 0)}. موضوع را فوراً به مدیر فنی سامانه اطلاع دهید.</div>
          </div>
        </div>
      ))}

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
                      {!r.allowed && r.action !== 'alert' && <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">ردشد (۴۰۳)</span>}
                      {r.action === 'alert' && <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">هشدار</span>}
                    </div>
                    <div className="mt-1 text-slate-600">
                      {r.action === 'alert' ? (ALERT_TYPES[r.recordId || ''] || 'هشدار امنیتی') : `${a.label} • ${COLLECTIONS[r.collection] || r.collection}`}
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


interface ReviewAccount {
  id: string;
  name: string;
  username: string | null;
  role: string;
  isActive: boolean;
  twoFactor: boolean;
  classes: string[];
  lastLoginAt: string | null;
  lastAccessAt: string | null;
  views30: number;
  denied30: number;
  alerts30: number;
  inactive30: boolean;
}

const ReviewView: React.FC = () => {
  const { updateUser, showConfirm, currentUser } = useSchool();
  const [accounts, setAccounts] = useState<ReviewAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ accounts: ReviewAccount[] }>('GET', '/api/nurturing-audit/review');
      setAccounts(res.accounts || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت گزارش.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deactivate = (a: ReviewAccount) =>
    showConfirm({
      title: 'غیرفعال‌سازی حساب',
      message: `حساب «${a.name}» غیرفعال شود؟ دیگر نمی‌تواند وارد سامانه شود. هر زمان می‌توانید دوباره فعالش کنید.`,
      confirmLabel: 'غیرفعال کن',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => {
        updateUser(a.id, { isActive: false });
        setAccounts((prev) => prev.map((x) => (x.id === a.id ? { ...x, isActive: false, inactive30: false } : x)));
      },
    });

  const flagged = accounts.filter((a) => a.isActive && (a.inactive30 || !a.twoFactor)).length;

  // بستن فوری نشست‌ها (گم شدن دستگاه یا شک به نفوذ)؛ با رمز معاون تأیید می‌شود
  const [revokeTarget, setRevokeTarget] = useState<ReviewAccount | 'all' | null>(null);
  const [revokePassword, setRevokePassword] = useState('');
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeError, setRevokeError] = useState('');
  const [revokeDone, setRevokeDone] = useState('');

  const openRevoke = (target: ReviewAccount | 'all') => {
    setRevokeTarget(target);
    setRevokePassword('');
    setRevokeError('');
  };

  const submitRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTarget || revokeBusy || !revokePassword) return;
    setRevokeBusy(true);
    setRevokeError('');
    try {
      const res = await apiRequest<{ count: number }>('POST', '/api/nurturing/revoke-sessions', {
        password: revokePassword,
        ...(revokeTarget === 'all' ? { all: true } : { userId: revokeTarget.id }),
      });
      setRevokeDone(`نشست ${toPersianDigits(res.count)} حساب بسته شد؛ برای ادامه باید دوباره وارد شوند.`);
      setRevokeTarget(null);
      setRevokePassword('');
      load();
    } catch (err) {
      setRevokeError(err instanceof ApiError || err instanceof Error ? err.message : 'بستن نشست‌ها ممکن نشد.');
    } finally {
      setRevokeBusy(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-sm">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-black text-slate-900">بازبینی حساب‌ها</h2>
            <p className="text-xs text-slate-500 mt-0.5">مربیان و معاون تربیتی با کلاس‌ها، ورود دومرحله‌ای، آخرین ورود و میزان دسترسی به پرونده‌ها در ۳۰ روز اخیر.</p>
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
        <button
          type="button"
          onClick={() => openRevoke('all')}
          className="px-3.5 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>بستن نشست همه‌ی مربیان</span>
        </button>
      </div>

      {revokeDone && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs font-bold text-emerald-900" role="status">{revokeDone}</div>
      )}

      {revokeTarget && (
        <form onSubmit={submitRevoke} className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 space-y-3 text-xs" autoComplete="off">
          <div className="font-black text-rose-800">
            {revokeTarget === 'all' ? 'نشست همه‌ی مربیان و سایر معاونین تربیتی بسته شود؟' : `نشست «${revokeTarget.name}» بسته شود؟`}
          </div>
          <div className="text-slate-600 leading-6">کاربر فوراً از همه‌ی دستگاه‌ها خارج می‌شود و باید دوباره وارد شود. برای تأیید رمز عبور خودتان را وارد کنید.</div>
          {revokeError && <div role="alert" className="font-bold text-rose-700">{revokeError}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={revokePassword}
              onChange={(e) => setRevokePassword(e.target.value)}
              placeholder="رمز عبور شما"
              className="flex-1 min-w-[10rem] text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-rose-400"
            />
            <button type="submit" disabled={revokeBusy || !revokePassword} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-extrabold cursor-pointer">
              {revokeBusy ? 'در حال انجام…' : 'بستن نشست‌ها'}
            </button>
            <button type="button" onClick={() => setRevokeTarget(null)} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold cursor-pointer">انصراف</button>
          </div>
        </form>
      )}

      {flagged > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs font-bold text-amber-900 flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{toPersianDigits(flagged)} حساب نیاز به بازبینی دارد (بدون ورود در ۳۰ روز اخیر یا بدون ورود دومرحله‌ای).</span>
        </div>
      )}

      {error ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-xs font-bold text-rose-700">{error}</div>
      ) : accounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-xs text-slate-400">{loading ? 'در حال دریافت...' : 'حسابی یافت نشد.'}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {accounts.map((a) => {
            const warn = a.isActive && (a.inactive30 || !a.twoFactor);
            const when = (iso: string | null) => {
              const f = formatWhen(iso);
              return f.date ? `${f.date} ${f.time}` : 'هرگز';
            };
            return (
              <div key={a.id} className={`rounded-2xl border p-4 space-y-3 bg-white ${!a.isActive ? 'opacity-60 border-slate-200' : warn ? 'border-amber-300' : 'border-slate-200'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-slate-900">{a.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">{ROLES[a.role] || a.role}</span>
                  {!a.isActive && <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold">غیرفعال</span>}
                  {a.isActive && a.twoFactor && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">ورود دومرحله‌ای فعال</span>}
                  {a.isActive && !a.twoFactor && <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">بدون ورود دومرحله‌ای</span>}
                  {a.isActive && a.inactive30 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">بدون ورود در ۳۰ روز اخیر</span>}
                </div>

                {a.role === 'coach' && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <span className="text-slate-500 font-bold">کلاس‌ها:</span>
                    {a.classes.length === 0 ? (
                      <span className="text-slate-400">هیچ کلاسی تخصیص داده نشده</span>
                    ) : (
                      a.classes.map((c) => (
                        <span key={c} className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 font-bold">{c}</span>
                      ))
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="rounded-xl bg-slate-50 p-2.5"><div className="text-slate-400">آخرین ورود</div><div className="font-bold text-slate-800 mt-0.5">{when(a.lastLoginAt)}</div></div>
                  <div className="rounded-xl bg-slate-50 p-2.5"><div className="text-slate-400">آخرین دسترسی</div><div className="font-bold text-slate-800 mt-0.5">{when(a.lastAccessAt)}</div></div>
                  <div className="rounded-xl bg-slate-50 p-2.5"><div className="text-slate-400">پرونده‌های بازشده (۳۰ روز)</div><div className="font-black text-slate-900 mt-0.5 text-sm">{toPersianDigits(a.views30)}</div></div>
                  <div className={`rounded-xl p-2.5 ${a.denied30 + a.alerts30 > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                    <div className="text-slate-400">ردشده / هشدار</div>
                    <div className={`font-black mt-0.5 text-sm ${a.denied30 + a.alerts30 > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{toPersianDigits(a.denied30)} / {toPersianDigits(a.alerts30)}</div>
                  </div>
                </div>

                {a.isActive && a.id !== currentUser.id && (
                  <div className="flex justify-end gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openRevoke(a)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>بستن نشست‌ها</span>
                    </button>
                    {a.role === 'coach' && (
                      <button
                        type="button"
                        onClick={() => deactivate(a)}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-[11px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>غیرفعال‌سازی حساب</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** گزارش دسترسی و بازبینی حساب‌ها (فقط معاون تربیتی؛ فقط‌خواندنی) */
export const NurturingAuditLog: React.FC = () => {
  const [tab, setTab] = useState<'events' | 'review'>('events');
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold w-fit" role="tablist">
        {([
          ['events', 'رویدادهای دسترسی'],
          ['review', 'بازبینی حساب‌ها'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap cursor-pointer transition ${tab === key ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'events' ? <EventsView /> : <ReviewView />}
    </div>
  );
};
