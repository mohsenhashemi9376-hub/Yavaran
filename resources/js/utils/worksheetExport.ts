import * as XLSX from 'xlsx';
import { SchoolClass, Student, WorksheetRecord, WorksheetWeek } from '../types';
import { isDeadlinePassed, weekTitle, worksheetKey } from './worksheets';
import { studentFullName } from './studentName';

type Row = Record<string, string | number>;

const STATUS_CELL = {
  complete: '✔ کامل',
  partial: '◐ ناقص',
  absent: 'غایب',
  missing: '✖ تحویل نداده',
} as const;

/** نام شیت اکسل: حداکثر ۳۱ نویسه، بدون نویسه‌های ممنوع، بدون تکرار */
export const uniqueSheetName = (name: string, used: Set<string>): string => {
  const base = (name || 'کلاس').replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'کلاس';
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) candidate = `${base} ${i++}`;
  used.add(candidate);
  return candidate;
};

const sortedStudents = (students: Student[], classId: string): Student[] =>
  students.filter((s) => s.classId === classId).sort((a, b) => studentFullName(a).localeCompare(studentFullName(b), 'fa'));

/** ردیف‌های یک کلاس در یک هفته */
export const buildWeekRows = (students: Student[], records: Map<string, WorksheetRecord>, classId: string, weekStart: string): Row[] =>
  sortedStudents(students, classId).map((s, i) => {
    const r = records.get(worksheetKey(s.id, weekStart));
    return {
      'ردیف': i + 1,
      'نام و نام خانوادگی': studentFullName(s),
      'وضعیت کاربرگ': r ? STATUS_CELL[r.status] : STATUS_CELL.missing,
      'یادداشت': r?.note || '',
      'ثبت‌کننده': r?.recordedBy || '',
    };
  });

/** هفته‌های مورد گزارش ترمی: مهلت‌گذشته‌ها + هفته‌هایی که برای کلاس‌ها رکورد دارند (قدیمی‌ترین اول) */
export const termWeeks = (weeks: WorksheetWeek[], worksheets: WorksheetRecord[], classIds: Set<string>): string[] => {
  const set = new Set<string>();
  weeks.forEach((w) => w.deadline && isDeadlinePassed(w.deadline) && set.add(w.weekStart));
  worksheets.forEach((r) => classIds.has(r.classId) && set.add(r.weekStart));
  return Array.from(set).sort();
};

/** ماتریس ترمی یک کلاس: ردیف = دانش‌آموز، ستون = هفته؛ جمع و درصد تحویل کامل (غایب‌ها حذف می‌شوند) */
export const buildTermMatrix = (students: Student[], records: Map<string, WorksheetRecord>, classId: string, weekStarts: string[]): Row[] =>
  sortedStudents(students, classId).map((s, i) => {
    const row: Row = { 'ردیف': i + 1, 'نام و نام خانوادگی': studentFullName(s) };
    let complete = 0;
    let partial = 0;
    let missing = 0;
    let absent = 0;
    weekStarts.forEach((w) => {
      const r = records.get(worksheetKey(s.id, w));
      const status = r?.status ?? 'missing';
      row[`هفته ${weekTitle(w)}`] = STATUS_CELL[status];
      if (status === 'complete') complete++;
      else if (status === 'partial') partial++;
      else if (status === 'absent') absent++;
      else missing++;
    });
    const counted = complete + partial + missing;
    row['کامل'] = complete;
    row['ناقص'] = partial;
    row['تحویل نداده'] = missing;
    row['غایب'] = absent;
    row['درصد تحویل کامل'] = counted ? `${Math.round((complete / counted) * 100)}٪` : '—';

    return row;
  });

interface ExportInput {
  students: Student[];
  classes: SchoolClass[];
  worksheets: WorksheetRecord[];
  worksheetWeeks: WorksheetWeek[];
}

const download = (wb: XLSX.WorkBook, fileName: string) => XLSX.writeFile(wb, fileName);

const withRtl = (sheet: XLSX.WorkSheet): XLSX.WorkSheet => {
  (sheet as XLSX.WorkSheet & { '!views'?: unknown })['!views'] = [{ RTL: true }];

  return sheet;
};

/** گزارش یک هفته: یک شیت برای هر کلاس + خلاصه‌ی کلاس‌ها */
export const exportWorksheetWeekExcel = ({ students, classes, worksheets }: ExportInput, weekStart: string): void => {
  const records = new Map(worksheets.map((r) => [r.id, r]));
  const wb = XLSX.utils.book_new();
  const used = new Set<string>(['خلاصه']);
  const summary: Row[] = [];

  classes.forEach((c) => {
    const rows = buildWeekRows(students, records, c.id, weekStart);
    if (rows.length === 0) return;
    const count = (label: string) => rows.filter((r) => r['وضعیت کاربرگ'] === label).length;
    summary.push({
      'کلاس': c.name,
      'تعداد دانش‌آموز': rows.length,
      'کامل': count(STATUS_CELL.complete),
      'ناقص': count(STATUS_CELL.partial),
      'غایب': count(STATUS_CELL.absent),
      'تحویل نداده': count(STATUS_CELL.missing),
    });
    XLSX.utils.book_append_sheet(wb, withRtl(XLSX.utils.json_to_sheet(rows)), uniqueSheetName(c.name, used));
  });

  if (summary.length === 0) summary.push({ 'اطلاعات': 'دانش‌آموزی یافت نشد' });
  XLSX.utils.book_append_sheet(wb, withRtl(XLSX.utils.json_to_sheet(summary)), 'خلاصه');
  wb.SheetNames.unshift(wb.SheetNames.pop() as string); // خلاصه اولین شیت باشد
  download(wb, `کاربرگ_هفته_${weekStart.replace(/\//g, '-')}.xlsx`);
};

/** گزارش ترمی (همه‌ی هفته‌ها): یک ماتریس برای هر کلاس + خلاصه‌ی درصد تحویل کلاس‌ها */
export const exportWorksheetTermExcel = ({ students, classes, worksheets, worksheetWeeks }: ExportInput): void => {
  const records = new Map(worksheets.map((r) => [r.id, r]));
  const weekStarts = termWeeks(worksheetWeeks, worksheets, new Set(classes.map((c) => c.id)));
  const wb = XLSX.utils.book_new();
  const used = new Set<string>(['خلاصه']);
  const summary: Row[] = [];

  classes.forEach((c) => {
    const rows = buildTermMatrix(students, records, c.id, weekStarts);
    if (rows.length === 0) return;
    const avg = rows
      .map((r) => parseInt(String(r['درصد تحویل کامل']), 10))
      .filter((n) => !Number.isNaN(n));
    summary.push({
      'کلاس': c.name,
      'تعداد دانش‌آموز': rows.length,
      'تعداد هفته': weekStarts.length,
      'میانگین درصد تحویل کامل': avg.length ? `${Math.round(avg.reduce((a, b) => a + b, 0) / avg.length)}٪` : '—',
    });
    XLSX.utils.book_append_sheet(wb, withRtl(XLSX.utils.json_to_sheet(rows)), uniqueSheetName(c.name, used));
  });

  if (summary.length === 0) summary.push({ 'اطلاعات': 'سابقه‌ای ثبت نشده است' });
  XLSX.utils.book_append_sheet(wb, withRtl(XLSX.utils.json_to_sheet(summary)), 'خلاصه');
  wb.SheetNames.unshift(wb.SheetNames.pop() as string); // خلاصه اولین شیت باشد
  download(wb, 'کاربرگ_گزارش_ترمی.xlsx');
};

