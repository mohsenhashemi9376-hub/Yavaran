import React, { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import type { Student } from '../types';
import { hasPermission } from '../utils/permissions';
import { PERSIAN_MONTHS, dateToShamsiString, formatShamsiDisplay, getTodayShamsi, parseShamsi, tehranNow, toPersianDigits } from '../utils/persianDate';
import {
  TIMELINE_KINDS,
  TIMELINE_KIND_LABELS,
  TimelineEntry,
  TimelineKind,
  TimelineTone,
  buildStudentTimeline,
  weeklyBuckets,
} from '../utils/studentTimeline';
import { normalizeShamsi } from '../utils/schoolCalendar';

const DOT_CLASS: Record<TimelineTone, string> = {
  danger: 'bg-rose-500',
  warn: 'bg-amber-500',
  info: 'bg-sky-500',
  ok: 'bg-emerald-500',
  neutral: 'bg-slate-400',
};

const CHIP_CLASS: Record<TimelineKind, string> = {
  absence: 'bg-rose-50 text-rose-800 border-rose-200',
  delay: 'bg-amber-50 text-amber-800 border-amber-200',
  discipline: 'bg-purple-50 text-purple-800 border-purple-200',
  observation: 'bg-sky-50 text-sky-800 border-sky-200',
  parent: 'bg-teal-50 text-teal-800 border-teal-200',
  worksheet: 'bg-indigo-50 text-indigo-800 border-indigo-200',
};

/** پررنگی خانه‌ی هفتگی بر اساس تعداد؛ رنگ هر نوع ثابت است تا چشم الگو را دنبال کند */
const HEAT_CLASS: Record<TimelineKind, [string, string, string]> = {
  absence: ['bg-rose-200', 'bg-rose-400', 'bg-rose-600'],
  delay: ['bg-amber-200', 'bg-amber-400', 'bg-amber-600'],
  discipline: ['bg-purple-200', 'bg-purple-400', 'bg-purple-600'],
  observation: ['bg-sky-200', 'bg-sky-400', 'bg-sky-600'],
  parent: ['bg-teal-200', 'bg-teal-400', 'bg-teal-600'],
  worksheet: ['bg-indigo-200', 'bg-indigo-400', 'bg-indigo-600'],
};

const WEEKS = 10;

const monthHeading = (date: string) => {
  const p = parseShamsi(date);
  return `${PERSIAN_MONTHS[p.month - 1]} ${toPersianDigits(p.year)}`;
};

/** خط زمانی یکپارچه‌ی دانش‌آموز: غیبت، تأخیر، انضباط، مشاهده‌ی تربیتی، حضور اولیا و کاربرگ */
export const StudentTimeline: React.FC<{ student: Student }> = ({ student }) => {
  const { sessions, morningAttendance, morningDelays, schoolAbsences, parentMeetings, worksheets, worksheetWeeks, currentUser, getStudentObservations } = useSchool();
  const [hidden, setHidden] = useState<Set<TimelineKind>>(new Set());

  const allowed = useMemo<Record<TimelineKind, boolean>>(() => {
    const nurturing = hasPermission(currentUser, 'counseling-report') || hasPermission(currentUser, 'view-nurturing-file');
    return {
      absence: true,
      delay: true,
      discipline: true, // تب فقط برای نقش‌هایی که پروندهٔ انضباطی را می‌بینند (نه دبیر) نمایش داده می‌شود
      observation: nurturing,
      parent: hasPermission(currentUser, 'view-parent-meetings') || hasPermission(currentUser, 'parent-meetings'),
      worksheet: hasPermission(currentUser, 'view-worksheets') || hasPermission(currentUser, 'manage-worksheets'),
    };
  }, [currentUser]);

  const today = getTodayShamsi().formattedDate;

  const entries = useMemo(
    () =>
      buildStudentTimeline({
        student,
        sessions,
        morningAttendance: morningAttendance || [],
        morningDelays: morningDelays || [],
        schoolAbsences: schoolAbsences || [],
        observations: allowed.observation ? getStudentObservations(student.id) : [],
        parentMeetings: parentMeetings || [],
        worksheets: worksheets || [],
        worksheetWeeks: worksheetWeeks || [],
        allowed,
      }),
    [student, sessions, morningAttendance, morningDelays, schoolAbsences, parentMeetings, worksheets, worksheetWeeks, allowed, getStudentObservations]
  );

  const kinds = TIMELINE_KINDS.filter((k) => allowed[k]);
  const buckets = useMemo(() => weeklyBuckets(entries, today, WEEKS), [entries, today]);

  const last30 = useMemo(() => {
    const from = tehranNow();
    from.setDate(from.getDate() - 30);
    const since = normalizeShamsi(dateToShamsiString(from));
    const counts = {} as Record<TimelineKind, number>;
    kinds.forEach((k) => (counts[k] = entries.filter((e) => e.kind === k && e.date >= since).length));
    return counts;
  }, [entries, kinds]);

  const shown = entries.filter((e) => !hidden.has(e.kind));
  const groups = useMemo(() => {
    const out: { heading: string; items: TimelineEntry[] }[] = [];
    shown.forEach((e) => {
      const heading = monthHeading(e.date);
      const last = out[out.length - 1];
      if (last && last.heading === heading) last.items.push(e);
      else out.push({ heading, items: [e] });
    });
    return out;
  }, [shown]);

  const toggle = (k: TimelineKind) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="space-y-4" id="profile-timeline">
      {/* الگوی ده هفتهٔ اخیر */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900">الگوی {toPersianDigits(WEEKS)} هفتهٔ اخیر</h3>
          </div>
          <span className="text-[11px] text-slate-400">هر ستون یک هفته؛ پررنگ‌تر = رویداد بیشتر</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[320px] space-y-1.5">
            {kinds.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[11px] font-bold text-slate-600">{TIMELINE_KIND_LABELS[k]}</span>
                <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
                  {buckets.map((b) => {
                    const n = b.counts[k];
                    return (
                      <div
                        key={b.weekStart}
                        title={`هفتهٔ ${b.title}: ${toPersianDigits(n)} ${TIMELINE_KIND_LABELS[k]}`}
                        className={`h-5 rounded-md ${n === 0 ? 'bg-slate-100' : HEAT_CLASS[k][Math.min(2, n - 1)]}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="w-24 shrink-0" />
              <div className="flex-1 flex justify-between">
                <span>{buckets[0]?.title}</span>
                <span>این هفته</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {kinds.map((k) => (
            <span key={k} className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${CHIP_CLASS[k]}`}>
              {TIMELINE_KIND_LABELS[k]}: {toPersianDigits(last30[k])} <span className="font-normal opacity-70">در ۳۰ روز</span>
            </span>
          ))}
        </div>
      </div>

      {/* فیلتر نوع رویداد */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="فیلتر نوع رویداد">
        {kinds.map((k) => {
          const on = !hidden.has(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              aria-pressed={on}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-bold cursor-pointer transition ${on ? CHIP_CLASS[k] : 'bg-white text-slate-400 border-slate-200 line-through'}`}
            >
              {TIMELINE_KIND_LABELS[k]}
            </button>
          );
        })}
      </div>

      {/* خط زمانی */}
      {shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
          {entries.length === 0 ? 'هنوز رویدادی برای این دانش‌آموز ثبت نشده است.' : 'با فیلتر فعلی رویدادی وجود ندارد.'}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.heading}>
              <h4 className="text-xs font-black text-slate-500 mb-2">{g.heading}</h4>
              <ul className="relative border-r-2 border-slate-100 pr-4 space-y-3">
                {g.items.map((e) => (
                  <li key={e.id} className="relative">
                    <span className={`absolute -right-[23px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${DOT_CLASS[e.tone]}`} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{e.title}</span>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${CHIP_CLASS[e.kind]}`}>{TIMELINE_KIND_LABELS[e.kind]}</span>
                        </div>
                        {e.detail && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{e.detail}</p>}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">{formatShamsiDisplay(e.date)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
