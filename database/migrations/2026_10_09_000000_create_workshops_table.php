<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** کارگاه‌های انتخابی علمی و مهارتی (هشتم و نهم) — اعضا داخل ستون data (studentIds) نگهداری می‌شوند */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshops', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('name', 100)->default('');
            $table->string('type', 20)->default('workshop');
            $table->string('category', 20)->default('scientific');
            $table->string('teacher_id', 100)->nullable()->index();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workshops');
    }
};
