import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ClipboardCheck } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
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
  const [openWeek, setOpenWeek] = useState<string | null>(null);

  const alerts = useMemo(() => computeWorksheetAlerts(students, classes, worksheets, worksheetWeeks), [students, classes, worksheets, worksheetWeeks]);
  const currentWeek = worksheetWeeks.find((w) => w.weekStart === weekStartOf());
  const hasIssues = alerts.weeks.length > 0;
  const latest = alerts.weeks[0];

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
          {alerts.weeks.map((w) => {
            const total = w.classes.reduce((n, c) => n + c.missing.length + c.partial.length, 0);
            const untouched = w.classes.filter((c) => c.untouched).length;
            const expanded = openWeek === w.weekStart || (openWeek === null && w === latest);
            return (
              <div key={w.weekStart} className="rounded-xl border border-rose-200 bg-rose-50/40">
                <button
                  type="button"
                  onClick={() => setOpenWeek(expanded ? '' : w.weekStart)}
                  className="w-full px-3.5 py-3 flex items-center gap-2 text-right cursor-pointer"
                  aria-expanded={expanded}
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs font-extrabold text-rose-900">هفته‌ی {weekTitle(w.weekStart)}</span>
                  <span className="text-[11px] text-slate-500">(مهلت {toPersianDigits(w.deadline)})</span>
                  <span className="mr-auto text-[11px] font-bold text-rose-700">
                    {total > 0 && `${toPersianDigits(total)} دانش‌آموز`}
                    {total > 0 && untouched > 0 && ' • '}
                    {untouched > 0 && `${toPersianDigits(untouched)} کلاس ثبت‌نشده`}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
                </button>

                {expanded && (
                  <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-rose-100 pt-3">
                    {w.classes.map((c) => (
                      <div key={c.classId} className="text-xs">
                        <div className="font-extrabold text-slate-800 mb-1">{c.className}</div>
                        {c.untouched ? (
                          <div className="text-amber-800 font-bold">هنوز هیچ کاربرگی برای این کلاس ثبت نشده است.</div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {c.missing.map((s) => (
                              <span key={s.id} className={`px-2 py-1 rounded-lg border font-bold ${alerts.streaks.has(s.id) ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                {studentFullName(s)} — تحویل نداده
                                {alerts.streaks.has(s.id) && ` • ${toPersianDigits(alerts.streaks.get(s.id) as number)} هفته پیاپی`}
                              </span>
                            ))}
                            {c.partial.map((s) => (
                              <span key={s.id} className={`px-2 py-1 rounded-lg border font-bold ${alerts.streaks.has(s.id) ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                                {studentFullName(s)} — ناقص
                                {alerts.streaks.has(s.id) && ` • ${toPersianDigits(alerts.streaks.get(s.id) as number)} هفته پیاپی`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
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
