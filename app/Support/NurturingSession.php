<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

/**
 * بسته شدن نشست‌های مربی و معاون تربیتی توسط معاون تربیتی (ستون sessions_revoked_at).
 * نشست به‌طور خودکار منقضی نمی‌شود؛ حفاظت از پرونده‌ها با تأیید مجدد رمز (پس از ۶ ساعت بی‌فعالیتی) انجام می‌شود.
 */
final class NurturingSession
{
    public const LOGIN_AT = 'nurturing.login_at';

    public const ROLES = ['coach', 'vice_nurturing'];

    public static function applies(?User $user): bool
    {
        return $user !== null && in_array($user->role, self::ROLES, true);
    }

    /** آغاز نشست پس از ورود موفق */
    public static function start(Request $request): void
    {
        $request->session()->put(self::LOGIN_AT, now()->getTimestamp());
    }

    /** ستون بسته شدن نشست‌ها را در دیتابیس‌های به‌روزنشده اضافه می‌کند */
    public static function ensureColumn(): bool
    {
        static $ready = null;
        if ($ready !== null) {
            return $ready;
        }
        try {
            if (! Schema::hasColumn('users', 'sessions_revoked_at')) {
                Schema::table('users', function ($t): void {
                    $t->timestamp('sessions_revoked_at')->nullable();
                });
            }
        } catch (\Throwable) {
        }

        return $ready = Schema::hasColumn('users', 'sessions_revoked_at');
    }

    /** @return string|null دلیل نامعتبر بودن نشست؛ null = معتبر */
    public static function violation(Request $request, User $user): ?string
    {
        $loginAt = (int) $request->session()->get(self::LOGIN_AT, 0);
        $revokedAt = self::ensureColumn() && $user->getAttribute('sessions_revoked_at')
            ? \Illuminate\Support\Carbon::parse($user->getAttribute('sessions_revoked_at'))->getTimestamp()
            : 0;

        if ($loginAt === 0) {
            // نشست قدیمی بدون زمان ورود: اگر نشست‌ها بسته شده‌اند معتبر نیست، وگرنه از همین لحظه شروع می‌شود
            if ($revokedAt > 0) {
                return 'revoked';
            }
            self::start($request);

            return null;
        }

        return $revokedAt > 0 && $loginAt <= $revokedAt ? 'revoked' : null;
    }

    public static function message(string $reason): string
    {
        return 'نشست شما توسط معاون تربیتی بسته شده است. دوباره وارد شوید.';
    }
}
