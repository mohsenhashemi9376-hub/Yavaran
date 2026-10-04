<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** ساخت اعلان برای کاربران مقصد (یک رکورد به‌ازای هر دریافت‌کننده) */
final class Notifier
{
    private static ?bool $tableReady = null;

    /** ساخت خودکار جدول در صورت اجرا نشدن upgrade.sql */
    public static function ensureTable(): bool
    {
        if (self::$tableReady !== null) {
            return self::$tableReady;
        }
        if (Schema::hasTable('notifications')) {
            return self::$tableReady = true;
        }

        try {
            Schema::create('notifications', function ($t): void {
                $t->bigIncrements('id');
                $t->string('sender_id', 100)->nullable()->index();
                $t->string('receiver_id', 100)->index();
                $t->string('title', 191);
                $t->text('message');
                $t->string('type', 30)->default('announcement');
                $t->string('priority', 20)->default('normal');
                $t->string('ref_id', 100)->nullable();
                $t->boolean('is_read')->default(false);
                $t->timestamp('read_at')->nullable();
                $t->timestamps();
                $t->index(['receiver_id', 'is_read'], 'notifications_receiver_read_index');
            });
        } catch (\Throwable) {
        }

        return self::$tableReady = Schema::hasTable('notifications');
    }

    /**
     * @param  array<int, string>  $receiverIds
     * @param  array{sender_id?: ?string, title: string, message: string, type?: string, priority?: string, ref_id?: ?string}  $payload
     */
    public static function send(array $receiverIds, array $payload): int
    {
        if ($receiverIds === [] || ! self::ensureTable()) {
            return 0;
        }

        $now = now();
        $rows = [];
        foreach (array_values(array_unique($receiverIds)) as $receiverId) {
            $rows[] = [
                'sender_id' => $payload['sender_id'] ?? null,
                'receiver_id' => $receiverId,
                'title' => mb_substr($payload['title'], 0, 191),
                'message' => $payload['message'],
                'type' => $payload['type'] ?? 'announcement',
                'priority' => $payload['priority'] ?? 'normal',
                'ref_id' => $payload['ref_id'] ?? null,
                'is_read' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            DB::table('notifications')->insert($chunk);
        }

        return count($rows);
    }
}
