<?php

namespace App\Support;

use App\Models\StudentObservation;
use App\Models\User;
use App\Support\Sync\AccessPolicy;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * یادآوری هفتگی مشاهده‌گری برای مربی و معاون تربیتی: اگر برای دانش‌آموزی در ۲ هفته‌ی اخیر
 * (۱۲ روز درسی؛ جمعه و تعطیلی‌ها شمرده نمی‌شوند) مشاهده‌گری ثبت نشده باشد، هفته‌ای یک‌بار اعلان می‌گیرد.
 * مربی فقط مشاهده‌های خودش را در نظر می‌گیرد (همان چیزی که در پنلش می‌بیند). دانش‌آموز تازه‌ثبت‌شده (۱۴ روز) هشدار نمی‌گیرد.
 * اعلان فقط تعداد را دارد و نام دانش‌آموز در آن نیست. اجرا هنگام بارگذاری اعلان‌های خود کاربر انجام می‌شود (بدون cron).
 */
final class ObservationReminders
{
    public const SCHOOL_DAYS = 12;

    public const MAX_LOOKBACK_DAYS = 45;

    public const NEW_STUDENT_GRACE_DAYS = 14;

    /** اولین روز بازه‌ی بررسی، شمسی نرمال‌شده «1405/07/04» */
    public static function windowStart(): string
    {
        $day = Carbon::now('Asia/Tehran');
        $open = 0;
        $start = '';
        for ($i = 0; $i < self::MAX_LOOKBACK_DAYS && $open < self::SCHOOL_DAYS; $i++) {
            [$jy, $jm, $jd] = Jalali::fromCarbon($day->copy()->subDays($i));
            $start = sprintf('%04d/%02d/%02d', $jy, $jm, $jd);
            if (SchoolCalendar::closedReason($start) === null) {
                $open++;
            }
        }

        return $start;
    }

    public static function syncFor(User $user): void
    {
        try {
            if (! in_array($user->role, ['coach', 'vice_nurturing'], true) || ! $user->isActive()) {
                return;
            }
            if (! Cache::add('obs-remind:'.$user->id, 1, now()->addMinutes(10))) {
                return;
            }
            if (! Notifier::ensureTable() || ! StudentObservation::ensureAuthorColumns()) {
                return;
            }

            $ref = 'obs-remind:'.Carbon::now('Asia/Tehran')->format('o-\WW');
            if (DB::table('notifications')->where('receiver_id', $user->id)->where('ref_id', $ref)->exists()) {
                return;
            }

            $classIds = (new AccessPolicy($user))->nurturingClassIds();
            if ($classIds === []) {
                return;
            }
            $students = DB::table('students')->whereIn('class_id', $classIds)->get(['id', 'created_at']);
            if ($students->isEmpty()) {
                return;
            }

            $start = self::windowStart();
            $query = DB::table('student_observations')->whereNotNull('record_date');
            if ($user->role === 'coach') {
                $query->where('author_id', $user->id);
            }
            $covered = [];
            foreach ($query->get(['student_id', 'record_date']) as $o) {
                if (SchoolCalendar::normalize((string) $o->record_date) >= $start) {
                    $covered[(string) $o->student_id] = true;
                }
            }

            $grace = now()->subDays(self::NEW_STUDENT_GRACE_DAYS);
            $stale = $students->filter(function ($s) use ($covered, $grace): bool {
                if (isset($covered[(string) $s->id])) {
                    return false;
                }

                return ! ($s->created_at && Carbon::parse($s->created_at)->greaterThan($grace));
            })->count();

            if ($stale === 0) {
                return;
            }

            Notifier::send([(string) $user->id], [
                'title' => 'یادآوری مشاهده‌گری',
                'message' => "برای {$stale} دانش‌آموز در ۲ هفته‌ی اخیر مشاهده‌گری ثبت نشده است. از بخش «مشاهده‌گری رفتاری» می‌توانید فهرست آن‌ها را ببینید.",
                'type' => 'observation',
                'priority' => 'normal',
                'ref_id' => $ref,
            ]);
        } catch (\Throwable) {
            // یادآوری هرگز نباید بارگذاری اعلان‌ها را مختل کند
        }
    }
}
