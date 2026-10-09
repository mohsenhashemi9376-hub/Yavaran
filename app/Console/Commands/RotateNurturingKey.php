<?php

namespace App\Console\Commands;

use App\Support\NurturingCrypt;
use App\Support\Sync\NurturingEncryptor;
use Illuminate\Console\Command;

class RotateNurturingKey extends Command
{
    protected $signature = 'nurturing:rotate-key';

    protected $description = 'رمزنگاری دوباره‌ی همه‌ی اطلاعات تربیتی با کلید اصلی جاری (NURTURING_KEY)';

    public function handle(): int
    {
        $this->info(NurturingCrypt::usesDedicatedKey() ? 'کلید اصلی: NURTURING_KEY / فایل کلید.' : 'هشدار: کلید اختصاصی تنظیم نشده و از APP_KEY استفاده می‌شود.');
        $count = NurturingEncryptor::rotate();
        $this->info("{$count} رکورد با کلید جاری رمز شد.");

        return self::SUCCESS;
    }
}
