<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\WebPush;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * صندوق پیام داخلی بین مدیر، معاونین (آموزشی، انضباطی، تربیتی) و مربیان.
 * پیام دوطرفه (پاسخ)، اولویت‌بندی، پیوست و شمارش پیام‌های خوانده‌نشده.
 */
class InboxController extends Controller
{
    public const ROLES = ['admin', 'vice_principal', 'vice_educational', 'vice_disciplinary', 'vice_nurturing', 'coach'];

    private const PRIORITIES = ['urgent', 'important', 'normal'];

    private const MAX_ATTACHMENT_KB = 3072;

    private const MAX_ATTACHMENTS = 5;

    private const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

    private const INLINE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];

    /** فهرست کاربرانی که می‌توان به آنها پیام داد */
    public function users(Request $request): JsonResponse
    {
        $me = $this->actor($request);

        $users = User::query()
            ->whereIn('role', self::ROLES)
            ->where('is_active', true)
            ->where('id', '!=', $me->id)
            ->orderBy('name')
            ->get(['id', 'name', 'role'])
            ->map(fn ($u) => ['id' => (string) $u->id, 'name' => (string) $u->name, 'role' => (string) $u->role])
            ->values();

        return response()->json(['users' => $users]);
    }

    /** تعداد پیام‌های خوانده‌نشده */
    public function summary(Request $request): JsonResponse
    {
        $me = $this->actor($request);

        // پیام‌های فوریِ خوانده‌نشده برای نمایش کادر هشدار وسط صفحه
        $urgent = DB::table('inbox_messages as m')
            ->join('inbox_recipients as r', function ($join) use ($me) {
                $join->on('r.message_id', '=', 'm.id')->where('r.user_id', '=', (string) $me->id);
            })
            ->whereNull('r.read_at')
            ->whereNull('r.archived_at')
            ->where('m.priority', 'urgent')
            ->orderBy('m.created_at')
            ->limit(5)
            ->get(['m.*']);

        return response()->json([
            'unread' => $this->unreadCount($me),
            'urgent' => $this->present($urgent, $me),
            'pushConfigured' => WebPush::configured(),
        ]);
    }

    /** صندوق ورودی یا ارسالی */
    public function index(Request $request): JsonResponse
    {
        $me = $this->actor($request);
        $box = in_array($request->query('box'), ['sent', 'archived'], true) ? $request->query('box') : 'inbox';
        $meId = (string) $me->id;

        $query = DB::table('inbox_messages as m');
        if ($box === 'sent') {
            $query->where('m.sender_id', $meId)->whereNull('m.sender_archived_at')->orderByDesc('m.created_at')->orderByDesc('m.id');
        } elseif ($box === 'archived') {
            $query->where(function ($q) use ($meId) {
                $q->where(fn ($w) => $w->where('m.sender_id', $meId)->whereNotNull('m.sender_archived_at'))
                    ->orWhereExists(fn ($e) => $e->from('inbox_recipients as ar')->whereColumn('ar.message_id', 'm.id')->where('ar.user_id', $meId)->whereNotNull('ar.archived_at'));
            })->orderByDesc('m.created_at')->orderByDesc('m.id');
        } else {
            $query->join('inbox_recipients as r', function ($join) use ($meId) {
                $join->on('r.message_id', '=', 'm.id')->where('r.user_id', '=', $meId);
            })
                ->whereNull('r.archived_at')
                ->orderByRaw('CASE WHEN r.read_at IS NULL THEN 0 ELSE 1 END')
                ->orderByRaw("CASE m.priority WHEN 'urgent' THEN 0 WHEN 'important' THEN 1 ELSE 2 END")
                ->orderByDesc('m.created_at')
                ->orderByDesc('m.id');
        }

        $messages = $query->limit(200)->get(['m.*']);

        return response()->json([
            'messages' => $this->present($messages, $me),
            'unread' => $this->unreadCount($me),
        ]);
    }

    /** همه پیام‌های یک گفتگو که کاربر در آنها فرستنده یا گیرنده است */
    public function thread(Request $request, int $message): JsonResponse
    {
        $me = $this->actor($request);
        $root = DB::table('inbox_messages')->where('id', $message)->first();
        abort_unless($root && $this->involved($root->id, $me), 404, 'پیام یافت نشد.');

        $threadId = $root->thread_id ?: $root->id;
        $all = DB::table('inbox_messages')
            ->where(fn ($q) => $q->where('id', $threadId)->orWhere('thread_id', $threadId))
            ->orderBy('created_at')->orderBy('id')
            ->get()
            ->filter(fn ($m) => $this->involved($m->id, $me))
            ->values();

        return response()->json(['messages' => $this->present($all, $me)]);
    }

    public function store(Request $request): JsonResponse
    {
        $me = $this->actor($request);

        $data = $request->validate([
            'recipients' => ['required', 'array', 'min:1', 'max:50'],
            'recipients.*' => ['required', 'string', 'max:100'],
            'subject' => ['nullable', 'string', 'max:191'],
            'body' => ['required', 'string', 'max:5000'],
            'priority' => ['required', 'in:'.implode(',', self::PRIORITIES)],
            'replyTo' => ['nullable', 'integer'],
            'studentId' => ['nullable', 'string', 'max:100'],
            'attachments' => ['nullable', 'array', 'max:'.self::MAX_ATTACHMENTS],
            'attachments.*' => ['file', 'max:'.self::MAX_ATTACHMENT_KB, 'mimes:pdf,jpg,jpeg,png,gif,webp,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip'],
        ]);

        $files = array_values(array_filter((array) $request->file('attachments'), fn ($f) => $f && $f->isValid()));
        if (array_sum(array_map(fn ($f) => (int) $f->getSize(), $files)) > self::MAX_TOTAL_BYTES) {
            return response()->json(['message' => 'مجموع حجم پیوست‌ها باید کمتر از ۱۰ مگابایت باشد.'], 422);
        }

        $studentId = null;
        if (! empty($data['studentId'])) {
            if (! DB::table('students')->where('id', $data['studentId'])->exists()) {
                return response()->json(['message' => 'دانش‌آموز انتخاب‌شده یافت نشد.'], 422);
            }
            $studentId = (string) $data['studentId'];
        }

        $recipientIds = array_values(array_unique(array_diff($data['recipients'], [(string) $me->id])));
        $valid = User::query()
            ->whereIn('id', $recipientIds)
            ->whereIn('role', self::ROLES)
            ->where('is_active', true)
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->all();
        if (count($valid) === 0 || count($valid) !== count($recipientIds)) {
            return response()->json(['message' => 'گیرنده انتخاب‌شده معتبر نیست.'], 422);
        }

        $threadId = null;
        if (! empty($data['replyTo'])) {
            $parent = DB::table('inbox_messages')->where('id', $data['replyTo'])->first();
            if (! $parent || ! $this->involved($parent->id, $me)) {
                return response()->json(['message' => 'پیام اصلی یافت نشد.'], 404);
            }
            $threadId = $parent->thread_id ?: $parent->id;
        }

        $body = trim($data['body']);
        $subject = trim((string) ($data['subject'] ?? '')) ?: mb_substr($body, 0, 60);
        $now = now();

        $stored = [];
        $id = DB::transaction(function () use ($me, $data, $valid, $threadId, $body, $subject, $now, $files, $studentId, &$stored) {
            $id = DB::table('inbox_messages')->insertGetId([
                'thread_id' => $threadId,
                'sender_id' => (string) $me->id,
                'priority' => $data['priority'],
                'subject' => $subject,
                'student_id' => $studentId,
                'body' => Crypt::encryptString($body),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('inbox_recipients')->insert(array_map(
                fn ($uid) => ['message_id' => $id, 'user_id' => $uid, 'read_at' => null],
                $valid
            ));

            $dir = storage_path('app/inbox');
            if ($files && ! is_dir($dir)) {
                @mkdir($dir, 0750, true);
            }
            foreach ($files as $file) {
                $diskName = Str::random(40);
                $original = mb_substr($file->getClientOriginalName(), 0, 191);
                $mime = $file->getMimeType() ?: 'application/octet-stream';
                $size = (int) $file->getSize();
                $file->move($dir, $diskName);
                $stored[] = $diskName;
                DB::table('inbox_attachments')->insert([
                    'message_id' => $id,
                    'name' => $original,
                    'mime' => $mime,
                    'size' => $size,
                    'path' => $diskName,
                    'content' => '',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            return $id;
        });

        if ($data['priority'] === 'urgent') {
            // اعلان گوشی بدون متن؛ بعد از ارسال پاسخ به کاربر
            app()->terminating(static fn () => WebPush::notifyUsers($valid));
        }

        return response()->json(['success' => true, 'id' => $id], 201);
    }

    /** ستاره‌دار کردن یا بایگانی پیام (برای گیرنده یا فرستنده) */
    public function flag(Request $request, int $message): JsonResponse
    {
        $me = $this->actor($request);
        $data = $request->validate([
            'starred' => ['nullable', 'boolean'],
            'archived' => ['nullable', 'boolean'],
        ]);
        $meId = (string) $me->id;

        $isRecipient = DB::table('inbox_recipients')->where('message_id', $message)->where('user_id', $meId)->exists();
        $isSender = DB::table('inbox_messages')->where('id', $message)->where('sender_id', $meId)->exists();
        abort_unless($isRecipient || $isSender, 404, 'پیام یافت نشد.');

        if ($isRecipient) {
            $update = [];
            if (array_key_exists('starred', $data)) {
                $update['starred'] = (bool) $data['starred'];
            }
            if (array_key_exists('archived', $data)) {
                $update['archived_at'] = $data['archived'] ? now() : null;
            }
            if ($update) {
                DB::table('inbox_recipients')->where('message_id', $message)->where('user_id', $meId)->update($update);
            }
        }
        if ($isSender) {
            $update = [];
            if (array_key_exists('starred', $data)) {
                $update['sender_starred'] = (bool) $data['starred'];
            }
            if (array_key_exists('archived', $data)) {
                $update['sender_archived_at'] = $data['archived'] ? now() : null;
            }
            if ($update) {
                DB::table('inbox_messages')->where('id', $message)->update($update);
            }
        }

        return response()->json(['success' => true, 'unread' => $this->unreadCount($me)]);
    }

    /** کلید عمومی اعلان گوشی (در صورت پیکربندی) */
    public function pushKey(Request $request): JsonResponse
    {
        $this->actor($request);

        return response()->json(['key' => WebPush::configured() ? (string) config('app.vapid_public') : null]);
    }

    public function pushSubscribe(Request $request): JsonResponse
    {
        $me = $this->actor($request);
        $data = $request->validate(['endpoint' => ['required', 'string', 'max:1000']]);
        if (! WebPush::endpointAllowed($data['endpoint'])) {
            return response()->json(['message' => 'سرویس اعلان این مرورگر پشتیبانی نمی‌شود.'], 422);
        }
        $hash = hash('sha256', $data['endpoint']);
        $now = now();
        DB::table('push_subscriptions')->updateOrInsert(
            ['endpoint_hash' => $hash],
            ['user_id' => (string) $me->id, 'endpoint' => $data['endpoint'], 'updated_at' => $now, 'created_at' => $now]
        );

        return response()->json(['success' => true]);
    }

    public function pushUnsubscribe(Request $request): JsonResponse
    {
        $me = $this->actor($request);
        $data = $request->validate(['endpoint' => ['required', 'string', 'max:1000']]);
        DB::table('push_subscriptions')->where('endpoint_hash', hash('sha256', $data['endpoint']))->where('user_id', (string) $me->id)->delete();

        return response()->json(['success' => true]);
    }

    public function read(Request $request, int $message): JsonResponse
    {
        $me = $this->actor($request);

        DB::table('inbox_recipients')
            ->where('message_id', $message)
            ->where('user_id', $me->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['success' => true, 'unread' => $this->unreadCount($me)]);
    }

    public function readAll(Request $request): JsonResponse
    {
        $me = $this->actor($request);
        DB::table('inbox_recipients')->where('user_id', $me->id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['success' => true, 'unread' => 0]);
    }

    public function download(Request $request, int $attachment): Response
    {
        $me = $this->actor($request);
        $file = DB::table('inbox_attachments')->where('id', $attachment)->first();
        abort_unless($file && $this->involved($file->message_id, $me), 404, 'پیوست یافت نشد.');

        $name = str_replace(['"', "\r", "\n", '\\'], '', (string) $file->name);

        if (! empty($file->path)) {
            $full = storage_path('app/inbox/'.basename((string) $file->path));
            $bytes = is_file($full) ? (string) file_get_contents($full) : '';
        } else {
            $bytes = base64_decode((string) $file->content, true) ?: '';
        }

        $inline = $request->boolean('inline') && in_array($file->mime, self::INLINE_MIMES, true);

        return response($bytes, 200, [
            'Content-Type' => $inline ? $file->mime : 'application/octet-stream',
            'Content-Disposition' => ($inline ? 'inline' : 'attachment')."; filename*=UTF-8''".rawurlencode($name),
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function actor(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isActive() && in_array($user->role, self::ROLES, true), 403, 'شما به صندوق پیام دسترسی ندارید.');

        return $user;
    }

    private function involved(int|string $messageId, User $me): bool
    {
        return DB::table('inbox_messages')->where('id', $messageId)->where('sender_id', (string) $me->id)->exists()
            || DB::table('inbox_recipients')->where('message_id', $messageId)->where('user_id', (string) $me->id)->exists();
    }

    private function unreadCount(User $me): int
    {
        return DB::table('inbox_recipients')->where('user_id', (string) $me->id)->whereNull('read_at')->whereNull('archived_at')->count();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, object>  $messages
     * @return array<int, array<string, mixed>>
     */
    private function present($messages, User $me): array
    {
        if ($messages->isEmpty()) {
            return [];
        }
        $ids = $messages->pluck('id');
        $recipients = DB::table('inbox_recipients')->whereIn('message_id', $ids)->get()->groupBy('message_id');
        $attachments = DB::table('inbox_attachments')->whereIn('message_id', $ids)->get(['id', 'message_id', 'name', 'size', 'mime'])->groupBy('message_id');
        $users = User::query()
            ->whereIn('id', $messages->pluck('sender_id')->merge($recipients->flatten(1)->pluck('user_id'))->unique()->all())
            ->get(['id', 'name', 'role'])->keyBy(fn ($u) => (string) $u->id);

        return $messages->map(function ($m) use ($me, $recipients, $attachments, $users) {
            try {
                $body = Crypt::decryptString((string) $m->body);
            } catch (DecryptException) {
                $body = '';
            }
            $rows = $recipients[$m->id] ?? collect();
            $mine = $rows->firstWhere('user_id', (string) $me->id);
            $sender = $users[(string) $m->sender_id] ?? null;

            return [
                'id' => (int) $m->id,
                'threadId' => (int) ($m->thread_id ?: $m->id),
                'senderId' => (string) $m->sender_id,
                'senderName' => $sender?->name ?? 'کاربر حذف‌شده',
                'senderRole' => $sender?->role,
                'priority' => $m->priority,
                'subject' => $m->subject,
                'body' => $body,
                'createdAt' => $m->created_at ? Carbon::parse($m->created_at)->toIso8601String() : null,
                'isMine' => (string) $m->sender_id === (string) $me->id,
                'isRead' => $mine ? $mine->read_at !== null : true,
                'studentId' => $m->student_id ?? null,
                'starred' => $mine ? (bool) $mine->starred : (bool) ($m->sender_starred ?? false),
                'archived' => $mine ? $mine->archived_at !== null : ($m->sender_archived_at ?? null) !== null,
                'recipients' => $rows->map(fn ($r) => [
                    'id' => (string) $r->user_id,
                    'name' => $users[(string) $r->user_id]->name ?? 'کاربر حذف‌شده',
                    'readAt' => $r->read_at ? Carbon::parse($r->read_at)->toIso8601String() : null,
                ])->values()->all(),
                'attachments' => ($attachments[$m->id] ?? collect())->map(fn ($a) => [
                    'id' => (int) $a->id, 'name' => $a->name, 'size' => (int) $a->size, 'mime' => $a->mime,
                ])->values()->all(),
            ];
        })->values()->all();
    }
}
