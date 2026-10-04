<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** اعلان‌های کاربران (اطلاعیه مدیر / بخشنامه‌ها) و فعالیت‌های خارج از مدرسه معلمان */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('sender_id', 100)->nullable()->index();
            $table->string('receiver_id', 100)->index();
            $table->string('title', 191);
            $table->text('message');
            $table->string('type', 30)->default('announcement');
            $table->string('priority', 20)->default('normal');
            $table->string('ref_id', 100)->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->index(['receiver_id', 'is_read'], 'notifications_receiver_read_index');
        });

        Schema::create('teacher_activities', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('teacher_id', 100)->index();
            $table->date('date')->index();
            $table->text('activity_title');
            $table->decimal('hours', 4, 2)->default(0);
            $table->string('status', 20)->default('approved');
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
            $table->foreign('teacher_id', 'teacher_activities_teacher_id_foreign')
                ->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_activities');
        Schema::dropIfExists('notifications');
    }
};
