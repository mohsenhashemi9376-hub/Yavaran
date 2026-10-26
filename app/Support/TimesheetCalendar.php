<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * ماه‌های کاری سال تحصیلی ۱۴۰۵-۱۴۰۶ (مهر ۱۴۰۵ تا خرداد ۱۴۰۶)؛ هر ماه از ۲۶ ماه قبل تا ۲۵ همان ماه.
 * هیچ تاریخی پیش از ۱ مهر ۱۴۰۵ نمی‌آید؛ پس مهر از ۱ تا ۲۵ مهر است.
 */
final class TimesheetCalendar
{
    public const ACADEMIC_YEAR = '۱۴۰۵-۱۴۰۶';

    /** کلید ماه ⇒ [شماره ماه شمسی، سال شمسی] */
    private const MONTHS = [
        'mehr' => [7, 1405],
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

    /** @return list<array{key:string,label:string,days:list<array{date:string,g:string,label:string,weekday:string,off:bool}>}> */
    public static function months(): array
    {
        return array_map(static fn (string $key): array => self::month($key), self::keys());
    }

    /** @return array{key:string,label:string,days:list<array{date:string,g:string,label:string,weekday:string,off:bool}>} */
    public static function month(string $key): array
    {
        [$m, $y] = self::MONTHS[$key];
        [$pm, $py] = $m === 1 ? [12, $y - 1] : [$m - 1, $y];
        $first = $key === 'mehr';

        $days = [];
        for ($d = 26; ! $first && $d <= self::length($py, $pm); $d++) {
            $days[] = self::day($py, $pm, $d);
        }
        for ($d = 1; $d <= 25; $d++) {
            $days[] = self::day($y, $m, $d);
        }

        return [
            'key' => $key,
            'label' => $first
                ? sprintf('%s %s (۱ تا ۲۵ %s)', self::NAMES[$m], self::digits($y), self::NAMES[$m])
                : sprintf('%s %s (۲۶ %s تا ۲۵ %s)', self::NAMES[$m], self::digits($y), self::NAMES[$pm], self::NAMES[$m]),
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

    private static function digits(int|string $n): string
    {
        return strtr((string) $n, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }

    /** @return array{date:string,g:string,label:string,weekday:string,off:bool} */
    private static function day(int $y, int $m, int $d): array
    {
        [$gy, $gm, $gd] = Jalali::toGregorian($y, $m, $d);
        $dow = Carbon::create($gy, $gm, $gd)->dayOfWeek;
        $date = sprintf('%04d/%02d/%02d', $y, $m, $d);

        return [
            'date' => $date,
            'g' => sprintf('%04d-%02d-%02d', $gy, $gm, $gd),
            'label' => self::digits($d).' '.self::NAMES[$m],
            'weekday' => self::WEEKDAYS[$dow],
            // پنج‌شنبه و جمعه و تعطیلی‌های اعلام‌شده‌ی مدرسه
            'off' => in_array($dow, [4, 5], true) || SchoolCalendar::closedReason($date) !== null,
        ];
    }
}
