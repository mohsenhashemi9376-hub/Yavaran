<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** موجه/غیرموجه و یادداشت علت غیبت صبحگاه */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('morning_attendance', function (Blueprint $table) {
            $table->boolean('is_excused')->nullable()->default(false)->after('is_acknowledged');
            $table->text('absence_note')->nullable()->after('is_excused');
        });
    }

    public function down(): void
    {
        Schema::table('morning_attendance', function (Blueprint $table) {
            $table->dropColumn(['is_excused', 'absence_note']);
        });
    }
};
