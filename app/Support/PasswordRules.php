<?php

namespace App\Support;

/** قواعد رمز عبور: رد رمزهای پیش‌فرض و رایج */
final class PasswordRules
{
    private const WEAK = [
        '123', '1234', '12345', '123456', '1234567', '12345678', '123456789', '0123456789',
        '000000', '111111', '654321', 'password', 'passw0rd', 'qwerty', 'qwerty123', 'abc123', 'admin', 'admin123',
    ];

    public const MIN_LENGTH_FORCED = 8;

    /** حداقل طول رمز عبور برای همه‌ی نقش‌ها ۸ کاراکتر است */
    public static function minLengthFor(?string $role = null): int
    {
        return self::MIN_LENGTH_FORCED;
    }

    /** پیام خطای رمز کوتاه (با ارقام فارسی) */
    public static function tooShortMessage(): string
    {
        return 'رمز عبور باید حداقل '.strtr((string) self::MIN_LENGTH_FORCED, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']).' کاراکتر باشد.';
    }

    public static function isWeak(string $plain, ?string $username = null): bool
    {
        $p = mb_strtolower(trim($plain));
        if ($p === '' || in_array($p, self::WEAK, true)) {
            return true;
        }

        return $username !== null && $p === mb_strtolower(trim($username));
    }
}
