import React, { useMemo } from 'react';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import {
  PARENT_MEETING_LABELS,
  PARENT_MEETING_NUMBERS,
  attendanceState,
  currentAcademicStartYear,
  isMeetingHeld,
} from '../utils/parentMeetings';

/**
 * هشدار برای مدیر و معاون اجرایی: جلسه‌ای که برگزار شده (بسته شده یا دست‌کم برای یک نفر ثبت شده)
 * ولی حضور و غیاب پدر و مادر برخی دانش‌آموزان در آن ثبت نشده است.
 */
export const ParentMeetingAlertsCard: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { currentUser, students, classes, parentMeetings, parentMeetingStates } = useSchool();
  const allowed = currentUser.role === 'admin' || currentUser.role === 'vice_principal';
  const yearKey = String(currentAcademicStartYear());

  const alerts = useMemo(() => {
    if (!allowed) return [];
    const realClassIds = new Set(classes.filter((c) => !c.isWorkshop).map((c) => c.id));
    const scoped = students.filter((s) => realClassIds.has(s.classId));
    return PARENT_MEETING_NUMBERS.filter((n) => isMeetingHeld(n, parentMeetingStates, parentMeetings, yearKey)).flatMap((n) => {
      const recs = new Map(parentMeetings.filter((r) => r.academicYear === yearKey && r.meetingNo === n).map((r) => [r.studentId, r]));
      const missing = scoped.filter((s) => attendanceState(recs.get(s.id)) === 'unrecorded');
      if (missing.length === 0) return [];
      const byClass = new Map<string, number>();
      missing.forEach((s) => byClass.set(s.classId, (byClass.get(s.classId) || 0) + 1));
      const classNames = Array.from(byClass.entries()).map(([id, count]) => `${classes.find((c) => c.id === id)?.name || '—'} (${toPersianDigits(count)})`);
      const closed = !!parentMeetingStates.find((st) => st.academicYear === yearKey && st.meetingNo === n && !st.open);
      return [{ no: n, count: missing.length, classNames, closed }];
    });
  }, [allowed, students, classes, parentMeetings, parentMeetingStates, yearKey]);

  if (alerts.length === 0) return null;

  return (
    <section className="rounded-3xl border border-rose-200/90 bg-rose-50/70 backdrop-blur-xl shadow-sm p-4 sm:p-5 space-y-3" aria-label="هشدار حضور أولیا">
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5" /></span>
        <h3 className="font-bold text-sm text-slate-900">هشدار حضور أولیا در جلسات برگزارشده</h3>
      </div>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li key={a.no} className="rounded-2xl bg-white/70 backdrop-blur border border-rose-100 px-3.5 py-3 text-xs leading-6 text-slate-700">
            <b className="text-rose-700">{PARENT_MEETING_LABELS[a.no]}</b> برگزار شده است، اما حضور و غیاب پدر و مادر{' '}
            <b className="text-rose-700">{toPersianDigits(a.count)} دانش‌آموز</b> ثبت نشده است
            {a.closed && ' و جلسه بسته است (برای تکمیل باید دوباره باز شود)'}.
            <div className="text-[11px] text-slate-500 mt-1">{a.classNames.join('، ')}</div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onOpen} className="h-11 w-full sm:w-auto px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer">
        مشاهده و تکمیل حضور أولیا <ChevronLeft className="w-4 h-4" />
      </button>
    </section>
  );
};
