<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * نمرات و تنظیمات آزمون جامع (یک رکورد برای هر کلاس).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comprehensive_exams', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('class_id', 100)->nullable()->index();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comprehensive_exams');
    }
};
