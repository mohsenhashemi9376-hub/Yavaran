<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * لیست خاکستری آموزش: یک رکورد برای هر دانش‌آموز در هر ماه.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('grey_list_entries', function (Blueprint $table) {
            $table->string('id', 150)->primary();
            $table->string('student_id', 100)->index();
            $table->string('class_id', 100)->nullable()->index();
            $table->string('month', 7)->index();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
            $table->unique(['student_id', 'month'], 'grey_list_entries_student_month_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('grey_list_entries');
    }
};
