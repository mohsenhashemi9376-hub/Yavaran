<?php

namespace App\Models;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * پایه‌ی مدل‌های پرونده‌های تربیتی و مشاهدات رفتاری.
 *
 * تمام محتوای متنی رکورد (ستون data) با کست `encrypted` لاراول (AES-256 با APP_KEY) رمزنگاری می‌شود
 * تا در دیتابیس متن ساده ذخیره نشود. فقط ستون‌های ایندکس (student_id, record_date, coach_id)
 * که حاوی متن حساس نیستند خوانا می‌مانند.
 *
 * @property string $id
 * @property string|null $student_id
 * @property string $data JSON رمزگشایی‌شده
 */
abstract class NurturingRecord extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    /** مجموعه‌ی فرانت‌اند ← کلاس مدل */
    public const MODELS = [
        'observations' => StudentObservation::class,
        'nurturingDossiers' => NurturingDossier::class,
        'coachEvaluations' => CoachEvaluation::class,
    ];

    protected function casts(): array
    {
        return ['data' => 'encrypted'];
    }

    /**
     * رکوردهای قدیمی که هنوز رمزنگاری نشده‌اند همچنان خوانده می‌شوند (و هنگام اولین خواندن رمزنگاری می‌شوند).
     */
    public function fromEncryptedString($value)
    {
        try {
            return parent::fromEncryptedString($value);
        } catch (DecryptException) {
            return $value;
        }
    }

    protected static function booted(): void
    {
        static::retrieved(static function (self $record): void {
            $raw = $record->getRawOriginal('data');
            if (is_string($raw) && $raw !== '' && in_array($raw[0], ['{', '['], true)) {
                try {
                    DB::table($record->getTable())->where('id', $record->getKey())
                        ->update(['data' => Crypt::encryptString($raw)]);
                } catch (\Throwable) {
                    // رمزنگاری با اجرای دستور nurturing:encrypt انجام می‌شود
                }
            }
        });
    }

    public static function isSensitive(string $collection): bool
    {
        return isset(self::MODELS[$collection]);
    }

    /** @return class-string<NurturingRecord>|null */
    public static function modelFor(string $collection): ?string
    {
        return self::MODELS[$collection] ?? null;
    }

    /** مدل گذرا (ذخیره‌نشده) از روی داده‌ی رکورد؛ برای بررسی Policy پیش از نوشتن */
    public static function fromData(string $collection, object $data): self
    {
        $class = self::MODELS[$collection];
        $studentId = $collection === 'nurturingDossiers'
            ? ($data->studentId ?? $data->id ?? null)
            : ($data->studentId ?? null);

        /** @var self $model */
        $model = new $class;
        $model->student_id = is_scalar($studentId) ? (string) $studentId : null;
        if ($model instanceof StudentObservation) {
            $model->author_id = isset($data->authorId) && is_scalar($data->authorId) ? (string) $data->authorId : null;
            $model->author_role = isset($data->authorRole) && is_scalar($data->authorRole) ? (string) $data->authorRole : null;
        }

        return $model;
    }
}
