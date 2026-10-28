import { DisciplinaryNote, StudentAcademicGrade } from '../types';
import { gradeScoreForMonth } from './monthlyReport';
import { getRealTodayShamsiString, shamsiStringToDate, toEnglishDigits } from './persianDate';

/** شرایط دریافت نشان‌ها؛ مدیر مدرسه آن‌ها را از تنظیمات تغییر می‌دهد (همان مقادیر پیش‌فرض سرور) */
export interface BadgeSettings {
  windowDays: number;
  discipline: { maxNotes: number; maxUnexcusedAbsences: number; maxLates: number; lateAfter: string };
  academic: { minScore: number; maxMissedWorksheets: number; maxMissedHomework: number };
}

export const DEFAULT_BADGE_SETTINGS: BadgeSettings = {
  windowDays: 30,
  discipline: { maxNotes: 0, maxUnexcusedAbsences: 0, maxLates: 0, lateAfter: '07:15' },
  academic: { minScore: 12, maxMissedWorksheets: 0, maxMissedHomework: 0 },
};

const DAY_MS = 86_400_000;

/** آیا تاریخ شمسی در بازهٔ ارزیابی (چند روز گذشته تا امروز) است؟ */
export const inBadgeWindow = (shamsiDate: string, windowDays: number, todayDate: Date = shamsiStringToDate(getRealTodayShamsiString())): boolean => {
  const diff = (todayDate.getTime() - shamsiStringToDate(toEnglishDigits(shamsiDate)).getTime()) / DAY_MS;
  return diff >= 0 && diff <= windowDays;
};

interface BadgeInput {
  notes: DisciplinaryNote[];
  /** غیبت‌های غیرموجه (تاریخ هر مورد) */
  unexcusedAbsenceDates: string[];
  /** تأخیرهای ورود؛ time اگر معلوم باشد با ساعت مجاز مقایسه می‌شود، وگرنه تأخیر شمرده می‌شود */
  lates: { date: string; time?: string }[];
  /** کاربرگ هفته‌های اخیر: تحویل‌شده یا نه */
  worksheetWeeks: { weekStart: string; delivered: boolean }[];
  /** وضعیت تکلیف جلسه‌های کلاسی */
  homework: { date: string; status?: 'done' | 'incomplete' | 'not_done' }[];
  grades: StudentAcademicGrade[];
}

export interface StudentBadgeResult {
  discipline: boolean;
  academic: boolean;
}

const clock = (t: string) => toEnglishDigits(t || '').trim();

/**
 * نشان‌های انگیزشی پرونده (بازه و حدها از تنظیمات مدیر):
 * - ممتاز انضباطی: مورد انضباطی، غیبت غیرموجه و تأخیر بعد از ساعت مجاز، حداکثر به اندازهٔ حد تعیین‌شده.
 * - ممتاز آموزشی: کاربرگ و تکلیف ازدست‌رفته از حد بیشتر نباشد (و حداقل یک مورد ثبت شده)،
 *   و میانگین همهٔ دروس دارای نمره بالاتر از حداقل نمره باشد.
 */
export const computeStudentBadges = (input: BadgeInput, settings: BadgeSettings = DEFAULT_BADGE_SETTINGS): StudentBadgeResult => {
  const today = shamsiStringToDate(getRealTodayShamsiString());
  const within = (d: string) => inBadgeWindow(d, settings.windowDays, today);
  const d = settings.discipline;
  const a = settings.academic;

  const notes = input.notes.filter((n) => within(n.date)).length;
  const absences = input.unexcusedAbsenceDates.filter(within).length;
  const lates = input.lates.filter((l) => within(l.date) && (!l.time || clock(l.time) > d.lateAfter)).length;
  const discipline = notes <= d.maxNotes && absences <= d.maxUnexcusedAbsences && lates <= d.maxLates;

  const weeks = input.worksheetWeeks.filter((w) => within(w.weekStart));
  const homework = input.homework.filter((h) => within(h.date) && h.status);
  const missedWorksheets = weeks.filter((w) => !w.delivered).length;
  const missedHomework = homework.filter((h) => h.status === 'not_done').length;
  const hasEvidence = weeks.length > 0 || homework.length > 0;

  const scores = input.grades
    .map((g) => gradeScoreForMonth(g, 'all'))
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  const goodGrades = scores.length > 0 && scores.every((v) => v > a.minScore);

  return { discipline, academic: missedWorksheets <= a.maxMissedWorksheets && missedHomework <= a.maxMissedHomework && hasEvidence && goodGrades };
};

/** متن دلیل دریافت نشان، بر اساس شرایط فعلی */
export const badgeReason = (key: 'discipline' | 'academic', s: BadgeSettings): string => {
  const days = s.windowDays;
  if (key === 'discipline') {
    const d = s.discipline;
    const none = d.maxNotes === 0 && d.maxUnexcusedAbsences === 0 && d.maxLates === 0;
    return none
      ? `کسب این نشان به دلیل نداشتن مورد انضباطی، غیبت غیرموجه و تأخیر (بعد از ${d.lateAfter}) در ${days} روز گذشته است.`
      : `کسب این نشان به دلیل حداکثر ${d.maxNotes} مورد انضباطی، ${d.maxUnexcusedAbsences} غیبت غیرموجه و ${d.maxLates} تأخیر (بعد از ${d.lateAfter}) در ${days} روز گذشته است.`;
  }
  const a = s.academic;
  const strict = a.maxMissedWorksheets === 0 && a.maxMissedHomework === 0;
  return strict
    ? `کسب این نشان به دلیل تحویل منظم کاربرگ‌ها و تکالیف، و کسب نمرات بالاتر از ${a.minScore} در ${days} روز گذشته است.`
    : `کسب این نشان به دلیل حداکثر ${a.maxMissedWorksheets} کاربرگ و ${a.maxMissedHomework} تکلیف تحویل‌نشده، و کسب نمرات بالاتر از ${a.minScore} در ${days} روز گذشته است.`;
};
