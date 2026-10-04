import React from 'react';
import { CalendarCheck, Lock, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { toPersianDigits } from '../utils/persianDate';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** مدیریت بازه‌های ثبت نمره: فعال / قفل با سوئیچ (ویژه معاون آموزش) */
export const GradePeriodsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { gradePeriods, setGradePeriodActive } = useSchool();
  if (!isOpen) return null;

  const activeCount = gradePeriods.filter((p) => p.isActive).length;
  const groups: { title: string; tone: string; list: typeof gradePeriods }[] = [
    {
      title: 'نمرات مستمر ماهانه دبیران',
      tone: 'emerald',
      list: gradePeriods.filter((p) => !p.code.endsWith('Final')),
    },
    {
      title: 'آزمون‌های پایانی نوبت',
      tone: 'sky',
      list: gradePeriods.filter((p) => p.code.endsWith('Final')),
    },
  ];

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" dir="rtl">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-4 bg-emerald-50/70 border-b border-emerald-100 flex items-start gap-3 shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-white text-emerald-600 shadow-sm flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold text-emerald-950">بازه‌های ثبت نمره</h3>
            <p className="text-[11px] text-emerald-800/80 mt-0.5 leading-relaxed">
              دبیران فقط در بازه‌های فعال می‌توانند نمره ثبت کنند. بازه‌های قفل‌شده «هنوز باز نشده» نمایش داده می‌شوند.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="w-9 h-9 rounded-full hover:bg-white/70 text-emerald-700 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          <div className="text-xs font-bold text-slate-600">
            بازه فعال: <span className="text-emerald-700">{toPersianDigits(activeCount)}</span> از {toPersianDigits(gradePeriods.length)}
          </div>
          {groups.map((g) => (
            <div key={g.title} className="space-y-2">
              <div className={`text-[11px] font-extrabold ${g.tone === 'emerald' ? 'text-emerald-700' : 'text-sky-700'}`}>{g.title}</div>
              <div className="space-y-2">
                {g.list.map((p) => (
                  <label
                    key={p.code}
                    className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      p.isActive
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-800 whitespace-nowrap">{p.name}</span>
                      <span className="flex items-center gap-1 text-[11px] mt-0.5">
                        {p.isActive ? (
                          <span className="text-emerald-700 font-bold">فعال — دبیران می‌توانند نمره ثبت کنند</span>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-500">بسته / قفل</span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="relative inline-flex shrink-0">
                      <input
                        type="checkbox"
                        checked={p.isActive}
                        onChange={(e) => setGradePeriodActive(p.code, e.target.checked)}
                        className="peer sr-only"
                        aria-label={`فعال‌سازی ${p.name}`}
                      />
                      <span className="w-12 h-7 rounded-full bg-slate-200 peer-checked:bg-emerald-500 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-200" />
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:-translate-x-5" />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-extrabold cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
