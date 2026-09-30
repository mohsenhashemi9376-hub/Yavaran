// خروجی گرفتن از داده‌های اولیه فرانت‌اند به JSON (برای ساخت database.sql)
import * as seed from '../../resources/js/utils/sampleData';

const out = {
  users: seed.INITIAL_USERS,
  classes: seed.INITIAL_CLASSES,
  bellPeriods: seed.INITIAL_BELL_PERIODS,
  students: seed.INITIAL_STUDENTS,
  sessions: seed.INITIAL_SESSIONS,
  academicSubjects: seed.INITIAL_ACADEMIC_SUBJECTS,
  academicGrades: seed.INITIAL_ACADEMIC_GRADES,
  morningDelays: seed.INITIAL_MORNING_DELAYS,
  schoolAbsences: seed.INITIAL_SCHOOL_ABSENCES,
  observations: seed.INITIAL_OBSERVATIONS,
  nurturingDossiers: Object.keys(seed.INITIAL_NURTURING_DOSSIERS).map((k) => ({ ...seed.INITIAL_NURTURING_DOSSIERS[k], id: k })),
  coachEvaluations: seed.INITIAL_COACH_EVALUATIONS,
  teacherEvaluations: seed.INITIAL_TEACHER_EVALUATIONS,
  schoolAnnouncements: seed.INITIAL_SCHOOL_ANNOUNCEMENTS,
  grades: seed.INITIAL_SCHOOL_GRADES,
  settings: [{ ...seed.INITIAL_SCHOOL_SETTINGS, id: 'default' }],
};
process.stdout.write(JSON.stringify(out));
