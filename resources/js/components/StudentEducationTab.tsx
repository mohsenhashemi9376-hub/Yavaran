import React, { useMemo } from 'react';
import { ClipboardCheck, BookOpen, MessageSquareText, NotebookPen } from 'lucide-react';
import { AttendanceSession, HomeworkStatus, WorksheetRecord, WorksheetWeek } from '../types';
import { studentWorksheetHistory, weekTitle, WORKSHEET_STATUS_LABEL } from '../utils/worksheets';
import { toPersianDigits } from '../utils/persianDate';

export interface EducationSessionLog {
  session: AttendanceSession;
  homeworkStatus?: HomeworkStatus;
  note?: string;
}

interface Props {
  studentId: string;
  sessionLogs: EducationSessionLog[];
  worksheets: WorksheetRecord[];
  worksheetWeeks: WorksheetWeek[];
  /** فقط کسانی که مجوز کاربرگ دارند آمار کاربرگ را می‌بینند */
  showWorksheets: boolean;
}

const fa = toPersianDigits;
const glass = 'rounded-2xl border border-white/80 bg-white/70 backdrop-blur-xl shadow-sm';

const WS_TONE: Record<string, string> = {
  complete: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
  partial: 'bg-amber-100/80 text-amber-800 border-amber-200',
  absent: 'bg-slate-100/80 text-slate-600 border-slate-200',
  missing: 'bg-rose-100/80 text-rose-700 border-rose-200',
};

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const toneOf = (p: number) => (p >= 80 ? 'text-emerald-700' : p >= 50 ? 'text-amber-700' : 'text-rose-700');

