<?php

namespace App\Console\Commands;

use App\Support\EitaaNotifier;
use Illuminate\Console\Command;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

class BackupDatabaseEncrypted extends Command
{
    protected $signature = 'db:backup {--keep= : تعداد روز نگهداری (پیش‌فرض BACKUP_KEEP_DAYS)}';

    protected $description = 'پشتیبان‌گیری فشرده و رمزنگاری‌شده از دیتابیس با کلید جدا (BACKUP_KEY) و حذف پشتیبان‌های قدیمی';

    public function handle(): int
    {
        $key = (string) config('app.backup_key');
        if ($key === '') {
            $this->error('BACKUP_KEY تنظیم نشده است (php artisan nurturing:generate-key برای ساخت مقدار).');

            return self::FAILURE;
        }
        $raw = str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7), true) : $key;
        $encrypter = new Encrypter((string) $raw, (string) config('app.cipher', 'AES-256-CBC'));

        $dir = storage_path('app/backups');
        File::ensureDirectoryExists($dir, 0700);
        File::put($dir.'/.htaccess', "Require all denied\n");

        $tables = [];
        foreach (Schema::getTableListing() as $table) {
            $name = preg_replace('/^.*\./', '', (string) $table);
            if (in_array($name, ['sessions', 'cache', 'cache_locks', 'jobs', 'failed_jobs'], true)) {
                continue;
            }
            $rows = [];
            DB::table($name)->orderByRaw('1')->chunk(500, function ($chunk) use (&$rows): void {
                foreach ($chunk as $r) {
                    $rows[] = (array) $r;
                }
            });
            $tables[$name] = $rows;
        }

        $payload = gzencode(json_encode(['at' => now()->toIso8601String(), 'tables' => $tables], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE), 9);
        $file = $dir.'/backup-'.now()->format('Ymd-His').'.enc';
        File::put($file, $encrypter->encrypt($payload, false));
        @chmod($file, 0600);

        $days = (int) ($this->option('keep') ?: config('app.backup_keep_days', 7));
        $removed = 0;
        foreach (File::files($dir) as $f) {
            if (str_ends_with($f->getFilename(), '.enc') && $f->getMTime() < now()->subDays($days)->getTimestamp()) {
                File::delete($f->getPathname());
                $removed++;
            }
        }

        $this->info('پشتیبان رمزشده ساخته شد: '.basename($file)." ({$removed} پشتیبان قدیمی حذف شد).");

        return self::SUCCESS;
    }
}
