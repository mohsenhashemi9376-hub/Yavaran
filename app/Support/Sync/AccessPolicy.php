<?php

namespace App\Support\Sync;

use App\Models\NurturingRecord;
use App\Models\User;
use App\Support\NurturingAudit;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
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
        'schoolAnnouncements', 'grades', 'settings', 'comprehensiveExams', 'courseAssignments', 'gradePeriods', 'workshops', 'loanItems',
    ];

    /** مجموعه‌های کلاس‌محور که دبیر و مربی در کلاس‌های خود مجاز به ثبت آن‌ها هستند */
    private const CLASS_SCOPED = ['sessions', 'academicGrades', 'morningDelays', 'schoolAbsences', 'morningAttendance'];

    /** مجموعه‌های پرونده تربیتی (فقط تیم تربیتی) */
    private const NURTURING = ['observations', 'coachEvaluations', 'nurturingDossiers'];

    /** فعالیت‌های خارج از مدرسه: هر معلم فقط رکوردهای خودش را می‌نویسد */
    private const TEACHER_OWNED = ['teacherActivities'];

    private ?array $classIds = null;

    private ?array $nurturingIds = null;

    private ?array $defaultCourses = null;

    private ?array $courseKeys = null;

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

        // امانات و لوازم مدرسه فقط برای مدیر و معاونین دارای مجوز قابل مشاهده است
        if ($collection === 'loanItems') {
            return $this->isManager() && $this->user->hasPermission('manage-loans');
        }

        if ($collection === 'nurturingDossiers') {
            // پرونده‌های تربیتی فقط برای مربی و معاون تربیتی قابل مشاهده است
            return in_array($this->user->role, \App\Policies\NurturingRecordPolicy::ROLES, true)
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
        'workshops' => 'manage-curriculum',
        'loanItems' => 'manage-loans',
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

    /**
     * بررسی Policy پرونده‌های تربیتی / مشاهدات (NurturingRecordPolicy)؛ در صورت رد، 403 برمی‌گرداند.
     */
    private function authorizeNurturing(string $ability, string $collection, object $record, bool $audit = true): void
    {
        $model = NurturingRecord::fromData($collection, $record);
        $recordId = isset($record->id) && is_scalar($record->id) ? (string) $record->id : null;
        try {
            Gate::forUser($this->user)->authorize($ability, $model);
            if ($audit) {
                NurturingAudit::log($this->user, $ability, $collection, $model->student_id, $recordId);
            }
        } catch (AuthorizationException $e) {
            NurturingAudit::log($this->user, $ability, $collection, $model->student_id, $recordId, false);
            $this->deny($e->getMessage() !== '' ? $e->getMessage() : 'شما به این پرونده تربیتی دسترسی ندارید.');
        }
    }

    public function authorizeUpsert(string $collection, ?object $old, object $new): void
    {
        $this->requireWritePermission($collection);

        if (in_array($collection, self::NURTURING, true)) {
            if ($old !== null) {
                $this->authorizeNurturing('update', $collection, $old, false);
            }
            $this->authorizeNurturing($old === null ? 'create' : 'update', $collection, $new);

            return;
        }

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

            if ($collection === 'academicGrades') {
                if ($old !== null) {
                    $this->requireCourse($old);
                }
                $this->requireCourse($new);
            }

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

        if (in_array($collection, self::NURTURING, true)) {
            $this->authorizeNurturing('delete', $collection, $old);

            return;
        }

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
            if ($collection === 'academicGrades') {
                $this->requireCourse($old);
            }

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

        foreach ($this->defaultSubjectTeacherCourses() as $course) {
            $ids[] = $course['classId'];
        }

        return $this->classIds = array_values(array_unique($ids));
    }

    /**
     * جفت «کلاس + درس» هایی که کاربر از طریق «دبیر پیش‌فرض درس» (انتخاب‌شده در مدیریت دروس) تدریس می‌کند.
     * رابط کاربری این انتساب را بدون ردیف جداگانه در course_assignments محاسبه می‌کند؛
     * اگر برای همان کلاس و درس انتساب صریح وجود داشته باشد، همان مقدم است.
     *
     * @return array<int, array{classId: string, subjectId: string}>
     */
    private function defaultSubjectTeacherCourses(): array
    {
        if ($this->defaultCourses !== null) {
            return $this->defaultCourses;
        }
        if (! CollectionRegistry::tableExists('academic_subjects')) {
            return $this->defaultCourses = [];
        }

        $subjects = [];
        foreach (DB::table('academic_subjects')->get(['id', 'data']) as $row) {
            $subject = json_decode((string) $row->data, false);
            if (is_object($subject) && isset($subject->teacherId) && $subject->teacherId === $this->user->id) {
                $subjects[(string) $row->id] = $subject;
            }
        }
        if ($subjects === []) {
            return $this->defaultCourses = [];
        }

        $explicit = [];
        if (CollectionRegistry::tableExists('course_assignments')) {
            foreach (DB::table('course_assignments')->get(['class_id', 'subject_id']) as $a) {
                $explicit[$a->class_id.'|'.$a->subject_id] = true;
            }
        }

        $courses = [];
        foreach (DB::table('school_classes')->get(['id', 'data']) as $row) {
            $class = json_decode((string) $row->data, false);
            $grade = is_object($class) && isset($class->grade) && is_string($class->grade) ? $class->grade : '';
            foreach ($subjects as $subjectId => $subject) {
                if (isset($explicit[$row->id.'|'.$subjectId])) {
                    continue;
                }
                if ($this->subjectAppliesToGrade($subject, $grade)) {
                    $courses[] = ['classId' => (string) $row->id, 'subjectId' => (string) $subjectId];
                }
            }
        }

        return $this->defaultCourses = $courses;
    }

    /**
     * جلسه‌ای که دبیر مجاز به دیدن آن است: خودش ثبت کرده یا درس آن در همان کلاس به او واگذار شده
     * (معادل isOwnTeachingSession در رابط کاربری).
     */
    public function canSeeSession(object $session): bool
    {
        $classId = $this->prop($session, 'classId');
        if ($classId === null) {
            return false;
        }
        if ($this->prop($session, 'teacherId') === $this->user->id) {
            return true;
        }

        $subjectId = $this->prop($session, 'subjectId');
        $subjectName = $this->prop($session, 'subject');

        $courses = $this->teachingCourses();

        if ($subjectId !== null && $subjectId !== '') {
            return isset($courses['id'][$classId.'|'.$subjectId]);
        }

        return $subjectName !== null && isset($courses['name'][$classId.'|'.$subjectName]);
    }

    /** @return array{id: array<string, true>, name: array<string, true>} */
    private function teachingCourses(): array
    {
        if ($this->courseKeys !== null) {
            return $this->courseKeys;
        }

        $subjectNames = [];
        if (CollectionRegistry::tableExists('academic_subjects')) {
            $subjectNames = DB::table('academic_subjects')->pluck('name', 'id')->all();
        }

        $keys = ['id' => [], 'name' => []];
        $add = function (string $classId, string $subjectId, ?string $name) use (&$keys, $subjectNames): void {
            $keys['id'][$classId.'|'.$subjectId] = true;
            $name ??= $subjectNames[$subjectId] ?? null;
            if ($name !== null && $name !== '') {
                $keys['name'][$classId.'|'.$name] = true;
            }
        };

        // انتساب سه‌طرفه صریح
        if (CollectionRegistry::tableExists('course_assignments')) {
            foreach (DB::table('course_assignments')->where('user_id', $this->user->id)->get(['class_id', 'subject_id']) as $a) {
                $add((string) $a->class_id, (string) $a->subject_id, null);
            }
        }

        // دبیر پیش‌فرض درس
        foreach ($this->defaultSubjectTeacherCourses() as $c) {
            $add($c['classId'], $c['subjectId'], null);
        }

        // انتساب‌های قدیمی ذخیره‌شده در پروفایل کاربر
        $profile = $this->user->profile();
        if (isset($profile->teachingAssignments) && is_array($profile->teachingAssignments)) {
            foreach ($profile->teachingAssignments as $ta) {
                if (! is_object($ta) || ! isset($ta->classIds) || ! is_array($ta->classIds)) {
                    continue;
                }
                $sid = isset($ta->subjectId) && is_string($ta->subjectId) ? $ta->subjectId : '';
                $sname = isset($ta->subjectName) && is_string($ta->subjectName) ? $ta->subjectName : null;
                foreach ($ta->classIds as $cid) {
                    if (is_string($cid)) {
                        $add($cid, $sid, $sname);
                    }
                }
            }
        }

        return $this->courseKeys = $keys;
    }

    /** معادل subjectAppliesToClass در رابط کاربری (دروس عمومی/بدون پایه برای همه‌ی کلاس‌ها) */
    private function subjectAppliesToGrade(object $subject, string $classGrade): bool
    {
        $normalize = static fn (string $g): string => trim(str_replace('پایه', '', $g));

        $raw = isset($subject->targetGrades) && is_array($subject->targetGrades) ? $subject->targetGrades : [];
        if (isset($subject->grade) && is_string($subject->grade) && $subject->grade !== '') {
            $raw[] = $subject->grade;
        }

        $grades = [];
        foreach ($raw as $g) {
            if (! is_string($g)) {
                continue;
            }
            $g = $normalize($g);
            if ($g !== '' && ! str_contains($g, 'عمومی')) {
                $grades[] = $g;
            }
        }
        if ($grades === []) {
            return true;
        }

        $cg = $normalize($classGrade);
        foreach ($grades as $g) {
            if ($g === $cg || str_contains($cg, $g) || str_contains($g, $cg)) {
                return true;
            }
        }

        return false;
    }

    /**
     * کلاس‌های تحت مسئولیت تربیتی کاربر: برای مربی فقط کلاس‌های انتسابی خودش
     * (نه کلاس‌هایی که صرفاً در آن‌ها تدریس می‌کند).
     *
     * @return array<int, string>
     */
    public function nurturingClassIds(): array
    {
        if (! $this->isCoach()) {
            return $this->accessibleClassIds();
        }
        if ($this->nurturingIds !== null) {
            return $this->nurturingIds;
        }

        $profile = $this->user->profile();
        $ids = [];
        if (isset($profile->assignedClassIds) && is_array($profile->assignedClassIds)) {
            foreach ($profile->assignedClassIds as $id) {
                if (is_string($id)) {
                    $ids[] = $id;
                }
            }
        }

        foreach (DB::table('school_classes')->get(['id', 'data']) as $row) {
            $class = json_decode((string) $row->data, false);
            $coachIds = is_object($class) && isset($class->coachIds) && is_array($class->coachIds) ? $class->coachIds : [];
            $coachId = is_object($class) && isset($class->coachId) ? $class->coachId : null;
            if ($coachId === $this->user->id || in_array($this->user->id, $coachIds, true)) {
                $ids[] = (string) $row->id;
            }
        }

        return $this->nurturingIds = array_values(array_unique($ids));
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

    /** هر دبیر فقط برای درسی که خودش در آن کلاس تدریس می‌کند نمره ثبت می‌کند (مدیر و معاون آموزش مستثنی‌اند) */
    private function requireCourse(object $record): void
    {
        $classId = $this->prop($record, 'classId');
        $subjectId = $this->prop($record, 'subjectId');
        $courses = $this->teachingCourses();

        if ($classId === null || $subjectId === null || ! isset($courses['id'][$classId.'|'.$subjectId])) {
            $this->deny('شما فقط مجاز به ثبت نمره برای درس خودتان در این کلاس هستید.');
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

        $classId = $this->studentClassCache[$studentId];
        if ($classId === null || $classId === '' || ! in_array($classId, $this->nurturingClassIds(), true)) {
            $this->deny('شما به اطلاعات این کلاس دسترسی ندارید.');
        }
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
