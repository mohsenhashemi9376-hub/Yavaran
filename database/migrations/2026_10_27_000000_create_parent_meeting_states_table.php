<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** باز یا بسته بودن هر یک از سه جلسه‌ی عمومی اولیاء در هر سال تحصیلی (جلسه‌ی بسته: برگزارشده و پایان‌یافته) */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('parent_meeting_states')) {
            return;
        }
        Schema::create('parent_meeting_states', function (Blueprint $table) {
            $table->string('id', 60)->primary();
            $table->string('academic_year', 20)->index();
            $table->unsignedTinyInteger('meeting_no')->index();
            $table->boolean('is_open')->default(false);
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
            $table->unique(['academic_year', 'meeting_no'], 'parent_meeting_states_year_no_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parent_meeting_states');
    }
};
