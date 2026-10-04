<?php

namespace App\Support\Sync;

use App\Models\User;
use App\Support\Digits;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use stdClass;

/**
 * اعمال تغییرات ارسالی از رابط کاربری (افزودن/ویرایش/حذف) روی دیتابیس
 * به‌صورت تراکنشی و با بررسی کامل مجوزها.
 */
final class SyncService
{
    public const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE;

    /**
     * @param  array<int, object{id:string,data:object,prepend?:bool}>  $upserts
     * @param  array<int, string>  $deletes
     */
    public function apply(User $user, string $collection, array $upserts, array $deletes): void
    {
        $policy = new AccessPolicy($user);
        $table = CollectionRegistry::table($collection);

        if (! CollectionRegistry::ensureTable($table)) {
            abort(503, 'ساختار دیتابیس هنوز به‌روزرسانی نشده است. لطفاً فایل upgrade.sql را روی دیتابیس اجرا کنید.');
        }

        DB::transaction(function () use ($policy, $collection, $table, $upserts, $deletes): void {
            if ($deletes !== []) {
                $rows = DB::table($table)->whereIn('id', $deletes)->lockForUpdate()->get(['id', 'data']);

                foreach ($rows as $row) {
                    $policy->authorizeDelete($collection, $this->decode($row->data, (string) $row->id));
                }

                if ($rows->isNotEmpty()) {
                    DB::table($table)->whereIn('id', $rows->pluck('id')->all())->delete();
                }
            }

            if ($upserts === []) {
                return;
            }

            $ids = array_map(static fn (object $item): string => $item->id, $upserts);
            $existing = DB::table($table)->whereIn('id', $ids)->lockForUpdate()->get()->keyBy('id');

            $minOrder = (int) (DB::table($table)->min('sort_order') ?? 0);
            $maxOrder = (int) (DB::table($table)->max('sort_order') ?? 0);
            $now = now();

            foreach ($upserts as $item) {
                /** @var object $data */
                $data = $item->data;
                $data->id = $item->id;

                $oldRow = $existing->get($item->id);
                $oldData = $oldRow ? $this->decode($oldRow->data, (string) $oldRow->id) : null;

                $policy->authorizeUpsert($collection, $oldData, $data);

                if ($collection === 'sessions') {
                    $this->validateSession($data, $item->id);
                }

                $extra = $collection === 'users' ? $this->passwordColumns($data, $oldRow) : [];

                $values = CollectionRegistry::columns($collection, $data) + $extra + [
                    'data' => json_encode($data, self::JSON_FLAGS),
                    'updated_at' => $now,
                ];

                if ($oldRow) {
                    DB::table($table)->where('id', $item->id)->update($values);
                } else {
                    $order = ! empty($item->prepend) ? --$minOrder : ++$maxOrder;
                    DB::table($table)->insert($values + [
                        'id' => $item->id,
                        'sort_order' => $order,
                        'created_at' => $now,
                    ]);
                    $existing->put($item->id, (object) (['id' => $item->id, 'data' => $values['data']] + $extra));
                }
            }
        });
    }

    /**
     * رمز عبور هرگز داخل ستون data ذخیره نمی‌شود؛ هش (bcrypt) برای ورود
     * و نسخه رمزنگاری‌شده (AES-256) فقط برای نمایش به مدیر نگهداری می‌شود.
     *
     * @return array<string, string>
     */
    private function passwordColumns(object $data, ?object $oldRow): array
    {
        $plain = null;

        if (property_exists($data, 'password')) {
            $plain = is_scalar($data->password) ? trim(Digits::toEnglish((string) $data->password)) : null;
            unset($data->password);
        }

        if ($plain === null || $plain === '') {
            if ($oldRow) {
                return [];
            }

            $plain = Str::password(10, symbols: false);
        }

        $plain = mb_substr($plain, 0, 191);
        $oldHash = $oldRow->password ?? null;

        if ($oldHash && password_verify($plain, $oldHash)) {
            $columns = [];
            if (empty($oldRow->password_encrypted)) {
                $columns['password_encrypted'] = Crypt::encryptString($plain);
            }
            if (Hash::needsRehash($oldHash)) {
                $columns['password'] = Hash::make($plain);
            }

            return $columns;
        }

        return [
            'password' => Hash::make($plain),
            'password_encrypted' => Crypt::encryptString($plain),
        ];
    }

    /**
     * اعتبارسنجی جلسه کلاسی: مبحث تدریس‌شده اجباری است و یک زنگ برای یک درس در
     * یک تاریخ نمی‌تواند دو بار ثبت شود.
     */
    private function validateSession(object $data, string $id): void
    {
        $topic = isset($data->lessonTopic) && is_scalar($data->lessonTopic) ? trim((string) $data->lessonTopic) : '';

        Validator::make(['topic' => $topic], ['topic' => 'required|string|min:2'], [
            'topic.required' => 'لطفاً مبحث تدریس‌شده این جلسه را وارد کنید',
            'topic.min' => 'لطفاً مبحث تدریس‌شده این جلسه را وارد کنید',
        ])->validate();

        $period = isset($data->periodNumber) && is_numeric($data->periodNumber) ? (int) $data->periodNumber : null;
        if ($period === null) {
            return;
        }

        $subjectKey = isset($data->subjectId) && is_scalar($data->subjectId) && $data->subjectId !== ''
            ? 'subjectId' : 'subject';
        $subjectValue = (string) ($data->{$subjectKey} ?? '');

        $rows = DB::table('attendance_sessions')
            ->where('class_id', $data->classId ?? null)
            ->where('session_date', $data->date ?? null)
            ->where('id', '!=', $id)
            ->pluck('data');

        foreach ($rows as $json) {
            $other = json_decode((string) $json, false);
            if (is_object($other)
                && (int) ($other->periodNumber ?? 0) === $period
                && (string) ($other->{$subjectKey} ?? '') === $subjectValue) {
                throw ValidationException::withMessages([
                    'period' => 'حضور و غیاب این زنگ برای این درس در این تاریخ قبلاً ثبت شده است.',
                ]);
            }
        }
    }

    private function decode(?string $json, string $id): object
    {
        $decoded = json_decode((string) $json, false);
        $object = is_object($decoded) ? $decoded : new stdClass;
        if (! isset($object->id)) {
            $object->id = $id;
        }

        return $object;
    }
}
