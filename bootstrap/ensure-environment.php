<?php

/*
|--------------------------------------------------------------------------
| آماده‌سازی خودکار محیط برای هاست اشتراکی
|--------------------------------------------------------------------------
| - اگر فایل .env وجود نداشته باشد از روی .env.example ساخته می‌شود.
| - اگر APP_KEY خالی باشد یک کلید امن تصادفی تولید و ذخیره می‌شود.
| - پوشه‌های لازم storage در صورت نبود ساخته می‌شوند.
*/

(static function (): void {
    $base = dirname(__DIR__);
    $env = $base.'/.env';
    $example = $base.'/.env.example';

    foreach ([
        'storage/app/public',
        'storage/framework/cache/data',
        'storage/framework/sessions',
        'storage/framework/views',
        'storage/logs',
        'bootstrap/cache',
    ] as $dir) {
        if (! is_dir($base.'/'.$dir)) {
            @mkdir($base.'/'.$dir, 0755, true);
        }
    }

    if (! is_file($env) && is_file($example)) {
        @copy($example, $env);
    }

    if (! is_file($env) || ! is_writable($env)) {
        return;
    }

    $contents = (string) file_get_contents($env);

    if (preg_match('/^APP_KEY=\s*$/m', $contents) || ! preg_match('/^APP_KEY=/m', $contents)) {
        $key = 'base64:'.base64_encode(random_bytes(32));

        $contents = preg_match('/^APP_KEY=/m', $contents)
            ? preg_replace('/^APP_KEY=.*$/m', 'APP_KEY='.$key, $contents, 1)
            : "APP_KEY={$key}\n".$contents;

        file_put_contents($env, $contents, LOCK_EX);
        @unlink($base.'/bootstrap/cache/config.php');
    }
})();
