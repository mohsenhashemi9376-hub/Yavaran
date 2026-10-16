import React, { useEffect, useMemo, useState } from 'react';
import { Award, Calendar, ChevronLeft, Eye, GraduationCap, Inbox, Menu, Send, UserCheck, BarChart3 } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student, StudentObservation } from '../types';
import { toPersianDigits, tehranNow } from '../utils/persianDate';
import { MentorMessagesSection } from './MentorMessages';
import { ObservationHomeWidgets } from './ObservationHomeWidgets';
import { DisciplineExcellenceCard, useDisciplineExcellence } from './DisciplineExcellence';
import { Modal } from './ui/Modal';
import { Sparkline } from './Sparkline';
import { apiRequest } from '../lib/serverSync';
import { ReferralsHistoryButton } from './ReferralsHistory';
import { daysAgo } from './ObservationInsights';

const fa = toPersianDigits;
const RECENT_DAYS = 30;

/** کارت «آموزش و انضباط کلاس‌ها»: خلاصه‌ی انضباط هر کلاس + ورود به نمای کامل */
const ClassesEduDisciplineCard: React.FC<{ classes: SchoolClass[]; onOpen: () => void }> = ({ classes, onOpen }) => {
  const { students, schoolAbsences, morningDelays } = useSchool();
  const rows = useMemo(() => {
    const now = tehranNow().getTime();
    const recent = (d: string) => daysAgo(d, now) < RECENT_DAYS;
    return classes.map((cl) => {
      const list = students.filter((s) => s.classId === cl.id);
      const ids = new Set(list.map((s) => s.id));
      const scores = list.map((s) => s.disciplineScore ?? s.disciplinaryScore ?? 20);
      return {
        cl,
        count: list.length,
        avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
        absences: (schoolAbsences || []).filter((a) => ids.has(a.studentId) && recent(a.date)).length,
        delays: (morningDelays || []).filter((d) => ids.has(d.studentId) && recent(d.date)).length,
      };
    });
  }, [classes, students, schoolAbsences, morningDelays]);

  return (
    <section
      className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white/70 to-fuchsia-50/60 shadow-sm backdrop-blur-sm p-4 sm:p-5 space-y-3"
      aria-label="آموزش و انضباط کلاس‌ها"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-violet-600" />
          آموزش و انضباط کلاس‌ها
        </h3>
        <button type="button" onClick={onOpen} className="!min-h-0 h-8 inline-flex items-center gap-1 text-xs font-bold text-violet-700 cursor-pointer">
          مشاهده کامل <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[11px] text-slate-500">میانگین نمره انضباط و غیبت/تأخیرهای {fa(RECENT_DAYS)} روز اخیر</p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">کلاسی وجود ندارد.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rows.map((r) => (
            <li key={r.cl.id}>
              <button
                type="button"
                onClick={onOpen}
                className="w-full min-h-12 text-right rounded-xl border border-violet-100 bg-white/80 px-3 py-2 cursor-pointer active:bg-violet-50 flex items-center justify-between gap-2"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-slate-800 truncate">{r.cl.name}</span>
                  <span className="block text-[11px] text-slate-500">{fa(r.count)} دانش‌آموز</span>
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap">
                  <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800" title="میانگین نمره انضباط">
                    {r.avg === null ? '—' : fa(r.avg.toFixed(1))}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800" title="غیبت">غ {fa(r.absences)}</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800" title="تأخیر">ت {fa(r.delays)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

type TileKey = 'latest' | 'missions' | 'stats' | 'excellence' | 'classes' | 'coaches';

const TONES = {
  emerald: { box: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white/70', icon: 'bg-white/80 text-emerald-600', hint: 'text-emerald-700', line: '#059669' },
  sky: { box: 'border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white/70', icon: 'bg-white/80 text-sky-600', hint: 'text-sky-700', line: '#0284c7' },
  teal: { box: 'border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-white/70', icon: 'bg-white/80 text-teal-600', hint: 'text-teal-700', line: '#0f766e' },
  amber: { box: 'border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white/70', icon: 'bg-white/80 text-amber-600', hint: 'text-amber-700', line: '#d97706' },
  violet: { box: 'border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white/70', icon: 'bg-white/80 text-violet-600', hint: 'text-violet-700', line: '#7c3aed' },
  rose: { box: 'border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white/70', icon: 'bg-white/80 text-rose-600', hint: 'text-rose-700', line: '#e11d48' },
  indigo: { box: 'border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-white/70', icon: 'bg-white/80 text-indigo-600', hint: 'text-indigo-700', line: '#4f46e5' },
} as const;

interface TileProps {
  tone: keyof typeof TONES;
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
  badge?: string;
  spark?: number[];
}

/** کاشی شیشه‌ای رنگی: عنوان، عدد درشت و لینک کوچک (هم‌سبک پنل معاون آموزشی) */
const Tile: React.FC<TileProps> = ({ tone, label, value, hint, icon, onClick, badge, spark }) => {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[7.5rem] p-4 rounded-2xl border shadow-sm backdrop-blur-sm text-right flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer ${t.box}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-600">{label}</span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.icon}`}>{icon}</span>
      </div>
      <div className="text-2xl font-black text-slate-900 tabular-nums mt-2">{value}</div>
      {spark ? (
        <div className="mt-1"><Sparkline values={spark} color={t.line} height={30} /></div>
      ) : null}
      {badge ? (
        <span className="mt-auto pt-1 self-start inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800 whitespace-nowrap">
          {badge}<ChevronLeft className="w-3 h-3" />
        </span>
      ) : (
        <span className={`mt-auto pt-1 text-xs font-medium flex items-center gap-1 ${t.hint}`}>
          <span className="truncate">{hint}</span><ChevronLeft className="w-3 h-3 shrink-0" />
        </span>
      )}
    </button>
  );
};

export interface NurturingViceHomeProps {
  greeting: string;
  roleLabel: string;
  dayOfWeek: string;
  displayDate: string;
  students: Student[];
  classes: SchoolClass[];
  observations: StudentObservation[];
  onOpenSidebar: () => void;
  onOpenObservations: () => void;
  onOpenClassesView: () => void;
  onOpenStudent: (student: Student) => void;
  onSelectDisciplineStudent: (student: Student) => void;
}

const MODAL_TITLES: Record<TileKey, string> = {
  latest: 'آخرین مشاهدات',
  missions: 'مأموریت‌ها و پیام‌ها به مربیان',
  stats: 'آمار مشاهده‌گری همه کلاس‌ها',
  excellence: 'ممتازین انضباطی',
  classes: 'آموزش و انضباط کلاس‌ها',
  coaches: 'آخرین آمار فعالیت مربیان',
};

/** پیشخوان معاون تربیتی: هدر ساده + کاشی‌های شیشه‌ای رنگی (هم‌سبک پنل معاون آموزشی) */
export const NurturingViceHome: React.FC<NurturingViceHomeProps> = ({
  greeting, roleLabel, dayOfWeek, displayDate, students, classes, observations,
  onOpenSidebar, onOpenObservations, onOpenClassesView, onOpenStudent, onSelectDisciplineStudent,
}) => {
  const { allCoaches } = useSchool();
  const [open, setOpen] = useState<TileKey | null>(null);
  const [messages, setMessages] = useState<{ recipients: { acknowledgedAt: string | null }[] }[]>([]);
  useEffect(() => {
    apiRequest<{ messages: typeof messages }>('GET', '/api/mentor-messages/sent')
      .then((r) => setMessages(r.messages || []))
      .catch(() => undefined);
  }, [open]);

  const { excellent } = useDisciplineExcellence('d30');

  const m = useMemo(() => {
    const now = tehranNow().getTime();
    const ids = new Set(students.map((s) => s.id));
    const rows = observations.filter((o) => ids.has(o.studentId)).map((o) => ({ o, d: daysAgo(o.date, now) }));
    const daily = (list: typeof rows, n: number) => {
      const out = new Array(n).fill(0);
      list.forEach(({ d }) => { if (d < n) out[d] += 1; });
      return out;
    };
    const coachRows = rows.filter(({ o }) => o.authorRole === 'coach');
    const latest = [...rows].sort((a, b) => (a.o.date < b.o.date ? 1 : -1))[0]?.o;
    return {
      week: rows.filter(({ d }) => d < 7).length,
      latestTitle: latest?.title,
      all14: daily(rows, 14),
      coach14: daily(coachRows, 14),
      activeCoaches: new Set(coachRows.filter(({ d }) => d < 30).map(({ o }) => String(o.authorId))).size,
    };
  }, [observations, students]);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const pending = messages.filter((x) => x.recipients.some((r) => !r.acknowledgedAt)).length;
  const close = () => setOpen(null);
  const widgetProps = { glass: true, students, classes, observations, isVice: true, onOpenStudent: (s: Student) => { close(); onOpenStudent(s); }, onOpenAll: () => { close(); onOpenObservations(); } };

  return (
    <div className="space-y-4 animate-in fade-in" id="nurturing-vice-home">
      {/* هدر: نام و پست */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-base sm:text-xl font-black text-slate-900 whitespace-nowrap">{greeting} 👋</h1>
              <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-gradient-to-l from-emerald-50 to-teal-50 text-teal-800 border border-teal-200/80 shadow-2xs whitespace-nowrap">
                {roleLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1.5 flex-wrap">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>امروز: {dayOfWeek}، {displayDate}</span>
            </div>
          </div>
          <button
            type="button"
            id="btn-mobile-nurturing-sidebar-toggle"
            onClick={onOpenSidebar}
            className="lg:hidden shrink-0 h-11 w-11 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl transition flex items-center justify-center cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
            title="باز کردن نوار کناری"
            aria-label="باز کردن نوار کناری"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* کاشی‌ها */}
      <div data-stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <Tile tone="emerald" label="آخرین مشاهدات" value={fa(m.week)} hint={m.latestTitle ? `آخرین: ${m.latestTitle}` : 'مشاهده آخرین‌ها'} icon={<Eye className="w-4 h-4" />} onClick={() => setOpen('latest')} />
        <Tile tone="sky" label="مأموریت‌ها" value={fa(messages.length)} hint="پیام‌ها به مربیان" badge={pending > 0 ? `${fa(pending)} بدون تأیید` : undefined} icon={<Send className="w-4 h-4" />} onClick={() => setOpen('missions')} />
        <Tile tone="amber" label="ممتازین انضباطی" value={fa(excellent.length)} hint="مشاهده ممتازین" icon={<Award className="w-4 h-4" />} onClick={() => setOpen('excellence')} />
        <Tile tone="violet" label="آموزش و انضباط" value={fa(classes.length)} hint="مشاهده کلاس‌ها" icon={<GraduationCap className="w-4 h-4" />} onClick={() => setOpen('classes')} />
        <Tile tone="teal" label="آمار مشاهده‌گری" value={fa(sum(m.all14))} hint="۱۴ روز اخیر" spark={m.all14} icon={<BarChart3 className="w-4 h-4" />} onClick={() => setOpen('stats')} />
        <ReferralsHistoryButton
          renderTrigger={({ open: openReferrals, total, unseen }) => (
            <Tile tone="rose" label="ارجاع‌های انضباطی" value={fa(total)} hint="دریافتی از معاون انضباطی" badge={unseen > 0 ? `${fa(unseen)} در انتظار بررسی` : undefined} icon={<Inbox className="w-4 h-4" />} onClick={openReferrals} />
          )}
        />
        <Tile tone="indigo" label="فعالیت مربیان" value={`${fa(m.activeCoaches)} از ${fa(allCoaches.length)}`} hint="مربی فعال در ۳۰ روز" spark={m.coach14} icon={<UserCheck className="w-4 h-4" />} onClick={() => setOpen('coaches')} />
      </div>

      {/* جزئیات هر کاشی */}
      <Modal isOpen={open !== null} onClose={close} title={open ? MODAL_TITLES[open] : ''} size="xl">
        {open === 'latest' && <ObservationHomeWidgets {...widgetProps} show={['latest']} />}
        {open === 'missions' && <MentorMessagesSection glass />}
        {open === 'stats' && <ObservationHomeWidgets {...widgetProps} show={['stats']} />}
        {open === 'excellence' && <DisciplineExcellenceCard onSelectStudent={(s) => { close(); onSelectDisciplineStudent(s); }} />}
        {open === 'classes' && <ClassesEduDisciplineCard classes={classes} onOpen={() => { close(); onOpenClassesView(); }} />}
        {open === 'coaches' && <ObservationHomeWidgets {...widgetProps} show={['coaches']} />}
      </Modal>
    </div>
  );
};
