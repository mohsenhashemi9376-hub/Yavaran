<?php

namespace App\Support;

use App\Models\User;
use App\Support\Sync\AccessPolicy;
use App\Support\Sync\CollectionRegistry;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * یادآوری طرح درس به استاد: اگر در ۱۴ روز گذشته هیچ طرح درسی (حتی پیش‌نویس) ثبت نکرده باشد،
 * اعلان می‌گیرد؛ تا وقتی طرحی ننوشته، حداکثر هفته‌ای یک‌بار تکرار می‌شود.
 * اجرا هنگام بارگذاری اعلان‌های خود استاد انجام می‌شود (نیازی به cron نیست) و حداکثر هر ۱۰ دقیقه یک‌بار بررسی می‌کند.
 */
final class LessonPlanReminders
{
    private const DAYS = 14;

    /** فقط اساتید این درس‌ها یادآوری می‌گیرند (واژه‌ی موجود در نام درس) */
    private const SUBJECT_WORDS = ['ریاضی', 'علوم', 'عربی', 'فارسی', 'ادبیات', 'انگلیسی', 'زبان', 'قرآن', 'سبک زندگی'];

    private static function isTargetSubject(string $name): bool
    {
        $name = str_replace(['ي', 'ك', "\u{200c}"], ['ی', 'ک', ' '], $name);
        if (str_contains($name, 'اجتماعی')) {
            return false; // «علوم اجتماعی» در فهرست نیست
        }
        foreach (self::SUBJECT_WORDS as $w) {
            if (str_contains($name, $w)) {
                return true;
            }
        }

        return false;
    }

    public static function syncFor(User $user): void
    {
        try {
            if (! $user->isActive()) {
                return;
            }
            $policy = new AccessPolicy($user);
            if ($user->role !== 'teacher' && ! $policy->teachesCourses()) {
                return;
            }
            if (! array_filter($policy->teachingSubjectNames(), self::isTargetSubject(...))) {
                return;
            }
            if (! Cache::add('lp-remind:'.$user->id, 1, now()->addMinutes(10))) {
                return;
            }
            if (! CollectionRegistry::tableExists('lesson_plans') || ! Notifier::ensureTable()) {
                return;
            }
            // استاد تازه‌ساخته‌شده هنوز فرصت نوشتن نداشته است
            if ($user->created_at !== null && $user->created_at->gt(now()->subDays(self::DAYS))) {
                return;
            }

            $since = now()->subDays(self::DAYS);
            if (DB::table('lesson_plans')->where('teacher_id', $user->id)->where('created_at', '>=', $since)->exists()) {
                return;
            }

            $ref = 'lp-remind:'.now()->format('o-W');
            if (DB::table('notifications')->where('receiver_id', $user->id)->where('type', 'lesson_plan')->where('ref_id', $ref)->exists()) {
                return;
            }

            Notifier::send([(string) $user->id], [
                'title' => 'یادآوری: طرح درس ثبت نشده است',
                'message' => 'در دو هفتهٔ اخیر هیچ طرح درسی ثبت نکرده‌اید. لطفاً طرح درس خود را بنویسید و برای معاونت آموزشی ارسال کنید.',
                'type' => 'lesson_plan',
                'priority' => 'normal',
                'ref_id' => $ref,
            ]);
        } catch (\Throwable) {
            // یادآوری هرگز نباید بارگذاری اعلان‌ها را مختل کند
        }
    }
}
