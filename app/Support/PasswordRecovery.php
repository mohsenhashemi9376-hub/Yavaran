<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

/**
 * فراموشی رمز عبور. سامانه ایمیل/پیامک ندارد، پس دو مسیر امن هست:
 *  ۱) درخواست از صفحه‌ی ورود: به مسئول بالادست اعلان فوری می‌رود و او رمز موقت می‌گذارد (کاربر در ورود بعدی مجبور به تغییر آن می‌شود).
 *  ۲) کلید بازیابی سرور (PASSWORD_RECOVERY_KEY در .env): فقط کسی که به فایل .env سرور دسترسی دارد می‌تواند رمز هر حساب (از جمله مدیر) را عوض کند.
 */
final class PasswordRecovery
{
    /** کلید بازیابی؛ خالی یعنی این مسیر خاموش است */
    public static function key(): string
    {
        return trim((string) config('app.password_recovery_key', ''));
    }

    public static function keyMatches(string $given): bool
    {
        $key = self::key();

        // کلید کوتاه حدس‌پذیر است؛ حداقل ۱۶ کاراکتر
        return mb_strlen($key) >= 16 && hash_equals($key, trim($given));
    }

    /** نشانی کاربری که باید به درخواست او رسیدگی کند */
    private static function approverRoles(User $user): array
    {
        return match ($user->role) {
            'vice_nurturing' => ['admin'],
            'coach' => ['vice_nurturing', 'admin'],
            default => ['admin'],
        };
    }

    /**
     * ثبت درخواست فراموشی رمز و اعلان به مسئول. خروجی هیچ‌چیز درباره‌ی وجود یا نبودن حساب لو نمی‌دهد.
     * برای مدیر سامانه کسی بالاتر نیست؛ او باید از کلید بازیابی یا ترمینال استفاده کند.
     */
    public static function request(string $username, ?string $ip): void
    {
        try {
            $user = User::query()->where('username', $username)->orWhere('phone', $username)->first();
            if (! $user || ! $user->isActive() || $user->role === 'admin') {
                return;
            }
            // هر حساب در هر ۱۰ دقیقه فقط یک درخواست (جلوگیری از انبوه اعلان)
            if (! Cache::add('pw-forgot:'.$user->id, 1, now()->addMinutes(10))) {
                return;
            }

            $receivers = [];
            foreach (self::approverRoles($user) as $role) {
                $receivers = DB::table('users')->where('is_active', true)->where('role', $role)->pluck('id')->all();
                if ($receivers !== []) {
                    break; // اولین نقشِ دارای کاربر فعال
                }
            }

            Notifier::send($receivers, [
                'title' => 'درخواست بازیابی رمز عبور',
                'message' => sprintf(
                    '«%s» (نام کاربری: %s) رمز عبور خود را فراموش کرده است (IP: %s). اگر مطمئن هستید خودِ اوست، از بخش کاربران یک رمز موقت برایش تعیین کنید؛ او در ورود بعدی باید رمز را تغییر دهد.',
                    $user->name, $user->username, $ip ?? '—'
                ),
                'type' => 'announcement',
                'priority' => 'urgent',
                'ref_id' => 'password_request',
            ]);
        } catch (\Throwable) {
            // پاسخ به کاربر نباید خطا یا اطلاعاتی لو بدهد
        }
    }

    /** تعیین رمز جدید: رمز قبلی، اعتماد دستگاه‌ها و نشست‌های دیگر بی‌اعتبار می‌شود */
    public static function apply(User $user, string $plain, bool $forceChange): void
    {
        $changes = ['password' => Hash::make($plain), 'password_encrypted' => null];
        if (Schema::hasColumn('users', 'must_change_password')) {
            $changes['must_change_password'] = $forceChange;
        }
        $user->forceFill($changes)->save();
        TrustedDevices::revokeAll((string) $user->id);
    }
}
