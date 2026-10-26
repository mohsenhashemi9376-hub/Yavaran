<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** حذف ماژول قدیمی «فعالیت خارج از مدرسه» و ایجاد جدول «ساعت کاری و خودارزیابی اساتید» */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('teacher_activities');

        Schema::create('teacher_timesheets', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('user_id', 100);
            $table->string('month_key', 20);
            $table->longText('entries')->nullable();
            $table->longText('self_evaluation')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'month_key'], 'teacher_timesheets_user_month_unique');
            $table->foreign('user_id', 'teacher_timesheets_user_id_foreign')
                ->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_timesheets');
    }
};
