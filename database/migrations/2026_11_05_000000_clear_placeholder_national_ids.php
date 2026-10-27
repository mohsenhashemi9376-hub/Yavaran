<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * خالی کردن کد ملی‌های ساختگی که سامانه خودش می‌ساخت (نه کد ملی واردشده توسط کاربر):
 * «۰۰۰۰۰۰۰۰۰۰» و «۰۰ + کد ۸ رقمی» که با کد دانش‌آموزی تصادفی همان دانش‌آموز یکی است.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('students')) {
            return;
        }
        $digits = ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9'];

        foreach (DB::table('students')->get(['id', 'data']) as $row) {
            $d = json_decode((string) $row->data, true);
            if (! is_array($d)) {
                continue;
            }
            $national = strtr(trim((string) ($d['nationalId'] ?? '')), $digits);
            $code = strtr(trim((string) ($d['studentCode'] ?? '')), $digits);
            $fake = $national !== '' && ($national === '0000000000' || (preg_match('/^\d{8}$/', $code) === 1 && $national === '00'.$code));
            if (! $fake) {
                continue;
            }
            $d['nationalId'] = '';
            DB::table('students')->where('id', $row->id)->update([
                'data' => json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE),
                'national_id' => null,
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // مقدارهای ساختگی قابل بازگردانی نیستند (و لازم هم نیستند)
    }
};
