<?php

namespace App\Models;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * مشاهدات رفتاری دانش‌آموز (محتوا رمزنگاری‌شده).
 *
 * نویسنده (author_id / author_role) همیشه توسط سرور تعیین می‌شود:
 * - مشاهده‌ی ثبت‌شده توسط معاون تربیتی برای مربی قابل مشاهده نیست؛
 * - مشاهده‌ی ثبت‌شده توسط مربی برای معاون تربیتی قابل مشاهده است؛
 * - ویرایش و حذف فقط توسط نویسنده است.
 *
 * @property string|null $author_id
 * @property string|null $author_role
 */
class StudentObservation extends NurturingRecord
{
    protected $table = 'student_observations';

    /** افزودن ستون‌های نویسنده در دیتابیس‌های به‌روزنشده */
    public static function ensureAuthorColumns(): bool
    {
        static $ready = null;
        if ($ready !== null) {
            return $ready;
        }
        try {
            if (! Schema::hasColumn('student_observations', 'author_id')) {
                Schema::table('student_observations', function ($t): void {
                    $t->string('author_id', 100)->nullable()->index();
                    $t->string('author_role', 40)->nullable();
                });
            }
        } catch (\Throwable) {
        }

        return $ready = Schema::hasColumn('student_observations', 'author_id');
    }

    /**
     * مشاهده‌های قدیمیِ بدون نویسنده را که نام ثبت‌کننده‌شان (recordedBy) دقیقاً با نام این کاربر یکی است
     * (و نام او میان کاربران تربیتی یکتاست) به نام خودش ثبت می‌کند تا مربی سوابق قبلی خودش را ببیند.
     * خودترمیم است: پس از یک‌بار اجرا، ردیف بدون نویسنده‌ای برای او نمی‌ماند.
     */
    public static function claimLegacyFor(User $user): int
    {
        if (! self::ensureAuthorColumns()) {
            return 0;
        }
        $sameName = DB::table('users')->whereIn('role', ['coach', 'vice_nurturing'])->where('name', $user->name)->count();
        if ($sameName !== 1) {
            return 0;
        }

        $claimed = 0;
        self::query()->whereNull('author_id')->orderBy('id')->each(function (self $row) use ($user, &$claimed): void {
            $data = json_decode((string) $row->data, true);
            $by = is_array($data) ? ($data['recordedBy'] ?? null) : null;
            if ($by === null || trim((string) $by) !== trim((string) $user->name)) {
                return;
            }
            $data['authorId'] = $user->id;
            $data['authorRole'] = $user->role;
            DB::table('student_observations')->where('id', $row->getKey())->update([
                'author_id' => $user->id,
                'author_role' => $user->role,
                'data' => \App\Support\NurturingCrypt::encryptString(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
            ]);
            $claimed++;
        });

        return $claimed;
    }
}
