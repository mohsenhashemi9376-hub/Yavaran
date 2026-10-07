<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** حذف نسخه‌های برگشت‌پذیر رمز عبور؛ از این پس فقط هش یک‌طرفه نگهداری می‌شود */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'password_encrypted')) {
            DB::table('users')->update(['password_encrypted' => null]);
        }
    }

    public function down(): void
    {
        // غیرقابل بازگشت (عمداً)
    }
};
