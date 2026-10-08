<?php

namespace App\Support;

use App\Models\User;
use App\Support\Sync\AccessPolicy;
use App\Support\Sync\CollectionRegistry;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * یادآوری کاربرگ به مربی: برای هر هفته‌ی دارای مهلت، اگر برای یکی از کلاس‌های مربی هنوز هیچ کاربرگی ثبت نشده باشد،
 * یک روز قبل از مهلت، روز مهلت و پس از گذشتن مهلت (تا ۷ روز) اعلان می‌گیرد؛ هر نوع یادآوری فقط یک‌بار.
 * اجرا هنگام بارگذاری اعلان‌های خود مربی انجام می‌شود (نیازی به cron نیست) و حداکثر هر ۱۰ دقیقه یک‌بار بررسی می‌کند.
 */
final class WorksheetReminders
{
    public static function syncFor(User $user): void
    {
        try {
            if ($user->role !== 'coach' || ! $user->isActive() || ! $user->hasPermission('manage-worksheets')) {
                return;
            }
            if (! Cache::add('ws-remind:'.$user->id, 1, now()->addMinutes(10))) {
                return;
            }
            if (! CollectionRegistry::tableExists('worksheet_weeks') || ! CollectionRegistry::tableExists('worksheet_records') || ! Notifier::ensureTable()) {
                return;
            }

            $today = Carbon::parse(now()->format('Y-m-d'), 'UTC');
            $classIds = (new AccessPolicy($user))->nurturingClassIds();
            if ($classIds === []) {
                return;
            }
            $classes = DB::table('school_classes')->whereIn('id', $classIds)->pluck('name', 'id')->all();
            $withStudents = DB::table('students')->whereIn('class_id', $classIds)->distinct()->pluck('class_id')->all();

            foreach (DB::table('worksheet_weeks')->whereNotNull('deadline')->get(['week_start', 'deadline']) as $week) {
                $gregorian = Jalali::shamsiToDate((string) $week->deadline);
                if ($gregorian === null) {
                    continue;
                }
                $daysToDeadline = (int) $today->diffInDays(Carbon::parse($gregorian, 'UTC'), false); // مثبت = هنوز مانده

                $kind = match (true) {
                    $daysToDeadline === 1 => 'soon',
                    $daysToDeadline === 0 => 'due',
                    $daysToDeadline < 0 && $daysToDeadline >= -7 => 'overdue',
                    default => null,
                };
                if ($kind === null) {
                    continue;
                }

                $untouched = [];
                foreach ($withStudents as $classId) {
                    if (! DB::table('worksheet_records')->where('class_id', $classId)->where('week_start', $week->week_start)->exists()) {
                        $untouched[] = (string) ($classes[$classId] ?? $classId);
                    }
                }
                if ($untouched === []) {
                    continue;
                }

                $ref = "ws-remind:{$kind}:{$week->week_start}";
                if (DB::table('notifications')->where('receiver_id', $user->id)->where('ref_id', $ref)->exists()) {
                    continue;
                }

                $list = implode('، ', $untouched);
                [$title, $message, $priority] = match ($kind) {
                    'soon' => ['یادآوری کاربرگ: فردا آخرین مهلت', "مهلت ثبت کاربرگ هفتگی فردا ({$week->deadline}) است. برای کلاس {$list} هنوز کاربرگی ثبت نشده است.", 'normal'],
                    'due' => ['یادآوری کاربرگ: امروز آخرین مهلت', "امروز ({$week->deadline}) آخرین مهلت ثبت کاربرگ هفتگی است. برای کلاس {$list} هنوز کاربرگی ثبت نشده است.", 'urgent'],
                    default => ['مهلت ثبت کاربرگ گذشته است', "مهلت ثبت کاربرگ هفتگی ({$week->deadline}) گذشته است و برای کلاس {$list} هنوز کاربرگی ثبت نشده است؛ لطفاً هرچه زودتر ثبت کنید.", 'urgent'],
                };

                Notifier::send([(string) $user->id], ['title' => $title, 'message' => $message, 'type' => 'worksheet', 'priority' => $priority, 'ref_id' => $ref]);
            }
        } catch (\Throwable) {
            // یادآوری هرگز نباید بارگذاری اعلان‌ها را مختل کند
        }
    }
}
