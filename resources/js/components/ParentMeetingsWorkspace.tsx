import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleSlash,
  Eye,
  FileSpreadsheet,
  Menu,
  MessageSquareText,
  RotateCcw,
  Search,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { ParentMeetingNo, ParentMeetingRecord, Student } from '../types';
import { getDayOfWeekFromShamsi, getRealTodayShamsiString, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { hasPermission } from '../utils/permissions';
import {
  ATTENDANCE_STATE_LABELS,
  PARENT_MEETING_LABELS,
  PARENT_MEETING_NUMBERS,
  ParentAttendanceState,
  attendanceState,
  currentAcademicStartYear,
  studentParentSummary,
  summarizeMeeting,
} from '../utils/parentMeetings';

type RowFilter = 'all' | 'unrecorded' | 'attended' | 'none' | 'risk' | 'noted';

interface ParentMeetingsWorkspaceProps {
  /** نبودنِ onBack یعنی صفحه داخل پنلی که خودش سربرگ و بازگشت دارد نمایش داده می‌شود */
  onBack?: () => void;
  onOpenSidebar?: () => void;
  /** مشاهده‌ی پرونده‌ی فردی دانش‌آموز (اختیاری) */
  onSelectStudent?: (student: Student) => void;
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

/** چیپ فقط‌خواندنیِ حضور پدر/مادر برای مربی و معاون تربیتی */
const ParentChip: React.FC<{ label: string; on: boolean; recorded: boolean; tone: 'sky' | 'violet' }> = ({ label, on, recorded, tone }) => (
  <span
    className={`h-9 px-3 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 border ${
      !recorded
        ? 'bg-slate-50 border-slate-200 text-slate-400'
        : on
        ? tone === 'sky'
          ? 'bg-sky-50 border-sky-200 text-sky-800'
          : 'bg-violet-50 border-violet-200 text-violet-800'
        : 'bg-rose-50 border-rose-200 text-rose-600'
    }`}
  >
    {!recorded ? <span className="w-3.5 text-center">–</span> : on ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
    {label}
  </span>
);

export const ParentMeetingsWorkspace: React.FC<ParentMeetingsWorkspaceProps> = ({ onBack, onOpenSidebar, onSelectStudent }) => {
  const {
    students,
    classes,
    nurturingClasses,
    currentUser,
    parentMeetings,
    setParentMeetingAttendance,
    setParentMeetingAttendanceBulk,
    clearParentMeetingAttendance,
    setParentMeetingNote,
    showConfirm,
    showToast,
  } = useSchool();

  // فقط مدیر و معاون انضباطی حضور را ثبت می‌کنند؛ مربی و معاون تربیتی آمار را می‌بینند و یادداشت می‌گذارند
  const canRecord = hasPermission(currentUser, 'parent-meetings');
  const canNote = canRecord || hasPermission(currentUser, 'view-parent-meetings');

  const today = getRealTodayShamsiString();
  const yearStart = currentAcademicStartYear();
  const yearKey = String(yearStart);

  const realClasses = useMemo(
    () => (currentUser.role === 'coach' ? nurturingClasses : classes).filter((c) => !c.isWorkshop),
    [classes, nurturingClasses, currentUser.role]
  );
  const [meetingNo, setMeetingNo] = useState<ParentMeetingNo>(() => {
    // پیش‌فرض: آخرین جلسه‌ای که در این سال برایش حضوری ثبت شده؛ وگرنه جلسه‌ی اول
    const used = parentMeetings.filter((r) => r.academicYear === yearKey && r.hasAttendance !== false).map((r) => r.meetingNo);
    return (used.length ? Math.max(...used) : 1) as ParentMeetingNo;
  });
  const [classId, setClassId] = useState<string>('');
  const [filter, setFilter] = useState<RowFilter>('all');
  const [search, setSearch] = useState('');
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const activeClassId = classId || realClasses[0]?.id || '';

  const yearRecords = useMemo(() => parentMeetings.filter((r) => r.academicYear === yearKey), [parentMeetings, yearKey]);

  // رکوردهای سال تحصیلی جاری: [شماره جلسه][شناسه دانش‌آموز]
  const byMeeting = useMemo(() => {
    const map: Record<number, Map<string, ParentMeetingRecord>> = { 1: new Map(), 2: new Map(), 3: new Map() };
    for (const r of yearRecords) if (map[r.meetingNo]) map[r.meetingNo].set(r.studentId, r);
    return map;
  }, [yearRecords]);

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

  const schoolStudents = useMemo(() => realClasses.flatMap((c) => classStudents.get(c.id) || []), [realClasses, classStudents]);
  const records = byMeeting[meetingNo];

  const meetingOverview = useMemo(
    () =>
      PARENT_MEETING_NUMBERS.map((n) => ({
        no: n,
        summary: summarizeMeeting(schoolStudents.map((s) => s.id), Array.from(byMeeting[n].values())),
      })),
    [schoolStudents, byMeeting]
  );
  const schoolSummary = meetingOverview[meetingNo - 1].summary;

  const riskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of schoolStudents) if (studentParentSummary(s.id, yearRecords, yearKey).neverAttended) ids.add(s.id);
    return ids;
  }, [schoolStudents, yearRecords, yearKey]);

  const q = search.trim();
  const baseList = q ? schoolStudents : classStudents.get(activeClassId) || [];
  const activeClass = realClasses.find((c) => c.id === activeClassId);
  const activeClassSummary = useMemo(
    () => summarizeMeeting((classStudents.get(activeClassId) || []).map((s) => s.id), Array.from(records.values())),
    [classStudents, activeClassId, records]
  );

  const listStudents = useMemo(
    () =>
      baseList.filter((s) => {
        if (q && !`${studentFullName(s)} ${s.fatherName || ''} ${s.studentCode || ''}`.includes(q)) return false;
        const rec = records.get(s.id);
        const st = attendanceState(rec);
        if (filter === 'unrecorded') return st === 'unrecorded';
        if (filter === 'attended') return st === 'both' || st === 'father' || st === 'mother';
        if (filter === 'none') return st === 'none';
        if (filter === 'risk') return riskIds.has(s.id);
        if (filter === 'noted') return !!rec?.note;
        return true;
      }),
    [baseList, q, records, filter, riskIds]
  );

  const classCount = (f: RowFilter) =>
    (classStudents.get(activeClassId) || []).filter((s) => {
      const rec = records.get(s.id);
      const st = attendanceState(rec);
      if (f === 'unrecorded') return st === 'unrecorded';
      if (f === 'attended') return st === 'both' || st === 'father' || st === 'mother';
      if (f === 'none') return st === 'none';
      if (f === 'risk') return riskIds.has(s.id);
      if (f === 'noted') return !!rec?.note;
      return true;
    }).length;

  const toggle = (s: Student, who: 'father' | 'mother') => {
    const cur = records.get(s.id);
    const has = cur?.hasAttendance !== false;
    setParentMeetingAttendance(s, meetingNo, {
      father: who === 'father' ? !(has && cur?.father) : has && !!cur?.father,
      mother: who === 'mother' ? !(has && cur?.mother) : has && !!cur?.mother,
    });
  };

  const bulk = (attendance: { father: boolean; mother: boolean }, label: string) => {
    const pending = (classStudents.get(activeClassId) || []).filter((s) => attendanceState(records.get(s.id)) === 'unrecorded');
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

  const openNote = (s: Student) => {
    if (noteOpen === s.id) return setNoteOpen(null);
    setNoteOpen(s.id);
    setNoteDraft(records.get(s.id)?.note || '');
  };
  const saveNote = (s: Student) => {
    setParentMeetingNote(s, meetingNo, noteDraft);
    setNoteOpen(null);
    showToast(noteDraft.trim() ? 'یادداشت ذخیره شد.' : 'یادداشت حذف شد.', 'success');
  };

  const exportExcel = () => {
    const rows = realClasses.flatMap((c) =>
      (classStudents.get(c.id) || []).map((s) => {
        const row: Record<string, string> = { کلاس: c.name, 'نام دانش‌آموز': studentFullName(s), 'نام پدر': s.fatherName || '' };
        for (const n of PARENT_MEETING_NUMBERS) {
          const r = byMeeting[n].get(s.id);
          const lab = PARENT_MEETING_LABELS[n];
          row[`${lab} - پدر`] = attendanceState(r) === 'unrecorded' ? '' : r?.father ? 'حاضر' : 'غایب';
          row[`${lab} - مادر`] = attendanceState(r) === 'unrecorded' ? '' : r?.mother ? 'حاضر' : 'غایب';
          row[`${lab} - تاریخ ثبت`] = (attendanceState(r) !== 'unrecorded' && r?.date) || '';
          row[`${lab} - یادداشت`] = r?.note || '';
        }
        return row;
      })
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'حضور أولیا');
    XLSX.writeFile(wb, `حضور_اولیا_${yearKey}.xlsx`);
  };

  const classProgress = (id: string) => summarizeMeeting((classStudents.get(id) || []).map((s) => s.id), Array.from(records.values()));

  const filters: { key: RowFilter; label: string }[] = [
    { key: 'all', label: 'همه' },
    { key: 'unrecorded', label: 'ثبت‌نشده' },
    { key: 'attended', label: 'حاضر' },
    { key: 'none', label: 'غایب' },
    { key: 'risk', label: 'بدون حضور ولی' },
    { key: 'noted', label: 'دارای یادداشت' },
  ];

  const stats = [
    { label: 'هر دو حاضر', value: schoolSummary.both, dot: 'bg-emerald-500' },
    { label: 'فقط پدر', value: schoolSummary.father, dot: 'bg-sky-500' },
    { label: 'فقط مادر', value: schoolSummary.mother, dot: 'bg-violet-500' },
    { label: 'هیچ‌کدام', value: schoolSummary.none, dot: 'bg-rose-500' },
    { label: 'ثبت‌نشده', value: schoolSummary.total - schoolSummary.recorded, dot: 'bg-slate-300' },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      {/* سربرگ */}
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
              {onBack && (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
                  <span>داشبورد</span>
                  <span>/</span>
                  <span className="text-teal-800 font-black">حضور أولیا</span>
                </div>
              )}
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <UsersRound className="w-5 h-5" />
                </span>
                <span>حضور أولیا</span>
                {!canRecord && (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold inline-flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> مشاهده و یادداشت
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 mt-1.5 leading-6">
                جلسات عمومی أولیا · سال تحصیلی {toPersianDigits(`${yearStart}-${yearStart + 1}`)} · سه جلسه در سال.
                {canRecord
                  ? ' حضور پدر و مادر هر دانش‌آموز جداگانه ثبت می‌شود و تاریخ ثبت خودکار (امروز) درج می‌گردد.'
                  : ' آمار حضور پدر و مادر را می‌بینید و می‌توانید برای هر دانش‌آموز یادداشت بنویسید؛ ثبت حضور با مدیر و معاون انضباطی است.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canRecord && (
              <span className="px-3 py-2 rounded-xl bg-teal-50 border border-teal-100 text-teal-800 text-xs font-bold inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>
                  تاریخ ثبت: {getDayOfWeekFromShamsi(today)} <span className="font-mono">{toPersianDigits(today)}</span>
                </span>
              </span>
            )}
            <button
              type="button"
              onClick={exportExcel}
              disabled={schoolStudents.length === 0}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>خروجی اکسل</span>
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>بازگشت به داشبورد</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* انتخاب جلسه */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5" role="tablist" aria-label="جلسه‌ی عمومی أولیا">
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
              <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
              <span className="font-bold text-slate-500">{s.label}:</span>
              <span className="font-black text-slate-900">{toPersianDigits(s.value)}</span>
            </span>
          ))}
        </div>

        {riskIds.size > 0 && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilter('risk');
            }}
            className="mt-4 w-full sm:w-auto text-right px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold inline-flex items-center gap-2 cursor-pointer hover:bg-amber-100 transition"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {toPersianDigits(riskIds.size)} دانش‌آموز در هیچ‌یک از جلسه‌های ثبت‌شده، ولی‌شان حاضر نبوده است — مشاهده فهرست
            </span>
          </button>
        )}
      </div>

      {realClasses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center text-slate-500 text-sm font-bold">کلاسی برای نمایش وجود ندارد.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 space-y-4">
            {/* کلاس‌ها */}
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
                      setNoteOpen(null);
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
              <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-100 p-1 rounded-xl text-xs font-bold lg:mr-auto" role="tablist">
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
                    {!q && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                          f.key === 'risk' && classCount(f.key) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200/70 text-slate-600'
                        }`}
                      >
                        {toPersianDigits(f.key === 'all' ? activeClassSummary.total : classCount(f.key))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {canRecord && !q && activeClass && (
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

          {/* فهرست دانش‌آموزان */}
          {listStudents.length === 0 ? (
            <div className="py-14 text-center space-y-2 text-slate-400">
              <AlertTriangle className="w-9 h-9 mx-auto opacity-40 text-teal-800" />
              <p className="text-sm font-bold text-slate-600">
                {q || filter !== 'all' ? 'موردی با این فیلتر پیدا نشد.' : 'در این کلاس دانش‌آموزی ثبت نشده است.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {listStudents.map((s, i) => {
                const rec = records.get(s.id);
                const st = attendanceState(rec);
                const recorded = st !== 'unrecorded';
                const editing = noteOpen === s.id;
                return (
                  <li key={s.id} className="p-3.5 sm:p-4 hover:bg-slate-50/60 transition">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="w-7 text-center text-xs font-mono text-slate-400 shrink-0">{toPersianDigits(i + 1)}</span>
                        <span className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-emerald-100 text-teal-800 font-black flex items-center justify-center shrink-0">
                          {(s.lastName || s.firstName || '؟').charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {onSelectStudent ? (
                              <button type="button" onClick={() => onSelectStudent(s)} className="text-sm font-extrabold text-slate-900 hover:text-teal-800 cursor-pointer">
                                {studentFullName(s)}
                              </button>
                            ) : (
                              <span className="text-sm font-extrabold text-slate-900">{studentFullName(s)}</span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${STATE_BADGE[st]}`}>{ATTENDANCE_STATE_LABELS[st]}</span>
                            {riskIds.has(s.id) && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> بدون حضور ولی
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-slate-500 mt-1">
                            {q && <span>{realClasses.find((c) => c.id === s.classId)?.name}</span>}
                            {s.fatherName && <span>فرزند {s.fatherName}</span>}
                            {recorded && rec?.date && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                ثبت: <span className="font-mono">{toPersianDigits(rec.date)}</span>
                              </span>
                            )}
                          </div>
                        </div>
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
                        {canRecord ? (
                          <>
                            <button
                              type="button"
                              onClick={() => toggle(s, 'father')}
                              aria-pressed={recorded && !!rec?.father}
                              className={`h-11 flex-1 md:flex-none md:w-28 rounded-xl border text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.97] ${
                                recorded && rec?.father ? 'bg-sky-600 border-sky-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'
                              }`}
                            >
                              {recorded && rec?.father ? <Check className="w-4 h-4" /> : <UserRound className="w-4 h-4" />}
                              <span>پدر</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggle(s, 'mother')}
                              aria-pressed={recorded && !!rec?.mother}
                              className={`h-11 flex-1 md:flex-none md:w-28 rounded-xl border text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-[0.97] ${
                                recorded && rec?.mother ? 'bg-violet-600 border-violet-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'
                              }`}
                            >
                              {recorded && rec?.mother ? <Check className="w-4 h-4" /> : <UserRound className="w-4 h-4" />}
                              <span>مادر</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setParentMeetingAttendance(s, meetingNo, { father: false, mother: false })}
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
                              disabled={!recorded}
                              title="پاک‌کردن ثبت (برگشت به «ثبت‌نشده»)"
                              className="h-11 w-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none inline-flex items-center justify-center cursor-pointer"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <ParentChip label="پدر" on={!!rec?.father} recorded={recorded} tone="sky" />
                            <ParentChip label="مادر" on={!!rec?.mother} recorded={recorded} tone="violet" />
                          </>
                        )}
                        {canNote && (
                          <button
                            type="button"
                            onClick={() => openNote(s)}
                            aria-expanded={editing}
                            title={rec?.note ? 'ویرایش یادداشت' : 'افزودن یادداشت'}
                            className={`h-11 w-11 rounded-xl border inline-flex items-center justify-center cursor-pointer transition relative ${
                              editing || rec?.note ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-400 hover:text-amber-700 hover:border-amber-300'
                            }`}
                          >
                            <MessageSquareText className="w-4 h-4" />
                            {rec?.note && <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-amber-500" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* یادداشت */}
                    {rec?.note && !editing && (
                      <div className="mt-3 mr-0 md:mr-[4.75rem] rounded-xl bg-amber-50/70 border border-amber-200/80 px-3.5 py-2.5 text-xs text-amber-950 leading-6">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-amber-700 mb-0.5">
                          <MessageSquareText className="w-3 h-3" />
                          <span>{PARENT_MEETING_LABELS[meetingNo]}</span>
                          {rec.noteBy && <span>· {rec.noteBy}</span>}
                        </div>
                        {rec.note}
                      </div>
                    )}
                    {editing && (
                      <div className="mt-3 mr-0 md:mr-[4.75rem] space-y-2">
                        <textarea
                          autoFocus
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') saveNote(s);
                          }}
                          maxLength={500}
                          rows={3}
                          placeholder={`یادداشت درباره‌ی حضور أولیای ${studentFullName(s)} در ${PARENT_MEETING_LABELS[meetingNo]}؛ مثلاً دلیل غیبت یا نتیجه‌ی گفتگو با ولی…`}
                          className={`${inputCls} resize-none leading-7`}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => saveNote(s)}
                            className="h-9 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" /> ذخیره یادداشت
                          </button>
                          <button type="button" onClick={() => setNoteOpen(null)} className="h-9 px-3 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">
                            انصراف
                          </button>
                          <span className="text-[10px] text-slate-400 mr-auto font-mono">{toPersianDigits(noteDraft.length)}/۵۰۰</span>
                        </div>
                      </div>
                    )}
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
