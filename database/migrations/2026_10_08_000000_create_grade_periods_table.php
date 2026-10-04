<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** بازه‌های فعال ثبت نمره (مستمر ماهانه و پایانی نوبت‌ها) */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grade_periods', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('name', 100)->default('');
            $table->string('code', 50)->index();
            $table->boolean('is_active')->default(false);
            $table->date('deadline')->nullable();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grade_periods');
    }
};
