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
        'teacherActivities' => 'teacher_activities',
        'gradePeriods' => 'grade_periods',
        'workshops' => 'workshops',
        'loanItems' => 'loan_items',
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
            if ($table === 'morning_attendance') {
                self::ensureMorningAttendanceColumns();
            }
            if ($table === 'workshops') {
                self::ensureWorkshopGradeLevel();
            }

            return true;
        }
        if ($table === 'workshops') {
            try {
                \Illuminate\Support\Facades\Schema::create('workshops', function ($t): void {
                    $t->string('id', 100)->primary();
                    $t->string('name', 100)->default('');
                    $t->string('type', 20)->default('workshop');
                    $t->string('category', 20)->default('scientific');
                    $t->unsignedTinyInteger('grade_level')->default(8)->index();
                    $t->string('teacher_id', 100)->nullable()->index();
                    $t->integer('sort_order')->default(0)->index();
                    $t->longText('data');
                    $t->timestamps();
                });
                self::seedWorkshops();
            } catch (\Throwable) {
            }
            unset(self::$schemaCache["t:$table"]);

            return self::tableExists($table);
        }
        if ($table === 'loan_items') {
            try {
                \Illuminate\Support\Facades\Schema::create('loan_items', function ($t): void {
                    $t->string('id', 100)->primary();
                    $t->string('item_name', 191)->default('');
                    $t->string('recipient_name', 191)->default('');
                    $t->string('loan_date', 20)->nullable()->index();
                    $t->boolean('is_returned')->default(false)->index();
                    $t->integer('sort_order')->default(0)->index();
                    $t->longText('data');
                    $t->timestamps();
                });
            } catch (\Throwable) {
            }
            unset(self::$schemaCache["t:$table"]);

            return self::tableExists($table);
        }
        if ($table === 'grade_periods') {
            try {
                \Illuminate\Support\Facades\Schema::create('grade_periods', function ($t): void {
                    $t->string('id', 100)->primary();
                    $t->string('name', 100)->default('');
                    $t->string('code', 50)->index();
                    $t->boolean('is_active')->default(false);
                    $t->date('deadline')->nullable();
                    $t->integer('sort_order')->default(0)->index();
                    $t->longText('data');
                    $t->timestamps();
                });
                self::seedGradePeriods();
            } catch (\Throwable) {
            }
            unset(self::$schemaCache["t:$table"]);

            return self::tableExists($table);
        }
        if ($table === 'teacher_activities') {
            try {
                \Illuminate\Support\Facades\Schema::create('teacher_activities', function ($t): void {
                    $t->string('id', 100)->primary();
                    $t->string('teacher_id', 100)->index();
                    $t->date('date')->index();
                    $t->text('activity_title');
                    $t->decimal('hours', 4, 2)->default(0);
                    $t->string('status', 20)->default('approved');
                    $t->integer('sort_order')->default(0)->index();
                    $t->longText('data');
                    $t->timestamps();
                });
            } catch (\Throwable) {
            }
            unset(self::$schemaCache["t:$table"]);

            return self::tableExists($table);
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
                $t->boolean('is_excused')->nullable()->default(false);
                $t->text('absence_note')->nullable();
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

    /** بازه‌های پیش‌فرض ثبت نمره؛ فقط «مستمر مهر» فعال است */
    public const GRADE_PERIODS = [
        'mehrContinuous' => 'مستمر مهر',
        'abanContinuous' => 'مستمر آبان',
        'azarContinuous' => 'مستمر آذر',
        'term1Continuous' => 'مستمر دی',
        'term1Final' => 'پایانی نوبت اول (دی)',
        'bahmanContinuous' => 'مستمر بهمن',
        'esfandContinuous' => 'مستمر اسفند',
        'farvardinContinuous' => 'مستمر فروردین',
        'ordibeheshtContinuous' => 'مستمر اردیبهشت',
        'term2Continuous' => 'مستمر ترم دوم (خرداد)',
        'term2Final' => 'پایانی نوبت دوم (خرداد)',
    ];

    private static function seedGradePeriods(): void
    {
        $now = now();
        $order = 0;
        foreach (self::GRADE_PERIODS as $code => $name) {
            $active = $code === 'mehrContinuous';
            \Illuminate\Support\Facades\DB::table('grade_periods')->insertOrIgnore([
                'id' => $code,
                'name' => $name,
                'code' => $code,
                'is_active' => $active,
                'sort_order' => $order++,
                'data' => json_encode(['id' => $code, 'code' => $code, 'name' => $name, 'isActive' => $active], JSON_UNESCAPED_UNICODE),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /** ۱۲ کارگاه: ۶ کارگاه پایه هشتم (شناسه‌های قدیمی) و ۶ کارگاه پایه نهم */
    private static function seedWorkshops(): void
    {
        $defs = [['medicine', 'طب', 'scientific'], ['social', 'روابط اجتماعی', 'scientific'], ['history', 'تاریخ', 'scientific'], ['technical', 'فنی', 'skill'], ['writing', 'نویسندگی', 'skill'], ['ai', 'هوش مصنوعی', 'skill']];
        $now = now();
        $hasGrade = \Illuminate\Support\Facades\Schema::hasColumn('workshops', 'grade_level');
        foreach ([8, 9] as $gi => $grade) {
            foreach ($defs as $i => [$slug, $name, $cat]) {
                $id = $grade === 8 ? "ws-$slug" : "ws9-$slug";
                $row = [
                    'id' => $id, 'name' => $name, 'type' => 'workshop', 'category' => $cat, 'sort_order' => $gi * 6 + $i,
                    'data' => json_encode(['id' => $id, 'name' => $name, 'category' => $cat, 'gradeLevel' => $grade, 'studentIds' => []], JSON_UNESCAPED_UNICODE),
                    'created_at' => $now, 'updated_at' => $now,
                ];
                if ($hasGrade) {
                    $row['grade_level'] = $grade;
                }
                \Illuminate\Support\Facades\DB::table('workshops')->insertOrIgnore($row);
            }
        }
    }

    /** ارتقای جدول workshops موجود: ستون grade_level + کارگاه‌های پایه نهم */
    private static function ensureWorkshopGradeLevel(): void
    {
        if (isset(self::$schemaCache['ws-grade'])) {
            return;
        }
        self::$schemaCache['ws-grade'] = true;

        try {
            $schema = \Illuminate\Support\Facades\Schema::class;
            if (! $schema::hasColumn('workshops', 'grade_level')) {
                $schema::table('workshops', fn ($t) => $t->unsignedTinyInteger('grade_level')->default(8)->after('category'));
                \Illuminate\Support\Facades\DB::table('workshops')->where('id', 'like', 'ws-%')->update(['grade_level' => 8]);
                unset(self::$schemaCache['c:workshops.grade_level']);
                // کارگاه‌های پایه نهم فقط هنگام ارتقای جدول افزوده می‌شوند (تا کارگاه حذف‌شده دوباره ساخته نشود)
                if (! \Illuminate\Support\Facades\DB::table('workshops')->where('id', 'like', 'ws9-%')->exists()) {
                    self::seedWorkshops();
                }
            }
        } catch (\Throwable) {
        }
    }

    /** افزودن خودکار ستون‌های is_excused و absence_note به جدول موجود (در صورت نبودن) */
    private static function ensureMorningAttendanceColumns(): void
    {
        if (isset(self::$schemaCache['ma-cols'])) {
            return;
        }
        self::$schemaCache['ma-cols'] = true;

        try {
            $schema = \Illuminate\Support\Facades\Schema::class;
            if (! $schema::hasColumn('morning_attendance', 'is_excused')) {
                $schema::table('morning_attendance', fn ($t) => $t->boolean('is_excused')->nullable()->default(false));
            }
            if (! $schema::hasColumn('morning_attendance', 'absence_note')) {
                $schema::table('morning_attendance', fn ($t) => $t->text('absence_note')->nullable());
            }
            unset(self::$schemaCache['c:morning_attendance.is_excused'], self::$schemaCache['c:morning_attendance.absence_note']);
        } catch (\Throwable) {
        }
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
                'homework' => self::str($d, 'homeworkDescription', 5000),
            ], static fn ($v, $k) => ! in_array($k, ['subject_id', 'period_number', 'lesson_topic', 'homework'], true)
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
            'gradePeriods' => [
                'name' => self::str($d, 'name', 100) ?? '',
                'code' => self::str($d, 'code', 50) ?? (self::str($d, 'id', 50) ?? ''),
                'is_active' => ! empty($d->isActive),
                'deadline' => \App\Support\Jalali::shamsiToDate(self::str($d, 'deadline', 20)),
            ],
            'workshops' => array_filter([
                'name' => self::str($d, 'name', 100) ?? '',
                'type' => 'workshop',
                'category' => ($d->category ?? null) === 'skill' ? 'skill' : 'scientific',
                'grade_level' => ((int) ($d->gradeLevel ?? 8)) === 9 ? 9 : 8,
                'teacher_id' => self::str($d, 'teacherId', 100),
            ], static fn ($v, $k) => $k !== 'grade_level' || self::columnExists('workshops', 'grade_level'), ARRAY_FILTER_USE_BOTH),
            'loanItems' => [
                'item_name' => self::str($d, 'itemName', 191) ?? '',
                'recipient_name' => self::str($d, 'recipientName', 191) ?? '',
                'loan_date' => self::str($d, 'loanDate', 20),
                'is_returned' => ! empty($d->returned),
            ],
            'teacherActivities' => [
                'teacher_id' => self::str($d, 'teacherId', 100) ?? '',
                'date' => \App\Support\Jalali::shamsiToDate(self::str($d, 'date', 20)) ?? now()->toDateString(),
                'activity_title' => self::str($d, 'title', 2000) ?? '',
                'hours' => isset($d->hours) && is_numeric($d->hours) ? max(0, min(24, round((float) $d->hours, 2))) : 0,
                'status' => ($d->status ?? null) === 'pending' ? 'pending' : 'approved',
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

        $columns = [
            'student_id' => self::str($d, 'studentId', 100) ?? '',
            'class_id' => self::str($d, 'classId', 100),
            'record_date' => self::str($d, 'date', 20) ?? '',
            'status' => ($d->status ?? null) === 'present' ? 'present' : 'absent',
            'entry_time' => $entry,
            'delay_minutes' => $delay,
            'is_acknowledged' => ! empty($d->isAcknowledged),
            'is_excused' => ! empty($d->isExcused),
            'absence_note' => self::str($d, 'absenceNote', 2000),
        ];

        // سازگاری با جدول‌های ساخته‌شده پیش از افزودن ستون‌های موجه/یادداشت
        foreach (['is_excused', 'absence_note'] as $optional) {
            if (! self::columnExists('morning_attendance', $optional)) {
                unset($columns[$optional]);
            }
        }

        return $columns;
    }

    public static function str(object $d, string $prop, int $max): ?string
    {
        if (! property_exists($d, $prop) || $d->{$prop} === null || ! is_scalar($d->{$prop})) {
            return null;
        }

        return mb_substr(trim((string) $d->{$prop}), 0, $max);
    }
}
