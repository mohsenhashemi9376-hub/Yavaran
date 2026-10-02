<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * انتساب آموزشی سه‌طرفه: کلاس + درس + استاد (کاربر).
 * کاملاً مستقل از مربی تربیتی کلاس است و هر کاربری می‌تواند استاد یک درس باشد.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('course_assignments', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('class_id', 100)->index();
            $table->string('subject_id', 100)->index();
            $table->string('user_id', 100)->index();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
            $table->unique(['class_id', 'subject_id'], 'course_assignments_class_subject_unique');
            $table->foreign('user_id', 'course_assignments_user_id_foreign')
                ->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('course_assignments');
    }
};
