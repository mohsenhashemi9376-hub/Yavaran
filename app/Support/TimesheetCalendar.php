<?php

namespace App\Support;

use Carbon\Carbon;

/** ماه‌های کاری سال تحصیلی ۱۴۰۵-۱۴۰۶؛ هر ماه از ۲۶ ماه قبل تا ۲۵ همان ماه */
final class TimesheetCalendar
{
    public const ACADEMIC_YEAR = '۱۴۰۵-۱۴۰۶';

    /** کلید ماه ⇒ [شماره ماه شمسی، سال شمسی] */
    private const MONTHS = [
        'aban' => [8, 1405],
        'azar' => [9, 1405],
        'dey' => [10, 1405],
        'bahman' => [11, 1405],
        'esfand' => [12, 1405],
        'farvardin' => [1, 1406],
        'ordibehesht' => [2, 1406],
        'khordad' => [3, 1406],
    ];

    private const NAMES = [
        1 => 'فروردین', 2 => 'اردیبهشت', 3 => 'خرداد', 4 => 'تیر', 5 => 'مرداد', 6 => 'شهریور',
        7 => 'مهر', 8 => 'آبان', 9 => 'آذر', 10 => 'دی', 11 => 'بهمن', 12 => 'اسفند',
    ];

    /** Carbon: 0 = یکشنبه */
    private const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

    /** @return list<string> */
    public static function keys(): array
    {
        return array_keys(self::MONTHS);
    }

    /** @return list<array{key:string,label:string,days:list<array{date:string,label:string,weekday:string,friday:bool}>}> */
    public static function months(): array
    {
        return array_map(static fn (string $key): array => self::month($key), self::keys());
    }

    /** @return array{key:string,label:string,days:list<array{date:string,label:string,weekday:string,friday:bool}>} */
    public static function month(string $key): array
    {
        [$m, $y] = self::MONTHS[$key];
        [$pm, $py] = $m === 1 ? [12, $y - 1] : [$m - 1, $y];

        $days = [];
        for ($d = 26; $d <= self::length($py, $pm); $d++) {
            $days[] = self::day($py, $pm, $d);
        }
        for ($d = 1; $d <= 25; $d++) {
            $days[] = self::day($y, $m, $d);
        }

        return [
            'key' => $key,
            'label' => sprintf('%s (۲۶ %s تا ۲۵ %s)', self::NAMES[$m], self::NAMES[$pm], self::NAMES[$m]),
            'days' => $days,
        ];
    }

    private static function length(int $y, int $m): int
    {
        if ($m <= 6) {
            return 31;
        }
        if ($m <= 11) {
            return 30;
        }
        // اسفند: ۳۰ روزه فقط در سال کبیسه
        [$gy, $gm, $gd] = Jalali::toGregorian($y, 12, 30);

        return Jalali::fromGregorian($gy, $gm, $gd) === [$y, 12, 30] ? 30 : 29;
    }

    /** @return array{date:string,label:string,weekday:string,friday:bool} */
    private static function day(int $y, int $m, int $d): array
    {
        [$gy, $gm, $gd] = Jalali::toGregorian($y, $m, $d);
        $dow = Carbon::create($gy, $gm, $gd)->dayOfWeek;

        return [
            'date' => sprintf('%04d/%02d/%02d', $y, $m, $d),
            'label' => $d.' '.self::NAMES[$m],
            'weekday' => self::WEEKDAYS[$dow],
            'friday' => $dow === 5,
        ];
    }
}
