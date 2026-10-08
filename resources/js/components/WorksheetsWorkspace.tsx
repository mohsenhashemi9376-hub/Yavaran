import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  FileSpreadsheet,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Eye,
  Minus,
  StickyNote,
  UserX,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student, WorksheetStatus } from '../types';
import { hasPermission } from '../utils/permissions';
import { dateToShamsiString, getShamsiWeekRange, getTodayShamsi, shamsiStringToDate, toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { exportWorksheetTermExcel, exportWorksheetWeekExcel } from '../utils/worksheetExport';
import { isDeadlinePassed, shiftWeek, summarizeClassWeek, weekStartOf, weekTitle, worksheetKey } from '../utils/worksheets';

type Filter = 'all' | 'missing' | WorksheetStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'missing', label: 'تحویل نداده' },
  { key: 'partial', label: 'ناقص' },
  { key: 'complete', label: 'کامل' },
  { key: 'absent', label: 'غایب' },
];

const BUTTONS: { status: WorksheetStatus; label: string; icon: React.ElementType; on: string }[] = [
  { status: 'complete', label: 'کامل', icon: Check, on: 'bg-emerald-600 border-emerald-600 text-white shadow-sm' },
  { status: 'partial', label: 'ناقص', icon: Minus, on: 'bg-amber-500 border-amber-500 text-white shadow-sm' },
  { status: 'absent', label: 'غایب', icon: UserX, on: 'bg-slate-600 border-slate-600 text-white shadow-sm' },
];

const addDays = (shamsi: string, days: number): string => {
  const d = shamsiStringToDate(shamsi);
  d.setDate(d.getDate() + days);
  return dateToShamsiString(d);
};

const daysBetween = (fromShamsi: string, toShamsi: string): number =>
  Math.round((shamsiStringToDate(toShamsi).getTime() - shamsiStringToDate(fromShamsi).getTime()) / 86_400_000);

/**
 * کاربرگ هفتگی: «تحویل نداده» حالت پیش‌فرض است؛ مربی فقط کسانی را که تحویل داده‌اند با یک لمس علامت می‌زند
 * (کامل / ناقص / غایب). معاونت آموزش مهلت هر هفته را تعیین می‌کند و همه‌ی کلاس‌ها را می‌بیند؛
 * مربی فقط کلاس‌های خودش را؛ معاون تربیتی فقط مشاهده.
 */
