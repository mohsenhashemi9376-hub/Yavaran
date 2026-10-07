<?php

use App\Support\Sync\NurturingEncryptor;
use Illuminate\Database\Migrations\Migration;

/** رمزنگاری محتوای پرونده‌های تربیتی، ارزیابی رشد و مشاهدات رفتاری (کست encrypted) */
return new class extends Migration
{
    public function up(): void
    {
        NurturingEncryptor::run();
    }

    public function down(): void
    {
        // رمزنگاری برگشت‌پذیر نیست؛ داده‌ها همچنان با کلید برنامه قابل خواندن هستند.
    }
};
