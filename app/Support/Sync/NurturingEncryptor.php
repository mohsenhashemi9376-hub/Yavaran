<?php

namespace App\Support\Sync;

use App\Http\Controllers\MentorMessageController;
use App\Models\NurturingRecord;
use Illuminate\Support\Facades\Crypt;
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
                    DB::table($table)->where('id', $row->id)->update(['data' => Crypt::encryptString($raw)]);
                    $done++;
                }
            });
        }

        return $done + self::encryptMentorMessages();
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
                    Crypt::decryptString((string) $row->content);

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
