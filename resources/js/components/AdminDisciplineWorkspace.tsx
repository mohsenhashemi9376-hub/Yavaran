import React, { useState } from 'react';
import { Student, SchoolClass, DisciplinaryNote } from '../types';
import { toPersianDigits, getTodayShamsi, formatShamsiWithWeekday, toEnglishDigits } from '../utils/persianDate';
import { 
  ShieldAlert, 
  Search, 
  Plus, 
  ChevronLeft, 
  Menu, 
  FileSpreadsheet, 
  Trash2, 
  Eye, 
  AlertTriangle, 
  FileText,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { studentFullName } from '../utils/studentName';

interface FlatDisciplineItem {
  noteId: string;
  student: Student;
  className: string;
  date: string;
  title: string;
  description: string;
  type: string;
  category: DisciplineCategory;
  scoreDeduction?: number;
  recordedBy?: string;
}

/** دسته‌بندی مورد انضباطی: تذکر (بدون کسر نمره) یا اخطار / کسر نمره */
type DisciplineCategory = 'warning' | 'penalty';

const categoryOf = (note: Pick<DisciplinaryNote, 'title' | 'description' | 'scoreDeduction'>): DisciplineCategory => {
  if ((note.scoreDeduction || 0) > 0) return 'penalty';
  return /اخطار|کسر/.test(`${note.title || ''} ${note.description || ''}`) ? 'penalty' : 'warning';
};

interface AdminDisciplineWorkspaceProps {
  students: Student[];
  classes: SchoolClass[];
  onBack: () => void;
  onOpenSidebar: () => void;
  onOpenAddDiscipline?: () => void;
  onOpenAddNote?: () => void;
  onSelectStudent?: (student: Student) => void;
  onDeleteDisciplinaryNote?: (studentId: string, noteId: string) => void;
  onDeleteNote?: (studentId: string, noteId: string) => void;
  onUpdateScore?: (studentId: string, score: number) => void;
}

export const AdminDisciplineWorkspace: React.FC<AdminDisciplineWorkspaceProps> = ({
  students,
  classes,
  onBack,
  onOpenSidebar,
  onOpenAddDiscipline,
  onOpenAddNote,
  onSelectStudent,
  onDeleteDisciplinaryNote,
  onDeleteNote,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const handleOpenAdd = onOpenAddDiscipline || onOpenAddNote;
  const handleDeleteNote = onDeleteDisciplinaryNote || onDeleteNote;

  const todayInfo = getTodayShamsi();

  // Flatten all discipline notes from single source of truth (student.disciplinaryNotes)
  const allNotes: FlatDisciplineItem[] = [];
  (students || []).forEach((student) => {
    const cls = classes.find((c) => c.id === student.classId);
    const notes = (student.disciplinaryNotes || (student as any).disciplineNotes || []) as DisciplinaryNote[];
    notes.forEach((note) => {
      allNotes.push({
        noteId: note.id,
        student,
        className: cls?.name || 'کلاس نامشخص',
        date: note.date,
        title: note.title,
        description: note.description,
        type: note.type,
        category: categoryOf(note),
        scoreDeduction: note.scoreDeduction || 0,
        recordedBy: note.recordedBy,
      });
    });
  });

  allNotes.sort((a, b) => toEnglishDigits(b.date).localeCompare(toEnglishDigits(a.date)));

  // Stats
  const warningCount = allNotes.filter((n) => n.category === 'warning').length;
  const penaltyCount = allNotes.filter((n) => n.category === 'penalty').length;

  // Filtered
  const filteredNotes = allNotes.filter((note) => {
    if (classFilter && note.student.classId !== classFilter) {
      return false;
    }

    if (typeFilter !== 'all' && note.category !== typeFilter) {
      return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const studentName = `${studentFullName(note.student)}`.toLowerCase();
      const matchesName = studentName.includes(q);
      const matchesTitle = note.title.toLowerCase().includes(q);
      const matchesDesc = note.description.toLowerCase().includes(q);
      const matchesClass = note.className.toLowerCase().includes(q);
      if (!matchesName && !matchesTitle && !matchesDesc && !matchesClass) {
        return false;
      }
    }

    return true;
  });

  const exportDisciplineToExcel = () => {
    const rows = filteredNotes.map((n, idx) => ({
      'ردیف': idx + 1,
      'دانش‌آموز': `${studentFullName(n.student)}`,
      'کلاس': n.className,
      'تاریخ': n.date,
      'نوع مورد': n.category === 'penalty' ? 'اخطار / کسر نمره' : 'تذکر انضباطی',
      'کسر نمره': n.scoreDeduction || 0,
      'عنوان': n.title,
      'توضیحات': n.description,
      'ثبت‌کننده': n.recordedBy || 'معاونت انضباطی',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'موارد_انضباطی');
    XLSX.writeFile(wb, `Disciplinary_Notes_${todayInfo.formattedDate}.xlsx`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* 1. Header ساختار یکسان */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <span>پیشخوان اصلی</span>
              <span>/</span>
              <span className="text-teal-800">موارد انضباطی</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-teal-800" />
              <span>ثبت و مدیریت موارد انضباطی</span>
              <span className="text-xs font-bold bg-teal-50 text-teal-800 px-2.5 py-1 rounded-full border border-teal-200">
                {toPersianDigits(allNotes.length)} مورد ثبت‌شده
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              ثبت تذکرات شفاهی، تذکرات کتبی، اخطارها و کسر نمره در پرونده انضباطی.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {handleOpenAdd && (
              <button
                onClick={handleOpenAdd}
                className="px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت مورد انضباطی جدید</span>
              </button>
            )}

            <button
              onClick={exportDisciplineToExcel}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              title="خروجی اکسل موارد انضباطی"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>خروجی اکسل</span>
            </button>

            <button
              onClick={onOpenSidebar}
              className="lg:hidden px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-slate-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-700"
              title="باز کردن نوار کناری"
              aria-label="باز کردن نوار کناری"
            >
              <Menu className="w-4 h-4 text-slate-700" />
              <span>منو</span>
            </button>

            <button
              onClick={onBack}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>بازگشت به داشبورد</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* کارت‌های آماری تعاملی (فیلتر نوع مورد) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {([
            ['warning', 'تذکرات انضباطی', warningCount, 'تذکر', AlertTriangle, 'bg-amber-50/80 border-amber-200/90 text-amber-900 ring-amber-300'],
            ['penalty', 'اخطارها و کسر نمره', penaltyCount, 'مورد', ShieldAlert, 'bg-rose-50/80 border-rose-200/90 text-rose-900 ring-rose-300'],
            ['all', 'کل موارد ثبت‌شده', allNotes.length, 'مورد', FileText, 'bg-slate-50 border-slate-200 text-slate-800 ring-slate-300'],
          ] as const).map(([key, label, count, unit, Icon, cls]) => {
            const active = typeFilter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setTypeFilter(active && key !== 'all' ? 'all' : key)}
                className={`p-3.5 rounded-2xl border text-right flex items-center justify-between transition cursor-pointer hover:shadow-sm ${cls} ${
                  active ? 'ring-2 ring-offset-1 shadow-sm' : ''
                }`}
              >
                <div>
                  <div className="text-xs font-bold opacity-80">{label}</div>
                  <div className="text-xl font-black mt-0.5">
                    {toPersianDigits(count)} <span className="text-xs font-normal opacity-70">{unit}</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="جستجو در نام دانش‌آموز یا شرح مورد..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition"
            />
          </div>

          <div>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="">تمام کلاس‌ها ({toPersianDigits(classes.length)} کلاس)</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-700 transition cursor-pointer"
            >
              <option value="all">تمام انواع موارد</option>
              <option value="warning">تذکر شفاهی / کتبی</option>
              <option value="penalty">اخطار و کسر نمره انضباط</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. بدنه: جدول کامل موارد انضباطی */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <ShieldAlert className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-xs font-bold text-slate-600">هیچ مورد انضباطی با این مشخصات ثبت نشده است.</p>
            <p className="text-[11px] text-slate-400">می‌توانید با دکمه «ثبت مورد انضباطی جدید» اقدام فرمایید.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5 w-12 text-center">ردیف</th>
                  <th className="p-3.5">دانش‌آموز</th>
                  <th className="p-3.5">کلاس</th>
                  <th className="p-3.5 text-center whitespace-nowrap">تاریخ ثبت</th>
                  <th className="p-3.5 text-center">نوع مورد</th>
                  <th className="p-3.5">عنوان و شرح</th>
                  <th className="p-3.5 text-center">ثبت‌کننده</th>
                  <th className="p-3.5 text-center w-32">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNotes.map((item, idx) => {
                  return (
                    <tr key={item.noteId} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 text-center font-bold text-slate-400">
                        {toPersianDigits(idx + 1)}
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">
                          {studentFullName(item.student)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          نمره انضباط فعلی: {toPersianDigits(item.student.disciplineScore ?? 20)}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="font-bold text-slate-800">
                          {item.className}
                        </span>
                      </td>

                      <td className="p-3.5 text-center text-slate-700 font-bold whitespace-nowrap">
                        {formatShamsiWithWeekday(item.date)}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {item.category === 'penalty' ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap">
                              اخطار / کسر نمره
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                              تذکر
                            </span>
                          )}

                          {item.scoreDeduction && item.scoreDeduction > 0 ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100/70 border border-rose-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                              {toPersianDigits(item.scoreDeduction)} نمره کسر
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-normal min-w-[220px]">
                        <div className="font-bold text-slate-900">{item.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 max-w-sm whitespace-normal">
                          {item.description}
                        </div>
                      </td>

                      <td className="p-3.5 text-center text-slate-500">
                        {item.recordedBy || 'معاونت'}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectStudent && onSelectStudent(item.student)}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-800 hover:text-white text-teal-900 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer border border-teal-200"
                            title="مشاهده کارنامه و پرونده کامل"
                          >
                            <Eye className="w-3 h-3" />
                            <span>پرونده</span>
                          </button>

                          {handleDeleteNote && (
                            <button
                              type="button"
                              onClick={() => {
                                handleDeleteNote(item.student.id, item.noteId);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="حذف این مورد"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. Footer ساختار یکسان */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <div>
            نمایش <span className="font-bold text-slate-800">{toPersianDigits(filteredNotes.length)}</span> از{' '}
            <span className="font-bold text-slate-800">{toPersianDigits(allNotes.length)}</span> مورد انضباطی
          </div>
          <div className="text-[11px] text-slate-400">
            تمام موارد در سوابق تحصیلی و انضباطی رسمی دانش‌آموز بایگانی می‌گردد.
          </div>
        </div>
      </div>

    </div>
  );
};
