<?php

return [
    'name' => env('APP_NAME', 'مدرسه یاوران ولایت'),
    'env' => env('APP_ENV', 'production'),
    'debug' => (bool) env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),

    /*
     * ورود دومرحله‌ای (TOTP) اجباری برای مربی و معاون تربیتی؛ بدون آن پرونده‌های تربیتی در دسترس نیست.
     */
    'require_two_factor_nurturing' => (bool) env('REQUIRE_2FA_NURTURING', true),

    /*
     * تأیید مجدد رمز عبور برای دسترسی به پرونده‌های تربیتی: پس از ورود و پس از هر ۳۰ دقیقه بی‌فعالیتی
     * (در همان نشست) باید رمز دوباره وارد شود.
     */
    'require_password_reconfirm_nurturing' => (bool) env('REQUIRE_REAUTH_NURTURING', true),
    'reauth_minutes' => (int) env('REAUTH_MINUTES', 30),

    /*
     * خروج کامل مربی و معاون تربیتی: پس از این مدت بی‌فعالیتی (دقیقه؛ پیش‌فرض ۶۰ — پیش از آن، پس از ۳۰ دقیقه فقط رمز دوباره خواسته می‌شود) و سقف مطلق عمر نشست (ساعت).
     */
    'nurturing_idle_minutes' => (int) env('NURTURING_IDLE_MINUTES', 60),
    'nurturing_session_max_hours' => (int) env('NURTURING_SESSION_MAX_HOURS', 8),

    /* حداقل طول رمز عبور مربی و معاون تربیتی */
    'nurturing_password_min' => (int) env('NURTURING_PASSWORD_MIN', 12),

    /*
     * ساعت مدرسه (به وقت تهران)؛ دسترسی کاربران پرونده‌های تربیتی خارج از این بازه هشدار می‌دهد.
     */
    'nurturing_hours_start' => (int) env('NURTURING_HOURS_START', 6),
    'nurturing_hours_end' => (int) env('NURTURING_HOURS_END', 20),

    /*
     * Content-Security-Policy: enforce | report-only | off
     */
    'csp_mode' => env('CSP_MODE', 'enforce'),
    'timezone' => env('APP_TIMEZONE', 'Asia/Tehran'),
    'locale' => env('APP_LOCALE', 'fa'),
    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),
    'faker_locale' => env('APP_FAKER_LOCALE', 'fa_IR'),
    'cipher' => 'AES-256-CBC',
    'key' => env('APP_KEY'),
    'previous_keys' => [
        ...array_filter(explode(',', (string) env('APP_PREVIOUS_KEYS', ''))),
    ],
    'maintenance' => [
        'driver' => env('APP_MAINTENANCE_DRIVER', 'file'),
        'store' => env('APP_MAINTENANCE_STORE', 'file'),
    ],
];
