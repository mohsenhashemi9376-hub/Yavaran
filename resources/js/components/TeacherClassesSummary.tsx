import React, { useMemo } from 'react';
import { AttendanceSession, SchoolClass } from '../types';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { BookOpen, ClipboardList, CalendarDays, UserRound } from 'lucide-react';

interface Props {
  classes: SchoolClass[];
  sessions: AttendanceSession[];
}

const sortKey = (s: AttendanceSession) => `${toEnglishDigits(s.date || '')}|${s.createdAt || ''}`;

/** آخرین جلسه‌ی تدریس‌شده‌ی هر کلاس: درس، استاد، مبحث و تکلیف */
export const TeacherClassesSummary: React.FC<Props> = ({ classes, sessions }) => {
  const rows = useMemo(
    () =>
      classes.map((cls) => {
        const own = sessions.filter((s) => s.classId === cls.id).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
        return { cls, last: own[0] as AttendanceSession | undefined, total: own.length };
      }),
    [classes, sessions],
  );

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-black text-slate-900 text-base">آخرین جلسه‌ی هر کلاس</h3>
        <p className="text-xs text-slate-500 mt-0.5">درس و مبحث تدریس‌شده و تکلیف داده‌شده در آخرین جلسه</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rows.map(({ cls, last, total }) => (
          <div key={cls.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-extrabold text-slate-900 text-sm">{cls.name}</div>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{toPersianDigits(total)} جلسه</span>
            </div>

            {!last ? (
              <div className="text-xs text-slate-400 bg-slate-50 rounded-xl py-4 text-center">هنوز جلسه‌ای ثبت نشده است.</div>
            ) : (
              <div className="space-y-2 text-xs leading-6">
                <div className="flex items-center justify-between gap-2 text-slate-500">
                  <span className="flex items-center gap-1 min-w-0">
                    <UserRound className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate font-bold text-slate-700">{last.teacherName}</span>
                    {last.subject && <span className="truncate">· {last.subject}</span>}
                  </span>
                  <span className="flex items-center gap-1 shrink-0"><CalendarDays className="w-3.5 h-3.5" />{toPersianDigits(last.date)}</span>
                </div>
                <div className="flex items-start gap-1.5 text-slate-700">
                  <BookOpen className="w-3.5 h-3.5 text-teal-600 mt-1.5 shrink-0" />
                  <span><span className="text-slate-400">تدریس: </span>{last.lessonTopic || '—'}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-amber-600 mt-1.5 shrink-0" />
                  <span className={last.homeworkDescription?.trim() ? 'text-slate-700' : 'text-slate-400'}>
                    <span className="text-slate-400">تکلیف: </span>{last.homeworkDescription?.trim() || 'ثبت نشده'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
