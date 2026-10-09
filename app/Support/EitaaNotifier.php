<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * ارسال هشدارهای امنیتی به «ایتا» (ربات ایتایار).
 *
 * فقط متن کوتاه رویداد (نام حساب، نوع رویداد، زمان) ارسال می‌شود؛ هرگز نام یا اطلاعات دانش‌آموز و محتوای پرونده.
 * تنظیمات: EITAA_TOKEN ، EITAA_CHAT_ID (شناسه‌ی کانال/گروه که ربات در آن مدیر است) ، EITAA_API_BASE (اختیاری).
 * خطاهای شبکه بلعیده می‌شوند و هرگز مانع کار کاربر نمی‌شوند.
 */
final class EitaaNotifier
{
    public static function enabled(): bool
    {
        return (string) config('app.eitaa_token') !== '' && (string) config('app.eitaa_chat_id') !== '';
    }

    public static function send(string $title, string $message): bool
    {
        if (! self::enabled()) {
            return false;
        }

        try {
            $base = rtrim((string) config('app.eitaa_api_base', 'https://eitaayar.ir/api'), '/');
            $response = Http::asForm()->timeout(5)->connectTimeout(3)
                ->post($base.'/'.config('app.eitaa_token').'/sendMessage', [
                    'chat_id' => (string) config('app.eitaa_chat_id'),
                    'title' => mb_substr($title, 0, 100),
                    'text' => "🔔 {$title}\n\n{$message}\n\n".now()->setTimezone('Asia/Tehran')->format('Y-m-d H:i'),
                ]);

            return $response->successful();
        } catch (\Throwable $e) {
            Log::warning('eitaa notify failed: '.$e->getMessage());

            return false;
        }
    }
}
