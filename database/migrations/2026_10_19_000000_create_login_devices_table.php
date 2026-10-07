<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** دستگاه‌های شناخته‌شده‌ی ورود (برای هشدار ورود از دستگاه جدید) */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_devices', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 100)->index();
            $table->string('ua_hash', 64);
            $table->string('ip', 64)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->unique(['user_id', 'ua_hash'], 'login_devices_user_ua_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_devices');
    }
};