/** «آموزش و تکالیف»: آمار انجام تکالیف هر درس، کاربرگ هفتگی و یادداشت‌های دبیران */
export const StudentEducationTab: React.FC<Props> = ({ studentId, sessionLogs, worksheets, worksheetWeeks, showWorksheets }) => {
  const subjects = useMemo(() => {
    const map = new Map<string, { subject: string; done: number; incomplete: number; notDone: number; total: number }>();
    sessionLogs.forEach((l) => {
      if (!l.homeworkStatus) return;
      const key = l.session.subjectId || l.session.subject || 'نامشخص';
      const row = map.get(key) || { subject: l.session.subject || 'نامشخص', done: 0, incomplete: 0, notDone: 0, total: 0 };
      row.total++;
      if (l.homeworkStatus === 'done') row.done++;
      else if (l.homeworkStatus === 'incomplete') row.incomplete++;
      else row.notDone++;
      map.set(key, row);
    });
    return Array.from(map.values()).sort((a, b) => pct(a.done, a.total) - pct(b.done, b.total));
  }, [sessionLogs]);

  const totals = useMemo(() => subjects.reduce((t, s) => ({ done: t.done + s.done, total: t.total + s.total }), { done: 0, total: 0 }), [subjects]);
  const overall = pct(totals.done, totals.total);

  const ws = useMemo(() => {
    const history = studentWorksheetHistory(studentId, worksheets, worksheetWeeks);
    const counted = history.filter((h) => h.status !== 'absent');
    const complete = counted.filter((h) => h.status === 'complete').length;
    return { history, complete, counted: counted.length, rate: counted.length ? pct(complete, counted.length) : null };
  }, [studentId, worksheets, worksheetWeeks]);

  // یادداشت‌های دبیران: یادداشت فردی برای دانش‌آموز + یادداشت کلی جلسه (جدیدترین اول)
  const notes = useMemo(() => {
    const rows: { id: string; date: string; subject: string; teacher: string; text: string; personal: boolean; topic?: string; homework?: string }[] = [];
    sessionLogs.forEach(({ session, note }) => {
      const personal = (note || '').trim();
      const general = (session.sessionNotes || '').trim();
      const base = { date: session.date, subject: session.subject || 'نامشخص', teacher: session.teacherName, topic: session.lessonTopic, homework: session.homeworkDescription };
      if (personal) rows.push({ ...base, id: `${session.id}-p`, text: personal, personal: true });
      if (general) rows.push({ ...base, id: `${session.id}-g`, text: general, personal: false });
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [sessionLogs]);

  return (
    <div className="space-y-4" id="profile-education">
      {/* خلاصه */}
      <div className={`grid grid-cols-1 ${showWorksheets ? 'sm:grid-cols-2' : ''} gap-3`}>
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white/60 backdrop-blur-xl shadow-sm p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800"><BookOpen className="w-4 h-4" />تکالیف درسی</div>
          <div className={`mt-2 text-3xl font-black tabular-nums ${totals.total ? toneOf(overall) : 'text-slate-400'}`}>
            {totals.total ? `${fa(overall)}٪` : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totals.total ? `${fa(totals.done)} تکلیف کامل از ${fa(totals.total)} تکلیف ثبت‌شده` : 'هنوز تکلیفی ثبت نشده است'}
          </div>
        </div>
        {showWorksheets && (
          <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white/60 backdrop-blur-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-800"><ClipboardCheck className="w-4 h-4" />کاربرگ هفتگی</div>
            <div className={`mt-2 text-3xl font-black tabular-nums ${ws.rate === null ? 'text-slate-400' : toneOf(ws.rate)}`}>
              {ws.rate === null ? '—' : `${fa(ws.rate)}٪`}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {ws.rate === null ? 'هنوز سابقه‌ای ثبت نشده است' : `${fa(ws.complete)} تحویل کامل از ${fa(ws.counted)} هفته (هفته‌های غایب حساب نمی‌شود)`}
            </div>
          </div>
        )}
      </div>

      {/* تکالیف به تفکیک درس */}
      <section className={`${glass} p-4 space-y-3`} aria-label="تکالیف به تفکیک درس">
        <h3 className="text-sm font-black text-slate-900">انجام تکالیف به تفکیک درس</h3>
        {subjects.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-6 bg-slate-50/70 rounded-xl">برای این دانش‌آموز هنوز وضعیت تکلیف درسی ثبت نشده است.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {subjects.map((s) => {
              const p = pct(s.done, s.total);
              return (
                <li key={s.subject} className="rounded-2xl bg-white/70 border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800 truncate">{s.subject}</span>
                    <span className={`text-lg font-black tabular-nums ${toneOf(p)}`}>{fa(p)}٪</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden flex" role="img" aria-label={`${fa(p)} درصد تکالیف ${s.subject} انجام شده`}>
                    <span className="bg-emerald-500" style={{ width: `${pct(s.done, s.total)}%` }} />
                    <span className="bg-amber-400" style={{ width: `${pct(s.incomplete, s.total)}%` }} />
                    <span className="bg-rose-400" style={{ width: `${pct(s.notDone, s.total)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      <b className="text-emerald-700">{fa(s.done)}</b> کامل · <b className="text-amber-700">{fa(s.incomplete)}</b> ناقص · <b className="text-rose-700">{fa(s.notDone)}</b> انجام‌نشده
                    </span>
                    <span>از {fa(s.total)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* سابقه کاربرگ */}
      {showWorksheets && ws.history.length > 0 && (
        <section className={`${glass} p-4 space-y-3`} aria-label="سابقه کاربرگ">
          <h3 className="text-sm font-black text-slate-900">سابقه‌ی کاربرگ هفتگی</h3>
          <div className="flex flex-wrap gap-2">
            {ws.history.slice(0, 8).map((h) => (
              <span key={h.weekStart} className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold ${WS_TONE[h.status]}`}>
                {weekTitle(h.weekStart)} · {WORKSHEET_STATUS_LABEL[h.status]}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* یادداشت دبیران */}
      <section className="rounded-2xl border border-violet-200/80 bg-violet-50/50 backdrop-blur-xl shadow-sm p-4 space-y-3" aria-label="یادداشت دبیران">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-4 h-4 text-violet-600" />
          <h3 className="text-sm font-black text-slate-900">یادداشت دبیران در کلاس</h3>
        </div>
        {notes.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-6 bg-white/60 rounded-xl">دبیران هنوز یادداشتی ثبت نکرده‌اند.</p>
        ) : (
          <ul className="space-y-2">
            {notes.slice(0, 20).map((n) => (
              <li key={n.id} className="rounded-2xl bg-white/80 border border-white p-3 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageSquareText className="w-3.5 h-3.5 text-violet-500" />
                    {n.subject}{n.teacher && <span className="font-normal text-slate-500"> · {n.teacher}</span>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${n.personal ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                      {n.personal ? 'یادداشت برای این دانش‌آموز' : 'یادداشت جلسه'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{fa(n.date)}</span>
                  </span>
                </div>
                <p className="mt-1.5 leading-6 text-slate-700 whitespace-pre-wrap">{n.text}</p>
                {(n.topic || n.homework) && (
                  <p className="mt-1 text-[11px] text-slate-400 leading-5">
                    {n.topic && <>مبحث: {n.topic}</>}{n.topic && n.homework && ' · '}{n.homework && <>تکلیف: {n.homework}</>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
