import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, History } from 'lucide-react';
import { toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { WorksheetAlertWeek, WorksheetAlerts, weekTitle } from '../utils/worksheets';

const WeekBlock: React.FC<{
  w: WorksheetAlertWeek;
  alerts: WorksheetAlerts;
  expanded: boolean;
  onToggle: () => void;
  /** سابقه: بدون رنگ هشدار و بدون علامت هفته‌ی پیاپی */
  history?: boolean;
}> = ({ w, alerts, expanded, onToggle, history }) => {
  const total = w.classes.reduce((n, c) => n + c.missing.length + c.partial.length, 0);
  const untouched = w.classes.filter((c) => c.untouched).length;
  return (
    <div className={`rounded-xl border ${history ? 'border-slate-200 bg-white' : 'border-rose-200 bg-rose-50/40'}`}>
      <button type="button" onClick={onToggle} className="w-full px-3.5 py-3 flex items-center gap-2 text-right cursor-pointer" aria-expanded={expanded}>
        {history ? <History className="w-4 h-4 text-slate-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
        <span className={`text-xs font-extrabold ${history ? 'text-slate-800' : 'text-rose-900'}`}>هفته‌ی {weekTitle(w.weekStart)}</span>
        <span className="text-[11px] text-slate-500">(مهلت {toPersianDigits(w.deadline)})</span>
        <span className={`mr-auto text-[11px] font-bold ${history ? 'text-slate-600' : 'text-rose-700'}`}>
          {total > 0 && `${toPersianDigits(total)} دانش‌آموز`}
          {total > 0 && untouched > 0 && ' • '}
          {untouched > 0 && `${toPersianDigits(untouched)} کلاس ثبت‌نشده`}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className={`px-3.5 pb-3.5 space-y-2.5 border-t pt-3 ${history ? 'border-slate-100' : 'border-rose-100'}`}>
          {w.classes.map((c) => (
            <div key={c.classId} className="text-xs">
              <div className="font-extrabold text-slate-800 mb-1">{c.className}</div>
              {c.untouched ? (
                <div className="text-amber-800 font-bold">برای این کلاس کاربرگی ثبت نشده است.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {c.missing.map((s) => {
                    const streak = !history && alerts.streaks.get(s.id);
                    return (
                      <span key={s.id} className={`px-2 py-1 rounded-lg border font-bold ${streak ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                        {studentFullName(s)} — تحویل نداده
                        {streak ? ` • ${toPersianDigits(streak)} هفته پیاپی` : ''}
                      </span>
                    );
                  })}
                  {c.partial.map((s) => {
                    const streak = !history && alerts.streaks.get(s.id);
                    return (
                      <span key={s.id} className={`px-2 py-1 rounded-lg border font-bold ${streak ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                        {studentFullName(s)} — ناقص
                        {streak ? ` • ${toPersianDigits(streak)} هفته پیاپی` : ''}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * هشدار فقط برای آخرین هفته‌ی دارای مهلت گذشته است؛ هفته‌های قبل به بخش «سابقه» می‌روند
 * تا معاون آموزشی ببیند در هر هفته چه کسانی نیاورده یا ناقص آورده‌اند.
 */
export const WorksheetAlertsDetail: React.FC<{ alerts: WorksheetAlerts }> = ({ alerts }) => {
  const [openCurrent, setOpenCurrent] = useState(true);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  if (!alerts.current && alerts.history.length === 0) return null;

  return (
    <div className="space-y-4">
      {alerts.current && (
        <div className="space-y-2">
          <WeekBlock w={alerts.current} alerts={alerts} expanded={openCurrent} onToggle={() => setOpenCurrent((v) => !v)} />
        </div>
      )}

      {alerts.history.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-500" />
            <span>سابقه‌ی هفته‌های قبل</span>
          </h4>
          {alerts.history.map((w) => (
            <WeekBlock
              key={w.weekStart}
              w={w}
              alerts={alerts}
              history
              expanded={openHistory === w.weekStart}
              onToggle={() => setOpenHistory(openHistory === w.weekStart ? null : w.weekStart)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
