<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Notifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * اعلان‌های کاربران: ارسال اطلاعیه توسط مدیر مدرسه، فهرست اعلان‌های من،
 * علامت‌گذاری خوانده‌شده. بخشنامه‌ها توسط SyncService اعلان می‌سازند.
 */
class NotificationController extends Controller
{
    /** ارسال اطلاعیه (فقط مدیر مدرسه) */
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'فقط مدیر مدرسه مجاز به ارسال اطلاعیه است.'], 403);
        }

        $data = $request->validate([
            'audience' => ['required', 'in:all,selected,single'],
            'userIds' => ['nullable', 'array', 'max:500'],
            'userIds.*' => ['string', 'max:100'],
            'priority' => ['required', 'in:normal,urgent'],
            'title' => ['required', 'string', 'min:2', 'max:191'],
            'message' => ['required', 'string', 'min:2', 'max:5000'],
        ], [
            'title.required' => 'عنوان اطلاعیه را وارد کنید.',
            'title.min' => 'عنوان اطلاعیه را وارد کنید.',
            'message.required' => 'متن اطلاعیه را وارد کنید.',
            'message.min' => 'متن اطلاعیه را وارد کنید.',
        ]);

        $staff = User::query()->where('is_active', true)->whereIn('role', ['teacher', 'coach'])->where('id', '!=', $user->id);

        if ($data['audience'] === 'all') {
            $receivers = $staff->pluck('id')->all();
        } else {
            $ids = array_values(array_unique($data['userIds'] ?? []));
            if ($data['audience'] === 'single') {
                $ids = array_slice($ids, 0, 1);
            }
            $receivers = $staff->whereIn('id', $ids)->pluck('id')->all();
        }

        if ($receivers === []) {
            return response()->json(['message' => 'حداقل یک مخاطب انتخاب کنید.'], 422);
        }

        $count = Notifier::send($receivers, [
            'sender_id' => $user->id,
            'title' => trim($data['title']),
            'message' => trim($data['message']),
            'type' => 'announcement',
            'priority' => $data['priority'],
        ]);

        return response()->json(['success' => true, 'count' => $count], 201);
    }

    /** اعلان‌های کاربر جاری و تعداد خوانده‌نشده‌ها */
    public function index(Request $request): JsonResponse
    {
        Notifier::ensureTable();
        $user = $request->user();

        $rows = DB::table('notifications as n')
            ->leftJoin('users as s', 's.id', '=', 'n.sender_id')
            ->where('n.receiver_id', $user->id)
            ->orderByDesc('n.id')
            ->limit(60)
            ->get(['n.id', 'n.title', 'n.message', 'n.type', 'n.priority', 'n.ref_id', 'n.is_read', 'n.read_at', 'n.created_at', 's.name as sender_name']);

        $unread = DB::table('notifications')->where('receiver_id', $user->id)->where('is_read', false)->count();

        return response()->json([
            'unread' => $unread,
            'notifications' => $rows->map(fn ($n) => [
                'id' => (int) $n->id,
                'title' => $n->title,
                'message' => $n->message,
                'type' => $n->type,
                'priority' => $n->priority,
                'refId' => $n->ref_id,
                'isRead' => (bool) $n->is_read,
                'readAt' => $n->read_at ? str_replace(' ', 'T', (string) $n->read_at).'Z' : null,
                'createdAt' => $n->created_at ? str_replace(' ', 'T', (string) $n->created_at).'Z' : null,
                'senderName' => $n->sender_name,
            ])->all(),
        ]);
    }

    public function read(Request $request, int $notification): JsonResponse
    {
        Notifier::ensureTable();
        DB::table('notifications')
            ->where('id', $notification)
            ->where('receiver_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now(), 'updated_at' => now()]);

        return response()->json(['success' => true]);
    }

    public function readAll(Request $request): JsonResponse
    {
        Notifier::ensureTable();
        DB::table('notifications')
            ->where('receiver_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now(), 'updated_at' => now()]);

        return response()->json(['success' => true]);
    }
}
