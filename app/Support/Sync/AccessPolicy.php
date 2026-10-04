<?php

namespace App\Support\Sync;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * قواعد دسترسی سمت سرور بر اساس نقش کاربر.
 * رابط کاربری نقش‌ها را فیلتر می‌کند؛ این کلاس تضمین می‌کند که
 * هیچ درخواستی خارج از حیطه نقش کاربر روی دیتابیس اعمال نشود.
 */
final class AccessPolicy
{
    public const MANAGER_ROLES = [
        'admin', 'vice_educational', 'vice_disciplinary', 'vice_nurturing', 'vice_principal',
    ];

    /** مجموعه‌هایی که فقط مدیر و معاونین مجاز به تغییر آن‌ها هستند */
    private const MANAGER_ONLY = [
        'users', 'classes', 'bellPeriods', 'academicSubjects', 'teacherEvaluations',
        'schoolAnnouncements', 'grades', 'settings', 'comprehensiveExams', 'courseAssignments', 'gradePeriods',
    ];

    /** مجموعه‌های کلاس‌محور که دبیر و مربی در کلاس‌های خود مجاز به ثبت آن‌ها هستند */
    private const CLASS_SCOPED = ['sessions', 'academicGrades', 'morningDelays', 'schoolAbsences', 'morningAttendance'];

    /** مجموعه‌های پرونده تربیتی (فقط تیم تربیتی) */
    private const NURTURING = ['observations', 'coachEvaluations', 'nurturingDossiers'];

    /** فعالیت‌های خارج از مدرسه: هر معلم فقط رکوردهای خودش را می‌نویسد */
    private const TEACHER_OWNED = ['teacherActivities'];

    private ?array $classIds = null;

    /** @var array<string, string|null> */
    private array $studentClassCache = [];

    public function __construct(private readonly User $user)
    {
    }

    public function userId(): string
    {
        return (string) $this->user->id;
    }

    public function isManager(): bool
    {
        return in_array($this->user->role, self::MANAGER_ROLES, true);
    }

    public function isAdmin(): bool
    {
        return $this->user->role === 'admin';
    }

    public function isCoach(): bool
    {
        return $this->user->role === 'coach';
    }

    public function canRead(string $collection): bool
    {
        // نمرات آزمون جامع فقط برای مدیر و معاونین قابل مشاهده است
        if ($collection === 'comprehensiveExams') {
            return $this->isManager() && $this->user->hasPermission('comprehensive-exam');
        }

        if ($collection === 'nurturingDossiers') {
            // پرونده‌های تربیتی برای مدیر مدرسه قابل مشاهده نیست
            return (($this->isManager() && ! $this->isAdmin()) || $this->isCoach())
                && $this->user->hasPermission('view-nurturing-file');
        }

        return true;
    }

    /** مجوز لازم برای نوشتن در هر مجموعه (علاوه بر نقش) */
    private const WRITE_PERMISSION = [
        'academicGrades' => 'manage-grades',
        'sessions' => 'manage-attendance',
        'morningDelays' => 'manage-attendance',
        'schoolAbsences' => 'manage-attendance',
        'morningAttendance' => 'manage-attendance',
        'observations' => 'counseling-report',
        'coachEvaluations' => 'counseling-report',
        'nurturingDossiers' => 'counseling-report',
        'comprehensiveExams' => 'comprehensive-exam',
        'academicSubjects' => 'manage-curriculum',
        'courseAssignments' => 'manage-curriculum',
        'gradePeriods' => 'manage-grades',
        'bellPeriods' => 'manage-curriculum',
        'classes' => 'manage-classes',
        'settings' => 'school-settings',
        'schoolAnnouncements' => 'manage-announcements',
        'teacherEvaluations' => 'evaluate-teachers',
        'grades' => 'school-settings',
    ];

    private function requireWritePermission(string $collection): void
    {
        $key = self::WRITE_PERMISSION[$collection] ?? null;
        if ($key !== null && ! $this->user->hasPermission($key)) {
            $this->deny('شما به این بخش از سامانه دسترسی ندارید. لطفاً با مدیر مدرسه هماهنگ کنید.');
        }
    }

