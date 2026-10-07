<?php

namespace App\Support;

use Illuminate\Contracts\Session\Session;

/**
 * تأیید مجدد رمز عبور (Sudo mode) برای بخش‌های محرمانه.
 * زمان آخرین تأیید در نشست نگهداری می‌شود؛ ورود موفق خودش یک تأیید است.
 * هر عملیات کاربر (مشاهده‌ی پرونده، ثبت و ...) مهلت را تمدید می‌کند، پس پس از ۳۰ دقیقه بی‌فعالیتی دوباره رمز خواسته می‌شود.
 */
final class PasswordConfirmation
{
    public const KEY = 'nurturing.confirmed_at';

    private static function session(): ?Session
    {
        $request = request();

        return $request && $request->hasSession() ? $request->session() : null;
    }

    public static function minutes(): int
    {
        return max(1, (int) config('app.reauth_minutes', 30));
    }

    /** @param  bool  $touch  در صورت معتبر بودن، مهلت تمدید شود (فقط برای عملیات واقعی کاربر، نه بازخوانی پس‌زمینه) */
    public static function isFresh(bool $touch = true): bool
    {
        $session = self::session();
        if (! $session) {
            return false;
        }

        $at = (int) $session->get(self::KEY, 0);
        $fresh = $at > 0 && (now()->getTimestamp() - $at) <= self::minutes() * 60;
        if ($fresh && $touch) {
            $session->put(self::KEY, now()->getTimestamp());
        }

        return $fresh;
    }

    public static function confirm(): void
    {
        self::session()?->put(self::KEY, now()->getTimestamp());
    }
}
