import {
  AttendanceSession,
  ComprehensiveExamRecord,
  MorningAttendanceRecord,
  MorningDelayRecord,
  SchoolAbsenceRecord,
  Student,
  StudentAcademicGrade,
  WorksheetRecord,
  WorksheetWeek,
} from '../types';
import { buildAttendanceStats } from './attendanceStats';
import { analyzeClassExam, CONTINUOUS_MONTHS, SCORE_COLUMNS, mean, studentExamTimeline } from './examReport';
import { isDeadlinePassed, worksheetKey } from './worksheets';

const num = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);

export interface FullReportSubjectRow {
  subjectId: string;
  subjectName: string;
  months: { key: string; label: string; score?: number }[];
  avg?: number;
}

export interface StudentFullReport {
  subjects: FullReportSubjectRow[];
  continuousAvg?: number;
  /** میانگین مستمر همه‌ی دانش‌آموزان کلاس در ماه‌های ثبت‌شده (برای نمودار مقایسه) */
  monthlyTrend: { label: string; student?: number; classAvg?: number; exam?: number }[];
  exam: { avg?: number; rank?: number; ranked: number; classAvg?: number };
  attendance: { unexcusedAbsences: number; excusedAbsences: number; delayCount: number; delayMinutes: number };
  homework: { done: number; incomplete: number; notDone: number };
  worksheets: { complete: number; partial: number; absent: number; missing: number; weeks: number };
  classWarnings: number;
  disciplineScore?: number;
}

export interface FullReportInput {
  student: Student;
  classStudents: Student[];
  grades: StudentAcademicGrade[];
  exam?: ComprehensiveExamRecord;
  sessions: AttendanceSession[];
  morningDelays: MorningDelayRecord[];
  morningAttendance: MorningAttendanceRecord[];
  schoolAbsences: SchoolAbsenceRecord[];
  worksheets: WorksheetRecord[];
  worksheetWeeks: WorksheetWeek[];
}

export function buildStudentFullReport(i: FullReportInput): StudentFullReport {
  const { student } = i;
  const classIds = new Set(i.classStudents.map((s) => s.id));

  const own = i.grades.filter((g) => g.studentId === student.id);
  const subjects: FullReportSubjectRow[] = own.map((g) => {
    const months = SCORE_COLUMNS.map((p) => ({ key: p.key, label: p.monthName, score: num(g[p.key]) ? (g[p.key] as number) : undefined }));
    return { subjectId: g.subjectId, subjectName: g.subjectName, months, avg: mean(months.map((m) => m.score).filter(num)) };
  });
  const continuousAvg = mean(subjects.map((s) => s.avg).filter(num));

  const timeline = studentExamTimeline(i.exam, i.classStudents, student.id);
  const monthlyTrend = CONTINUOUS_MONTHS.map((p) => {
    const mine = own.map((g) => g[p.key]).filter(num);
    const everyone = i.grades.filter((g) => classIds.has(g.studentId)).map((g) => g[p.key]).filter(num);
    return {
      label: p.monthName,
      student: mean(mine),
      classAvg: mean(everyone),
      exam: timeline.find((t) => t.month === p.key)?.avg,
    };
  }).filter((m) => m.student !== undefined || m.exam !== undefined);

  const analysis = analyzeClassExam(i.exam, i.classStudents, 'all');
  const row = analysis.rows.find((r) => r.student.id === student.id);

  const stat = buildAttendanceStats([student], { morningDelays: i.morningDelays, morningAttendance: i.morningAttendance, schoolAbsences: i.schoolAbsences, sessions: i.sessions }, { monthKey: '', period: 'all' })[0];

  const homework = { done: 0, incomplete: 0, notDone: 0 };
  i.sessions.forEach((s) => {
    const h = s.records?.[student.id]?.homeworkStatus;
    if (h === 'done') homework.done++;
    else if (h === 'incomplete') homework.incomplete++;
    else if (h === 'not_done') homework.notDone++;
  });

  const byKey = new Map(i.worksheets.map((r) => [worksheetKey(r.studentId, r.weekStart), r]));
  const ws = { complete: 0, partial: 0, absent: 0, missing: 0, weeks: 0 };
  i.worksheetWeeks
    .filter((w) => isDeadlinePassed(w.deadline))
    .forEach((w) => {
      const any = i.classStudents.some((s) => {
        const r = byKey.get(worksheetKey(s.id, w.weekStart));
        return r && r.status !== 'none';
      });
      if (!any) return;
      const r = byKey.get(worksheetKey(student.id, w.weekStart));
      ws.weeks++;
      if (!r || r.status === 'none') ws.missing++;
      else ws[r.status]++;
    });

  return {
    subjects,
    continuousAvg,
    monthlyTrend,
    exam: { avg: row?.avg, rank: row?.rank, ranked: analysis.rows.filter((r) => r.avg !== undefined).length, classAvg: analysis.classAverage },
    attendance: { unexcusedAbsences: stat.unexcusedAbsences, excusedAbsences: stat.excusedAbsences, delayCount: stat.delayCount, delayMinutes: stat.delayMinutes },
    homework,
    worksheets: ws,
    classWarnings: (student.disciplinaryNotes || []).filter((n) => n.source === 'class_warning').length,
    disciplineScore: student.disciplineScore ?? student.disciplinaryScore,
  };
}
