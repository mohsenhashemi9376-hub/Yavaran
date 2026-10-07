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

    public static function isWeak(string $plain, ?string $username = null): bool
    {
        $p = mb_strtolower(trim($plain));
        if ($p === '' || in_array($p, self::WEAK, true)) {
            return true;
        }

        return $username !== null && $p === mb_strtolower(trim($username));
    }
}
