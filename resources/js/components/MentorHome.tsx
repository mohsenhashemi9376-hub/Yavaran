import React, { useMemo } from 'react';
import { Calendar, ClipboardList, Eye, GraduationCap, Menu, Plus, Rows3, UserX } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student, StudentObservation } from '../types';
import { homeworkOutcome } from '../utils/classroomActivity';
import { getRealTodayShamsiString, tehranNow, toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { MentorMessagesSection } from './MentorMessages';
import { Tile } from './NurturingViceHome';
import { daysAgo } from './ObservationInsights';

const fa = toPersianDigits;
const RECENT_DAYS = 30;

export interface MentorHomeProps {
  greeting: string;
  roleLabel: string;
  dayOfWeek: string;
  displayDate: string;
  students: Student[];
  classes: SchoolClass[];
  observations: StudentObservation[];
  onOpenSidebar: () => void;
  onNewObservation: () => void;
  onOpenTimeline: () => void;
  onOpenHomework: () => void;
  onOpenAcademicDiscipline: () => void;
  onOpenGreyList: () => void;
}

/** پیشخوان مربی: هدر ساده + کاشی‌های شیشه‌ای رنگی (هم‌سبک پنل معاون تربیتی و معاون آموزشی) */
export const MentorHome: React.FC<MentorHomeProps> = ({
  greeting, roleLabel, dayOfWeek, displayDate, students, classes, observations,
  onOpenSidebar, onNewObservation, onOpenTimeline, onOpenHomework, onOpenAcademicDiscipline, onOpenGreyList,
}) => {
  const { sessions, greyList } = useSchool();

  const m = useMemo(() => {
    const now = tehranNow().getTime();
    const studentIds = new Set(students.map((s) => s.id));
    const classIds = new Set(classes.map((c) => c.id));
    const obs = observations.filter((o) => studentIds.has(o.studentId));
    const notDone = new Set<string>();
    (sessions || []).forEach((sess) => {
      if (!classIds.has(sess.classId) || daysAgo(sess.date, now) >= RECENT_DAYS) return;
      Object.entries(sess.records || {}).forEach(([sid, rec]) => {
        if (studentIds.has(sid) && homeworkOutcome(rec) === 'not_done') notDone.add(sid);
      });
    });
    const month = toEnglishDigits(getRealTodayShamsiString()).split('/').slice(0, 2).join('/');
    return {
      total: obs.length,
      week: obs.filter((o) => daysAgo(o.date, now) < 7).length,
      homework: notDone.size,
      grey: (greyList || []).filter((g) => studentIds.has(g.studentId) && toEnglishDigits(g.month || '') === month).length,
    };
  }, [students, classes, observations, sessions, greyList]);

  return (
    <div className="space-y-4 animate-in fade-in" id="mentor-home">
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
              <span className="text-slate-300">·</span>
              <span>{fa(students.length)} دانش‌آموز تحت پوشش</span>
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

      {/* پیام‌ها و مأموریت‌های معاون (فقط در صورت وجود) */}
      <MentorMessagesSection glass />

      {/* کاشی‌ها */}
      <div data-stagger className="grid grid-cols-2 lg:grid-cols-3 gap-3 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <Tile tone="emerald" label="ثبت مشاهده‌گری" value={fa(m.total)} hint="ثبت مشاهده جدید" icon={<Plus className="w-4 h-4" />} onClick={onNewObservation} />
        <Tile tone="sky" label="خط زمانی" value={fa(m.week)} hint="مشاهدات ۷ روز اخیر" icon={<Rows3 className="w-4 h-4" />} onClick={onOpenTimeline} />
        <Tile tone="amber" label="پیگیری تکالیف" value={fa(m.homework)} hint="انجام‌نشده در ۳۰ روز" icon={<ClipboardList className="w-4 h-4" />} onClick={onOpenHomework} />
        <Tile tone="violet" label="آموزش و انضباط" value={fa(classes.length)} hint="مشاهده کلاس‌ها" icon={<GraduationCap className="w-4 h-4" />} onClick={onOpenAcademicDiscipline} />
        <Tile tone="slate" label="لیست خاکستری" value={fa(m.grey)} hint="این ماه" icon={<UserX className="w-4 h-4" />} onClick={onOpenGreyList} />
      </div>
    </div>
  );
};
