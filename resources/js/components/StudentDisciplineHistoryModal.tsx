import React, { useState } from 'react';
import { Student, SchoolClass, DisciplinaryNote, MorningDelayRecord, AttendanceSession } from '../types';
import { toPersianDigits, formatShamsiDisplay, getDayOfWeekFromShamsi } from '../utils/persianDate';
import { 
  X, 
  Clock, 
  UserX, 
  AlertTriangle, 
  Award, 
  Calendar, 
  Phone, 
  FileText, 
  MessageSquare, 
  Printer, 
  CheckCircle2, 
  Plus, 
  Trash2,
  Sparkles,
  Info,
  ShieldAlert,
  ChevronLeft
} from 'lucide-react';
import { studentFullName } from '../utils/studentName';
import { useSchool } from '../context/SchoolContext';
import { absenceEventsOf } from '../utils/attendanceStats';

interface StudentDisciplineHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  studentClass?: SchoolClass;
  initialTab?: 'morning_delays' | 'absences' | 'warnings' | 'score';
  sessions: AttendanceSession[];
  morningDelays?: MorningDelayRecord[];
  onOpenAddDelay?: (student: Student) => void;
  onOpenAddNote?: (student: Student) => void;
  onOpenSms?: (student: Student, defaultText?: string) => void;
  onDeleteNote?: (studentId: string, noteId: string) => void;
  onDeleteDelay?: (delayId: string) => void;
}

