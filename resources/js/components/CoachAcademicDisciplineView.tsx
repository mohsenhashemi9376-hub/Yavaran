import React, { useState, useMemo } from 'react';
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
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

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
    currentUser 
  } = useSchool();

  const [selectedClassId, setSelectedClassId] = useState<string>(
    nurturingClasses.length > 0 ? nurturingClasses[0].id : 'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'needs_attention' | 'top_academic' | 'discipline_warning'>('all');
  const [detailModalStudent, setDetailModalStudent] = useState<Student | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'grades' | 'discipline' | 'analysis'>('grades');

  const todayInfo = getTodayShamsi();

  // Helper for student full name
  const getStudentFullName = (s: Student) => {
    if ((s as any).name && typeof (s as any).name === 'string') {
      return (s as any).name;
    }
    return `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'دانش‌آموز';
  };

  // Helper for student national code
  const getStudentNationalCode = (s: Student) => {
    return (s as any).nationalCode || s.nationalId || '---';
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
        const sNational = getStudentNationalCode(s);
        const matchesName = sName.toLowerCase().includes(term);
        const matchesNationalCode = sNational.includes(term);
        const matchesClassName = (studentClass?.name || '').toLowerCase().includes(term);
        return matchesName || matchesNationalCode || matchesClassName;
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

    let sumT1 = 0, countT1 = 0;
    let sumT2 = 0, countT2 = 0;
    let highest: { subject: string; score: number } | null = null;
    let lowest: { subject: string; score: number } | null = null;
    let hasFail = false;

    studentGrades.forEach(g => {
      const subject = academicSubjects.find(s => s.id === g.subjectId);
      const subjectName = subject?.name || 'نامشخص';

      // Check Term 1 final
      if (typeof g.finalScoreTerm1 === 'number') {
        sumT1 += g.finalScoreTerm1;
        countT1++;
        if (!highest || g.finalScoreTerm1 > highest.score) highest = { subject: subjectName, score: g.finalScoreTerm1 };
        if (!lowest || g.finalScoreTerm1 < lowest.score) lowest = { subject: subjectName, score: g.finalScoreTerm1 };
        if (g.finalScoreTerm1 < 10) hasFail = true;
      }

      // Check Term 2 final
      if (typeof g.finalScoreTerm2 === 'number') {
        sumT2 += g.finalScoreTerm2;
        countT2++;
        if (!highest || g.finalScoreTerm2 > highest.score) highest = { subject: subjectName, score: g.finalScoreTerm2 };
        if (!lowest || g.finalScoreTerm2 < lowest.score) lowest = { subject: subjectName, score: g.finalScoreTerm2 };
        if (g.finalScoreTerm2 < 10) hasFail = true;
      }
    });

    const gpaT1 = countT1 > 0 ? sumT1 / countT1 : null;
    const gpaT2 = countT2 > 0 ? sumT2 / countT2 : null;
    const gpaAnnual = (gpaT1 !== null && gpaT2 !== null) ? (gpaT1 + gpaT2) / 2 : (gpaT2 !== null ? gpaT2 : gpaT1);

    return {
      grades: studentGrades,
      gpaTerm1: gpaT1,
      gpaTerm2: gpaT2,
      gpaAnnual: gpaAnnual,
      highestGrade: highest,
      lowestGrade: lowest,
      hasFailingGrade: hasFail,
      totalGradedSubjects: studentGrades.length
    };
  };

  // Helper to compute student disciplinary & attendance summary
  const getStudentDisciplineData = (student: Student) => {
    // 1. Session absences
    let unexcusedAbsences = 0;
    let excusedAbsences = 0;

    sessions.forEach(sess => {
      if (sess.classId === student.classId && sess.records) {
        let rec: StudentAttendanceRecord | undefined;
        if (Array.isArray(sess.records)) {
          rec = (sess.records as any[]).find((r: any) => r.studentId === student.id);
        } else if (typeof sess.records === 'object') {
          rec = sess.records[student.id];
        }

        if (rec) {
          if (rec.status === 'absent') unexcusedAbsences++;
          else if (rec.status === 'excused') excusedAbsences++;
        }
      }
    });

    // 2. Morning delays
    const delays = (morningDelays || []).filter(d => d.studentId === student.id);
    const totalDelayMinutes = delays.reduce((acc, d) => acc + (d.delayMinutes || 0), 0);

    // 3. Disciplinary score & notes
    const disciplineScore = typeof student.disciplineScore === 'number' ? student.disciplineScore : 20;
    const notesCount = (student.disciplinaryNotes || []).length;
    const isWarning = disciplineScore < 18 || unexcusedAbsences >= 3 || delays.length >= 4;

    return {
      disciplineScore,
      status: student.disciplinaryStatus || 'normal',
      unexcusedAbsences,
      excusedAbsences,
      totalAbsences: unexcusedAbsences + excusedAbsences,
      delays,
      totalDelayMinutes,
      notes: student.disciplinaryNotes || [],
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
        'نمره انضباط (از ۲۰)': disc.disciplineScore,
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

  return (
    <div className="space-y-5 font-['Vazirmatn',sans-serif]">
      
      {/* Top Banner: Read-Only Guard & Explanation */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-indigo-900/40 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full text-xs font-semibold text-indigo-200">
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>مشاهده اختصاصی مربی • حالت فقط‌خواندنی (Read-Only)</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-300" />
              <span>کارنمای جامع آموزش و انضباط دانش‌آموزان کلاس</span>
            </h2>
            <p className="text-xs text-indigo-100/80 leading-relaxed max-w-3xl text-justify">
              در این کادر، مربی محترم می‌تواند کلیه اطلاعات تحصیلی، نمرات امتحانات، غیبت‌ها، تاخیرهای ورود به مدرسه و وضعیت انضباطی دانش‌آموزان کلاس خود را به منظور پایش جامع و راهبری تربیتی مشاهده کند.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>خروجی اکسل مربی</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>چاپ گزارش</span>
            </button>
          </div>
        </div>

        {/* Aggregated Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-[11px] text-indigo-200 block">دانش‌آموزان تحت پوشش:</span>
            <span className="text-base font-black font-mono mt-0.5 block">{toPersianDigits(aggregateStats.totalStudents)} نفر</span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-[11px] text-indigo-200 block">میانگین معدل تحصیلی:</span>
            <span className="text-base font-black font-mono text-emerald-300 mt-0.5 block">
              {aggregateStats.avgGpa !== '-' ? `${toPersianDigits(aggregateStats.avgGpa)} از ۲۰` : 'ثبت نشده'}
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-[11px] text-indigo-200 block">میانگین نمره انضباط:</span>
            <span className="text-base font-black font-mono text-amber-300 mt-0.5 block">
              {toPersianDigits(aggregateStats.avgDiscipline)} از ۲۰
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-[11px] text-indigo-200 block">مجموع غیبت و تاخیرها:</span>
            <span className="text-base font-black font-mono text-rose-300 mt-0.5 block">
              {toPersianDigits(aggregateStats.totalAbs)} غیبت / {toPersianDigits(aggregateStats.totalDelaysCount)} تاخیر
            </span>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-indigo-200 block">نیازمند پیگیری و توجه:</span>
            <span className="text-base font-black font-mono text-rose-400 mt-0.5 block">
              {toPersianDigits(aggregateStats.attentionCount)} دانش‌آموز
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Class Selector, Search, Filter Buttons */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
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
              placeholder="جستجوی نام یا کدملی دانش‌آموز..."
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
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-bold shrink-0">
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
            onClick={() => setFilterType('top_academic')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
              filterType === 'top_academic'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>ممتازین درسی (معدل ۱۸+)</span>
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-3 px-3.5 text-center w-12">ردیف</th>
                  <th className="py-3 px-4">مشخصات دانش‌آموز</th>
                  <th className="py-3 px-3 text-center">کلاس</th>
                  <th className="py-3 px-3 text-center">معدل تحصیلی</th>
                  <th className="py-3 px-3 text-center">نمره انضباط</th>
                  <th className="py-3 px-3 text-center">غیبت‌ها</th>
                  <th className="py-3 px-3 text-center">تاخیر صبحگاهی</th>
                  <th className="py-3 px-3 text-center">تذکرات انضباطی</th>
                  <th className="py-3 px-4 text-center">مشاهده وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student, idx) => {
                  const studentClass = classes.find(c => c.id === student.classId);
                  const acad = getStudentAcademicData(student.id);
                  const disc = getStudentDisciplineData(student);

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition">
                      {/* Row index */}
                      <td className="py-3 px-3.5 text-center font-mono text-slate-400">
                        {toPersianDigits(idx + 1)}
                      </td>

                      {/* Student Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            {getStudentFullName(student).charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{getStudentFullName(student)}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              کد ملی: {toPersianDigits(getStudentNationalCode(student))}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3 px-3 text-center text-slate-700 font-medium">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-[11px]">
                          {studentClass?.name || '-'}
                        </span>
                      </td>

                      {/* GPA */}
                      <td className="py-3 px-3 text-center">
                        {acad.gpaAnnual !== null ? (
                          <span className={`inline-block font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg border ${
                            acad.gpaAnnual >= 18 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                            acad.gpaAnnual >= 15 ? 'bg-blue-50 text-blue-800 border-blue-200' :
                            acad.gpaAnnual >= 12 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {toPersianDigits(acad.gpaAnnual.toFixed(2))}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">ثبت نشده</span>
                        )}
                      </td>

                      {/* Discipline Score */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg border ${
                          disc.disciplineScore >= 19 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          disc.disciplineScore >= 17 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {toPersianDigits(disc.disciplineScore)}
                        </span>
                      </td>

                      {/* Absences */}
                      <td className="py-3 px-3 text-center font-mono">
                        {disc.totalAbsences > 0 ? (
                          <span className="text-rose-700 font-bold text-xs bg-rose-50 px-2 py-0.5 rounded-md">
                            {toPersianDigits(disc.totalAbsences)} جلسه
                            {disc.unexcusedAbsences > 0 && (
                              <span className="text-[10px] text-rose-500 block">({toPersianDigits(disc.unexcusedAbsences)} غیرموجه)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-emerald-700 text-[11px] font-bold">بدون غیبت</span>
                        )}
                      </td>

                      {/* Morning Delays */}
                      <td className="py-3 px-3 text-center font-mono">
                        {disc.delays.length > 0 ? (
                          <span className="text-amber-800 font-bold text-xs bg-amber-50 px-2 py-0.5 rounded-md">
                            {toPersianDigits(disc.delays.length)} بار
                            <span className="text-[10px] text-amber-600 block">({toPersianDigits(disc.totalDelayMinutes)} دقیقه)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">بدون تاخیر</span>
                        )}
                      </td>

                      {/* Disciplinary Notes */}
                      <td className="py-3 px-3 text-center font-mono">
                        {disc.notesCount > 0 ? (
                          <span className="text-rose-800 font-bold text-xs bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                            {toPersianDigits(disc.notesCount)} مورد
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setDetailModalStudent(student);
                            setModalActiveTab('grades');
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold transition flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                          <span>مشاهده ریز پرونده</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Read-Only Modal: Full Academic & Disciplinary Detail */}
      {detailModalStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden font-['Vazirmatn',sans-serif]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-black text-sm text-indigo-200">
                  {getStudentFullName(detailModalStudent).charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold">{getStudentFullName(detailModalStudent)}</h3>
                    <span className="bg-indigo-500/30 text-indigo-200 text-[10px] px-2 py-0.5 rounded-md border border-indigo-400/20 font-bold">
                      فقط مشاهده مربی
                    </span>
                  </div>
                  <span className="text-xs text-slate-300 font-mono">
                    کد ملی: {toPersianDigits(getStudentNationalCode(detailModalStudent))} • شماره تماس ولی: {toPersianDigits(detailModalStudent.parentPhone || '---')}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setDetailModalStudent(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center bg-slate-100 p-2 border-b border-slate-200 text-xs font-bold">
              <button
                onClick={() => setModalActiveTab('grades')}
                className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalActiveTab === 'grades'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <span>کارنامه و ریز نمرات درسی</span>
              </button>

              <button
                onClick={() => setModalActiveTab('discipline')}
                className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalActiveTab === 'discipline'
                    ? 'bg-white text-rose-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>سوابق انضباطی، تاخیر و غیبت</span>
              </button>

              <button
                onClick={() => setModalActiveTab('analysis')}
                className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalActiveTab === 'analysis'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>تحلیل و راهبرد تربیتی مربی</span>
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
              
              {/* TAB 1: ACADEMIC GRADES (READ-ONLY) */}
              {modalActiveTab === 'grades' && (
                <div className="space-y-4">
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3.5 flex items-center justify-between text-indigo-900">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold">ریز نمرات نوبت اول و دوم مصوب معاونت آموزش</span>
                    </div>
                    <span className="text-[11px] text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 font-mono font-bold">
                      معدل سالانه: {getStudentAcademicData(detailModalStudent.id).gpaAnnual !== null ? `${toPersianDigits(getStudentAcademicData(detailModalStudent.id).gpaAnnual!.toFixed(2))} از ۲۰` : 'ثبت نشده'}
                    </span>
                  </div>

                  {academicSubjects.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">درسی تعریف نشده است.</div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">عنوان درس</th>
                            <th className="py-2.5 px-2.5 text-center">مستمر ۱</th>
                            <th className="py-2.5 px-2.5 text-center">پایانی ۱</th>
                            <th className="py-2.5 px-2.5 text-center">مستمر ۲</th>
                            <th className="py-2.5 px-2.5 text-center">پایانی ۲</th>
                            <th className="py-2.5 px-3 text-center">نمره سالانه</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {academicSubjects.map(sub => {
                            const gradeRecord = academicGrades.find(
                              g => g.studentId === detailModalStudent.id && g.subjectId === sub.id
                            );

                            const c1 = gradeRecord?.continuousScoreTerm1;
                            const f1 = gradeRecord?.finalScoreTerm1;
                            const c2 = gradeRecord?.continuousScoreTerm2;
                            const f2 = gradeRecord?.finalScoreTerm2;

                            let annualScore: number | null = null;
                            if (typeof f1 === 'number' && typeof f2 === 'number') {
                              annualScore = (f1 + f2) / 2;
                            } else if (typeof f2 === 'number') {
                              annualScore = f2;
                            } else if (typeof f1 === 'number') {
                              annualScore = f1;
                            }

                            return (
                              <tr key={sub.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-bold text-slate-800">
                                  {sub.name}
                                </td>

                                <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-700">
                                  {typeof c1 === 'number' ? toPersianDigits(c1) : '-'}
                                </td>

                                <td className="py-2.5 px-2.5 text-center font-mono font-bold text-indigo-700">
                                  {typeof f1 === 'number' ? toPersianDigits(f1) : '-'}
                                </td>

                                <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-700">
                                  {typeof c2 === 'number' ? toPersianDigits(c2) : '-'}
                                </td>

                                <td className="py-2.5 px-2.5 text-center font-mono font-bold text-indigo-700">
                                  {typeof f2 === 'number' ? toPersianDigits(f2) : '-'}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  {annualScore !== null ? (
                                    <span className={`font-mono font-black px-2 py-0.5 rounded-md ${
                                      annualScore >= 18 ? 'bg-emerald-100 text-emerald-800' :
                                      annualScore >= 14 ? 'bg-blue-100 text-blue-800' :
                                      annualScore >= 10 ? 'bg-amber-100 text-amber-800' :
                                      'bg-rose-100 text-rose-800'
                                    }`}>
                                      {toPersianDigits(annualScore.toFixed(1))}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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
                            <span className="text-rose-600 text-[11px] block">غیبت‌های کلاسی:</span>
                            <span className="text-xl font-black font-mono text-rose-800 mt-1 block">
                              {toPersianDigits(disc.totalAbsences)} جلسه ({toPersianDigits(disc.unexcusedAbsences)} غیرموجه)
                            </span>
                          </div>

                          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
                            <span className="text-amber-700 text-[11px] block">تاخیرهای صبحگاهی ورود:</span>
                            <span className="text-xl font-black font-mono text-amber-900 mt-1 block">
                              {toPersianDigits(disc.delays.length)} بار ({toPersianDigits(disc.totalDelayMinutes)} دقیقه)
                            </span>
                          </div>
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
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
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
