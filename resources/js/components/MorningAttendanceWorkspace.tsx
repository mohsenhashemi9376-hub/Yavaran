import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, Menu, Sunrise, Check, Clock, UserX, BellRing, History, Pencil, Search, X, ChevronDown, Save } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { MorningAttendanceRecord, Student } from '../types';
import { getTodayShamsi, tehranNow, toPersianDigits, toEnglishDigits } from '../utils/persianDate';
import {
  MORNING_FILTERS,
  MorningFilterKey,
  classMatchesMorningFilter,
  compareByLastName,
  formatDelayText,
} from '../utils/morningAttendance';

export type MorningStatusFilter = 'present' | 'absent' | 'late' | null;

const parseStatusFilter = (v?: string | null): MorningStatusFilter =>
  v === 'present' || v === 'absent' || v === 'late' ? v : null;

interface MorningAttendanceWorkspaceProps {
  /** فیلتر وضعیت اولیه (از کارت‌های داشبورد یا پارامتر ?filter= آدرس) */
  initialStatusFilter?: MorningStatusFilter;
  onBack: () => void;
  onOpenSidebar: () => void;
  onSelectStudent?: (student: Student) => void;
}

/** ورودی کوچک و جمع‌وجور برای اصلاح دستی دقیقه تأخیر */
const DelayOverride: React.FC<{ minutes: number; onSave: (m: number) => void; compact?: boolean }> = ({
  minutes,
  onSave,
  compact,
}) => {
  const [value, setValue] = useState(String(minutes));
  const [editing, setEditing] = useState(false);

  const commit = () => {
    const n = parseInt(toEnglishDigits(value).replace(/[^0-9]/g, ''), 10);
    onSave(Number.isNaN(n) ? 0 : n);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setValue(String(minutes));
          setEditing(true);
        }}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition cursor-pointer"
        aria-label="ویرایش دقیقه تأخیر"
      >
        <Pencil className="w-3 h-3" />
        <span>{compact ? 'ویرایش دقیقه' : 'اصلاح دستی دقیقه'}</span>
      </button>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-slate-500"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        type="text"
        inputMode="numeric"
        value={toPersianDigits(value)}
        onChange={(e) => setValue(toEnglishDigits(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        aria-label="دقیقه تأخیر"
        className="w-12 text-center text-xs text-slate-600 bg-white border border-slate-200 rounded-lg py-1 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
      />
      <span>دقیقه</span>
      <button
        type="button"
        onClick={commit}
        className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 cursor-pointer"
      >
        ثبت
      </button>
    </span>
  );
};

/** کادر موجه/غیرموجه و علت غیبت (فقط برای غایبین) */
const AbsenceBox: React.FC<{
  isExcused: boolean;
  note: string;
  onSave: (info: { isExcused?: boolean; absenceNote?: string }) => void;
}> = ({ isExcused, note, onSave }) => {
  const [text, setText] = useState(note);
  const dirty = text.trim() !== note.trim();
  const commit = () => {
    if (dirty) onSave({ absenceNote: text.trim() });
  };

  return (
    <div
      className="bg-rose-50/40 border border-rose-100 rounded-xl p-2.5 mt-2 space-y-2 cursor-default"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-pressed={isExcused}
          onClick={() => onSave({ isExcused: true })}
          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
            isExcused
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
              : 'bg-white/70 text-slate-500 border-slate-200 hover:bg-emerald-50'
          }`}
        >
          موجه
        </button>
        <button
          type="button"
          aria-pressed={!isExcused}
          onClick={() => onSave({ isExcused: false })}
          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer ${
            !isExcused
              ? 'bg-rose-100 text-rose-800 border-rose-300'
              : 'bg-white/70 text-slate-500 border-slate-200 hover:bg-rose-50'
          }`}
        >
          غیرموجه
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') commit();
          }}
          placeholder="علت غیبت، شرح تماس با اولیاء یا شماره نامه موجه..."
          className="flex-1 min-w-0 text-xs bg-white/80 border border-rose-100 focus:border-rose-300 rounded-lg px-2.5 py-1.5 outline-none text-slate-700"
        />
        <button
          type="button"
          onClick={commit}
          aria-label="ذخیره یادداشت"
          title="ذخیره"
          className={`p-1.5 rounded-lg border transition cursor-pointer ${
            dirty ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white/70 text-slate-400 border-slate-200'
          }`}
        >
          {dirty ? <Save className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};

