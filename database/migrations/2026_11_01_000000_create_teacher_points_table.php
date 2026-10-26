<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** امتیاز گیمیفیکیشن اساتید (مثلاً پاداش تأیید طرح درس)؛ هر رویداد فقط یک‌بار امتیاز می‌گیرد */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teacher_points', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 100)->index();
            $table->integer('points');
            $table->string('reason', 191);
            $table->string('ref', 150)->unique();
            $table->timestamps();
            $table->foreign('user_id', 'teacher_points_user_id_foreign')
                ->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_points');
    }
};
