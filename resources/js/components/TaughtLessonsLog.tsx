import React from 'react';
import { AttendanceSession } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { BookOpen, ClipboardList } from 'lucide-react';

interface TaughtLessonsLogProps {
  sessions: AttendanceSession[];
  showClassName?: (classId: string) => string | undefined;
  limit?: number;
}

/** فهرست عنوان درس تدریس‌شده و تکلیف هر جلسه (ثبت‌شده توسط استاد هنگام حضور و غیاب) */
export const TaughtLessonsLog: React.FC<TaughtLessonsLogProps> = ({ sessions, showClassName, limit }) => {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const items = limit ? sorted.slice(0, limit) : sorted;

  if (items.length === 0) {
    return <div className="text-xs text-slate-500 text-center py-4">هنوز جلسه‌ای ثبت نشده است.</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((s) => {
        const homework = s.homeworkDescription?.trim();
        const className = showClassName?.(s.classId);
        return (
          <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold font-mono text-slate-900">{toPersianDigits(s.date)}</span>
              <span className="text-[10px] text-slate-500">
                {className ? `${className} • ` : ''}{s.subject || 'کلاس درس'} • دبیر: {s.teacherName}
              </span>
            </div>
            <div className="flex items-start gap-1.5 text-slate-700">
              <BookOpen className="w-3.5 h-3.5 mt-0.5 text-teal-700 shrink-0" />
              <span>عنوان درس: <b>{s.lessonTopic?.trim() || 'عنوان ثبت نشده'}</b></span>
            </div>
            <div className={`flex items-start gap-1.5 ${homework ? 'text-slate-700' : 'text-slate-400'}`}>
              <ClipboardList className="w-3.5 h-3.5 mt-0.5 text-amber-700 shrink-0" />
              <span>تکلیف: <b>{homework || 'تکلیفی داده نشده'}</b></span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
