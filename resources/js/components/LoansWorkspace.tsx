import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronLeft,
  FileSpreadsheet,
  Menu,
  Package,
  PackageCheck,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { LoanItem } from '../types';
import {
  dateToShamsiString,
  getDayOfWeekFromShamsi,
  getTodayShamsi,
  shamsiStringToDate,
  toPersianDigits,
} from '../utils/persianDate';
import {
  LOAN_ALERT_DAYS,
  LoanState,
  loanElapsedDays,
  loanState,
  normalizeShamsi,
  overdueLoans,
} from '../utils/loans';

type Filter = 'all' | 'active' | 'overdue' | 'returned';

interface LoansWorkspaceProps {
  onBack: () => void;
  onOpenSidebar?: () => void;
}

const shiftDay = (shamsi: string, delta: number): string => {
  const d = shamsiStringToDate(shamsi);
  d.setDate(d.getDate() + delta);
  return dateToShamsiString(d);
};

const elapsedLabel = (days: number): string => {
  if (days <= 0) return 'امروز';
  if (days === 1) return 'دیروز';
  return `${toPersianDigits(days)} روز پیش`;
};

const inputCls =
  'w-full text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 rounded-xl px-3.5 py-2.5 outline-none transition placeholder:text-slate-400';

// ---------------------------------------------------------------------------
// فرم ثبت / ویرایش امانت
// ---------------------------------------------------------------------------
const LoanForm: React.FC<{
  initial?: LoanItem;
  today: string;
  recipients: string[];
  onSubmit: (data: { itemName: string; loanDate: string; recipientName: string; note?: string }) => void;
  onCancel?: () => void;
}> = ({ initial, today, recipients, onSubmit, onCancel }) => {
  const { showToast } = useSchool();
  const [itemName, setItemName] = useState(initial?.itemName || '');
  const [loanDate, setLoanDate] = useState(toPersianDigits(initial?.loanDate || today));
  const [recipientName, setRecipientName] = useState(initial?.recipientName || '');
  const [note, setNote] = useState(initial?.note || '');
  const [error, setError] = useState<string | null>(null);

  const normalizedDate = normalizeShamsi(loanDate);
  const weekday = normalizedDate ? getDayOfWeekFromShamsi(normalizedDate) : '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return setError('نام وسیله را وارد کنید.');
    if (!recipientName.trim()) return setError('نام تحویل‌گیرنده را وارد کنید.');
    if (!normalizedDate) return setError('تاریخ را به‌صورت ۱۴۰۵/۰۷/۱۴ وارد کنید.');
    setError(null);
    onSubmit({ itemName, loanDate: normalizedDate, recipientName, note });
    if (!initial) {
      setItemName('');
      setRecipientName('');
      setNote('');
      setLoanDate(toPersianDigits(today));
      showToast(`«${itemName.trim()}» به نام ${recipientName.trim()} ثبت شد.`, 'success');
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <label className="block">
          <span className="block text-[11px] font-bold text-slate-500 mb-1.5">نام وسیله</span>
          <input
            autoFocus={Boolean(initial)}
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="مثلاً ویدیو پروژکتور، کلید سالن، لپ‌تاپ"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="block text-[11px] font-bold text-slate-500 mb-1.5">نام تحویل‌گیرنده</span>
          <input
            list="loan-recipients"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="نام و نام خانوادگی"
            className={inputCls}
          />
          <datalist id="loan-recipients">
            {recipients.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>

        <div className="block">
          <span className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
            <span>تاریخ تحویل</span>
            {weekday && <span className="text-teal-700">{weekday}</span>}
          </span>
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              inputMode="numeric"
              dir="ltr"
              value={loanDate}
              onChange={(e) => setLoanDate(e.target.value)}
              placeholder="۱۴۰۵/۰۷/۱۴"
              className={`${inputCls} pr-9 text-right font-mono`}
            />
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            {[
              ['امروز', 0],
              ['دیروز', -1],
              ['پریروز', -2],
            ].map(([label, delta]) => (
              <button
                key={label as string}
                type="button"
                onClick={() => setLoanDate(toPersianDigits(shiftDay(today, delta as number)))}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-600 cursor-pointer transition"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="block">
        <span className="block text-[11px] font-bold text-slate-500 mb-1.5">توضیحات (اختیاری)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مثلاً برای جلسه‌ی اولیا، همراه با کیف و کابل"
          className={inputCls}
        />
      </label>

      {error && (
        <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <button
          type="submit"
          className="h-11 px-6 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-extrabold shadow-sm cursor-pointer inline-flex items-center gap-2 transition active:scale-[0.98]"
        >
          {initial ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{initial ? 'ذخیره تغییرات' : 'ثبت تحویل وسیله'}</span>
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-11 px-5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            انصراف
          </button>
        )}
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// صفحه اصلی «امانات و لوازم»
// ---------------------------------------------------------------------------
export const LoansWorkspace: React.FC<LoansWorkspaceProps> = ({ onBack, onOpenSidebar }) => {
  const { loanItems, addLoanItem, updateLoanItem, deleteLoanItem, allUsers, showConfirm, showToast } = useSchool();
  const today = getTodayShamsi().formattedDate;

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<LoanItem | null>(null);

  const recipients = useMemo(() => {
    const names = new Set<string>();
    loanItems.forEach((l) => l.recipientName && names.add(l.recipientName));
    allUsers.filter((u) => u.isActive !== false).forEach((u) => u.name && names.add(u.name));
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [loanItems, allUsers]);

  const overdue = useMemo(() => overdueLoans(loanItems, today), [loanItems, today]);
  const counts = useMemo(
    () => ({
      all: loanItems.length,
      active: loanItems.filter((l) => !l.returned).length,
      overdue: overdue.length,
      returned: loanItems.filter((l) => l.returned).length,
    }),
    [loanItems, overdue]
  );

  const visible = useMemo(() => {
    const q = search.trim();
    const rank = (s: LoanState) => (s === 'overdue' ? 0 : s === 'active' ? 1 : 2);
    return loanItems
      .filter((l) => {
        const st = loanState(l, today);
        if (filter === 'active' && l.returned) return false;
        if (filter === 'overdue' && st !== 'overdue') return false;
        if (filter === 'returned' && !l.returned) return false;
        if (!q) return true;
        return `${l.itemName} ${l.recipientName} ${l.note || ''}`.includes(q);
      })
      .sort(
        (a, b) =>
          rank(loanState(a, today)) - rank(loanState(b, today)) ||
          (a.loanDate < b.loanDate ? 1 : a.loanDate > b.loanDate ? -1 : 0)
      );
  }, [loanItems, filter, search, today]);

  const toggleReturned = (l: LoanItem) => {
    if (l.returned) {
      updateLoanItem(l.id, { returned: false, returnedDate: undefined });
      showToast(`«${l.itemName}» دوباره به‌عنوان «در امانت» علامت خورد.`, 'info');
    } else {
      updateLoanItem(l.id, { returned: true, returnedDate: today });
      showToast(`«${l.itemName}» از ${l.recipientName} تحویل گرفته شد.`, 'success');
    }
  };

  const remove = (l: LoanItem) =>
    showConfirm({
      title: 'حذف از فهرست امانات',
      message: `«${l.itemName}» (تحویل به ${l.recipientName}) از فهرست حذف شود؟ این کار قابل بازگشت نیست.`,
      confirmLabel: 'حذف',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => deleteLoanItem(l.id),
    });

  const exportExcel = () => {
    const rows = loanItems.map((l, i) => ({
      ردیف: i + 1,
      'نام وسیله': l.itemName,
      'تحویل‌گیرنده': l.recipientName,
      'تاریخ تحویل': l.loanDate,
      وضعیت: l.returned ? 'تحویل گرفته شد' : loanState(l, today) === 'overdue' ? 'سررسید گذشته' : 'در امانت',
      'تاریخ بازگشت': l.returnedDate || '',
      'روز سپری‌شده': loanElapsedDays(l, today),
      توضیحات: l.note || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'امانات و لوازم');
    XLSX.writeFile(wb, `امانات_و_لوازم_${today.replace(/\//g, '-')}.xlsx`);
  };

  const stats = [
    { key: 'all' as const, label: 'کل امانات ثبت‌شده', value: counts.all, icon: Package, tone: 'text-slate-700 bg-slate-100', ring: 'hover:border-slate-300' },
    { key: 'active' as const, label: 'در امانت', value: counts.active, icon: PackageOpen, tone: 'text-teal-700 bg-teal-50', ring: 'hover:border-teal-300' },
    { key: 'overdue' as const, label: `بیش از ${toPersianDigits(LOAN_ALERT_DAYS)} روز`, value: counts.overdue, icon: AlertTriangle, tone: 'text-rose-700 bg-rose-50', ring: 'hover:border-rose-300' },
    { key: 'returned' as const, label: 'تحویل گرفته‌شده', value: counts.returned, icon: PackageCheck, tone: 'text-emerald-700 bg-emerald-50', ring: 'hover:border-emerald-300' },
  ];

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'همه' },
    { key: 'active', label: 'در امانت' },
    { key: 'overdue', label: 'سررسید گذشته' },
    { key: 'returned', label: 'تحویل گرفته‌شده' },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      {/* ۱. سربرگ */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            {onOpenSidebar && (
              <button
                type="button"
                onClick={onOpenSidebar}
                aria-label="منو"
                className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
                <span>داشبورد</span>
                <span>/</span>
                <span>امور روزانه</span>
                <span>/</span>
                <span className="text-teal-800 font-black">امانات و لوازم</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <Package className="w-5 h-5" />
                </span>
                <span>امانات و لوازم</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1.5">
                ثبت وسایلی که از مدرسه تحویل داده می‌شود و پیگیری بازگشت آن‌ها. اگر وسیله‌ای تا {toPersianDigits(LOAN_ALERT_DAYS)} روز برنگردد، سامانه هشدار می‌دهد.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportExcel}
              disabled={loanItems.length === 0}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>خروجی اکسل</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>بازگشت به داشبورد</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* آمار */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {stats.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setFilter(s.key)}
              className={`text-right p-3.5 rounded-xl border bg-slate-50/70 transition cursor-pointer flex items-center justify-between gap-2 ${s.ring} ${
                filter === s.key ? 'border-teal-400 ring-2 ring-teal-100 bg-white' : 'border-slate-200/80'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold text-slate-500">{s.label}</div>
                <div className={`text-2xl font-black mt-1 ${s.key === 'overdue' && s.value > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                  {toPersianDigits(s.value)}
                </div>
              </div>
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.tone}`}>
                <s.icon className="w-5 h-5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ۲. هشدار سررسید */}
      {overdue.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-l from-rose-50 to-white p-4 flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
          <span className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 animate-pulse">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-rose-800">
              {toPersianDigits(overdue.length)} وسیله بیش از {toPersianDigits(LOAN_ALERT_DAYS)} روز است برگردانده نشده
            </div>
            <div className="text-xs text-rose-700/90 mt-1 leading-6">
              {overdue
                .slice(0, 4)
                .map((l) => `${l.itemName} (${l.recipientName})`)
                .join('، ')}
              {overdue.length > 4 ? ` و ${toPersianDigits(overdue.length - 4)} مورد دیگر` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilter('overdue')}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold cursor-pointer shrink-0 transition"
          >
            مشاهده موارد
          </button>
        </div>
      )}

      {/* ۳. فرم ثبت سریع */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-4">
          <span className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </span>
          <span>تحویل وسیله جدید</span>
        </h2>
        <LoanForm
          today={today}
          recipients={recipients}
          onSubmit={(data) => addLoanItem(data)}
        />
      </div>

      {/* ۴. فهرست */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-100 p-1 rounded-xl text-xs font-bold" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={filter === t.key}
                onClick={() => setFilter(t.key)}
                className={`px-3.5 py-2 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition ${
                  filter === t.key ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    t.key === 'overdue' && counts.overdue > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-200/70 text-slate-600'
                  }`}
                >
                  {toPersianDigits(counts[t.key])}
                </span>
              </button>
            ))}
          </div>
          <div className="relative lg:mr-auto lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی وسیله یا تحویل‌گیرنده..."
              className={`${inputCls} pr-9`}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="py-16 text-center space-y-2 text-slate-400">
            <Package className="w-10 h-10 mx-auto opacity-40 text-teal-800" />
            <p className="text-sm font-bold text-slate-600">
              {loanItems.length === 0 ? 'هنوز وسیله‌ای ثبت نشده است.' : 'موردی با این فیلتر پیدا نشد.'}
            </p>
            {loanItems.length === 0 && <p className="text-xs">از فرم بالا اولین وسیله‌ی تحویلی را ثبت کنید.</p>}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((l) => {
              const st = loanState(l, today);
              const days = loanElapsedDays(l, today);
              const isOver = st === 'overdue';
              const isDone = st === 'returned';
              return (
                <li
                  key={l.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4 transition ${
                    isOver ? 'bg-rose-50/50' : isDone ? 'bg-slate-50/50' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <span
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        isOver
                          ? 'bg-rose-100 text-rose-700'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-teal-50 text-teal-700'
                      }`}
                    >
                      {isOver ? <AlertTriangle className="w-5 h-5" /> : isDone ? <PackageCheck className="w-5 h-5" /> : <PackageOpen className="w-5 h-5" />}
                    </span>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-base font-extrabold ${isDone ? 'text-slate-500' : 'text-slate-900'}`}>{l.itemName}</span>
                        {isOver && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">سررسید گذشته</span>
                        )}
                        {isDone && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">تحویل گرفته شد</span>
                        )}
                      </div>
                      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          {l.recipientName}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">{toPersianDigits(l.loanDate)}</span>
                          <span className="text-slate-400">({getDayOfWeekFromShamsi(l.loanDate)})</span>
                        </span>
                        {isDone ? (
                          l.returnedDate && (
                            <span className="text-emerald-700 font-semibold">
                              بازگشت: <span className="font-mono">{toPersianDigits(l.returnedDate)}</span>
                            </span>
                          )
                        ) : (
                          <span className={`font-bold ${isOver ? 'text-rose-700' : 'text-teal-700'}`}>
                            {elapsedLabel(days)}
                            {isOver && ` • ${toPersianDigits(days)} روز بدون بازگشت`}
                          </span>
                        )}
                      </div>
                      {l.note && <p className="text-xs text-slate-500">{l.note}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleReturned(l)}
                      aria-pressed={l.returned}
                      className={`h-11 px-4 rounded-xl border-2 text-xs font-extrabold inline-flex items-center gap-2.5 cursor-pointer transition active:scale-[0.98] flex-1 md:flex-none justify-center ${
                        l.returned
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                          : isOver
                          ? 'bg-white border-rose-300 text-rose-700 hover:bg-rose-50'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-teal-400 hover:bg-teal-50/50'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                          l.returned ? 'bg-emerald-600 border-emerald-600 text-white' : isOver ? 'border-rose-400' : 'border-slate-300'
                        }`}
                      >
                        {l.returned && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      </span>
                      <span>{l.returned ? 'تحویل گرفتم' : 'تحویل گرفتم؟'}</span>
                    </button>
                    <button
                      type="button"
                      title="ویرایش"
                      aria-label="ویرایش"
                      onClick={() => setEditing(l)}
                      className="w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="حذف"
                      aria-label="حذف"
                      onClick={() => remove(l)}
                      className="w-11 h-11 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ویرایش */}
      {editing && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex-1">ویرایش امانت</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="بستن"
                className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <LoanForm
                initial={editing}
                today={today}
                recipients={recipients}
                onCancel={() => setEditing(null)}
                onSubmit={(data) => {
                  updateLoanItem(editing.id, {
                    itemName: data.itemName.trim(),
                    recipientName: data.recipientName.trim(),
                    loanDate: data.loanDate,
                    note: data.note?.trim() || undefined,
                  });
                  showToast('امانت ویرایش شد.', 'success');
                  setEditing(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
