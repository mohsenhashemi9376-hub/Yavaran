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
