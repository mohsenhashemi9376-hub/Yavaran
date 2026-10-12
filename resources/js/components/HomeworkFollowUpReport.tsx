import React, { useMemo, useState } from 'react';
import { ChevronDown, ClipboardList, Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { homeworkOutcome, HomeworkOutcome } from '../utils/classroomActivity';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { previousCourseSession } from '../utils/homework';
import { EmptyState } from './EmptyState';

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const OUTCOME_LABEL: Record<HomeworkOutcome, string> = {
  excellent: 'عالی',
  done: 'انجام‌شده',
  incomplete: 'ناقص',
  not_done: 'انجام‌نشده',
};

interface Detail {
  sessionId: string;
  recordedDate: string;
  date: string;
  subject: string;
  homework: string;
  outcome: HomeworkOutcome;
}

interface Row {
  streak: number;
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
  const [filter, setFilter] = useState<'all' | 'not_done' | 'incomplete' | 'students'>('all');
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

  const baseRows = useMemo(() => {
    const byStudent = new Map<string, Row>();
    const stuMap = new Map(students.map((s) => [s.id, s]));
    scoped.forEach((sess) => {
      if (subject && sess.subject !== subject) return;
      if (month && monthOf(sess.date) !== month) return;
      Object.keys(sess.records || {}).forEach((sid) => {
        const student = stuMap.get(sid);
        const outcome = homeworkOutcome(sess.records[sid]);
        if (!student || !outcome || !classIds.has(student.classId)) return;
        // وضعیت ثبت‌شده در این جلسه مربوط به تکلیف «جلسه قبل» همین درس است
        const prev = previousCourseSession(sessions, sess);
        if (!prev) return;
        const row = byStudent.get(sid) || {
          student,
          className: nurturingClasses.find((c) => c.id === student.classId)?.name || '',
          streak: 0, notDone: 0, incomplete: 0, done: 0, total: 0, details: [],
        };
        if (outcome === 'not_done') row.notDone++;
        else if (outcome === 'incomplete') row.incomplete++;
        else row.done++;
        row.total++;
        if (outcome === 'not_done' || outcome === 'incomplete') {
          row.details.push({
            sessionId: sess.id, recordedDate: sess.date, date: prev.date, subject: sess.subject || 'کلاس درس',
            homework: (prev.homeworkDescription || '').trim(), outcome,
          });
        }
        byStudent.set(sid, row);
      });
    });
    const q = search.trim();
    return Array.from(byStudent.values())
      .filter((r) => (r.notDone + r.incomplete > 0) && (!q || studentFullName(r.student).includes(q)))
      .map((r) => {
        const details = r.details.sort((a, b) => toEnglishDigits(b.date).localeCompare(toEnglishDigits(a.date)));
        // تعداد جلسات پیاپیِ اخیر که تکلیف انجام‌نشده بوده (هر درس جداگانه)
        const bySubject = new Map<string, Detail[]>();
        details.forEach((d) => bySubject.set(d.subject, [...(bySubject.get(d.subject) || []), d]));
        let streak = 0;
        bySubject.forEach((_list, subj) => {
          const allRecent = scoped
            .filter((s) => (s.subject || 'کلاس درس') === subj && s.records?.[r.student.id] && homeworkOutcome(s.records[r.student.id]) && previousCourseSession(sessions, s))
            .sort((a, b) => toEnglishDigits(b.date).localeCompare(toEnglishDigits(a.date)));
          let run = 0;
          for (const s of allRecent) {
            if (homeworkOutcome(s.records[r.student.id]) === 'not_done') run++;
            else break;
          }
          streak = Math.max(streak, run);
        });
        return { ...r, details, streak };
      });
  }, [scoped, sessions, students, subject, month, search, classIds, nurturingClasses]);

  const rows = useMemo(() => {
    return baseRows
      .filter((r) => (filter === 'not_done' ? r.notDone > 0 : filter === 'incomplete' ? r.incomplete > 0 : filter === 'students' ? r.notDone > 0 : true))
      .map((r) => (filter === 'all' || filter === 'students' ? r : { ...r, details: r.details.filter((d) => d.outcome === filter) }))
      .sort((a, b) => b.notDone - a.notDone || b.incomplete - a.incomplete || studentFullName(a.student).localeCompare(studentFullName(b.student), 'fa'));
  }, [baseRows, filter]);

  const totalNotDone = baseRows.reduce((s, r) => s + r.notDone, 0);
  const totalIncomplete = baseRows.reduce((s, r) => s + r.incomplete, 0);
  const withNotDone = baseRows.filter((r) => r.notDone > 0).length;
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

        <div className="grid grid-cols-3 gap-2 text-center">
          <button
            type="button"
            aria-pressed={filter === 'not_done'}
            onClick={() => setFilter(filter === 'not_done' ? 'all' : 'not_done')}
            className={`rounded-xl bg-rose-50 border border-rose-100 p-2.5 cursor-pointer transition ${filter === 'not_done' ? 'ring-2 ring-rose-400 shadow-sm' : 'hover:bg-rose-100/60'}`}
          >
            <div className="text-lg font-black text-rose-700">{toPersianDigits(totalNotDone)}</div>
            <div className="text-[10px] text-rose-700">تکلیف انجام‌نشده</div>
          </button>
          <button
            type="button"
            aria-pressed={filter === 'incomplete'}
            onClick={() => setFilter(filter === 'incomplete' ? 'all' : 'incomplete')}
            className={`rounded-xl bg-amber-50 border border-amber-100 p-2.5 cursor-pointer transition ${filter === 'incomplete' ? 'ring-2 ring-amber-400 shadow-sm' : 'hover:bg-amber-100/60'}`}
          >
            <div className="text-lg font-black text-amber-700">{toPersianDigits(totalIncomplete)}</div>
            <div className="text-[10px] text-amber-700">تکلیف ناقص</div>
          </button>
          <button
            type="button"
            aria-pressed={filter === 'students'}
            onClick={() => setFilter(filter === 'students' ? 'all' : 'students')}
            className={`rounded-xl bg-slate-50 border border-slate-200 p-2.5 cursor-pointer transition ${filter === 'students' ? 'ring-2 ring-slate-400 shadow-sm' : 'hover:bg-slate-100'}`}
          >
            <div className="text-lg font-black text-slate-800">{toPersianDigits(withNotDone)}</div>
            <div className="text-[10px] text-slate-600">دانش‌آموز با انجام‌نشده</div>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {rows.length === 0 ? (
          (() => {
            const narrowed = Boolean(classId || subject || month || search.trim() || filter !== 'all');
            if (narrowed) {
              return (
                <EmptyState
                  title="با فیلترهای فعلی موردی پیدا نشد"
                  hint="ممکن است در این کلاس، درس یا ماه، تکلیف انجام‌نشده یا ناقصی ثبت نشده باشد یا نام جستجوشده وجود نداشته باشد."
                  actionLabel="پاک‌کردن فیلترها"
                  onAction={() => { setClassId(''); setSubject(''); setMonth(0); setSearch(''); setFilter('all'); }}
                />
              );
            }
            return (
              <EmptyState
                title="تکلیف انجام‌نشده یا ناقصی ثبت نشده است"
                hint="وضعیت تکلیف هنگام ثبت حضور و غیاب جلسه‌ی بعد توسط استاد ثبت می‌شود و فقط برای درس‌هایی که جلسه‌ی قبلشان تکلیف داشته، معنا دارد."
              />
            );
          })()
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
                    {r.notDone > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 whitespace-nowrap">
                        {toPersianDigits(r.notDone)} انجام‌نشده
                      </span>
                    )}
                    {r.streak >= 2 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white whitespace-nowrap">
                        {toPersianDigits(r.streak)} جلسه پیاپی
                      </span>
                    )}
                    {r.incomplete > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 whitespace-nowrap">
                        {toPersianDigits(r.incomplete)} ناقص
                      </span>
                    )}
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
                            <span className="font-mono text-slate-700" title="تاریخ جلسه‌ای که تکلیف در آن داده شد">{toPersianDigits(d.date)}</span>
                            <span className="text-[10px] text-slate-400">(وضعیت در جلسه {toPersianDigits(d.recordedDate)} ثبت شد)</span>
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
