import React, { useMemo, useState } from 'react';
import { AttendanceSession, SchoolClass, User } from '../types';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { BookOpen, ClipboardList, Search, GraduationCap, CalendarDays } from 'lucide-react';

interface Props {
  teachers: User[];
  classes: SchoolClass[];
  sessions: AttendanceSession[];
}

const sortKey = (s: AttendanceSession) => `${toEnglishDigits(s.date || '')}|${s.createdAt || ''}`;

/** خلاصه وضعیت کلاس‌های اساتید: چه چیزی تدریس شده و چه تکلیفی داده شده است */
export const TeacherClassesSummary: React.FC<Props> = ({ teachers, classes, sessions }) => {
  const [query, setQuery] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);

  const rows = useMemo(() => {
    const classNameOf = new Map(classes.map((c) => [c.id, c.name]));
    return teachers
      .map((t) => {
        const own = sessions.filter((s) => s.teacherId === t.id).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
        const withHomework = own.filter((s) => (s.homeworkDescription || '').trim()).length;
        return {
          teacher: t,
          total: own.length,
          withHomework,
          recent: own.slice(0, 3).map((s) => ({ ...s, className: classNameOf.get(s.classId) || '—' })),
        };
      })
      .filter((r) => (!onlyActive || r.total > 0) && (!query.trim() || r.teacher.name.includes(query.trim()) || (r.teacher.subject || '').includes(query.trim())))
      .sort((a, b) => b.total - a.total || a.teacher.name.localeCompare(b.teacher.name, 'fa'));
  }, [teachers, classes, sessions, query, onlyActive]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-slate-900 text-base">خلاصه وضعیت کلاس‌های اساتید</h3>
          <p className="text-xs text-slate-500 mt-0.5">آخرین مباحث تدریس‌شده و تکالیف داده‌شده هر استاد</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی استاد یا درس…"
              className="h-10 w-52 text-xs bg-slate-50 rounded-xl pr-9 pl-3 outline-none focus:bg-white focus:ring-4 focus:ring-teal-100"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="accent-teal-700" />
            فقط اساتید دارای جلسه
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">استادی یافت نشد.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {rows.map(({ teacher, total, withHomework, recent }) => (
            <div key={teacher.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 text-white flex items-center justify-center font-extrabold shrink-0">
                  {teacher.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 text-sm truncate">{teacher.name}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                    <GraduationCap className="w-3 h-3" />
                    {teacher.subjectSpecialty || teacher.subject || 'عمومی'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold">
                  <span className="px-2 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-100">{toPersianDigits(total)} جلسه</span>
                  <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-100">{toPersianDigits(withHomework)} تکلیف</span>
                </div>
              </div>

              {recent.length === 0 ? (
                <div className="text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200 py-3 text-center">
                  هنوز جلسه‌ای ثبت نکرده است.
                </div>
              ) : (
                <ul className="space-y-2">
                  {recent.map((s) => (
                    <li key={s.id} className="bg-white rounded-xl border border-slate-100 px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="font-bold text-slate-800">{s.className}{s.subject ? ` · ${s.subject}` : ''}</span>
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{toPersianDigits(s.date)}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-xs text-slate-700 leading-6">
                        <BookOpen className="w-3.5 h-3.5 text-teal-600 mt-1.5 shrink-0" />
                        <span><span className="text-slate-400">تدریس: </span>{s.lessonTopic || '—'}</span>
                      </div>
                      <div className="flex items-start gap-1.5 text-xs leading-6">
                        <ClipboardList className="w-3.5 h-3.5 text-amber-600 mt-1.5 shrink-0" />
                        <span className={s.homeworkDescription?.trim() ? 'text-slate-700' : 'text-slate-400'}>
                          <span className="text-slate-400">تکلیف: </span>{s.homeworkDescription?.trim() || 'ثبت نشده'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
