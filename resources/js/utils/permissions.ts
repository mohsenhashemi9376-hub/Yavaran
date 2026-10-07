import { User, UserRole } from '../types';

export interface PermissionGroup {
  id: string;
  label: string;
  items: { key: string; label: string }[];
}

/** ماتریس دسترسی‌ها؛ باید با app/Support/Permissions.php هماهنگ بماند */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'education',
    label: 'آموزش',
    items: [
      { key: 'manage-grades', label: 'ثبت نمرات مستمر' },
      { key: 'comprehensive-exam', label: 'آزمون جامع' },
      { key: 'report-cards', label: 'صدور کارنامه' },
      { key: 'analytics-reports', label: 'گزارشات تحلیلی' },
      { key: 'manage-curriculum', label: 'مدیریت برنامه دروس' },
      { key: 'manage-announcements', label: 'مدیریت بخشنامه‌ها و اطلاعیه‌ها' },
      { key: 'evaluate-teachers', label: 'ارزیابی اساتید' },
    ],
  },
  {
    id: 'attendance',
    label: 'حضور و غیاب',
    items: [
      { key: 'manage-attendance', label: 'ثبت جلسه حضور و غیاب' },
      { key: 'view-attendance-history', label: 'مشاهده تاریخچه تردد' },
    ],
  },
  {
    id: 'discipline',
    label: 'تربیتی',
    items: [
      { key: 'discipline', label: 'ثبت موارد انضباطی' },
      { key: 'counseling-report', label: 'ثبت گزارش مشاوره‌ای' },
      { key: 'view-nurturing-file', label: 'مشاهده پرونده تربیتی' },
      { key: 'manage-loans', label: 'امانات و لوازم' },
    ],
  },
  {
    id: 'base',
    label: 'پایه',
    items: [
      { key: 'view-students', label: 'مشاهده مشخصات دانش‌آموزان' },
      { key: 'view-guardians', label: 'مشاهده اطلاعات اولیا' },
      { key: 'manage-classes', label: 'مدیریت کلاس‌ها' },
      { key: 'school-settings', label: 'تنظیمات مدرسه' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const WITHOUT_SETTINGS = ALL_PERMISSION_KEYS.filter(
  (k) => !['school-settings', 'manage-announcements', 'evaluate-teachers'].includes(k)
);

export const TEACHER_DEFAULTS = [
  'manage-grades',
  'manage-attendance',
  'view-attendance-history',
  'view-students',
  'report-cards',
  'analytics-reports',
];

export function defaultPermissionsFor(role: UserRole | string): string[] {
  switch (role) {
    case 'admin':
    case 'vice_educational':
      return ALL_PERMISSION_KEYS;
    case 'vice_principal':
      return WITHOUT_SETTINGS;
    case 'vice_disciplinary':
      return ['manage-attendance', 'view-attendance-history', 'discipline', 'view-students', 'view-guardians', 'analytics-reports', 'manage-loans'];
    case 'vice_nurturing':
      return ['view-attendance-history', 'discipline', 'counseling-report', 'view-nurturing-file', 'view-students', 'view-guardians', 'analytics-reports'];
    case 'coach':
      return ['view-attendance-history', 'counseling-report', 'view-nurturing-file', 'view-students', 'analytics-reports'];
    case 'teacher':
      return TEACHER_DEFAULTS;
    default:
      return [];
  }
}

/** دسترسی‌های مؤثر کاربر (فهرست اختصاصی یا پیش‌فرض نقش؛ مدیر همیشه همه را دارد) */
export function effectivePermissions(user: Pick<User, 'role' | 'permissions' | 'isAlsoTeacher'>): string[] {
  if (user.role === 'admin') return ALL_PERMISSION_KEYS;
  if (Array.isArray(user.permissions)) return user.permissions.filter((k) => ALL_PERMISSION_KEYS.includes(k));
  const base = defaultPermissionsFor(user.role);
  return user.isAlsoTeacher && user.role !== 'teacher' ? Array.from(new Set([...base, ...TEACHER_DEFAULTS])) : base;
}

export function hasPermission(user: Pick<User, 'role' | 'permissions' | 'isAlsoTeacher'>, key: string): boolean {
  return effectivePermissions(user).includes(key);
}

/** آیتم‌های منو ← دسترسی‌های لازم (هر یک کافی است) */
export const NAV_ITEM_PERMISSIONS: Record<string, string[]> = {
  attendance: ['manage-attendance', 'view-attendance-history'],
  discipline: ['discipline'],
  loans: ['manage-loans'],
  students: ['view-students'],
  classes: ['manage-classes', 'view-students'],
  subjects: ['manage-curriculum'],
  grades: ['manage-grades'],
  comprehensive_exam: ['comprehensive-exam'],
  report_cards: ['report-cards'],
  reports: ['analytics-reports'],
  settings: ['school-settings'],
  announcements: ['manage-announcements'],
  teacher_evaluation: ['evaluate-teachers'],
  warnings: ['discipline', 'view-attendance-history'],
  observation: ['counseling-report', 'view-nurturing-file'],
  student_observations: ['counseling-report', 'view-nurturing-file'],
  dossier: ['view-nurturing-file'],
  coachEvaluations: ['counseling-report'],
};

/** آیا کاربر به این بخش (بر اساس شناسه آیتم منو) دسترسی دارد؟ */
export function canAccessSection(
  user: Pick<User, 'role' | 'permissions' | 'isAlsoTeacher'>,
  sectionId: unknown
): boolean {
  if (typeof sectionId !== 'string') return true;
  const needed = NAV_ITEM_PERMISSIONS[sectionId];
  if (!needed) return true;
  const mine = effectivePermissions(user);
  return needed.some((k) => mine.includes(k));
}

/** حذف آیتم‌های بدون دسترسی از گروه‌های منو (گروه‌های خالی هم حذف می‌شوند) */
export function filterNavGroups<G extends { items: { id?: unknown }[] }>(
  groups: G[],
  user: Pick<User, 'role' | 'permissions' | 'isAlsoTeacher'>,
  only?: string[]
): G[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => (only && !only.includes(String(it.id))) || canAccessSection(user, it.id)),
    }))
    .filter((g) => g.items.length > 0);
}
