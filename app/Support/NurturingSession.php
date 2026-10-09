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

    public const LAST_SEEN = 'nurturing.last_seen';

    public const ROLES = ['coach', 'vice_nurturing'];

    public static function applies(?User $user): bool
    {
        return $user !== null && in_array($user->role, self::ROLES, true);
    }

    /** آغاز نشست پس از ورود موفق */
    public static function start(Request $request): void
    {
        $request->session()->put(self::LOGIN_AT, now()->getTimestamp());
        $request->session()->put(self::LAST_SEEN, now()->getTimestamp());
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

    /** @return string|null 'ip' | 'hours' اگر دسترسی از این شبکه/ساعت مجاز نیست */
    public static function accessBlock(Request $request, User $user): ?string
    {
        $allowed = array_values(array_filter(array_map('trim', explode(',', (string) config('app.nurturing_allowed_ips', '')))));
        if ($allowed !== [] && ! \Symfony\Component\HttpFoundation\IpUtils::checkIp((string) $request->ip(), $allowed)) {
            return 'ip';
        }
        if ($user->role === 'coach' && config('app.nurturing_enforce_hours') && SecurityAlerts::isOffHours()) {
            return 'hours';
        }

        return null;
    }

    /** @return string|null دلیل نامعتبر بودن نشست؛ null = معتبر */
    public static function violation(Request $request, User $user): ?string
    {
        if ($block = self::accessBlock($request, $user)) {
            return $block;
        }

        $loginAt = (int) $request->session()->get(self::LOGIN_AT, 0);
        $now = now()->getTimestamp();

        $maxHours = (int) config('app.nurturing_session_max_hours', 14);
        if ($loginAt > 0 && $maxHours > 0 && $now - $loginAt > $maxHours * 3600) {
            return 'expired';
        }
        $idle = (int) config('app.nurturing_idle_minutes', 0);
        $lastSeen = (int) $request->session()->get(self::LAST_SEEN, 0);
        if ($idle > 0 && $lastSeen > 0 && $now - $lastSeen > $idle * 60) {
            return 'idle';
        }
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

    /** ثبت آخرین فعالیت واقعی کاربر (نه بازخوانی پس‌زمینه) برای خروج بر اثر بی‌فعالیتی */
    public static function touch(Request $request): void
    {
        $background = $request->isMethod('GET') && ($request->is('api/bootstrap') || $request->is('api/notifications') || $request->is('api/mentor-messages/active'));
        if (! $background) {
            $request->session()->put(self::LAST_SEEN, now()->getTimestamp());
        }
    }

    public static function message(string $reason): string
    {
        if ($reason === 'ip') {
            return 'دسترسی به این بخش فقط از شبکه‌ی مجاز مدرسه امکان‌پذیر است.';
        }
        if ($reason === 'hours') {
            return 'دسترسی به پرونده‌های تربیتی فقط در ساعت مدرسه امکان‌پذیر است.';
        }
        if ($reason === 'expired') {
            return 'مدت نشست شما به پایان رسید. برای ادامه دوباره وارد شوید.';
        }
        if ($reason === 'idle') {
            return 'به دلیل بی‌فعالیتی از سامانه خارج شدید. دوباره وارد شوید.';
        }

        return 'نشست شما توسط معاون تربیتی بسته شده است. دوباره وارد شوید.';
    }
}
