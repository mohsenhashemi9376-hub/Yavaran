import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, ChevronDown, FileSpreadsheet, UserCheck } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { getShamsiWeekRange, getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { hasPermission } from '../utils/permissions';
import { computeAtRiskList, RISK_MIN_SCORE, RISK_MIN_SIGNALS } from '../utils/studentRisk';
import { studentFullName } from '../utils/studentName';
import { Student } from '../types';

/**
 * فهرست هفتگی «دانش‌آموز در خطر» برای معاون تربیتی: امتیاز ترکیبی چند نشانه‌ی هم‌زمان
 * (غیبت، تأخیر، انضباط، افت نمره، کاربرگ، غیبت ولی، مشاهده‌ی عاطفی/خانوادگی).
 */
export const AtRiskWeeklyList: React.FC<{ students: Student[]; onSelectStudent?: (s: Student) => void }> = ({ students, onSelectStudent }) => {
  const { classes, morningDelays, morningAttendance, schoolAbsences, sessions, academicGrades, observations, nurturingLocked, parentMeetings, worksheets, worksheetWeeks, currentUser } = useSchool();
  const [open, setOpen] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  const canObs = !nurturingLocked && hasPermission(currentUser, 'counseling-report');
  const canParents = hasPermission(currentUser, 'parent-meetings') || hasPermission(currentUser, 'view-parent-meetings');
  const canWorksheets = hasPermission(currentUser, 'view-worksheets') || hasPermission(currentUser, 'manage-worksheets');

  const list = useMemo(() => computeAtRiskList(students, {
    morningDelays, morningAttendance, schoolAbsences, sessions, academicGrades,
    observations: canObs ? observations : undefined,
    parentMeetings: canParents ? parentMeetings : undefined,
    worksheets: canWorksheets ? worksheets : undefined,
    worksheetWeeks: canWorksheets ? worksheetWeeks : undefined,
  }), [students, morningDelays, morningAttendance, schoolAbsences, sessions, academicGrades, observations, parentMeetings, worksheets, worksheetWeeks, canObs, canParents, canWorksheets]);

  const week = getShamsiWeekRange(getTodayShamsi().formattedDate);
  const className = (id: string) => classes.find((c) => c.id === id)?.name || '—';

  const exportExcel = () => {
    const rows = list.map((r, i) => ({
      'ردیف': i + 1,
      'دانش‌آموز': studentFullName(r.student),
      'کلاس': className(r.student.classId),
      'امتیاز خطر': r.score,
      'سطح': r.level === 'high' ? 'بالا' : 'متوسط',
      'نشانه‌ها': r.signals.map((s) => s.label).join(' | '),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'دانش‌آموزان در خطر');
    XLSX.writeFile(wb, `دانش‌آموزان_در_خطر_${getTodayShamsi().formattedDate.replace(/\//g, '-')}.xlsx`);
  };

  return (
    <section className="bg-white rounded-2xl border border-rose-200 shadow-xs" aria-label="فهرست هفتگی دانش‌آموزان در خطر" id="at-risk-weekly">
      <div className="flex items-center gap-2 flex-wrap p-4">
        <span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></span>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900">دانش‌آموزان در خطر — فهرست هفتگی</h3>
          <p className="text-[11px] text-slate-500">هفته‌ی {week.title} · {toPersianDigits(list.length)} دانش‌آموز</p>
        </div>
        <div className="mr-auto flex items-center gap-1.5">
          <button type="button" onClick={() => setShowHelp((v) => !v)} className="!min-h-0 h-8 px-2.5 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">معیار</button>
          <button type="button" onClick={exportExcel} disabled={list.length === 0} className="!min-h-0 h-8 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer">
            <FileSpreadsheet className="w-3.5 h-3.5" /> اکسل
          </button>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="باز و بسته کردن" className="!min-h-0 w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center cursor-pointer">
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {showHelp && (
        <p className="mx-4 mb-3 text-[11px] leading-6 text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
          هر نشانه امتیازی دارد: غیبت غیرموجه و تأخیر در ۳۰ روز اخیر، نمره انضباط، افت میانگین نمره‌ی مستمر ماهانه، کاربرگ‌های پیاپی ناقص، غیبت ولی در جلسات عمومی و مشاهده‌ی عاطفی/خانوادگی در ۲ هفته‌ی اخیر.
          دانش‌آموز وقتی در فهرست می‌آید که دست‌کم {toPersianDigits(RISK_MIN_SIGNALS)} نشانه‌ی هم‌زمان و مجموع امتیاز {toPersianDigits(RISK_MIN_SCORE)} یا بیشتر داشته باشد. نشانه‌هایی که مجوز دیدنشان را ندارید محاسبه نمی‌شوند.
        </p>
      )}

      {open && (
        list.length === 0 ? (
          <p className="px-4 pb-5 text-xs text-emerald-700 font-bold">این هفته دانش‌آموزی با چند نشانه‌ی هم‌زمان وجود ندارد.</p>
        ) : (
          <ul className="px-4 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {list.map((r) => (
              <li key={r.student.id} className={`rounded-xl border p-3 space-y-2 ${r.level === 'high' ? 'border-rose-300 bg-rose-50/40' : 'border-amber-200 bg-amber-50/30'}`}>
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 w-9 h-9 rounded-lg font-black text-sm flex items-center justify-center tabular-nums ${r.level === 'high' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>{toPersianDigits(r.score)}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{studentFullName(r.student)}</div>
                    <div className="text-[11px] text-slate-500">{className(r.student.classId)} · خطر {r.level === 'high' ? 'بالا' : 'متوسط'}</div>
                  </div>
                  {onSelectStudent && (
                    <button type="button" onClick={() => onSelectStudent(r.student)} title="پرونده و خط زمانی" aria-label={`پرونده ${studentFullName(r.student)}`} className="mr-auto p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer">
                      <UserCheck className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {r.signals.map((s) => (
                    <li key={s.key} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700">{s.label}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
};
