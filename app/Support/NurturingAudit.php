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
            self::ensureChainColumns();

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
                $t->string('prev_hash', 64)->nullable();
                $t->string('row_hash', 64)->nullable();
            });
        } catch (\Throwable) {
        }

        return self::$ready = Schema::hasTable('nurturing_access_logs');
    }

    /** ستون‌های زنجیره‌ی هش (تشخیص دست‌کاری لاگ) در دیتابیس‌های به‌روزنشده */
    private static function ensureChainColumns(): void
    {
        try {
            if (! Schema::hasColumn('nurturing_access_logs', 'row_hash')) {
                Schema::table('nurturing_access_logs', function ($t): void {
                    $t->string('prev_hash', 64)->nullable();
                    $t->string('row_hash', 64)->nullable();
                });
            }
        } catch (\Throwable) {
        }
    }

    /** @param  array<string, mixed>  $row */
    private static function hashRow(?string $prev, array $row): string
    {
        $fields = [];
        foreach (['user_id', 'user_role', 'action', 'collection', 'student_id', 'record_id', 'allowed', 'items', 'ip', 'user_agent', 'created_at'] as $k) {
            $fields[] = $k === 'allowed' ? (string) (int) ($row[$k] ?? 0) : (string) ($row[$k] ?? '');
        }

        return hash_hmac('sha256', ($prev ?? '').'|'.implode('|', $fields), (string) config('app.key'));
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
            $row = [
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
                'created_at' => now()->format('Y-m-d H:i:s'),
            ];
            // هر رکورد هش رکورد قبلی را در خود دارد؛ حذف یا تغییر هر ردیف زنجیره را می‌شکند
            DB::transaction(function () use ($row): void {
                $prev = DB::table('nurturing_access_logs')->whereNotNull('row_hash')->orderByDesc('id')->lockForUpdate()->value('row_hash');
                DB::table('nurturing_access_logs')->insert($row + ['prev_hash' => $prev, 'row_hash' => self::hashRow($prev, $row)]);
            });
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

    /**
     * بررسی یکپارچگی زنجیره‌ی لاگ.
     *
     * @return array{ok: bool, checked: int, unprotected: int, brokenAt: int|null}
     */
    public static function verifyChain(): array
    {
        $result = ['ok' => true, 'checked' => 0, 'unprotected' => 0, 'brokenAt' => null];
        if (! self::ensureTable()) {
            return $result;
        }

        $prev = null;
        foreach (DB::table('nurturing_access_logs')->orderBy('id')->cursor() as $r) {
            if ($r->row_hash === null) {
                $result['unprotected']++; // رکوردهای قدیمی پیش از فعال شدن زنجیره

                continue;
            }
            $row = (array) $r;
            if (($r->prev_hash ?? null) !== $prev || ! hash_equals(self::hashRow($prev, $row), (string) $r->row_hash)) {
                return ['ok' => false, 'brokenAt' => (int) $r->id] + $result;
            }
            $prev = $r->row_hash;
            $result['checked']++;
        }

        return $result;
    }
}
