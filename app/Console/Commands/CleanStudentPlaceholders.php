<?php

namespace App\Console\Commands;

use App\Support\Sync\SyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * پاک‌سازی کد ملی ساختگی دانش‌آموزان (۰۰۰۰۰۰۰۰۰۰ یا «۰۰» + کد ۸ رقمی تصادفی که همان کد سناد ساختگی است)
 * و (اختیاری) خالی کردن کد سناد. پیش‌فرض فقط گزارش می‌دهد و چیزی نمی‌نویسد؛ با --apply اعمال می‌شود.
 */
class CleanStudentPlaceholders extends Command
{
    protected $signature = 'students:clean-placeholders {--apply : تغییرات را روی دیتابیس بنویس} {--clear-sanad : کد سناد همهٔ دانش‌آموزان هم خالی شود}';

    protected $description = 'کد ملی ساختگی (و در صورت درخواست کد سناد) دانش‌آموزان را خالی می‌کند؛ پیش‌فرض فقط گزارش';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $sanad = (bool) $this->option('clear-sanad');
        $fixedNational = 0;
        $fixedSanad = 0;

        $rows = DB::table('students')->get(['id', 'data']);
        foreach ($rows as $row) {
            $d = json_decode((string) $row->data, true);
            if (! is_array($d)) {
                continue;
            }
            $national = strtr(trim((string) ($d['nationalId'] ?? '')), ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']);
            $code = strtr(trim((string) ($d['studentCode'] ?? '')), ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']);

            $changed = false;
            $fake = $national !== '' && ($national === '0000000000' || (preg_match('/^\d{8}$/', $code) === 1 && $national === '00'.$code));
            if ($fake) {
                $d['nationalId'] = '';
                $fixedNational++;
                $changed = true;
            }
            if ($sanad && $code !== '') {
                $d['studentCode'] = '';
                $fixedSanad++;
                $changed = true;
            }

            if ($changed && $apply) {
                DB::table('students')->where('id', $row->id)->update([
                    'data' => json_encode($d, SyncService::JSON_FLAGS),
                    'national_id' => $d['nationalId'] === '' ? null : mb_substr((string) $d['nationalId'], 0, 30),
                    'student_code' => ($d['studentCode'] ?? '') === '' ? null : mb_substr((string) $d['studentCode'], 0, 30),
                    'updated_at' => now(),
                ]);
            }
        }

        $this->info(sprintf('%s: کد ملی ساختگی %d مورد، کد سناد %d مورد از %d دانش‌آموز.', $apply ? 'اعمال شد' : 'گزارش (چیزی نوشته نشد)', $fixedNational, $fixedSanad, $rows->count()));
        if (! $apply) {
            $this->line('برای اعمال: php artisan students:clean-placeholders --apply [--clear-sanad]  (پیش از آن از دیتابیس پشتیبان بگیرید)');
        }

        return self::SUCCESS;
    }
}
