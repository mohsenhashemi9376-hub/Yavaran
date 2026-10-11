<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PurgeInbox extends Command
{
    protected $signature = 'inbox:purge {--days= : پیام‌های قدیمی‌تر از این تعداد روز (پیش‌فرض: INBOX_RETENTION_DAYS)}';

    protected $description = 'پاک‌سازی پیام‌های قدیمی صندوق پیام همراه با پیوست‌ها (پیام‌های ستاره‌دار حذف نمی‌شوند)';

    public function handle(): int
    {
        $days = (int) ($this->option('days') ?: config('app.inbox_retention_days', 365));
        if ($days < 30) {
            $this->error('حداقل مدت نگهداری ۳۰ روز است.');

            return self::FAILURE;
        }
        $cutoff = now()->subDays($days);

        $ids = DB::table('inbox_messages as m')
            ->where('m.created_at', '<', $cutoff)
            ->where('m.sender_starred', false)
            ->whereNotExists(fn ($q) => $q->from('inbox_recipients as r')->whereColumn('r.message_id', 'm.id')->where('r.starred', true))
            ->pluck('m.id')
            ->all();

        $files = 0;
        foreach (array_chunk($ids, 200) as $chunk) {
            foreach (DB::table('inbox_attachments')->whereIn('message_id', $chunk)->whereNotNull('path')->pluck('path') as $path) {
                $full = storage_path('app/inbox/'.basename((string) $path));
                if (is_file($full) && @unlink($full)) {
                    $files++;
                }
            }
            DB::table('inbox_attachments')->whereIn('message_id', $chunk)->delete();
            DB::table('inbox_recipients')->whereIn('message_id', $chunk)->delete();
            DB::table('inbox_messages')->whereIn('id', $chunk)->delete();
        }

        $this->info(count($ids).' پیام و '.$files.' فایل پیوست پاک شد.');

        return self::SUCCESS;
    }
}
