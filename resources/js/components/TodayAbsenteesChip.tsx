import React, { useMemo, useState } from 'react';
import { UserX } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import type { Student } from '../types';
import { TrendDetailModal } from './TrendDetailModal';

/** کادر کوچک «غایبین امروز» (صبحگاه) با دسترسی سریع به فهرست نام‌ها */
export const TodayAbsenteesChip: React.FC<{ onSelectStudent?: (student: Student) => void }> = ({ onSelectStudent }) => {
  const { students, classes, morningAttendance, todayClosedReason } = useSchool();
  const [open, setOpen] = useState(false);
  const today = useMemo(() => getTodayShamsi(), []);

  const absentees = useMemo(() => {
    if (todayClosedReason) return [];
    const present = new Set(
      (morningAttendance || []).filter((r) => r.date === today.formattedDate && r.status === 'present').map((r) => r.studentId)
    );
    return students.filter((s) => !present.has(s.id));
  }, [students, morningAttendance, today.formattedDate, todayClosedReason]);

  const rows = useMemo(
    () =>
      absentees.map((s) => ({
        id: s.id,
        date: '',
        title: studentFullName(s),
        subtitle: classes.find((c) => c.id === s.classId)?.name || '—',
      })),
    [absentees, classes]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition ${
          absentees.length > 0
            ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
        }`}
        aria-label="فهرست غایبین امروز"
      >
        <UserX className="w-3.5 h-3.5" />
        <span>{todayClosedReason ? 'امروز تعطیل است' : `غایبین امروز: ${toPersianDigits(absentees.length)}`}</span>
      </button>
      {open && (
        <TrendDetailModal
          title="غایبین امروز (صبحگاه)"
          hint={today.formattedDate}
          rows={rows}
          onRowClick={onSelectStudent ? (id) => {
            const stu = students.find((s) => s.id === id);
            if (stu) { setOpen(false); onSelectStudent(stu); }
          } : undefined}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
