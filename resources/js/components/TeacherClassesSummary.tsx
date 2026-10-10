import React, { useEffect, useMemo, useState } from 'react';
import { AttendanceSession, SchoolClass } from '../types';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { BookOpen, ClipboardList, CalendarDays, UserRound, X, ListChecks } from 'lucide-react';

interface Props {
  classes: SchoolClass[];
  sessions: AttendanceSession[];
}

const RECENT = 5;
const sortKey = (s: AttendanceSession) => `${toEnglishDigits(s.date || '')}|${s.createdAt || ''}`;
const hasHomework = (s: AttendanceSession) => Boolean((s.homeworkDescription || '').trim());

const SessionLine: React.FC<{ s: AttendanceSession; showSubject?: boolean }> = ({ s, showSubject = true }) => (
  <li className="bg-slate-50/70 rounded-xl border border-slate-100 px-3 py-2.5 space-y-1 text-xs leading-6">
    <div className="flex items-center justify-between gap-2 text-slate-500">
      <span className="flex items-center gap-1 min-w-0">
        <UserRound className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate font-bold text-slate-700">{s.teacherName}</span>
        {showSubject && s.subject && <span className="truncate">· {s.subject}</span>}
      </span>
      <span className="flex items-center gap-1 shrink-0"><CalendarDays className="w-3.5 h-3.5" />{toPersianDigits(s.date)}</span>
    </div>
    <div className="flex items-start gap-1.5 text-slate-700">
      <BookOpen className="w-3.5 h-3.5 text-teal-600 mt-1.5 shrink-0" />
      <span><span className="text-slate-400">تدریس: </span>{s.lessonTopic || '—'}</span>
    </div>
    <div className="flex items-start gap-1.5">
      <ClipboardList className="w-3.5 h-3.5 text-amber-600 mt-1.5 shrink-0" />
      <span className={hasHomework(s) ? 'text-slate-700' : 'text-slate-400'}>
        <span className="text-slate-400">تکلیف: </span>{hasHomework(s) ? s.homeworkDescription!.trim() : 'ثبت نشده'}
      </span>
    </div>
  </li>
);

/** همه‌ی جلسات ثبت‌شده‌ی یک کلاس به تفکیک درس: مبحث تدریس و تکلیف هر جلسه */
const ClassSessionsModal: React.FC<{ cls: SchoolClass; sessions: AttendanceSession[]; onClose: () => void }> = ({ cls, sessions, onClose }) => {
  const [subject, setSubject] = useState('all');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const groups = useMemo(() => {
    const map = new Map<string, AttendanceSession[]>();
    sessions.forEach((s) => {
      const key = s.subject || 'بدون درس';
      map.set(key, [...(map.get(key) || []), s]);
    });
    return Array.from(map, ([name, list]) => ({
      name,
      list,
      homework: list.filter(hasHomework).length,
      teachers: Array.from(new Set(list.map((s) => s.teacherName).filter(Boolean))),
    })).sort((a, b) => b.list.length - a.list.length);
  }, [sessions]);

  const shown = subject === 'all' ? groups : groups.filter((g) => g.name === subject);
  const totalHomework = sessions.filter(hasHomework).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()} dir="rtl">
      <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden" role="dialog" aria-modal="true">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900">جلسات و تکالیف کلاس {cls.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {toPersianDigits(sessions.length)} جلسه ثبت‌شده • {toPersianDigits(totalHomework)} جلسه دارای تکلیف • {toPersianDigits(groups.length)} درس
            </p>
          </div>
          <button onClick={onClose} aria-label="بستن" className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {groups.length > 1 && (
          <div className="px-5 py-3 border-b border-slate-100 flex gap-1.5 flex-wrap">
            {[{ name: 'all', label: 'همه دروس', n: sessions.length }, ...groups.map((g) => ({ name: g.name, label: g.name, n: g.list.length }))].map((t) => (
              <button key={t.name} onClick={() => setSubject(t.name)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer ${subject === t.name ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {t.label} <span className="opacity-70">{toPersianDigits(t.n)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto p-5 space-y-5">
          {sessions.length === 0 && <div className="py-10 text-center text-sm text-slate-400">هنوز جلسه‌ای برای این کلاس ثبت نشده است.</div>}
          {shown.map((g) => (
            <section key={g.name} className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="font-extrabold text-slate-900 text-sm">{g.name}</h4>
                <div className="text-[11px] text-slate-500">
                  {toPersianDigits(g.list.length)} جلسه • {toPersianDigits(g.homework)} تکلیف{g.teachers.length > 0 ? ` • ${g.teachers.join('، ')}` : ''}
                </div>
              </div>
              <ul className="space-y-2">{g.list.map((s) => <SessionLine key={s.id} s={s} showSubject={false} />)}</ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

/** کادر هر کلاس: ۵ جلسه‌ی اخیر + دکمه‌ی مشاهده‌ی همه‌ی جلسات و تکالیف */
export const TeacherClassesSummary: React.FC<Props> = ({ classes, sessions }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      classes.map((cls) => {
        const own = sessions.filter((s) => s.classId === cls.id).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
        const recent = own.slice(0, RECENT);
        return { cls, own, recent, homework: recent.filter(hasHomework).length };
      }),
    [classes, sessions],
  );
  const open = rows.find((r) => r.cls.id === openId);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-black text-slate-900 text-base">وضعیت جلسات هر کلاس</h3>
        <p className="text-xs text-slate-500 mt-0.5">۵ جلسهٔ اخیر هر کلاس با مبحث تدریس‌شده و تکلیف</p>
      </div>

      <div data-stagger className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {rows.map(({ cls, own, recent, homework }) => (
          <div key={cls.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-extrabold text-slate-900 text-sm">{cls.name}</div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className="text-teal-800 bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5">{toPersianDigits(own.length)} جلسه ثبت‌شده</span>
                {recent.length > 0 && (
                  <span className="text-amber-800 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                    تکلیف در {toPersianDigits(homework)} از {toPersianDigits(recent.length)} جلسهٔ اخیر
                  </span>
                )}
              </div>
            </div>

            {recent.length === 0 ? (
              <div className="text-xs text-slate-400 bg-slate-50 rounded-xl py-4 text-center">هنوز جلسه‌ای ثبت نشده است.</div>
            ) : (
              <ul className="space-y-2">{recent.map((s) => <SessionLine key={s.id} s={s} />)}</ul>
            )}

            {own.length > 0 && (
              <button onClick={() => setOpenId(cls.id)}
                className="w-full h-10 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <ListChecks className="w-4 h-4" />
                آمار کامل جلسات و تکالیف به تفکیک درس ({toPersianDigits(own.length)})
              </button>
            )}
          </div>
        ))}
      </div>

      {open && <ClassSessionsModal cls={open.cls} sessions={open.own} onClose={() => setOpenId(null)} />}
    </div>
  );
};
