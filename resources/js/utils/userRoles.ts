import { User, UserRole } from '../types';

export interface UserGreetingInfo {
  greeting: string;
  roleLabel: string;
  shortRole: string;
  roleDescription: string;
  hasName: boolean;
  isLoading?: boolean;
}

/**
 * نگاشت نقش به عنوان رسمی، یکتا و استاندارد فارسی
 * جلوگیری کامل از ترکیب نقش‌ها مانند «معاون و مدیر» یا «مدیر / معاون»
 */
export function getStandardRoleTitle(role?: UserRole | string, subject?: string): string {
  switch (role) {
    case 'admin':
      return 'مدیر مدرسه';
    case 'vice_educational':
      return 'معاون آموزشی';
    case 'vice_disciplinary':
      return 'معاون انضباطی';
    case 'vice_nurturing':
      return 'معاون تربیتی';
    case 'vice_principal':
      return 'معاون مدرسه';
    case 'coach':
      return 'مربی تربیتی';
    case 'teacher':
      return subject ? `دبیر ${subject}` : 'معلم مدرسه';
    default:
      return 'کاربر سامانه';
  }
}

/**
 * عنوان کوتاه و طبیعی هر نقش (جهت استفاده در بج‌ها و فضاهای کوچک)
 */
export function getShortRoleTitle(role?: UserRole | string): string {
  switch (role) {
    case 'admin':
      return 'مدیر';
    case 'vice_educational':
    case 'vice_disciplinary':
    case 'vice_nurturing':
    case 'vice_principal':
      return 'معاون';
    case 'coach':
      return 'مربی';
    case 'teacher':
      return 'معلم';
    default:
      return 'کاربر';
  }
}

/**
 * عبارت احترام‌آمیز کوتاه در صورتی که نام کاربر در سیستم موجود نباشد
 */
export function getRolePoliteGreeting(role?: UserRole | string): string {
  switch (role) {
    case 'admin':
      return 'سلام، مدیر محترم';
    case 'vice_educational':
    case 'vice_disciplinary':
    case 'vice_nurturing':
    case 'vice_principal':
      return 'سلام، معاون محترم';
    case 'coach':
      return 'سلام، مربی محترم';
    case 'teacher':
      return 'سلام، معلم محترم';
    default:
      return 'سلام، کاربر محترم';
  }
}

/**
 * شرح مختصر و طبیعی مسئولیت‌های هر نقش در پیشخوان
 */
export function getRoleDashboardDescription(role?: UserRole | string): string {
  switch (role) {
    case 'admin':
      return 'مدیریت کلان، وضعیت روز جاری و نظارت جامع بر کلیه ارکان و شاخص‌های مدرسه در یک نگاه.';
    case 'vice_educational':
      return 'امور آموزشی، برنامه کلاسی، حضور و غیاب زنگ‌ها و ارزیابی نمرات مستمر در یک نگاه.';
    case 'vice_disciplinary':
      return 'انضباط عمومی، پیگیری تأخیرهای صبحگاهی، غیبت‌ها و هشدارهای انضباطی در یک نگاه.';
    case 'vice_nurturing':
      return 'امور پرورشی، حلقه‌های تربیتی و پرونده‌های پایش رشد اخلاقی و رفتاری در یک نگاه.';
    case 'vice_principal':
      return 'امور اجرایی، وضعیت عمومی روز جاری و پیگیری فرآیندهای مدرسه در یک نگاه.';
    case 'coach':
      return 'دانش‌آموزان حلقه صالحین تحت مسئولیت، ارزیابی رشد و جلسات مشاوره‌ای.';
    case 'teacher':
      return 'کلاس‌های تدریس، ثبت جلسات درسی و نمرات مستمر ماهانه دانش‌آموزان.';
    default:
      return 'وضعیت روز جاری و هشدارهای نیازمند پیگیری در یک نگاه.';
  }
}

/**
 * تولید شیء کامل و شخصی‌سازی‌شده خوشامدگویی کاربر بر اساس نقش واقعی و نام وی
 * کاملاً ایمن در حالت‌های Loading، فقدان نام یا خطای نقش
 */
export function getUserGreeting(user?: User | null, isLoading = false): UserGreetingInfo {
  if (isLoading || !user) {
    return {
      greeting: isLoading ? 'سلام، ...' : 'سلام، کاربر محترم',
      roleLabel: isLoading ? 'در حال بارگذاری...' : 'کاربر سامانه',
      shortRole: 'کاربر',
      roleDescription: 'در حال بارگذاری اطلاعات حساب کاربری...',
      hasName: false,
      isLoading,
    };
  }

  const role = user.role;
  const standardRole = getStandardRoleTitle(role, user.subject);
  const shortRole = getShortRoleTitle(role);
  const cleanName = user.name?.trim();

  // پاکسازی هرگونه عنوان ترکیبی احتمالی در داده‌های قبلی
  let cleanRoleLabel = standardRole;
  if (user.role === 'coach' && user.isAlsoTeacher) {
    cleanRoleLabel = user.teachingSubject ? `مربی و معلم ${user.teachingSubject}` : 'مربی و معلم';
  } else if (user.roleTitle) {
    const sanitized = user.roleTitle
      .replace(/مدیر\s*(و|\/)\s*معاون(ت)?/g, 'مدیر')
      .replace(/معاون(ت)?\s*(و|\/)\s*مدیر(یت)?/g, 'معاون')
      .trim();
    if (sanitized && !sanitized.includes('و مدیر') && !sanitized.includes('و معاون')) {
      cleanRoleLabel = sanitized;
    }
  }

  const greeting = cleanName ? `سلام، ${cleanName}` : getRolePoliteGreeting(role);

  return {
    greeting,
    roleLabel: cleanRoleLabel,
    shortRole,
    roleDescription: getRoleDashboardDescription(role),
    hasName: Boolean(cleanName),
    isLoading: false,
  };
}
