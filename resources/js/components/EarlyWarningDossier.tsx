import React, { useMemo } from 'react';
import { AlertTriangle, ChevronLeft, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { computeEarlyWarnings, WARNING_BADGE_CLASS } from '../utils/earlyWarning';
import { toPersianDigits } from '../utils/persianDate';

/** فهرست زنده دانش‌آموزان نیازمند مداخله (سیستم هشدار زودهنگام) */
export function useEarlyWarnings() {
  const { students, classes, sessions, morningAttendance, morningDelays, schoolAbsences, academicGrades, gradePeriods } = useSchool();
  return useMemo(
    () =>
      computeEarlyWarnings({
        students,
        classes,
        sessions,
        morningAttendance: morningAttendance || [],
        morningDelays: morningDelays || [],
        schoolAbsences: schoolAbsences || [],
        academicGrades,
        gradePeriods,
      }),
    [students, classes, sessions, morningAttendance, morningDelays, schoolAbsences, academicGrades, gradePeriods]
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStudent?: (student: Student, tab?: 'overview' | 'info' | 'attendance' | 'discipline' | 'grades') => void;
}

export const EarlyWarningDossier: React.FC<ModalProps> = ({ isOpen, onClose, onSelectStudent }) => {
  const warnings = useEarlyWarnings();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
      <div className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-4 bg-gradient-to-l from-amber-50/80 to-rose-50/70 border-b border-amber-100 flex items-start gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-white text-amber-600 shadow-sm flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold text-slate-900">پرونده هشدار زودهنگام</h3>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              ۳ غیبت متوالی • بیش از ۲ تأخیر در هفته جاری • افت میانگین بیش از ۲ نمره نسبت به بازه قبلی
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن" className="w-9 h-9 rounded-full hover:bg-white/70 text-slate-500 flex items-center justify-center cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-2.5">
          {warnings.length === 0 ? (
            <div className="py-12 text-center text-sm text-emerald-700 bg-emerald-50/60 border border-emerald-200 rounded-2xl">
              هیچ دانش‌آموزی نیازمند مداخله فوری نیست.
            </div>
          ) : (
            warnings.map((w) => (
              <div key={w.student.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 sm:w-56 shrink-0">
                  <div className="font-extrabold text-slate-900 text-sm whitespace-nowrap">
                    {w.student.lastName} {w.student.firstName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">{w.className}</div>
                </div>
                <div className="flex-1 flex flex-wrap gap-1.5">
                  {w.items.map((it) => (
                    <span key={it.type} className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${WARNING_BADGE_CLASS[it.type]}`}>
                      {it.label}
                    </span>
                  ))}
                </div>
                {onSelectStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectStudent(w.student, it_tab(w.items.map((i) => i.type)));
                    }}
                    className="shrink-0 min-h-[40px] px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <span>پرونده و اقدام</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const it_tab = (types: string[]): 'attendance' | 'grades' => (types.includes('grade_drop') && types.length === 1 ? 'grades' : 'attendance');

/** دکمه/بج هشدار زودهنگام با شمارنده زنده */
export const EarlyWarningPill: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const warnings = useEarlyWarnings();
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 rounded-2xl bg-gradient-to-l from-amber-50 to-rose-50 hover:from-amber-100/70 hover:to-rose-100/60 text-amber-900 border border-amber-200 text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
    >
      <AlertTriangle className="w-4 h-4 text-amber-600" />
      <span>هشدار زودهنگام</span>
      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold">
        {toPersianDigits(warnings.length)} مورد
      </span>
    </button>
  );
};
