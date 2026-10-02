<?php

namespace App\Support\Sync;

/**
 * نگاشت مجموعه‌های داده فرانت‌اند به جداول دیتابیس و ستون‌های قابل جستجو.
 * کل شیء هر رکورد در ستون data (JSON) ذخیره می‌شود تا ظاهر و رفتار
 * رابط کاربری بدون هیچ تغییری حفظ شود.
 */
final class CollectionRegistry
{
    public const TABLES = [
        'users' => 'users',
        'classes' => 'school_classes',
        'bellPeriods' => 'bell_periods',
        'students' => 'students',
        'sessions' => 'attendance_sessions',
        'academicSubjects' => 'academic_subjects',
        'academicGrades' => 'academic_grades',
        'morningDelays' => 'morning_delays',
        'schoolAbsences' => 'school_absences',
        'observations' => 'student_observations',
        'nurturingDossiers' => 'nurturing_dossiers',
        'coachEvaluations' => 'coach_evaluations',
        'teacherEvaluations' => 'teacher_evaluations',
        'schoolAnnouncements' => 'school_announcements',
        'comprehensiveExams' => 'comprehensive_exams',
        'courseAssignments' => 'course_assignments',
        'grades' => 'school_grades',
        'settings' => 'school_settings',
    ];

    public const ROLES = [
        'admin', 'vice_educational', 'vice_disciplinary', 'vice_nurturing', 'vice_principal', 'coach', 'teacher',
    ];

    public static function has(string $collection): bool
    {
        return array_key_exists($collection, self::TABLES);
    }

    public static function table(string $collection): string
    {
        return self::TABLES[$collection];
    }

    /**
     * ستون‌های ایندکس‌شده هر جدول که از روی داده رکورد استخراج می‌شوند.
     *
     * @return array<string, mixed>
     */
    public static function columns(string $collection, object $d): array
    {
        return match ($collection) {
            'users' => [
                'username' => self::str($d, 'username', 100) ?: null,
                'name' => self::str($d, 'name', 191) ?? '',
                'role' => self::str($d, 'role', 40) ?? 'teacher',
                'phone' => self::str($d, 'phone', 30),
                'is_active' => ! (property_exists($d, 'isActive') && $d->isActive === false),
                'permissions' => (property_exists($d, 'permissions') && is_array($d->permissions))
                    ? json_encode(array_values(array_filter($d->permissions, 'is_string')), JSON_UNESCAPED_UNICODE)
                    : null,
            ],
            'classes' => [
                'name' => self::str($d, 'name', 191) ?? '',
                'grade' => self::str($d, 'grade', 100),
                'academic_year' => self::str($d, 'academicYear', 30),
            ],
            'bellPeriods' => [
                'name' => self::str($d, 'name', 100) ?? '',
            ],
            'students' => [
                'class_id' => self::str($d, 'classId', 100),
                'first_name' => self::str($d, 'firstName', 100) ?? '',
                'last_name' => self::str($d, 'lastName', 100) ?? '',
                'national_id' => self::str($d, 'nationalId', 30),
                'student_code' => self::str($d, 'studentCode', 30),
            ],
            'sessions' => [
                'class_id' => self::str($d, 'classId', 100),
                'teacher_id' => self::str($d, 'teacherId', 100),
                'subject' => self::str($d, 'subject', 191),
                'session_date' => self::str($d, 'date', 20),
            ],
            'academicSubjects' => [
                'name' => self::str($d, 'name', 191) ?? '',
                'code' => self::str($d, 'code', 50),
            ],
            'academicGrades' => [
                'student_id' => self::str($d, 'studentId', 100),
                'class_id' => self::str($d, 'classId', 100),
                'subject_id' => self::str($d, 'subjectId', 100),
            ],
            'morningDelays', 'schoolAbsences' => [
                'student_id' => self::str($d, 'studentId', 100),
                'class_id' => self::str($d, 'classId', 100),
                'record_date' => self::str($d, 'date', 20),
            ],
            'observations' => [
                'student_id' => self::str($d, 'studentId', 100),
                'record_date' => self::str($d, 'date', 20),
            ],
            'nurturingDossiers' => [
                'student_id' => self::str($d, 'studentId', 100) ?? self::str($d, 'id', 100),
            ],
            'coachEvaluations' => [
                'student_id' => self::str($d, 'studentId', 100),
                'coach_id' => self::str($d, 'coachId', 100),
            ],
            'teacherEvaluations' => [
                'teacher_id' => self::str($d, 'teacherId', 100),
            ],
            'schoolAnnouncements' => [
                'title' => self::str($d, 'title', 191),
                'priority' => self::str($d, 'priority', 20),
            ],
            'comprehensiveExams' => [
                'class_id' => self::str($d, 'classId', 100),
            ],
            'courseAssignments' => [
                'class_id' => self::str($d, 'classId', 100) ?? '',
                'subject_id' => self::str($d, 'subjectId', 100) ?? '',
                'user_id' => self::str($d, 'teacherId', 100) ?? '',
            ],
            'grades' => [
                'name' => self::str($d, 'name', 100) ?? '',
                'status' => self::str($d, 'status', 20) ?? 'active',
            ],
            default => [],
        };
    }

    public static function str(object $d, string $prop, int $max): ?string
    {
        if (! property_exists($d, $prop) || $d->{$prop} === null || ! is_scalar($d->{$prop})) {
            return null;
        }

        return mb_substr(trim((string) $d->{$prop}), 0, $max);
    }
}
