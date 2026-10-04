<?php

namespace App\Support;

use Carbon\CarbonInterface;

final class Jalali
{
    /**
     * تبدیل تاریخ میلادی به شمسی.
     *
     * @return array{0:int,1:int,2:int}
     */
    public static function fromGregorian(int $gy, int $gm, int $gd): array
    {
        $gDaysInMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        $gy2 = $gm > 2 ? $gy + 1 : $gy;
        $days = 355666 + (365 * $gy) + intdiv($gy2 + 3, 4) - intdiv($gy2 + 99, 100)
            + intdiv($gy2 + 399, 400) + $gd + $gDaysInMonth[$gm - 1];

        $jy = -1595 + (33 * intdiv($days, 12053));
        $days %= 12053;
        $jy += 4 * intdiv($days, 1461);
        $days %= 1461;

        if ($days > 365) {
            $jy += intdiv($days - 1, 365);
            $days = ($days - 1) % 365;
        }

        if ($days < 186) {
            $jm = 1 + intdiv($days, 31);
            $jd = 1 + ($days % 31);
        } else {
            $jm = 7 + intdiv($days - 186, 30);
            $jd = 1 + (($days - 186) % 30);
        }

        return [$jy, $jm, $jd];
    }

    /**
     * @return array{0:int,1:int,2:int}
     */
    public static function fromCarbon(CarbonInterface $date): array
    {
        return self::fromGregorian((int) $date->format('Y'), (int) $date->format('n'), (int) $date->format('j'));
    }

    /**
     * تبدیل تاریخ شمسی به میلادی.
     *
     * @return array{0:int,1:int,2:int}
     */
    public static function toGregorian(int $jy, int $jm, int $jd): array
    {
        $jy += 1595;
        $days = -355668 + (365 * $jy) + (intdiv($jy, 33) * 8) + intdiv(($jy % 33) + 3, 4) + $jd
            + ($jm < 7 ? ($jm - 1) * 31 : (($jm - 7) * 30) + 186);

        $gy = 400 * intdiv($days, 146097);
        $days %= 146097;

        if ($days > 36524) {
            $days--;
            $gy += 100 * intdiv($days, 36524);
            $days %= 36524;
            if ($days >= 365) {
                $days++;
            }
        }

        $gy += 4 * intdiv($days, 1461);
        $days %= 1461;

        if ($days > 365) {
            $gy += intdiv($days - 1, 365);
            $days = ($days - 1) % 365;
        }

        $gd = $days + 1;
        $isLeap = ($gy % 4 === 0 && $gy % 100 !== 0) || $gy % 400 === 0;
        $months = [0, 31, $isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        $gm = 0;
        while ($gm < 13 && $gd > $months[$gm]) {
            $gd -= $months[$gm];
            $gm++;
        }

        return [$gy, $gm, $gd];
    }

    /** «۱۴۰۵/۰۷/۱۱» یا «1405/07/11» ← «2026-10-03» (یا null) */
    public static function shamsiToDate(?string $shamsi): ?string
    {
        if ($shamsi === null) {
            return null;
        }
        $english = strtr($shamsi, ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']);
        if (! preg_match('#^(\d{4})/(\d{1,2})/(\d{1,2})$#', trim($english), $m)) {
            return null;
        }
        [$gy, $gm, $gd] = self::toGregorian((int) $m[1], (int) $m[2], (int) $m[3]);

        return sprintf('%04d-%02d-%02d', $gy, $gm, $gd);
    }
}
