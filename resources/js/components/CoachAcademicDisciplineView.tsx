import { StudentMonthlyGradesTable } from './StudentMonthlyGradesTable';
import { gradeScoreForMonth } from '../utils/monthlyReport';
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { studentFullName } from '../utils/studentName';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student, StudentAcademicGrade, AcademicSubject, MorningDelayRecord, StudentAttendanceRecord } from '../types';
import { toPersianDigits, getTodayShamsi, formatShamsiDisplay } from '../utils/persianDate';
import { 
  GraduationCap, 
  ShieldAlert, 
  CheckCircle2, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Printer, 
  Eye, 
  Clock, 
  AlertTriangle, 
  BookOpen, 
  Award, 
  ChevronLeft, 
  X, 
  Lock, 
  UserCheck, 
  TrendingUp, 
  Info,
  Layers,
  Sparkles,
  UserX,
  Users,
  CalendarDays,
  BellRing
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FitTable } from './ui/FitTable';

interface AbsenceDay {
  date: string;
  excused: boolean;
  parts: { label: string; daily: boolean; excused: boolean; note?: string }[];
}

interface AbsenceLateItem {
  id: string;
  date: string;
  delayMinutes: number;
  reason: string;
  isExcused: boolean;
  label: string;
}

type DetailKind = 'absence' | 'delay' | 'note';

const AVATAR_GRADIENTS = [
  'from-indigo-600 to-blue-500',
  'from-emerald-600 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-violet-600 to-fuchsia-500',
  'from-sky-600 to-cyan-500',
];
const avatarGradient = (id: string) => AVATAR_GRADIENTS[Array.from(id).reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length];

interface CoachAcademicDisciplineViewProps {
  onOpenClassDetail?: (cls: SchoolClass) => void;
}

