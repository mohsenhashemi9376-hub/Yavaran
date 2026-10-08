<?php

namespace App\Support;

use App\Support\Sync\CollectionRegistry;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * تقویم مدرسه: جمعه‌ها روز درسی نیستند و تعطیلی‌های اعلام‌شده (توسط مدیر یا معاون انضباطی)
 * روز درسی حساب نمی‌شوند؛ حضور و غیاب این روزها بسته است.
 */
final class SchoolCalendar
{
    /** @var array<string, bool>|null */
    private static ?array $holidayCache = null;

    public static function reset(): void
    {
        self::$holidayCache = null;
    }

    private static function holidays(): array
    {
        if (self::$holidayCache === null) {
            self::$holidayCache = [];
            if (CollectionRegistry::ensureTable('school_holidays')) {
                foreach (DB::table('school_holidays')->pluck('holiday_date') as $d) {
                    self::$holidayCache[(string) $d] = true;
                }
            }
        }

        return self::$holidayCache;
    }

    /** @return 'friday'|'holiday'|null  دلیل بسته بودن آن روز (تاریخ شمسی «1405/07/14») */
    public static function closedReason(?string $shamsi): ?string
    {
        $gregorian = Jalali::shamsiToDate($shamsi);
        if ($gregorian === null) {
            return null;
        }
        if (Carbon::parse($gregorian)->dayOfWeek === Carbon::FRIDAY) {
            return 'friday';
        }
        $normalized = self::normalize((string) $shamsi);

        return isset(self::holidays()[$normalized]) ? 'holiday' : null;
    }

    /** «۱۴۰۵/۷/۴» ← «1405/07/04» */
    public static function normalize(string $shamsi): string
    {
        $english = Digits::toEnglish(trim($shamsi));
        if (preg_match('#^(\d{4})/(\d{1,2})/(\d{1,2})$#', $english, $m)) {
            return sprintf('%04d/%02d/%02d', $m[1], $m[2], $m[3]);
        }

        return $english;
    }
}
