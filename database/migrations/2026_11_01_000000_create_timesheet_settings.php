<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** تنظیمات خودارزیابی اساتید: فهرست شاخص‌های قابل ویرایش توسط مدیر مدرسه */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('timesheet_settings', function (Blueprint $table) {
            $table->string('key', 60)->primary();
            $table->longText('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('timesheet_settings');
    }
};
