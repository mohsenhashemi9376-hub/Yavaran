<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

/**
 * کنترل نشست مربی و معاون تربیتی:
 * - خروج خودکار پس از چند دقیقه بی‌فعالیتی (بازخوانی‌های پس‌زمینه مهلت را تمدید نمی‌کنند)؛
 * - سقف مطلق عمر نشست؛
 * - بسته شدن نشست‌ها توسط معاون تربیتی (ستون sessions_revoked_at).
 */
final class NurturingSession
{
    public const LOGIN_AT = 'nurturing.login_at';

    public const LAST_ACTIVITY = 'nurturing.last_activity';

    public const ROLES = ['coach', 'vice_nurturing'];

    /** درخواست‌هایی که خودکار و پس‌زمینه‌اند و نشانه‌ی فعالیت کاربر نیستند */
    private const BACKGROUND = ['api/bootstrap', 'api/notifications', 'api/mentor-messages/active', 'api/mentor-messages/sent'];

    public static function applies(?User $user): bool
    {
        return $user !== null && in_array($user->role, self::ROLES, true);
    }

    public static function idleSeconds(): int
    {
        return max(1, (int) config('app.nurturing_idle_minutes', 20)) * 60;
    }

    public static function maxSeconds(): int
    {
        return max(1, (int) config('app.nurturing_session_max_hours', 8)) * 3600;
    }

    /** آغاز نشست پس از ورود موفق */
    public static function start(Request $request): void
    {
        $now = now()->getTimestamp();
        $request->session()->put(self::LOGIN_AT, $now);
        $request->session()->put(self::LAST_ACTIVITY, $now);
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

    /** @return string|null دلیل نامعتبر بودن نشست؛ null = معتبر (و مهلت در صورت فعالیت واقعی تمدید می‌شود) */
    public static function violation(Request $request, User $user): ?string
    {
        $session = $request->session();
        $now = now()->getTimestamp();

        $loginAt = (int) $session->get(self::LOGIN_AT, 0);
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

        if ($revokedAt > 0 && $loginAt <= $revokedAt) {
            return 'revoked';
        }
        if ($now - $loginAt > self::maxSeconds()) {
            return 'max';
        }
        $last = (int) $session->get(self::LAST_ACTIVITY, $loginAt);
        if ($now - $last > self::idleSeconds()) {
            return 'idle';
        }

        if (! self::isBackground($request)) {
            $session->put(self::LAST_ACTIVITY, $now);
        }

        return null;
    }

    private static function isBackground(Request $request): bool
    {
        return $request->isMethod('GET') && $request->is(...self::BACKGROUND);
    }

    public static function message(string $reason): string
    {
        return match ($reason) {
            'idle' => 'به دلیل چند دقیقه بی‌فعالیتی، برای حفاظت از اطلاعات از سامانه خارج شدید. دوباره وارد شوید.',
            'max' => 'مدت مجاز نشست به پایان رسید. برای ادامه دوباره وارد شوید.',
            default => 'نشست شما توسط معاون تربیتی بسته شده است. دوباره وارد شوید.',
        };
    }
}
