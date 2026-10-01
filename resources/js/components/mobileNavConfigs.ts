import {
  LayoutDashboard, CheckCircle2, ShieldAlert, Users, GraduationCap, UserCheck, HeartHandshake,
  BookOpen, FileSpreadsheet, AlertTriangle, Settings, Award, FileText, Eye, FolderOpen,
  BarChart3, MessageSquare, School, ClipboardCheck, Star,
} from 'lucide-react';
import type { MobileNavItem } from './MobileBottomNav';

/** شناسه تب «داشبورد» (معادل null در پنل‌های مدیریتی) */
export const HOME = 'home';

/** پنل مدیر مدرسه / معاونین (AdminDashboard) */
export const adminMobileNav = (role: string, isAdmin: boolean, counts: { warnings: number }) => {
  const can = (roles: string[]) => isAdmin || roles.includes(role);
  const primary: MobileNavItem[] = [
    { id: HOME, label: 'داشبورد', icon: LayoutDashboard },
    { id: 'classes', label: 'کلاس‌ها', icon: GraduationCap },
    ...(can(['principal', 'vice_disciplinary', 'vice_educational', 'vice_principal'])
      ? [{ id: 'attendance', label: 'حضور و غیاب', icon: CheckCircle2 }] : []),
    { id: 'students', label: 'دانش‌آموزان', icon: Users },
  ];
  const more: MobileNavItem[] = [
    ...(can(['principal', 'vice_disciplinary', 'vice_nurturing', 'coach', 'vice_principal'])
      ? [{ id: 'discipline', label: 'انضباطی', icon: ShieldAlert }] : []),
    ...(can(['principal', 'vice_educational', 'vice_principal'])
      ? [{ id: 'teachers', label: 'معلمان', icon: UserCheck }, { id: 'subjects', label: 'برنامه دروس', icon: BookOpen }] : []),
    ...(can(['principal', 'vice_nurturing', 'coach', 'vice_principal'])
      ? [{ id: 'coaches', label: 'مربیان', icon: HeartHandshake }] : []),
    { id: 'warnings', label: 'هشدارها', icon: AlertTriangle, badge: counts.warnings },
    { id: 'reports', label: 'گزارش‌ها', icon: FileSpreadsheet },
    { id: 'settings', label: 'تنظیمات', icon: Settings },
  ];
  return { primary, more };
};

export const executiveMobileNav = (counts: { warnings: number }) => ({
  primary: [
    { id: HOME, label: 'داشبورد', icon: LayoutDashboard },
    { id: 'attendance', label: 'حضور و غیاب', icon: CheckCircle2 },
    { id: 'discipline', label: 'انضباطی', icon: ShieldAlert },
    { id: 'students', label: 'دانش‌آموزان', icon: Users },
  ] as MobileNavItem[],
  more: [
    { id: 'classes', label: 'کلاس‌ها', icon: GraduationCap },
    { id: 'teachers', label: 'معلمان', icon: UserCheck },
    { id: 'coaches', label: 'مربیان', icon: HeartHandshake },
    { id: 'warnings', label: 'هشدارها', icon: AlertTriangle, badge: counts.warnings },
    { id: 'reports', label: 'گزارش‌ها', icon: FileSpreadsheet },
    { id: 'settings', label: 'تنظیمات', icon: Settings },
  ] as MobileNavItem[],
});

export const educationalMobileNav = (counts: { warnings: number }) => ({
  primary: [
    { id: HOME, label: 'داشبورد', icon: LayoutDashboard },
    { id: 'classes', label: 'کلاس‌ها', icon: GraduationCap },
    { id: 'attendance', label: 'حضور و غیاب', icon: CheckCircle2 },
    { id: 'grades', label: 'نمرات', icon: Award },
  ] as MobileNavItem[],
  more: [
    { id: 'students', label: 'دانش‌آموزان', icon: Users },
    { id: 'subjects', label: 'دروس', icon: BookOpen },
    { id: 'teachers', label: 'معلمان', icon: UserCheck },
    { id: 'comprehensive_exam', label: 'آزمون جامع', icon: ClipboardCheck },
    { id: 'report_cards', label: 'کارنامه', icon: FileText },
    { id: 'reports', label: 'گزارش‌ها', icon: BarChart3 },
    { id: 'warnings', label: 'هشدارها', icon: AlertTriangle, badge: counts.warnings },
    { id: 'settings', label: 'تنظیمات', icon: Settings },
  ] as MobileNavItem[],
});

export const nurturingMobileNav = () => ({
  primary: [
    { id: HOME, label: 'داشبورد', icon: LayoutDashboard },
    { id: 'observation', label: 'مشاهده‌گری', icon: Eye },
    { id: 'dossier', label: 'پرونده‌ها', icon: FolderOpen },
    { id: 'attention', label: 'نیازمند توجه', icon: AlertTriangle },
  ] as MobileNavItem[],
  more: [
    { id: 'coachEvaluations', label: 'ارزیابی رشد', icon: Star },
    { id: 'coaches', label: 'مربیان', icon: HeartHandshake },
    { id: 'reports', label: 'گزارش‌ها', icon: BarChart3 },
    { id: 'settings', label: 'تنظیمات', icon: Settings },
  ] as MobileNavItem[],
});

export const teacherMobileNav = () => ({
  primary: [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'classes', label: 'کلاس‌ها', icon: School },
    { id: 'attendance', label: 'حضور و غیاب', icon: UserCheck },
    { id: 'grades', label: 'ثبت نمره', icon: Award },
  ] as MobileNavItem[],
  more: [
    { id: 'subjects', label: 'دروس من', icon: BookOpen },
    { id: 'report_cards', label: 'کارنامه', icon: FileText },
    { id: 'reports', label: 'گزارش‌ها', icon: BarChart3 },
    { id: 'evaluations', label: 'اعلانات و پیام‌ها', icon: MessageSquare },
  ] as MobileNavItem[],
});
