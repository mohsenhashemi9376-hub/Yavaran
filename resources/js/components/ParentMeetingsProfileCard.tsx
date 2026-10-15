import React, { useMemo } from 'react';
import { Check, MessageSquareText, UsersRound, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';
import { hasPermission } from '../utils/permissions';
import { ATTENDANCE_STATE_LABELS, PARENT_MEETING_LABELS, currentAcademicStartYear, studentParentSummary } from '../utils/parentMeetings';

/** آمار تجمیعی حضور پدر و مادر در سه جلسه‌ی عمومی أولیا؛ در تب «حضور و غیاب» پرونده‌ی فردی */
export const ParentMeetingsProfileCard: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { parentMeetings, currentUser } = useSchool();
  const allowed = hasPermission(currentUser, 'parent-meetings') || hasPermission(currentUser, 'view-parent-meetings');
  const year = currentAcademicStartYear();
  const sum = useMemo(() => studentParentSummary(studentId, parentMeetings), [studentId, parentMeetings]);
  if (!allowed) return null;

  const Bar: React.FC<{ label: string; count: number; tone: string }> = ({ label, count, tone }) => (
    <div className="flex-1 min-w-[8rem]">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
        <span>{label}</span>
        <span className="font-black text-slate-900">
          {toPersianDigits(count)} از {toPersianDigits(sum.recorded)} جلسه
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${sum.recorded ? (count / sum.recorded) * 100 : 0}%` }} />
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-l from-teal-50/60 via-white to-emerald-50/50 p-4 space-y-3.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
          <UsersRound className="w-4 h-4" />
        </span>
        <h3 className="text-sm font-black text-slate-900">حضور أولیا در جلسات عمومی</h3>
        <span className="text-[11px] text-slate-500">سال تحصیلی {toPersianDigits(`${year}-${year + 1}`)}</span>
        {sum.neverAttended && (
          <span className="mr-auto px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold">در هیچ جلسه‌ای ولی حاضر نبوده است</span>
        )}
      </div>

      {sum.recorded === 0 ? (
        <p className="text-xs text-slate-500">هنوز حضور أولیا برای این دانش‌آموز ثبت نشده است.</p>
      ) : (
        <div className="flex gap-4 flex-wrap">
          <Bar label="حضور پدر" count={sum.fatherCount} tone="bg-sky-500" />
          <Bar label="حضور مادر" count={sum.motherCount} tone="bg-violet-500" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {sum.meetings.map(({ no, record, state }) => {
          const done = state !== 'unrecorded';
          return (
            <div key={no} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">{PARENT_MEETING_LABELS[no]}</span>
                {done && record?.date && <span className="text-[10px] font-mono text-slate-400">{toPersianDigits(record.date)}</span>}
              </div>
              {done ? (
                <div className="flex items-center gap-1.5">
                  {([['پدر', record?.father, 'sky'], ['مادر', record?.mother, 'violet']] as const).map(([lab, on, tone]) => (
                    <span
                      key={lab}
                      className={`flex-1 h-8 rounded-lg text-[11px] font-extrabold inline-flex items-center justify-center gap-1 border ${
                        on
                          ? tone === 'sky'
                            ? 'bg-sky-50 border-sky-200 text-sky-800'
                            : 'bg-violet-50 border-violet-200 text-violet-800'
                          : 'bg-rose-50 border-rose-200 text-rose-600'
                      }`}
                    >
                      {on ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      {lab}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="h-8 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-[11px] font-bold text-slate-400 flex items-center justify-center">
                  {ATTENDANCE_STATE_LABELS.unrecorded}
                </div>
              )}
              {record?.note && (
                <div className="text-[11px] leading-5 text-amber-900 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1.5">
                  <MessageSquareText className="w-3 h-3 inline ml-1 text-amber-600" />
                  {record.note}
                  {record.noteBy && <span className="block text-[10px] text-amber-700/80 mt-0.5">— {record.noteBy}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
