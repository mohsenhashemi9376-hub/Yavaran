import React, { useState } from 'react';
import { AlertTriangle, Clock, UserX, Send, CheckCircle2 } from 'lucide-react';
import { StudentAttendanceStat, ABSENCE_ALERT_PER_MONTH, DELAY_ALERT_PER_MONTH } from '../utils/attendanceStats';
import { toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import type { Student } from '../types';

interface Props {
  stats: StudentAttendanceStat[];
  /** نمایش هشدار تأخیر (فقط معاون انضباطی؛ مدیر فقط هشدار غیبت می‌بیند) */
  showDelays: boolean;
  /** امکان ارجاع به معاون تربیتی (فقط معاون انضباطی) */
  canRefer: boolean;
  referred: Set<string>;
  monthKey: string;
  classNameOf: (classId: string) => string;
  onRefer: (stat: StudentAttendanceStat, kind: 'absence' | 'delay') => void;
  onOpenStudent?: (s: Student) => void;
  /** حداکثر ردیف نمایش داده‌شده در هر ستون پیش از «نمایش همه» */
  maxRows?: number;
}

export const referralRefId = (studentId: string, kind: 'absence' | 'delay', monthKey: string) => `ref-${studentId}-${kind}-${monthKey.replace('/', '-')}`;

/** هشدار غیبت غیرموجه (۳ روز در ماه) و تأخیر مکرر (۳ بار در ماه) با امکان ارجاع به معاون تربیتی */
export const AttendanceAlertsCard: React.FC<Props> = ({ stats, showDelays, canRefer, referred, monthKey, classNameOf, onRefer, onOpenStudent, maxRows = 5 }) => {
  const [showAllAbsence, setShowAllAbsence] = useState(false);
  const [showAllDelay, setShowAllDelay] = useState(false);
  const absence = stats.filter((s) => s.monthUnexcused >= ABSENCE_ALERT_PER_MONTH).sort((a, b) => b.monthUnexcused - a.monthUnexcused);
  const delay = showDelays ? stats.filter((s) => s.monthDelayCount >= DELAY_ALERT_PER_MONTH).sort((a, b) => b.monthDelayCount - a.monthDelayCount) : [];

  if (absence.length === 0 && delay.length === 0) {
    return (
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl px-4 py-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> این ماه هشدار فعالی برای غیبت غیرموجه یا تأخیر مکرر وجود ندارد.
      </div>
    );
  }

  const Row = ({ s, kind }: { s: StudentAttendanceStat; kind: 'absence' | 'delay' }) => {
    const done = referred.has(referralRefId(s.student.id, kind, monthKey));
    return (
      <li className="flex items-center justify-between gap-3 py-2.5">
        <button type="button" onClick={() => onOpenStudent?.(s.student)} className="text-right min-w-0 cursor-pointer">
          <div className="font-bold text-slate-900 text-sm truncate">{studentFullName(s.student)}</div>
          <div className="text-[11px] text-slate-500">
            {classNameOf(s.student.classId)} • {kind === 'absence'
              ? `${toPersianDigits(s.monthUnexcused)} روز غیبت غیرموجه این ماه`
              : `${toPersianDigits(s.monthDelayCount)} بار تأخیر این ماه`}
          </div>
        </button>
        {canRefer && (done ? (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-3 py-1 shrink-0">به معاون تربیتی ارجاع شد</span>
        ) : (
          <button type="button" onClick={() => onRefer(s, kind)} className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-3 py-1.5 cursor-pointer">
            <Send className="w-3.5 h-3.5" /> ارجاع به معاون تربیتی
          </button>
        ))}
      </li>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-rose-50/70 border-b border-rose-100 flex items-center gap-2 text-sm font-extrabold text-rose-800">
        <AlertTriangle className="w-4 h-4" /> هشدارهای این ماه
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-100">
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1"><UserX className="w-4 h-4 text-rose-600" /> غیبت غیرموجه {toPersianDigits(ABSENCE_ALERT_PER_MONTH)} روز یا بیشتر ({toPersianDigits(absence.length)} نفر)</div>
          {absence.length === 0 ? <p className="text-xs text-slate-400 py-3">موردی نیست.</p> : <ul className="divide-y divide-slate-100">{(showAllAbsence ? absence : absence.slice(0, maxRows)).map((s) => <Row key={s.student.id} s={s} kind="absence" />)}</ul>}
          {absence.length > maxRows && (
            <button type="button" onClick={() => setShowAllAbsence((v) => !v)} className="mt-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 cursor-pointer">
              {showAllAbsence ? 'نمایش کمتر' : `نمایش همه (${toPersianDigits(absence.length)})`}
            </button>
          )}
        </div>
        {showDelays && (
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1"><Clock className="w-4 h-4 text-amber-600" /> تأخیر {toPersianDigits(DELAY_ALERT_PER_MONTH)} بار یا بیشتر ({toPersianDigits(delay.length)} نفر)</div>
            {delay.length === 0 ? <p className="text-xs text-slate-400 py-3">موردی نیست.</p> : <ul className="divide-y divide-slate-100">{(showAllDelay ? delay : delay.slice(0, maxRows)).map((s) => <Row key={s.student.id} s={s} kind="delay" />)}</ul>}
            {delay.length > maxRows && (
              <button type="button" onClick={() => setShowAllDelay((v) => !v)} className="mt-1 text-[11px] font-bold text-teal-700 hover:text-teal-900 cursor-pointer">
                {showAllDelay ? 'نمایش کمتر' : `نمایش همه (${toPersianDigits(delay.length)})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
