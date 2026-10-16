import React, { useMemo } from 'react';
import { Calendar, ChevronLeft, GraduationCap, Menu, Plus } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student, StudentObservation } from '../types';
import { toPersianDigits, tehranNow } from '../utils/persianDate';
import { MentorMessagesSection } from './MentorMessages';
import { ObservationHomeWidgets } from './ObservationHomeWidgets';
import { DisciplineExcellenceCard } from './DisciplineExcellence';
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

export interface NurturingViceHomeProps {
  greeting: string;
  roleLabel: string;
  dayOfWeek: string;
  displayDate: string;
  students: Student[];
  classes: SchoolClass[];
  observations: StudentObservation[];
  onOpenSidebar: () => void;
  onNewObservation: () => void;
  onOpenObservations: () => void;
  onOpenClassesView: () => void;
  onOpenStudent: (student: Student) => void;
  onSelectDisciplineStudent: (student: Student) => void;
}

/** پیشخوان معاون تربیتی: هدر ساده + کادرهای شیشه‌ای رنگی (هم‌سبک پنل معاون آموزشی) */
export const NurturingViceHome: React.FC<NurturingViceHomeProps> = ({
  greeting, roleLabel, dayOfWeek, displayDate, students, classes, observations,
  onOpenSidebar, onNewObservation, onOpenObservations, onOpenClassesView, onOpenStudent, onSelectDisciplineStudent,
}) => (
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
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          type="button"
          onClick={onNewObservation}
          className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت مشاهده جدید</span>
        </button>
        <ReferralsHistoryButton label="ارجاع‌های دریافتی از معاون انضباطی" />
      </div>
    </div>

    {/* ۱. آخرین مشاهدات */}
    <ObservationHomeWidgets
      glass show={['latest']}
      students={students} classes={classes} observations={observations} isVice
      onOpenAll={onOpenObservations} onOpenStudent={onOpenStudent}
    />

    {/* ۲. مأموریت‌ها و پیام‌ها */}
    <MentorMessagesSection glass />

    {/* ۳. آمار مشاهده‌گری همه کلاس‌ها */}
    <ObservationHomeWidgets
      glass show={['stats']}
      students={students} classes={classes} observations={observations} isVice
      onOpenAll={onOpenObservations} onOpenStudent={onOpenStudent}
    />

    {/* ۴. ممتازین انضباطی */}
    <DisciplineExcellenceCard onSelectStudent={onSelectDisciplineStudent} />

    {/* ۵. آموزش و انضباط کلاس‌ها */}
    <ClassesEduDisciplineCard classes={classes} onOpen={onOpenClassesView} />

    {/* ۶. آخرین آمار فعالیت مربیان */}
    <ObservationHomeWidgets
      glass show={['coaches']}
      students={students} classes={classes} observations={observations} isVice
      onOpenAll={onOpenObservations} onOpenStudent={onOpenStudent}
    />
  </div>
);
