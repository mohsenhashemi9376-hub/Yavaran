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
     * تأیید مجدد رمز عبور برای دسترسی به پرونده‌های تربیتی: پس از ورود و پس از هر ۶ ساعت بی‌فعالیتی
     * (در همان نشست) باید رمز دوباره وارد شود.
     */
    'require_password_reconfirm_nurturing' => (bool) env('REQUIRE_REAUTH_NURTURING', true),
    'reauth_minutes' => (int) env('REAUTH_MINUTES', 360),

    /* دستگاه مطمئن: پس از ورود دومرحله‌ای موفق، در همان دستگاه فقط رمز عبور کافی است (روز) */
    'trusted_device_days' => (int) env('TRUSTED_DEVICE_DAYS', 180),

    /*
     * کلید اختصاصی رمزنگاری اطلاعات تربیتی (جدا از APP_KEY). NURTURING_KEY مقدار base64 یا فایل کلید خارج از public_html (NURTURING_KEY_FILE).
     * ساخت کلید: php artisan nurturing:generate-key ؛ چرخش: php artisan nurturing:rotate-key
     */
    'nurturing_key' => env('NURTURING_KEY'),
    'nurturing_key_file' => env('NURTURING_KEY_FILE'),
    'nurturing_key_previous' => env('NURTURING_KEY_PREVIOUS'),

    /* پشتیبان رمزنگاری‌شده با کلیدی جدا از APP_KEY و NURTURING_KEY؛ مدت نگهداری (روز) */
    'backup_key' => env('BACKUP_KEY'),
    'backup_keep_days' => (int) env('BACKUP_KEEP_DAYS', 7),

    /* هشدارهای امنیتی در ایتا (ربات ایتایار): توکن ربات و شناسه‌ی کانال/گروه */
    'eitaa_token' => env('EITAA_TOKEN'),
    'eitaa_chat_id' => env('EITAA_CHAT_ID'),
    'eitaa_api_base' => env('EITAA_API_BASE', 'https://eitaayar.ir/api'),

    /*
     * محدودیت دسترسی مربی و معاون تربیتی: فهرست IP/CIDR مجاز (با ویرگول؛ خالی = بدون محدودیت)
     * و اجبار ساعت مدرسه برای مربی (معاون تربیتی همیشه مجاز است).
     */
    'nurturing_allowed_ips' => env('NURTURING_ALLOWED_IPS'),
    'nurturing_enforce_hours' => (bool) env('NURTURING_ENFORCE_HOURS', false),

    /* دستگاه مطمئن برای مربی و معاون تربیتی کوتاه‌تر است (روز) */
    'trusted_device_days_nurturing' => (int) env('TRUSTED_DEVICE_DAYS_NURTURING', 14),

    /*
     * عمر مطلق نشست مربی و معاون تربیتی (ساعت): پس از آن، حتی با فعالیت، دوباره باید وارد شوند.
     * بی‌فعالیتی (دقیقه): ۰ = غیرفعال (حفاظت با تأیید مجدد رمز انجام می‌شود).
     */
    'nurturing_session_max_hours' => (int) env('NURTURING_SESSION_MAX_HOURS', 14),
    'nurturing_idle_minutes' => (int) env('NURTURING_IDLE_MINUTES', 0),

    /* سقف باز کردن پرونده توسط مربی؛ پس از آن تا پایان بازه، دسترسی موقتاً قفل می‌شود */
    'nurturing_bulk_block_limit' => (int) env('NURTURING_BULK_BLOCK_LIMIT', 30),
    'nurturing_daily_view_limit' => (int) env('NURTURING_DAILY_VIEW_LIMIT', 150),

    /* حداقل طول رمز عبور مربی و معاون تربیتی */
    'nurturing_password_min' => (int) env('NURTURING_PASSWORD_MIN', 8),

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
