import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Award, ChevronLeft, FileSpreadsheet, Search } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Modal } from './ui';
import { Student, StudentAttendanceRecord } from '../types';
import { absenceEventsOf, delayEventsOf } from '../utils/attendanceStats';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { studentFullName, compareStudents } from '../utils/studentName';

/** دانش‌آموزی که در سامانه هیچ غیبت (موجه و غیرموجه، روزانه یا کلاسی)، تأخیر و مورد انضباطی ندارد */
export function useDisciplineExcellence() {
  const { students, classes, sessions, morningAttendance, morningDelays, schoolAbsences } = useSchool();
  return useMemo(() => {
    const src = {
      morningDelays: morningDelays || [],
      morningAttendance: morningAttendance || [],
      schoolAbsences: schoolAbsences || [],
      sessions: sessions || [],
    };
    // غیبت کلاسی (زنگ‌ها)؛ در آمار روزانه نمی‌آید ولی مورد انضباطی است
    const classAbsent = new Set<string>();
    (sessions || []).forEach((sess) => {
      if (!sess.records) return;
      const recs = (Array.isArray(sess.records) ? sess.records : Object.entries(sess.records).map(([id, r]) => ({ ...(r as object), studentId: id }))) as StudentAttendanceRecord[];
      recs.forEach((r) => { if (r.status === 'absent') classAbsent.add(r.studentId); });
    });

    const clean = (s: Student) =>
      !classAbsent.has(s.id)
      && delayEventsOf(s, src).length === 0
      && absenceEventsOf(s, src).length === 0
      && (s.disciplinaryNotes || []).length === 0
      && (s.disciplinaryStatus === undefined || s.disciplinaryStatus === 'normal')
      && (s.disciplineScore ?? s.disciplinaryScore ?? 20) >= 20;

    const list = students.filter(clean).sort(compareStudents);
    const byClass = classes
      .map((c) => ({ cls: c, count: list.filter((s) => s.classId === c.id).length, size: students.filter((s) => s.classId === c.id).length }))
      .filter((x) => x.size > 0);
    return { list, byClass, total: students.length, classes };
  }, [students, classes, sessions, morningAttendance, morningDelays, schoolAbsences]);
}

/** «ممتازین انضباطی»: فقط برای مدیر، معاون تربیتی و معاون انضباطی نمایش داده می‌شود */
export const DisciplineExcellenceCard: React.FC<{ onSelectStudent?: (s: Student) => void }> = ({ onSelectStudent }) => {
  const { isAdmin, isDisciplinaryVice, isNurturingVice, classes: allClasses } = useSchool();
  const { list, byClass, total } = useDisciplineExcellence();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [classId, setClassId] = useState('');
  if (!(isAdmin || isDisciplinaryVice || isNurturingVice)) return null;

  const className = (id: string) => allClasses.find((c) => c.id === id)?.name || '—';
  const percent = total ? Math.round((list.length / total) * 100) : 0;
  const shown = list.filter((s) => (!classId || s.classId === classId) && (!q.trim() || studentFullName(s).includes(q.trim())));

  const exportExcel = () => {
    const rows = shown.map((s, i) => ({ 'ردیف': i + 1, 'دانش‌آموز': studentFullName(s), 'کلاس': className(s.classId), 'کد دانش‌آموزی': s.studentCode || '' }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ rightToLeft: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'ممتازین انضباطی');
    XLSX.writeFile(wb, `ممتازین_انضباطی_${getTodayShamsi().formattedDate.replace(/\//g, '-')}.xlsx`);
  };

  return (
    <>
      <section className="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 via-yellow-50 to-white shadow-xs p-5 space-y-3" aria-label="ممتازین انضباطی">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white flex items-center justify-center shadow-sm">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">ممتازین انضباطی</h3>
              <p className="text-[11px] text-slate-500 leading-5">دانش‌آموزانی که هیچ غیبت، تأخیر یا مورد انضباطی ندارند</p>
            </div>
          </div>
          <div className="text-left">
            <div className="text-2xl font-black text-amber-700">{toPersianDigits(list.length)}<span className="text-xs font-bold text-slate-500 mr-1">نفر</span></div>
            <div className="text-[11px] text-slate-500">{toPersianDigits(percent)}٪ از {toPersianDigits(total)} دانش‌آموز</div>
          </div>
        </div>

        {byClass.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {byClass.map(({ cls, count, size }) => (
              <button
                key={cls.id}
                type="button"
                onClick={() => { setClassId(cls.id); setOpen(true); }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white border border-amber-200 text-amber-900 hover:bg-amber-50 cursor-pointer"
              >
                {cls.name}: {toPersianDigits(count)}<span className="text-slate-400 font-normal"> از {toPersianDigits(size)}</span>
              </button>
            ))}
          </div>
        )}

        {list.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {list.slice(0, 8).map((s) => (
              <span key={s.id} className="text-[11px] px-2.5 py-1 rounded-full bg-amber-100/70 text-amber-900 font-semibold">{studentFullName(s)}</span>
            ))}
            {list.length > 8 && <span className="text-[11px] px-2 py-1 text-slate-500">و {toPersianDigits(list.length - 8)} نفر دیگر</span>}
          </div>
        )}

        <button
          type="button"
          onClick={() => { setClassId(''); setOpen(true); }}
          className="inline-flex items-center gap-1 text-xs font-bold px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
        >
          مشاهده فهرست کامل <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </section>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="ممتازین انضباطی" subtitle={`${toPersianDigits(shown.length)} دانش‌آموز بدون غیبت، تأخیر و مورد انضباطی`} icon={<Award className="w-5 h-5" />} size="xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[10rem]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نام…" className="w-full h-10 text-xs bg-slate-50 rounded-xl pr-9 pl-3 outline-none focus:bg-white focus:ring-4 focus:ring-amber-100" />
          </div>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className="h-10 text-xs bg-slate-50 rounded-xl px-3 outline-none" aria-label="کلاس">
            <option value="">همه کلاس‌ها</option>
            {byClass.map(({ cls }) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
          </select>
          <button type="button" onClick={exportExcel} disabled={shown.length === 0} className="h-10 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
            <FileSpreadsheet className="w-4 h-4" /> خروجی اکسل
          </button>
        </div>
        {shown.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-10">موردی یافت نشد.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {shown.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => { if (onSelectStudent) { setOpen(false); onSelectStudent(s); } }}
                  className="w-full text-right flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/40 hover:bg-amber-50 px-3 py-2.5 cursor-pointer"
                >
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">{toPersianDigits(i + 1)}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 truncate">{studentFullName(s)}</span>
                    <span className="block text-[11px] text-slate-500">{className(s.classId)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-slate-400 leading-5">
          معیار: هیچ غیبت (موجه یا غیرموجه، روزانه یا کلاسی)، هیچ تأخیر، هیچ سابقه در پرونده انضباطی و نمره انضباط کامل (۲۰).
        </p>
      </Modal>
    </>
  );
};
