<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * پیام‌ها و مأموریت‌های معاونت تربیتی به مربیان.
 * فقط معاون تربیتی ارسال و آمار را می‌بیند؛ مربی فقط پیام‌های خودش را می‌بیند و تأیید تک‌کلیکی می‌کند.
 */
class MentorMessageController extends Controller
{
    private const PRIORITIES = ['urgent', 'important', 'normal'];

    /** ثبت پیام جدید (فقط معاون تربیتی) */
    public function store(Request $request): JsonResponse
    {
        $user = $this->requireRole($request, 'vice_nurturing');

        $data = $request->validate([
            'targetType' => ['required', 'in:all,single'],
            'targetMentorId' => ['nullable', 'string', 'max:100', 'required_if:targetType,single'],
            'priority' => ['required', 'in:'.implode(',', self::PRIORITIES)],
            'title' => ['nullable', 'string', 'max:191'],
            'content' => ['required', 'string', 'max:2000'],
        ]);

        $targetMentorId = null;
        if ($data['targetType'] === 'single') {
            $mentor = User::query()->whereKey($data['targetMentorId'])->where('role', 'coach')->where('is_active', true)->first();
            if (! $mentor) {
                return response()->json(['message' => 'مربی انتخاب‌شده یافت نشد.'], 422);
            }
            $targetMentorId = $mentor->id;
        }

        $content = trim($data['content']);
        $title = trim((string) ($data['title'] ?? '')) ?: Str::limit($content, 60, '…');
        $now = now();

        $id = DB::table('mentor_messages')->insertGetId([
            'sender_id' => $user->id,
            'target_type' => $data['targetType'],
            'target_mentor_id' => $targetMentorId,
            'priority' => $data['priority'],
            'title' => '', // عنوان و متن پیام با هم رمز می‌شوند (ستون title متن ساده نمی‌ماند)
            'content' => self::seal($title, $content),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json(['success' => true, 'id' => $id], 201);
    }

    /** پیام‌های فعال (تأییدنشده) مربی جاری */
    public function active(Request $request): JsonResponse
    {
        $user = $this->requireRole($request, 'coach');

        $rows = DB::table('mentor_messages as m')
            ->leftJoin('mentor_message_reads as r', function ($join) use ($user) {
                $join->on('r.message_id', '=', 'm.id')->where('r.mentor_id', '=', $user->id);
            })
            ->whereNull('r.id')
            ->where(function ($q) use ($user) {
                $q->where('m.target_type', 'all')->orWhere('m.target_mentor_id', $user->id);
            })
            ->orderByRaw("CASE m.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END")
            ->orderByDesc('m.created_at')
            ->orderByDesc('m.id')
            ->get(['m.id', 'm.priority', 'm.title', 'm.content', 'm.created_at']);

        return response()->json(['messages' => $rows->map(fn ($m) => $this->present($m))->all()]);
    }

    /** ثبت تأیید تک‌کلیکی «متوجه شدم» */
    public function acknowledge(Request $request, int $message): JsonResponse
    {
        $user = $this->requireRole($request, 'coach');

        $exists = DB::table('mentor_messages')
            ->where('id', $message)
            ->where(function ($q) use ($user) {
                $q->where('target_type', 'all')->orWhere('target_mentor_id', $user->id);
            })
            ->exists();

        if (! $exists) {
            return response()->json(['message' => 'پیام یافت نشد.'], 404);
        }

        DB::table('mentor_message_reads')->insertOrIgnore([
            'message_id' => $message,
            'mentor_id' => $user->id,
            'acknowledged_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }

    /** پیام‌های ارسالی اخیر معاون همراه با آمار تأیید مربیان */
    public function sent(Request $request): JsonResponse
    {
        $user = $this->requireRole($request, 'vice_nurturing');

        $messages = DB::table('mentor_messages')
            ->where('sender_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(30)
            ->get();

        $mentors = User::query()->where('role', 'coach')->where('is_active', true)->get(['id', 'name'])->keyBy('id');

        $reads = DB::table('mentor_message_reads')
            ->whereIn('message_id', $messages->pluck('id'))
            ->get()
            ->groupBy('message_id');

        $result = $messages->map(function ($m) use ($mentors, $reads) {
            $recipients = $m->target_type === 'single'
                ? $mentors->only([$m->target_mentor_id])
                : $mentors;
            $acked = ($reads[$m->id] ?? collect())->keyBy('mentor_id');

            return $this->present($m) + [
                'targetType' => $m->target_type,
                'targetMentorId' => $m->target_mentor_id,
                'recipients' => $recipients->map(fn ($mentor) => [
                    'mentorId' => $mentor->id,
                    'name' => $mentor->name,
                    'acknowledgedAt' => isset($acked[$mentor->id]) ? (string) $acked[$mentor->id]->acknowledged_at : null,
                ])->values()->all(),
            ];
        });

        return response()->json(['messages' => $result->all()]);
    }

    /** عنوان و متن پیام را یک‌جا رمز می‌کند (AES-256) */
    public static function seal(string $title, string $content): string
    {
        return \App\Support\NurturingCrypt::encryptString(json_encode(['title' => $title, 'content' => $content], JSON_UNESCAPED_UNICODE));
    }

    /**
     * @return array{title: string, content: string}
     *                                               پیام‌های قدیمی (متن ساده) همان‌طور خوانده می‌شوند تا دستور nurturing:encrypt رمزشان کند
     */
    public static function open(string $title, string $content): array
    {
        try {
            $data = json_decode(\App\Support\NurturingCrypt::decryptString($content), true);
            if (is_array($data) && isset($data['content'])) {
                return ['title' => (string) ($data['title'] ?? ''), 'content' => (string) $data['content']];
            }
        } catch (DecryptException) {
        }

        return ['title' => $title, 'content' => $content];
    }

    private function present(object $m): array
    {
        return [
            'id' => (int) $m->id,
            'priority' => $m->priority,
            ...self::open((string) $m->title, (string) $m->content),
            'createdAt' => $m->created_at ? \Illuminate\Support\Carbon::parse($m->created_at)->toIso8601String() : null,
        ];
    }

    private function requireRole(Request $request, string $role): User
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isActive() && $user->role === $role, 403, 'شما به این بخش دسترسی ندارید.');

        return $user;
    }
}
