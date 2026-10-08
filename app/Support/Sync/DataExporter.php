<?php

namespace App\Support\Sync;

use App\Models\NurturingRecord;
use App\Models\StudentObservation;
use App\Models\User;
use App\Support\NurturingAudit;
use App\Policies\NurturingRecordPolicy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * ساخت بسته اطلاعات اولیه (bootstrap) برای رابط کاربری بر اساس نقش کاربر.
 * داده‌ها بدون decode/encode مجدد عیناً ارسال می‌شوند تا ساختار JSON حفظ شود.
 */
final class DataExporter
{
    public function json(User $user): string
    {
        // رمز اجباری هنوز تغییر نکرده: هیچ داده‌ای ارسال نمی‌شود
        if ($user->mustChangePassword()) {
            return '{"authenticated":true,"mustChangePassword":true,'
                .'"userId":'.json_encode($user->id, SyncService::JSON_FLAGS).','
                .'"serverTime":'.((int) round(microtime(true) * 1000)).',"data":{}}';
        }

        $policy = new AccessPolicy($user);
        $parts = [];

        foreach (CollectionRegistry::TABLES as $collection => $table) {
            $parts[] = json_encode($collection).':['.implode(',', $this->rows($user, $policy, $collection, $table)).']';
        }

        return '{"authenticated":true,'
            .'"userId":'.json_encode($user->id, SyncService::JSON_FLAGS).','
            .'"serverTime":'.((int) round(microtime(true) * 1000)).','
            .'"security":'.json_encode([
                'twoFactorEnabled' => $user->hasTwoFactor(),
                'twoFactorRequired' => $user->requiresTwoFactor(),
                'reauthRequired' => $user->requiresReauth() && ! \App\Support\PasswordConfirmation::isFresh(false),
            ]).','
            .'"data":{'.implode(',', $parts).'}}';
    }

    /**
     * @return array<int, string>
     */
    private function rows(User $user, AccessPolicy $policy, string $collection, string $table): array
    {
        if (! $policy->canRead($collection) || ! CollectionRegistry::ensureTable($table)) {
            return [];
        }

        // پرونده‌های تربیتی و مشاهدات رفتاری: فقط با تأیید Policy و فقط برای دانش‌آموزان مجاز کاربر؛ محتوا رمزگشایی می‌شود
        if ($sensitive = NurturingRecord::modelFor($collection)) {
            $gate = Gate::forUser($user);
            if (! $gate->allows('viewAny', $sensitive)) {
                // تلاش کاربر غیرمجاز: فقط هنگام ورود ثبت می‌شود تا لاگ پر نشود
                if (in_array($user->role, ['admin', 'coach', 'vice_nurturing', 'vice_educational', 'vice_disciplinary', 'vice_principal'], true)) {
                    NurturingAudit::logList($user, $collection, 0);
                }

                return [];
            }
            $query = $sensitive::query()->orderBy('sort_order')->orderBy('id');
            if ($sensitive === StudentObservation::class) {
                StudentObservation::ensureAuthorColumns();
                // مربی فقط مشاهده‌هایی را می‌بیند که خودش نوشته است (نه معاون تربیتی، نه مربی دیگر)
                if ($user->role === 'coach') {
                    $query->where('author_id', $user->id);
                }
            }
            $scope = app(NurturingRecordPolicy::class)->scopeStudentIds($user);
            if ($scope !== null) {
                $query->whereIn('student_id', $scope);
            }

            $rows = $query->get()
                ->pluck('data')
                ->filter(static fn ($json) => is_string($json) && $json !== '')
                ->values()
                ->all();
            NurturingAudit::logList($user, $collection, count($rows));

            return $rows;
        }

        $query = DB::table($table)->orderBy('sort_order')->orderBy('id');

        if ($policy->isTeacher()) {
            return $this->teacherRows($user, $policy, $collection, $query);
        }

        // کاربرگ: مربی فقط رکوردهای کلاس‌های خودش را می‌گیرد
        if ($collection === 'worksheets' && $policy->isCoach()) {
            $query->whereIn('class_id', $policy->nurturingClassIds());
        }

        if (in_array($collection, ['teacherEvaluations', 'teacherActivities'], true) && ! $policy->isManager()) {
            $query->where('teacher_id', $user->id);
        }

        // دسترسی محدود (Scoped Access): مربی فقط دانش‌آموزان کلاس‌های خود را دریافت می‌کند
        if ($collection === 'students' && ! $policy->isManager() && $policy->isCoach()) {
            $query->whereIn('class_id', $policy->accessibleClassIds());
        }

        // دبیر فقط جلسات خودش را دریافت می‌کند (نه جلسات سایر دبیران در همان کلاس‌ها)
        if ($collection === 'sessions' && $user->role === 'teacher') {
            return $query->pluck('data')
                ->filter(static function ($json) use ($policy): bool {
                    if (! is_string($json) || $json === '') {
                        return false;
                    }
                    $session = json_decode($json, false);

                    return is_object($session) && $policy->canSeeSession($session);
                })
                ->values()
                ->all();
        }

        if ($collection !== 'users') {
            return $query->pluck('data')
                ->filter(static fn ($json) => is_string($json) && $json !== '')
                ->values()
                ->all();
        }

        $rows = [];
        foreach ($query->get(['id', 'data']) as $row) {
            $data = json_decode((string) $row->data, false);
            if (! is_object($data)) {
                continue;
            }

            // رمز عبور هرگز به رابط کاربری (حتی مدیر) ارسال نمی‌شود
            unset($data->password);

            $rows[] = json_encode($data, SyncService::JSON_FLAGS);
        }

        return $rows;
    }

