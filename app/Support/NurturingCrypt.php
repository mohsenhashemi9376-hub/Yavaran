<?php

namespace App\Support;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Encryption\Encrypter;
use RuntimeException;

/**
 * رمزنگاری اطلاعات تربیتی با کلیدی جدا از APP_KEY.
 *
 * ترتیب یافتن کلید اصلی: NURTURING_KEY در .env ← فایل NURTURING_KEY_FILE (ترجیحاً بیرون از public_html و فقط‌خواندنی برای PHP) ← APP_KEY.
 * کلیدهای قبلی (NURTURING_KEY_PREVIOUS، با ویرگول) و APP_KEY برای خواندن داده‌های قدیمی کنار می‌مانند تا چرخش کلید
 * بدون از دست رفتن داده انجام شود (php artisan nurturing:rotate-key).
 */
final class NurturingCrypt
{
    /** @var array<string, Encrypter> نمونه‌ی رمزنگار به‌ازای هر کلید (کلید خودش کلید حافظه است؛ با عوض‌شدن تنظیمات، نمونه‌ی کهنه استفاده نمی‌شود) */
    private static array $cache = [];

    public static function reset(): void
    {
        self::$cache = [];
    }

    private static function make(string $key): Encrypter
    {
        return self::$cache[$key] ??= self::build($key);
    }

    private static function build(string $key): Encrypter
    {
        $key = trim($key);
        $raw = str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7), true) : $key;
        if (! is_string($raw) || $raw === '') {
            throw new RuntimeException('کلید رمزنگاری معتبر نیست.');
        }

        return new Encrypter($raw, (string) config('app.cipher', 'AES-256-CBC'));
    }

    private static function primaryKey(): string
    {
        $key = (string) config('app.nurturing_key', '');
        if ($key === '') {
            $file = (string) config('app.nurturing_key_file', '');
            if ($file !== '' && is_readable($file)) {
                $key = trim((string) file_get_contents($file));
            }
        }

        return $key !== '' ? $key : (string) config('app.key');
    }

    public static function usesDedicatedKey(): bool
    {
        return self::primaryKey() !== (string) config('app.key');
    }

    public static function primary(): Encrypter
    {
        return self::make(self::primaryKey());
    }

    /** @return array<int, Encrypter> کلید اصلی، کلیدهای قبلی و APP_KEY (بدون تکرار) */
    private static function all(): array
    {
        $keys = [self::primaryKey()];
        foreach (explode(',', (string) config('app.nurturing_key_previous', '')) as $k) {
            if (trim($k) !== '') {
                $keys[] = trim($k);
            }
        }
        $keys[] = (string) config('app.key');

        return array_map([self::class, 'make'], array_values(array_unique($keys)));
    }

    public static function encryptString(string $value): string
    {
        return self::primary()->encryptString($value);
    }

    public static function decryptString(string $payload): string
    {
        foreach (self::all() as $encrypter) {
            try {
                return $encrypter->decryptString($payload);
            } catch (DecryptException) {
            }
        }

        throw new DecryptException('The payload is invalid.');
    }

    /** آیا این رمزنوشته با کلید اصلی (جاری) باز می‌شود؟ */
    public static function isCurrent(string $payload): bool
    {
        try {
            self::primary()->decryptString($payload);

            return true;
        } catch (DecryptException) {
            return false;
        }
    }
}