const ExcusedBadge: React.FC<{ excused: boolean }> = ({ excused }) => (
  <span
    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
      excused ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
    }`}
  >
    {excused ? 'موجه' : 'غیرموجه'}
  </span>
);

const AckButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
  >
    <Check className="w-3.5 h-3.5" />
    <span>تأیید پیگیری</span>
  </button>
);

export const MorningAttendanceWorkspace: React.FC<MorningAttendanceWorkspaceProps> = ({
  initialStatusFilter,
  onBack,
  onOpenSidebar,
  onSelectStudent,
}) => {
  const {
    students,
    classes,
    morningAttendance,
    toggleMorningAttendance,
    setMorningDelayMinutes,
    acknowledgeMorningRecord,
    setMorningAbsenceInfo,
  } = useSchool();

  const today = getTodayShamsi();
  const [filter, setFilter] = useState<MorningFilterKey>('all');
  const [search, setSearch] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<MorningStatusFilter>(() => {
    if (initialStatusFilter) return initialStatusFilter;
    try {
      return parseStatusFilter(new URLSearchParams(window.location.search).get('filter'));
    } catch {
      return null;
    }
  });
  const [openAbsenceBoxes, setOpenAbsenceBoxes] = useState<Set<string>>(new Set());
  // محافظت از لمس تصادفی: فقط «بج وضعیت» وضعیت را تغییر می‌دهد
  const [revertConfirmId, setRevertConfirmId] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<{ student: Student; time: string } | null>(null);
  const touchStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const revertTimer = useRef<number | undefined>(undefined);
  const undoTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(revertTimer.current);
      window.clearTimeout(undoTimer.current);
    },
    []
  );

  const onBadgeTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, moved: false };
  };
  const onBadgeTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const start = touchStart.current;
    if (start && (Math.abs(t.clientX - start.x) > 8 || Math.abs(t.clientY - start.y) > 8)) start.moved = true;
  };

  const handleBadgeClick = (student: Student, present: boolean) => {
    // کشیدن انگشت (اسکرول) هرگز به‌عنوان کلیک تلقی نمی‌شود
    if (touchStart.current?.moved) {
      touchStart.current = null;
      return;
    }
    touchStart.current = null;

    if (!present) {
      // غایب ← حاضر: بدون دیالوگ، با امکان بازگردانی
      const now = tehranNow();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      toggleMorningAttendance(student);
      setRevertConfirmId(null);
      setUndoToast({ student, time });
      window.clearTimeout(undoTimer.current);
      undoTimer.current = window.setTimeout(() => setUndoToast(null), 5000);
      return;
    }

    // حاضر ← غایب: نیازمند تأیید سریع
    setRevertConfirmId(student.id);
    window.clearTimeout(revertTimer.current);
    revertTimer.current = window.setTimeout(() => setRevertConfirmId(null), 3000);
  };

  const confirmRevert = (student: Student) => {
    window.clearTimeout(revertTimer.current);
    setRevertConfirmId(null);
    toggleMorningAttendance(student);
  };

  const undoPresent = () => {
    if (!undoToast) return;
    const rec = todayRecords.get(undoToast.student.id);
    if (rec?.status === 'present') toggleMorningAttendance(undoToast.student);
    window.clearTimeout(undoTimer.current);
    setUndoToast(null);
  };

  const toggleStatusFilter = (key: Exclude<MorningStatusFilter, null>) =>
    setStatusFilter((cur) => (cur === key ? null : key));
  const toggleAbsenceBox = (id: string) =>
    setOpenAbsenceBoxes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const todayRecords = useMemo(() => {
    const map = new Map<string, MorningAttendanceRecord>();
    morningAttendance.forEach((r) => {
      if (toEnglishDigits(r.date) === today.formattedDate) map.set(r.studentId, r);
    });
    return map;
  }, [morningAttendance, today.formattedDate]);

  // فیلتر ترکیبی: کلاس + جستجوی نام (مبنای شمارنده‌ها)؛ همیشه الفبایی بر اساس نام خانوادگی
  const scopedStudents = useMemo(() => {
    const q = search.trim();
    return students
      .filter((s) => {
        const cls = classById.get(s.classId);
        if (filter !== 'all' && !(cls && classMatchesMorningFilter(cls, filter))) return false;
        if (q && !`${s.firstName} ${s.lastName}`.includes(q) && !`${s.lastName} ${s.firstName}`.includes(q)) return false;
        return true;
      })
      .sort(compareByLastName);
  }, [students, classById, filter, search]);

  const statusOf = (s: Student): 'present' | 'absent' | 'late' => {
    const rec = todayRecords.get(s.id);
    if (rec?.status !== 'present') return 'absent';
    return rec.delayMinutes > 0 ? 'late' : 'present';
  };

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    scopedStudents.forEach((s) => {
      const rec = todayRecords.get(s.id);
      if (rec?.status === 'present') {
        present++;
        if (rec.delayMinutes > 0) late++;
      } else absent++;
    });
    return { present, absent, late };
  }, [scopedStudents, todayRecords]);

  // «حاضر» شامل متأخرها هم می‌شود (حضور ثبت شده)؛ «متأخر» فقط حاضرهای دارای delay_minutes > 0
  const visibleStudents = useMemo(
    () =>
      scopedStudents.filter((s) => {
        if (!statusFilter) return true;
        const st = statusOf(s);
        if (statusFilter === 'present') return st === 'present' || st === 'late';
        return st === statusFilter;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopedStudents, statusFilter, todayRecords]
  );

  const visibleIds = useMemo(() => new Set(visibleStudents.map((s) => s.id)), [visibleStudents]);

  // موارد فعال امروز (تأییدنشده)
  const activeAbsentees = visibleStudents.filter((s) => {
    const rec = todayRecords.get(s.id);
    return !rec || (rec.status === 'absent' && !rec.isAcknowledged);
  });
  const activeDelays = visibleStudents
    .map((s) => ({ student: s, rec: todayRecords.get(s.id) }))
    .filter(({ rec }) => rec && rec.status === 'present' && rec.delayMinutes > 0 && !rec.isAcknowledged) as {
    student: Student;
    rec: MorningAttendanceRecord;
  }[];

  const needsAttention = activeAbsentees.length + activeDelays.length;

  // آرشیو: همه موارد تأییدشده (غیبت یا تأخیر) در همه روزها
  const archive = useMemo(
    () =>
      morningAttendance
        .filter((r) => r.isAcknowledged && (r.status === 'absent' || r.delayMinutes > 0))
        .filter((r) => visibleIds.has(r.studentId) || filter === 'all')
        .sort((a, b) => (b.acknowledgedAt || '').localeCompare(a.acknowledgedAt || '')),
    [morningAttendance, visibleIds, filter]
  );

  const nameOf = (id: string) => {
    const s = studentById.get(id);
    return s ? `${s.firstName} ${s.lastName}` : 'نامشخص';
  };
  const classNameOf = (id: string) => classById.get(id)?.name || '—';

  const thCls = 'px-4 py-2.5 text-right text-xs font-bold';

  return (
    <div className="space-y-5" dir="rtl">
      {/* هدر */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <span>پیشخوان اصلی</span>
              <span>/</span>
              <span className="text-emerald-700">حضور و غیاب صبحگاه</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5 flex-wrap">
              <Sunrise className="w-6 h-6 text-amber-500" />
              <span>حضور و غیاب صبحگاه</span>
              <span className="text-xs font-bold bg-slate-50 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">
                {today.dayOfWeek} {toPersianDigits(today.formattedDate)}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              همه دانش‌آموزان در شروع صبحگاه «غایب» هستند؛ با یک لمس روی کارت، حضور ثبت می‌شود. ساعت مرجع ورود ۰۷:۰۰ است.
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onOpenSidebar}
              className="lg:hidden px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              aria-label="باز کردن نوار کناری"
            >
              <Menu className="w-4 h-4" />
              <span>منو</span>
            </button>
            <button
              onClick={onBack}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>بازگشت به داشبورد</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ۵ کادر فیلتر پاستلی */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5" role="tablist" aria-label="فیلتر کلاس">
          {MORNING_FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                className={`rounded-2xl px-4 py-3 text-right transition cursor-pointer ${
                  f.key === 'all' ? 'col-span-2 lg:col-span-1' : ''
                } ${
                  active
                    ? 'bg-emerald-100/70 text-emerald-900 border-2 border-emerald-300/80 shadow-sm'
                    : 'bg-slate-50/80 hover:bg-slate-100 text-slate-700 border border-slate-200/70'
                }`}
              >
                <div className="text-sm font-extrabold">{f.label}</div>
                <div className={`text-[11px] mt-0.5 ${active ? 'text-emerald-700' : 'text-slate-500'}`}>{f.hint}</div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {([
            ['present', 'حاضر', counts.present, 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/70', 'ring-emerald-300 border-emerald-300 shadow-sm'],
            ['absent', 'غایب', counts.absent, 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100/70', 'ring-rose-300 border-rose-300 shadow-sm'],
            ['late', 'متأخر', counts.late, 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70', 'ring-amber-300 border-amber-300 shadow-sm'],
          ] as const).map(([key, label, count, base, active]) => (
            <button
              key={key}
              type="button"
              aria-pressed={statusFilter === key}
              onClick={() => toggleStatusFilter(key)}
              title={statusFilter === key ? 'لغو فیلتر' : `فقط ${label}‌ها`}
              className={`px-3 py-1.5 rounded-full border transition cursor-pointer ${base} ${
                statusFilter === key ? `ring-2 ${active}` : ''
              }`}
            >
              {label} {toPersianDigits(count)}
            </button>
          ))}
          {statusFilter && (
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>همه</span>
            </button>
          )}
          <div className="relative mr-auto w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی دانش‌آموز..."
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-xl pr-9 pl-3 py-2 text-xs font-medium outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* کارت‌های دانش‌آموزان */}
      {visibleStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-sm text-slate-400">
          دانش‌آموزی با این فیلتر یافت نشد.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {visibleStudents.map((student) => {
            const rec = todayRecords.get(student.id);
            const present = rec?.status === 'present';
            const delayed = present && (rec?.delayMinutes || 0) > 0;
            return (
              <div
                key={student.id}
                className={`rounded-2xl p-3.5 transition ${
                  present
                    ? 'bg-emerald-50/70 border border-emerald-200/80 text-emerald-900'
                    : 'bg-rose-50/70 border border-rose-200/80 text-rose-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold whitespace-nowrap">
                      {student.lastName} {student.firstName}
                    </div>
                    <div className="text-[11px] opacity-70 mt-0.5 truncate">{classNameOf(student.classId)}</div>
                  </div>
                  <button
                    type="button"
                    aria-pressed={present}
                    aria-label={present ? 'حاضر — برای بازگرداندن به غایب لمس کنید' : 'غایب — برای ثبت حضور لمس کنید'}
                    onTouchStart={onBadgeTouchStart}
                    onTouchMove={onBadgeTouchMove}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBadgeClick(student, present);
                    }}
                    className={`shrink-0 min-h-[36px] px-3.5 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer active:scale-95 ${
                      present
                        ? 'bg-emerald-100/80 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-rose-100/80 text-rose-700 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    {present ? 'حاضر' : 'غایب'}
                  </button>
                </div>

                {present && revertConfirmId === student.id && (
                  <div
                    role="alertdialog"
                    className="mt-2.5 bg-white/80 border border-rose-200 rounded-xl p-2.5 flex items-center gap-2 flex-wrap text-xs"
                  >
                    <span className="font-bold text-rose-800">آیا مایل به بازگرداندن وضعیت به غایب هستید؟</span>
                    <button
                      type="button"
                      onClick={() => confirmRevert(student)}
                      className="px-3 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200 font-bold cursor-pointer"
                    >
                      بله
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.clearTimeout(revertTimer.current);
                        setRevertConfirmId(null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                  </div>
                )}

                {!present && (() => {
                  const noteText = rec?.absenceNote || '';
                  const open = openAbsenceBoxes.has(student.id) || statusFilter === 'absent' || Boolean(noteText);
                  return (
                    <>
                      {!open && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAbsenceBox(student.id);
                          }}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-rose-700/80 hover:text-rose-800 cursor-pointer"
                        >
                          <ChevronDown className="w-3 h-3" />
                          <span>موجه/غیرموجه و علت غیبت</span>
                        </button>
                      )}
                      {open && (
                        <AbsenceBox
                          key={`${student.id}-${noteText}`}
                          isExcused={Boolean(rec?.isExcused)}
                          note={noteText}
                          onSave={(info) => setMorningAbsenceInfo(student, info)}
                        />
                      )}
                    </>
                  );
                })()}

                {present && rec && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-[11px] opacity-70">ورود: {toPersianDigits(rec.entryTime || '')}</span>
                    {delayed && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                        {formatDelayText(rec.delayMinutes, 'صبحگاه')}
                      </span>
                    )}
                    {delayed && (
                      <DelayOverride minutes={rec.delayMinutes} onSave={(m) => setMorningDelayMinutes(rec.id, m)} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* هدر دو جدول: نیازمند توجه و پیگیری */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowArchive((v) => !v)}
          aria-expanded={showArchive}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-extrabold border transition cursor-pointer ${
            showArchive
              ? 'bg-violet-50 text-violet-800 border-violet-200'
              : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70'
          }`}
        >
          <BellRing className="w-4 h-4" />
          <span>نیازمند توجه و پیگیری</span>
          <span className="px-2 py-0.5 rounded-full bg-white/70 text-[11px]">{toPersianDigits(needsAttention)}</span>
          <History className="w-3.5 h-3.5 opacity-60" />
        </button>
        <span className="text-[11px] text-slate-500">
          {showArchive ? 'در حال نمایش تاریخچه موارد تأییدشده' : 'برای مشاهده سابقه موارد تأییدشده و آرشیو کلیک کنید'}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {showArchive && (
          <motion.div
            key="archive"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-violet-200/70 overflow-hidden">
              <div className="px-4 py-3 bg-violet-50/50 border-b border-violet-100 text-violet-900 text-sm font-extrabold">
                سوابق و آرشیو موارد تأییدشده ({toPersianDigits(archive.length)})
              </div>
              {archive.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">هنوز موردی تأیید و آرشیو نشده است.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-violet-50/30 text-violet-900">
                      <tr>
                        <th className={thCls}>تاریخ</th>
                        <th className={thCls}>دانش‌آموز</th>
                        <th className={thCls}>کلاس</th>
                        <th className={thCls}>نوع</th>
                        <th className={thCls}>تأییدکننده</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archive.map((r) => (
                        <tr key={r.id} className="border-b border-violet-50 last:border-0">
                          <td className="px-4 py-2.5 text-xs text-slate-600">{toPersianDigits(r.date)}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-800">{nameOf(r.studentId)}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">{classNameOf(r.classId)}</td>
                          <td className="px-4 py-2.5 text-xs">
                            {r.status === 'absent' ? (
                              <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100">غیبت صبحگاه</span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                {formatDelayText(r.delayMinutes, 'صبحگاه')}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{r.acknowledgedBy || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* جدول غایبین صبحگاه امروز */}
      <div className="bg-white rounded-2xl border border-rose-100 overflow-hidden">
        <div className="px-4 py-3 bg-rose-50/50 border-b border-rose-100 text-rose-900 flex items-center gap-2 text-sm font-extrabold">
          <UserX className="w-4 h-4" />
          <span>جدول غایبین صبحگاه امروز</span>
          <span className="text-xs font-bold opacity-70">({toPersianDigits(activeAbsentees.length)})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-rose-50/50 text-rose-900">
              <tr>
                <th className={`${thCls} border-b border-rose-100`}>دانش‌آموز</th>
                <th className={`${thCls} border-b border-rose-100`}>کلاس</th>
                <th className={`${thCls} border-b border-rose-100 w-40`}>پیگیری</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {activeAbsentees.map((s) => (
                  <motion.tr
                    key={s.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ duration: 0.25 }}
                    className="border-b border-rose-100 last:border-0"
                  >
                    <td className="px-4 py-2.5 whitespace-normal min-w-[220px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onSelectStudent?.(s)}
                          className="font-bold text-slate-800 hover:text-rose-700 transition cursor-pointer text-right whitespace-nowrap"
                        >
                          {s.lastName} {s.firstName}
                        </button>
                        <ExcusedBadge excused={Boolean(todayRecords.get(s.id)?.isExcused)} />
                      </div>
                      {todayRecords.get(s.id)?.absenceNote && (
                        <div className="mt-1.5 bg-rose-50/60 border border-rose-200/60 text-rose-900 text-xs p-2 rounded-lg">
                          {todayRecords.get(s.id)?.absenceNote}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{classNameOf(s.classId)}</td>
                    <td className="px-4 py-2.5">
                      <AckButton onClick={() => acknowledgeMorningRecord(s, 'absence')} />
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {activeAbsentees.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">غایبی در انتظار پیگیری نیست.</div>
          )}
        </div>
      </div>

      {/* جدول تأخیرهای صبحگاه امروز */}
      <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden">
        <div className="px-4 py-3 bg-amber-50/50 border-b border-amber-100 text-amber-900 flex items-center gap-2 text-sm font-extrabold">
          <Clock className="w-4 h-4" />
          <span>جدول تأخیرهای صبحگاه امروز</span>
          <span className="text-xs font-bold opacity-70">({toPersianDigits(activeDelays.length)})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-amber-50/50 text-amber-900">
              <tr>
                <th className={`${thCls} border-b border-amber-100`}>دانش‌آموز</th>
                <th className={`${thCls} border-b border-amber-100`}>کلاس</th>
                <th className={`${thCls} border-b border-amber-100`}>ساعت ثبت حضور</th>
                <th className={`${thCls} border-b border-amber-100`}>تأخیر</th>
                <th className={`${thCls} border-b border-amber-100 w-40`}>پیگیری</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {activeDelays.map(({ student, rec }) => (
                  <motion.tr
                    key={rec.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ duration: 0.25 }}
                    className="border-b border-amber-100 last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => onSelectStudent?.(student)}
                        className="font-bold text-slate-800 hover:text-amber-800 transition cursor-pointer text-right"
                      >
                        {student.lastName} {student.firstName}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{classNameOf(student.classId)}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-700 font-bold">{toPersianDigits(rec.entryTime || '—')}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                          {formatDelayText(rec.delayMinutes, 'صبحگاه')}
                        </span>
                        <DelayOverride compact minutes={rec.delayMinutes} onSave={(m) => setMorningDelayMinutes(rec.id, m)} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <AckButton onClick={() => acknowledgeMorningRecord(student, 'delay')} />
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {activeDelays.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">تأخیری در انتظار پیگیری نیست.</div>
          )}
        </div>
      </div>

      {undoToast && (
        <div className="fixed bottom-20 sm:bottom-6 inset-x-3 sm:inset-x-auto sm:right-1/2 sm:translate-x-1/2 z-[70] flex justify-center pointer-events-none">
          <div
            role="status"
            className="pointer-events-auto bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-lg rounded-2xl px-4 py-3 flex items-center gap-3 text-xs sm:text-sm max-w-md"
          >
            <span className="font-bold">
              حضور {undoToast.student.firstName} {undoToast.student.lastName} ثبت شد. (ورود {toPersianDigits(undoToast.time)})
            </span>
            <button
              type="button"
              onClick={undoPresent}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-extrabold cursor-pointer"
            >
              لغو / بازگردانی
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
