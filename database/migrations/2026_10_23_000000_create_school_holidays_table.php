<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** روزهای تعطیل اعلام‌شده‌ی مدرسه (حضور و غیاب آن روز بسته است) */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('school_holidays')) {
            return;
        }
        Schema::create('school_holidays', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('holiday_date', 20)->unique();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_holidays');
    }
};
