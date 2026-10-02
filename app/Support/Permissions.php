<?php

namespace App\Support;

/**
 * ماتریس دسترسی‌های اختصاصی کاربران.
 * اگر برای کاربری فهرست دسترسی ثبت نشده باشد، پیش‌فرض نقش او اعمال می‌شود.
 * مدیر مدرسه (admin) همیشه به همه‌ی دسترسی‌ها دسترسی دارد (Superadmin Bypass).
 */
final class Permissions
{
    /** @var array<string, array{label:string, items:array<string,string>}> */
    public const GROUPS = [
        'education' => [
            'label' => 'آموزش',
            'items' => [
                'manage-grades' => 'ثبت نمرات مستمر',
                'comprehensive-exam' => 'آزمون جامع',
                'report-cards' => 'صدور کارنامه',
                'analytics-reports' => 'گزارشات تحلیلی',
                'manage-curriculum' => 'مدیریت برنامه دروس',
            ],
        ],
        'attendance' => [
            'label' => 'حضور و غیاب',
            'items' => [
                'manage-attendance' => 'ثبت جلسه حضور و غیاب',
                'view-attendance-history' => 'مشاهده تاریخچه تردد',
            ],
        ],
        'discipline' => [
            'label' => 'تربیتی',
            'items' => [
                'discipline' => 'ثبت موارد انضباطی',
                'counseling-report' => 'ثبت گزارش مشاوره‌ای',
                'view-nurturing-file' => 'مشاهده پرونده تربیتی',
            ],
        ],
        'base' => [
            'label' => 'پایه',
            'items' => [
                'view-students' => 'مشاهده مشخصات دانش‌آموزان',
                'view-guardians' => 'مشاهده اطلاعات اولیا',
                'manage-classes' => 'مدیریت کلاس‌ها',
                'school-settings' => 'تنظیمات مدرسه',
            ],
        ],
    ];

    /** @return array<int, string> */
    public static function all(): array
    {
        $keys = [];
        foreach (self::GROUPS as $group) {
            foreach (array_keys($group['items']) as $key) {
                $keys[] = $key;
            }
        }

        return $keys;
    }

    /** @return array<int, string> */
    public static function defaultsFor(string $role): array
    {
        $all = self::all();
        $withoutSettings = array_values(array_diff($all, ['school-settings']));

        return match ($role) {
            'admin' => $all,
            'vice_educational' => $all,
            'vice_principal' => $withoutSettings,
            'vice_disciplinary' => [
                'manage-attendance', 'view-attendance-history', 'discipline', 'view-students', 'view-guardians',
                'analytics-reports',
            ],
            'vice_nurturing' => [
                'view-attendance-history', 'discipline', 'counseling-report', 'view-nurturing-file',
                'view-students', 'view-guardians', 'analytics-reports',
            ],
            'coach' => [
                'view-attendance-history', 'counseling-report', 'view-nurturing-file', 'view-students',
                'analytics-reports',
            ],
            'teacher' => [
                'manage-grades', 'manage-attendance', 'view-attendance-history', 'view-students',
                'report-cards', 'analytics-reports',
            ],
            default => [],
        };
    }

    /**
     * @param  array<int, string>|null  $explicit
     * @return array<int, string>
     */
    public static function effective(string $role, ?array $explicit): array
    {
        if ($role === 'admin') {
            return self::all();
        }

        if ($explicit === null) {
            return self::defaultsFor($role);
        }

        return array_values(array_intersect($explicit, self::all()));
    }
}
