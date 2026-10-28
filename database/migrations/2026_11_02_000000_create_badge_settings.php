<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** شرایط دریافت نشان‌های «ممتاز انضباطی» و «ممتاز آموزشی» که مدیر مدرسه می‌تواند تغییر دهد */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('badge_settings', function (Blueprint $table) {
            $table->string('key', 40)->primary();
            $table->longText('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('badge_settings');
    }
};
