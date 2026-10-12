import React, { useMemo, useState } from 'react';
import { ChevronDown, ClipboardList, Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { homeworkOutcome, HomeworkOutcome } from '../utils/classroomActivity';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const OUTCOME_LABEL: Record<HomeworkOutcome, string> = {
  excellent: 'عالی',
  done: 'انجام‌شده',
  incomplete: 'ناقص',
  not_done: 'انجام‌نشده',
};

interface Detail {
  sessionId: string;
  date: string;
  subject: string;
  homework: string;
  outcome: HomeworkOutcome;
}

interface Row {
  student: Student;
  className: string;
  notDone: number;
  incomplete: number;
  done: number;
  total: number;
  details: Detail[];
}

const monthOf = (date: string) => Number(toEnglishDigits(date).split('/')[1]);

/** پیگیری تکالیف: چه کسی تکلیف کلاسی را انجام نداده است (معاون آموزشی، معاون تربیتی، مربی) */
export const HomeworkFollowUpReport: React.FC<{ onSelectStudent?: (s: Student) => void }> = ({ onSelectStudent }) => {
  const { nurturingClasses, nurturingSessionClasses, students, sessions } = useSchool();
  const [classId, setClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [month, setMonth] = useState(0);
  const [onlyProblem, setOnlyProblem] = useState(true);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // کلاس‌های دانش‌آموزی (برای محدودکردن دانش‌آموزان) جدا از کلاس‌های جلسه (شامل کارگاه‌ها) است
  const classIds = useMemo(() => new Set(nurturingClasses.map((c) => c.id)), [nurturingClasses]);
  const sessionClassIds = useMemo(() => new Set(nurturingSessionClasses.map((c) => c.id)), [nurturingSessionClasses]);
  const scoped = useMemo(
    () => sessions.filter((s) => sessionClassIds.has(s.classId) && (!classId || s.classId === classId)),
    [sessions, sessionClassIds, classId]
  );
  const subjects = useMemo(
    () => Array.from(new Set(scoped.map((s) => s.subject).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fa')),
    [scoped]
  );

  const rows = useMemo(() => {
    const byStudent = new Map<string, Row>();
    const stuMap = new Map(students.map((s) => [s.id, s]));
    scoped.forEach((sess) => {
      if (subject && sess.subject !== subject) return;
      if (month && monthOf(sess.date) !== month) return;
      Object.keys(sess.records || {}).forEach((sid) => {
        const student = stuMap.get(sid);
        const outcome = homeworkOutcome(sess.records[sid]);
        if (!student || !outcome || !classIds.has(student.classId)) return;
        const row = byStudent.get(sid) || {
          student,
          className: nurturingClasses.find((c) => c.id === student.classId)?.name || '',
          notDone: 0, incomplete: 0, done: 0, total: 0, details: [],
        };
        if (outcome === 'not_done') row.notDone++;
        else if (outcome === 'incomplete') row.incomplete++;
        else row.done++;
        row.total++;
        if (outcome === 'not_done' || outcome === 'incomplete') {
          row.details.push({
            sessionId: sess.id, date: sess.date, subject: sess.subject || 'کلاس درس',
            homework: (sess.homeworkDescription || '').trim(), outcome,
          });
        }
        byStudent.set(sid, row);
      });
    });
    const q = search.trim();
    return Array.from(byStudent.values())
      .filter((r) => (!onlyProblem || r.notDone + r.incomplete > 0) && (!q || studentFullName(r.student).includes(q)))
      .map((r) => ({ ...r, details: r.details.sort((a, b) => toEnglishDigits(b.date).localeCompare(toEnglishDigits(a.date))) }))
      .sort((a, b) => b.notDone - a.notDone || b.incomplete - a.incomplete || studentFullName(a.student).localeCompare(studentFullName(b.student), 'fa'));
  }, [scoped, students, subject, month, onlyProblem, search, classIds, nurturingClasses]);

  const totalNotDone = rows.reduce((s, r) => s + r.notDone, 0);
  const totalIncomplete = rows.reduce((s, r) => s + r.incomplete, 0);
  const withNotDone = rows.filter((r) => r.notDone > 0).length;
  const pct = (r: Row) => (r.total ? Math.round(((r.notDone + r.incomplete) / r.total) * 100) : 0);

  const exportExcel = () => {
    const data = rows.map((r, i) => ({
      'ردیف': i + 1,
      'دانش‌آموز': studentFullName(r.student),
      'کلاس': r.className,
      'انجام‌نشده': r.notDone,
      'ناقص': r.incomplete,
      'انجام‌شده': r.done,
      'کل تکالیف ارزیابی‌شده': r.total,
      'درصد نقص': pct(r),
    }));
    const detail = rows.flatMap((r) =>
      r.details.map((d) => ({
        'دانش‌آموز': studentFullName(r.student), 'کلاس': r.className, 'تاریخ': d.date,
        'درس': d.subject, 'تکلیف': d.homework || '-', 'وضعیت': OUTCOME_LABEL[d.outcome],
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'خلاصه');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'جزئیات');
    XLSX.writeFile(wb, 'Homework_FollowUp.xlsx');
  };

  const selectCls = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium cursor-pointer';

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ClipboardList className="w-5 h-5 text-amber-700" />
          <h2 className="text-base font-black text-slate-900 flex-1">پیگیری تکالیف دانش‌آموزان</h2>
          <button
            type="button"
            onClick={exportExcel}
            disabled={rows.length === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی اکسل</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setSubject(''); }} className={selectCls}>
            <option value="">همه کلاس‌ها</option>
            {nurturingSessionClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectCls}>
            <option value="">همه دروس</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls}>
            <option value={0}>همه ماه‌ها</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام دانش‌آموز"
              className="w-full pr-8 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer w-fit">
          <input type="checkbox" checked={onlyProblem} onChange={(e) => setOnlyProblem(e.target.checked)} />
          <span>فقط دانش‌آموزانی که تکلیف را انجام نداده یا ناقص داده‌اند</span>
        </label>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-rose-50 border border-rose-100 p-2.5">
            <div className="text-lg font-black text-rose-700">{toPersianDigits(totalNotDone)}</div>
            <div className="text-[10px] text-rose-700">تکلیف انجام‌نشده</div>
          </div>
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-2.5">
            <div className="text-lg font-black text-amber-700">{toPersianDigits(totalIncomplete)}</div>
            <div className="text-[10px] text-amber-700">تکلیف ناقص</div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
            <div className="text-lg font-black text-slate-800">{toPersianDigits(withNotDone)}</div>
            <div className="text-[10px] text-slate-600">دانش‌آموز با انجام‌نشده</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {rows.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">
            موردی برای نمایش نیست. تکلیف در هنگام ثبت حضور و غیاب توسط استاد ارزیابی می‌شود.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const open = openId === r.student.id;
              return (
                <li key={r.student.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-[11px] text-slate-400 w-6 text-center">{toPersianDigits(i + 1)}</span>
                    <button
                      type="button"
                      onClick={() => onSelectStudent?.(r.student)}
                      className="flex-1 min-w-0 text-right cursor-pointer"
                    >
                      <div className="font-bold text-sm text-slate-900 truncate">{studentFullName(r.student)}</div>
                      <div className="text-[11px] text-slate-500">{r.className}</div>
                    </button>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700">
                      {toPersianDigits(r.notDone)} انجام‌نشده
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 hidden sm:inline">
                      {toPersianDigits(r.incomplete)} ناقص
                    </span>
                    <span className="text-[11px] text-slate-500 hidden sm:inline w-20 text-left">
                      {toPersianDigits(pct(r))}٪ از {toPersianDigits(r.total)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : r.student.id)}
                      aria-label="جزئیات"
                      className="p-1 text-slate-500 cursor-pointer"
                    >
                      <ChevronDown className={`w-4 h-4 transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {open && (
                    <div className="bg-slate-50 px-4 py-3 space-y-1.5">
                      {r.details.length === 0 ? (
                        <div className="text-xs text-slate-400">مورد انجام‌نشده یا ناقصی ثبت نشده است.</div>
                      ) : (
                        r.details.map((d) => (
                          <div key={`${d.sessionId}`} className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="font-mono text-slate-700">{toPersianDigits(d.date)}</span>
                            <span className="text-slate-500">{d.subject}</span>
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${d.outcome === 'not_done' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                              {OUTCOME_LABEL[d.outcome]}
                            </span>
                            <span className="text-slate-600 truncate">{d.homework || 'تکلیفی توضیح داده نشده'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
