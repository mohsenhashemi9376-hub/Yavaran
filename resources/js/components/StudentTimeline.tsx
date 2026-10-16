import React, { useMemo, useState } from 'react';
import { BookOpenCheck, Clock, Eye, ShieldAlert, UserX, UsersRound, ClipboardCheck } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { PERSIAN_MONTHS, formatShamsiDisplay, toPersianDigits } from '../utils/persianDate';
import { hasPermission } from '../utils/permissions';
import { TIMELINE_KIND_LABEL, TimelineKind, buildStudentTimeline, weekdayPattern } from '../utils/studentTimeline';
import { Student } from '../types';

const KIND_STYLE: Record<TimelineKind, { dot: string; chip: string; icon: React.ReactNode }> = {
  absence: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 border-rose-200', icon: <UserX className="w-3.5 h-3.5" /> },
  delay: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 border-amber-200', icon: <Clock className="w-3.5 h-3.5" /> },
  discipline: { dot: 'bg-purple-500', chip: 'bg-purple-50 text-purple-800 border-purple-200', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  observation: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: <Eye className="w-3.5 h-3.5" /> },
  parent: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-800 border-sky-200', icon: <UsersRound className="w-3.5 h-3.5" /> },
  worksheet: { dot: 'bg-teal-500', chip: 'bg-teal-50 text-teal-800 border-teal-200', icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
};

/** خط زمانی یکپارچه‌ی دانش‌آموز: غیبت، تأخیر، انضباطی، مشاهده‌ی تربیتی، حضور اولیا و کاربرگ */
export const StudentTimeline: React.FC<{ student: Student }> = ({ student }) => {
  const { morningDelays, morningAttendance, schoolAbsences, sessions, observations, nurturingLocked, parentMeetings, worksheets, worksheetWeeks, currentUser } = useSchool();
  const [hidden, setHidden] = useState<Set<TimelineKind>>(new Set());
  const [onlyNegative, setOnlyNegative] = useState(false);

  const canObs = !nurturingLocked && hasPermission(currentUser, 'counseling-report');
  const canParents = hasPermission(currentUser, 'parent-meetings') || hasPermission(currentUser, 'view-parent-meetings');
  const canWorksheets = hasPermission(currentUser, 'view-worksheets') || hasPermission(currentUser, 'manage-worksheets');

  const events = useMemo(() => buildStudentTimeline({
    student, morningDelays, morningAttendance, schoolAbsences, sessions,
    observations: canObs ? observations : undefined,
    parentMeetings: canParents ? parentMeetings : undefined,
    worksheets: canWorksheets ? worksheets : undefined,
    worksheetWeeks: canWorksheets ? worksheetWeeks : undefined,
  }), [student, morningDelays, morningAttendance, schoolAbsences, sessions, observations, parentMeetings, worksheets, worksheetWeeks, canObs, canParents, canWorksheets]);

  const pattern = useMemo(() => weekdayPattern(events), [events]);
  const present = useMemo(() => (Object.keys(TIMELINE_KIND_LABEL) as TimelineKind[]).filter((k) => events.some((e) => e.kind === k)), [events]);
  const shown = events.filter((e) => !hidden.has(e.kind) && (!onlyNegative || e.negative));

  const groups = useMemo(() => {
    const map = new Map<string, typeof shown>();
    shown.forEach((e) => { const k = e.date.slice(0, 7); map.set(k, [...(map.get(k) || []), e]); });
    return Array.from(map, ([k, list]) => ({ k, list }));
  }, [shown]);

  const toggle = (k: TimelineKind) => setHidden((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="space-y-4" id="profile-timeline">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <BookOpenCheck className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-black text-slate-900">خط زمانی دانش‌آموز</h3>
          <span className="text-[11px] text-slate-500">{toPersianDigits(shown.length)} رویداد</span>
          <label className="mr-auto inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" checked={onlyNegative} onChange={(e) => setOnlyNegative(e.target.checked)} />
            فقط موارد نگران‌کننده
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {present.map((k) => (
            <button key={k} type="button" onClick={() => toggle(k)} aria-pressed={!hidden.has(k)}
              className={`!min-h-0 h-7 px-2.5 rounded-full border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${hidden.has(k) ? 'bg-slate-50 text-slate-400 border-slate-200 line-through' : KIND_STYLE[k].chip}`}>
              {KIND_STYLE[k].icon}
              {TIMELINE_KIND_LABEL[k]} ({toPersianDigits(events.filter((e) => e.kind === k).length)})
            </button>
          ))}
        </div>
        {pattern && (
          <p className="text-[11px] leading-6 text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            الگو: {toPersianDigits(pattern.count)} مورد از {toPersianDigits(pattern.total)} غیبت/تأخیر در روز «{pattern.weekday}» رخ داده است.
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">رویدادی برای نمایش وجود ندارد.</div>
      ) : (
        groups.map(({ k, list }) => (
          <section key={k} className="space-y-1.5">
            <h4 className="text-xs font-black text-slate-700 sticky top-0 bg-slate-50/90 backdrop-blur-xs py-1">
              {PERSIAN_MONTHS[Number(k.slice(5, 7)) - 1]} {toPersianDigits(k.slice(0, 4))}
            </h4>
            <ol className="relative border-r-2 border-slate-200 mr-2 pr-4 space-y-2">
              {list.map((e) => (
                <li key={e.id} className="relative">
                  <span className={`absolute -right-[1.45rem] top-2 w-2.5 h-2.5 rounded-full ring-2 ring-white ${KIND_STYLE[e.kind].dot}`} />
                  <div className={`rounded-xl border bg-white px-3 py-2 ${e.negative ? 'border-rose-200' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${KIND_STYLE[e.kind].chip}`}>{TIMELINE_KIND_LABEL[e.kind]}</span>
                      <span className="font-bold text-slate-800">{e.title}</span>
                      <span className="mr-auto text-[10px] font-mono text-slate-400">{formatShamsiDisplay(e.date)}</span>
                    </div>
                    {e.detail && <p className="text-[11px] text-slate-500 mt-1 leading-5 line-clamp-2">{e.detail}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
};
