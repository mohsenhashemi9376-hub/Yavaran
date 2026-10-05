import React, { useMemo, useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { TaughtLessonsLog } from './TaughtLessonsLog';
import { toPersianDigits } from '../utils/persianDate';
import { BookOpen } from 'lucide-react';

/** درس‌های تدریس‌شده و تکالیف داده‌شده در کلاس‌های مربی (ذیل «آموزش و انضباط») */
export const TaughtLessonsView: React.FC = () => {
  const { classes, nurturingClasses, sessions, currentUser } = useSchool();
  const availableClasses = currentUser?.role === 'coach' ? nurturingClasses || [] : classes;
  const [selectedClassId, setSelectedClassId] = useState('all');

  const visibleSessions = useMemo(() => {
    const ids = new Set(availableClasses.map((c) => c.id));
    return sessions.filter((s) => (selectedClassId === 'all' ? ids.has(s.classId) : s.classId === selectedClassId));
  }, [sessions, availableClasses, selectedClassId]);

  return (
    <div className="space-y-4 font-['Vazirmatn',sans-serif]">
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-teal-800" />
          <span>درس‌های تدریس‌شده و تکالیف داده‌شده</span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600">کلاس:</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none"
          >
            <option value="all">همه کلاس‌ها ({toPersianDigits(availableClasses.length)})</option>
            {availableClasses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <TaughtLessonsLog sessions={visibleSessions} showClassName={(id) => classes.find((c) => c.id === id)?.name} />
    </div>
  );
};
