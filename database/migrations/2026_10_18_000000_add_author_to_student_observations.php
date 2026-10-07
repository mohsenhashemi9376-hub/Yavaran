<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * نویسنده‌ی مشاهده‌گری (author_id / author_role) برای کنترل دیدن توسط مربی.
 * مشاهده‌های قدیمی بر اساس نام ثبت‌کننده (recordedBy) به نویسنده‌شان نسبت داده می‌شود؛
 * اگر تطبیق پیدا نشد، بدون نویسنده می‌مانند (برای مربی مخفی، برای معاون تربیتی قابل مشاهده).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('student_observations', 'author_id')) {
            Schema::table('student_observations', function (Blueprint $table) {
                $table->string('author_id', 100)->nullable()->index();
                $table->string('author_role', 40)->nullable();
            });
        }

        $users = DB::table('users')->whereIn('role', ['coach', 'vice_nurturing'])->get(['id', 'name', 'role'])->groupBy('name');

        DB::table('student_observations')->whereNull('author_id')->select('id', 'data')->orderBy('id')->chunk(100, function ($rows) use ($users): void {
            foreach ($rows as $row) {
                $raw = (string) $row->data;
                if ($raw === '') {
                    continue;
                }
                try {
                    $json = ($raw[0] === '{' || $raw[0] === '[') ? $raw : \Illuminate\Support\Facades\Crypt::decryptString($raw);
                } catch (\Throwable) {
                    continue;
                }
                $by = json_decode($json, true)['recordedBy'] ?? null;
                $match = $by !== null ? ($users->get($by) ?? collect()) : collect();
                if ($match->count() === 1) {
                    $u = $match->first();
                    DB::table('student_observations')->where('id', $row->id)->update(['author_id' => $u->id, 'author_role' => $u->role]);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('student_observations', function (Blueprint $table) {
            $table->dropColumn(['author_id', 'author_role']);
        });
    }
};
