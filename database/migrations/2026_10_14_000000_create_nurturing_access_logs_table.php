<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** دفتر ثبت دسترسی به پرونده‌های تربیتی و مشاهدات رفتاری */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('nurturing_access_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 100)->index();
            $table->string('user_role', 40)->default('');
            $table->string('action', 20);
            $table->string('collection', 40);
            $table->string('student_id', 100)->nullable()->index();
            $table->string('record_id', 100)->nullable();
            $table->boolean('allowed')->default(true)->index();
            $table->unsignedInteger('items')->nullable();
            $table->string('ip', 64)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nurturing_access_logs');
    }
};
