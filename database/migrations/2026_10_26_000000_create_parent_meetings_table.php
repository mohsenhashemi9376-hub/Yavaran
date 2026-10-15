<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** حضور اولیا (پدر و مادر) در جلسات عمومی اولیاء؛ سه جلسه در هر سال تحصیلی */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parent_meetings', function (Blueprint $table) {
            $table->string('id', 150)->primary();
            $table->string('student_id', 100)->index();
            $table->string('class_id', 100)->nullable()->index();
            $table->string('academic_year', 20)->index();
            $table->unsignedTinyInteger('meeting_no')->index();
            $table->boolean('father_present')->default(false);
            $table->boolean('mother_present')->default(false);
            $table->string('meeting_date', 20)->nullable();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
            $table->unique(['student_id', 'academic_year', 'meeting_no'], 'parent_meetings_student_year_no_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parent_meetings');
    }
};
