import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ClipboardCheck, ClipboardList, Download, Eye, Search } from 'lucide-react';
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
export const HomeworkFollowUpReport: React.FC<{ onSelectStudent?: (s: Student) => void; onBack?: () => void }> = ({ onSelectStudent, onBack }) => {
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
      .filter((r) => (filter === 'not_done' ? r.notDone > 0 : filter === 'incomplete' ? r.incomplete > 0 : filter === 'students' ? r.notDone + r.incomplete > 0 : true))
      .map((r) => (filter === 'all' || filter === 'students' ? r : { ...r, details: r.details.filter((d) => d.outcome === filter) }))
      .sort((a, b) => b.notDone - a.notDone || b.incomplete - a.incomplete || studentFullName(a.student).localeCompare(studentFullName(b.student), 'fa'));
  }, [baseRows, filter]);

  const totalNotDone = baseRows.reduce((s, r) => s + r.notDone, 0);
  const totalIncomplete = baseRows.reduce((s, r) => s + r.incomplete, 0);
  const involved = baseRows.length;
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

  const selectCls = 'h-11 w-full px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer';

  /** باکس‌های شاخص (KPI): عدد درشت + برچسب ریز در خط زیرین */
  const kpis: { key: 'not_done' | 'incomplete' | 'students'; value: number; label: string; box: string; num: string; ring: string }[] = [
    { key: 'not_done', value: totalNotDone, label: 'تکلیف انجام‌نشده', box: 'bg-rose-50 border-rose-100 hover:bg-rose-100/60', num: 'text-rose-700', ring: 'ring-rose-400' },
    { key: 'incomplete', value: totalIncomplete, label: 'تکلیف ناقص', box: 'bg-amber-50 border-amber-100 hover:bg-amber-100/60', num: 'text-amber-700', ring: 'ring-amber-400' },
    { key: 'students', value: involved, label: 'دانش‌آموز درگیر', box: 'bg-slate-50 border-slate-200 hover:bg-emerald-50/70', num: 'text-emerald-800', ring: 'ring-emerald-400' },
  ];

  return (
    <div className="space-y-3" dir="rtl">
      {/* عنوان + خروجی */}
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="بازگشت به داشبورد"
            className="!min-h-0 h-9 px-3 shrink-0 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">بازگشت به داشبورد</span>
          </button>
        )}
        <ClipboardList className="w-5 h-5 shrink-0 text-amber-700" />
        <h2 className="flex-1 min-w-0 text-base font-black text-slate-900">پیگیری تکالیف دانش‌آموزان</h2>
        <button
          type="button"
          onClick={exportExcel}
          disabled={rows.length === 0}
          className="!min-h-0 h-9 px-3 shrink-0 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>اکسل</span>
        </button>
      </div>

      {/* ۳ شاخص در یک سطر */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {kpis.map((k) => (
          <button
            key={k.key}
            type="button"
            aria-pressed={filter === k.key}
            onClick={() => setFilter(filter === k.key ? 'all' : k.key)}
            className={`rounded-2xl border px-1.5 py-3 md:py-2 md:px-4 md:flex md:items-center md:justify-center md:gap-3 cursor-pointer transition ${k.box} ${filter === k.key ? `ring-2 ${k.ring} shadow-sm` : ''}`}
          >
            <div className={`text-2xl md:text-xl font-black leading-none ${k.num}`}>{toPersianDigits(k.value)}</div>
            <div className="mt-1.5 md:mt-0 text-[10px] md:text-xs font-medium text-slate-600 whitespace-nowrap">{k.label}</div>
          </button>
        ))}
      </div>

      {/* نوار فیلتر چسبان: جستجو، کلاس، درس، ماه در یک ردیف (دسکتاپ) */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2 md:space-y-0 md:flex md:items-center md:gap-2">
        <div className="flex items-center gap-2 md:contents">
          <div className="relative min-w-0 flex-1 md:flex-[2]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی نام دانش‌آموز"
              className="h-11 w-full pr-9 pl-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500 [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <div className="relative w-[8.5rem] shrink-0 md:order-last">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="ماه" className={`${selectCls} appearance-none pl-8`}>
              <option value={0}>همه ماه‌ها</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:contents">
          <select value={classId} onChange={(e) => { setClassId(e.target.value); setSubject(''); }} aria-label="کلاس" className={selectCls}>
            <option value="">همه کلاس‌ها</option>
            {nurturingSessionClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="درس" className={selectCls}>
            <option value="">همه دروس</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {(() => {
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
          })()}
        </div>
      ) : (
        <>
        {/* دسکتاپ: جدول */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-500">
              <tr>
                <th className="w-12 px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">دانش‌آموز</th>
                <th className="px-3 py-2.5">کلاس</th>
                <th className="px-3 py-2.5">وضعیت تکالیف</th>
                <th className="w-52 px-3 py-2.5 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => {
                const open = openId === r.student.id;
                return (
                  <React.Fragment key={r.student.id}>
                    <tr className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-400">{toPersianDigits(i + 1)}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">{studentFullName(r.student)}</td>
                      <td className="px-3 py-2.5">
                        <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {r.className.startsWith('کلاس') ? r.className : `کلاس ${r.className}`}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {r.streak >= 2 && (
                            <span className="whitespace-nowrap rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">🚨 {toPersianDigits(r.streak)} جلسه پیاپی</span>
                          )}
                          {r.notDone > 0 && (
                            <span className="whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">{toPersianDigits(r.notDone)} تکلیف انجام‌نشده</span>
                          )}
                          {r.incomplete > 0 && (
                            <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">{toPersianDigits(r.incomplete)} تکلیف ناقص</span>
                          )}
                          <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">{toPersianDigits(pct(r))}٪ از {toPersianDigits(r.total)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectStudent?.(r.student)}
                            className="!min-h-0 h-8 px-2.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            ثبت پیگیری
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : r.student.id)}
                            aria-expanded={open}
                            className="!min-h-0 h-8 px-2.5 rounded-lg text-[11px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            جزئیات
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-2">
                            {r.details.length === 0 ? (
                              <div className="text-xs text-slate-400">مورد انجام‌نشده یا ناقصی ثبت نشده است.</div>
                            ) : (
                              r.details.map((d) => (
                                <div key={d.sessionId} className="rounded-xl bg-white border border-slate-200 p-2.5 text-xs space-y-1">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="font-mono text-slate-700 whitespace-nowrap" title="تاریخ جلسه‌ای که تکلیف در آن داده شد">{toPersianDigits(d.date)}</span>
                                    <span className="text-slate-500 whitespace-nowrap">{d.subject}</span>
                                    <span className={`mr-auto px-2 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap ${d.outcome === 'not_done' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {OUTCOME_LABEL[d.outcome]}
                                    </span>
                                  </div>
                                  <p className="text-slate-600 leading-5">{d.homework || 'تکلیفی توضیح داده نشده'}</p>
                                  <p className="text-[10px] text-slate-400">وضعیت در جلسه {toPersianDigits(d.recordedDate)} ثبت شد</p>
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* موبایل: کارت */}
        <ul className="space-y-2.5 md:hidden">
          {rows.map((r, i) => {
            const open = openId === r.student.id;
            return (
              <li key={r.student.id} className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div className="flex flex-col gap-2.5 p-3.5">
                  {/* سطر بالا: ردیف، نام، کلاس، فلش */}
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{toPersianDigits(i + 1)}</span>
                    <button
                      type="button"
                      onClick={() => onSelectStudent?.(r.student)}
                      className="!min-h-0 min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-right cursor-pointer"
                    >
                      <span className="whitespace-nowrap font-bold text-sm text-slate-900">{studentFullName(r.student)}</span>
                      <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {r.className.startsWith('کلاس') ? r.className : `کلاس ${r.className}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : r.student.id)}
                      aria-label="جزئیات"
                      aria-expanded={open}
                      className="!min-h-0 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      <ChevronDown className={`w-4 h-4 transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* سطر پایین: بج‌های هشدار */}
                  <div className="flex flex-wrap gap-1.5">
                    {r.streak >= 2 && (
                      <span className="whitespace-nowrap rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white">🚨 {toPersianDigits(r.streak)} جلسه پیاپی</span>
                    )}
                    {r.notDone > 0 && (
                      <span className="whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">{toPersianDigits(r.notDone)} تکلیف انجام‌نشده</span>
                    )}
                    {r.incomplete > 0 && (
                      <span className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">{toPersianDigits(r.incomplete)} تکلیف ناقص</span>
                    )}
                    <span className="whitespace-nowrap rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500">{toPersianDigits(pct(r))}٪ از {toPersianDigits(r.total)}</span>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-slate-100 bg-slate-50 px-3.5 py-3 space-y-2">
                    {r.details.length === 0 ? (
                      <div className="text-xs text-slate-400">مورد انجام‌نشده یا ناقصی ثبت نشده است.</div>
                    ) : (
                      r.details.map((d) => (
                        <div key={d.sessionId} className="rounded-xl bg-white border border-slate-200 p-2.5 text-xs space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-mono text-slate-700 whitespace-nowrap" title="تاریخ جلسه‌ای که تکلیف در آن داده شد">{toPersianDigits(d.date)}</span>
                            <span className="text-slate-500 whitespace-nowrap">{d.subject}</span>
                            <span className={`mr-auto px-2 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap ${d.outcome === 'not_done' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                              {OUTCOME_LABEL[d.outcome]}
                            </span>
                          </div>
                          <p className="text-slate-600 leading-5">{d.homework || 'تکلیفی توضیح داده نشده'}</p>
                          <p className="text-[10px] text-slate-400">وضعیت در جلسه {toPersianDigits(d.recordedDate)} ثبت شد</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}
    </div>
  );
};
