<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** دستگاه‌های مطمئن: ورود دومرحله‌ای فقط در اولین ورود با هر دستگاه */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('trusted_devices')) {
            return;
        }
        Schema::create('trusted_devices', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 100)->index();
            $table->string('token_hash', 64)->unique();
            $table->string('user_agent', 255)->nullable();
            $table->string('ip', 64)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trusted_devices');
    }
};
