<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** بستن نشست‌ها توسط معاون تربیتی + زنجیره‌ی هش لاگ دسترسی (تشخیص دست‌کاری) */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'sessions_revoked_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->timestamp('sessions_revoked_at')->nullable();
            });
        }
        if (Schema::hasTable('nurturing_access_logs') && ! Schema::hasColumn('nurturing_access_logs', 'row_hash')) {
            Schema::table('nurturing_access_logs', function (Blueprint $table) {
                $table->string('prev_hash', 64)->nullable();
                $table->string('row_hash', 64)->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('sessions_revoked_at');
        });
        if (Schema::hasColumn('nurturing_access_logs', 'row_hash')) {
            Schema::table('nurturing_access_logs', function (Blueprint $table) {
                $table->dropColumn(['prev_hash', 'row_hash']);
            });
        }
    }
};
