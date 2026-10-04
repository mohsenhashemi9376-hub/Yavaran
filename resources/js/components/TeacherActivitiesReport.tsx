import React, { useMemo, useState } from 'react';
import { ArrowRight, Clock, ChevronDown, Menu } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { getDayOfWeekFromShamsi, toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { academicMonths, currentMonthKey, formatHours, monthKeyOf } from '../utils/teacherActivities';

interface Props {
  onBack: () => void;
  onOpenSidebar: () => void;
}

/** گزارش ماهانه فعالیت‌های خارج مدرسه اساتید (پنل مدیر و معاونت آموزش) */
export const TeacherActivitiesReport: React.FC<Props> = ({ onBack, onOpenSidebar }) => {
  const { teacherActivities, allUsers, updateTeacherActivity } = useSchool();
  const months = useMemo(() => academicMonths(), []);
  const [monthKey, setMonthKey] = useState(() => {
    const cur = currentMonthKey();
    return months.some((m) => m.key === cur) ? cur : months[0].key;
  });
  const [openTeacher, setOpenTeacher] = useState<string | null>(null);

  const rows = useMemo(() => {
    const byTeacher = new Map<string, typeof teacherActivities>();
    teacherActivities
      .filter((a) => monthKeyOf(a.date) === monthKey)
      .forEach((a) => byTeacher.set(a.teacherId, [...(byTeacher.get(a.teacherId) || []), a]));
    return Array.from(byTeacher.entries())
      .map(([teacherId, list]) => ({
        teacherId,
        name: allUsers.find((u) => u.id === teacherId)?.name || list[0]?.teacherName || 'نامشخص',
        list: [...list].sort((a, b) => toEnglishDigits(b.date).localeCompare(toEnglishDigits(a.date))),
        total: list.reduce((s, a) => s + (a.hours || 0), 0),
        approved: list.filter((a) => a.status !== 'pending').reduce((s, a) => s + (a.hours || 0), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [teacherActivities, allUsers, monthKey]);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 cursor-pointer"
            aria-label="بازگشت"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2.5 flex-1 min-w-0">
            <Clock className="w-6 h-6 text-sky-600" />
            <span>گزارش فعالیت خارج مدرسه اساتید</span>
          </h1>
          <button
            onClick={onOpenSidebar}
            className="lg:hidden px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-200"
          >
            <Menu className="w-4 h-4" />
            <span>منو</span>
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-slate-500 mb-1">ماه</span>
            <select
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              className="w-full text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 cursor-pointer"
            >
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} {toPersianDigits(m.year)}
                </option>
              ))}
            </select>
          </label>
          <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-3.5">
            <div className="text-xs font-bold text-sky-700">مجموع ساعات همه اساتید</div>
            <div className="text-xl font-black text-sky-900 mt-0.5">{formatHours(grandTotal)} ساعت</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-right text-xs min-w-[650px]">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">استاد</th>
                <th className="p-3 text-center">تعداد فعالیت</th>
                <th className="p-3 text-center">مجموع ساعات</th>
                <th className="p-3 text-center">ساعات تأییدشده</th>
                <th className="p-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.teacherId}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="p-3 font-bold text-slate-800">{r.name}</td>
                    <td className="p-3 text-center">{toPersianDigits(r.list.length)}</td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold">
                        {formatHours(r.total)} ساعت
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        {formatHours(r.approved)} ساعت
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setOpenTeacher(openTeacher === r.teacherId ? null : r.teacherId)}
                        className="px-2.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>جزئیات</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition ${openTeacher === r.teacherId ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  {openTeacher === r.teacherId && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={5} className="p-3">
                        <div className="space-y-2">
                          {r.list.map((a) => (
                            <div
                              key={a.id}
                              className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 flex-wrap"
                            >
                              <span className="font-bold text-slate-700 whitespace-nowrap">
                                {getDayOfWeekFromShamsi(a.date)} {toPersianDigits(a.date)}
                              </span>
                              <span className="flex-1 min-w-[180px] whitespace-normal text-slate-600">{a.title}</span>
                              <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold whitespace-nowrap">
                                {formatHours(a.hours)} ساعت
                              </span>
                              <button
                                type="button"
                                onClick={() => updateTeacherActivity(a.id, { status: a.status === 'pending' ? 'approved' : 'pending' })}
                                className={`px-3 py-1.5 rounded-xl border font-bold cursor-pointer whitespace-nowrap ${
                                  a.status === 'pending'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                {a.status === 'pending' ? 'در انتظار تأیید' : 'تأییدشده'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <div className="py-10 text-center text-xs text-slate-400">در این ماه فعالیتی ثبت نشده است.</div>}
      </div>
    </div>
  );
};
