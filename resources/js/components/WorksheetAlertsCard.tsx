import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ClipboardCheck } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { computeWorksheetAlerts, weekStartOf, weekTitle } from '../utils/worksheets';

interface Props {
  onOpen: () => void;
}

/**
 * هشدار کاربرگ در داشبورد معاونت آموزش: پس از گذشتن مهلت هر هفته، دانش‌آموزان «تحویل نداده» و «ناقص»
 * و کلاس‌هایی که هنوز ثبت نشده‌اند نمایش داده می‌شوند؛ دو هفته‌ی پیاپی با رنگ قرمز علامت می‌خورد.
 */
export const WorksheetAlertsCard: React.FC<Props> = ({ onOpen }) => {
  const { students, classes, worksheets, worksheetWeeks } = useSchool();

  const alerts = useMemo(() => computeWorksheetAlerts(students, classes, worksheets, worksheetWeeks), [students, classes, worksheets, worksheetWeeks]);
  const currentWeek = worksheetWeeks.find((w) => w.weekStart === weekStartOf());
  const hasIssues = alerts.weeks.length > 0;

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3.5" id="worksheet-alerts-card">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-teal-700" />
          <span>کاربرگ هفتگی</span>
          {hasIssues && (
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold">
              {toPersianDigits(alerts.latestIssueCount + alerts.latestUntouchedClasses)} هشدار
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={onOpen}
          className="text-xs font-bold text-teal-800 hover:text-teal-900 inline-flex items-center gap-1 cursor-pointer"
        >
          <span>باز کردن کاربرگ</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {!currentWeek?.deadline && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 leading-6">
          برای هفته‌ی جاری مهلت ثبت کاربرگ تعیین نشده است؛ تا مهلت تعیین نشود برای این هفته هشداری ثبت نمی‌شود.
          <button type="button" onClick={onOpen} className="mr-1 font-bold text-teal-800 hover:underline cursor-pointer">تعیین مهلت</button>
        </div>
      )}

      {!hasIssues ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{worksheetWeeks.some((w) => w.deadline) ? 'در هفته‌های دارای مهلت گذشته، موردی تحویل‌نشده نیست.' : 'هنوز هفته‌ای با مهلت گذشته وجود ندارد.'}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.weeks.slice(0, 3).map((w) => {
            const missing = w.classes.reduce((n, c) => n + c.missing.length, 0);
            const partial = w.classes.reduce((n, c) => n + c.partial.length, 0);
            const untouched = w.classes.filter((c) => c.untouched).length;
            return (
              <button
                key={w.weekStart}
                type="button"
                onClick={onOpen}
                className="w-full rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 px-3.5 py-3 flex items-center gap-2 flex-wrap text-right cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="text-xs font-extrabold text-rose-900">هفته‌ی {weekTitle(w.weekStart)}</span>
                <span className="text-[11px] text-slate-500">(مهلت {toPersianDigits(w.deadline)})</span>
                <span className="mr-auto flex items-center gap-1.5 text-[11px] font-bold">
                  {missing > 0 && <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200">تحویل نداده {toPersianDigits(missing)}</span>}
                  {partial > 0 && <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">ناقص {toPersianDigits(partial)}</span>}
                  {untouched > 0 && <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">{toPersianDigits(untouched)} کلاس ثبت‌نشده</span>}
                </span>
              </button>
            );
          })}
          {alerts.streaks.size > 0 && (
            <div className="text-[11px] font-bold text-rose-700">
              {toPersianDigits(alerts.streaks.size)} دانش‌آموز دو هفته‌ی پیاپی (یا بیشتر) تحویل نداده‌اند.
            </div>
          )}
          <button type="button" onClick={onOpen} className="text-[11px] font-bold text-teal-800 hover:underline cursor-pointer">
            فهرست کامل دانش‌آموزان در «باز کردن کاربرگ»
          </button>
        </div>
      )}
    </div>
  );
};
