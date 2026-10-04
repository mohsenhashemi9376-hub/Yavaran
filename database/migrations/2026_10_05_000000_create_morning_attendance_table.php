<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * حضور و غیاب صبحگاه (ناظم/معاون اجرایی) + ستون‌های گزارش‌پذیر جلسات کلاسی.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('morning_attendance', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('student_id', 100)->index();
            $table->string('class_id', 100)->nullable()->index();
            $table->string('record_date', 20)->index();
            $table->string('status', 10)->default('absent');
            $table->time('entry_time')->nullable();
            $table->integer('delay_minutes')->default(0);
            $table->boolean('is_acknowledged')->default(false)->index();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
            $table->unique(['student_id', 'record_date'], 'morning_attendance_student_date_unique');
        });

        Schema::table('attendance_sessions', function (Blueprint $table) {
            $table->string('subject_id', 100)->nullable()->after('subject');
            $table->unsignedTinyInteger('period_number')->nullable()->after('subject_id');
            $table->string('lesson_topic', 255)->nullable()->after('period_number');
        });
    }

    public function down(): void
    {
        Schema::table('attendance_sessions', function (Blueprint $table) {
            $table->dropColumn(['subject_id', 'period_number', 'lesson_topic']);
        });
        Schema::dropIfExists('morning_attendance');
    }
};
