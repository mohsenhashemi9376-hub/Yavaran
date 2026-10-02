import React, { useState, useMemo } from 'react';
import { tehranNow, getCurrentAcademicYear, getActiveAcademicYear, getAcademicYearStart } from '../utils/persianDate';
import { useSchool } from '../context/SchoolContext';
import { 
  User, 
  UserRole, 
  SchoolSettings, 
  SchoolGradeItem, 
  AcademicSubject 
} from '../types';
import { toPersianDigits } from '../utils/persianDate';
import {
  Settings,
  Building,
  Calendar,
  GraduationCap,
  Users,
  Shield,
  Download,
  Upload,
  RotateCcw,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  ChevronLeft,
  Menu,
  Phone,
  MapPin,
  FileSpreadsheet,
  Lock,
  Eye,
  X,
  BookOpen,
  Clock,
  UserCheck,
  HeartHandshake,
  ShieldAlert,
  Sparkles,
  Info,
  Check,
  KeyRound,
  Filter
} from 'lucide-react';
import { EditSubjectModal } from './EditSubjectModal';
import { BellPeriodsManagementSection } from './BellPeriodsManagementSection';

interface AdminSettingsWorkspaceProps {
  onBack: () => void;
  onOpenSidebar: () => void;
  defaultTab?: 'school_info' | 'academic_structure' | 'users' | 'backup';
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدیر دبیرستان',
  vice_educational: 'معاون آموزشی',
  vice_disciplinary: 'معاون انضباطی',
  vice_nurturing: 'معاون تربیتی و پرورشی',
  coach: 'مربی یاوران ولایت',
  teacher: 'دبیر / معلم',
  vice_principal: 'معاون اجرایی',
};

const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  admin: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  vice_educational: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  vice_disciplinary: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  vice_nurturing: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  coach: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  teacher: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  vice_principal: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
};

// Permission Capabilities by Role
const ROLE_PERMISSIONS: Record<UserRole, Record<string, string[]>> = {
  admin: {
    'دانش‌آموزان': ['مشاهده پرونده کامل', 'ثبت‌نام دانش‌آموز جدید', 'ویرایش مشخصات سجلی', 'تخصیص و انتقال کلاس'],
    'حضور و غیاب': ['مشاهده آمار روزانه و کلاسی', 'ثبت و اصلاح حضور و غیاب', 'ثبت تأخیر صبحگاهی', 'ثبت غیبت‌های غیرموجه'],
    'انضباط و رفتار': ['مشاهده پرونده انضباطی', 'ثبت مورد انضباطی و تعهد', 'کسر و اصلاح نمره انضباط', 'احضار و پیگیری اولیا'],
    'آموزش و نمرات': ['مشاهده کارنامه و نمرات', 'ثبت و تایید نمرات ۴ نوبته', 'مدیریت برنامه دروس و زنگ‌ها', 'ارزشیابی کیفی اساتید'],
    'امور تربیتی': ['مشاهده پرونده رشدی یاوران ولایت', 'ثبت ارزیابی‌های تربیتی', 'مشاهدات رفتاری و مشاوره‌ای'],
    'تنظیمات سامانه': ['ویرایش اطلاعات مدرسه', 'تغییر سال تحصیلی', 'مدیریت کاربران و دسترسی‌ها', 'پشتیبان‌گیری و بازیابی داده‌ها'],
  },
  vice_educational: {
    'دانش‌آموزان': ['مشاهده پرونده تحصیلی', 'ثبت‌نام دانش‌آموز جدید', 'ویرایش اطلاعات دانش‌آموز', 'تخصیص کلاس‌ها'],
    'حضور و غیاب': ['مشاهده آمار کلاسی', 'ثبت جلسات درسی', 'گزارش‌گیری غیبت‌های آموزشی'],
    'انضباط و رفتار': ['مشاهده سوابق انضباطی مرتبط با کلاس'],
    'آموزش و نمرات': ['مدیریت برنامه دروس', 'ثبت نمرات ۴ نوبته مستمر و پایانی', 'مدیریت زنگ‌ها و زمان‌بندی', 'ارزشیابی دبیران'],
    'امور تربیتی': ['مشاهده همکاری‌های تربیتی-آموزشی'],
    'تنظیمات سامانه': ['مشاهده اطلاعات مدرسه', 'مدیریت پایه‌ها و دروس'],
  },
  vice_disciplinary: {
    'دانش‌آموزان': ['مشاهده اطلاعات دانش‌آموزان', 'افزودن یادداشت‌های انضباطی'],
    'حضور و غیاب': ['مشاهده حضور و غیاب کلاسی', 'ثبت تأخیرهای صبحگاهی', 'ثبت و پیگیری غیبت روزانه'],
    'انضباط و رفتار': ['ثبت تخلفات و تعهدنامه‌ها', 'محاسبه کسر نمره انضباط', 'ارجاع به شورای مدرسه و اولیا'],
    'آموزش و نمرات': ['مشاهده وضعیت تحصیلی مرتبط با انضباط'],
    'امور تربیتی': ['همکاری با مربیان تربیتی'],
    'تنظیمات سامانه': ['مشاهده اطلاعات پایه مدرسه'],
  },
  vice_nurturing: {
    'دانش‌آموزان': ['مشاهده پرونده فردی و رشدی'],
    'حضور و غیاب': ['مشاهده غیبت‌ها و مشارکت‌های اردویی'],
    'انضباط و رفتار': ['مشاهده پرونده انضباطی جهت مشاوره'],
    'آموزش و نمرات': ['مشاهده نمرات جهت هدایت تحصیلی'],
    'امور تربیتی': ['مدیریت پرونده رشدی یاوران ولایت', 'نظارت بر ارزیابی مربیان', 'ثبت جلسات مشاوره‌ای'],
    'تنظیمات سامانه': ['مشاهده اطلاعات پایه مدرسه'],
  },
  coach: {
    'دانش‌آموزان': ['مشاهده پرونده دانش‌آموزان کلاس‌های تحت نظر'],
    'حضور و غیاب': ['مشاهده حضور و غیاب کلاس‌های تحت نظر'],
    'انضباط و رفتار': ['مشاهده و ثبت مشاهدات رفتاری'],
    'آموزش و نمرات': ['مشاهده معدل و وضعیت دروس'],
    'امور تربیتی': ['ثبت ارزیابی مربی یاوران ولایت', 'ثبت مشاهدات رشدی و مشاوره‌ای'],
    'تنظیمات سامانه': ['مشاهده اطلاعات حساب کاربری خود'],
  },
  teacher: {
    'دانش‌آموزان': ['مشاهده فهرست دانش‌آموزان کلاس‌های تخصیص‌یافته'],
    'حضور و غیاب': ['ثبت حضور و غیاب در ساعت درسی خود', 'ثبت تکالیف کلاسی'],
    'انضباط و رفتار': ['ثبت موارد درون کلاسی به معاونت انضباطی'],
    'آموزش و نمرات': ['ثبت نمره مستمر کلاسی درس خود', 'مشاهده برنامه هفتگی'],
    'امور تربیتی': ['همکاری با مربی تربیتی کلاس'],
    'تنظیمات سامانه': ['مشاهده اطلاعات حساب کاربری خود'],
  },
  vice_principal: {
    'دانش‌آموزان': ['مشاهده پرونده دانش‌آموزان', 'ثبت پرونده'],
    'حضور و غیاب': ['مشاهده و گزارش‌گیری کل مدرسه'],
    'انضباط و رفتار': ['مشاهده موارد انضباطی'],
    'آموزش و نمرات': ['مشاهده آمار نمرات'],
    'امور تربیتی': ['مشاهده برنامه‌های تربیتی'],
    'تنظیمات سامانه': ['مشاهده اطلاعات مدرسه'],
  },
};