export const CoachAcademicDisciplineView: React.FC<CoachAcademicDisciplineViewProps> = () => {
  const { 
    students, 
    classes, 
    nurturingClasses, 
    academicSubjects, 
    academicGrades, 
    sessions, 
    morningDelays, 
    morningAttendance,
    schoolAbsences,
    currentUser 
  } = useSchool();

  const [selectedClassId, setSelectedClassId] = useState<string>(
    nurturingClasses.length > 0 ? nurturingClasses[0].id : 'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'needs_attention' | 'top_academic' | 'discipline_warning' | 'absent' | 'delayed'>('all');
  const [detailModalStudent, setDetailModalStudent] = useState<Student | null>(null);
  const [detail, setDetail] = useState<{ student: Student; kind: DetailKind } | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'grades' | 'discipline' | 'analysis'>('grades');

  const todayInfo = getTodayShamsi();

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDetail(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail]);

  // Helper for student full name
  const getStudentFullName = (s: Student) => {
    if ((s as any).name && typeof (s as any).name === 'string') {
      return (s as any).name;
    }
    return studentFullName(s) || 'دانش‌آموز';
  };

  // Filter students based on coach's accessible classes and search
  const coachAccessibleClassIds = useMemo(() => {
    return nurturingClasses.map(c => c.id);
  }, [nurturingClasses]);

  const targetStudents = useMemo(() => {
    return students.filter(s => {
      // Must be in coach's accessible classes
      if (coachAccessibleClassIds.length > 0 && !coachAccessibleClassIds.includes(s.classId)) {
        return false;
      }
      if (selectedClassId !== 'all' && s.classId !== selectedClassId) {
        return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const studentClass = classes.find(c => c.id === s.classId);
        const sName = getStudentFullName(s);
        const matchesName = sName.toLowerCase().includes(term);
        const matchesClassName = (studentClass?.name || '').toLowerCase().includes(term);
        return matchesName || matchesClassName;
      }
      return true;
    });
  }, [students, coachAccessibleClassIds, selectedClassId, searchTerm, classes]);

  // Helper to compute student academic summary
  const getStudentAcademicData = (studentId: string) => {
    const studentGrades = academicGrades.filter(g => g.studentId === studentId);
    if (studentGrades.length === 0) {
      return {
        grades: [],
        gpaTerm1: null,
        gpaTerm2: null,
        gpaAnnual: null,
        highestGrade: null,
        lowestGrade: null,
        hasFailingGrade: false,
        totalGradedSubjects: 0
      };
    }

    // نمره‌ی هر درس = میانگین نمرات مستمر ماه‌های ثبت‌شده؛ معدل = میانگین دروس
    let highest: { subject: string; score: number } | null = null;
    let lowest: { subject: string; score: number } | null = null;
    let hasFail = false;
    const scores: number[] = [];

    studentGrades.forEach(g => {
      const subject = academicSubjects.find(s => s.id === g.subjectId);
      const subjectName = subject?.name || g.subjectName || 'نامشخص';
      const score = gradeScoreForMonth(g, 'all');
      if (score === undefined) return;
      scores.push(score);
      if (!highest || score > highest.score) highest = { subject: subjectName, score };
      if (!lowest || score < lowest.score) lowest = { subject: subjectName, score };
      if (score < 10) hasFail = true;
    });

    const gpaAnnual = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null;

    return {
      grades: studentGrades,
      gpaTerm1: null,
      gpaTerm2: null,
      gpaAnnual,
      highestGrade: highest,
      lowestGrade: lowest,
      hasFailingGrade: hasFail,
      totalGradedSubjects: studentGrades.length
    };
  };

  // Helper to compute student disciplinary & attendance summary
  const getStudentDisciplineData = (student: Student) => {
    // 1. غیبت‌ها: هر «روز غیبت» یک‌بار شمرده می‌شود (غیبت روزانه/صبحگاه + غیبت زنگ‌های کلاسی)؛ موجه و غیرموجه هر دو
    const dayMap = new Map<string, AbsenceDay>();
    const dayOf = (date: string): AbsenceDay => {
      let d = dayMap.get(date);
      if (!d) {
        d = { date, excused: false, parts: [] };
        dayMap.set(date, d);
      }
      return d;
    };

    (morningAttendance || []).forEach((r) => {
      if (r.studentId === student.id && r.status === 'absent') {
        dayOf(r.date).parts.push({ label: 'غیبت صبحگاه', daily: true, excused: !!r.isExcused, note: r.absenceNote });
      }
    });
    (schoolAbsences || []).forEach((r) => {
      if (r.studentId !== student.id) return;
      const day = dayOf(r.date);
      if (day.parts.some((p) => p.daily)) return; // همان روز قبلاً از حضور صبحگاه ثبت شده
      day.parts.push({ label: 'غیبت روزانه', daily: true, excused: !!r.isExcused, note: r.reason || r.notes });
    });

    const classLates: AbsenceLateItem[] = [];
    sessions.forEach((sess) => {
      if (sess.classId !== student.classId || !sess.records) return;
      let rec: StudentAttendanceRecord | undefined;
      if (Array.isArray(sess.records)) {
        rec = (sess.records as any[]).find((r: any) => r.studentId === student.id);
      } else if (typeof sess.records === 'object') {
        rec = sess.records[student.id];
      }
      if (!rec) return;
      const what = `${sess.subject || 'کلاس'}${sess.periodNumber ? ` • زنگ ${toPersianDigits(sess.periodNumber)}` : ''}`;
      // غیبت‌های کلاسی (زنگ‌ها) در آمار غیبت دانش‌آموز نمی‌آیند؛ فقط تأخیر کلاسی
      if (rec.status === 'late' && (rec.delayMinutes || 0) > 0) {
        classLates.push({
          id: `sess-${sess.id}`,
          date: sess.date,
          delayMinutes: rec.delayMinutes || 0,
          reason: rec.note || '',
          isExcused: false,
          label: `تأخیر کلاسی • ${what}`,
        });
      }
    });

    const absenceDays: AbsenceDay[] = Array.from(dayMap.values())
      .filter((d) => d.parts.length > 0)
      .map((d) => {
        const daily = d.parts.find((p) => p.daily);
        return { ...d, excused: daily ? daily.excused : d.parts.every((p) => p.excused) };
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const excusedAbsences = absenceDays.filter((d) => d.excused).length;
    const unexcusedAbsences = absenceDays.length - excusedAbsences;

    // 2. تأخیرها: دفتر تأخیر + حضور صبحگاه با تأخیر + تأخیر زنگ‌های کلاسی
    const logged = (morningDelays || []).filter((d) => d.studentId === student.id);
    const loggedDates = new Set(logged.map((d) => d.date));
    const delays: AbsenceLateItem[] = [
      ...logged.map((d) => ({
        id: d.id,
        date: d.date,
        delayMinutes: d.delayMinutes || 0,
        reason: d.reason || '',
        isExcused: !!d.isExcused,
        label: 'تأخیر ورود صبحگاه',
      })),
      ...(morningAttendance || [])
        .filter((r) => r.studentId === student.id && r.status === 'present' && (r.delayMinutes || 0) > 0 && !loggedDates.has(r.date))
        .map((r) => ({
          id: `ma-${r.id}`,
          date: r.date,
          delayMinutes: r.delayMinutes || 0,
          reason: r.entryTime ? `ورود ${r.entryTime}` : '',
          isExcused: false,
          label: 'تأخیر ورود صبحگاه',
        })),
      ...classLates,
    ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const totalDelayMinutes = delays.reduce((acc, d) => acc + (d.delayMinutes || 0), 0);

    // 3. Disciplinary score & notes
    const disciplineScore = typeof student.disciplineScore === 'number' ? student.disciplineScore : 20;
    const notes = [...(student.disciplinaryNotes || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const notesCount = notes.length;
    const isWarning = disciplineScore < 18 || unexcusedAbsences >= 3 || delays.length >= 4;

    return {
      disciplineScore,
      status: student.disciplinaryStatus || 'normal',
      unexcusedAbsences,
      excusedAbsences,
      totalAbsences: absenceDays.length,
      absenceDays,
      delays,
      totalDelayMinutes,
      notes,
      notesCount,
      isWarning
    };
  };

  // Filtered students by status category
  const filteredStudents = useMemo(() => {
    return targetStudents.filter(s => {
      const acad = getStudentAcademicData(s.id);
      const disc = getStudentDisciplineData(s);

      if (filterType === 'needs_attention') {
        return disc.isWarning || acad.hasFailingGrade || (acad.gpaAnnual !== null && acad.gpaAnnual < 14);
      }
      if (filterType === 'top_academic') {
        return acad.gpaAnnual !== null && acad.gpaAnnual >= 18;
      }
      if (filterType === 'discipline_warning') {
        return disc.isWarning;
      }
      if (filterType === 'absent') {
        return disc.totalAbsences > 0;
      }
      if (filterType === 'delayed') {
        return disc.delays.length > 0;
      }
      return true;
    });
  }, [targetStudents, filterType]);

  // Aggregate stats for current view
  const aggregateStats = useMemo(() => {
    let totalScoreSum = 0;
    let gpaSum = 0;
    let gpaCount = 0;
    let totalAbs = 0;
    let totalDelaysCount = 0;
    let attentionCount = 0;
    let absentStudents = 0;
    let delayedStudents = 0;

    targetStudents.forEach(s => {
      const acad = getStudentAcademicData(s.id);
      const disc = getStudentDisciplineData(s);

      totalScoreSum += disc.disciplineScore;
      if (acad.gpaAnnual !== null) {
        gpaSum += acad.gpaAnnual;
        gpaCount++;
      }
      totalAbs += disc.totalAbsences;
      totalDelaysCount += disc.delays.length;
      if (disc.totalAbsences > 0) absentStudents++;
      if (disc.delays.length > 0) delayedStudents++;
      if (disc.isWarning || acad.hasFailingGrade || (acad.gpaAnnual !== null && acad.gpaAnnual < 14)) {
        attentionCount++;
      }
    });

    const avgDiscipline = targetStudents.length > 0 ? (totalScoreSum / targetStudents.length).toFixed(2) : '۲۰.۰۰';
    const avgGpa = gpaCount > 0 ? (gpaSum / gpaCount).toFixed(2) : '-';

    return {
      avgDiscipline,
      avgGpa,
      totalAbs,
      totalDelaysCount,
      attentionCount,
      absentStudents,
      delayedStudents,
      totalStudents: targetStudents.length
    };
  }, [targetStudents]);

  // Export to Excel for Coach
  const handleExportExcel = () => {
    const data = filteredStudents.map((s, idx) => {
      const cls = classes.find(c => c.id === s.classId);
      const acad = getStudentAcademicData(s.id);
      const disc = getStudentDisciplineData(s);

      return {
        'ردیف': idx + 1,
        'نام و نام خانوادگی': getStudentFullName(s),
        'کلاس': cls?.name || '-',
        'معدل نوبت اول': acad.gpaTerm1 !== null ? Number(acad.gpaTerm1.toFixed(2)) : 'ثبت نشده',
        'معدل نوبت دوم': acad.gpaTerm2 !== null ? Number(acad.gpaTerm2.toFixed(2)) : 'ثبت نشده',
        'معدل سالانه کل': acad.gpaAnnual !== null ? Number(acad.gpaAnnual.toFixed(2)) : 'ثبت نشده',
        'وضعیت انضباطی': disc.status === 'normal' ? 'عادی' : disc.status === 'verbal_warning' ? 'تذکر شفاهی' : disc.status === 'written_warning' ? 'تذکر کتبی' : 'احضار اولیا',
        'غیبت‌های غیرموجه': disc.unexcusedAbsences,
        'غیبت‌های موجه': disc.excusedAbsences,
        'تعداد تاخیر صبحگاهی': disc.delays.length,
        'مجموع دقایق تاخیر': disc.totalDelayMinutes,
        'تعداد تذکرات انضباطی': disc.notesCount
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'آموزش_و_انضباط_مربی');
    XLSX.writeFile(workbook, `گزارش_آموزش_و_انضباط_کلاس_مربی_${todayInfo.formattedDate.replace(/\//g, '-')}.xlsx`);
  };


  // نوار چسبان موبایل درست زیر هدر چسبان برنامه قرار می‌گیرد
  const [stickyTop, setStickyTop] = useState(0);
  useEffect(() => {
    const measure = () => setStickyTop(document.querySelector<HTMLElement>('.yv-header')?.offsetHeight || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const mobileFilters: { key: typeof filterType; label: string; icon?: React.ComponentType<{ className?: string }>; active: string; idle: string }[] = [
    { key: 'all', label: `همه (${toPersianDigits(targetStudents.length)})`, active: 'bg-indigo-600 text-white border-indigo-600', idle: 'bg-white text-slate-700 border-slate-200' },
    { key: 'needs_attention', label: `نیازمند پیگیری (${toPersianDigits(aggregateStats.attentionCount)})`, icon: AlertTriangle, active: 'bg-rose-600 text-white border-rose-600', idle: 'bg-rose-50 text-rose-800 border-rose-200' },
    { key: 'absent', label: `دارای غیبت (${toPersianDigits(aggregateStats.absentStudents)})`, icon: UserX, active: 'bg-orange-600 text-white border-orange-600', idle: 'bg-orange-50 text-orange-800 border-orange-200' },
    { key: 'delayed', label: `دارای تأخیر (${toPersianDigits(aggregateStats.delayedStudents)})`, icon: Clock, active: 'bg-amber-600 text-white border-amber-600', idle: 'bg-amber-50 text-amber-800 border-amber-200' },
    { key: 'top_academic', label: 'ممتاز (۱۸+)', icon: Award, active: 'bg-emerald-600 text-white border-emerald-600', idle: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  ];

  return (
    <div className="space-y-5 font-['Vazirmatn',sans-serif]">
      
      {/* موبایل: کارت آماری فشرده */}
      <div className="md:hidden bg-slate-900 text-white rounded-2xl p-3 shadow-sm border border-slate-800 space-y-2.5">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-300 shrink-0" />
          <h2 className="flex-1 min-w-0 text-sm font-black truncate">
            {selectedClassId === 'all' ? 'همه کلاس‌های مربی' : `کلاس ${nurturingClasses.find((c) => c.id === selectedClassId)?.name || ''}`}
          </h2>
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-white/10 text-amber-200">
            <Lock className="w-3 h-3" /> فقط مشاهده
          </span>
          <button type="button" onClick={() => window.print()} aria-label="چاپ" title="چاپ" className="w-10 h-10 shrink-0 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
            <Printer className="w-4 h-4 text-sky-300" />
          </button>
          <button type="button" onClick={handleExportExcel} aria-label="خروجی اکسل" title="خروجی اکسل" className="w-10 h-10 shrink-0 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
          </button>
        </div>
        <div className="flex items-baseline justify-between gap-2 px-1">
          <span className="text-[11px] text-slate-300">میانگین معدل کلاس</span>
          <span className="text-2xl font-black text-emerald-300 tabular-nums">
            {aggregateStats.avgGpa !== '-' ? toPersianDigits(aggregateStats.avgGpa) : 'ثبت نشده'}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {([
            [Users, 'دانش‌آموز', aggregateStats.totalStudents, 'text-white'],
            [AlertTriangle, 'پیگیری', aggregateStats.attentionCount, 'text-rose-300'],
            [UserX, 'غیبت', aggregateStats.totalAbs, 'text-orange-300'],
            [Clock, 'تأخیر', aggregateStats.totalDelaysCount, 'text-amber-300'],
          ] as const).map(([Icon, label, value, tone]) => (
            <div key={label} className="bg-white/10 rounded-xl py-2 px-1 text-center">
              <Icon className={`w-3.5 h-3.5 mx-auto ${tone}`} />
              <div className={`text-base font-black tabular-nums leading-tight mt-0.5 ${tone}`}>{toPersianDigits(value)}</div>
              <div className="text-[10px] text-slate-300 leading-tight">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Banner */}
      <div className="hidden md:block bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-4 sm:p-5 shadow-md border border-indigo-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-300" />
              <span>آموزش و انضباط دانش‌آموزان کلاس</span>
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-indigo-200/90">
              <Lock className="w-3 h-3 text-amber-300" />
              فقط مشاهده
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>اکسل</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>چاپ</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-[11px] text-indigo-200 block">دانش‌آموزان</span>
            <span className="text-base font-black mt-0.5 block">{toPersianDigits(aggregateStats.totalStudents)} نفر</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-[11px] text-indigo-200 block">میانگین معدل</span>
            <span className="text-base font-black text-emerald-300 mt-0.5 block">
              {aggregateStats.avgGpa !== '-' ? toPersianDigits(aggregateStats.avgGpa) : 'ثبت نشده'}
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-[11px] text-indigo-200 block">غیبت / تأخیر</span>
            <span className="text-base font-black text-rose-300 mt-0.5 block">
              {toPersianDigits(aggregateStats.totalAbs)} / {toPersianDigits(aggregateStats.totalDelaysCount)}
            </span>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-[11px] text-indigo-200 block">نیازمند پیگیری</span>
            <span className="text-base font-black text-rose-400 mt-0.5 block">
              {toPersianDigits(aggregateStats.attentionCount)} نفر
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Class Selector, Search, Filter Buttons */}
      {/* موبایل: نوار چسبان شیشه‌ای (جستجو + کلاس در یک خط، فیلترها در نوار افقی) */}
      <div
        className="md:hidden sticky z-20 -mx-4 px-4 py-2 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/60 space-y-2"
        style={{ top: stickyTop }}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی دانش‌آموز…"
              aria-label="جستجوی دانش‌آموز"
              className="w-full h-11 bg-white border border-slate-200 rounded-xl pr-9 pl-8 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} aria-label="پاک کردن جستجو" className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 text-slate-400 text-xs cursor-pointer">✕</button>
            )}
          </div>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            aria-label="کلاس"
            className="h-11 max-w-[42%] bg-white border border-slate-200 rounded-xl px-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {nurturingClasses.length > 1 && <option value="all">همه کلاس‌ها</option>}
            {nurturingClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5 text-xs font-bold" role="tablist" aria-label="فیلتر دانش‌آموزان">
          {mobileFilters.map((f) => {
            const Icon = f.icon;
            const active = filterType === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterType(f.key)}
                className={`h-10 px-3 shrink-0 rounded-full border inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition ${active ? f.active : f.idle}`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hidden md:flex bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          
          {/* Class Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 shrink-0">کلاس:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {nurturingClasses.length > 1 && (
                <option value="all">همه کلاس‌های مربی ({toPersianDigits(nurturingClasses.length)} کلاس)</option>
              )}
              {nurturingClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی نام دانش‌آموز..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            همه ({toPersianDigits(targetStudents.length)})
          </button>

          <button
            onClick={() => setFilterType('needs_attention')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
              filterType === 'needs_attention'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>نیازمند پیگیری ({toPersianDigits(aggregateStats.attentionCount)})</span>
          </button>

          <button
            onClick={() => setFilterType('absent')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
              filterType === 'absent'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-orange-50 hover:bg-orange-100 text-orange-800'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>دارای غیبت ({toPersianDigits(aggregateStats.absentStudents)})</span>
          </button>

          <button
            onClick={() => setFilterType('delayed')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
              filterType === 'delayed'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>دارای تأخیر ({toPersianDigits(aggregateStats.delayedStudents)})</span>
          </button>

          <button
            onClick={() => setFilterType('top_academic')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
              filterType === 'top_academic'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>ممتاز (۱۸+)</span>
          </button>
        </div>
      </div>

      {/* Main Students Academic & Discipline Cards / Table */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs text-slate-500 text-xs space-y-2">
          <Info className="w-8 h-8 text-slate-300 mx-auto" />
          <p>دانش‌آموزی با شرایط جستجوی فعلی یافت نشد.</p>
        </div>
      ) : (
        <>
        {/* موبایل: کارت فشرده‌ی دانش‌آموز */}
        <div className="md:hidden space-y-2.5">
          {filteredStudents.map((student, idx) => {
            const studentClass = classes.find((c) => c.id === student.classId);
            const acad = getStudentAcademicData(student.id);
            const disc = getStudentDisciplineData(student);
            const gpa = acad.gpaAnnual;
            const gpaCls = gpa === null ? '' : gpa >= 18 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : gpa >= 12 ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-rose-50 text-rose-800 border-rose-200';
            const chip = 'inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border text-[11px] font-extrabold whitespace-nowrap';
            return (
              <article key={student.id} className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 text-center text-[11px] font-bold text-slate-400 shrink-0">{toPersianDigits(idx + 1)}</span>
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${avatarGradient(student.id)} text-white flex items-center justify-center font-black text-xs shrink-0 ring-2 ring-white`}>
                    {getStudentFullName(student).charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-sm truncate">{getStudentFullName(student)}</div>
                    {selectedClassId === 'all' && <div className="text-[10px] text-slate-400 truncate">{studentClass?.name || '-'}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setDetailModalStudent(student); setModalActiveTab('grades'); }}
                    aria-label={`پرونده ${getStudentFullName(student)}`}
                    className="h-10 px-3 shrink-0 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-indigo-600" />
                    پرونده
                  </button>
                </div>
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                  {gpa !== null && <span className={`${chip} ${gpaCls}`}>معدل {toPersianDigits(gpa.toFixed(2))}</span>}
                  {disc.totalAbsences > 0 && (
                    <button type="button" onClick={() => setDetail({ student, kind: 'absence' })} className={`${chip} bg-rose-50 text-rose-700 border-rose-200 cursor-pointer`}>
                      <UserX className="w-3 h-3" />
                      غیبت {toPersianDigits(disc.totalAbsences)} روز{disc.excusedAbsences > 0 ? ` (${toPersianDigits(disc.excusedAbsences)} موجه)` : ''}
                    </button>
                  )}
                  {disc.delays.length > 0 && (
                    <button type="button" onClick={() => setDetail({ student, kind: 'delay' })} className={`${chip} bg-amber-50 text-amber-800 border-amber-200 cursor-pointer`}>
                      <Clock className="w-3 h-3" />
                      تأخیر {toPersianDigits(disc.delays.length)} بار · {toPersianDigits(disc.totalDelayMinutes)} د
                    </button>
                  )}
                  {disc.notesCount > 0 && (
                    <button type="button" onClick={() => setDetail({ student, kind: 'note' })} className={`${chip} bg-violet-50 text-violet-800 border-violet-200 cursor-pointer`}>
                      <BellRing className="w-3 h-3" />
                      تذکر {toPersianDigits(disc.notesCount)}
                    </button>
                  )}
                  {gpa === null && disc.totalAbsences === 0 && disc.delays.length === 0 && disc.notesCount === 0 && (
                    <span className="text-[11px] text-slate-400">بدون مورد ثبت‌شده</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="hidden md:block">
        <FitTable className="bg-white rounded-2xl border border-slate-200 shadow-xs">
          <table className="w-full table-fixed text-right text-xs">
            <thead className="bg-gradient-to-l from-indigo-50 via-slate-50 to-sky-50 text-slate-700 border-b border-slate-200 font-extrabold">
              <tr>
                <th className="py-3 px-2 text-center w-10 hidden sm:table-cell">#</th>
                <th className="py-3 px-3">دانش‌آموز</th>
                {selectedClassId === 'all' && <th className="py-3 px-2 text-center w-24 hidden md:table-cell">کلاس</th>}
                <th className="py-3 px-2 text-center w-16 sm:w-20">معدل</th>
                <th className="py-3 px-2 text-center w-20 sm:w-24">غیبت</th>
                <th className="py-3 px-2 text-center w-20 sm:w-24">تأخیر</th>
                <th className="py-3 px-2 text-center w-16 sm:w-20 hidden sm:table-cell">تذکر</th>
                <th className="py-3 px-2 text-center w-12 sm:w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student, idx) => {
                const studentClass = classes.find(c => c.id === student.classId);
                const acad = getStudentAcademicData(student.id);
                const disc = getStudentDisciplineData(student);

                const hasProblem = disc.isWarning || acad.hasFailingGrade;
                const hasEvent = disc.totalAbsences > 0 || disc.delays.length > 0 || disc.notesCount > 0;
                const rowTone = hasProblem
                  ? 'bg-rose-50/70 hover:bg-rose-100/60 shadow-[inset_-4px_0_0_0_#f43f5e]'
                  : hasEvent
                  ? 'bg-amber-50/60 hover:bg-amber-100/50 shadow-[inset_-4px_0_0_0_#f59e0b]'
                  : acad.gpaAnnual !== null && acad.gpaAnnual >= 18
                  ? 'bg-emerald-50/70 hover:bg-emerald-100/60 shadow-[inset_-4px_0_0_0_#10b981]'
                  : idx % 2 === 0
                  ? 'bg-sky-50/40 hover:bg-sky-50 shadow-[inset_-4px_0_0_0_#7dd3fc]'
                  : 'bg-white hover:bg-indigo-50/40 shadow-[inset_-4px_0_0_0_#c7d2fe]';

                return (
                  <tr key={student.id} className={`${rowTone} transition`}>
                    <td className="py-2.5 px-2 text-center text-slate-400 hidden sm:table-cell">
                      {toPersianDigits(idx + 1)}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${avatarGradient(student.id)} text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm ring-2 ring-white`}>
                          {getStudentFullName(student).charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">{getStudentFullName(student)}</span>
                          {selectedClassId === 'all' && <span className="text-[10px] text-slate-400 md:hidden">{studentClass?.name || '-'}</span>}
                        </div>
                      </div>
                    </td>

                    {selectedClassId === 'all' && (
                      <td className="py-2.5 px-2 text-center hidden md:table-cell">
                        <span className="bg-slate-100 px-2 py-1 rounded-lg text-[11px] text-slate-700 font-medium">
                          {studentClass?.name || '-'}
                        </span>
                      </td>
                    )}

                    <td className="py-2.5 px-2 text-center">
                      {acad.gpaAnnual !== null ? (
                        <span className={`inline-block font-extrabold text-xs px-2 py-1 rounded-lg border ${
                          acad.gpaAnnual >= 18 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          acad.gpaAnnual >= 15 ? 'bg-blue-50 text-blue-800 border-blue-200' :
                          acad.gpaAnnual >= 12 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {toPersianDigits(acad.gpaAnnual.toFixed(2))}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-2 px-2 text-center">
                      {disc.totalAbsences > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetail({ student, kind: 'absence' })}
                          title="مشاهده ریز غیبت‌ها"
                          className="group inline-flex flex-col items-center gap-0.5 cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-1 text-rose-700 font-extrabold text-[11px] bg-rose-100 group-hover:bg-rose-200 border border-rose-200 px-2.5 py-1 rounded-lg transition">
                            <UserX className="w-3 h-3" />
                            {toPersianDigits(disc.totalAbsences)} روز
                          </span>
                          {disc.excusedAbsences > 0 && (
                            <span className="text-[10px] font-bold text-emerald-700">
                              {toPersianDigits(disc.excusedAbsences)} موجه
                            </span>
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-2 px-2 text-center">
                      {disc.delays.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetail({ student, kind: 'delay' })}
                          title="مشاهده ریز تأخیرها"
                          className="group inline-flex flex-col items-center gap-0.5 cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-1 text-amber-800 font-extrabold text-[11px] bg-amber-100 group-hover:bg-amber-200 border border-amber-200 px-2.5 py-1 rounded-lg transition">
                            <Clock className="w-3 h-3" />
                            {toPersianDigits(disc.delays.length)} بار
                          </span>
                          <span className="text-[10px] font-bold text-amber-700">
                            مجموع {toPersianDigits(disc.totalDelayMinutes)} دقیقه
                          </span>
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-2 px-2 text-center hidden sm:table-cell">
                      {disc.notesCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setDetail({ student, kind: 'note' })}
                          title="مشاهده ریز تذکرها"
                          className="inline-flex items-center gap-1 text-violet-800 font-extrabold text-[11px] bg-violet-100 hover:bg-violet-200 border border-violet-200 px-2.5 py-1 rounded-lg cursor-pointer transition"
                        >
                          <BellRing className="w-3 h-3" />
                          {toPersianDigits(disc.notesCount)}
                        </button>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <button
                        onClick={() => {
                          setDetailModalStudent(student);
                          setModalActiveTab('grades');
                        }}
                        title="مشاهده ریز پرونده"
                        aria-label="مشاهده ریز پرونده"
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="hidden sm:inline">پرونده</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </FitTable>
        </div>
        </>
      )}

      {/* ریز اطلاعات هر ستون (غیبت / تأخیر / تذکر) در کادر وسط صفحه */}
      {detail && (() => {
        const d = getStudentDisciplineData(detail.student);
        const theme = {
          absence: { title: 'ریز غیبت‌ها', bar: 'from-rose-600 to-orange-400', icon: UserX, chip: 'bg-rose-50 text-rose-700 border-rose-200' },
          delay: { title: 'ریز تأخیرها', bar: 'from-amber-500 to-yellow-400', icon: Clock, chip: 'bg-amber-50 text-amber-800 border-amber-200' },
          note: { title: 'ریز تذکرها و اخطارها', bar: 'from-violet-600 to-fuchsia-400', icon: BellRing, chip: 'bg-violet-50 text-violet-800 border-violet-200' },
        }[detail.kind];
        const Icon = theme.icon;
        const empty = <div className="py-8 text-center text-xs text-slate-400">موردی ثبت نشده است.</div>;
        return createPortal(
          <div
            className="fixed inset-0 z-[200] h-[100dvh] w-screen bg-slate-900/55 backdrop-blur-[4px] flex items-center justify-center p-4 animate-in fade-in duration-200"
            dir="rtl"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.target === e.currentTarget && setDetail(null)}
          >
            <div className="relative w-full max-w-md max-h-[86dvh] flex flex-col bg-white rounded-[26px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className={`h-2 shrink-0 bg-gradient-to-l ${theme.bar}`} />
              <div className="px-5 pt-4 pb-3 flex items-center gap-3 shrink-0">
                <span className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${theme.chip}`}>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-slate-900">{theme.title}</div>
                  <div className="text-xs text-slate-500 truncate">{getStudentFullName(detail.student)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  aria-label="بستن"
                  className="w-9 h-9 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 pb-2 flex items-center gap-2 flex-wrap shrink-0 text-[11px] font-bold">
                {detail.kind === 'absence' && (
                  <>
                    <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">{toPersianDigits(d.totalAbsences)} روز غیبت</span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{toPersianDigits(d.excusedAbsences)} موجه</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{toPersianDigits(d.unexcusedAbsences)} غیرموجه</span>
                  </>
                )}
                {detail.kind === 'delay' && (
                  <>
                    <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">{toPersianDigits(d.delays.length)} بار تأخیر</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">مجموع {toPersianDigits(d.totalDelayMinutes)} دقیقه</span>
                  </>
                )}
                {detail.kind === 'note' && (
                  <>
                    <span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-800 border border-violet-200">{toPersianDigits(d.notesCount)} مورد</span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      نمره انضباط {toPersianDigits(d.disciplineScore)} از ۲۰
                    </span>
                  </>
                )}
              </div>

              <div className="px-5 pb-4 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-2">
                {detail.kind === 'absence' &&
                  (d.absenceDays.length === 0 ? empty : d.absenceDays.map((day) => (
                    <div key={day.date} className={`rounded-2xl border p-3 ${day.excused ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800 font-mono">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                          {toPersianDigits(day.date)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${day.excused ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {day.excused ? 'موجه' : 'غیرموجه'}
                        </span>
                      </div>
                      <ul className="mt-1.5 space-y-0.5">
                        {day.parts.map((p, i) => (
                          <li key={i} className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-700">{p.label}</span>
                            {p.excused && !day.excused && <span className="text-emerald-700">(موجه)</span>}
                            {p.note && <span className="text-slate-500">— {p.note}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )))}

                {detail.kind === 'delay' &&
                  (d.delays.length === 0 ? empty : d.delays.map((x) => (
                    <div key={x.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800 font-mono">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                          {toPersianDigits(x.date)}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                          {toPersianDigits(x.delayMinutes)} دقیقه
                        </span>
                      </div>
                      <div className="mt-1.5 text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-700">{x.label}</span>
                        <span className={x.isExcused ? 'text-emerald-700' : 'text-rose-700'}>({x.isExcused ? 'موجه' : 'غیرموجه'})</span>
                        {x.reason && <span className="text-slate-500">— {x.reason}</span>}
                      </div>
                    </div>
                  )))}

                {detail.kind === 'note' &&
                  (d.notes.length === 0 ? empty : d.notes.map((n) => (
                    <div key={n.id} className="rounded-2xl border border-violet-200 bg-violet-50/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-800">{n.title}</span>
                        <span className="text-[10px] font-extrabold font-mono text-rose-600">
                          {n.scoreDeduction ? `-${toPersianDigits(n.scoreDeduction)} نمره` : 'بدون کسر نمره'}
                        </span>
                      </div>
                      {n.description && <p className="mt-1 text-[11px] leading-6 text-slate-600">{n.description}</p>}
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{n.recordedBy || 'معاونت انضباطی'}</span>
                        <span className="font-mono">{toPersianDigits(n.date)}</span>
                      </div>
                    </div>
                  )))}
              </div>

              <div className="px-5 pb-5 pt-2 shrink-0 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDetailModalStudent(detail.student);
                    setModalActiveTab('discipline');
                    setDetail(null);
                  }}
                  className="flex-1 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                >
                  <Eye className="w-4 h-4" />
                  <span>مشاهده پرونده کامل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="h-11 px-5 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Read-Only Modal: Full Academic & Disciplinary Detail (باتم‌شیت در موبایل) */}
      {detailModalStudent && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailModalStudent(null); }}
        >
          <div className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden font-['Vazirmatn',sans-serif] max-h-[92vh] flex flex-col" dir="rtl">
            <div className="sm:hidden pt-2 flex justify-center bg-slate-900 shrink-0"><span className="w-10 h-1 rounded-full bg-white/30" /></div>

            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-4 py-3.5 sm:p-5 flex items-center gap-3 shrink-0">
              <div className="w-11 h-11 shrink-0 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-sm text-emerald-200">
                {getStudentFullName(detailModalStudent).charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold truncate">{getStudentFullName(detailModalStudent)}</h3>
                  <span className="inline-flex items-center gap-1 bg-white/10 text-amber-200 text-[10px] px-2 py-0.5 rounded-full border border-white/10 font-bold whitespace-nowrap">
                    <Lock className="w-3 h-3" /> فقط مشاهده
                  </span>
                </div>
                <span className="text-xs text-slate-300 tabular-nums whitespace-nowrap">
                  تماس ولی: {toPersianDigits(detailModalStudent.parentPhone || '---')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalStudent(null)}
                aria-label="بستن"
                className="w-11 h-11 shrink-0 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Tabs: یک ردیف افقی، بدون شکستن کلمات */}
            <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-100 p-2 border-b border-slate-200 text-xs font-bold shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
              {([
                ['grades', 'کارنامه و ریز نمرات', GraduationCap, 'text-indigo-900', 'text-indigo-600'],
                ['discipline', 'انضباطی، تأخیر و غیبت', ShieldAlert, 'text-rose-900', 'text-rose-600'],
                ['analysis', 'تحلیل و راهبرد تربیتی', Sparkles, 'text-emerald-900', 'text-emerald-600'],
              ] as const).map(([id, label, Icon, activeText, iconTone]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={modalActiveTab === id}
                  onClick={() => setModalActiveTab(id)}
                  className={`shrink-0 h-11 px-3.5 rounded-xl whitespace-nowrap transition cursor-pointer inline-flex items-center gap-1.5 ${
                    modalActiveTab === id ? `bg-white ${activeText} shadow-xs` : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${iconTone}`} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Modal Body Content */}
            <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto space-y-4 text-xs">
              
              {/* TAB 1: ACADEMIC GRADES (READ-ONLY) */}
              {modalActiveTab === 'grades' && (
                <StudentMonthlyGradesTable grades={academicGrades.filter((g) => g.studentId === detailModalStudent.id)} />
              )}

              {/* TAB 2: DISCIPLINE, DELAYS & ABSENCES (READ-ONLY) */}
              {modalActiveTab === 'discipline' && (
                <div className="space-y-4">
                  {(() => {
                    const disc = getStudentDisciplineData(detailModalStudent);

                    return (
                      <div className="space-y-4">
                        {/* Status Summary Banner */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                            <span className="text-slate-500 text-[11px] block">نمره انضباط فعلی:</span>
                            <span className="text-xl font-black font-mono text-slate-800 mt-1 block">
                              {toPersianDigits(disc.disciplineScore)} از ۲۰
                            </span>
                          </div>

                          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center">
                            <span className="text-rose-600 text-[11px] block">غیبت‌ها (روزانه و کلاسی):</span>
                            <span className="text-xl font-black font-mono text-rose-800 mt-1 block">
                              {toPersianDigits(disc.totalAbsences)} روز
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 block mt-0.5">
                              {toPersianDigits(disc.excusedAbsences)} موجه • {toPersianDigits(disc.unexcusedAbsences)} غیرموجه
                            </span>
                          </div>

                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                            <span className="text-amber-700 text-[11px] block">تاخیرهای صبحگاهی ورود:</span>
                            <span className="text-xl font-black font-mono text-amber-900 mt-1 block">
                              {toPersianDigits(disc.delays.length)} بار ({toPersianDigits(disc.totalDelayMinutes)} دقیقه)
                            </span>
                          </div>
                        </div>

                        {/* List of Absences (موجه و غیرموجه) */}
                        <div className="space-y-2">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <UserX className="w-4 h-4 text-rose-600" />
                            <span>جزئیات غیبت‌ها:</span>
                          </h4>
                          {disc.absenceDays.length === 0 ? (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center text-xs">
                              بدون غیبت ثبت‌شده.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {disc.absenceDays.map((day) => (
                                <div
                                  key={day.date}
                                  className={`rounded-xl border p-2.5 text-xs ${day.excused ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-bold text-slate-800">{toPersianDigits(day.date)}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${day.excused ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                      {day.excused ? 'غیبت موجه' : 'غیرموجه'}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-[11px] text-slate-600 space-y-0.5">
                                    {day.parts.map((p, i) => (
                                      <div key={i}>
                                        <span className="font-bold text-slate-700">{p.label}</span>
                                        {p.note ? <span className="text-slate-500"> — {p.note}</span> : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* List of Disciplinary Notes */}
                        <div className="space-y-2">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                            <span>سوابق تذکرات و کسر نمره انضباطی ثبت شده:</span>
                          </h4>

                          {disc.notes.length === 0 ? (
                            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-center text-xs">
                              هیچ مورد انضباطی منفی یا کسر نمره‌ای برای این دانش‌آموز ثبت نشده است (انضباط عالی).
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {disc.notes.map((note) => (
                                <div key={note.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-800">{note.title}</span>
                                    {note.source === 'auto_delay' && (
                              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">کسر خودکار</span>
                            )}
                                    {note.source === 'class_warning' && (
                              <span className="bg-violet-50 text-violet-800 border border-violet-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">اخطار کلاسی{note.subject ? ` • ${note.subject}` : ''}</span>
                            )}
                                    <span className="text-rose-600 font-mono font-bold text-[11px]">
                                      {note.scoreDeduction ? `-${toPersianDigits(note.scoreDeduction)} نمره` : 'بدون کسر نمره'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600">{note.description}</p>
                                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200">
                                    <span>ثبت‌کننده: {note.recordedBy || 'معاونت انضباطی'}</span>
                                    <span className="font-mono">{note.date}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* List of Morning Delays */}
                        <div className="space-y-2">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-amber-600" />
                            <span>جزئیات تاخیرهای صبحگاهی ورود به مجتمع:</span>
                          </h4>

                          {disc.delays.length === 0 ? (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center text-xs">
                              بدون تاخیر صبحگاهی.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {disc.delays.map(d => (
                                <div key={d.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-2.5 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      d.isExcused ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {d.isExcused ? 'موجه' : 'غیرموجه'}
                                    </span>
                                    <span className="text-slate-800 font-medium">{d.reason || 'علت نامشخص'}</span>
                                  </div>
                                  <div className="flex items-center gap-3 font-mono text-slate-500 text-[11px]">
                                    <span>{toPersianDigits(d.delayMinutes)} دقیقه</span>
                                    <span>{d.date}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 3: COACH EDUCATIONAL-DISCIPLINARY ANALYSIS */}
              {modalActiveTab === 'analysis' && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                    <h4 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>توصیه و راهبرد مربی جهت ارتقاء همه‌جانبه دانش‌آموز:</span>
                    </h4>
                    <p className="text-xs text-emerald-800 leading-relaxed text-justify">
                      مربی می‌تواند از داده‌های آموزشی و انضباطی بالا در مصاحبه‌های فردی، تنظیم برنامه هفتگی و گفتگو با خانواده استفاده کند تا نقاط ضعف تحصیلی با تقویت انگیزه و نظم فردی برطرف شوند.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-slate-700">
                    <h5 className="font-bold text-xs text-slate-900">چک‌لیست پیگیری مربی:</h5>
                    <ul className="space-y-1.5 text-xs list-disc list-inside text-slate-600">
                      <li>بررسی علت دروس با نمره کمتر از ۱۴ در جلسات فردی</li>
                      <li>پیگیری دلایل ریشه‌ای تاخیرهای صبحگاهی با اولیا</li>
                      <li>تقویت اعتمادبه‌نفس در دروس دارای پیشرفت مثبت</li>
                      <li>هماهنگی با معاونت آموزشی جهت کلاس‌های تقویتی یا مشاوره</li>
                    </ul>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              <button
                onClick={() => setDetailModalStudent(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
