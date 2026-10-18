import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ClipboardList, Search, Sparkles, TriangleAlert, UserRound } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { Student } from '../types';
import { computeFollowUps } from '../utils/academicFollowUp';
import { GREY_CAUSES, GREY_SUBJECT_BELOW, GreyEntry, academicSnapshot } from '../utils/greyList';
import { SCORE_BAND_STYLE, scoreBand } from '../utils/gradePeriods';
import { toPersianDigits } from '../utils/persianDate';
import { compareStudents, studentFullName } from '../utils/studentName';

type Filter = 'all' | 'no_cause' | 'no_action' | 'done';

const QUICK_ACTIONS = ['تماس با ولی', 'جلسه با دبیر درس', 'کلاس تقویتی', 'مشاوره با دانش‌آموز', 'پیگیری تکلیف هفتگی'];

const fa = (n?: number) => (n === undefined ? '—' : toPersianDigits(String(n)));

/** متن چندخطی که هنگام تایپ محلی می‌ماند و با خروج از کادر ذخیره می‌شود */
const AutoSaveText: React.FC<{
  value: string;
  onCommit: (v: string) => void;
  placeholder: string;
  label: string;
  rows?: number;
  appendRef?: React.MutableRefObject<((t: string) => void) | null>;
}> = ({ value, onCommit, placeholder, label, rows = 3, appendRef }) => {
  const [text, setText] = useState(value);
  const [saved, setSaved] = useState(false);
  useEffect(() => setText(value), [value]);
  const commit = (v: string) => {
    if (v.trim() === value.trim()) return;
    onCommit(v);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  useEffect(() => {
    if (!appendRef) return;
    appendRef.current = (t: string) => {
      const next = text.trim() ? `${text.trim()}، ${t}` : t;
      setText(next);
      commit(next);
    };
    return () => { appendRef.current = null; };
  });
  return (
    <div className="relative">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
        rows={rows}
        maxLength={1000}
        placeholder={placeholder}
        aria-label={label}
        className="w-full text-sm leading-6 bg-white focus:bg-white border border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 rounded-2xl px-3.5 py-2.5 outline-none transition resize-none"
      />
      {saved && <span className="absolute left-3 bottom-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><Check className="w-3.5 h-3.5" />ذخیره شد</span>}
    </div>
  );
};

const CauseEditor: React.FC<{ entry: GreyEntry; onChange: (patch: { causes?: string[]; causeOther?: string }) => void }> = ({ entry, onChange }) => {
  const selected = new Set(entry.record?.causes ?? []);
  const otherOn = selected.has('other');
  const [other, setOther] = useState(entry.record?.causeOther ?? '');
  useEffect(() => setOther(entry.record?.causeOther ?? ''), [entry.record?.causeOther]);
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange(key === 'other' && !next.has('other') ? { causes: [...next], causeOther: '' } : { causes: [...next] });
  };
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="علت ضعف">
        {[...GREY_CAUSES, { key: 'other', label: 'سایر' }].map((c) => {
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
      {otherOn && (
        <input
          type="text"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onBlur={() => other.trim() !== (entry.record?.causeOther ?? '').trim() && onChange({ causeOther: other })}
          maxLength={300}
          placeholder="علت دیگر را بنویسید..."
          aria-label="علت دیگر"
          className="w-full min-h-[44px] text-sm bg-white border border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 rounded-2xl px-3.5 outline-none transition"
        />
      )}
    </div>
  );
};

const ActionEditor: React.FC<{ entry: GreyEntry; onCommit: (v: string) => void }> = ({ entry, onCommit }) => {
  const appendRef = React.useRef<((t: string) => void) | null>(null);
  return (
    <div className="space-y-2">
      <AutoSaveText value={entry.record?.action ?? ''} onCommit={onCommit} placeholder="اقدام انجام‌شده یا برنامه‌ی پیگیری..." label={`اقدام ${studentFullName(entry.student)}`} appendRef={appendRef} />
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map((q) => (
          <button key={q} type="button" onClick={() => appendRef.current?.(q)} className="min-h-[34px] px-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-600 cursor-pointer">
            + {q}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * لیست خاکستری آموزش: دانش‌آموزانی که در فهرست «نیازمند پیگیری آموزشی» هستند، با میانگین، دروس زیر ۱۶،
 * دلایل ورود به لیست و دو یادداشت «علت ضعف» (چندانتخابی + سایر) و «اقدام» برای پیگیری مربیان.
 */
export const GreyListWorkspace: React.FC<{ onSelectStudent?: (student: Student) => void }> = ({ onSelectStudent }) => {
  const { currentUser, students, classes, nurturingClasses, academicGrades, comprehensiveExams, worksheets, worksheetWeeks, sessions, academicFollowUps, setAcademicFollowUp } = useSchool();
  const isCoach = currentUser.role === 'coach';
  const classList = useMemo(() => (isCoach ? nurturingClasses : classes).filter((c) => !c.isWorkshop), [isCoach, nurturingClasses, classes]);
  const classIds = useMemo(() => new Set(classList.map((c) => c.id)), [classList]);
  const scoped = useMemo(() => students.filter((s) => classIds.has(s.classId)), [students, classIds]);

  const [classId, setClassId] = useState('all');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const entries = useMemo<GreyEntry[]>(() => {
    const reasonsBy = computeFollowUps({ students: scoped, grades: academicGrades, exams: comprehensiveExams, worksheets, worksheetWeeks, sessions });
    const records = new Map(academicFollowUps.map((r) => [r.studentId, r]));
    return scoped
      .filter((s) => (reasonsBy.get(s.id) || []).length > 0)
      .map((student) => {
        const reasons = reasonsBy.get(student.id) || [];
        return {
          student,
          reasons,
          priority: new Set(reasons.map((r) => r.kind)).size,
          ...academicSnapshot(academicGrades.filter((g) => g.studentId === student.id)),
          record: records.get(student.id),
        };
      })
      .sort((a, b) => b.priority - a.priority || compareStudents(a.student, b.student));
  }, [scoped, academicGrades, comprehensiveExams, worksheets, worksheetWeeks, sessions, academicFollowUps]);

  const hasCause = (e: GreyEntry) => (e.record?.causes?.length ?? 0) > 0;
  const hasAction = (e: GreyEntry) => Boolean(e.record?.action?.trim());
  const stats = { total: entries.length, noCause: entries.filter((e) => !hasCause(e)).length, noAction: entries.filter((e) => !hasAction(e)).length, done: entries.filter((e) => hasCause(e) && hasAction(e)).length };

  const visible = entries.filter((e) => {
    if (classId !== 'all' && e.student.classId !== classId) return false;
    if (query.trim() && !studentFullName(e.student).includes(query.trim())) return false;
    if (filter === 'no_cause') return !hasCause(e);
    if (filter === 'no_action') return !hasAction(e);
    if (filter === 'done') return hasCause(e) && hasAction(e);
    return true;
  });
  const className = (id: string) => classList.find((c) => c.id === id)?.name ?? '';
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  const FILTERS: { key: Filter; label: string; n: number }[] = [
    { key: 'all', label: 'همه', n: stats.total },
    { key: 'no_cause', label: 'بدون علت', n: stats.noCause },
    { key: 'no_action', label: 'بدون اقدام', n: stats.noAction },
    { key: 'done', label: 'پیگیری‌شده', n: stats.done },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      {/* سربرگ و آمار */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><ClipboardList className="w-6 h-6" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-slate-900">لیست خاکستری آموزش</h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-6">دانش‌آموزانی که نقص آموزشی دارند. برای هر نفر «علت ضعف» را انتخاب و «اقدام» را یادداشت کنید تا پیگیری از دست نرود.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'در لیست', value: stats.total, tone: 'bg-slate-50 text-slate-900' },
            { label: 'بدون علت', value: stats.noCause, tone: stats.noCause ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800' },
            { label: 'بدون اقدام', value: stats.noAction, tone: stats.noAction ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800' },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl px-3 py-2.5 ${s.tone}`}>
              <div className="text-[11px] font-bold opacity-75">{s.label}</div>
              <div className="text-2xl font-black leading-8">{toPersianDigits(s.value)}</div>
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
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)} className={`shrink-0 min-h-[40px] px-3.5 rounded-full border text-xs font-extrabold cursor-pointer transition ${filter === f.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {f.label} <span className="opacity-70">{toPersianDigits(f.n)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* کارت‌های دانش‌آموزان */}
      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-14 px-6 text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Sparkles className="w-7 h-7" /></div>
          <div className="text-sm font-extrabold text-slate-800">{stats.total === 0 ? 'هیچ دانش‌آموزی در لیست خاکستری نیست' : 'موردی با این فیلتر پیدا نشد'}</div>
          <div className="text-xs text-slate-500">{stats.total === 0 ? 'همه‌ی دانش‌آموزان از نظر آموزشی در وضعیت مناسبی هستند.' : 'فیلترها را تغییر دهید.'}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((e, idx) => {
            const band = scoreBand(e.average);
            const edge = e.priority >= 4 ? 'border-r-rose-500' : e.priority === 3 ? 'border-r-orange-400' : 'border-r-amber-300';
            return (
              <article key={e.student.id} className={`bg-white rounded-2xl border border-slate-200 border-r-4 ${edge} shadow-sm overflow-hidden`}>
                <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,1fr)] gap-0 md:divide-x md:divide-x-reverse divide-slate-100">
                  {/* دانش‌آموز */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><UserRound className="w-5 h-5" /></div>
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={() => onSelectStudent?.(e.student)} className="block text-right text-[15px] font-black text-slate-900 truncate max-w-full cursor-pointer">
                          <span className="text-slate-300 text-xs font-bold ml-1.5">{toPersianDigits(idx + 1)}</span>{studentFullName(e.student)}
                        </button>
                        <div className="text-xs text-slate-500">{className(e.student.classId)}</div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-sm font-black whitespace-nowrap ${band ? SCORE_BAND_STYLE[band].cell : 'bg-slate-50 text-slate-400'}`} title="میانگین نمرات مستمر">
                        {fa(e.average)}
                      </span>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold text-slate-500 mb-1.5">دروس زیر {toPersianDigits(GREY_SUBJECT_BELOW)}</div>
                      {e.weakSubjects.length === 0 ? (
                        <div className="text-xs text-slate-400">درس مستمر زیر {toPersianDigits(GREY_SUBJECT_BELOW)} ثبت نشده</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {e.weakSubjects.map((s) => {
                            const b = scoreBand(s.score);
                            return <span key={s.name} className={`px-2.5 py-1 rounded-lg text-[12px] font-bold ${b ? SCORE_BAND_STYLE[b].cell : 'bg-slate-50 text-slate-500'}`}>{s.name} <b>{fa(s.score)}</b></span>;
                          })}
                        </div>
                      )}
                    </div>

                    <details className="group rounded-xl bg-slate-50 px-3 py-2">
                      <summary className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600 cursor-pointer list-none">
                        <TriangleAlert className="w-3.5 h-3.5 text-amber-500" />
                        چرا در لیست است؟ ({toPersianDigits(e.reasons.length)} مورد)
                        <ChevronDown className="w-4 h-4 mr-auto transition group-open:rotate-180" />
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {e.reasons.map((r, i) => (
                          <li key={`${r.kind}-${i}`} className="text-[12px] leading-5 text-slate-700"><b className="text-rose-700">{r.label}:</b> {toPersianDigits(r.detail)}</li>
                        ))}
                      </ul>
                    </details>
                  </div>

                  {/* علت ضعف */}
                  <div className="p-4 space-y-2 border-t md:border-t-0 border-slate-100">
                    <div className="text-xs font-extrabold text-slate-700">علت ضعف <span className="font-medium text-slate-400">(چند مورد را می‌توانید انتخاب کنید)</span></div>
                    <CauseEditor entry={e} onChange={(patch) => setAcademicFollowUp(e.student, patch)} />
                  </div>

                  {/* اقدام */}
                  <div className="p-4 space-y-2 border-t md:border-t-0 border-slate-100 bg-slate-50/50">
                    <div className="text-xs font-extrabold text-slate-700">اقدام</div>
                    <ActionEditor entry={e} onCommit={(v) => setAcademicFollowUp(e.student, { action: v })} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
