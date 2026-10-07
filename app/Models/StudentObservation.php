<?php

namespace App\Models;

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
}
