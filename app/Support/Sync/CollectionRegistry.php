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
        'morningAttendance' => 'morning_attendance',
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

    /** @var array<string, bool> */
    private static array $schemaCache = [];

    /** بررسی (با کش) وجود جدول؛ برای سازگاری با دیتابیس‌هایی که هنوز به‌روزرسانی نشده‌اند */
    public static function tableExists(string $table): bool
    {
        return self::$schemaCache["t:$table"] ??= \Illuminate\Support\Facades\Schema::hasTable($table);
    }

    /**
     * ساخت خودکار جدول حضور و غیاب صبحگاه در صورت اجرا نشدن upgrade.sql / migration
     * (جلوگیری از خطای سرور روی دیتابیس‌های به‌روزنشده).
     */
    public static function ensureTable(string $table): bool
    {
        if (self::tableExists($table)) {
            return true;
        }
        if ($table !== 'morning_attendance') {
            return false;
        }

        try {
            \Illuminate\Support\Facades\Schema::create('morning_attendance', function ($t): void {
                $t->string('id', 100)->primary();
                $t->string('student_id', 100)->index();
                $t->string('class_id', 100)->nullable()->index();
                $t->string('record_date', 20)->index();
                $t->string('status', 10)->default('absent');
                $t->time('entry_time')->nullable();
                $t->integer('delay_minutes')->default(0);
                $t->boolean('is_acknowledged')->default(false)->index();
                $t->integer('sort_order')->default(0)->index();
                $t->longText('data');
                $t->timestamps();
                $t->unique(['student_id', 'record_date'], 'morning_attendance_student_date_unique');
            });
        } catch (\Throwable) {
            // ممکن است هم‌زمان توسط درخواست دیگری ساخته شده باشد
        }

        unset(self::$schemaCache["t:$table"]);

        return self::tableExists($table);
    }

    public static function columnExists(string $table, string $column): bool
    {
        return self::$schemaCache["c:$table.$column"] ??= \Illuminate\Support\Facades\Schema::hasColumn($table, $column);
    }

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
            'users' => array_filter([
                'username' => self::str($d, 'username', 100) ?: null,
                'name' => self::str($d, 'name', 191) ?? '',
                'role' => self::str($d, 'role', 40) ?? 'teacher',
                'phone' => self::str($d, 'phone', 30),
                'is_active' => ! (property_exists($d, 'isActive') && $d->isActive === false),
                'permissions' => (property_exists($d, 'permissions') && is_array($d->permissions))
                    ? json_encode(array_values(array_filter($d->permissions, 'is_string')), JSON_UNESCAPED_UNICODE)
                    : null,
            ], static fn ($v, $k) => $k !== 'permissions' || self::columnExists('users', 'permissions'), ARRAY_FILTER_USE_BOTH),
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
            'sessions' => array_filter([
                'class_id' => self::str($d, 'classId', 100),
                'teacher_id' => self::str($d, 'teacherId', 100),
                'subject' => self::str($d, 'subject', 191),
                'session_date' => self::str($d, 'date', 20),
                'subject_id' => self::str($d, 'subjectId', 100),
                'period_number' => isset($d->periodNumber) && is_numeric($d->periodNumber) ? (int) $d->periodNumber : null,
                'lesson_topic' => self::str($d, 'lessonTopic', 255),
            ], static fn ($v, $k) => ! in_array($k, ['subject_id', 'period_number', 'lesson_topic'], true)
                || self::columnExists('attendance_sessions', $k), ARRAY_FILTER_USE_BOTH),
            'morningAttendance' => self::morningAttendanceColumns($d),
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

    /** @return array<string, mixed> */
    private static function morningAttendanceColumns(object $d): array
    {
        $entry = self::str($d, 'entryTime', 8);
        $entry = $entry !== null && preg_match('/^([01]?\d|2[0-3]):[0-5]\d$/', $entry) ? $entry.':00' : null;
        $delay = isset($d->delayMinutes) && is_numeric($d->delayMinutes) ? max(0, min(1440, (int) $d->delayMinutes)) : 0;

        return [
            'student_id' => self::str($d, 'studentId', 100) ?? '',
            'class_id' => self::str($d, 'classId', 100),
            'record_date' => self::str($d, 'date', 20) ?? '',
            'status' => ($d->status ?? null) === 'present' ? 'present' : 'absent',
            'entry_time' => $entry,
            'delay_minutes' => $delay,
            'is_acknowledged' => ! empty($d->isAcknowledged),
        ];
    }

    public static function str(object $d, string $prop, int $max): ?string
    {
        if (! property_exists($d, $prop) || $d->{$prop} === null || ! is_scalar($d->{$prop})) {
            return null;
        }

        return mb_substr(trim((string) $d->{$prop}), 0, $max);
    }
}
