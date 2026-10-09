<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class GenerateNurturingKey extends Command
{
    protected $signature = 'nurturing:generate-key';

    protected $description = 'ساخت کلید تصادفی اختصاصی برای رمزنگاری اطلاعات تربیتی (فقط نمایش؛ ذخیره نمی‌شود)';

    public function handle(): int
    {
        $this->line('base64:'.base64_encode(random_bytes(32)));
        $this->warn('این مقدار را در NURTURING_KEY (یا بهتر: در فایلی بیرون از public_html با مسیر NURTURING_KEY_FILE) بگذارید و از آن نسخه‌ی پشتیبان آفلاین بگیرید؛ با گم شدن کلید، داده‌ها قابل بازیابی نیستند.');
        $this->warn('سپس: php artisan nurturing:rotate-key  و در NURTURING_KEY_PREVIOUS مقدار APP_KEY را بگذارید تا داده‌های قدیمی خوانده شوند.');

        return self::SUCCESS;
    }
}
