import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCheck, CheckCircle2, ChevronDown, ChevronLeft, ClipboardCheck } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { computeWorksheetAlerts, weekStartOf, weekTitle } from '../utils/worksheets';

interface Props {
  onOpen: () => void;
}

const ACKED_KEY = 'yavaran_worksheet_alerts_acked_v1';

const readAcked = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACKED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * هشدار کاربرگ در داشبورد معاونت آموزش: پس از گذشتن مهلت هر هفته، دانش‌آموزان «تحویل نداده» و «ناقص»
 * و کلاس‌هایی که هنوز ثبت نشده‌اند نمایش داده می‌شوند؛ دو هفته‌ی پیاپی با رنگ قرمز علامت می‌خورد.
 * با «بررسی شد» هشدار هر هفته بایگانی می‌شود (فقط در همین مرورگر ذخیره می‌شود).
 */
export const WorksheetAlertsCard: React.FC<Props> = ({ onOpen }) => {
  const { students, classes, worksheets, worksheetWeeks } = useSchool();
  const [acked, setAcked] = useState<string[]>(readAcked);
  const [historyOpen, setHistoryOpen] = useState(false);

  const alerts = useMemo(() => computeWorksheetAlerts(students, classes, worksheets, worksheetWeeks), [students, classes, worksheets, worksheetWeeks]);
  const currentWeek = worksheetWeeks.find((w) => w.weekStart === weekStartOf());

  const allWeeks = useMemo(() => [alerts.current, ...alerts.history].filter((w): w is NonNullable<typeof w> => !!w), [alerts]);
  const activeAlerts = allWeeks.filter((w) => w === alerts.current && !acked.includes(w.weekStart));
  const archivedAlerts = allWeeks.filter((w) => acked.includes(w.weekStart));

  const archiveAlert = (weekStart: string) => {
    const next = [...acked.filter((x) => x !== weekStart), weekStart].slice(-30);
    setAcked(next);
    try {
      localStorage.setItem(ACKED_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const counts = (w: NonNullable<typeof alerts.current>) => ({
    missing: w.classes.reduce((n, c) => n + c.missing.length, 0),
    partial: w.classes.reduce((n, c) => n + c.partial.length, 0),
    untouched: w.classes.filter((c) => c.untouched).length,
  });

  const hasActive = activeAlerts.length > 0;

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3.5" id="worksheet-alerts-card" dir="rtl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-emerald-700" />
          <span>کاربرگ هفتگی</span>
          {hasActive && (
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold">
              {toPersianDigits(alerts.latestIssueCount + alerts.latestUntouchedClasses)} هشدار
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={onOpen}
          className="text-xs font-bold text-emerald-800 hover:text-emerald-900 inline-flex items-center gap-1 cursor-pointer"
        >
          <span>باز کردن کاربرگ</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {!currentWeek?.deadline && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 leading-6">
          برای هفته‌ی جاری مهلت ثبت کاربرگ تعیین نشده است؛ تا مهلت تعیین نشود برای این هفته هشداری ثبت نمی‌شود.
          <button type="button" onClick={onOpen} className="mr-1 font-bold text-emerald-800 hover:underline cursor-pointer">تعیین مهلت</button>
        </div>
      )}

      {/* هشدارهای جاری */}
      {hasActive ? (
        <div className="space-y-2">
          {activeAlerts.map((w) => {
            const { missing, partial, untouched } = counts(w);
            return (
              <div key={w.weekStart} className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 flex items-center gap-2 flex-wrap">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <button type="button" onClick={onOpen} className="flex items-center gap-2 flex-wrap text-right cursor-pointer">
                  <span className="text-xs font-extrabold text-rose-900">هفته‌ی {weekTitle(w.weekStart)}</span>
                  <span className="text-[11px] text-slate-500">(مهلت {toPersianDigits(w.deadline)})</span>
                </button>
                <span className="flex items-center gap-1.5 text-[11px] font-bold">
                  {missing > 0 && <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200">تحویل نداده {toPersianDigits(missing)}</span>}
                  {partial > 0 && <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">ناقص {toPersianDigits(partial)}</span>}
                  {untouched > 0 && <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">{toPersianDigits(untouched)} کلاس ثبت‌نشده</span>}
                </span>
                <button
                  type="button"
                  onClick={() => archiveAlert(w.weekStart)}
                  className="!min-h-0 mr-auto h-9 px-3 rounded-lg bg-white border border-rose-200 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>✔️ بررسی شد</span>
                </button>
              </div>
            );
          })}
          {alerts.streaks.size > 0 && (
            <div className="text-[11px] font-bold text-rose-700">
              {toPersianDigits(alerts.streaks.size)} دانش‌آموز دو هفته‌ی پیاپی (یا بیشتر) تحویل نداده‌اند.
            </div>
          )}
          <button type="button" onClick={onOpen} className="text-[11px] font-bold text-emerald-800 hover:underline cursor-pointer">
            فهرست کامل دانش‌آموزان در «باز کردن کاربرگ»
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            {archivedAlerts.length > 0
              ? '🎉 تمامی هشدارها بررسی شده‌اند'
              : worksheetWeeks.some((w) => w.deadline)
                ? 'در آخرین هفته‌ی دارای مهلت گذشته، موردی تحویل‌نشده نیست.'
                : 'هنوز هفته‌ای با مهلت گذشته وجود ندارد.'}
          </span>
        </div>
      )}

      {/* سوابق بایگانی‌شده */}
      {archivedAlerts.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            className="!min-h-0 h-9 w-full flex items-center justify-between gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <span>{historyOpen ? '🔼' : '🔽'} مشاهده سوابق بایگانی‌شده ({toPersianDigits(archivedAlerts.length)} مورد)</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`grid transition-all duration-200 ${historyOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className="space-y-1.5">
                {archivedAlerts.map((w) => {
                  const { missing, partial, untouched } = counts(w);
                  return (
                    <div key={w.weekStart} className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 flex items-center gap-2 flex-wrap text-slate-500">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-slate-400" />
                      <span className="text-xs font-bold">هفته‌ی {weekTitle(w.weekStart)}</span>
                      <span className="text-[11px]">(مهلت {toPersianDigits(w.deadline)})</span>
                      <span className="mr-auto flex items-center gap-1.5 text-[11px]">
                        {missing > 0 && <span>تحویل نداده {toPersianDigits(missing)}</span>}
                        {partial > 0 && <span>· ناقص {toPersianDigits(partial)}</span>}
                        {untouched > 0 && <span>· {toPersianDigits(untouched)} کلاس ثبت‌نشده</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
