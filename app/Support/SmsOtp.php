<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use RuntimeException;

/** کد یکبارمصرف پیامکی ورود؛ فقط هش کد در نشست نگه‌داری می‌شود و پس از یک‌بار استفاده باطل است */
final class SmsOtp
{
    public const SESSION_KEY = 'two_factor';

    public static function requiredFor(User $user): bool
    {
        return (bool) config('sms.otp_enabled') && in_array($user->role, (array) config('sms.otp_roles'), true);
    }

    private static function hash(string $code, string $userId): string
    {
        return hash_hmac('sha256', $userId.'|'.$code, (string) config('app.key'));
    }

    /**
     * ساخت و ارسال کد جدید و قرار دادن مرحله‌ی تأیید در نشست.
     *
     * @return array{phone: string, resendIn: int}
     *
     * @throws RuntimeException با پیام قابل‌نمایش به کاربر
     */
    public static function issue(Request $request, User $user): array
    {
        $phone = Sms::normalizePhone($user->phone);
        if (! $phone) {
            throw new RuntimeException('شماره همراه برای حساب شما ثبت نشده است. لطفاً با مدیر سامانه تماس بگیرید.');
        }

        $limitKey = 'sms-otp-send:'.$user->id;
        if (RateLimiter::tooManyAttempts($limitKey, 5)) {
            throw new RuntimeException('تعداد درخواست کد زیاد است. چند دقیقه بعد دوباره تلاش کنید.');
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        try {
            Sms::sendCode($phone, $code);
        } catch (RuntimeException) {
            throw new RuntimeException('ارسال پیامک ممکن نشد. کمی بعد دوباره تلاش کنید یا با مدیر سامانه تماس بگیرید.');
        }
        RateLimiter::hit($limitKey, 600);

        $now = now()->timestamp;
        $request->session()->put(self::SESSION_KEY, [
            'user_id' => $user->id,
            'method' => 'sms',
            'code_hash' => self::hash($code, $user->id),
            'expires' => $now + max(60, (int) config('sms.otp_ttl_seconds')),
            'resend_at' => $now + (int) config('sms.otp_resend_seconds'),
            'attempts' => 0,
        ]);

        return ['phone' => Sms::mask($phone), 'resendIn' => (int) config('sms.otp_resend_seconds')];
    }

    /** بررسی کد واردشده؛ در صورت موفقیت، کد باطل می‌شود. پس از ۵ اشتباه کد باطل است. */
    public static function verify(Request $request, string $code): bool
    {
        $pending = $request->session()->get(self::SESSION_KEY);
        if (! is_array($pending) || ($pending['method'] ?? null) !== 'sms') {
            return false;
        }

        $pending['attempts'] = (int) ($pending['attempts'] ?? 0) + 1;
        $plain = preg_replace('/\D+/', '', Digits::toEnglish($code)) ?? '';
        $ok = $pending['attempts'] <= 5
            && $plain !== ''
            && hash_equals((string) $pending['code_hash'], self::hash($plain, (string) $pending['user_id']));

        if ($ok) {
            return true;
        }
        if ($pending['attempts'] >= 5) {
            $request->session()->forget(self::SESSION_KEY); // کد باطل؛ ورود از ابتدا
        } else {
            $request->session()->put(self::SESSION_KEY, $pending);
        }

        return false;
    }
}
