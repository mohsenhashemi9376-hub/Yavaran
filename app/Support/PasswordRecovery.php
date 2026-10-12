<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * فراموشی رمز عبور: رمز موقت تصادفی به ایمیل ثبت‌شده‌ی کاربر فرستاده می‌شود و کاربر در ورود بعدی مجبور به تغییر آن است.
 * رمز فقط وقتی عوض می‌شود که ایمیل واقعاً ارسال شده باشد (در غیر این صورت رمز قبلی سر جایش می‌ماند).
 */
final class PasswordRecovery
{
    /** ایمیل ثبت‌شده‌ی کاربر (در پروفایل)؛ در صورت نبود یا نامعتبر بودن null */
    public static function emailOf(User $user): ?string
    {
        $email = trim((string) ($user->profile()->email ?? ''));

        return filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null;
    }

    /** ارسال واقعی ایمیل فعال است؟ (با درایور log/array ایمیل به دست کسی نمی‌رسد و کاربر قفل می‌شد) */
    public static function mailConfigured(): bool
    {
        return ! in_array((string) config('mail.default'), ['log', 'array', ''], true);
    }

    /**
     * پاسخ به کاربر همیشه یکسان است و لو نمی‌دهد حساب یا ایمیلی وجود دارد یا نه.
     */
    public static function sendTemporaryPassword(string $username, ?string $ip): void
    {
        try {
            $user = User::query()->where('username', $username)->orWhere('phone', $username)->first();
            if (! $user || ! $user->isActive() || ! self::mailConfigured() || ($email = self::emailOf($user)) === null) {
                return;
            }
            // هر حساب در هر ۱۰ دقیقه فقط یک بار (جلوگیری از سوءاستفاده و انبوه ایمیل)
            if (! Cache::add('pw-forgot:'.$user->id, 1, now()->addMinutes(10))) {
                return;
            }

            $temp = Str::password(10, symbols: false);
            $body = "سلام {$user->name}\n\n"
                ."درخواست بازیابی رمز عبور سامانه‌ی یاوران ولایت برای حساب «{$user->username}» ثبت شد.\n"
                ."رمز موقت شما: {$temp}\n\n"
                ."با این رمز وارد شوید؛ سامانه از شما می‌خواهد بلافاصله رمز جدیدی تعیین کنید.\n"
                .'اگر این درخواست از طرف شما نبوده، به مسئول سامانه اطلاع دهید.';

            Mail::raw($body, static function ($m) use ($email): void {
                $m->to($email)->subject('رمز موقت ورود به سامانه یاوران ولایت');
            });

            $user->forceFill(['password' => \Illuminate\Support\Facades\Hash::make($temp), 'password_encrypted' => null]);
            if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'must_change_password')) {
                $user->forceFill(['must_change_password' => true]);
            }
            $user->save();
            TrustedDevices::revokeAll((string) $user->id);

            if (SecurityAlerts::watched($user)) {
                SecurityAlerts::system('password_reset_email', 'رمز موقت با ایمیل ارسال شد', sprintf('برای «%s» پس از درخواست فراموشی رمز، رمز موقت به ایمیل ثبت‌شده ارسال شد (IP: %s).', $user->name, $ip ?? '—'));
            }
        } catch (\Throwable $e) {
            report($e); // خطای ارسال؛ رمز قبلی دست‌نخورده می‌ماند
        }
    }
}