export const AdminSettingsWorkspace: React.FC<AdminSettingsWorkspaceProps> = ({
  onBack,
  onOpenSidebar,
  defaultTab = 'school_info',
}) => {
  const {
    currentUser,
    isAdmin,
    isEducationalVice,
    isDisciplinaryVice,
    isNurturingVice,
    classes,
    students,
    allTeachers,
    allCoaches,
    allUsers,
    academicSubjects,
    schoolSettings,
    updateSchoolSettings,
    updateAcademicYear,
    grades,
    addGrade,
    toggleGradeStatus,
    deleteGrade,
    addUser,
    updateUser,
    deleteUser,
    deleteAcademicSubject,
    exportDatabaseJson,
    importDatabaseJson,
    resetToDemoData,
    purgeStudentsAndStaff,
    showToast,
    showConfirm
  } = useSchool();

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'school_info' | 'academic_structure' | 'users' | 'backup'>(defaultTab);

  // Sub-tab under academic_structure: 'academic_year' | 'grades' | 'subjects' | 'bell_periods'
  const [academicSubTab, setAcademicSubTab] = useState<'academic_year' | 'grades' | 'subjects' | 'bell_periods'>('academic_year');

  // Modals state
  const [isEditSchoolModalOpen, setIsEditSchoolModalOpen] = useState(false);
  const [isChangeYearModalOpen, setIsChangeYearModalOpen] = useState(false);
  const [isAddGradeModalOpen, setIsAddGradeModalOpen] = useState(false);
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AcademicSubject | null>(null);

  // User management modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<User | null>(null);

  // Reset confirmation state
  const [resetConfirmationInput, setResetConfirmationInput] = useState('');
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  const [resetMode, setResetMode] = useState<'demo' | 'purge'>('demo');

  // Search and filters
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [gradeSearchQuery, setGradeSearchQuery] = useState('');

  // --------------------------------------------------------------------------
  // Role based tab permissions
  // --------------------------------------------------------------------------
  const availableTabs = useMemo(() => {
    const tabs: { id: 'school_info' | 'academic_structure' | 'users' | 'backup'; label: string; icon: any; desc: string }[] = [];

    // All roles can see school info (with edit restricted to admin)
    tabs.push({
      id: 'school_info',
      label: 'اطلاعات مدرسه',
      icon: Building,
      desc: 'مشخصات آموزشگاه، اطلاعات تماس و شناسه',
    });

    // Admin & Educational Vice can manage academic structure
    if (isAdmin || isEducationalVice) {
      tabs.push({
        id: 'academic_structure',
        label: 'سال و ساختار آموزشی',
        icon: GraduationCap,
        desc: 'سال تحصیلی، پایه‌ها، عناوین دروس و زنگ‌ها',
      });
    }

    // Admin & Vices can see users
    if (isAdmin || isEducationalVice || isDisciplinaryVice || isNurturingVice) {
      tabs.push({
        id: 'users',
        label: 'کاربران و دسترسی‌ها',
        icon: Users,
        desc: 'فهرست پرسنل، نقش‌ها و سطوح دسترسی',
      });
    }

    // Only Admin can backup/restore/reset
    if (isAdmin) {
      tabs.push({
        id: 'backup',
        label: 'داده‌ها و پشتیبان‌گیری',
        icon: Shield,
        desc: 'پشتیبان JSON، بازیابی اطلاعات و بازنشانی',
      });
    }

    return tabs;
  }, [isAdmin, isEducationalVice, isDisciplinaryVice, isNurturingVice]);

  // Ensure active tab is within available tabs
  const currentTab = availableTabs.some((t) => t.id === activeTab) ? activeTab : availableTabs[0]?.id || 'school_info';

  // --------------------------------------------------------------------------
  // Form State for Editing School Info
  // --------------------------------------------------------------------------
  const [schoolForm, setSchoolForm] = useState<SchoolSettings>({
    schoolName: schoolSettings.schoolName || '',
    phone: schoolSettings.phone || '',
    address: schoolSettings.address || '',
    academicYear: schoolSettings.academicYear || getCurrentAcademicYear(),
    principalName: schoolSettings.principalName || '',
    schoolCode: schoolSettings.schoolCode || '',
  });
  const [schoolFormErrors, setSchoolFormErrors] = useState<Record<string, string>>({});

  const handleOpenEditSchool = () => {
    setSchoolForm({
      schoolName: schoolSettings.schoolName || '',
      phone: schoolSettings.phone || '',
      address: schoolSettings.address || '',
      academicYear: schoolSettings.academicYear || getCurrentAcademicYear(),
      principalName: schoolSettings.principalName || '',
      schoolCode: schoolSettings.schoolCode || '',
    });
    setSchoolFormErrors({});
    setIsEditSchoolModalOpen(true);
  };

  const handleSaveSchoolInfo = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!schoolForm.schoolName.trim()) {
      errors.schoolName = 'لطفاً نام مدرسه را وارد کنید.';
    }
    if (!schoolForm.phone.trim()) {
      errors.phone = 'لطفاً شماره تماس را وارد کنید.';
    }
    if (!schoolForm.address.trim()) {
      errors.address = 'لطفاً نشانی مدرسه را وارد کنید.';
    }

    if (Object.keys(errors).length > 0) {
      setSchoolFormErrors(errors);
      return;
    }

    updateSchoolSettings(schoolForm);
    setIsEditSchoolModalOpen(false);
  };

  // --------------------------------------------------------------------------
  // Academic Year Change
  // --------------------------------------------------------------------------
  const [newAcademicYearInput, setNewAcademicYearInput] = useState(schoolSettings.academicYear || getCurrentAcademicYear());
  const [academicYearError, setAcademicYearError] = useState('');

  const handleOpenChangeYear = () => {
    setNewAcademicYearInput(schoolSettings.academicYear || getCurrentAcademicYear());
    setAcademicYearError('');
    setIsChangeYearModalOpen(true);
  };

  const handleConfirmChangeYear = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAcademicYearInput.trim()) {
      setAcademicYearError('لطفاً سال تحصیلی جدید را مشخص فرمایید.');
      return;
    }
    updateAcademicYear(newAcademicYearInput.trim());
    setIsChangeYearModalOpen(false);
  };

  // --------------------------------------------------------------------------
  // Add Grade Form State
  // --------------------------------------------------------------------------
  const [gradeNameInput, setGradeNameInput] = useState('');
  const [gradeStageInput, setGradeStageInput] = useState('دوره اول متوسطه');
  const [gradeError, setGradeError] = useState('');

  const handleOpenAddGrade = () => {
    setGradeNameInput('');
    setGradeStageInput('دوره اول متوسطه');
    setGradeError('');
    setIsAddGradeModalOpen(true);
  };

  const handleSaveGrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeNameInput.trim()) {
      setGradeError('لطفاً نام پایه (مثلاً: پایه دهم) را وارد کنید.');
      return;
    }
    const exists = grades.some((g) => g.name.trim() === gradeNameInput.trim());
    if (exists) {
      setGradeError('این پایه تحصیلی پیش‌تر در سامانه تعریف شده است.');
      return;
    }
    addGrade(gradeNameInput.trim(), gradeStageInput.trim());
    setIsAddGradeModalOpen(false);
  };

  const handleDeleteGradeSafe = (gradeItem: SchoolGradeItem) => {
    // Stage 12: Specific confirmation title
    showConfirm({
      title: `حذف ${gradeItem.name}؟`,
      message: `آیا از حذف «${gradeItem.name}» از چارت پایه‌های تحصیلی آموزشگاه اطمینان کامل دارید؟ این عمل فقط در صورتی مجاز است که هیچ کلاسی برای این پایه تعریف نشده باشد.`,
      confirmLabel: 'بله، حذف شود',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => {
        deleteGrade(gradeItem.id);
      },
    });
  };

  // --------------------------------------------------------------------------
  // User Management State & Methods
  // --------------------------------------------------------------------------
  const [userFormData, setUserFormData] = useState<{
    name: string;
    username: string;
    password: string;
    role: UserRole;
    phone: string;
    roleTitle: string;
    assignedClassIds: string[];
  }>({
    name: '',
    username: '',
    password: '',
    role: 'teacher',
    phone: '',
    roleTitle: '',
    assignedClassIds: [],
  });
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string>>({});

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: '',
      username: '',
      password: '123',
      role: 'teacher',
      phone: '',
      roleTitle: 'دبیر',
      assignedClassIds: [],
    });
    setUserFormErrors({});
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (usr: User) => {
    setEditingUser(usr);
    setUserFormData({
      name: usr.name,
      username: usr.username,
      password: usr.password || '',
      role: usr.role,
      phone: usr.phone || '',
      roleTitle: usr.roleTitle || ROLE_LABELS[usr.role] || '',
      assignedClassIds: usr.assignedClassIds || [],
    });
    setUserFormErrors({});
    setIsUserModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!userFormData.name.trim()) errors.name = 'لطفاً نام و نام خانوادگی را وارد کنید.';
    if (!userFormData.username.trim()) errors.username = 'لطفاً نام کاربری را وارد کنید.';
    if (!userFormData.password.trim()) errors.password = 'لطفاً کلمه عبور را وارد کنید.';

    // Check duplicate username if adding or changing
    const duplicate = allUsers.find(
      (u) => u.username.toLowerCase() === userFormData.username.trim().toLowerCase() && u.id !== editingUser?.id
    );
    if (duplicate) {
      errors.username = 'این نام کاربری قبلاً برای کاربر دیگری ثبت شده است.';
    }

    if (Object.keys(errors).length > 0) {
      setUserFormErrors(errors);
      return;
    }

    if (editingUser) {
      updateUser(editingUser.id, {
        name: userFormData.name.trim(),
        username: userFormData.username.trim(),
        password: userFormData.password.trim(),
        role: userFormData.role,
        roleTitle: userFormData.roleTitle.trim() || ROLE_LABELS[userFormData.role],
        phone: userFormData.phone.trim(),
        assignedClassIds: userFormData.assignedClassIds,
      });
    } else {
      addUser({
        name: userFormData.name.trim(),
        username: userFormData.username.trim(),
        password: userFormData.password.trim(),
        role: userFormData.role,
        roleTitle: userFormData.roleTitle.trim() || ROLE_LABELS[userFormData.role],
        phone: userFormData.phone.trim(),
        assignedClassIds: userFormData.assignedClassIds,
      });
    }

    setIsUserModalOpen(false);
  };

  const handleDeleteUserSafe = (target: User) => {
    showConfirm({
      title: `حذف کاربر ${target.name}؟`,
      message: `آیا از حذف کامل حساب کاربری «${target.name}» با نقش «${target.roleTitle || ROLE_LABELS[target.role]}» اطمینان دارید؟ دسترسی این کاربر به سامانه لغو خواهد شد.`,
      confirmLabel: 'بله، حذف کاربر',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => {
        deleteUser(target.id);
      },
    });
  };

  // --------------------------------------------------------------------------
  // Filtered Users List
  // --------------------------------------------------------------------------
  const filteredUsers = useMemo(() => {
    let result = [...allUsers];
    if (userRoleFilter !== 'all') {
      result = result.filter((u) => {
        if (userRoleFilter === 'vice') {
          return u.role.startsWith('vice') || (u.roleTitle || '').includes('معاون');
        }
        if (userRoleFilter === 'teaching') {
          return (
            u.role === 'teacher' ||
            Boolean(u.isAlsoTeacher) ||
            academicSubjects.some((sub) => sub.teacherId === u.id)
          );
        }
        return u.role === userRoleFilter;
      });
    }
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (u.phone && u.phone.includes(q)) ||
          (u.roleTitle && u.roleTitle.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allUsers, academicSubjects, userRoleFilter, userSearchQuery]);

  // --------------------------------------------------------------------------
  // Filtered Subjects List
  // --------------------------------------------------------------------------
  const filteredSubjects = useMemo(() => {
    if (!subjectSearchQuery.trim()) return academicSubjects;
    const q = subjectSearchQuery.trim().toLowerCase();
    return academicSubjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.grade && s.grade.toLowerCase().includes(q))
    );
  }, [academicSubjects, subjectSearchQuery]);

  // --------------------------------------------------------------------------
  // Filtered Grades List
  // --------------------------------------------------------------------------
  const filteredGrades = useMemo(() => {
    if (!gradeSearchQuery.trim()) return grades;
    const q = gradeSearchQuery.trim().toLowerCase();
    return grades.filter((g) => g.name.toLowerCase().includes(q) || (g.stage && g.stage.toLowerCase().includes(q)));
  }, [grades, gradeSearchQuery]);

  // --------------------------------------------------------------------------
  // Backup & Import File Handler
  // --------------------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonContent = event.target?.result as string;
        const success = importDatabaseJson(jsonContent);
        if (success) {
          showToast('اطلاعات سامانه با موفقیت از فایل پشتیبان بازیابی شد.', 'success');
        } else {
          showToast('ساختار فایل پشتیبان نامعتبر است. لطفاً فایل صحیح JSON را انتخاب نمایید.', 'error');
        }
      } catch {
        showToast('خطا در خواندن فایل انتخاب‌شده.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetPhrase = resetMode === 'purge' ? 'حذف همه' : 'یاوران ولایت';

  const handleConfirmReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmationInput.trim() !== resetPhrase) {
      showToast(`لطفاً عبارت «${resetPhrase}» را به‌طور دقیق تایپ فرمایید.`, 'error');
      return;
    }
    if (resetMode === 'purge') {
      purgeStudentsAndStaff();
      setIsResetConfirmModalOpen(false);
      setResetConfirmationInput('');
      return;
    }
    resetToDemoData();
    setIsResetConfirmModalOpen(false);
    setResetConfirmationInput('');
    showToast('سامانه با موفقیت به داده‌های استاندارد اولیه بازنشانی شد.', 'success');
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Header ساختار استاندارد فریمورک پروژه */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <span>پیشخوان اصلی</span>
              <span>/</span>
              <span className="text-teal-800">تنظیمات و اطلاعات پایه</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <Settings className="w-6 h-6 text-teal-800" />
              <span>تنظیمات و اطلاعات پایه سامانه</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              مدیریت مشخصات مدرسه، سال تحصیلی جاری، پایه‌ها، دروس، کاربران و تهیه نسخه پشتیبان.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
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

        {/* Navigation Tabs - دسته‌بندی مفهومی و واضح */}
        <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 pt-4 pb-1 scrollbar-none">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* تب ۱: اطلاعات مدرسه (School Information) */}
      {/* ========================================================================= */}
      {currentTab === 'school_info' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-800">
                  <Building className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">مشخصات و اطلاعات شناسنامه‌ای مدرسه</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    این اطلاعات در سربرگ کارنامه‌ها، گزارش‌های رسمی و فرم‌های چاپی درج می‌گردد.
                  </p>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={handleOpenEditSchool}
                  className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>ویرایش اطلاعات مدرسه</span>
                </button>
              )}
            </div>

            {/* Field Grid - مرحله ۵: فیلدها ساده و واضح با برچسب و مقدار فعلی */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
              {/* نام مدرسه */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">نام رسمی مدرسه</span>
                  <div className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <Building className="w-4 h-4 text-teal-800 shrink-0" />
                    <span>{schoolSettings.schoolName || 'دبیرستان یاوران ولایت'}</span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-slate-500">عنوان درج‌شده در فرم‌ها و پیشخوان</div>
              </div>

              {/* سال تحصیلی جاری */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">سال تحصیلی جاری</span>
                  <div className="text-sm font-black text-teal-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-700 shrink-0" />
                    <span>{toPersianDigits(schoolSettings.academicYear || getCurrentAcademicYear())}</span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-slate-500">مبنای ثبت جلسات، نمرات و گزارش‌ها</div>
              </div>

              {/* شماره تماس */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">شماره تماس دبیرخانه</span>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2" dir="ltr">
                    <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>{toPersianDigits(schoolSettings.phone || '۰۲۱-۸۸۷۷۶۶۵۵')}</span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-slate-500">پاسخگویی به اولیا و مراجعین</div>
              </div>

              {/* نام مدیر */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">مدیر آموزشگاه</span>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-700 shrink-0" />
                    <span>{schoolSettings.principalName || allUsers.find((u) => u.role === 'admin')?.name || '—'}</span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-slate-500">مسئول ارشد اداری و آموزشی واحد</div>
              </div>

              {/* کد مدرسه */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">کد واحد آموزشی / مرکز</span>
                  <div className="text-sm font-mono font-bold text-slate-800 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>{toPersianDigits(schoolSettings.schoolCode || '۹۶۰۲۱۴۸۸')}</span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-slate-500">شناسه ثبت‌شده در آموزش و پرورش</div>
              </div>

              {/* خلاصه کلاس‌ها و آمار */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">ظرفیت آموزشی و جمعیت</span>
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{toPersianDigits(classes.length)} کلاس فعال / {toPersianDigits(students.length)} دانش‌آموز</span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-slate-500">مجموع دوره‌های در حال تحصیل</div>
              </div>

              {/* آدرس کامل */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 md:col-span-2 lg:col-span-3">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">نشانی پستی مدرسه</span>
                <div className="text-sm font-medium text-slate-800 flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{schoolSettings.address || 'تهران، میدان انقلاب، خیابان فخر رازی، پلاک ۱۱۰'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* تب ۲: سال و ساختار آموزشی (Academic Structure) */}
      {/* ========================================================================= */}
      {currentTab === 'academic_structure' && (
        <div className="space-y-6">
          {/* Sub Navigation Bar for Academic Structure */}
          <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setAcademicSubTab('academic_year')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                academicSubTab === 'academic_year'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>سال تحصیلی جاری</span>
            </button>

            <button
              onClick={() => setAcademicSubTab('grades')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                academicSubTab === 'grades'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>پایه‌های تحصیلی ({toPersianDigits(grades.length)})</span>
            </button>

            <button
              onClick={() => setAcademicSubTab('subjects')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                academicSubTab === 'subjects'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>عناوین و برنامه دروس ({toPersianDigits(academicSubjects.length)})</span>
            </button>

            <button
              onClick={() => setAcademicSubTab('bell_periods')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                academicSubTab === 'bell_periods'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>زنگ‌های مصوب آموزشی</span>
            </button>
          </div>

          {/* Sub-Tab: سال تحصیلی جاری - مرحله ۷ */}
          {academicSubTab === 'academic_year' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">سال تحصیلی جاری</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    تنظیم دوره‌ای که اطلاعات کارنامه‌ها، ثبت غیبت‌ها و دوره‌های کلاسی بر مبنای آن محاسبه می‌شوند.
                  </p>
                </div>

                {isAdmin && (
                  <button
                    onClick={handleOpenChangeYear}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>تغییر سال تحصیلی</span>
                  </button>
                )}
              </div>

              {/* کارت نمایش سال تحصیلی جاری - مرحله ۷ */}
              <div className="bg-teal-50/60 rounded-2xl p-6 border border-teal-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-teal-800 block">دوره آموزشی فعال در سامانه:</span>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 tracking-tight">
                      سال تحصیلی [ {toPersianDigits(schoolSettings.academicYear || getCurrentAcademicYear())} ]
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-600 bg-white/90 p-3.5 rounded-xl border border-teal-100 max-w-sm">
                  <div className="flex items-center gap-1.5 font-bold text-teal-900 mb-1">
                    <Info className="w-4 h-4 text-teal-800 shrink-0" />
                    <span>توجه مدیریتی:</span>
                  </div>
                  تمام گزارش‌ها، حضور و غیاب‌ها و نمرات ثبت‌شده جاری به این سال تحصیلی متصل هستند.
                </div>
              </div>

              {/* خلاصه کلاس‌های متصل به این سال تحصیلی */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700">کلاس‌های دایر در سال جاری:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {classes.map((cls) => (
                    <div key={cls.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-black text-slate-800">{cls.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{cls.grade} • اتاق {cls.roomNumber}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                        فعال
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab: پایه‌ها - مرحله ۸ */}
          {academicSubTab === 'grades' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">پایه‌های تحصیلی آموزشگاه</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    تعریف پایه‌های آموزشی مدرسه و مدیریت وضعیت فعال بودن آنها.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Search Grades */}
                  <div className="relative w-44 sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="جستجوی پایه..."
                      value={gradeSearchQuery}
                      onChange={(e) => setGradeSearchQuery(e.target.value)}
                      className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-700"
                    />
                  </div>

                  {isAdmin && (
                    <button
                      onClick={handleOpenAddGrade}
                      className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن پایه جدید</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Grades Table / Cards - مرحله ۸: نام پایه، وضعیت، تعداد کلاس‌ها */}
              {filteredGrades.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <GraduationCap className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold">هنوز پایه‌ای با این مشخصات یافت نشد.</p>
                  {isAdmin && (
                    <button
                      onClick={handleOpenAddGrade}
                      className="mt-3 px-3 py-1.5 bg-teal-700 text-white text-xs rounded-xl font-bold inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن پایه جدید</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGrades.map((gradeItem) => {
                    const relatedClasses = classes.filter(
                      (c) => c.grade.includes(gradeItem.name) || gradeItem.name.includes(c.grade)
                    );
                    const isActive = gradeItem.status === 'active';

                    return (
                      <div
                        key={gradeItem.id}
                        className={`p-5 rounded-2xl border transition ${
                          isActive
                            ? 'bg-white border-slate-200 shadow-xs hover:border-teal-300'
                            : 'bg-slate-50/70 border-slate-200/80 opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-800">
                              <GraduationCap className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900">{gradeItem.name}</h4>
                              <span className="text-[11px] text-slate-500">{gradeItem.stage || 'دوره اول متوسطه'}</span>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isActive ? 'فعال' : 'غیرفعال'}
                          </span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500">کلاس‌های دایر:</span>
                          <span className="font-bold text-slate-800">
                            {toPersianDigits(relatedClasses.length)} کلاس
                          </span>
                        </div>

                        {/* Actions */}
                        {isAdmin && (
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              onClick={() => toggleGradeStatus(gradeItem.id)}
                              className="text-[11px] font-bold text-slate-600 hover:text-slate-900 transition"
                            >
                              {isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                            </button>

                            <button
                              onClick={() => handleDeleteGradeSafe(gradeItem)}
                              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab: دروس - مرحله ۹ */}
          {academicSubTab === 'subjects' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">عناوین دروس و ضرایب کلاسی</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    عناوین رسمی دروس دوره اول متوسطه جهت برنامه‌ریزی کلاسی و حضور و غیاب اساتید.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Search Subjects */}
                  <div className="relative w-48 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="جستجوی عنوان درس..."
                      value={subjectSearchQuery}
                      onChange={(e) => setSubjectSearchQuery(e.target.value)}
                      className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-700"
                    />
                  </div>

                  {(isAdmin || isEducationalVice) && (
                    <button
                      onClick={() => {
                        setEditingSubject(null);
                        setIsAddSubjectModalOpen(true);
                      }}
                      className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>افزودن درس</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Subjects Table - مرحله ۹: نام درس، پایه‌های مرتبط، وضعیت */}
              {filteredSubjects.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold">هنوز درسی ثبت نشده است.</p>
                  {(isAdmin || isEducationalVice) && (
                    <button
                      onClick={() => {
                        setEditingSubject(null);
                        setIsAddSubjectModalOpen(true);
                      }}
                      className="mt-3 px-3 py-1.5 bg-teal-700 text-white text-xs rounded-xl font-bold inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن درس جدید</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">نام درس</th>
                        <th className="py-3 px-4">پایه‌های مرتبط</th>
                        <th className="py-3 px-4">ضریب درس</th>
                        <th className="py-3 px-4">گروه درسی</th>
                        <th className="py-3 px-4">وضعیت</th>
                        {(isAdmin || isEducationalVice) && <th className="py-3 px-4 text-center">عملیات</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredSubjects.map((subj) => (
                        <tr key={subj.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-black text-slate-900 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-teal-800 shrink-0" />
                            <span>{subj.name}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {subj.grade || 'کلیه پایه‌ها (هفتم، هشتم، نهم)'}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            ضریب {toPersianDigits(subj.coefficient || 2)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                              {subj.category || 'عمومی و مهارتی'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              <span>فعال</span>
                            </span>
                          </td>
                          {(isAdmin || isEducationalVice) && (
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingSubject(subj);
                                    setIsAddSubjectModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                                  title="ویرایش درس"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    showConfirm({
                                      title: `حذف درس ${subj.name}؟`,
                                      message: `آیا از حذف درس «${subj.name}» از چارت آموزشی دبیرستان اطمینان دارید؟`,
                                      confirmLabel: 'بله، حذف شود',
                                      cancelLabel: 'انصراف',
                                      isDangerous: true,
                                      onConfirm: () => {
                                        deleteAcademicSubject(subj.id);
                                        showToast(`درس «${subj.name}» با موفقیت حذف شد.`, 'success');
                                      },
                                    });
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                  title="حذف درس"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab: ساعات و زنگ‌ها */}
          {academicSubTab === 'bell_periods' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
              <BellPeriodsManagementSection />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* تب ۳: کاربران و دسترسی‌ها (Users & Permissions) - مرحله ۱۰ و ۱۱ */}
      {/* ========================================================================= */}
      {currentTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">کاربران و پرسنل سامانه</h3>
                <p className="text-xs text-slate-500 mt-1">
                  مشاهده مشخصات حساب‌های کاربری، کنترل دسترسی‌ها بر اساس نقش اداری و تربیتی.
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={handleOpenAddUser}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>افزودن کاربر جدید</span>
                </button>
              )}
            </div>

            {/* Filters Bar: Search & Role Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1 whitespace-nowrap">
                  <Filter className="w-3.5 h-3.5" />
                  <span>فیلتر نقش:</span>
                </span>
                {[
                  { id: 'all', label: 'همه کاربران' },
                  { id: 'admin', label: 'مدیران' },
                  { id: 'vice', label: 'معاونین' },
                  { id: 'coach', label: 'مربیان' },
                  { id: 'teaching', label: 'اساتید' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setUserRoleFilter(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      userRoleFilter === item.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="جستجوی نام یا شناسه..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pr-8 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-teal-700"
                />
              </div>
            </div>

            {/* Users Table / List - مرحله ۱۰: نام، نقش، وضعیت، دسترسی، اکشن‌ها */}
            {filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-bold">کاربری با این مشخصات یافت نشد.</p>
                {isAdmin && (
                  <button
                    onClick={handleOpenAddUser}
                    className="mt-3 px-3 py-1.5 bg-teal-700 text-white text-xs rounded-xl font-bold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن کاربر جدید</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">نام کاربر</th>
                      <th className="py-3 px-4">نقش سازمانی</th>
                      <th className="py-3 px-4">نام کاربری ورود</th>
                      <th className="py-3 px-4">شماره تماس</th>
                      <th className="py-3 px-4">وضعیت</th>
                      <th className="py-3 px-4 text-center">دسترسی و عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredUsers.map((usr) => {
                      const roleStyle = ROLE_COLORS[usr.role] || ROLE_COLORS.teacher;
                      const isSelf = usr.id === currentUser.id;

                      return (
                        <tr key={usr.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3.5 px-4 font-black text-slate-900 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold">
                              {usr.name.slice(0, 1)}
                            </div>
                            <div>
                              <span>{usr.name}</span>
                              {isSelf && (
                                <span className="mr-2 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                                  شما
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}
                            >
                              {usr.roleTitle || ROLE_LABELS[usr.role]}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700" dir="ltr">
                            {usr.username}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600" dir="ltr">
                            {toPersianDigits(usr.phone || '—')}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              <span>فعال</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* مشاهده دسترسی‌ها - مرحله ۱۰ و ۱۱ */}
                              <button
                                onClick={() => setSelectedUserForPermissions(usr)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="مشاهده اختیارات و دسترسی‌ها"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>دسترسی‌ها</span>
                              </button>

                              {/* ویرایش کاربر */}
                              {isAdmin && (
                                <button
                                  onClick={() => handleOpenEditUser(usr)}
                                  className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition cursor-pointer"
                                  title="ویرایش کاربر"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* حذف کاربر */}
                              {isAdmin && !isSelf && (
                                <button
                                  onClick={() => handleDeleteUserSafe(usr)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="حذف کاربر"
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
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* تب ۴: داده‌ها و پشتیبان‌گیری (Data & Backup) */}
      {/* ========================================================================= */}
      {currentTab === 'backup' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div className="pb-5 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">پشتیبان‌گیری، بازیابی و مدیریت داده‌ها</h3>
              <p className="text-xs text-slate-500 mt-1">
                تهیه نسخه پشتیبان کامل از تمامی سوابق مدرسه، کارنامه‌ها، جلسات، مربیان و بازنشانی ایمن.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* دانلود فایل پشتیبان */}
              <div className="p-5 rounded-2xl bg-teal-50/50 border border-teal-200/70 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-teal-800 text-white flex items-center justify-center mb-3">
                    <Download className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">دانلود فایل پشتیبان کامل (JSON)</h4>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    این فایل شامل تمامی اطلاعات دانش‌آموزان، کلاس‌ها، اساتید، سوابق انضباطی، نمرات و تنظیمات مدرسه است و می‌توانید آن را در رایانه خود ذخیره کنید.
                  </p>
                </div>
                <button
                  onClick={exportDatabaseJson}
                  className="mt-5 w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود آنی فایل پشتیبان</span>
                </button>
              </div>

              {/* بازیابی از فایل */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">بازیابی اطلاعات از فایل پشتیبان</h4>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    با بارگذاری فایل JSON ذخیره‌شده قبلی، تمامی اطلاعات سیستم بدون نقص به وضعیت همان تاریخ بازگردانده خواهند شد.
                  </p>
                </div>
                <label className="mt-5 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs">
                  <Upload className="w-4 h-4" />
                  <span>انتخاب فایل JSON و بازیابی</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* بخش ویژه بازنشانی داده‌ها */}
            <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
              <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                    <Trash2 className="w-5 h-5 text-amber-600" />
                    <span>پاک‌سازی کامل دانش‌آموزان، دبیران و مربیان (شروع از صفر)</span>
                  </div>
                  <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                    تمام دانش‌آموزان ({toPersianDigits(students.length)} نفر)، دبیران و مربیان به‌همراه حضور و غیاب، نمرات، تأخیرها، غیبت‌ها و پرونده‌های تربیتی حذف می‌شوند.
                    حساب مدیر و معاونین، کلاس‌ها، دروس، زنگ‌ها و تنظیمات مدرسه حفظ می‌گردد.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setResetMode('purge');
                    setResetConfirmationInput('');
                    setIsResetConfirmModalOpen(true);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>پاک‌سازی اطلاعات...</span>
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-rose-800 font-black text-sm">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span>بازنشانی به داده‌های اولیه دبیرستان یاوران ولایت</span>
                  </div>
                  <p className="text-xs text-rose-700/90 mt-1">
                    توجه: این اقدام تمامی تغییرات شخصی شما را پاک کرده و داده‌های آزمایشی استاندارد مدرسه را مجدداً بارگذاری می‌نماید.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setResetMode('demo');
                    setResetConfirmationInput('');
                    setIsResetConfirmModalOpen(true);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>بازنشانی داده‌ها...</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: فرم ویرایش اطلاعات مدرسه - مرحله ۶ */}
      {/* ========================================================================= */}
      {isEditSchoolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="fixed inset-0" onClick={() => setIsEditSchoolModalOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-10">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <Building className="w-5 h-5 text-teal-800" />
                <span>ویرایش اطلاعات مدرسه</span>
              </div>
              <button
                onClick={() => setIsEditSchoolModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchoolInfo} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام رسمی مدرسه *</label>
                <input
                  type="text"
                  value={schoolForm.schoolName}
                  onChange={(e) => setSchoolForm({ ...schoolForm, schoolName: e.target.value })}
                  placeholder="مثال: دبیرستان دوره اول یاوران ولایت"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                />
                {schoolFormErrors.schoolName && (
                  <p className="text-[11px] text-rose-600 mt-1 font-bold">{schoolFormErrors.schoolName}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">شماره تماس دبیرخانه *</label>
                  <input
                    type="text"
                    value={schoolForm.phone}
                    onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                    placeholder="۰۲۱-۸۸۷۷۶۶۵۵"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                  />
                  {schoolFormErrors.phone && (
                    <p className="text-[11px] text-rose-600 mt-1 font-bold">{schoolFormErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">کد واحد آموزشی</label>
                  <input
                    type="text"
                    value={schoolForm.schoolCode || ''}
                    onChange={(e) => setSchoolForm({ ...schoolForm, schoolCode: e.target.value })}
                    placeholder="۹۶۰۲۱۴۸۸"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام مدیر آموزشگاه</label>
                <input
                  type="text"
                  value={schoolForm.principalName || ''}
                  onChange={(e) => setSchoolForm({ ...schoolForm, principalName: e.target.value })}
                  placeholder="دکتر صادقی"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نشانی پستی کامل *</label>
                <textarea
                  rows={2}
                  value={schoolForm.address}
                  onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                  placeholder="تهران، خیابان انقلاب، خیابان فخر رازی..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700 resize-none"
                />
                {schoolFormErrors.address && (
                  <p className="text-[11px] text-rose-600 mt-1 font-bold">{schoolFormErrors.address}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditSchoolModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                >
                  ذخیره تغییرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: مدال تغییر سال تحصیلی با هشدار صریح - مرحله ۷ */}
      {/* ========================================================================= */}
      {isChangeYearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="fixed inset-0" onClick={() => setIsChangeYearModalOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-10">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <Calendar className="w-5 h-5 text-teal-800" />
                <span>تغییر سال تحصیلی سامانه</span>
              </div>
              <button
                onClick={() => setIsChangeYearModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmChangeYear} className="p-5 space-y-4">
              {/* هشدار صریح - مرحله ۷ */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black block mb-0.5">هشدار مهم پیش از تغییر:</span>
                  تغییر سال تحصیلی ممکن است بر نمایش کلاس‌ها، دانش‌آموزان و گزارش‌ها تأثیر بگذارد.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  سال تحصیلی جدید را وارد نمایید *
                </label>
                <input
                  type="text"
                  value={newAcademicYearInput}
                  onChange={(e) => setNewAcademicYearInput(e.target.value)}
                  placeholder="مثال: ۱۴۰۴-۱۴۰۵ یا ۱۴۰۵-۱۴۰۶"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                />
                {academicYearError && (
                  <p className="text-[11px] text-rose-600 mt-1 font-bold">{academicYearError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsChangeYearModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                >
                  تایید و تغییر سال تحصیلی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: مدال افزودن پایه جدید - مرحله ۸ */}
      {/* ========================================================================= */}
      {isAddGradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="fixed inset-0" onClick={() => setIsAddGradeModalOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-10">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <GraduationCap className="w-5 h-5 text-teal-800" />
                <span>افزودن پایه تحصیلی جدید</span>
              </div>
              <button
                onClick={() => setIsAddGradeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان پایه تحصیلی *</label>
                <input
                  type="text"
                  value={gradeNameInput}
                  onChange={(e) => setGradeNameInput(e.target.value)}
                  placeholder="مثال: پایه دهم، پایه هفتم، پیش‌دبستانی"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                />
                {gradeError && (
                  <p className="text-[11px] text-rose-600 mt-1 font-bold">{gradeError}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مقطع / دوره آموزشی</label>
                <select
                  value={gradeStageInput}
                  onChange={(e) => setGradeStageInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                >
                  <option value="دوره اول متوسطه">دوره اول متوسطه (هفتم، هشتم، نهم)</option>
                  <option value="دوره دوم متوسطه">دوره دوم متوسطه (دهم، یازدهم، دوازدهم)</option>
                  <option value="دوره ابتدایی">دوره ابتدایی (اول تا ششم)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddGradeModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                >
                  ثبت پایه تحصیلی
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: مشاهده دسترسی‌های کاربر - مرحله ۱۱ (Role & Permission) */}
      {/* ========================================================================= */}
      {selectedUserForPermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="fixed inset-0" onClick={() => setSelectedUserForPermissions(null)} />
          <div className="relative bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-10 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-800 font-black">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    اختیارات و دسترسی‌های {selectedUserForPermissions.name}
                  </h3>
                  <span className="text-xs text-slate-500">
                    نقش سازمانی: {selectedUserForPermissions.roleTitle || ROLE_LABELS[selectedUserForPermissions.role]}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedUserForPermissions(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Groups of Permissions - مرحله ۱۱ */}
              {Object.entries(ROLE_PERMISSIONS[selectedUserForPermissions.role] || {}).map(([groupName, perms]) => {
                const permList = (perms as string[]) || [];
                return (
                  <div key={groupName} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="text-xs font-black text-slate-800 mb-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-teal-800" />
                      <span>{groupName}</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {permList.map((permText: string) => (
                        <div key={permText} className="flex items-center gap-1.5 text-xs text-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                          <span>{permText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedUserForPermissions(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: افزودن یا ویرایش کاربر - مرحله ۱۰ */}
      {/* ========================================================================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="fixed inset-0" onClick={() => setIsUserModalOpen(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-10 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <Users className="w-5 h-5 text-teal-800" />
                <span>{editingUser ? 'ویرایش اطلاعات کاربر' : 'تعریف کاربر جدید در سامانه'}</span>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام و نام خانوادگی *</label>
                <input
                  type="text"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  placeholder="مثال: استاد رضایی"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                />
                {userFormErrors.name && (
                  <p className="text-[11px] text-rose-600 mt-1 font-bold">{userFormErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نقش در آموزشگاه *</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole;
                      setUserFormData({
                        ...userFormData,
                        role: newRole,
                        roleTitle: ROLE_LABELS[newRole],
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                  >
                    <option value="teacher">دبیر / معلم</option>
                    <option value="coach">مربی یاوران ولایت</option>
                    <option value="vice_educational">معاون آموزشی</option>
                    <option value="vice_disciplinary">معاون انضباطی</option>
                    <option value="vice_nurturing">معاون پرورشی و تربیتی</option>
                    <option value="admin">مدیر کل مدرسه</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان سمَت در سامانه</label>
                  <input
                    type="text"
                    value={userFormData.roleTitle}
                    onChange={(e) => setUserFormData({ ...userFormData, roleTitle: e.target.value })}
                    placeholder="مثال: دبیر ریاضی و هندسه"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نام کاربری ورود *</label>
                  <input
                    type="text"
                    value={userFormData.username}
                    onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                    placeholder="rezaei_101"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                    dir="ltr"
                  />
                  {userFormErrors.username && (
                    <p className="text-[11px] text-rose-600 mt-1 font-bold">{userFormErrors.username}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">کلمه عبور *</label>
                  <input
                    type="text"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                    placeholder="123"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700 font-mono"
                    dir="ltr"
                  />
                  {userFormErrors.password && (
                    <p className="text-[11px] text-rose-600 mt-1 font-bold">{userFormErrors.password}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">شماره همراه پرسنل</label>
                <input
                  type="text"
                  value={userFormData.phone}
                  onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                  placeholder="۰۹۱۲۱۱۱۰۰۰۰"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-teal-700"
                  dir="ltr"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                >
                  {editingUser ? 'ذخیره تغییرات' : 'افزودن کاربر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: بازنشانی داده‌ها با تایید دقیق کلمه «یاوران ولایت» */}
      {/* ========================================================================= */}
      {isResetConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="fixed inset-0" onClick={() => setIsResetConfirmModalOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-10">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2 text-rose-800 font-black text-base">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>{resetMode === 'purge' ? 'تایید پاک‌سازی دانش‌آموزان و کادر آموزشی' : 'تایید بازنشانی اطلاعات به حالت اولیه'}</span>
              </div>
              <button
                onClick={() => setIsResetConfirmModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReset} className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {resetMode === 'purge'
                  ? 'تمام دانش‌آموزان، دبیران و مربیان و کلیه سوابق آن‌ها برای همیشه حذف خواهند شد. پیشنهاد می‌شود ابتدا فایل پشتیبان دانلود کنید. جهت تایید، لطفاً عبارت '
                  : 'با بازنشانی سامانه، کلیه داده‌های ثبت‌شده شما جایگزین نمونه استاندارد اولیه «یاوران ولایت» خواهد شد. جهت تایید این فرآیند مهم، لطفاً عبارت '}
                <span className="font-bold text-rose-600">{resetPhrase}</span> را در کادر زیر تایپ نمایید:
              </p>

              <input
                type="text"
                value={resetConfirmationInput}
                onChange={(e) => setResetConfirmationInput(e.target.value)}
                placeholder={resetPhrase}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center text-sm font-black text-slate-900 focus:outline-hidden focus:border-rose-600"
              />

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsResetConfirmModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={resetConfirmationInput.trim() !== resetPhrase}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    resetConfirmationInput.trim() === resetPhrase
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{resetMode === 'purge' ? 'تایید پاک‌سازی نهایی' : 'تایید بازنشانی پایگاه داده'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: ویرایش / افزودن درس */}
      {isAddSubjectModalOpen && (
        <EditSubjectModal
          isOpen={isAddSubjectModalOpen}
          subject={editingSubject}
          onClose={() => {
            setIsAddSubjectModalOpen(false);
            setEditingSubject(null);
          }}
        />
      )}
    </div>
  );
};
