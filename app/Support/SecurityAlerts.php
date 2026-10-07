<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;

/**
 * هشدارهای امنیتیِ حساب‌های دارای دسترسی به پرونده‌های تربیتی (مربی و معاون تربیتی).
 * هشدارها به‌صورت اعلان فوری برای معاون تربیتی (و برای حساب خودِ معاون: برای مدیر سامانه) ارسال
 * و در دفتر دسترسی با نوع «alert» ثبت می‌شود. هیچ‌کدام جلوی کار کاربر را نمی‌گیرند و خطایشان بلعیده می‌شود.
 *
 * قواعد: ورود از دستگاه جدید، ورود/دسترسی خارج از ساعت مدرسه، باز کردن تعداد زیادی پرونده در زمان کوتاه،
 * تلاش‌های ناموفق پیاپی برای ورود، و قفل شدن تأیید دومرحله‌ای/تأیید رمز.
 */
final class SecurityAlerts
{
    public const WATCHED_ROLES = ['coach', 'vice_nurturing'];

    /** سقف باز کردن پرونده در بازه‌ی زمانی، پیش از هشدار */
    public const BULK_READ_LIMIT = 15;

    public const BULK_READ_MINUTES = 10;

    public const FAILED_LOGIN_LIMIT = 5;

    public static function watched(?User $user): bool
    {
        return $user !== null && in_array($user->role, self::WATCHED_ROLES, true);
    }

    // ---------- دستگاه‌های شناخته‌شده ----------

    public static function ensureDevicesTable(): bool
    {
        static $ready = null;
        if ($ready !== null) {
            return $ready;
        }
        try {
            if (! Schema::hasTable('login_devices')) {
                Schema::create('login_devices', function ($t): void {
                    $t->bigIncrements('id');
                    $t->string('user_id', 100)->index();
                    $t->string('ua_hash', 64);
                    $t->string('ip', 64)->nullable();
                    $t->string('user_agent', 255)->nullable();
                    $t->timestamp('first_seen_at')->nullable();
                    $t->timestamp('last_seen_at')->nullable()->index();
                    $t->unique(['user_id', 'ua_hash'], 'login_devices_user_ua_unique');
                });
            }
        } catch (\Throwable) {
        }

        return $ready = Schema::hasTable('login_devices');
    }

    /** ثبت ورود موفق: دستگاه جدید و ساعت غیرمعمول بررسی می‌شود */
    public static function loginSucceeded(User $user, Request $request): void
    {
        try {
            if (! self::ensureDevicesTable()) {
                return;
            }

            $agent = mb_substr((string) $request->userAgent(), 0, 255);
            $hash = hash('sha256', $agent);
            $known = DB::table('login_devices')->where('user_id', $user->id)->count();
            $device = DB::table('login_devices')->where('user_id', $user->id)->where('ua_hash', $hash)->first();
            $now = now();

            if ($device) {
                DB::table('login_devices')->where('id', $device->id)->update(['last_seen_at' => $now, 'ip' => $request->ip()]);
            } else {
                DB::table('login_devices')->insert([
                    'user_id' => $user->id, 'ua_hash' => $hash, 'ip' => $request->ip(), 'user_agent' => $agent,
                    'first_seen_at' => $now, 'last_seen_at' => $now,
                ]);
            }

            if (! self::watched($user)) {
                return;
            }

            // اولین دستگاهِ ثبت‌شده (راه‌اندازی اولیه) هشدار نمی‌دهد
            if (! $device && $known > 0) {
                self::raise($user, 'new_device', 'ورود از دستگاه جدید',
                    sprintf('«%s» از یک دستگاه یا مرورگر جدید وارد سامانه شد (IP: %s). اگر خودِ او نبوده، حساب را بررسی و رمز را عوض کنید.', $user->name, $request->ip()));
            }
            self::offHours($user, 'login');
        } catch (\Throwable) {
            // هشدار نباید ورود را مختل کند
        }
    }

    // ---------- ساعت غیرمعمول ----------

    public static function isOffHours(): bool
    {
        $start = (int) config('app.nurturing_hours_start', 6);
        $end = (int) config('app.nurturing_hours_end', 20);
        $hour = (int) now()->setTimezone('Asia/Tehran')->format('G');

        return $hour < $start || $hour >= $end;
    }

