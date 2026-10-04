<?php

namespace App\Support\Sync;

use App\Models\User;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

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

        $query = DB::table($table)->orderBy('sort_order')->orderBy('id');

        if ($collection === 'teacherEvaluations' && ! $policy->isManager()) {
            $query->where('teacher_id', $user->id);
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
