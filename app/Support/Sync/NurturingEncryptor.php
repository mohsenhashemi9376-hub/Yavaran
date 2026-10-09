<?php

namespace App\Support\Sync;

use App\Http\Controllers\MentorMessageController;
use App\Models\NurturingRecord;
use App\Support\NurturingCrypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** رمزنگاری رکوردهای قدیمیِ پرونده‌های تربیتی و مشاهدات که هنوز به‌صورت متن ساده ذخیره شده‌اند (idempotent) */
final class NurturingEncryptor
{
    /** @return int تعداد رکوردهای رمزنگاری‌شده */
    public static function run(): int
    {
        $done = 0;

        foreach (NurturingRecord::MODELS as $class) {
            $table = (new $class)->getTable();
            if (! Schema::hasTable($table)) {
                continue;
            }

            DB::table($table)->select(['id', 'data'])->orderBy('id')->chunk(200, function ($rows) use ($table, &$done): void {
                foreach ($rows as $row) {
                    $raw = (string) $row->data;
                    if ($raw === '' || ! in_array($raw[0], ['{', '['], true)) {
                        continue; // خالی یا قبلاً رمزنگاری شده
                    }
                    DB::table($table)->where('id', $row->id)->update(['data' => \App\Support\NurturingCrypt::encryptString($raw)]);
                    $done++;
                }
            });
        }

        return $done + self::encryptMentorMessages();
    }

    /**
     * رمزنگاری دوباره‌ی همه‌ی داده‌های تربیتی با کلید اصلی جاری (برای چرخش کلید یا انتقال از APP_KEY).
     *
     * @return int تعداد رکوردهای بازرمزشده
     */
    public static function rotate(): int
    {
        $done = 0;
        $reseal = static function (string $table, string $column, ?callable $transform = null) use (&$done): void {
            if (! Schema::hasTable($table)) {
                return;
            }
            DB::table($table)->select(['id', $column])->orderBy('id')->chunk(200, function ($rows) use ($table, $column, &$done): void {
                foreach ($rows as $row) {
                    $raw = (string) $row->{$column};
                    if ($raw === '') {
                        continue;
                    }
                    if ($raw[0] === '{' || $raw[0] === '[') {
                        $plain = $raw;
                    } else {
                        if (NurturingCrypt::isCurrent($raw)) {
                            continue;
                        }
                        try {
                            $plain = NurturingCrypt::decryptString($raw);
                        } catch (\Throwable) {
                            continue; // با هیچ کلید شناخته‌شده‌ای باز نمی‌شود؛ دست نمی‌خورد
                        }
                    }
                    DB::table($table)->where('id', $row->id)->update([$column => NurturingCrypt::encryptString($plain)]);
                    $done++;
                }
            });
        };

        foreach (NurturingRecord::MODELS as $class) {
            $reseal((new $class)->getTable(), 'data');
        }
        $reseal('mentor_messages', 'content');

        return $done;
    }

    /** پیام‌های قدیمی مربیان که هنوز متن ساده‌اند */
    private static function encryptMentorMessages(): int
    {
        if (! Schema::hasTable('mentor_messages')) {
            return 0;
        }
        $done = 0;
        DB::table('mentor_messages')->select(['id', 'title', 'content'])->orderBy('id')->chunk(200, function ($rows) use (&$done): void {
            foreach ($rows as $row) {
                try {
                    \App\Support\NurturingCrypt::decryptString((string) $row->content);

                    continue; // قبلاً رمز شده
                } catch (\Throwable) {
                }
                DB::table('mentor_messages')->where('id', $row->id)->update([
                    'title' => '',
                    'content' => MentorMessageController::seal((string) $row->title, (string) $row->content),
                ]);
                $done++;
            }
        });

        return $done;
    }
}
