<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** طرح درس روزانه‌ی اساتید و بررسی معاونت آموزش */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('lesson_plans')) {
            return;
        }
        Schema::create('lesson_plans', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('teacher_id', 100)->index();
            $table->string('class_id', 100)->nullable()->index();
            $table->string('plan_date', 20)->index();
            $table->string('status', 20)->default('draft')->index();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_plans');
    }
};
