<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * دفتر ثبت دسترسی به پرونده‌های تربیتی و مشاهدات رفتاری (فقط افزودنی).
 * هر خواندن، ایجاد، ویرایش و حذف و هر تلاش ردشده با کاربر، دانش‌آموز، زمان و IP ثبت می‌شود.
 * شکست در ثبت لاگ هرگز جلوی کار کاربر را نمی‌گیرد.
 */
final class NurturingAudit
{
    private static ?bool $ready = null;

    public const ACTIONS = [
        'view' => 'مشاهده پرونده',
        'list' => 'دریافت فهرست',
        'create' => 'ثبت',
        'update' => 'ویرایش',
        'delete' => 'حذف',
    ];

    public static function ensureTable(): bool
    {
        if (self::$ready !== null) {
            return self::$ready;
        }
        if (Schema::hasTable('nurturing_access_logs')) {
            return self::$ready = true;
        }
        try {
            Schema::create('nurturing_access_logs', function ($t): void {
                $t->bigIncrements('id');
                $t->string('user_id', 100)->index();
                $t->string('user_role', 40)->default('');
                $t->string('action', 20);
                $t->string('collection', 40);
                $t->string('student_id', 100)->nullable()->index();
                $t->string('record_id', 100)->nullable();
                $t->boolean('allowed')->default(true)->index();
                $t->unsignedInteger('items')->nullable();
                $t->string('ip', 64)->nullable();
                $t->string('user_agent', 255)->nullable();
                $t->timestamp('created_at')->nullable()->index();
            });
        } catch (\Throwable) {
        }

        return self::$ready = Schema::hasTable('nurturing_access_logs');
    }

    public static function log(
        User $user,
        string $action,
        string $collection,
        ?string $studentId = null,
        ?string $recordId = null,
        bool $allowed = true,
        ?int $items = null
    ): void {
        try {
            if (! self::ensureTable()) {
                return;
            }
            $request = request();
            DB::table('nurturing_access_logs')->insert([
                'user_id' => $user->id,
                'user_role' => (string) $user->role,
                'action' => mb_substr($action, 0, 20),
                'collection' => mb_substr($collection, 0, 40),
                'student_id' => $studentId,
                'record_id' => $recordId,
                'allowed' => $allowed,
                'items' => $items,
                'ip' => $request?->ip(),
                'user_agent' => $request ? mb_substr((string) $request->userAgent(), 0, 255) : null,
                'created_at' => now(),
            ]);
        } catch (\Throwable) {
            // ثبت لاگ نباید عملیات را مختل کند
        }
    }

    /** دریافت فهرست کامل (bootstrap) به‌طور مرتب تکرار می‌شود؛ برای هر کاربر و مجموعه حداکثر هر ۳۰ دقیقه یک‌بار ثبت می‌شود */
    public static function logList(User $user, string $collection, int $items): void
    {
        $key = "nurturing-audit-list:{$user->id}:{$collection}";
        if (Cache::add($key, 1, now()->addMinutes(30))) {
            self::log($user, 'list', $collection, null, null, true, $items);
        }
    }
}
