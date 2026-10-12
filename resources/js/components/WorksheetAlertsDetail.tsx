import React, { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { WorksheetAlerts, weekTitle } from '../utils/worksheets';

/** آمار کامل دانش‌آموزان تحویل‌نداده/ناقص هر هفته (پس از گذشتن مهلت)، به تفکیک کلاس */
export const WorksheetAlertsDetail: React.FC<{ alerts: WorksheetAlerts }> = ({ alerts }) => {
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const latest = alerts.weeks[0];
  if (alerts.weeks.length === 0) return null;

  return (
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
  );
};