    public function authorizeUpsert(string $collection, ?object $old, object $new): void
    {
        $this->requireWritePermission($collection);

        if ($collection === 'users') {
            $this->authorizeUserWrite($old, $new);

            return;
        }

        if ($this->isAdmin() && in_array($collection, self::NURTURING, true)) {
            $this->deny();
        }

        if ($this->isManager()) {
            return;
        }

        if ($collection === 'academicGrades') {
            $this->requireOpenGradePeriods($old, $new);
        }

        if (in_array($collection, self::TEACHER_OWNED, true)) {
            if ($old !== null) {
                $this->requireOwner($this->prop($old, 'teacherId'));
            }
            $this->requireOwner($this->prop($new, 'teacherId'));

            return;
        }

        if (in_array($collection, self::MANAGER_ONLY, true)) {
            $this->deny();
        }

        if ($collection === 'students') {
            $newClass = $this->prop($new, 'classId');
            if ($old === null) {
                $this->requireClass($newClass);
            } else {
                $this->requireClass($this->prop($old, 'classId'));
                if ($newClass !== '' && $newClass !== null) {
                    $this->requireClass($newClass);
                }
            }

            return;
        }

        if (in_array($collection, self::CLASS_SCOPED, true)) {
            if ($old !== null) {
                $this->requireClass($this->prop($old, 'classId'));
            }
            $this->requireClass($this->prop($new, 'classId'));

            return;
        }

        if (in_array($collection, self::NURTURING, true)) {
            if (! $this->isCoach()) {
                $this->deny();
            }
            if ($old !== null) {
                $this->requireStudent($this->studentIdOf($collection, $old));
            }
            $this->requireStudent($this->studentIdOf($collection, $new));

            return;
        }

        $this->deny();
    }

    public function authorizeDelete(string $collection, object $old): void
    {
        $this->requireWritePermission($collection);

        if ($collection === 'users') {
            if (! $this->isManager()) {
                $this->deny();
            }
            if ($this->prop($old, 'id') === $this->user->id) {
                $this->deny('امکان حذف حساب کاربری جاری وجود ندارد.');
            }
            if ($this->prop($old, 'role') === 'admin' && ! $this->isAdmin()) {
                $this->deny('فقط مدیر سامانه مجاز به حذف حساب مدیریت است.');
            }

            return;
        }

        if ($this->isAdmin() && in_array($collection, self::NURTURING, true)) {
            $this->deny();
        }

        if ($this->isManager()) {
            return;
        }

        if (in_array($collection, self::TEACHER_OWNED, true)) {
            $this->requireOwner($this->prop($old, 'teacherId'));

            return;
        }

        if (in_array($collection, self::CLASS_SCOPED, true)) {
            $this->requireClass($this->prop($old, 'classId'));

            return;
        }

        if (in_array($collection, self::NURTURING, true) && $this->isCoach()) {
            $this->requireStudent($this->studentIdOf($collection, $old));

            return;
        }

        $this->deny();
    }

    private function authorizeUserWrite(?object $old, object $new): void
    {
        if (! $this->isManager()) {
            $this->deny();
        }

        $newRole = $this->prop($new, 'role');
        if (! in_array($newRole, CollectionRegistry::ROLES, true)) {
            abort(422, 'نقش کاربری نامعتبر است.');
        }

        $oldRole = $old ? $this->prop($old, 'role') : null;

        // تغییر ماتریس دسترسی‌ها فقط توسط مدیر سامانه
        $oldPerms = $old && property_exists($old, 'permissions') ? $old->permissions : null;
        $newPerms = property_exists($new, 'permissions') ? $new->permissions : null;
        if (! $this->isAdmin() && json_encode($oldPerms) !== json_encode($newPerms)) {
            $this->deny('فقط مدیر سامانه مجاز به تغییر سطوح دسترسی کاربران است.');
        }

        if (! $this->isAdmin() && ($newRole === 'admin' || $oldRole === 'admin')) {
            $this->deny('فقط مدیر سامانه مجاز به ایجاد یا ویرایش حساب مدیریت است.');
        }

        if ($old !== null && $this->prop($old, 'id') === $this->user->id && $oldRole !== $newRole) {
            $this->deny('امکان تغییر نقش حساب کاربری جاری وجود ندارد.');
        }
    }

