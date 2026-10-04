<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * حضور و غیاب صبحگاه (جدول attendance صبحگاهی).
 *
 * @property string $id
 * @property string $student_id
 * @property string|null $class_id
 * @property string $record_date
 * @property string $status present|absent
 * @property string|null $entry_time HH:MM:SS
 * @property int $delay_minutes
 * @property bool $is_acknowledged
 * @property bool|null $is_excused موجه / غیرموجه
 * @property string|null $absence_note علت غیبت یا شرح پیگیری
 */
class MorningAttendance extends Model
{
    /** ساعت مرجع ورود: ۰۷:۰۰ صبح (دقیقه از نیمه‌شب) */
    public const REFERENCE_MINUTES = 7 * 60;

    protected $table = 'morning_attendance';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'student_id', 'class_id', 'record_date', 'status', 'entry_time',
        'delay_minutes', 'is_acknowledged', 'is_excused', 'absence_note', 'data', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'delay_minutes' => 'integer',
            'is_acknowledged' => 'boolean',
            'is_excused' => 'boolean',
        ];
    }

    /** محاسبه خودکار دقیقه تأخیر از ساعت ورود (HH:MM[:SS]) نسبت به ۰۷:۰۰ */
    public static function delayFromEntryTime(?string $entryTime): int
    {
        if ($entryTime === null || ! preg_match('/^(\d{1,2}):(\d{2})/', $entryTime, $m)) {
            return 0;
        }

        return max(0, ((int) $m[1] * 60 + (int) $m[2]) - self::REFERENCE_MINUTES);
    }

    /** تبدیل دقیقه به متن فارسی: «X ساعت و Y دقیقه تأخیر» (یا فقط ساعت / فقط دقیقه) */
    public static function delayText(int $minutes): string
    {
        if ($minutes <= 0) {
            return 'بدون تأخیر';
        }

        $hours = intdiv($minutes, 60);
        $rest = $minutes % 60;
        $parts = [];
        if ($hours > 0) {
            $parts[] = self::digits($hours).' ساعت';
        }
        if ($rest > 0) {
            $parts[] = self::digits($rest).' دقیقه';
        }

        return implode(' و ', $parts).' تأخیر';
    }

    public function getDelayTextAttribute(): string
    {
        return self::delayText((int) $this->delay_minutes);
    }

    private static function digits(int $n): string
    {
        return strtr((string) $n, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }
}
