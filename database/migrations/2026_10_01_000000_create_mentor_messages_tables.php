<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * پیام‌ها و مأموریت‌های معاونت تربیتی به مربیان (تأیید تک‌کلیکی، بدون گفتگوی دوطرفه).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mentor_messages', function (Blueprint $table) {
            $table->id();
            $table->string('sender_id', 100)->index();
            $table->string('target_type', 10)->default('all'); // all | single
            $table->string('target_mentor_id', 100)->nullable()->index();
            $table->string('priority', 10)->default('normal'); // urgent | important | normal
            $table->string('title', 191)->default('');
            $table->text('content');
            $table->timestamps();
        });

        Schema::create('mentor_message_reads', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('message_id')->index();
            $table->string('mentor_id', 100)->index();
            $table->timestamp('acknowledged_at')->nullable();
            $table->unique(['message_id', 'mentor_id'], 'mentor_message_reads_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mentor_message_reads');
        Schema::dropIfExists('mentor_messages');
    }
};
