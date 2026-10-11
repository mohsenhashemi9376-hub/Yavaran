<?php

namespace App\Console\Commands;

use App\Support\WebPush;
use Illuminate\Console\Command;

class GenerateVapidKeys extends Command
{
    protected $signature = 'inbox:vapid-generate';

    protected $description = 'ساخت کلید VAPID برای اعلان فوری صندوق پیام روی گوشی (یک‌بار؛ سپس در .env قرار دهید)';

    public function handle(): int
    {
        $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        if ($key === false || ! openssl_pkey_export($key, $pem)) {
            $this->error('ساخت کلید ممکن نشد (افزونه openssl را بررسی کنید).');

            return self::FAILURE;
        }
        $ec = openssl_pkey_get_details($key)['ec'];
        $public = WebPush::b64u("\x04".str_pad($ec['x'], 32, "\0", STR_PAD_LEFT).str_pad($ec['y'], 32, "\0", STR_PAD_LEFT));

        $this->line('این خطوط را به فایل .env اضافه کنید (کلید خصوصی را جایی منتشر نکنید):');
        $this->line('VAPID_PUBLIC_KEY='.$public);
        $this->line('VAPID_PRIVATE_KEY='.base64_encode($pem));
        $this->line('VAPID_SUBJECT=mailto:آدرس-ایمیل-مدرسه');

        return self::SUCCESS;
    }
}
