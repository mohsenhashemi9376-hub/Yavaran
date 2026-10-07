<?php

namespace App\Support\Sync;

use App\Models\NurturingRecord;
use App\Models\User;
use App\Policies\NurturingRecordPolicy;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
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
        $policy = new AccessPolicy($user);
        $parts = [];

        foreach (CollectionRegistry::TABLES as $collection => $table) {
            $parts[] = json_encode($collection).':['.implode(',', $this->rows($user, $policy, $collection, $table)).']';
        }

        return '{"authenticated":true,'
            .'"userId":'.json_encode($user->id, SyncService::JSON_FLAGS).','
            .'"serverTime":'.((int) round(microtime(true) * 1000)).','
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
                return [];
            }
            $query = $sensitive::query()->orderBy('sort_order')->orderBy('id');
            $scope = app(NurturingRecordPolicy::class)->scopeStudentIds($user);
            if ($scope !== null) {
                $query->whereIn('student_id', $scope);
            }

            return $query->get()
                ->pluck('data')
                ->filter(static fn ($json) => is_string($json) && $json !== '')
                ->values()
                ->all();
        }

        $query = DB::table($table)->orderBy('sort_order')->orderBy('id');

        if (in_array($collection, ['teacherEvaluations', 'teacherActivities'], true) && ! $policy->isManager()) {
            $query->where('teacher_id', $user->id);
        }

        // دسترسی محدود (Scoped Access): مربی فقط دانش‌آموزان کلاس‌های خود را دریافت می‌کند
        if ($collection === 'students' && ! $policy->isManager() && $policy->isCoach()) {
            $query->whereIn('class_id', $policy->accessibleClassIds());
        }

        if ($collection !== 'users') {
            return $query->pluck('data')
                ->filter(static fn ($json) => is_string($json) && $json !== '')
                ->values()
                ->all();
        }

        $rows = [];
        foreach ($query->get(['id', 'data', 'password_encrypted']) as $row) {
            $data = json_decode((string) $row->data, false);
            if (! is_object($data)) {
                continue;
            }

            unset($data->password);

            if ($policy->isManager() && ! empty($row->password_encrypted)) {
                try {
                    $data->password = Crypt::decryptString($row->password_encrypted);
                } catch (DecryptException) {
                    // کلید برنامه تغییر کرده؛ رمز قابل نمایش نیست
                }
            }

            $rows[] = json_encode($data, SyncService::JSON_FLAGS);
        }

        return $rows;
    }
}
