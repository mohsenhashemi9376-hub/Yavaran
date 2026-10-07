import React, { useState, useMemo } from 'react';
import { useSchool } from '../context/SchoolContext';
import { Student, SchoolClass, MorningDelayRecord, StudentUnifiedDelayItem, StudentAttendanceRecord } from '../types';
import { 
  toPersianDigits, 
  toEnglishDigits, 
  getTodayShamsi, 
  getRecentShamsiWeeks, 
  getShamsiWeekRange,
  parseShamsi,
  PERSIAN_MONTHS 
} from '../utils/persianDate';
import { 
  Clock, 
  Calendar, 
  BarChart3, 
  AlertTriangle, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare, 
  UserX, 
  UserCheck, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles,
  Printer,
  Eye,
  Layers,
  ArrowUpDown,
  Phone
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { studentFullName } from '../utils/studentName';

interface DelayAnalyticsViewProps {
  onOpenNewDelayModal: (student?: Student) => void;
  onOpenSmsModal: (student: Student, defaultText?: string) => void;
  onSelectStudent?: (student: Student) => void;
}

export const DelayAnalyticsView: React.FC<DelayAnalyticsViewProps> = ({
  onOpenNewDelayModal,
  onOpenSmsModal,
  onSelectStudent,
}) => {
  const { students, classes, morningDelays, sessions } = useSchool();
  const todayInfo = getTodayShamsi();

  // Filter & Period States
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly' | 'all'>('weekly');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Weekly selection
  const recentWeeks = useMemo(() => getRecentShamsiWeeks(8), []);
  const [selectedWeekId, setSelectedWeekId] = useState<string>(recentWeeks[0]?.id || '');

  // Monthly selection
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(todayInfo.month); // 1-12

  // Expanded student drilldown
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Active Week Range
  const activeWeek = useMemo(() => {
    return recentWeeks.find((w) => w.id === selectedWeekId) || recentWeeks[0];
  }, [recentWeeks, selectedWeekId]);

  // Consolidate all delays: both morning entry gate and class sessions
  const unifiedDelays = useMemo(() => {
    const list: StudentUnifiedDelayItem[] = [];

    // 1. Add morning gate delays
    (morningDelays || []).forEach((md) => {
      list.push({
        id: md.id,
        type: 'morning_gate',
        date: md.date,
        dayOfWeek: md.dayOfWeek,
        delayMinutes: md.delayMinutes,
        arrivalTime: md.arrivalTime,
        reason: md.reason,
        isExcused: md.isExcused,
        recordedBy: md.recordedBy,
        notes: md.notes,
      });
    });

    // 2. Add class session delays (if any recorded in class attendance sessions)
    sessions.forEach((sess) => {
      if (sess.records) {
        Object.entries(sess.records).forEach(([stuId, rawRec]) => {
          const rec = rawRec as StudentAttendanceRecord;
          if (rec && rec.status === 'late' && (rec.delayMinutes || 0) > 0) {
            list.push({
              id: `sess-${sess.id}-${stuId}`,
              type: 'class_session',
              date: sess.date,
              dayOfWeek: sess.dayOfWeek || 'نامشخص',
              delayMinutes: rec.delayMinutes || 15,
              arrivalTime: sess.startTime,
              subjectOrSession: sess.subject || `جلسه کلاسی`,
              reason: rec.note || 'ثبت در کلاس درس',
              isExcused: false,
              recordedBy: sess.teacherName || 'دبیر محترم',
              notes: rec.note,
            });
          }
        });
      }
    });

    return list;
  }, [morningDelays, sessions]);

  // Filter delays by active period
  const filteredDelaysByPeriod = useMemo(() => {
    return unifiedDelays.filter((delay) => {
      if (periodType === 'weekly') {
        if (!activeWeek) return true;
        return delay.date >= activeWeek.startDate && delay.date <= activeWeek.endOfWeekDate;
      }
      if (periodType === 'monthly') {
        const parts = parseShamsi(delay.date);
        return parts.month === selectedMonthIndex;
      }
      return true;
    });
  }, [unifiedDelays, periodType, activeWeek, selectedMonthIndex]);

  // Aggregate stats per student for the selected period
  const studentDelaySummaries = useMemo(() => {
    const map = new Map<string, {
      student: Student;
      studentClass?: SchoolClass;
      totalMinutes: number;
      delayCount: number;
      unexcusedCount: number;
      excusedCount: number;
      delays: StudentUnifiedDelayItem[];
    }>();

    // Initialize all students matching class filter
    students.forEach((stu) => {
      if (selectedClassId === 'all' || stu.classId === selectedClassId) {
        map.set(stu.id, {
          student: stu,
          studentClass: classes.find((c) => c.id === stu.classId),
          totalMinutes: 0,
          delayCount: 0,
          unexcusedCount: 0,
          excusedCount: 0,
          delays: [],
        });
      }
    });

    // Populate filtered delays
    filteredDelaysByPeriod.forEach((d) => {
      // Find which student this delay belongs to
      let studentId = '';
      const morningMatch = (morningDelays || []).find((m) => m.id === d.id);
      if (morningMatch) {
        studentId = morningMatch.studentId;
      } else if (d.id.startsWith('sess-')) {
        const parts = d.id.split('-');
        studentId = parts.slice(2).join('-');
      }

      if (studentId && map.has(studentId)) {
        const item = map.get(studentId)!;
        item.totalMinutes += d.delayMinutes;
        item.delayCount += 1;
        if (d.isExcused) {
          item.excusedCount += 1;
        } else {
          item.unexcusedCount += 1;
        }
        item.delays.push(d);
      }
    });

    let result = Array.from(map.values());

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((item) => {
        const fullName = `${studentFullName(item.student)}`.toLowerCase();
        const code = item.student.studentCode.toLowerCase();
        const nationalId = (item.student.nationalId || '').toLowerCase();
        return fullName.includes(q) || code.includes(q) || nationalId.includes(q);
      });
    }

    // Sort by total minutes descending, then delay count descending
    result.sort((a, b) => b.totalMinutes - a.totalMinutes || b.delayCount - a.delayCount);

    return result;
  }, [students, classes, filteredDelaysByPeriod, selectedClassId, searchTerm, morningDelays]);

  // Overall KPI metrics for selected period
  const totalPeriodDelays = useMemo(() => {
    return studentDelaySummaries.reduce((sum, s) => sum + s.delayCount, 0);
  }, [studentDelaySummaries]);

  const totalPeriodMinutes = useMemo(() => {
    return studentDelaySummaries.reduce((sum, s) => sum + s.totalMinutes, 0);
  }, [studentDelaySummaries]);

  const studentsWithDelaysCount = useMemo(() => {
    return studentDelaySummaries.filter((s) => s.delayCount > 0).length;
  }, [studentDelaySummaries]);

  const criticalStudents = useMemo(() => {
    // Students with 2+ delays or 30+ minutes
    return studentDelaySummaries.filter((s) => s.delayCount >= 2 || s.totalMinutes >= 30);
  }, [studentDelaySummaries]);

  // Days of week distribution
  const dayOfWeekDistribution = useMemo(() => {
    const days: Record<string, { count: number; minutes: number }> = {
      'شنبه': { count: 0, minutes: 0 },
      'یکشنبه': { count: 0, minutes: 0 },
      'دوشنبه': { count: 0, minutes: 0 },
      'سه‌شنبه': { count: 0, minutes: 0 },
      'چهارشنبه': { count: 0, minutes: 0 },
      'پنج‌شنبه': { count: 0, minutes: 0 },
    };

    filteredDelaysByPeriod.forEach((d) => {
      if (days[d.dayOfWeek]) {
        days[d.dayOfWeek].count += 1;
        days[d.dayOfWeek].minutes += d.delayMinutes;
      }
    });

    return days;
  }, [filteredDelaysByPeriod]);

  // Most delayed day
  const mostDelayedDay = useMemo(() => {
    let maxDay = 'شنبه';
    let maxMins = 0;
    Object.entries(dayOfWeekDistribution).forEach(([day, rawData]) => {
      const data = rawData as { count: number; minutes: number };
      if (data.minutes > maxMins) {
        maxMins = data.minutes;
        maxDay = day;
      }
    });
    return { day: maxDay, minutes: maxMins };
  }, [dayOfWeekDistribution]);

  // Export to Excel for weekly/monthly summary
  const handleExportExcel = () => {
    const periodLabel = periodType === 'weekly' 
      ? activeWeek?.label 
      : periodType === 'monthly'
      ? `ماه ${PERSIAN_MONTHS[selectedMonthIndex - 1]}`
      : 'کل دوره تحصیلی';

    const exportRows = studentDelaySummaries.map((item, idx) => {
      const datesList = item.delays.map((d) => `${d.date} (${d.dayOfWeek} - ${d.delayMinutes} دقیقه)`).join(' | ');
      const reasonsList = item.delays.map((d) => d.reason || 'بدون توضیح').filter(Boolean).join(' | ');

      return {
        'ردیف': idx + 1,
        'نام و نام خانوادگی': `${studentFullName(item.student)}`,
        'کد دانش‌آموزی': item.student.studentCode,
        'کلاس': item.studentClass?.name || '-',
        'تعداد دفعات تاخیر': item.delayCount,
        'مجموع دقایق تاخیر': item.totalMinutes,
        'تاخیرهای غیرموجه': item.unexcusedCount,
        'تاخیرهای موجه': item.excusedCount,
        'شماره تماس ولی': item.student.parentPhone || item.student.fatherPhone || '-',
        'تاریخ‌ها و روزهای تاخیر': datesList || 'بدون تاخیر',
        'علت‌های ذکر شده': reasonsList || '-',
        'وضعیت هشدار': item.delayCount >= 3 ? 'بحرانی (احضار ولی)' : item.delayCount >= 2 ? 'هشدار مکرر' : item.delayCount === 1 ? 'تذکر' : 'عادی',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'جمع‌بندی تاخیرها');

    const fileName = `گزارش_تاخیرات_${periodType}_مدرسه_یاوران_ولایت_${todayInfo.formattedDate.replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner for Analytics */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-900 text-white rounded-2xl p-6 shadow-md border border-amber-900/60 relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/40 px-3 py-1 rounded-full text-xs font-semibold text-amber-300">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>سامانه هوشمند تحلیل و جمع‌بندی تاخیرهای دانش‌آموزان</span>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <span>گزارش جامع هفتگی و ماهانه تاخیرات ورود به مدرسه</span>
            </h2>
            
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              محاسبه خودکار مجموع دقایق تاخیر، تفکیک بر اساس روزهای هفته، شناسایی دانش‌آموزان با تاخیرهای تکرارشونده و صدور سریع پیامک و برگه تذکر انضباطی.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => onOpenNewDelayModal()}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت تاخیر ورود جدید</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition border border-slate-700 shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>خروجی اکسل این گزارش</span>
            </button>
          </div>
        </div>
      </div>

      {/* Period Selection & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Period Toggle Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-start">
            <button
              onClick={() => setPeriodType('weekly')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                periodType === 'weekly'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>جمع‌بندی هفتگی</span>
            </button>

            <button
              onClick={() => setPeriodType('monthly')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                periodType === 'monthly'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>جمع‌بندی ماهانه</span>
            </button>

            <button
              onClick={() => setPeriodType('all')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                periodType === 'all'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>کل دوره</span>
            </button>
          </div>

          {/* Sub-selectors (Week dropdown or Month dropdown) */}
          <div className="flex items-center gap-3 flex-wrap">
            
            {periodType === 'weekly' && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl">
                <span className="text-xs text-amber-900 font-bold">انتخاب هفته:</span>
                <select
                  value={selectedWeekId}
                  onChange={(e) => setSelectedWeekId(e.target.value)}
                  className="text-xs font-bold text-amber-950 bg-transparent outline-none cursor-pointer"
                >
                  {recentWeeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodType === 'monthly' && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl">
                <span className="text-xs text-amber-900 font-bold">انتخاب ماه:</span>
                <select
                  value={selectedMonthIndex}
                  onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
                  className="text-xs font-bold text-amber-950 bg-transparent outline-none cursor-pointer"
                >
                  {PERSIAN_MONTHS.map((name, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {name} {toPersianDigits(todayInfo.year)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Class Filter */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">کلاس:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              >
                <option value="all">همه کلاس‌ها</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجوی نام یا کد دانش‌آموز..."
                className="text-xs bg-white border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
              />
            </div>

          </div>
        </div>
      </div>

      {/* KPI Cards for Selected Period */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">
              {periodType === 'weekly' ? 'مجموع تاخیرهای این هفته' : periodType === 'monthly' ? 'مجموع تاخیرهای این ماه' : 'مجموع کل تاخیرها'}
            </div>
            <div className="text-2xl font-black text-amber-600 mt-1 font-mono">
              {toPersianDigits(totalPeriodMinutes)} <span className="text-xs font-normal text-slate-500">دقیقه</span>
            </div>
            <div className="text-[10px] text-amber-700 font-medium mt-0.5">
              معادل {toPersianDigits((totalPeriodMinutes / 60).toFixed(1))} ساعت زمان آموزشی
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">تعداد دفعات تاخیر ثبت‌شده</div>
            <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
              {toPersianDigits(totalPeriodDelays)} <span className="text-xs font-normal text-slate-500">مورد</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              توسط {toPersianDigits(studentsWithDelaysCount)} دانش‌آموز مختلف
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <UserX className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">دانش‌آموزان با تاخیر مکرر</div>
            <div className="text-2xl font-black text-rose-600 mt-1 font-mono">
              {toPersianDigits(criticalStudents.length)} <span className="text-xs font-normal text-slate-500">نفر</span>
            </div>
            <div className="text-[10px] text-rose-500 font-medium mt-0.5">۲ تاخیر یا بیش از ۳۰ دقیقه</div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">پرتاخیرترین روز کاری</div>
            <div className="text-xl font-black text-purple-700 mt-1">
              روز {mostDelayedDay.day}
            </div>
            <div className="text-[10px] text-purple-600 font-medium mt-0.5">
              با مجموع {toPersianDigits(mostDelayedDay.minutes)} دقیقه تاخیر
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Visual Days-of-Week Breakdown Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-slate-800">
              توزیع دقایق تاخیر بر حسب روزهای هفته در {periodType === 'weekly' ? activeWeek?.label : periodType === 'monthly' ? `ماه ${PERSIAN_MONTHS[selectedMonthIndex - 1]}` : 'دوره'}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            شنبه الی پنج‌شنبه
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
          {Object.entries(dayOfWeekDistribution).map(([dayName, rawData]) => {
            const data = rawData as { count: number; minutes: number };
            const isHighest = dayName === mostDelayedDay.day && data.minutes > 0;
            return (
              <div 
                key={dayName}
                className={`p-3 rounded-xl border transition ${
                  isHighest 
                    ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300' 
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>{dayName}</span>
                  {isHighest && (
                    <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                      بیشترین
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-lg font-black font-mono text-slate-900">
                    {toPersianDigits(data.minutes)}
                  </span>
                  <span className="text-[10px] text-slate-500">دقیقه</span>
                </div>

                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  {toPersianDigits(data.count)} بار ثبت تاخیر
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical Students Alert Bar */}
      {criticalStudents.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                توجه معاون انضباطی: {toPersianDigits(criticalStudents.length)} دانش‌آموز در این بازه دارای تاخیر مکرر یا بیش از ۳۰ دقیقه هستند
              </span>
            </div>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg">
              اقدام فوری انضباطی
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {criticalStudents.map((item) => (
              <div 
                key={item.student.id}
                className="bg-white p-3 rounded-xl border border-rose-200 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">
                    {studentFullName(item.student)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {item.studentClass?.name} • {toPersianDigits(item.delayCount)} بار تاخیر ({toPersianDigits(item.totalMinutes)} دقیقه)
                  </div>
                </div>

                <button
                  onClick={() => {
                    const smsText = `اولیا گرامی دانش‌آموز ${studentFullName(item.student)}؛ فرزند شما در این ${periodType === 'weekly' ? 'هفته' : 'ماه'} مجموعاً ${toPersianDigits(item.delayCount)} بار و به میزان ${toPersianDigits(item.totalMinutes)} دقیقه تاخیر در ورود داشته است. لطفاً جهت بررسی به دفتر انضباطی مراجعه فرمایید. - دبیرستان یاوران ولایت`;
                    onOpenSmsModal(item.student, smsText);
                  }}
                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                  title="ارسال پیامک اخطار تاخیر به ولی"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>پیامک اخطار</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Aggregated Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900">
              جدول جمع‌بندی تاخیر دانش‌آموزان به تفکیک
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              نمایش دانش‌آموزان، دفعات تاخیر، مجموع دقایق و تاریخچه دقیق تاخیرهای ثبت‌شده
            </p>
          </div>

          <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-2xs font-mono">
            {toPersianDigits(studentDelaySummaries.length)} دانش‌آموز
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 text-[11px] font-bold border-b border-slate-200">
                <th className="py-3 px-3 text-center w-12">ردیف</th>
                <th className="py-3 px-4">نام دانش‌آموز</th>
                <th className="py-3 px-3">کلاس</th>
                <th className="py-3 px-3 text-center">تعداد تاخیر</th>
                <th className="py-3 px-3 text-center">مجموع دقایق</th>
                <th className="py-3 px-3 text-center">موجه / غیرموجه</th>
                <th className="py-3 px-3 text-center">سطح هشدار</th>
                <th className="py-3 px-4 text-center">جزئیات و عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {studentDelaySummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    دانش‌آموزی با این مشخصات یافت نشد.
                  </td>
                </tr>
              ) : (
                studentDelaySummaries.map((item, idx) => {
                  const isExpanded = expandedStudentId === item.student.id;
                  const isCritical = item.delayCount >= 2 || item.totalMinutes >= 30;
                  const hasDelays = item.delayCount > 0;

                  return (
                    <React.Fragment key={item.student.id}>
                      <tr className={`hover:bg-slate-50/80 transition ${
                        isCritical ? 'bg-amber-50/30' : ''
                      }`}>
                        
                        {/* Index */}
                        <td className="py-3 px-3 text-center font-mono text-slate-400">
                          {toPersianDigits(idx + 1)}
                        </td>

                        {/* Student Name */}
                        <td className="py-3 px-4">
                          {onSelectStudent ? (
                            <button
                              type="button"
                              onClick={() => onSelectStudent(item.student)}
                              className="font-bold text-slate-900 hover:text-teal-800 hover:underline transition cursor-pointer text-right"
                              title="مشاهده پرونده و مشخصات کامل دانش‌آموز"
                            >
                              {studentFullName(item.student)}
                            </button>
                          ) : (
                            <div className="font-bold text-slate-900">
                              {studentFullName(item.student)}
                            </div>
                          )}
                        </td>

                        {/* Class */}
                        <td className="py-3 px-3 font-medium text-slate-700">
                          {item.studentClass?.name || '-'}
                        </td>

                        {/* Delay count */}
                        <td className="py-3 px-3 text-center font-mono">
                          {hasDelays ? (
                            <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                              {toPersianDigits(item.delayCount)} بار
                            </span>
                          ) : (
                            <span className="text-slate-400">۰</span>
                          )}
                        </td>

                        {/* Total minutes */}
                        <td className="py-3 px-3 text-center font-mono">
                          {hasDelays ? (
                            <span className="font-black text-slate-900 text-sm">
                              {toPersianDigits(item.totalMinutes)} <span className="text-[10px] text-slate-500 font-normal">دقیقه</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Excused vs Unexcused */}
                        <td className="py-3 px-3 text-center">
                          {hasDelays ? (
                            <div className="inline-flex items-center gap-1 text-[11px] font-mono">
                              <span className="text-rose-600 font-bold" title="غیرموجه">
                                {toPersianDigits(item.unexcusedCount)} غیرموجه
                              </span>
                              {item.excusedCount > 0 && (
                                <>
                                  <span className="text-slate-300">/</span>
                                  <span className="text-emerald-600 font-bold" title="موجه">
                                    {toPersianDigits(item.excusedCount)} موجه
                                  </span>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Warning level */}
                        <td className="py-3 px-3 text-center">
                          {item.delayCount >= 3 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" />
                              بحرانی
                            </span>
                          ) : item.delayCount >= 2 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              هشدار مکرر
                            </span>
                          ) : item.delayCount === 1 ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                              تذکر ۱ بار
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              بدون تاخیر
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            
                            {/* Drilldown toggle */}
                            {hasDelays && (
                              <button
                                onClick={() => setExpandedStudentId(isExpanded ? null : item.student.id)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                  isExpanded
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                                title="مشاهده ریز تاخیرها"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isExpanded ? 'بستن' : 'ریز تاخیرها'}</span>
                              </button>
                            )}

                            {/* Record delay shortcut */}
                            <button
                              onClick={() => onOpenNewDelayModal(item.student)}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition cursor-pointer"
                              title="ثبت تاخیر جدید برای این دانش‌آموز"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            {/* SMS */}
                            <button
                              onClick={() => {
                                const smsText = `اولیا گرامی دانش‌آموز ${studentFullName(item.student)}؛ فرزند شما در این ${periodType === 'weekly' ? 'هفته' : 'ماه'} مجموعاً ${toPersianDigits(item.delayCount)} بار و به میزان ${toPersianDigits(item.totalMinutes)} دقیقه تاخیر در ورود داشته است. لطفاً جهت بررسی به دفتر انضباطی مراجعه فرمایید. - دبیرستان یاوران ولایت`;
                                onOpenSmsModal(item.student, smsText);
                              }}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                              title="ارسال پیامک گزارش تاخیر به ولی"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>

                          </div>
                        </td>

                      </tr>

                      {/* Expanded Sub-row showing detailed delays */}
                      {isExpanded && hasDelays && (
                        <tr className="bg-amber-50/40">
                          <td colSpan={8} className="p-4">
                            <div className="bg-white rounded-xl border border-amber-200 p-4 space-y-3 shadow-2xs">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <div className="font-bold text-xs text-amber-900 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-amber-600" />
                                  <span>
                                    ریز سوابق تاخیر {studentFullName(item.student)} در این بازه ({toPersianDigits(item.delays.length)} مورد):
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500">
                                  مجموع: {toPersianDigits(item.totalMinutes)} دقیقه
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {item.delays.map((d, dIdx) => (
                                  <div 
                                    key={d.id || dIdx}
                                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs"
                                  >
                                    <div className="flex items-center justify-between font-bold">
                                      <span className="text-slate-800">
                                        {d.dayOfWeek} {d.date}
                                      </span>
                                      <span className="font-mono text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-black">
                                        {toPersianDigits(d.delayMinutes)} دقیقه
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                                      <span>ساعت ورود: {d.arrivalTime ? toPersianDigits(d.arrivalTime) : 'نامشخص'}</span>
                                      <span className={d.isExcused ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                        {d.isExcused ? 'موجه' : 'غیرموجه'}
                                      </span>
                                    </div>

                                    {d.reason && (
                                      <div className="text-[11px] text-slate-600 bg-white p-1.5 rounded-lg border border-slate-100">
                                        علت: {d.reason}
                                      </div>
                                    )}

                                    {d.notes && (
                                      <div className="text-[10px] text-slate-400">
                                        توضیحات: {d.notes}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