export const WorksheetsWorkspace: React.FC = () => {
  const {
    currentUser,
    students,
    classes,
    nurturingClasses,
    worksheets,
    worksheetWeeks,
    setWorksheetStatus,
    markWorksheetsComplete,
    setWorksheetDeadline,
    showConfirm,
    showToast,
  } = useSchool();

  const canRecord = hasPermission(currentUser, 'manage-worksheets');
  const isEducationalManager = ['admin', 'vice_educational', 'vice_principal'].includes(currentUser.role) && canRecord;
  const isCoach = currentUser.role === 'coach';

  // مربی فقط کلاس‌های خودش؛ معاونین همه‌ی کلاس‌ها
  const myClasses = useMemo(() => (isCoach ? nurturingClasses : classes), [isCoach, nurturingClasses, classes]);
  const classStudents = useMemo(() => {
    const map = new Map<string, Student[]>();
    myClasses.forEach((c) => map.set(c.id, []));
    students.forEach((s) => map.get(s.classId)?.push(s));
    map.forEach((list) => list.sort((a, b) => studentFullName(a).localeCompare(studentFullName(b), 'fa')));
    return map;
  }, [myClasses, students]);

  const [weekStart, setWeekStart] = useState(() => weekStartOf());
  const [classId, setClassId] = useState<string>('');
  const [filter, setFilter] = useState<Filter>('all');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [deadlineText, setDeadlineText] = useState('');

  useEffect(() => {
    if (!classId || !classStudents.has(classId)) setClassId(myClasses[0]?.id || '');
  }, [classId, myClasses, classStudents]);

  const records = useMemo(() => new Map(worksheets.map((r) => [r.id, r])), [worksheets]);
  const week = worksheetWeeks.find((w) => w.weekStart === weekStart);
  const deadline = week?.deadline || null;
  const range = getShamsiWeekRange(weekStart);
  const todayStr = getTodayShamsi().formattedDate;
  const isCurrentWeek = weekStart === weekStartOf();

  const list = classStudents.get(classId) || [];
  const sum = summarizeClassWeek(list, records, weekStart);
  const delivered = sum.complete + sum.partial;

  const visible = list.filter((s) => {
    const st = records.get(worksheetKey(s.id, weekStart))?.status;
    return filter === 'all' ? true : filter === 'missing' ? !st : st === filter;
  });

  useEffect(() => setDeadlineText(deadline || ''), [deadline, weekStart]);

  const saveDeadline = (value: string) => {
    const clean = toEnglishDigits(value).trim();
    if (clean === '') {
      setWorksheetDeadline(weekStart, null);
      showToast('مهلت این هفته برداشته شد.', 'info');
      setDeadlineOpen(false);
      return;
    }
    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(clean)) {
      showToast('تاریخ را مثل 1405/07/19 وارد کنید.', 'error');
      return;
    }
    const [y, m, d] = clean.split('/').map(Number);
    const normalized = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    setWorksheetDeadline(weekStart, normalized);
    showToast('مهلت ثبت کاربرگ ذخیره شد.', 'success');
    setDeadlineOpen(false);
  };

  const toggle = (s: Student, status: WorksheetStatus) => {
    if (!canRecord) return;
    const current = records.get(worksheetKey(s.id, weekStart))?.status;
    setWorksheetStatus(s, weekStart, current === status ? null : status);
  };

  const completeAllMissing = () => {
    const targets = list.filter((s) => !records.has(worksheetKey(s.id, weekStart)));
    if (targets.length === 0) return;
    showConfirm({
      title: 'همه کامل تحویل داده‌اند؟',
      message: `${toPersianDigits(targets.length)} دانش‌آموزِ بدون وضعیت، «کامل» علامت می‌خورند. بعداً هر کدام را می‌توانید تغییر دهید.`,
      confirmLabel: 'بله، همه کامل',
      cancelLabel: 'انصراف',
      onConfirm: () => markWorksheetsComplete(targets, weekStart),
    });
  };

  // وضعیت مهلت
  let deadlineChip: { text: string; tone: string };
  if (!deadline) {
    deadlineChip = { text: 'مهلت این هفته تعیین نشده', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
  } else if (isDeadlinePassed(deadline)) {
    deadlineChip = { text: `مهلت ثبت گذشته (${toPersianDigits(deadline)})`, tone: 'bg-rose-50 text-rose-700 border-rose-200' };
  } else {
    const left = daysBetween(todayStr, deadline);
    deadlineChip = {
      text: left === 0 ? `امروز آخرین مهلت ثبت است (${toPersianDigits(deadline)})` : `مهلت ثبت: ${toPersianDigits(deadline)} — ${toPersianDigits(left)} روز مانده`,
      tone: left <= 1 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  if (myClasses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500" dir="rtl">
        کلاسی برای نمایش کاربرگ وجود ندارد.
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl" id="worksheets-workspace">
      {/* سربرگ: هفته و مهلت */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-sm">
              <ClipboardCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900">کاربرگ هفتگی</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {canRecord ? 'فقط دانش‌آموزانی را که کاربرگ را تحویل داده‌اند علامت بزنید؛ بقیه «تحویل نداده» می‌مانند.' : 'نمای فقط‌خواندنی کاربرگ دانش‌آموزان.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setWeekStart(shiftWeek(weekStart, -1))}
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer"
              aria-label="هفته قبل"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="min-w-[8.5rem] text-center">
              <div className="text-sm font-black text-slate-900">{weekTitle(weekStart)}</div>
              <div className="text-[11px] text-slate-400">{isCurrentWeek ? 'هفته جاری' : toPersianDigits(range.startDate)}</div>
            </div>
            <button
              type="button"
              onClick={() => setWeekStart(shiftWeek(weekStart, 1))}
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer"
              aria-label="هفته بعد"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {!isCurrentWeek && (
              <button type="button" onClick={() => setWeekStart(weekStartOf())} className="px-3 h-10 rounded-xl text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 cursor-pointer">
                امروز
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${deadlineChip.tone}`}>
            <CalendarClock className="w-3.5 h-3.5" />
            {deadlineChip.text}
          </span>
          <button
            type="button"
            onClick={() => exportWorksheetWeekExcel({ students, classes: myClasses, worksheets, worksheetWeeks }, weekStart)}
            className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>اکسل این هفته</span>
          </button>
          <button
            type="button"
            onClick={() => exportWorksheetTermExcel({ students, classes: myClasses, worksheets, worksheetWeeks })}
            className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer inline-flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>اکسل ترمی (همه‌ی هفته‌ها)</span>
          </button>
          {isEducationalManager && (
            <button
              type="button"
              onClick={() => setDeadlineOpen((v) => !v)}
              className="px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
            >
              {deadline ? 'تغییر مهلت' : 'تعیین مهلت'}
            </button>
          )}
        </div>

        {isEducationalManager && deadlineOpen && (
          <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-3.5 space-y-3">
            <div className="text-xs text-slate-600 leading-6">
              مهلت ثبت کاربرگ این هفته را مشخص کنید. پس از گذشتن مهلت، دانش‌آموزان «تحویل نداده» و «ناقص» در داشبورد معاونت آموزش هشدار می‌شوند.
              هفته‌ای که مهلت ندارد (مثلاً تعطیل یا بدون کاربرگ) هشدار هم ندارد.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                ['چهارشنبه', 4],
                ['پنجشنبه', 5],
              ].map(([label, offset]) => (
                <button
                  key={String(label)}
                  type="button"
                  onClick={() => saveDeadline(addDays(weekStart, Number(offset)))}
                  className="px-3.5 py-2 rounded-xl border border-teal-300 bg-white hover:bg-teal-50 text-xs font-bold text-teal-800 cursor-pointer"
                >
                  {label} همین هفته
                </button>
              ))}
              <input
                dir="ltr"
                inputMode="numeric"
                value={deadlineText}
                onChange={(e) => setDeadlineText(e.target.value)}
                placeholder="1405/07/19"
                className="w-32 text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-600 font-mono text-center"
              />
              <button type="button" onClick={() => saveDeadline(deadlineText)} className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-extrabold cursor-pointer">
                ذخیره
              </button>
              {deadline && (
                <button type="button" onClick={() => saveDeadline('')} className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 cursor-pointer">
                  برداشتن مهلت
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* انتخاب کلاس */}
      {myClasses.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {myClasses.map((c) => {
            const s = summarizeClassWeek(classStudents.get(c.id) || [], records, weekStart);
            const active = c.id === classId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setClassId(c.id)}
                className={`shrink-0 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                  active ? 'bg-teal-800 border-teal-800 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{c.name}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                  {toPersianDigits(s.complete + s.partial)}/{toPersianDigits(s.total)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* خلاصه و فیلتر */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-black text-slate-900">
            تحویل: {toPersianDigits(delivered)} از {toPersianDigits(sum.total)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">کامل {toPersianDigits(sum.complete)}</span>
            <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">ناقص {toPersianDigits(sum.partial)}</span>
            <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">غایب {toPersianDigits(sum.absent)}</span>
            <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">تحویل نداده {toPersianDigits(sum.missing)}</span>
          </div>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex" aria-hidden="true">
          <div className="bg-emerald-500" style={{ width: `${sum.total ? (sum.complete / sum.total) * 100 : 0}%` }} />
          <div className="bg-amber-400" style={{ width: `${sum.total ? (sum.partial / sum.total) * 100 : 0}%` }} />
          <div className="bg-slate-400" style={{ width: `${sum.total ? (sum.absent / sum.total) * 100 : 0}%` }} />
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full border text-[11px] font-bold transition cursor-pointer ${
                  filter === f.key ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {canRecord && sum.missing > 0 && (
            <button
              type="button"
              onClick={completeAllMissing}
              className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-extrabold cursor-pointer"
            >
              همه‌ی بدون وضعیت = کامل
            </button>
          )}
          {!canRecord && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <Eye className="w-3.5 h-3.5" /> فقط مشاهده
            </span>
          )}
        </div>
      </div>

      {/* دانش‌آموزان */}
      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">دانش‌آموزی در این کلاس نیست.</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">موردی با این فیلتر نیست.</div>
      ) : (
        <ul className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {visible.map((s, idx) => {
            const rec = records.get(worksheetKey(s.id, weekStart));
            const status = rec?.status;
            return (
              <li key={s.id} className="px-3 sm:px-4 py-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                  <div className="flex items-center gap-3 min-w-0 sm:flex-1">
                  <span className="w-6 text-center text-[11px] font-mono text-slate-400 shrink-0">{toPersianDigits(idx + 1)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 truncate">{studentFullName(s)}</div>
                    {!status && <div className="text-[11px] font-bold text-rose-600 mt-0.5">تحویل نداده</div>}
                    {rec?.note && noteFor !== s.id && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{rec.note}</div>}
                  </div>
                  </div>

                  <div className="flex items-stretch gap-1.5 sm:shrink-0" role="group" aria-label={`وضعیت کاربرگ ${studentFullName(s)}`}>
                    {BUTTONS.map((b) => {
                      const on = status === b.status;
                      const Icon = b.icon;
                      return (
                        <button
                          key={b.status}
                          type="button"
                          disabled={!canRecord}
                          aria-pressed={on}
                          onClick={() => toggle(s, b.status)}
                          className={`flex-1 sm:flex-none sm:min-w-[4.25rem] min-w-0 h-11 px-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1 transition active:scale-95 ${
                            on ? b.on : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          } ${canRecord ? 'cursor-pointer' : 'cursor-default opacity-90'} ${!canRecord && !on ? 'opacity-40' : ''}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{b.label}</span>
                        </button>
                      );
                    })}
                    {canRecord && !status && <span className="w-11 shrink-0" aria-hidden="true" />}
                    {canRecord && status && (
                      <button
                        type="button"
                        onClick={() => setNoteFor(noteFor === s.id ? null : s.id)}
                        title="یادداشت"
                        aria-label="یادداشت"
                        className={`w-11 h-11 shrink-0 rounded-xl border flex items-center justify-center cursor-pointer ${rec?.note ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                      >
                        <StickyNote className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {canRecord && noteFor === s.id && status && (
                  <input
                    autoFocus
                    defaultValue={rec?.note || ''}
                    maxLength={200}
                    placeholder="یادداشت کوتاه (مثلاً کدام بخش ناقص است)"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (rec?.note || '')) setWorksheetStatus(s, weekStart, status, v || null);
                      setNoteFor(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    className="mt-2.5 w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-sky-400"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