export const StudentDisciplineHistoryModal: React.FC<StudentDisciplineHistoryModalProps> = ({
  isOpen,
  onClose,
  student,
  studentClass,
  initialTab = 'morning_delays',
  sessions,
  morningDelays = [],
  onOpenAddDelay,
  onOpenAddNote,
  onOpenSms,
  onDeleteNote,
  onDeleteDelay,
}) => {
  const [activeTab, setActiveTab] = useState<'morning_delays' | 'absences' | 'warnings' | 'score'>(initialTab);

  // Sync activeTab when modal is reopened
  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const { morningAttendance, schoolAbsences } = useSchool();

  if (!isOpen || !student) return null;

  const safeMorningDelays = Array.isArray(morningDelays) ? morningDelays : [];

  // 1. Student morning delays
  const studentMorningDelays = safeMorningDelays
    .filter((d) => d.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalMorningDelayMinutes = studentMorningDelays.reduce((acc, d) => acc + (d.delayMinutes || 0), 0);
  const totalMorningDelayHours = Math.floor(totalMorningDelayMinutes / 60);
  const remainingMorningMinutes = totalMorningDelayMinutes % 60;

  // 2. Student absence records from attendance sessions
  const studentAbsenceSessions: {
    sessionId: string;
    date: string;
    dayOfWeek: string;
    subject: string;
    teacherName: string;
    status: 'absent' | 'excused';
    note?: string;
  }[] = [];

  // غیبت‌های کلاسی (زنگ‌ها) در آمار غیبت دانش‌آموز نمی‌آیند؛ فقط غیبت روزانه‌ی مدرسه (صبحگاه و دفتر غیبت)
  absenceEventsOf(student, { morningDelays, morningAttendance, schoolAbsences, sessions }).forEach((e) => {
    studentAbsenceSessions.push({
      sessionId: `abs-${e.date}`,
      date: e.date,
      dayOfWeek: getDayOfWeekFromShamsi(e.date),
      subject: 'غیبت روزانه مدرسه',
      teacherName: '',
      status: e.excused ? 'excused' : 'absent',
    });
  });

  studentAbsenceSessions.sort((a, b) => b.date.localeCompare(a.date));
  const unexcusedAbsenceCount = studentAbsenceSessions.filter((s) => s.status === 'absent').length;
  const excusedAbsenceCount = studentAbsenceSessions.filter((s) => s.status === 'excused').length;

  // 3. Disciplinary notes and warnings
  const notes = (student.disciplinaryNotes || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const totalDeductions = notes.reduce((acc, n) => acc + (n.scoreDeduction || 0), 0);
  const currentDisciplineScore = student.disciplineScore ?? Math.max(0, 20 - totalDeductions);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden font-['Vazirmatn',sans-serif] flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg shrink-0 ${
              currentDisciplineScore < 18 ? 'bg-rose-500 text-white' :
              currentDisciplineScore < 20 ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-white'
            }`}>
              {student.firstName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold text-white">
                  پرونده سوابق انضباطی: {studentFullName(student)}
                </h3>
                <span className="text-xs bg-white/10 text-slate-200 border border-white/20 px-2.5 py-0.5 rounded-full">
                  {studentClass?.name || 'کلاس نامشخص'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 mt-1 flex-wrap font-mono">
                <span>کد دانش‌آموزی: {toPersianDigits(student.studentCode)}</span>
                <span>•</span>
                <span>کد ملی: {toPersianDigits(student.nationalId || '-')}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  ولی: {toPersianDigits(student.parentPhone)} ({student.fatherName ? `پدر: ${student.fatherName}` : 'ولی دانش‌آموز'})
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPI Bar for Selected Student */}
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-50 border-b border-slate-200 divide-x divide-x-reverse divide-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('morning_delays')}
            className={`p-3 text-center transition cursor-pointer hover:bg-amber-50/50 ${activeTab === 'morning_delays' ? 'bg-amber-50/80 font-bold' : ''}`}
          >
            <div className="text-slate-500 text-[11px] flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>تاخیرهای صبحگاهی</span>
            </div>
            <div className="text-base font-extrabold text-amber-700 mt-0.5 font-mono">
              {toPersianDigits(studentMorningDelays.length)} بار
              <span className="text-xs font-normal text-slate-500 mr-1">({toPersianDigits(totalMorningDelayMinutes)} دقیقه)</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('absences')}
            className={`p-3 text-center transition cursor-pointer hover:bg-rose-50/50 ${activeTab === 'absences' ? 'bg-rose-50/80 font-bold' : ''}`}
          >
            <div className="text-slate-500 text-[11px] flex items-center justify-center gap-1">
              <UserX className="w-3.5 h-3.5 text-rose-600" />
              <span>غیبت غیرموجه</span>
            </div>
            <div className="text-base font-extrabold text-rose-700 mt-0.5 font-mono">
              {toPersianDigits(unexcusedAbsenceCount)} جلسه
            </div>
          </button>

          <button
            onClick={() => setActiveTab('warnings')}
            className={`p-3 text-center transition cursor-pointer hover:bg-purple-50/50 ${activeTab === 'warnings' ? 'bg-purple-50/80 font-bold' : ''}`}
          >
            <div className="text-slate-500 text-[11px] flex items-center justify-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />
              <span>تذکرات و اخطارها</span>
            </div>
            <div className="text-base font-extrabold text-purple-700 mt-0.5 font-mono">
              {toPersianDigits(notes.length)} مورد
            </div>
          </button>

          <button
            onClick={() => setActiveTab('score')}
            className={`p-3 text-center transition cursor-pointer hover:bg-emerald-50/50 ${activeTab === 'score' ? 'bg-emerald-50/80 font-bold' : ''}`}
          >
            <div className="text-slate-500 text-[11px] flex items-center justify-center gap-1">
              <Award className="w-3.5 h-3.5 text-emerald-600" />
              <span>نمره انضباط</span>
            </div>
            <div className="text-base font-extrabold text-emerald-700 mt-0.5 font-mono">
              {toPersianDigits(currentDisciplineScore)} از ۲۰
            </div>
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 pt-3 bg-white gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('morning_delays')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'morning_delays'
                ? 'border-amber-500 text-amber-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-500" />
            <span>جزئیات تاخیرهای ورود به مدرسه (صبحگاه)</span>
            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full text-[10px]">
              {toPersianDigits(studentMorningDelays.length)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('absences')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'absences'
                ? 'border-rose-500 text-rose-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserX className="w-4 h-4 text-rose-500" />
            <span>سوابق غیبت‌های کلاسی</span>
            <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-full text-[10px]">
              {toPersianDigits(studentAbsenceSessions.length)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('warnings')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'warnings'
                ? 'border-purple-500 text-purple-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-purple-500" />
            <span>تذکرات، اخطارها و تعهدات</span>
            <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full text-[10px]">
              {toPersianDigits(notes.length)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('score')}
            className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'score'
                ? 'border-emerald-500 text-emerald-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="w-4 h-4 text-emerald-500" />
            <span>ریز محاسبات نمره انضباط</span>
          </button>
        </div>

        {/* Modal Body / Tab Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">

          {/* TAB 1: Morning Delays History */}
          {activeTab === 'morning_delays' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">مجموع زمان تاخیرهای ورودی این دانش‌آموز: </span>
                    <strong className="text-amber-800 font-mono text-sm font-black">
                      {toPersianDigits(totalMorningDelayMinutes)} دقیقه 
                      {totalMorningDelayHours > 0 && ` (معادل ${toPersianDigits(totalMorningDelayHours)} ساعت و ${toPersianDigits(remainingMorningMinutes)} دقیقه)`}
                    </strong>
                    <div className="text-[11px] text-amber-800/80 mt-0.5">
                      ثبت شده در گیت ورود صبحگاه مدرسه یاوران ولایت
                    </div>
                  </div>
                </div>

                {onOpenAddDelay && (
                  <button
                    onClick={() => onOpenAddDelay(student)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ثبت تاخیر جدید</span>
                  </button>
                )}
              </div>

              {studentMorningDelays.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">هیچ سابقه تاخیر صبحگاهی برای این دانش‌آموز ثبت نشده است.</p>
                  <p className="text-[11px] text-slate-400 mt-1">دانش‌آموز همواره به موقع و قبل از مراسم صبحگاه در مدرسه حضور داشته است.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  {studentMorningDelays.map((delay, idx) => (
                    <div key={delay.id} className="p-3.5 bg-white hover:bg-slate-50/80 transition flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold font-mono text-xs shrink-0 mt-0.5">
                          {toPersianDigits(idx + 1)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 font-mono">
                              {delay.dayOfWeek} {delay.date}
                            </span>
                            <span className="bg-amber-100 text-amber-800 font-mono px-2 py-0.5 rounded-md font-bold text-[11px]">
                              ساعت ورود: {toPersianDigits(delay.arrivalTime)}
                            </span>
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 font-mono px-2 py-0.5 rounded-md font-extrabold text-[11px]">
                              مدت تاخیر: {toPersianDigits(delay.delayMinutes)} دقیقه
                            </span>
                            {delay.isExcused ? (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                موجه شده با گواهی
                              </span>
                            ) : (
                              <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                غیرموجه
                              </span>
                            )}
                          </div>

                          <div className="text-slate-600 flex items-center gap-2 text-[11px]">
                            <span className="font-semibold text-slate-700">علت تاخیر:</span>
                            <span>{delay.reason || 'بدون ذکر دلیل'}</span>
                          </div>

                          {delay.actionTaken && (
                            <div className="text-purple-700 bg-purple-50/80 px-2.5 py-1 rounded-md text-[11px] inline-block font-medium">
                              اقدام انجام شده: {delay.actionTaken}
                            </div>
                          )}

                          {delay.notes && (
                            <div className="text-slate-500 text-[11px] italic bg-slate-50 p-1.5 rounded-md border border-slate-100">
                              یادداشت: {delay.notes}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-400">
                            ثبت شده توسط: {delay.recordedBy || 'معاونت انضباطی'}
                          </div>
                        </div>
                      </div>

                      {onDeleteDelay && (
                        <button
                          onClick={() => {
                            if (confirm('آیا از حذف این رکورد تاخیر اطمینان دارید؟')) {
                              onDeleteDelay(delay.id);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                          title="حذف سابقه تاخیر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Class Absences History */}
          {activeTab === 'absences' && (
            <div className="space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserX className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <span className="font-bold">سوابق عدم حضور در جلسات درسی: </span>
                    <strong className="text-rose-700 font-mono text-sm font-black">
                      {toPersianDigits(unexcusedAbsenceCount)} جلسه غیرموجه
                    </strong>
                    {excusedAbsenceCount > 0 && (
                      <span className="text-slate-600 mr-2 font-mono text-xs">
                        (+ {toPersianDigits(excusedAbsenceCount)} جلسه موجه)
                      </span>
                    )}
                  </div>
                </div>

                {onOpenSms && (
                  <button
                    onClick={() => onOpenSms(student, `ولی محترم دانش‌آموز ${studentFullName(student)}؛ فرزند شما دارای ${unexcusedAbsenceCount} جلسه غیبت در مدرسه می‌باشد. لطفاً جهت پیگیری آموزشی با معاونت تماس حاصل فرمایید.`)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>ارسال پیامک غیبت به ولی</span>
                  </button>
                )}
              </div>

              {studentAbsenceSessions.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">هیچ غیبتی برای این دانش‌آموز ثبت نشده است.</p>
                  <p className="text-[11px] text-slate-400 mt-1">حضور ۱۰۰٪ در تمامی جلسات درسی و کلاسی.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  {studentAbsenceSessions.map((sess, idx) => (
                    <div key={`${sess.sessionId}-${idx}`} className="p-3.5 bg-white hover:bg-slate-50/80 transition flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold font-mono text-xs shrink-0 mt-0.5 ${
                          sess.status === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {toPersianDigits(idx + 1)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 font-mono">
                              {sess.dayOfWeek} {sess.date}
                            </span>
                            <span className="bg-slate-100 text-slate-800 font-medium px-2 py-0.5 rounded-md">
                              درس: {sess.subject}
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              دبیر: {sess.teacherName}
                            </span>
                            {sess.status === 'absent' ? (
                              <span className="bg-rose-600 text-white px-2 py-0.5 rounded-md font-bold text-[10px]">
                                غیبت غیرموجه
                              </span>
                            ) : (
                              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                                غیبت موجه با عذر
                              </span>
                            )}
                          </div>

                          {sess.note && (
                            <div className="text-slate-600 text-[11px] bg-slate-50 p-1.5 rounded-md border border-slate-100">
                              توضیح دبیر: {sess.note}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Warnings, Notices, Notes */}
          {activeTab === 'warnings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl p-3.5 text-xs text-purple-950">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <span className="font-bold">تذکرات شفاهی، اخطارها و احضار اولیا: </span>
                    <strong className="text-purple-800 font-mono text-sm font-black">
                      {toPersianDigits(notes.length)} مورد ثبت‌شده
                    </strong>
                  </div>
                </div>

                {onOpenAddNote && (
                  <button
                    onClick={() => onOpenAddNote(student)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
                    id="history-modal-add-discipline-btn"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ثبت مورد انضباطی</span>
                  </button>
                )}
              </div>

              {notes.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">هیچ تذکر انضباطی یا اخطاری برای این دانش‌آموز ثبت نشده است.</p>
                  <p className="text-[11px] text-slate-400 mt-1">رفتار و نظم کلاسی در چارچوب قوانین مدرسه یاوران ولایت بوده است.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  {notes.map((note, idx) => (
                    <div key={note.id} className="p-3.5 bg-white hover:bg-slate-50/80 transition flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold font-mono text-xs shrink-0 mt-0.5">
                          {toPersianDigits(idx + 1)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">{note.title}</span>
                            {note.source === 'class_warning' && (
                              <span className="bg-violet-50 text-violet-800 border border-violet-200 px-2 py-0.5 rounded-lg text-[10px] font-bold">اخطار کلاسی{note.subject ? ` • ${note.subject}` : ''}</span>
                            )}
                            <span className="text-slate-400 font-mono text-[11px]">{note.date}</span>
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px]">
                              نوع: {note.type === 'delay' ? 'تاخیر مکرر' : note.type === 'absence' ? 'غیبت غیرموجه' : note.type === 'behavior' ? 'انضباط رفتاری' : note.type === 'uniform' ? 'پوشش و آراستگی' : 'سایر'}
                            </span>
                            {note.scoreDeduction && note.scoreDeduction > 0 ? (
                              <span className="bg-rose-100 text-rose-800 font-mono font-bold px-2 py-0.5 rounded-md text-[11px]">
                                کسر نمره: {toPersianDigits(note.scoreDeduction)} نمره
                              </span>
                            ) : null}
                          </div>

                          <p className="text-slate-600 leading-relaxed text-[11px] mt-0.5">
                            {note.description}
                          </p>

                          <div className="text-[10px] text-slate-400 pt-1">
                            ثبت شده توسط: {note.author || 'معاونت انضباطی'}
                          </div>
                        </div>
                      </div>

                      {onDeleteNote && (
                        <button
                          onClick={() => {
                            if (confirm('آیا از حذف این تذکر انضباطی اطمینان دارید؟')) {
                              onDeleteNote(student.id, note.id);
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                          title="حذف تذکر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Score Breakdown */}
          {activeTab === 'score' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-800">نمره نهایی انضباط فعلی:</div>
                  <div className="text-3xl font-black text-emerald-900 font-mono mt-1">
                    {toPersianDigits(currentDisciplineScore)} <span className="text-sm font-normal text-emerald-700">از ۲۰</span>
                  </div>
                </div>

                <div className="text-left font-mono text-xs text-slate-600">
                  <div>نمره پایه اولیه: ۲۰.۰۰</div>
                  <div className="text-rose-600">مجموع کسورات انضباطی: -{toPersianDigits(totalDeductions)}</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>محاسبه و شفاف‌سازی کسورات نمره انضباط:</span>
                </h4>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-slate-700">
                    <span>۱. نمره پایه انضباط در ابتدای سال تحصیلی</span>
                    <span className="font-bold font-mono text-emerald-700">+۲۰.۰۰</span>
                  </div>

                  {notes.filter(n => (n.scoreDeduction || 0) > 0).map((n, i) => (
                    <div key={n.id} className="flex items-center justify-between p-2 bg-rose-50/60 rounded-lg text-rose-900">
                      <div>
                        <span className="font-semibold">{n.title}</span>
                        <span className="text-[11px] text-slate-500 mr-2 font-mono">({n.date})</span>
                      </div>
                      <span className="font-bold font-mono text-rose-700">-{toPersianDigits(n.scoreDeduction || 0)}</span>
                    </div>
                  ))}

                  <div className="flex items-center justify-between p-2.5 bg-slate-900 text-white rounded-lg font-bold">
                    <span>نمره انضباط ثبت‌شده در کارنامه</span>
                    <span className="font-mono text-emerald-400 text-sm">{toPersianDigits(currentDisciplineScore)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 text-[11px]">
            سامانه پایش هوشمند انضباطی و تاخیرهای مدرسه یاوران ولایت
          </div>

          <div className="flex items-center gap-2">
            {onOpenSms && (
              <button
                onClick={() => onOpenSms(student)}
                className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
                <span>ارسال پیامک به ولی</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer"
            >
              بستن پنجره
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
