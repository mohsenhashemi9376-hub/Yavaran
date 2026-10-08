<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * دستگاه مطمئن: ورود دومرحله‌ای فقط در اولین ورود با هر دستگاه لازم است.
 * پس از تأیید کد، یک توکن تصادفی در کوکی (رمزشده و HttpOnly) روی دستگاه و هش آن در دیتابیس ذخیره می‌شود؛
 * دستگاه ناشناس همیشه کد می‌خواهد. با تغییر رمز، بستن نشست‌ها یا بازنشانی ورود دومرحله‌ای، اعتماد همه‌ی دستگاه‌ها لغو می‌شود.
 */
final class TrustedDevices
{
    public const COOKIE = 'yv_td';

    public static function ensureTable(): bool
    {
        static $ready = null;
        if ($ready !== null) {
            return $ready;
        }
        try {
            if (! Schema::hasTable('trusted_devices')) {
                Schema::create('trusted_devices', function ($t): void {
                    $t->bigIncrements('id');
                    $t->string('user_id', 100)->index();
                    $t->string('token_hash', 64)->unique();
                    $t->string('user_agent', 255)->nullable();
                    $t->string('ip', 64)->nullable();
                    $t->timestamp('created_at')->nullable();
                    $t->timestamp('last_used_at')->nullable();
                    $t->timestamp('expires_at')->nullable()->index();
                });
            }
        } catch (\Throwable) {
        }

        return $ready = Schema::hasTable('trusted_devices');
    }

    private static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    /** آیا این دستگاه برای کاربر مطمئن است؟ (در صورت مطمئن بودن، تاریخ آخرین استفاده به‌روز می‌شود) */
    public static function isTrusted(Request $request, User $user): bool
    {
        $token = $request->cookie(self::COOKIE);
        if (! is_string($token) || $token === '' || ! self::ensureTable()) {
            return false;
        }

        $row = DB::table('trusted_devices')
            ->where('user_id', $user->id)
            ->where('token_hash', self::hash($token))
            ->where('expires_at', '>', now())
            ->first(['id']);
        if (! $row) {
            return false;
        }
        DB::table('trusted_devices')->where('id', $row->id)->update(['last_used_at' => now()]);

        return true;
    }

    /** ثبت دستگاه فعلی به‌عنوان مطمئن و صف‌کردن کوکی در پاسخ */
    public static function trust(Request $request, User $user): void
    {
        if (! self::ensureTable()) {
            return;
        }
        $days = max(1, (int) config('app.trusted_device_days', 180));
        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');

        DB::table('trusted_devices')->where('user_id', $user->id)->where('expires_at', '<', now())->delete();
        DB::table('trusted_devices')->insert([
            'user_id' => $user->id,
            'token_hash' => self::hash($token),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
            'ip' => $request->ip(),
            'created_at' => now(),
            'last_used_at' => now(),
            'expires_at' => now()->addDays($days),
        ]);

        Cookie::queue(Cookie::make(self::COOKIE, $token, $days * 1440, '/', null, $request->isSecure(), true, false, 'lax'));
    }

    /** لغو اعتماد دستگاه‌ها؛ با $exceptCurrent دستگاه جاری حفظ می‌شود */
    public static function revokeAll(string $userId, ?Request $request = null, bool $exceptCurrent = false): void
    {
        if (! self::ensureTable()) {
            return;
        }
        $query = DB::table('trusted_devices')->where('user_id', $userId);
        $token = $request?->cookie(self::COOKIE);
        if ($exceptCurrent && is_string($token) && $token !== '') {
            $query->where('token_hash', '!=', self::hash($token));
        }
        $query->delete();
    }
}
