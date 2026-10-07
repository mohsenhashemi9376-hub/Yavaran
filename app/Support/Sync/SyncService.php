<?php

namespace App\Support\Sync;

use App\Models\NurturingRecord;
use App\Models\User;
use App\Support\Notifier;
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

        // پرونده‌های تربیتی و مشاهدات رفتاری: خواندن/نوشتن از مسیر مدل برای رمزنگاری/رمزگشایی (کست encrypted)
        $sensitive = NurturingRecord::modelFor($collection);

        DB::transaction(function () use ($policy, $collection, $table, $upserts, $deletes, $sensitive): void {
            if ($deletes !== []) {
                $rows = $sensitive
                    ? $sensitive::query()->whereIn('id', $deletes)->lockForUpdate()->get()
                    : DB::table($table)->whereIn('id', $deletes)->lockForUpdate()->get(['id', 'data']);

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
            $existing = $sensitive
                ? $sensitive::query()->whereIn('id', $ids)->lockForUpdate()->get()->keyBy('id')
                : DB::table($table)->whereIn('id', $ids)->lockForUpdate()->get()->keyBy('id');

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

                if ($sensitive) {
                    // ستون data هنگام ذخیره با کست encrypted رمزنگاری می‌شود
                    if ($oldRow instanceof NurturingRecord) {
                        $oldRow->forceFill($values)->save();
                    } else {
                        $order = ! empty($item->prepend) ? --$minOrder : ++$maxOrder;
                        (new $sensitive)->forceFill($values + [
                            'id' => $item->id,
                            'sort_order' => $order,
                            'created_at' => $now,
                        ])->save();
                        $existing->put($item->id, (object) ['id' => $item->id, 'data' => $values['data']]);
                    }
                } elseif ($oldRow) {
                    DB::table($table)->where('id', $item->id)->update($values);
                } else {
                    $order = ! empty($item->prepend) ? --$minOrder : ++$maxOrder;
                    DB::table($table)->insert($values + [
                        'id' => $item->id,
                        'sort_order' => $order,
                        'created_at' => $now,
                    ]);
                    $existing->put($item->id, (object) (['id' => $item->id, 'data' => $values['data']] + $extra));

                    if ($collection === 'schoolAnnouncements') {
                        $this->notifyCircular($policy, $data, $item->id);
                    }
                }
            }
        });
    }

    /**
     * رمز عبور هرگز داخل ستون data ذخیره نمی‌شود و فقط به‌صورت هش یک‌طرفه (bcrypt) نگهداری می‌شود؛
     * هیچ نسخه‌ی برگشت‌پذیر یا قابل نمایش از رمز وجود ندارد (ستون password_encrypted همیشه خالی می‌ماند).
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
            if (! empty($oldRow->password_encrypted)) {
                $columns['password_encrypted'] = null; // پاک‌سازی نسخه‌ی برگشت‌پذیر قدیمی
            }
            if (Hash::needsRehash($oldHash)) {
                $columns['password'] = Hash::make($plain);
            }

            return $columns;
        }

        return [
            'password' => Hash::make($plain),
            'password_encrypted' => null,
        ];
    }

    /** اعلان خودکار «بخشنامه جدید» برای اعضای مشمول */
    private function notifyCircular(AccessPolicy $policy, object $data, string $id): void
    {
        $roles = [];
        if (isset($data->targetRoles) && is_array($data->targetRoles) && $data->targetRoles !== []) {
            $roles = array_values(array_filter($data->targetRoles, 'is_string'));
        } else {
            $roles = match ($data->targetRole ?? 'everyone') {
                'coaches' => ['coach'],
                'all_teachers' => ['teacher'],
                default => [],
            };
        }

        $query = DB::table('users')->where('is_active', true)->where('id', '!=', $policy->userId());
        if ($roles !== []) {
            $query->whereIn('role', $roles);
        } else {
            $query->whereIn('role', ['teacher', 'coach']);
        }

        $title = isset($data->title) && is_scalar($data->title) ? trim((string) $data->title) : '';
        $content = isset($data->content) && is_scalar($data->content) ? trim((string) $data->content) : '';
        $priority = ($data->priority ?? 'normal') === 'urgent' ? 'urgent' : 'normal';

        Notifier::send($query->pluck('id')->all(), [
            'sender_id' => $policy->userId(),
            'title' => 'بخشنامه جدید',
            'message' => "بخشنامه جدید با عنوان «{$title}» ثبت شد.".($content !== '' ? "\n\n".mb_substr($content, 0, 1500) : ''),
            'type' => 'circular',
            'priority' => $priority,
            'ref_id' => $id,
        ]);
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
