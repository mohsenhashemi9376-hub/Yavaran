import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleSlash,
  FileSpreadsheet,
  Menu,
  RotateCcw,
  Search,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { ParentMeetingNo, ParentMeetingRecord, Student } from '../types';
import { getDayOfWeekFromShamsi, getRealTodayShamsiString, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import {
  ATTENDANCE_STATE_LABELS,
  PARENT_MEETING_LABELS,
  PARENT_MEETING_NUMBERS,
  ParentAttendanceState,
  attendanceState,
  currentAcademicStartYear,
  summarizeMeeting,
} from '../utils/parentMeetings';

type RowFilter = 'all' | 'unrecorded' | 'attended' | 'none';

interface ParentMeetingsWorkspaceProps {
  onBack: () => void;
  onOpenSidebar?: () => void;
}

const inputCls =
  'w-full text-sm bg-slate-50 focus:bg-white border border-slate-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 rounded-xl px-3.5 py-2.5 outline-none transition placeholder:text-slate-400';

const STATE_BADGE: Record<ParentAttendanceState, string> = {
  unrecorded: 'bg-slate-100 text-slate-500',
  both: 'bg-emerald-100 text-emerald-800',
  father: 'bg-sky-100 text-sky-800',
  mother: 'bg-violet-100 text-violet-800',
  none: 'bg-rose-100 text-rose-700',
};

const STATE_DOT: Record<ParentAttendanceState, string> = {
  unrecorded: 'bg-slate-200 text-slate-500',
  both: 'bg-emerald-500 text-white',
  father: 'bg-sky-500 text-white',
  mother: 'bg-violet-500 text-white',
  none: 'bg-rose-500 text-white',
};

export const ParentMeetingsWorkspace: React.FC<ParentMeetingsWorkspaceProps> = ({ onBack, onOpenSidebar }) => {
  const {
    students,
    classes,
    parentMeetings,
    setParentMeetingAttendance,
    setParentMeetingAttendanceBulk,
    clearParentMeetingAttendance,
    showConfirm,
    showToast,
  } = useSchool();

  const today = getRealTodayShamsiString();
  const yearStart = currentAcademicStartYear();
  const yearKey = String(yearStart);

  const realClasses = useMemo(() => classes.filter((c) => !c.isWorkshop), [classes]);
  const [meetingNo, setMeetingNo] = useState<ParentMeetingNo>(() => {
    // پیش‌فرض: آخرین جلسه‌ای که در این سال برایش چیزی ثبت شده؛ وگرنه جلسه‌ی اول
    const used = parentMeetings.filter((r) => r.academicYear === yearKey).map((r) => r.meetingNo);
    return (used.length ? Math.max(...used) : 1) as ParentMeetingNo;
  });
  const [classId, setClassId] = useState<string>('');
  const [filter, setFilter] = useState<RowFilter>('all');
  const [search, setSearch] = useState('');

  const activeClassId = classId || realClasses[0]?.id || '';

  // رکوردهای سال تحصیلی جاری: [شماره جلسه][شناسه دانش‌آموز]
  const byMeeting = useMemo(() => {
    const map: Record<number, Map<string, ParentMeetingRecord>> = { 1: new Map(), 2: new Map(), 3: new Map() };
    for (const r of parentMeetings) {
      if (r.academicYear === yearKey && map[r.meetingNo]) map[r.meetingNo].set(r.studentId, r);
    }
    return map;
  }, [parentMeetings, yearKey]);

  const classStudents = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const s of students) {
      const list = map.get(s.classId);
      if (list) list.push(s);
      else map.set(s.classId, [s]);
    }
    for (const list of map.values()) list.sort((a, b) => studentFullName(a).localeCompare(studentFullName(b), 'fa'));
    return map;
  }, [students]);

  const schoolStudents = useMemo(
    () => realClasses.flatMap((c) => classStudents.get(c.id) || []),
    [realClasses, classStudents]
  );

  const records = byMeeting[meetingNo];
  const schoolSummary = useMemo(
    () => summarizeMeeting(schoolStudents.map((s) => s.id), Array.from(records.values())),
    [schoolStudents, records]
  );

  const meetingOverview = useMemo(
    () =>
      PARENT_MEETING_NUMBERS.map((n) => ({
        no: n,
        summary: summarizeMeeting(schoolStudents.map((s) => s.id), Array.from(byMeeting[n].values())),
      })),
    [schoolStudents, byMeeting]
  );

  const q = search.trim();
  const listStudents = useMemo(() => {
    const base = q ? schoolStudents : classStudents.get(activeClassId) || [];
    return base.filter((s) => {
      if (q && !`${studentFullName(s)} ${s.fatherName || ''} ${s.studentCode || ''}`.includes(q)) return false;
      const st = attendanceState(records.get(s.id));
      if (filter === 'unrecorded') return st === 'unrecorded';
      if (filter === 'attended') return st === 'both' || st === 'father' || st === 'mother';
      if (filter === 'none') return st === 'none';
      return true;
    });
  }, [q, schoolStudents, classStudents, activeClassId, records, filter]);

  const activeClass = realClasses.find((c) => c.id === activeClassId);
  const activeClassSummary = useMemo(
    () => summarizeMeeting((classStudents.get(activeClassId) || []).map((s) => s.id), Array.from(records.values())),
    [classStudents, activeClassId, records]
  );

  const toggle = (s: Student, who: 'father' | 'mother') => {
    const cur = records.get(s.id);
    setParentMeetingAttendance(s, meetingNo, {
      father: who === 'father' ? !cur?.father : !!cur?.father,
      mother: who === 'mother' ? !cur?.mother : !!cur?.mother,
    });
  };

  const markNone = (s: Student) => setParentMeetingAttendance(s, meetingNo, { father: false, mother: false });

  const classUnrecorded = () => (classStudents.get(activeClassId) || []).filter((s) => !records.has(s.id));

  const bulk = (attendance: { father: boolean; mother: boolean }, label: string) => {
    const pending = classUnrecorded();
    if (pending.length === 0) return showToast('همه‌ی دانش‌آموزان این کلاس قبلاً ثبت شده‌اند.', 'info');
    showConfirm({
      title: 'ثبت گروهی',
      message: `برای ${toPersianDigits(pending.length)} دانش‌آموز ثبت‌نشده‌ی «${activeClass?.name}» در ${PARENT_MEETING_LABELS[meetingNo]} وضعیت «${label}» ثبت شود؟ دانش‌آموزان ثبت‌شده تغییری نمی‌کنند.`,
      confirmLabel: 'ثبت',
      cancelLabel: 'انصراف',
      onConfirm: () => {
        setParentMeetingAttendanceBulk(pending, meetingNo, attendance);
        showToast(`${toPersianDigits(pending.length)} دانش‌آموز ثبت شد.`, 'success');
      },
    });
  };

  const exportExcel = () => {
    const rows = realClasses.flatMap((c) =>
      (classStudents.get(c.id) || []).map((s) => {
        const row: Record<string, string> = {
          کلاس: c.name,
          'نام دانش‌آموز': studentFullName(s),
          'نام پدر': s.fatherName || '',
        };
        for (const n of PARENT_MEETING_NUMBERS) {
          const r = byMeeting[n].get(s.id);
          row[`${PARENT_MEETING_LABELS[n]} - وضعیت`] = ATTENDANCE_STATE_LABELS[attendanceState(r)];
          row[`${PARENT_MEETING_LABELS[n]} - تاریخ ثبت`] = r?.date || '';
        }
        return row;
      })
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'حضور اولیا');
    XLSX.writeFile(wb, `حضور_اولیا_جلسات_عمومی_${yearKey}.xlsx`);
  };

  const classProgress = (id: string) =>
    summarizeMeeting((classStudents.get(id) || []).map((s) => s.id), Array.from(records.values()));

  const filters: { key: RowFilter; label: string; count: number }[] = [
    { key: 'all', label: 'همه', count: activeClassSummary.total },
    { key: 'unrecorded', label: 'ثبت‌نشده', count: activeClassSummary.total - activeClassSummary.recorded },
    { key: 'attended', label: 'حاضر', count: activeClassSummary.attended },
    { key: 'none', label: 'غایب', count: activeClassSummary.none },
  ];

  const stats = [
    { label: 'هر دو حاضر', value: schoolSummary.both, cls: 'text-emerald-700' },
    { label: 'فقط پدر', value: schoolSummary.father, cls: 'text-sky-700' },
    { label: 'فقط مادر', value: schoolSummary.mother, cls: 'text-violet-700' },
    { label: 'هیچ‌کدام', value: schoolSummary.none, cls: 'text-rose-700' },
    { label: 'ثبت‌نشده', value: schoolSummary.total - schoolSummary.recorded, cls: 'text-slate-600' },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      {/* ۱. سربرگ */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            {onOpenSidebar && (
              <button
                type="button"
                onClick={onOpenSidebar}
                aria-label="منو"
                className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
                <span>داشبورد</span>
                <span>/</span>
                <span>امور روزانه</span>
                <span>/</span>
                <span className="text-teal-800 font-black">جلسات عمومی اولیاء</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <UsersRound className="w-5 h-5" />
                </span>
                <span>حضور اولیا در جلسات عمومی</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1.5 leading-6">
                سال تحصیلی {toPersianDigits(`${yearStart}-${yearStart + 1}`)} · هر سال سه جلسه‌ی عمومی برگزار می‌شود. حضور پدر و مادر هر دانش‌آموز جداگانه ثبت می‌شود و تاریخ ثبت به‌طور خودکار (امروز) درج می‌گردد.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-2 rounded-xl bg-teal-50 border border-teal-100 text-teal-800 text-xs font-bold inline-flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>
                تاریخ ثبت: {getDayOfWeekFromShamsi(today)} <span className="font-mono">{toPersianDigits(today)}</span>
              </span>
            </span>
            <button
              type="button"
              onClick={exportExcel}
              disabled={schoolStudents.length === 0}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>خروجی اکسل</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>بازگشت به داشبورد</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* انتخاب جلسه */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5" role="tablist" aria-label="جلسه‌ی عمومی اولیاء">
          {meetingOverview.map(({ no, summary }) => {
            const active = no === meetingNo;
            return (
              <button
                key={no}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setMeetingNo(no)}
                className={`text-right p-4 rounded-xl border transition cursor-pointer ${
                  active ? 'border-teal-500 ring-2 ring-teal-100 bg-white' : 'border-slate-200/80 bg-slate-50/70 hover:border-teal-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-black ${active ? 'text-teal-800' : 'text-slate-800'}`}>{PARENT_MEETING_LABELS[no]}</span>
                  <span className="text-lg font-black text-slate-900">{toPersianDigits(summary.rate)}٪</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 mt-2.5 overflow-hidden">
                  <div className="h-full bg-gradient-to-l from-teal-500 to-emerald-500 transition-all" style={{ width: `${summary.rate}%` }} />
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  {summary.recorded === 0
                    ? 'هنوز ثبت نشده'
                    : `${toPersianDigits(summary.recorded)} از ${toPersianDigits(summary.total)} ثبت شده · ${toPersianDigits(summary.attended)} حاضر`}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap mt-4 text-xs text-slate-600">
          {stats.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className="font-bold text-slate-500">{s.label}:</span>
              <span className={`font-black ${s.cls}`}>{toPersianDigits(s.value)}</span>
            </span>
          ))}
        </div>
      </div>

      {realClasses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center text-slate-500 text-sm font-bold">
          هنوز کلاسی تعریف نشده است.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* ۲. کلاس‌ها */}
          <div className="p-4 sm:p-5 border-b border-slate-100 space-y-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="کلاس">
              {realClasses.map((c) => {
                const p = classProgress(c.id);
                const done = p.total > 0 && p.recorded === p.total;
                const active = !q && c.id === activeClassId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setClassId(c.id);
                      setSearch('');
                      setFilter('all');
                    }}
                    className={`shrink-0 px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                      active ? 'bg-teal-700 border-teal-700 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono inline-flex items-center gap-1 ${
                        active ? 'bg-white/20 text-white' : done ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {done && <Check className="w-3 h-3" />}
                      {toPersianDigits(p.recorded)}/{toPersianDigits(p.total)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative lg:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="جستجوی دانش‌آموز در همه‌ی کلاس‌ها..."
                  className={`${inputCls} pr-9`}
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap bg-slate-100 p-1 rounded-xl text-xs font-bold lg:mr-auto" role="tablist">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition ${
                      filter === f.key ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{f.label}</span>
                    {!q && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-slate-200/70 text-slate-600">{toPersianDigits(f.count)}</span>}
                  </button>
                ))}
              </div>
            </div>

            {!q && activeClass && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-slate-500">ثبت گروهی برای ثبت‌نشده‌های این کلاس:</span>
                <button
                  type="button"
                  onClick={() => bulk({ father: true, mother: true }, 'پدر و مادر حاضر')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold cursor-pointer inline-flex items-center gap-1.5 border border-emerald-200"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>هر دو حاضر</span>
                </button>
                <button
                  type="button"
                  onClick={() => bulk({ father: false, mother: false }, 'هیچ‌کدام حاضر نبودند')}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer inline-flex items-center gap-1.5 border border-rose-200"
                >
                  <CircleSlash className="w-3.5 h-3.5" />
                  <span>همه غایب</span>
                </button>
              </div>
            )}
          </div>

          {/* ۳. فهرست دانش‌آموزان */}
          {listStudents.length === 0 ? (
            <div className="py-14 text-center space-y-2 text-slate-400">
              <AlertCircle className="w-9 h-9 mx-auto opacity-40 text-teal-800" />
              <p className="text-sm font-bold text-slate-600">
                {q || filter !== 'all' ? 'موردی با این فیلتر پیدا نشد.' : 'در این کلاس دانش‌آموزی ثبت نشده است.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {listStudents.map((s, i) => {
                const rec = records.get(s.id);
                const st = attendanceState(rec);
                return (
                  <li key={s.id} className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-slate-50/60 transition">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="w-8 text-center text-xs font-mono text-slate-400 shrink-0">{toPersianDigits(i + 1)}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900">{studentFullName(s)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${STATE_BADGE[st]}`}>{ATTENDANCE_STATE_LABELS[st]}</span>
                        </div>
                        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-slate-500 mt-1">
                          {q && <span>{realClasses.find((c) => c.id === s.classId)?.name}</span>}
                          {s.fatherName && <span>فرزند {s.fatherName}</span>}
                          {rec && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              ثبت: <span className="font-mono">{toPersianDigits(rec.date)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      {/* سابقه‌ی سه جلسه */}
                      <div className="hidden sm:flex items-center gap-1 mr-auto shrink-0" aria-label="سابقه‌ی حضور در سه جلسه">
                        {PARENT_MEETING_NUMBERS.map((n) => {
                          const ns = attendanceState(byMeeting[n].get(s.id));
                          return (
                            <span
                              key={n}
                              title={`${PARENT_MEETING_LABELS[n]}: ${ATTENDANCE_STATE_LABELS[ns]}`}
                              className={`w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center ${STATE_DOT[ns]} ${n === meetingNo ? 'ring-2 ring-offset-1 ring-teal-400' : ''}`}
                            >
                              {toPersianDigits(n)}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggle(s, 'father')}
                        aria-pressed={!!rec?.father}
                        className={`h-11 flex-1 md:flex-none md:w-28 rounded-xl border text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.97] ${
                          rec?.father ? 'bg-sky-600 border-sky-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'
                        }`}
                      >
                        {rec?.father ? <Check className="w-4 h-4" /> : <UserRound className="w-4 h-4" />}
                        <span>پدر</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(s, 'mother')}
                        aria-pressed={!!rec?.mother}
                        className={`h-11 flex-1 md:flex-none md:w-28 rounded-xl border text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.97] ${
                          rec?.mother ? 'bg-violet-600 border-violet-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'
                        }`}
                      >
                        {rec?.mother ? <Check className="w-4 h-4" /> : <UserRound className="w-4 h-4" />}
                        <span>مادر</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => markNone(s)}
                        aria-pressed={st === 'none'}
                        title="هیچ‌کدام از والدین حاضر نبودند"
                        className={`h-11 w-11 rounded-xl border inline-flex items-center justify-center cursor-pointer transition active:scale-[0.97] ${
                          st === 'none' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-600'
                        }`}
                      >
                        <CircleSlash className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => clearParentMeetingAttendance(s.id, meetingNo)}
                        disabled={!rec}
                        title="پاک‌کردن ثبت (برگشت به «ثبت‌نشده»)"
                        className="h-11 w-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none inline-flex items-center justify-center cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
