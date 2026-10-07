import React, { useEffect, useMemo } from 'react';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { LOAN_ALERT_DAYS, overdueLoans } from '../utils/loans';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';

/** وسایل بازنگشته (بیش از مهلت مجاز) + هشدار یک‌بارِ هر نشست هنگام ورود */
export function useOverdueLoans() {
  const { loanItems, showToast } = useSchool();
  const today = getTodayShamsi().formattedDate;
  const list = useMemo(() => overdueLoans(loanItems, today), [loanItems, today]);
  const count = list.length;

  useEffect(() => {
    if (count === 0) return;
    try {
      if (sessionStorage.getItem('loans-overdue-alerted') === String(count)) return;
      sessionStorage.setItem('loans-overdue-alerted', String(count));
    } catch {
      /* ignore */
    }
    showToast(
      `${toPersianDigits(count)} وسیله بعد از ${toPersianDigits(LOAN_ALERT_DAYS)} روز هنوز برگردانده نشده (امانات و لوازم).`,
      'error'
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return { list, count };
}

/** کارت هشدار روی داشبورد؛ با کلیک به صفحه‌ی «امانات و لوازم» می‌رود */
export const LoanOverdueBanner: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { list, count } = useOverdueLoans();
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-right rounded-2xl border border-rose-200 bg-gradient-to-l from-rose-50 to-white p-4 flex items-center gap-3.5 cursor-pointer hover:border-rose-300 transition"
      role="alert"
    >
      <span className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 animate-pulse">
        <AlertTriangle className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-black text-rose-800">
          {toPersianDigits(count)} وسیله بعد از {toPersianDigits(LOAN_ALERT_DAYS)} روز هنوز برگردانده نشده
        </span>
        <span className="block text-xs text-rose-700/90 mt-1 truncate">
          {list.slice(0, 3).map((l) => `${l.itemName} (${l.recipientName})`).join('، ')}
          {count > 3 ? ' و ...' : ''}
        </span>
      </span>
      <span className="text-xs font-extrabold text-rose-700 flex items-center gap-1 shrink-0">
        <span>امانات و لوازم</span>
        <ChevronLeft className="w-4 h-4" />
      </span>
    </button>
  );
};