    /** دسترسی خارج از ساعت مدرسه (حداکثر یک هشدار در روز برای هر کاربر) */
    public static function offHours(User $user, string $context): void
    {
        try {
            if (! self::watched($user) || ! self::isOffHours()) {
                return;
            }
            if (! Cache::add('sec-offhours:'.$user->id.':'.now()->format('Y-m-d'), 1, now()->addDay())) {
                return;
            }
            self::raise($user, 'off_hours', 'دسترسی خارج از ساعت مدرسه',
                sprintf('«%s» خارج از ساعت معمول (%s تا %s) %s.', $user->name,
                    (string) config('app.nurturing_hours_start', 6).':۰۰', (string) config('app.nurturing_hours_end', 20).':۰۰',
                    $context === 'login' ? 'وارد سامانه شد' : 'پرونده‌های تربیتی را باز کرد'));
        } catch (\Throwable) {
        }
    }

    // ---------- خواندن انبوه ----------

    /** پس از هر مشاهده‌ی پرونده فراخوانی می‌شود */
    public static function afterRecordView(User $user): void
    {
        try {
            if (! self::watched($user)) {
                return;
            }
            self::offHours($user, 'view');

            if (! NurturingAudit::ensureTable()) {
                return;
            }
            $count = DB::table('nurturing_access_logs')
                ->where('user_id', $user->id)->where('action', 'view')->where('allowed', true)
                ->where('created_at', '>=', now()->subMinutes(self::BULK_READ_MINUTES))
                ->distinct()->count('student_id');

            if ($count >= self::BULK_READ_LIMIT && Cache::add('sec-bulk:'.$user->id, 1, now()->addHour())) {
                self::raise($user, 'bulk_read', 'باز کردن تعداد زیادی پرونده',
                    sprintf('«%s» در %d دقیقه‌ی اخیر پرونده‌ی %d دانش‌آموز را باز کرده است.', $user->name, self::BULK_READ_MINUTES, $count));
            }
        } catch (\Throwable) {
        }
    }

    // ---------- تلاش‌های ناموفق ----------

    public static function failedLogin(?User $subject): void
    {
        try {
            if (! self::watched($subject)) {
                return;
            }
            $key = 'sec-fail:'.$subject->id;
            RateLimiter::hit($key, 900);
            if (RateLimiter::attempts($key) >= self::FAILED_LOGIN_LIMIT && Cache::add('sec-fail-alert:'.$subject->id, 1, now()->addHour())) {
                self::raise($subject, 'failed_logins', 'تلاش‌های ناموفق پیاپی برای ورود',
                    sprintf('برای حساب «%s» %d بار رمز اشتباه وارد شد. ممکن است کسی در حال حدس زدن رمز باشد.', $subject->name, self::FAILED_LOGIN_LIMIT));
            }
        } catch (\Throwable) {
        }
    }

    /** قفل شدن مرحله‌ی دوم ورود یا تأیید مجدد رمز پس از تلاش‌های ناموفق */
    public static function lockout(?User $subject, string $what): void
    {
        try {
            if (! self::watched($subject) || ! Cache::add('sec-lock:'.$subject->id.':'.$what, 1, now()->addHour())) {
                return;
            }
            self::raise($subject, 'lockout', 'قفل شدن حساب پس از تلاش ناموفق',
                sprintf('پس از تلاش‌های ناموفق پیاپی، %s برای حساب «%s» موقتاً قفل شد.', $what, $subject->name));
        } catch (\Throwable) {
        }
    }

    // ---------- ارسال ----------

    /** ثبت در دفتر دسترسی + اعلان فوری */
    private static function raise(User $subject, string $type, string $title, string $message): void
    {
        NurturingAudit::log($subject, 'alert', 'security', null, $type, false);

        $receivers = DB::table('users')->where('is_active', true)
            ->where('role', $subject->role === 'vice_nurturing' ? 'admin' : 'vice_nurturing')
            ->where('id', '!=', $subject->id)->pluck('id')->all();

        Notifier::send($receivers, [
            'title' => 'هشدار امنیتی: '.$title,
            'message' => $message,
            'type' => 'announcement',
            'priority' => 'urgent',
            'ref_id' => $type,
        ]);
    }
}
