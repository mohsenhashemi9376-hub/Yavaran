<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * ارجاع دانش‌آموز از معاون انضباطی به معاون تربیتی (بر اثر غیبت غیرموجه یا تأخیر مکرر).
 * ارجاع فقط به‌صورت اعلان برای معاون تربیتی ثبت می‌شود؛ هر دانش‌آموز/نوع/ماه حداکثر یک‌بار.
 */
class ReferralController extends Controller
{
    private const SENDERS = ['vice_disciplinary', 'vice_principal'];

    /** ارجاع‌های ثبت‌شده توسط کاربر جاری (برای نمایش «ارجاع داده شد») */
    public function index(Request $request): JsonResponse
    {
        Notifier::ensureTable();
        $user = $request->user();
        abort_unless(in_array($user->role, [...self::SENDERS, 'admin'], true), 403, 'دسترسی ندارید.');

        $refs = DB::table('notifications')->where('type', 'referral')->where('sender_id', $user->id)
            ->distinct()->pluck('ref_id')->all();

        return response()->json(['referrals' => $refs]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isActive() && in_array($user->role, self::SENDERS, true), 403, 'فقط معاون انضباطی می‌تواند ارجاع دهد.');

        $data = $request->validate([
            'studentId' => ['required', 'string', 'max:100'],
            'kind' => ['required', 'in:absence,delay'],
            'month' => ['required', 'regex:/^\d{4}\/\d{2}$/'],
            'summary' => ['required', 'string', 'max:300'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $student = DB::table('students')->where('id', $data['studentId'])->first(['id', 'first_name', 'last_name', 'class_id']);
        if (! $student) {
            return response()->json(['message' => 'دانش‌آموز یافت نشد.'], 404);
        }
        $className = (string) (DB::table('school_classes')->where('id', $student->class_id)->value('name') ?? '');

        $refId = sprintf('ref-%s-%s-%s', $student->id, $data['kind'], str_replace('/', '-', $data['month']));
        if (DB::table('notifications')->where('type', 'referral')->where('ref_id', $refId)->exists()) {
            return response()->json(['success' => true, 'duplicate' => true, 'refId' => $refId]);
        }

        $receivers = User::query()->where('role', 'vice_nurturing')->where('is_active', true)->pluck('id')->all();
        if ($receivers === []) {
            return response()->json(['message' => 'معاون تربیتی فعالی برای دریافت ارجاع وجود ندارد.'], 422);
        }

        $title = $data['kind'] === 'absence' ? 'ارجاع دانش‌آموز بابت غیبت غیرموجه' : 'ارجاع دانش‌آموز بابت تأخیر مکرر';
        $message = sprintf(
            "معاون انضباطی (%s) دانش‌آموز «%s %s»%s را برای پیگیری تربیتی ارجاع داد.\n%s%s",
            $user->name,
            $student->first_name,
            $student->last_name,
            $className !== '' ? " (کلاس {$className})" : '',
            $data['summary'],
            ! empty($data['note']) ? "\n\nتوضیح: ".trim($data['note']) : ''
        );

        Notifier::send($receivers, [
            'sender_id' => $user->id,
            'title' => $title,
            'message' => $message,
            'type' => 'referral',
            'priority' => 'urgent',
            'ref_id' => $refId,
        ]);

        return response()->json(['success' => true, 'refId' => $refId], 201);
    }
}
