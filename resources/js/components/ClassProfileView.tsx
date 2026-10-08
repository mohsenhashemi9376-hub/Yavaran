import React, { useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolClass, Student, AttendanceSession } from '../types';
import { toPersianDigits, getTodayShamsi } from '../utils/persianDate';
import { exportClassAttendanceToExcel } from '../utils/excelExport';
import { ClassMonthlyGradesSection } from './ClassMonthlyGradesSection';
import { SessionDetailModal } from './SessionDetailModal';
import { EditClassModal } from './EditClassModal';
import { AddStudentToClassModal } from './AddStudentToClassModal';
import { TransferStudentModal } from './TransferStudentModal';
import { RemoveStudentFromClassModal } from './RemoveStudentFromClassModal';
import { 
  X, 
  UserPlus, 
  Users, 
  Trash2, 
  Edit2, 
  FileSpreadsheet, 
  Check, 
  Phone, 
  FileText,
  Search,
  PlusCircle,
  BookOpen,
  Calendar,
  Layers,
  UserCheck,
  UserX,
  Eye,
  Settings,
  ArrowRightLeft,
  UserMinus,
  AlertTriangle,
  ChevronLeft,
  ArrowRight,
  GraduationCap,
  ShieldCheck,
  BarChart3,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { studentFullName } from '../utils/studentName';

interface ClassProfileViewProps {
  classData: SchoolClass;
  onBack?: () => void;
  onClose?: () => void;
  onOpenNewAttendance: (classId: string) => void;
  onSelectStudent?: (student: Student) => void;
  onOpenAcademicGrades?: (classId: string) => void;
  onOpenMonthlySummary?: (classId: string) => void;
  onEditSession?: (session: AttendanceSession) => void;
  isModal?: boolean;
}

export const ClassProfileView: React.FC<ClassProfileViewProps> = ({
  classData,
  onBack,
  onClose,
  onOpenNewAttendance,
  onSelectStudent,
  onOpenAcademicGrades,
  onOpenMonthlySummary,
  onEditSession,
  isModal = false,
}) => {
  const { 
    students, 
    sessions, 
    allTeachers, 
    allCoaches,
    academicSubjects,
    getCourseTeacherId,
    updateStudent,
    currentUser
  } = useSchool();
  const canEditClass = currentUser?.role !== 'teacher';
  // دبیر فقط نام دانش‌آموزان را می‌بیند: نه ویرایش، نه افزودن/انتقال/حذف، نه تلفن اولیا و موارد انضباطی
  const isTeacherView = currentUser?.role === 'teacher';

  // Tab State: 4 core sections according to user specification (Phase 11)
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'attendance' | 'reports'>('overview');
  
  // Student filter
  const [studentSearch, setStudentSearch] = useState('');

  // Modals state
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [isEditClassModalOpen, setIsEditClassModalOpen] = useState(false);
  const [transferStudentTarget, setTransferStudentTarget] = useState<Student | null>(null);
  const [removeStudentTarget, setRemoveStudentTarget] = useState<Student | null>(null);
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<AttendanceSession | null>(null);

  // Edit single student inline modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editStudentCode, setEditStudentCode] = useState('');
  const [editNationalId, setEditNationalId] = useState('');

  // Class related data
  const classStudents = students.filter((s) => s.classId === classData.id);
  const classSessions = sessions
    .filter((s) => s.classId === classData.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // دبیران کلاس و دروس‌شان فقط از «برنامه دروس» گرفته می‌شود
  const assignedTeachers = (() => {
    const byTeacher = new Map<string, { id: string; name: string; subjects: string[] }>();
    academicSubjects.forEach((sub) => {
      const teacherId = getCourseTeacherId(classData.id, sub.id);
      if (!teacherId) return;
      const teacher = allTeachers.find((t) => t.id === teacherId);
      if (!teacher) return;
      const cur = byTeacher.get(teacherId) || { id: teacherId, name: teacher.name, subjects: [] };
      cur.subjects.push(sub.name);
      byTeacher.set(teacherId, cur);
    });
    return Array.from(byTeacher.values());
  })();

  const assignedCoach = allCoaches.find((c) => 
    c.id === classData.coachId || c.assignedClassIds?.includes(classData.id)
  );

  // Compute Today's Stats or Latest Session Stats
  const todayShamsi = getTodayShamsi();
  const todaySessions = classSessions.filter((s) => s.date === todayShamsi.formattedDate);
  const latestSession = classSessions[0];
  const targetStatSession = todaySessions.length > 0 ? todaySessions[0] : latestSession;

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;

  if (targetStatSession) {
    classStudents.forEach((stu) => {
      const rec = targetStatSession.records[stu.id];
      if (rec?.status === 'present') presentCount++;
      else if (rec?.status === 'absent') absentCount++;
      else if (rec?.status === 'late') lateCount++;
    });
  }

  // Filtered students for student tab
  const filteredStudents = classStudents.filter((s) => 
    `${studentFullName(s)} ${s.studentCode || ''} ${s.nationalId || ''}`.toLowerCase().includes(studentSearch.toLowerCase().trim())
  );

  // Helper for student attendance percentage
  const getStudentStats = (studentId: string) => {
    let attended = 0;
    let absent = 0;
    let late = 0;

    classSessions.forEach((sess) => {
      const rec = sess.records[studentId];
      if (rec?.status === 'present') attended++;
      else if (rec?.status === 'late') { attended++; late++; }
      else if (rec?.status === 'absent') absent++;
    });

    const total = classSessions.length;
    const rate = total > 0 ? Math.round((attended / total) * 100) : 100;
    return { attended, absent, late, rate };
  };

  const handleStartEditStudent = (stu: Student) => {
    setEditingStudent(stu);
    setEditFirstName(stu.firstName);
    setEditLastName(stu.lastName);
    setEditParentPhone(stu.parentPhone || '');
    setEditStudentCode(stu.studentCode || '');
    setEditNationalId(stu.nationalId || '');
  };

  const handleSaveEditStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editFirstName.trim() || !editLastName.trim()) return;

    updateStudent(editingStudent.id, {
      firstName: editFirstName.trim(),
      lastName: editLastName.trim(),
      parentPhone: editParentPhone.trim(),
      studentCode: editStudentCode.trim(),
      nationalId: editNationalId.trim(),
    });

    setEditingStudent(null);
  };

  return (
    <div className={`space-y-4 font-['Vazirmatn',sans-serif] ${isModal ? '' : 'max-w-7xl mx-auto'}`} dir="rtl">
      
      {/* 1. Header: عنوان + یک دکمه بازگشت + ابزارهای سریع + آمار */}
      <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/60 p-5 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {(onBack || onClose) && (
              <button
                onClick={onClose || onBack}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer shrink-0"
                title="بازگشت"
                aria-label="بازگشت"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold text-slate-900">{classData.name}</h1>
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                  {classData.grade}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                <span>
                  معلم: <strong className="text-slate-700">{assignedTeachers.map(t => t.name).join('، ') || 'تعیین نشده'}</strong>
                </span>
                <span>•</span>
                <span>
                  مربی: <strong className="text-slate-700">{assignedCoach?.name || 'تعیین نشده'}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onOpenNewAttendance(classData.id)}
            className="h-11 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-extrabold transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>ثبت حضور و غیاب امروز</span>
          </button>
        </div>

        {/* ابزارهای جمع‌وجور (Action Pills) */}
        <div className="flex items-center gap-2 flex-wrap">
          {canEditClass && <button
            onClick={() => setIsEditClassModalOpen(true)}
            className="h-9 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>ویرایش کلاس</span>
          </button>}
          {onOpenMonthlySummary && (
            <button
              onClick={() => onOpenMonthlySummary(classData.id)}
              className="h-9 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>جمع‌بندی ماهانه</span>
            </button>
          )}
          {onOpenAcademicGrades && (
            <button
              onClick={() => onOpenAcademicGrades(classData.id)}
              className="h-9 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>کارنامه ۴ نوبته</span>
            </button>
          )}
          <button
            onClick={() => exportClassAttendanceToExcel(classData, students, sessions)}
            className="h-9 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>خروجی اکسل</span>
          </button>
        </div>

        {/* آمار کلاس: یک ردیف ظریف */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'دانش‌آموز', value: toPersianDigits(classStudents.length), color: 'text-slate-900' },
            { label: todaySessions.length > 0 ? 'حاضر امروز' : 'حاضر آخرین جلسه', value: targetStatSession ? toPersianDigits(presentCount) : '—', color: 'text-emerald-600' },
            { label: todaySessions.length > 0 ? 'غایب امروز' : 'غایب آخرین جلسه', value: targetStatSession ? toPersianDigits(absentCount) : '—', color: 'text-rose-600' },
            { label: todaySessions.length > 0 ? 'تأخیر امروز' : 'تأخیر آخرین جلسه', value: targetStatSession ? toPersianDigits(lateCount) : '—', color: 'text-amber-600' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-50 rounded-xl px-3.5 py-2.5 flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-slate-500 font-medium">{stat.label}</span>
              <span className={`text-lg font-extrabold ${stat.color}`}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. بخش‌های ۴ گانه Profile کلاس (مرحله ۱۱: خلاصه، دانش‌آموزان، حضور و غیاب، گزارش‌ها) */}
      <div className="bg-white rounded-2xl shadow-sm shadow-slate-200/60 overflow-hidden">
        
        {/* Tab Headers */}
        <div className="flex border-b border-slate-100 bg-white px-4 pt-3 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-4 text-sm font-bold transition border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>خلاصه کلاس</span>
          </button>

          <button
            onClick={() => setActiveTab('students')}
            className={`pb-3 px-4 text-sm font-bold transition border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'students'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>دانش‌آموزان</span>
            <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
              {toPersianDigits(classStudents.length)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-3 px-4 text-sm font-bold transition border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'attendance'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>حضور و غیاب</span>
            <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
              {toPersianDigits(classSessions.length)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-3 px-4 text-sm font-bold transition border-b-2 flex items-center gap-2 cursor-pointer shrink-0 ${
              activeTab === 'reports'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>گزارش‌ها و کارنامه</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="p-5">

          {/* ========================================================================= */}
          {/* TAB 1: خلاصه (OVERVIEW) */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              
              {/* Info grid */}
              <div className="grid grid-cols-1 gap-4">
                
                {/* بخش کادر آموزشی و تربیتی */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-teal-800" />
                      <span>کادر آموزشی و تربیتی کلاس</span>
                    </h3>
                    {canEditClass && (
                    <button
                      onClick={() => setIsEditClassModalOpen(true)}
                      className="text-[11px] font-bold text-teal-800 hover:text-teal-900 cursor-pointer"
                    >
                      ویرایش کادر
                    </button>
                    )}
                  </div>

                  <div className="space-y-2 text-xs divide-y divide-slate-200/60">
                    <div className="pt-1.5 flex items-center justify-between">
                      <span className="text-slate-500">مربی تربیتی (یاوران ولایت):</span>
                      <span className="font-bold text-slate-800">
                        {assignedCoach ? (
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{assignedCoach.name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">تعیین نشده</span>
                        )}
                      </span>
                    </div>

                    <div className="pt-2">
                      <div className="text-slate-500 mb-1.5">دبیران تخصیص‌یافته به کلاس:</div>
                      {assignedTeachers.length === 0 ? (
                        <div className="text-slate-400 text-[11px]">هنوز دبیر اختصاصی برای این کلاس تعیین نشده است.</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {assignedTeachers.map((t) => (
                            <span key={t.id} className="bg-white border border-slate-200 text-slate-800 px-2 py-1 rounded-lg text-[11px] font-medium shadow-2xs">
                              {t.name} <span className="text-[10px] text-slate-400">({t.subjects.join('، ')})</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* آخرین جلسات برگزار شده */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span>جلسات اخیر کلاس {classData.name}</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className="text-[11px] font-bold text-teal-800 hover:text-teal-900 cursor-pointer"
                  >
                    مشاهده تمام جلسات ({toPersianDigits(classSessions.length)})
                  </button>
                </div>

                {classSessions.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500 space-y-2">
                    <p>هنوز جلسه‌ای برای این کلاس ثبت نشده است.</p>
                    <button
                      onClick={() => onOpenNewAttendance(classData.id)}
                      className="px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>ثبت اولین جلسه</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {classSessions.slice(0, 3).map((sess) => {
                      let p = 0, a = 0;
                      classStudents.forEach(stu => {
                        const rec = sess.records[stu.id];
                        if (rec?.status === 'present') p++;
                        else if (rec?.status === 'absent') a++;
                      });

                      return (
                        <div
                          key={sess.id}
                          onClick={() => setSelectedSessionForModal(sess)}
                          className="bg-white border border-slate-200 hover:border-teal-700 rounded-xl p-3.5 space-y-2 transition cursor-pointer shadow-2xs hover:shadow-xs"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-900 font-mono">
                              {toPersianDigits(sess.date)}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                              {sess.subject || 'کلاس درس'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 truncate">
                            مبحث: <b>{sess.lessonTopic || 'بدون عنوان'}</b>
                          </div>
                          <div className="text-xs text-slate-600 truncate" title={sess.homeworkDescription || ''}>
                            تکلیف: <b>{sess.homeworkDescription?.trim() || 'تکلیفی داده نشده'}</b>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                            <span className="text-emerald-700 font-bold">{toPersianDigits(p)} حاضر</span>
                            <span className="text-rose-700 font-bold">{toPersianDigits(a)} غایب</span>
                            <span className="text-slate-400 font-medium">دبیر: {sess.teacherName}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: دانش‌آموزان (STUDENTS) - مراحل ۱۲ تا ۱۵ */}
          {/* ========================================================================= */}
          {activeTab === 'students' && (
            <div className="space-y-4">
              
              {/* Header Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="جستجوی نام یا کد در دانش‌آموزان این کلاس..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-700 outline-none transition"
                  />
                </div>

                {!isTeacherView && <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAddStudentModalOpen(true)}
                    className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>افزودن دانش‌آموز به کلاس</span>
                  </button>
                </div>}
              </div>

              {/* Students Table */}
              {classStudents.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center text-slate-500 space-y-3">
                  <Users className="w-10 h-10 mx-auto text-slate-400" />
                  <p className="font-bold text-sm text-slate-700">هنوز دانش‌آموزی به این کلاس اضافه نشده است.</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    می‌توانید دانش‌آموزان موجود در مدرسه را به این کلاس منتقل کنید یا دانش‌آموزان جدید را مستقیماً ثبت نمایید.
                  </p>
                  {!isTeacherView && <button
                    onClick={() => setIsAddStudentModalOpen(true)}
                    className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>افزودن دانش‌آموز</span>
                  </button>}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                  دانش‌آموزی با عبارت «{studentSearch}» در این کلاس یافت نشد.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-3 text-center w-12">#</th>
                        <th className="p-3">نام و نام خانوادگی</th>
                        {!isTeacherView && <th className="p-3">تلفن ولی</th>}
                        <th className="p-3 text-center">آمار غیبت / حضور</th>
                        {!isTeacherView && <th className="p-3 text-center">انضباط</th>}
                        <th className="p-3 text-center w-40">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map((stu, idx) => {
                        const stats = getStudentStats(stu.id);
                        const hasExcessiveAbsence = stats.absent >= 2;

                        return (
                          <tr 
                            key={stu.id}
                            className={`hover:bg-slate-50/80 transition ${
                              hasExcessiveAbsence ? 'bg-rose-50/20' : ''
                            }`}
                          >
                            <td className="p-3 text-center text-slate-400 font-bold">
                              {toPersianDigits(idx + 1)}
                            </td>

                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => onSelectStudent && onSelectStudent(stu)}
                                className="text-right group cursor-pointer"
                                title="مشاهده پرونده کامل دانش‌آموز"
                              >
                                <div className="font-bold text-slate-900 group-hover:text-teal-800 group-hover:underline transition text-xs sm:text-sm">
                                  {studentFullName(stu)}
                                </div>
                                {stu.fatherName && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    فرزند {stu.fatherName}
                                  </div>
                                )}
                              </button>
                            </td>

                            {!isTeacherView && <td className="p-3 font-mono text-slate-600" dir="ltr">
                              {stu.parentPhone ? toPersianDigits(stu.parentPhone) : '-'}
                            </td>}

                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 text-[11px]">
                                <span className="font-bold text-emerald-700">{toPersianDigits(stats.rate)}٪ حضور</span>
                                <span>•</span>
                                <span className={`font-bold ${hasExcessiveAbsence ? 'text-rose-700 font-black' : 'text-slate-600'}`}>
                                  {toPersianDigits(stats.absent)} غیبت
                                </span>
                              </div>
                            </td>

                            {!isTeacherView && <td className="p-3 text-center">
                              <span className="font-bold text-slate-800 font-mono">
                                {toPersianDigits(stu.disciplineScore ?? 20)}
                              </span>
                            </td>}

                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                
                                {/* دکمه مشاهده پرونده (مرحله ۱۲ و ۲۵) */}
                                {onSelectStudent && (
                                  <button
                                    onClick={() => onSelectStudent(stu)}
                                    className="p-1.5 text-teal-800 hover:bg-teal-50 rounded-lg transition cursor-pointer"
                                    title="مشاهده پرونده کامل دانش‌آموز"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}

                                {/* دکمه انتقال دانش‌آموز به کلاس دیگر (مرحله ۱۲ و ۱۵) */}
                                {!isTeacherView && (<>
                                <button
                                  onClick={() => setTransferStudentTarget(stu)}
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                  title="انتقال به کلاس دیگر"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>

                                {/* ویرایش مشخصات فردی */}
                                <button
                                  onClick={() => handleStartEditStudent(stu)}
                                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  title="ویرایش مشخصات"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                {/* خروج از کلاس (مرحله ۲۱: تفکیک شده از حذف از سامانه) */}
                                <button
                                  onClick={() => setRemoveStudentTarget(stu)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="خروج از این کلاس"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                                </>)}
                              </div>
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

          {/* ========================================================================= */}
          {/* TAB 3: حضور و غیاب (ATTENDANCE) - مرحله ۱۶ */}
          {/* ========================================================================= */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    لیست جلسات کلاسی و حضور و غیاب {classData.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ثبت، مشاهده آمار تفصیلی، تکالیف و نمرات مستمر هر جلسه.
                  </p>
                </div>

                <button
                  onClick={() => onOpenNewAttendance(classData.id)}
                  className="px-4 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>ثبت جلسه جدید حضور و غیاب</span>
                </button>
              </div>

              {/* Sessions list */}
              {classSessions.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center text-slate-500 space-y-2">
                  <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-bold text-sm text-slate-700">هنوز هیچ جلسه‌ای برای این کلاس ثبت نشده است.</p>
                  <p className="text-xs text-slate-400">
                    با کلیک روی «ثبت جلسه جدید»، اولین جلسه این کلاس را آغاز کنید.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {classSessions.map((s) => {
                    let p = 0, a = 0, l = 0;
                    classStudents.forEach(stu => {
                      const rec = s.records[stu.id];
                      if (rec?.status === 'present') p++;
                      else if (rec?.status === 'absent') a++;
                      else if (rec?.status === 'late') l++;
                    });

                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSessionForModal(s)}
                        className="bg-white border border-slate-200 hover:border-teal-700 rounded-xl p-4 space-y-2.5 transition cursor-pointer shadow-2xs hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 font-mono">
                              {toPersianDigits(s.date)}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                              {s.dayOfWeek}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                            {s.subject}
                          </span>
                        </div>

                        <div className="text-xs text-slate-700">
                          مبحث درس: <b>{s.lessonTopic || 'بدون عنوان'}</b>
                        </div>

                        <div className="text-xs text-slate-700">
                          تکلیف: <b>{s.homeworkDescription?.trim() || 'تکلیفی داده نشده'}</b>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
                          <div className="flex items-center gap-2 font-bold">
                            <span className="text-emerald-700">{toPersianDigits(p)} حاضر</span>
                            <span>•</span>
                            <span className="text-rose-700">{toPersianDigits(a)} غایب</span>
                            <span>•</span>
                            <span className="text-amber-700">{toPersianDigits(l)} تاخیر</span>
                          </div>
                          <span className="text-[11px]">دبیر: {s.teacherName}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: گزارش‌ها و کارنامه (REPORTS) - مرحله ۱۷ */}
          {/* ========================================================================= */}
          {activeTab === 'reports' && (
            <div className="space-y-5">
              
              {/* نمرات مستمر ماهانه کلاسی */}
              <div>
                <ClassMonthlyGradesSection
                  classData={classData}
                  onSelectStudent={onSelectStudent}
                />
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-MODALS: ADD STUDENT, TRANSFER, REMOVE, EDIT STUDENT, SESSION DETAIL */}
      {/* ========================================================================= */}
      
      {/* 1. Add Student Modal */}
      <AddStudentToClassModal
        isOpen={isAddStudentModalOpen}
        onClose={() => setIsAddStudentModalOpen(false)}
        classData={classData}
      />

      {/* 2. Transfer Student Modal */}
      <TransferStudentModal
        isOpen={!!transferStudentTarget}
        onClose={() => setTransferStudentTarget(null)}
        student={transferStudentTarget}
        currentClass={classData}
      />

      {/* 3. Remove Student From Class Modal */}
      <RemoveStudentFromClassModal
        isOpen={!!removeStudentTarget}
        onClose={() => setRemoveStudentTarget(null)}
        student={removeStudentTarget}
        classData={classData}
      />

      {/* 4. Edit Class Modal */}
      <EditClassModal
        isOpen={isEditClassModalOpen}
        onClose={() => setIsEditClassModalOpen(false)}
        classData={classData}
      />

      {/* 5. Session Detail Modal */}
      {selectedSessionForModal && (
        <SessionDetailModal
          isOpen={!!selectedSessionForModal}
          onClose={() => setSelectedSessionForModal(null)}
          session={selectedSessionForModal}
          onEdit={() => {
            if (onEditSession && selectedSessionForModal) {
              onEditSession(selectedSessionForModal);
              setSelectedSessionForModal(null);
            }
          }}
        />
      )}

      {/* 6. Edit Single Student Info Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in font-['Vazirmatn',sans-serif]">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">ویرایش مشخصات دانش‌آموز</h3>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نام *</label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نام خانوادگی *</label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">شماره تماس ولی</label>
                <input
                  type="tel"
                  value={editParentPhone}
                  onChange={(e) => setEditParentPhone(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-700 font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">کد ملی</label>
                  <input
                    type="text"
                    value={editNationalId}
                    onChange={(e) => setEditNationalId(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-700 font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">کد دانش‌آموزی</label>
                  <input
                    type="text"
                    value={editStudentCode}
                    onChange={(e) => setEditStudentCode(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-teal-700 font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-teal-800 hover:bg-teal-900 text-white rounded-xl transition shadow-xs cursor-pointer"
                >
                  ذخیره مشخصات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
