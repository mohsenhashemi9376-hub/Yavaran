<?php

namespace App\Console\Commands;

use App\Support\Sync\NurturingEncryptor;
use Illuminate\Console\Command;

class EncryptNurturingData extends Command
{
    protected $signature = 'nurturing:encrypt';

    protected $description = 'رمزنگاری رکوردهای قدیمی پرونده‌های تربیتی و مشاهدات رفتاری (متن ساده ← AES-256)';

    public function handle(): int
    {
        $count = NurturingEncryptor::run();
        $this->info("{$count} رکورد رمزنگاری شد.");

        return self::SUCCESS;
    }
}
