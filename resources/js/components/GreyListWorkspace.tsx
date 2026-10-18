import React, { useEffect, useMemo, useState } from 'react';
import { AlarmClock, Check, ChevronDown, ClipboardList, Plus, Rows3, Search, Sparkles, Trash2, TriangleAlert, UserRound, Users } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { GreyListRecord, Student } from '../types';
import { GREY_CAUSES, GREY_OTHER, GREY_SUBJECT_BELOW, causeLabel, isFollowUpDue } from '../utils/greyList';
import { SCORE_BAND_STYLE, scoreBand } from '../utils/gradePeriods';
import { getTodayShamsi, toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { academicMonths, currentMonthKey } from '../utils/teacherActivities';
import { compareStudents, studentFullName } from '../utils/studentName';
import { ShamsiDatePicker } from './ShamsiDatePicker';

type Filter = 'all' | 'no_cause' | 'no_action' | 'due' | 'done';
type View = 'students' | 'causes';

const QUICK_ACTIONS = ['تماس با ولی', 'جلسه با دبیر درس', 'کلاس تقویتی', 'مشاوره با دانش‌آموز', 'پیگیری تکلیف هفتگی'];
const COMPACT_KEY = 'yavaran:grey-compact';

const fa = (n?: number | null) => (n === null || n === undefined ? '—' : toPersianDigits(String(n)));
const faDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' });
};

interface Entry {
  rec: GreyListRecord;
  student: Student;
  className: string;
}

const hasCause = (r: GreyListRecord) => r.causes.length > 0;
const hasAction = (r: GreyListRecord) => r.actions.length > 0;

