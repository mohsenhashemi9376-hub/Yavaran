<?php

namespace App\Support;

use App\Support\Sync\SyncService;
use Illuminate\Support\Facades\DB;

/**
 * سال تحصیلی جاری (از اول مهر هر سال) و به‌روزرسانی خودکار آن در تنظیمات مدرسه.
 */
final class AcademicYear
{
    /**
     * @return array{0:int,1:string} [سال شروع, برچسب فارسی مانند «۱۴۰۵-۱۴۰۶»]
     */
    public static function current(): array
    {
        [$jy, $jm] = Jalali::fromCarbon(now('Asia/Tehran'));
        $start = $jm >= 7 ? $jy : $jy - 1;

        return [$start, self::toPersianDigits($start.'-'.($start + 1))];
    }

    /**
     * اگر سال تحصیلی ذخیره‌شده قدیمی‌تر از سال جاری باشد، به‌طور خودکار به‌روز می‌شود.
     * (سال تحصیلی آینده که مدیر دستی تنظیم کرده باشد دست نمی‌خورد.)
     */
    public static function syncSettings(): void
    {
        [$start, $label] = self::current();

        $row = DB::table('school_settings')->where('id', 'default')->first();
        if (! $row) {
            return;
        }

        $data = json_decode((string) $row->data, false);
        if (! is_object($data)) {
            return;
        }

        $stored = isset($data->academicYear) && is_scalar($data->academicYear) ? (string) $data->academicYear : '';
        $storedStart = preg_match('/(\d{4})/', Digits::toEnglish($stored), $m) ? (int) $m[1] : 0;

        if ($storedStart >= $start) {
            return;
        }

        $data->academicYear = $label;

        DB::table('school_settings')->where('id', 'default')->update([
            'data' => json_encode($data, SyncService::JSON_FLAGS),
            'updated_at' => now(),
        ]);
    }

    private static function toPersianDigits(string $value): string
    {
        return strtr($value, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }
}
