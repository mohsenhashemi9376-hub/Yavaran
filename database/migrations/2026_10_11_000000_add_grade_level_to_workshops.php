<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** کارگاه‌های هشتم و نهم کاملاً مستقل‌اند؛ پایه هر کارگاه در grade_level (۸ یا ۹) */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workshops', function (Blueprint $table) {
            $table->unsignedTinyInteger('grade_level')->default(8)->after('category')->index();
        });
    }

    public function down(): void
    {
        Schema::table('workshops', function (Blueprint $table) {
            $table->dropColumn('grade_level');
        });
    }
};
