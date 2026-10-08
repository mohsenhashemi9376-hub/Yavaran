<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** کاربرگ هفتگی دانش‌آموزان (رکورد هر دانش‌آموز در هر هفته) و مهلت ثبت هر هفته */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('worksheet_records')) {
            Schema::create('worksheet_records', function (Blueprint $table) {
                $table->string('id', 150)->primary();
                $table->string('student_id', 100)->index();
                $table->string('class_id', 100)->nullable()->index();
                $table->string('week_start', 20)->index();
                $table->string('status', 12)->default('complete')->index();
                $table->integer('sort_order')->default(0)->index();
                $table->longText('data');
                $table->timestamps();
                $table->unique(['student_id', 'week_start'], 'worksheet_records_student_week_unique');
            });
        }
        if (! Schema::hasTable('worksheet_weeks')) {
            Schema::create('worksheet_weeks', function (Blueprint $table) {
                $table->string('id', 100)->primary();
                $table->string('week_start', 20)->unique();
                $table->string('deadline', 20)->nullable();
                $table->integer('sort_order')->default(0)->index();
                $table->longText('data');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('worksheet_weeks');
        Schema::dropIfExists('worksheet_records');
    }
};
