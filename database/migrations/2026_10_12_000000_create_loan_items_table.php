<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** امانات و لوازم مدرسه (تحویل و تحویل‌گیری وسایل) */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan_items', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('item_name', 191)->default('');
            $table->string('recipient_name', 191)->default('');
            $table->string('loan_date', 20)->nullable()->index();
            $table->boolean('is_returned')->default(false)->index();
            $table->integer('sort_order')->default(0)->index();
            $table->longText('data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_items');
    }
};
