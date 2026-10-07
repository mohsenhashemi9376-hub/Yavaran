import React, { useMemo, useState } from 'react';
import { FlaskConical, Hammer, Users, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Workshop } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { compareByLastName } from '../utils/morningAttendance';
import { gradeLevelOfClass, workshopTitle } from '../utils/workshops';
import { studentFullName } from '../utils/studentName';

/** کارگاه‌های انتخابی که استاد/مربی مسئول آن‌هاست؛ فهرست اعضا فقط از پایه همان کارگاه */
export const MyWorkshopsSection: React.FC = () => {
  const { workshops, students, classes, currentUser } = useSchool();
  const [open, setOpen] = useState<Workshop | null>(null);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const mine = workshops.filter((w) => w.teacherId === currentUser.id);
  if (mine.length === 0) return null;

  const roster = (w: Workshop) =>
    students
      .filter((s) => w.studentIds.includes(s.id) && gradeLevelOfClass(classById.get(s.classId)) === w.gradeLevel)
      .sort(compareByLastName);

  return (
    <div className="space-y-3" dir="rtl">
      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
        <Users className="w-5 h-5 text-teal-700" />
        <span>کارگاه‌های انتخابی من</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {mine.map((w) => {
          const Icon = w.category === 'scientific' ? FlaskConical : Hammer;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => setOpen(w)}
              className={`text-right p-4 rounded-2xl border hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer ${
                w.gradeLevel === 8 ? 'bg-sky-50/60 border-sky-200/80' : 'bg-violet-50/60 border-violet-200/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-teal-600 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="font-bold text-slate-900 text-sm">{workshopTitle(w)}</div>
              </div>
              <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-3 flex-wrap">
                <span className="whitespace-nowrap">{toPersianDigits(roster(w).length)} نفر</span>
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 pt-5 pb-3 bg-teal-50/70 border-b border-teal-100 flex items-center gap-3 shrink-0">
              <h3 className="flex-1 text-base font-extrabold text-slate-900">{workshopTitle(open)}</h3>
              <button type="button" onClick={() => setOpen(null)} aria-label="بستن" className="w-9 h-9 rounded-full hover:bg-white/70 text-slate-500 flex items-center justify-center cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100">
                {roster(open).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="w-6 text-center text-xs font-bold text-slate-400">{toPersianDigits(i + 1)}</span>
                    <span className="flex-1 font-semibold text-slate-800 whitespace-nowrap">{studentFullName(s)}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[11px] text-slate-600 whitespace-nowrap">{classById.get(s.classId)?.name}</span>
                  </div>
                ))}
                {roster(open).length === 0 && <div className="py-8 text-center text-xs text-slate-400">دانش‌آموزی تخصیص داده نشده است.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