    /** فیلدهای دانش‌آموز که دبیر می‌بیند: فقط نام (بدون کد ملی، تلفن، یادداشت، سوابق انضباطی و ...) */
    public const TEACHER_STUDENT_FIELDS = ['id', 'classId', 'firstName', 'lastName', 'nameFormat'];

    /**
     * دبیر فقط نام دانش‌آموزان کلاس‌های خودش و سوابقی را می‌بیند که خودش ثبت کرده است
     * (جلسات خودش، نمره‌ی درس خودش، فعالیت‌ها و ارزیابی خودش)؛ نه مشخصات، نه موارد تربیتی/انضباطی، نه حساب دیگران.
     *
     * @return array<int, string>
     */
    private function teacherRows(User $user, AccessPolicy $policy, string $collection, \Illuminate\Database\Query\Builder $query): array
    {
        $classIds = $policy->accessibleClassIds();

        switch ($collection) {
            case 'students':
                $rows = [];
                foreach ($query->whereIn('class_id', $classIds)->pluck('data') as $json) {
                    $d = is_string($json) ? json_decode($json, true) : null;
                    if (! is_array($d)) {
                        continue;
                    }
                    // فیلدهای متنیِ مورد انتظار رابط کاربری خالی می‌مانند (تا کد قدیمیِ جستجو و نمایش خطا ندهد)
                    $rows[] = json_encode(array_intersect_key($d, array_flip(self::TEACHER_STUDENT_FIELDS)) + ['studentCode' => '', 'nationalId' => '', 'parentPhone' => ''], SyncService::JSON_FLAGS);
                }

                return $rows;

            case 'classes':
                $rows = [];
                foreach ($query->whereIn('id', $classIds)->pluck('data') as $json) {
                    $d = is_string($json) ? json_decode($json, true) : null;
                    if (! is_array($d)) {
                        continue;
                    }
                    unset($d['coachId'], $d['coachIds'], $d['academicAdvisor']);
                    $rows[] = json_encode($d, SyncService::JSON_FLAGS);
                }

                return $rows;

            case 'users':
                $rows = [];
                foreach ($query->get(['id', 'data']) as $row) {
                    $d = json_decode((string) $row->data, true);
                    if (! is_array($d)) {
                        continue;
                    }
                    if ((string) $row->id === (string) $user->id) {
                        unset($d['password']);
                    } else {
                        // سایر حساب‌ها: فقط شناسه، نام و نقش (بدون تلفن، نام کاربری، کلاس‌ها و دسترسی‌ها)
                        $d = array_intersect_key($d, array_flip(['id', 'name', 'role', 'isActive']));
                    }
                    $rows[] = json_encode($d, SyncService::JSON_FLAGS);
                }

                return $rows;

            case 'academicGrades':
                $keys = $policy->teachingCourseKeys();
                $rows = [];
                foreach ($query->whereIn('class_id', $classIds)->get(['class_id', 'subject_id', 'data']) as $row) {
                    if (in_array($row->class_id.'|'.$row->subject_id, $keys, true) && is_string($row->data) && $row->data !== '') {
                        $rows[] = $row->data;
                    }
                }

                return $rows;

            case 'courseAssignments':
                return $query->where('user_id', $user->id)->pluck('data')
                    ->filter(static fn ($json) => is_string($json) && $json !== '')->values()->all();

            case 'teacherEvaluations':
            case 'teacherActivities':
                $query->where('teacher_id', $user->id);
                break;
        }

        if ($collection === 'sessions') {
            return $query->pluck('data')
                ->filter(static function ($json) use ($policy): bool {
                    if (! is_string($json) || $json === '') {
                        return false;
                    }
                    $session = json_decode($json, false);

                    return is_object($session) && $policy->canSeeSession($session);
                })
                ->values()
                ->all();
        }

        return $query->pluck('data')
            ->filter(static fn ($json) => is_string($json) && $json !== '')
            ->values()
            ->all();
    }
}