/** علت ضعف: چیپ‌های چندانتخابی + «سایر» با کادر نوشتن */
const CauseEditor: React.FC<{ rec: GreyListRecord; onChange: (patch: { causes?: string[]; causeOther?: string }) => void }> = ({ rec, onChange }) => {
  const selected = new Set(rec.causes);
  const [other, setOther] = useState(rec.causeOther ?? '');
  useEffect(() => setOther(rec.causeOther ?? ''), [rec.causeOther]);
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(key === 'other' && !next.has('other') ? { causes: [...next], causeOther: '' } : { causes: [...next] });
  };
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="علت ضعف">
        {[...GREY_CAUSES, GREY_OTHER].map((c) => {
          const on = selected.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              aria-pressed={on}
              className={`min-h-[40px] px-3 rounded-full border text-[12px] font-bold inline-flex items-center gap-1 cursor-pointer transition active:scale-[0.97] ${
                on ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {on && <Check className="w-3.5 h-3.5" />}
              {c.label}
            </button>
          );
        })}
      </div>
      {selected.has('other') && (
        <input
          type="text"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onBlur={() => other.trim() !== (rec.causeOther ?? '').trim() && onChange({ causeOther: other })}
          maxLength={300}
          placeholder="علت دیگر را بنویسید..."
          aria-label="علت دیگر"
          className="w-full min-h-[44px] text-sm bg-white border border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 rounded-2xl px-3.5 outline-none transition"
        />
      )}
    </div>
  );
};

/** اقدام‌ها: تاریخچه‌ی ثابت (قدیمی‌ترین پایین) + ثبت اقدام تازه + تاریخ پیگیری بعدی */
const ActionPanel: React.FC<{ rec: GreyListRecord; today: string; onAdd: (text: string) => void; onNext: (d: string | null) => void }> = ({ rec, today, onAdd, onNext }) => {
  const [text, setText] = useState('');
  const due = isFollowUpDue(rec, today);
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText('');
  };
  return (
    <div className="space-y-3">
      <div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="اقدام انجام‌شده یا برنامه‌ی پیگیری..."
          aria-label="اقدام جدید"
          className="w-full text-sm leading-6 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 rounded-2xl px-3.5 py-2.5 outline-none transition resize-none"
        />
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {QUICK_ACTIONS.map((q) => (
            <button key={q} type="button" onClick={() => setText((t) => (t.trim() ? `${t.trim()}، ${q}` : q))} className="min-h-[34px] px-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-600 cursor-pointer">+ {q}</button>
          ))}
        </div>
        <button type="button" onClick={submit} disabled={!text.trim()} className="mt-2 w-full min-h-[44px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition">
          <Plus className="w-4 h-4" /> ثبت اقدام
        </button>
      </div>

      <div className={`rounded-2xl border px-3 py-2.5 space-y-1.5 ${due ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center gap-1.5 text-[12px] font-extrabold ${due ? 'text-rose-700' : 'text-slate-600'}`}>
          <AlarmClock className="w-4 h-4" /> پیگیری بعدی {due && <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px]">سررسید رسیده</span>}
        </div>
        <div className="flex items-center gap-2">
          <ShamsiDatePicker value={rec.nextFollowUp ?? ''} onChange={(v) => onNext(v || null)} placeholder="انتخاب تاریخ..." className="flex-1 h-10 text-sm bg-white border border-slate-200 rounded-xl px-3 outline-none focus:border-emerald-500 text-center cursor-pointer" />
          {rec.nextFollowUp && <button type="button" onClick={() => onNext(null)} aria-label="حذف تاریخ" className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
        </div>
      </div>

      {rec.actions.length > 0 && (
        <ol className="relative border-r-2 border-slate-200 pr-4 space-y-2.5">
          {[...rec.actions].reverse().map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -right-[22px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
              <div className="text-[13px] leading-6 text-slate-800">{a.text}</div>
              <div className="text-[11px] text-slate-400">{a.by} • {faDate(a.at)}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

/**
 * لیست خاکستری آموزش (ماهانه): معاونت آموزش دانش‌آموزان نیازمند پیگیری را برای یک ماه به این لیست می‌فرستد؛ تصویر وضعیت آموزشی
 * همان لحظه ثابت می‌ماند. مربیان و معاون تربیتی «علت ضعف» (چندانتخابی)، «اقدام‌ها» و تاریخ پیگیری بعدی را ثبت می‌کنند.
 */
export const GreyListWorkspace: React.FC<{ onSelectStudent?: (student: Student) => void }> = ({ onSelectStudent }) => {
  const { currentUser, students, classes, nurturingClasses, greyList, updateGreyEntry, withdrawFromGreyList, showConfirm } = useSchool();
  const isCoach = currentUser.role === 'coach';
  const canWithdraw = ['admin', 'vice_educational', 'vice_principal'].includes(currentUser.role);
  const classList = useMemo(() => (isCoach ? nurturingClasses : classes).filter((c) => !c.isWorkshop), [isCoach, nurturingClasses, classes]);
  const today = getTodayShamsi().formattedDate;

  const nowMonth = currentMonthKey();
  const [month, setMonth] = useState(nowMonth);
  const [view, setView] = useState<View>('students');
  const [classId, setClassId] = useState('all');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [compact, setCompact] = useState<boolean>(() => {
    try { return window.localStorage.getItem(COMPACT_KEY) === '1'; } catch { return false; }
  });
  const toggleCompact = () => {
    setCompact((c) => {
      try { window.localStorage.setItem(COMPACT_KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  // ماه‌های سال تحصیلی تا ماه جاری + ماه‌هایی که رکورد دارند
  const months = useMemo(() => {
    const withData = new Set(greyList.map((r) => r.month));
    return academicMonths().filter((m) => m.key <= nowMonth || withData.has(m.key));
  }, [greyList, nowMonth]);
  const countBy = useMemo(() => {
    const map = new Map<string, number>();
    greyList.forEach((r) => map.set(r.month, (map.get(r.month) ?? 0) + 1));
    return map;
  }, [greyList]);

  const classMap = useMemo(() => new Map(classList.map((c) => [c.id, c.name])), [classList]);
  const entries: Entry[] = useMemo(() => {
    const byId = new Map(students.map((s) => [s.id, s]));
    return greyList
      .filter((r) => r.month === month && classMap.has(r.classId) && byId.has(r.studentId))
      .map((rec) => ({ rec, student: byId.get(rec.studentId) as Student, className: classMap.get(rec.classId) ?? '' }))
      .sort((a, b) => Number(isFollowUpDue(b.rec, today)) - Number(isFollowUpDue(a.rec, today)) || b.rec.snapshot.reasons.length - a.rec.snapshot.reasons.length || compareStudents(a.student, b.student));
  }, [greyList, students, classMap, month, today]);

  const stats = {
    total: entries.length,
    noCause: entries.filter((e) => !hasCause(e.rec)).length,
    noAction: entries.filter((e) => !hasAction(e.rec)).length,
    due: entries.filter((e) => isFollowUpDue(e.rec, today)).length,
    done: entries.filter((e) => hasCause(e.rec) && hasAction(e.rec)).length,
  };
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  const visible = entries.filter((e) => {
    if (classId !== 'all' && e.rec.classId !== classId) return false;
    if (query.trim() && !studentFullName(e.student).includes(toEnglishDigits(query.trim()) === query.trim() ? query.trim() : query.trim())) return false;
    if (filter === 'no_cause') return !hasCause(e.rec);
    if (filter === 'no_action') return !hasAction(e.rec);
    if (filter === 'due') return isFollowUpDue(e.rec, today);
    if (filter === 'done') return hasCause(e.rec) && hasAction(e.rec);
    return true;
  });

  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: 'all', label: 'همه', n: stats.total },
    { key: 'due', label: 'سررسید', n: stats.due },
    { key: 'no_cause', label: 'بدون علت', n: stats.noCause },
    { key: 'no_action', label: 'بدون اقدام', n: stats.noAction },
    { key: 'done', label: 'پیگیری‌شده', n: stats.done },
  ];

  const withdraw = (e: Entry) =>
    showConfirm({
      title: 'برگرداندن از لیست خاکستری؟',
      message: `«${studentFullName(e.student)}» از لیست خاکستری این ماه برداشته می‌شود و علت‌ها و اقدام‌های ثبت‌شده‌اش هم پاک می‌شود.`,
      confirmLabel: 'بله، برگردان',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => withdrawFromGreyList(e.rec.id),
    });

  const studentInfo = (e: Entry) => {
    const { snapshot } = e.rec;
    const band = scoreBand(snapshot.average ?? undefined);
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><UserRound className="w-5 h-5" /></div>
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => onSelectStudent?.(e.student)} className="block text-right text-[15px] font-black text-slate-900 truncate max-w-full cursor-pointer">{studentFullName(e.student)}</button>
            <div className="text-xs text-slate-500">{e.className}</div>
          </div>
          <span className={`px-2.5 py-1 rounded-xl text-sm font-black whitespace-nowrap ${band ? SCORE_BAND_STYLE[band].cell : 'bg-slate-50 text-slate-400'}`} title="میانگین نمرات مستمر در لحظه‌ی ارسال">{fa(snapshot.average)}</span>
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-500 mb-1.5">دروس زیر {toPersianDigits(GREY_SUBJECT_BELOW)}</div>
          {snapshot.weakSubjects.length === 0 ? (
            <div className="text-xs text-slate-400">درس مستمر زیر {toPersianDigits(GREY_SUBJECT_BELOW)} ثبت نشده بود</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {snapshot.weakSubjects.map((s) => {
                const b = scoreBand(s.score);
                return <span key={s.name} className={`px-2.5 py-1 rounded-lg text-[12px] font-bold ${b ? SCORE_BAND_STYLE[b].cell : 'bg-slate-50 text-slate-500'}`}>{s.name} <b>{fa(s.score)}</b></span>;
              })}
            </div>
          )}
        </div>
        <details className="group rounded-xl bg-slate-50 px-3 py-2">
          <summary className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600 cursor-pointer list-none">
            <TriangleAlert className="w-3.5 h-3.5 text-amber-500" /> چرا در لیست است؟ ({toPersianDigits(snapshot.reasons.length)} مورد)
            <ChevronDown className="w-4 h-4 mr-auto transition group-open:rotate-180" />
          </summary>
          <ul className="mt-2 space-y-1.5">
            {snapshot.reasons.map((r, i) => <li key={`${r.kind}-${i}`} className="text-[12px] leading-5 text-slate-700"><b className="text-rose-700">{r.label}:</b> {toPersianDigits(r.detail)}</li>)}
          </ul>
        </details>
        <div className="text-[11px] text-slate-400">ارسال‌شده توسط {e.rec.sentBy} • {faDate(e.rec.sentAt)}</div>
        {canWithdraw && <button type="button" onClick={() => withdraw(e)} className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer">برگرداندن از لیست خاکستری</button>}
      </div>
    );
  };

  const fullCard = (e: Entry) => {
    const due = isFollowUpDue(e.rec, today);
    const edge = due ? 'border-r-rose-500' : e.rec.snapshot.reasons.length >= 4 ? 'border-r-orange-400' : 'border-r-amber-300';
    return (
      <article key={e.rec.id} className={`bg-white rounded-2xl border border-slate-200 border-r-4 ${edge} shadow-sm overflow-hidden`}>
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.1fr)] md:divide-x md:divide-x-reverse divide-slate-100">
          <div className="p-4">{studentInfo(e)}</div>
          <div className="p-4 space-y-2 border-t md:border-t-0 border-slate-100">
            <div className="text-xs font-extrabold text-slate-700">علت ضعف <span className="font-medium text-slate-400">(چند مورد را می‌توانید انتخاب کنید)</span></div>
            <CauseEditor rec={e.rec} onChange={(patch) => updateGreyEntry(e.rec.id, patch)} />
          </div>
          <div className="p-4 space-y-2 border-t md:border-t-0 border-slate-100 bg-slate-50/50">
            <div className="text-xs font-extrabold text-slate-700">اقدام</div>
            <ActionPanel rec={e.rec} today={today} onAdd={(t) => updateGreyEntry(e.rec.id, { addAction: t })} onNext={(d) => updateGreyEntry(e.rec.id, { nextFollowUp: d })} />
          </div>
        </div>
      </article>
    );
  };

  const compactRow = (e: Entry) => {
    const open = openId === e.rec.id;
    const band = scoreBand(e.rec.snapshot.average ?? undefined);
    const due = isFollowUpDue(e.rec, today);
    const last = e.rec.actions[e.rec.actions.length - 1];
    return (
      <div key={e.rec.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${due ? 'border-rose-200' : 'border-slate-200'}`}>
        <button type="button" onClick={() => setOpenId(open ? null : e.rec.id)} aria-expanded={open} className="w-full min-h-[56px] px-3 py-2 flex items-center gap-2.5 text-right cursor-pointer hover:bg-slate-50">
          <span className={`px-2 py-1 rounded-lg text-xs font-black shrink-0 ${band ? SCORE_BAND_STYLE[band].cell : 'bg-slate-50 text-slate-400'}`}>{fa(e.rec.snapshot.average)}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-slate-900 truncate">{studentFullName(e.student)} <span className="text-xs font-medium text-slate-400">{e.className}</span></span>
            <span className="block text-[11px] text-slate-500 truncate">
              {e.rec.causes.length ? e.rec.causes.map(causeLabel).slice(0, 2).join('، ') + (e.rec.causes.length > 2 ? ` +${toPersianDigits(e.rec.causes.length - 2)}` : '') : 'علت ثبت نشده'}
              {last ? ` • ${last.text}` : ' • بدون اقدام'}
            </span>
          </span>
          {due && <AlarmClock className="w-4 h-4 text-rose-500 shrink-0" />}
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && <div className="border-t border-slate-100">{fullCard(e)}</div>}
      </div>
    );
  };

  // نمای بر اساس علت
  const causeGroups = useMemo(() => {
    const groups = new Map<string, Entry[]>();
    visible.forEach((e) => {
      const keys = e.rec.causes.length ? e.rec.causes : ['_none'];
      keys.forEach((k) => groups.set(k, [...(groups.get(k) ?? []), e]));
    });
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [visible]);

  return (
    <div className="space-y-4" dir="rtl">
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><ClipboardList className="w-6 h-6" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-slate-900">لیست خاکستری آموزش</h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-6">دانش‌آموزانی که معاونت آموزش برای پیگیری فرستاده است. هر ماه جدا و ثابت می‌ماند؛ علت ضعف را انتخاب و اقدام‌ها را یادداشت کنید.</p>
          </div>
        </div>

        {/* ماه */}
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="ماه">
          {months.map((m) => (
            <button key={m.key} type="button" role="tab" aria-selected={month === m.key} onClick={() => { setMonth(m.key); setOpenId(null); }}
              className={`shrink-0 min-h-[44px] px-4 rounded-2xl border text-sm font-extrabold cursor-pointer transition ${month === m.key ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
              {m.label} {(countBy.get(m.key) ?? 0) > 0 && <span className={`mr-1 text-[11px] ${month === m.key ? 'text-emerald-100' : 'text-slate-400'}`}>{toPersianDigits(countBy.get(m.key) ?? 0)}</span>}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'در لیست', value: stats.total, tone: 'bg-slate-50 text-slate-900' },
            { label: 'سررسید', value: stats.due, tone: stats.due ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800' },
            { label: 'بدون علت', value: stats.noCause, tone: stats.noCause ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800' },
            { label: 'بدون اقدام', value: stats.noAction, tone: stats.noAction ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800' },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl px-2.5 py-2 ${s.tone}`}>
              <div className="text-[10px] sm:text-[11px] font-bold opacity-75">{s.label}</div>
              <div className="text-xl sm:text-2xl font-black leading-8">{toPersianDigits(s.value)}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1"><span>پیشرفت پیگیری (علت و اقدام ثبت‌شده)</span><span>{toPersianDigits(pct)}٪</span></div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="فیلتر کلاس" className="h-11 bg-slate-50 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none border border-transparent focus:border-emerald-500 cursor-pointer">
            <option value="all">همه کلاس‌ها</option>
            {classList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نام دانش‌آموز..." className="w-full h-11 bg-slate-50 rounded-xl pr-9 pl-3 text-sm outline-none border border-transparent focus:border-emerald-500" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex-1" role="tablist">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)} className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-xs font-extrabold cursor-pointer transition ${filter === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {f.label} <span className="opacity-70">{toPersianDigits(f.n)}</span>
              </button>
            ))}
          </div>
          <div className="flex rounded-xl bg-slate-100 p-1 shrink-0" role="group" aria-label="نحوه نمایش">
            <button type="button" onClick={() => setView('students')} aria-pressed={view === 'students'} title="بر اساس دانش‌آموز" className={`w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer ${view === 'students' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}><Users className="w-4 h-4" /></button>
            <button type="button" onClick={() => setView('causes')} aria-pressed={view === 'causes'} title="بر اساس علت" className={`w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer ${view === 'causes' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}><TriangleAlert className="w-4 h-4" /></button>
            <button type="button" onClick={toggleCompact} aria-pressed={compact} title="حالت فشرده" className={`w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer ${compact ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}><Rows3 className="w-4 h-4" /></button>
          </div>
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-14 px-6 text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Sparkles className="w-7 h-7" /></div>
          <div className="text-sm font-extrabold text-slate-800">{stats.total === 0 ? 'برای این ماه هنوز دانش‌آموزی به لیست خاکستری فرستاده نشده' : 'موردی با این فیلتر پیدا نشد'}</div>
          <div className="text-xs text-slate-500">{stats.total === 0 ? 'معاونت آموزش از لیست «نیازمند پیگیری آموزشی» دانش‌آموزان را به اینجا می‌فرستد.' : 'فیلترها را تغییر دهید.'}</div>
        </div>
      ) : view === 'causes' ? (
        <div className="space-y-3">
          {causeGroups.map(([key, list]) => (
            <section key={key} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <header className="px-4 py-3 bg-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800">{key === '_none' ? 'علت ثبت نشده' : causeLabel(key)}</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-xs font-extrabold text-slate-600">{toPersianDigits(list.length)} نفر</span>
              </header>
              <ul className="divide-y divide-slate-100">
                {list.map((e) => (
                  <li key={e.rec.id}>
                    <button type="button" onClick={() => { setView('students'); setOpenId(e.rec.id); setQuery(studentFullName(e.student)); }} className="w-full min-h-[48px] px-4 py-2 flex items-center gap-2 text-right cursor-pointer hover:bg-slate-50">
                      <span className="text-sm font-bold text-slate-900">{studentFullName(e.student)}</span>
                      <span className="text-xs text-slate-400">{e.className}</span>
                      <span className="mr-auto text-xs font-black text-slate-500">{fa(e.rec.snapshot.average)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((e) => (compact ? compactRow(e) : fullCard(e)))}
        </div>
      )}
    </div>
  );
};
