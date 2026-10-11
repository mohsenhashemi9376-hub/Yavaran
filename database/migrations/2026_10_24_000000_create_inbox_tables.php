<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** صندوق پیام داخلی بین مدیر، معاونین و مربیان */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('inbox_messages')) {
            Schema::create('inbox_messages', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('thread_id')->nullable()->index();
                $table->string('sender_id', 100)->index();
                $table->string('priority', 20)->default('normal');
                $table->string('subject', 191);
                $table->longText('body'); // رمزشده
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('inbox_recipients')) {
            Schema::create('inbox_recipients', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('message_id')->index();
                $table->string('user_id', 100)->index();
                $table->timestamp('read_at')->nullable();
                $table->unique(['message_id', 'user_id']);
            });
        }

        if (! Schema::hasTable('inbox_attachments')) {
            Schema::create('inbox_attachments', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('message_id')->index();
                $table->string('name', 191);
                $table->string('mime', 100);
                $table->unsignedInteger('size');
                $table->longText('content'); // base64
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('inbox_attachments');
        Schema::dropIfExists('inbox_recipients');
        Schema::dropIfExists('inbox_messages');
    }
};
