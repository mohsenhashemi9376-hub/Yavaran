<?php

namespace App\Support;

use App\Support\Sync\CollectionRegistry;
use Illuminate\Support\Facades\DB;

/**
 * باز یا بسته بودن جلسه‌های عمومی اولیاء. جلسه‌ی بسته یعنی برگزار و تمام شده و حضور و غیاب آن دیگر ثبت یا پاک نمی‌شود.
 * جلسه‌ای که مدیر یا معاون اجرایی بازش نکرده بسته است؛ فقط جلسه‌هایی که پیش از این قابلیت حضورشان ثبت شده بود
 * (بدون رکورد وضعیت) باز حساب می‌شوند تا داده‌ی قبلی قفل نشود.
 */
final class ParentMeetingGate
{
    public static function isOpen(string $year, int $no): bool
    {
        if (CollectionRegistry::ensureTable('parent_meeting_states')) {
            $open = DB::table('parent_meeting_states')->where('academic_year', $year)->where('meeting_no', $no)->value('is_open');
            if ($open !== null) {
                return (bool) $open;
            }
        }

        return self::hasLegacyAttendance($year, $no);
    }

    private static function hasLegacyAttendance(string $year, int $no): bool
    {
        if (! CollectionRegistry::tableExists('parent_meetings')) {
            return false;
        }
        $base = DB::table('parent_meetings')->where('academic_year', $year)->where('meeting_no', $no);
        if ((clone $base)->where(fn ($q) => $q->where('father_present', true)->orWhere('mother_present', true))->exists()) {
            return true;
        }
        foreach ($base->pluck('data') as $raw) {
            $d = is_string($raw) ? json_decode($raw, false) : null;
            if (is_object($d) && ($d->hasAttendance ?? true) !== false) {
                return true;
            }
        }

        return false;
    }
}
