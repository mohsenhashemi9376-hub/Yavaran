import React, { useMemo, useState } from 'react';
import { Activity, ArrowLeft, BarChart3, Eye, UserCheck } from 'lucide-react';
import { SchoolClass, Student, StudentObservation } from '../types';
import { toPersianDigits, tehranNow } from '../utils/persianDate';
import { normalizeShamsi } from '../utils/schoolCalendar';
import { studentFullName } from '../utils/studentName';
import { CATS, catOf, WeeklyBars, daysAgo } from './ObservationInsights';

const fa = toPersianDigits;

export interface ObservationHomeWidgetsProps {
  students: Student[];
  classes: SchoolClass[];
  observations: StudentObservation[];
  isVice: boolean;
  onOpenAll: () => void;
}

type Row = StudentObservation & { _day: number; _sort: string };

const weekly = (list: Row[]): number[] => {
  const out = new Array(8).fill(0);
  list.forEach((o) => {
    const w = Math.floor(o._day / 7);
    if (w < 8) out[7 - w] += 1;
  });
  return out;
};

export const ObservationHomeWidgets: React.FC<ObservationHomeWidgetsProps> = ({
  students, classes, observations, isVice, onOpenAll,
}) => {
  const [classId, setClassId] = useState<string | null>(null);
  const now = tehranNow().getTime();
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const className = (id: string) => classes.find((c) => c.id === id)?.name || '—';

  const rows: Row[] = useMemo(
    () =>
      observations
        .filter((o) => byId.has(o.studentId))
        .map((o) => ({ ...o, _day: daysAgo(o.date, now), _sort: `${normalizeShamsi(o.date)} ${o.time || '00:00'}` }))
        .sort((a, b) => (a._sort < b._sort ? 1 : -1)),
    [observations, byId, now]
  );

  const perClass = useMemo(
    () =>
      classes.map((cl) => {
        const ids = new Set(students.filter((s) => s.classId === cl.id).map((s) => s.id));
        const list = rows.filter((o) => ids.has(o.studentId));
        return {
          cl,
          total: list.length,
          week: list.filter((o) => o._day < 7).length,
          observed: new Set(list.map((o) => o.studentId)).size,
          studentCount: ids.size,
          last: list[0]?.date as string | undefined,
          list,
        };
      }),
    [classes, students, rows]
  );
  const maxTotal = Math.max(1, ...perClass.map((c) => c.total));
  const selected = classId ? perClass.find((c) => c.cl.id === classId) || null : null;
  const shown = selected ? selected.list : rows;

  const catParts = CATS.map((c) => ({ ...c, n: shown.filter((o) => o.category === c.key).length })).filter((c) => c.n > 0);
  const latest = rows.slice(0, 5);
  const coachEntries = rows.filter((o) => o.authorRole === 'coach').slice(0, 6);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* نمودار آمار: کلی + با کلیک روی کلاس، همان کلاس */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            آمار مشاهده‌گری {selected ? `— ${selected.cl.name}` : '— همه کلاس‌ها'}
          </h3>
          {selected && (
            <button type="button" onClick={() => setClassId(null)} className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer">
              نمایش کلی
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>روند ۸ هفته اخیر</span>
              <span className="font-bold text-slate-800">{fa(shown.length)} مشاهده</span>
            </div>
            <WeeklyBars counts={weekly(shown)} />
            <div className="flex justify-between text-[10px] text-slate-400"><span>۸ هفته پیش</span><span>این هفته</span></div>
            {catParts.length > 0 && (
              <>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 mt-2" role="img" aria-label="سهم دسته‌ها">
                  {catParts.map((c) => (
                    <div key={c.key} style={{ width: `${(c.n / shown.length) * 100}%`, background: c.hex }} title={`${c.short}: ${fa(c.n)}`} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600">
                  {catParts.map((c) => (
                    <span key={c.key} className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.hex }} />{c.short} {fa(c.n)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] text-slate-500">به تفکیک کلاس (برای دیدن آمار هر کلاس روی آن بزنید)</div>
            {perClass.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">کلاسی وجود ندارد.</p>
            ) : (
              perClass.map((c) => (
                <button
                  key={c.cl.id}
                  type="button"
                  onClick={() => setClassId(classId === c.cl.id ? null : c.cl.id)}
                  aria-pressed={classId === c.cl.id}
                  className={`w-full text-right rounded-xl border px-3 py-2 transition cursor-pointer ${
                    classId === c.cl.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-800 truncate">{c.cl.name}</span>
                    <span className="font-mono text-slate-600 whitespace-nowrap">
                      <b className="text-emerald-700">{fa(c.total)}</b> مشاهده · {fa(c.observed)}/{fa(c.studentCount)} نفر
                    </span>
                  </div>
                  <div className="h-2 mt-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${(c.total / maxTotal) * 100}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {fa(c.week)} مشاهده در ۷ روز اخیر{c.last ? ` · آخرین: ${fa(c.last)}` : ' · هنوز مشاهده‌ای ثبت نشده'}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ۵ ثبت آخر */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" /> ۵ مشاهده آخر
          </h3>
          <button
            type="button"
            onClick={onOpenAll}
            className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer"
          >
            مشاهده کامل <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
        {latest.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">هنوز مشاهده‌ای ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {latest.map((o) => {
              const s = byId.get(o.studentId);
              const c = catOf(o.category);
              return (
                <li key={o.id} className="py-2 flex items-start gap-2.5">
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: c.hex }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 truncate">{o.title}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {studentFullName(s)} · {s ? className(s.classId) : ''}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap" dir="ltr">{fa(o.date)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ثبت‌های مربیان: فقط معاون */}
      {isVice && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
          <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-sky-600" /> ثبت‌های اخیر مربیان
          </h3>
          {coachEntries.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">مربیان هنوز مشاهده‌ای ثبت نکرده‌اند.</p>
          ) : (
            <ul className="space-y-1.5">
              {coachEntries.map((o) => {
                const s = byId.get(o.studentId);
                return (
                  <li key={o.id} className="flex items-center gap-1.5 text-[11px] rounded-lg bg-sky-50/60 px-2.5 py-1.5">
                    <Eye className="w-3 h-3 text-sky-600 shrink-0" />
                    <span className="font-bold text-slate-800 truncate">{o.recordedBy || 'مربی'}</span>
                    <ArrowLeft className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="text-slate-700 truncate">{studentFullName(s)}</span>
                    <span className="text-slate-400 truncate hidden sm:inline">({s ? className(s.classId) : ''})</span>
                    <span className="mr-auto text-slate-400 whitespace-nowrap" dir="ltr">{fa(o.date)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
