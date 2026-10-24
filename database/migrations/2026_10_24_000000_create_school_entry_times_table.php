<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** ساعت ورود تعیین‌شده‌ی هر روز (ورود پس از آن تأخیر است) */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('school_entry_times')) {
            return;
        }
        Schema::create('school_entry_times', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('entry_date', 20)->unique();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_entry_times');
    }
};
