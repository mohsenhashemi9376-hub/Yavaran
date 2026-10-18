<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * گزارش نقاط تفکر: تحویل / عدم تحویل هر دانش‌آموز در هر هفته (معاون تربیتی و مربی).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reflection_points', function (Blueprint $table) {
            $table->string('id', 150)->primary();
            $table->string('student_id', 100)->index();
            $table->string('class_id', 100)->nullable()->index();
            $table->string('week_start', 20)->index();
            $table->boolean('delivered')->default(false)->index();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
            $table->unique(['student_id', 'week_start'], 'reflection_points_student_week_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reflection_points');
    }
};