    /**
     * شناسه کلاس‌هایی که کاربر (دبیر / مربی) به آن‌ها دسترسی دارد.
     *
     * @return array<int, string>
     */
    public function accessibleClassIds(): array
    {
        if ($this->classIds !== null) {
            return $this->classIds;
        }

        $profile = $this->user->profile();
        $ids = [];

        foreach (['assignedClassIds', 'teachingClassIds'] as $key) {
            if (isset($profile->{$key}) && is_array($profile->{$key})) {
                foreach ($profile->{$key} as $id) {
                    if (is_string($id)) {
                        $ids[] = $id;
                    }
                }
            }
        }

        if (isset($profile->teachingAssignments) && is_array($profile->teachingAssignments)) {
            foreach ($profile->teachingAssignments as $assignment) {
                if (is_object($assignment) && isset($assignment->classIds) && is_array($assignment->classIds)) {
                    foreach ($assignment->classIds as $id) {
                        if (is_string($id)) {
                            $ids[] = $id;
                        }
                    }
                }
            }
        }

        foreach (DB::table('school_classes')->get(['id', 'data']) as $row) {
            $class = json_decode((string) $row->data, false);
            $teacherIds = is_object($class) && isset($class->teacherIds) && is_array($class->teacherIds) ? $class->teacherIds : [];
            $coachIds = is_object($class) && isset($class->coachIds) && is_array($class->coachIds) ? $class->coachIds : [];
            $coachId = is_object($class) && isset($class->coachId) ? $class->coachId : null;

            if (in_array($this->user->id, $teacherIds, true)
                || ($this->isCoach() && ($coachId === $this->user->id || in_array($this->user->id, $coachIds, true)))) {
                $ids[] = (string) $row->id;
            }
        }

        // انتساب سه‌طرفه (کلاس + درس + استاد) مستقل از نقش اصلی کاربر
        if (CollectionRegistry::tableExists('course_assignments')) {
            foreach (DB::table('course_assignments')->where('user_id', $this->user->id)->pluck('class_id') as $classId) {
                $ids[] = (string) $classId;
            }
        }

        return $this->classIds = array_values(array_unique($ids));
    }

    /** معلم فقط در بازه‌های فعال‌شده توسط معاونت آموزش مجاز به تغییر نمره است */
    private function requireOpenGradePeriods(?object $old, object $new): void
    {
        if (! CollectionRegistry::tableExists('grade_periods')) {
            return;
        }

        $periods = DB::table('grade_periods')->pluck('is_active', 'code')->all();
        if ($periods === []) {
            return;
        }

        foreach ($periods as $code => $active) {
            if ($active) {
                continue;
            }
            $before = $old !== null && isset($old->{$code}) ? (string) $old->{$code} : '';
            $after = isset($new->{$code}) ? (string) $new->{$code} : '';
            if ($before !== $after) {
                $this->deny('ثبت نمره برای این بازه هنوز توسط معاونت آموزش باز نشده است.');
            }
        }
    }

    private function requireOwner(?string $teacherId): void
    {
        if ($teacherId === null || $teacherId !== $this->user->id) {
            $this->deny('فقط ثبت‌کننده مجاز به تغییر این مورد است.');
        }
    }

    private function requireClass(?string $classId): void
    {
        if ($classId === null || $classId === '' || ! in_array($classId, $this->accessibleClassIds(), true)) {
            $this->deny('شما به اطلاعات این کلاس دسترسی ندارید.');
        }
    }

    private function requireStudent(?string $studentId): void
    {
        if ($studentId === null || $studentId === '') {
            $this->deny();
        }

        if (! array_key_exists($studentId, $this->studentClassCache)) {
            $this->studentClassCache[$studentId] = DB::table('students')->where('id', $studentId)->value('class_id');
        }

        $this->requireClass($this->studentClassCache[$studentId]);
    }

    private function studentIdOf(string $collection, object $record): ?string
    {
        if ($collection === 'nurturingDossiers') {
            return $this->prop($record, 'studentId') ?? $this->prop($record, 'id');
        }

        return $this->prop($record, 'studentId');
    }

    private function prop(object $record, string $key): ?string
    {
        return isset($record->{$key}) && is_scalar($record->{$key}) ? (string) $record->{$key} : null;
    }

    private function deny(string $message = 'شما مجوز انجام این عملیات را ندارید.'): never
    {
        throw new AccessDeniedHttpException($message);
    }
}
