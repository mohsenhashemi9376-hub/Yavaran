<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** صندوق پیام: پیوست روی دیسک، ستاره/بایگانی، پیام درباره دانش‌آموز، اشتراک اعلان فوری */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inbox_attachments') && ! Schema::hasColumn('inbox_attachments', 'path')) {
            Schema::table('inbox_attachments', function (Blueprint $table) {
                $table->string('path', 100)->nullable()->after('size');
            });
        }

        if (Schema::hasTable('inbox_messages') && ! Schema::hasColumn('inbox_messages', 'student_id')) {
            Schema::table('inbox_messages', function (Blueprint $table) {
                $table->string('student_id', 100)->nullable()->index();
                $table->boolean('sender_starred')->default(false);
                $table->timestamp('sender_archived_at')->nullable();
            });
        }

        if (Schema::hasTable('inbox_recipients') && ! Schema::hasColumn('inbox_recipients', 'starred')) {
            Schema::table('inbox_recipients', function (Blueprint $table) {
                $table->boolean('starred')->default(false);
                $table->timestamp('archived_at')->nullable();
            });
        }

        if (! Schema::hasTable('push_subscriptions')) {
            Schema::create('push_subscriptions', function (Blueprint $table) {
                $table->id();
                $table->string('user_id', 100)->index();
                $table->text('endpoint');
                $table->string('endpoint_hash', 64)->unique();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
