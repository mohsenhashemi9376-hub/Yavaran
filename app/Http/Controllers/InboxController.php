<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * صندوق پیام داخلی بین مدیر، معاونین (آموزشی، انضباطی، تربیتی) و مربیان.
 * پیام دوطرفه (پاسخ)، اولویت‌بندی، پیوست و شمارش پیام‌های خوانده‌نشده.
 */
class InboxController extends Controller
{
    public const ROLES = ['admin', 'vice_principal', 'vice_educational', 'vice_disciplinary', 'vice_nurturing', 'coach'];

    private const PRIORITIES = ['urgent', 'important', 'normal'];

    private const MAX_ATTACHMENT_KB = 3072;

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
            ->where('m.priority', 'urgent')
            ->orderBy('m.created_at')
            ->limit(5)
            ->get(['m.*']);

        return response()->json([
            'unread' => $this->unreadCount($me),
            'urgent' => $this->present($urgent, $me),
        ]);
    }

    /** صندوق ورودی یا ارسالی */
    public function index(Request $request): JsonResponse
    {
        $me = $this->actor($request);
        $box = $request->query('box') === 'sent' ? 'sent' : 'inbox';

        $query = DB::table('inbox_messages as m');
        if ($box === 'sent') {
            $query->where('m.sender_id', $me->id)->orderByDesc('m.created_at')->orderByDesc('m.id');
        } else {
            $query->join('inbox_recipients as r', function ($join) use ($me) {
                $join->on('r.message_id', '=', 'm.id')->where('r.user_id', '=', $me->id);
            })
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
            'attachment' => ['nullable', 'file', 'max:'.self::MAX_ATTACHMENT_KB, 'mimes:pdf,jpg,jpeg,png,gif,webp,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip'],
        ]);

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

        $id = DB::transaction(function () use ($me, $data, $valid, $threadId, $body, $subject, $now, $request) {
            $id = DB::table('inbox_messages')->insertGetId([
                'thread_id' => $threadId,
                'sender_id' => (string) $me->id,
                'priority' => $data['priority'],
                'subject' => $subject,
                'body' => Crypt::encryptString($body),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('inbox_recipients')->insert(array_map(
                fn ($uid) => ['message_id' => $id, 'user_id' => $uid, 'read_at' => null],
                $valid
            ));

            $file = $request->file('attachment');
            if ($file && $file->isValid()) {
                DB::table('inbox_attachments')->insert([
                    'message_id' => $id,
                    'name' => mb_substr($file->getClientOriginalName(), 0, 191),
                    'mime' => $file->getMimeType() ?: 'application/octet-stream',
                    'size' => (int) $file->getSize(),
                    'content' => base64_encode((string) file_get_contents($file->getRealPath())),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            return $id;
        });

        return response()->json(['success' => true, 'id' => $id], 201);
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

        return response(base64_decode((string) $file->content, true) ?: '', 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Disposition' => "attachment; filename*=UTF-8''".rawurlencode($name),
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
        return DB::table('inbox_recipients')->where('user_id', (string) $me->id)->whereNull('read_at')->count();
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
        $attachments = DB::table('inbox_attachments')->whereIn('message_id', $ids)->get(['id', 'message_id', 'name', 'size'])->groupBy('message_id');
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
                'recipients' => $rows->map(fn ($r) => [
                    'id' => (string) $r->user_id,
                    'name' => $users[(string) $r->user_id]->name ?? 'کاربر حذف‌شده',
                    'readAt' => $r->read_at ? Carbon::parse($r->read_at)->toIso8601String() : null,
                ])->values()->all(),
                'attachments' => ($attachments[$m->id] ?? collect())->map(fn ($a) => [
                    'id' => (int) $a->id, 'name' => $a->name, 'size' => (int) $a->size,
                ])->values()->all(),
            ];
        })->values()->all();
    }
}
