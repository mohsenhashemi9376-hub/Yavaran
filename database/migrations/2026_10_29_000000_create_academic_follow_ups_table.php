<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * وضعیت پیگیری آموزشی دانش‌آموزان (مدیر و معاونت آموزش).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_follow_ups', function (Blueprint $table) {
            $table->string('id', 150)->primary();
            $table->string('student_id', 100)->unique();
            $table->string('class_id', 100)->nullable()->index();
            $table->string('status', 20)->default('open')->index();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('academic_follow_ups');
    }
};
