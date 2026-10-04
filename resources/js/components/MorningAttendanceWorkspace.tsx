import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, Menu, Sunrise, Check, Clock, UserX, BellRing, History, Pencil, Search } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { MorningAttendanceRecord, Student } from '../types';
import { getTodayShamsi, toPersianDigits, toEnglishDigits } from '../utils/persianDate';
import {
  MORNING_FILTERS,
  MorningFilterKey,
  classMatchesMorningFilter,
  compareByLastName,
  formatDelayText,
} from '../utils/morningAttendance';

interface MorningAttendanceWorkspaceProps {
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
  } = useSchool();

  const today = getTodayShamsi();
  const [filter, setFilter] = useState<MorningFilterKey>('all');
  const [search, setSearch] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const todayRecords = useMemo(() => {
    const map = new Map<string, MorningAttendanceRecord>();
    morningAttendance.forEach((r) => {
      if (toEnglishDigits(r.date) === today.formattedDate) map.set(r.studentId, r);
    });
    return map;
  }, [morningAttendance, today.formattedDate]);

  // لیست دانش‌آموزان فیلترشده؛ همیشه الفبایی بر اساس نام خانوادگی
  const visibleStudents = useMemo(() => {
    const q = search.trim();
    return students
      .filter((s) => {
        const cls = classById.get(s.classId);
        if (filter !== 'all' && !(cls && classMatchesMorningFilter(cls, filter))) return false;
        if (q && !`${s.firstName} ${s.lastName}`.includes(q)) return false;
        return true;
      })
      .sort(compareByLastName);
  }, [students, classById, filter, search]);

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

  const presentCount = visibleStudents.filter((s) => todayRecords.get(s.id)?.status === 'present').length;
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
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
            حاضر {toPersianDigits(presentCount)}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">
            غایب {toPersianDigits(visibleStudents.length - presentCount)}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            متأخر {toPersianDigits(visibleStudents.filter((s) => (todayRecords.get(s.id)?.delayMinutes || 0) > 0 && todayRecords.get(s.id)?.status === 'present').length)}
          </span>
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
                role="button"
                tabIndex={0}
                aria-pressed={present}
                onClick={() => toggleMorningAttendance(student)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleMorningAttendance(student);
                  }
                }}
                className={`rounded-2xl p-3.5 transition cursor-pointer select-none ${
                  present
                    ? 'bg-emerald-50/70 border border-emerald-200/80 text-emerald-900'
                    : 'bg-rose-50/70 border border-rose-200/80 text-rose-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold truncate">
                      {student.lastName} {student.firstName}
                    </div>
                    <div className="text-[11px] opacity-70 mt-0.5 truncate">{classNameOf(student.classId)}</div>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      present ? 'bg-emerald-100/80 text-emerald-700' : 'bg-rose-100/80 text-rose-700'
                    }`}
                  >
                    {present ? 'حاضر' : 'غایب'}
                  </span>
                </div>

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
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => onSelectStudent?.(s)}
                        className="font-bold text-slate-800 hover:text-rose-700 transition cursor-pointer text-right"
                      >
                        {s.lastName} {s.firstName}
                      </button>
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
    </div>
  );
};
