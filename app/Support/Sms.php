<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/** ارسال پیامک کد تأیید (کاوه‌نگار: verify/lookup) */
final class Sms
{
    /** شماره همراه ایران را به شکل 09XXXXXXXXX درمی‌آورد؛ نامعتبر = null */
    public static function normalizePhone(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', Digits::toEnglish((string) $phone)) ?? '';
        if (str_starts_with($digits, '0098')) {
            $digits = substr($digits, 4);
        } elseif (str_starts_with($digits, '98')) {
            $digits = substr($digits, 2);
        }
        $digits = ltrim($digits, '0');

        return preg_match('/^9\d{9}$/', $digits) ? '0'.$digits : null;
    }

    public static function mask(string $phone): string
    {
        return substr($phone, 0, 4).'***'.substr($phone, -3);
    }

    /** @throws RuntimeException وقتی ارسال ناموفق باشد */
    public static function sendCode(string $phone, string $code): void
    {
        $driver = (string) config('sms.driver');

        if ($driver === 'log') {
            if (app()->environment('production')) {
                throw new RuntimeException('درگاه پیامک «log» در محیط واقعی مجاز نیست.');
            }
            Log::info("SMS OTP {$phone}: {$code}");

            return;
        }

        if ($driver === 'tsms') {
            self::sendViaTsms($phone, $code);

            return;
        }

        $key = (string) config('sms.api_key');
        if ($driver !== 'kavenegar' || $key === '') {
            throw new RuntimeException('درگاه پیامک تنظیم نشده است.');
        }

        $response = Http::timeout(10)->asForm()->post("https://api.kavenegar.com/v1/{$key}/verify/lookup.json", [
            'receptor' => $phone,
            'token' => $code,
            'template' => config('sms.template'),
        ]);

        if (! $response->successful() || (int) $response->json('return.status') !== 200) {
            Log::warning('SMS send failed', ['status' => $response->status(), 'return' => $response->json('return.status')]);
            throw new RuntimeException('ارسال پیامک ناموفق بود.');
        }
    }

    /** TSMS (tsms.ir): موفقیت = عدد مثبت بزرگ (شناسه‌ی رهگیری)؛ عدد منفی یا خطای ارتباط = خطا */
    private static function sendViaTsms(string $phone, string $code): void
    {
        $username = (string) config('sms.tsms.username');
        $password = (string) config('sms.tsms.password');
        $from = (string) config('sms.tsms.from');
        if ($username === '' || $password === '' || $from === '') {
            throw new RuntimeException('درگاه پیامک تنظیم نشده است.');
        }

        try {
            $response = Http::timeout(10)->asForm()->post((string) config('sms.tsms.url'), [
                'username' => $username,
                'password' => $password,
                'from' => $from,
                'to' => $phone,
                'text' => "کد ورود شما به سامانه‌ی مدرسه: {$code}",
            ]);
        } catch (\Throwable $e) {
            Log::warning('TSMS connection failed', ['error' => $e->getMessage()]);
            throw new RuntimeException('ارتباط با درگاه پیامک برقرار نشد.');
        }

        $body = trim((string) $response->body());
        if (! $response->successful() || ! preg_match('/^\d{3,}$/', $body)) {
            // فقط وضعیت/کد خطا لاگ می‌شود؛ شماره و متن کد هرگز
            Log::warning('TSMS send failed', ['http' => $response->status(), 'response' => mb_substr($body, 0, 50)]);
            throw new RuntimeException('ارسال پیامک ناموفق بود.');
        }
    }
}
