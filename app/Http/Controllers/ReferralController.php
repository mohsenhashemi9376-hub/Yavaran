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
            'kind' => ['required', 'in:absence,delay,warning,attention'],
            'month' => ['required', 'regex:/^\d{4}\/\d{2}$/'],
            'summary' => ['required', 'string', 'max:300'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $receivers = $this->receivers();
        if ($receivers === []) {
            return response()->json(['message' => 'معاون تربیتی فعالی برای دریافت ارجاع وجود ندارد.'], 422);
        }

        $result = $this->create($user, $receivers, $data);
        if ($result['status'] === 'missing') {
            return response()->json(['message' => 'دانش‌آموز یافت نشد.'], 404);
        }
        if ($result['status'] === 'duplicate') {
            return response()->json(['success' => true, 'duplicate' => true, 'refId' => $result['refId']]);
        }

        return response()->json(['success' => true, 'refId' => $result['refId']], 201);
    }

    /** ارجاع گروهی: چند دانش‌آموز با یک نوع، یک ماه و یک توضیح مشترک */
    public function bulk(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isActive() && in_array($user->role, self::SENDERS, true), 403, 'فقط معاون انضباطی می‌تواند ارجاع دهد.');

        $data = $request->validate([
            'kind' => ['required', 'in:absence,delay,warning,attention'],
            'month' => ['required', 'regex:/^\d{4}\/\d{2}$/'],
            'note' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.studentId' => ['required', 'string', 'max:100'],
            'items.*.summary' => ['required', 'string', 'max:300'],
        ]);

        $receivers = $this->receivers();
        if ($receivers === []) {
            return response()->json(['message' => 'معاون تربیتی فعالی برای دریافت ارجاع وجود ندارد.'], 422);
        }

        $out = ['created' => [], 'duplicates' => [], 'missing' => []];
        foreach ($data['items'] as $item) {
            $r = $this->create($user, $receivers, [
                'studentId' => $item['studentId'],
                'kind' => $data['kind'],
                'month' => $data['month'],
                'summary' => $item['summary'],
                'note' => $data['note'] ?? null,
            ]);
            $bucket = ['ok' => 'created', 'duplicate' => 'duplicates', 'missing' => 'missing'][$r['status']];
            $out[$bucket][] = $item['studentId'];
        }

        return response()->json(['success' => true] + $out, 201);
    }

    /**
     * فهرست ارجاع‌ها: معاون انضباطی ارجاع‌های خودش، معاون تربیتی ارجاع‌های دریافتی، مدیر همه.
     * پارامتر اختیاری studentId برای پرونده‌ی یک دانش‌آموز.
     */
    public function history(Request $request): JsonResponse
    {
        Notifier::ensureTable();
        /** @var User $user */
        $user = $request->user();
        abort_unless(in_array($user->role, [...self::SENDERS, 'vice_nurturing', 'admin'], true), 403, 'دسترسی ندارید.');

        $q = DB::table('notifications')->where('type', 'referral')->whereNotNull('ref_id');
        if (in_array($user->role, self::SENDERS, true)) {
            $q->where('sender_id', $user->id);
        } elseif ($user->role === 'vice_nurturing') {
            $q->where('receiver_id', $user->id);
        }
        $rows = $q->orderByDesc('id')->limit(1000)->get();

        $byRef = [];
        foreach ($rows as $row) {
            $ref = (string) $row->ref_id;
            if (! preg_match('/^ref-(.+)-(absence|delay|warning|attention)-(\d{4})-(\d{2})$/', $ref, $m)) {
                continue;
            }
            if ($request->filled('studentId') && $m[1] !== $request->query('studentId')) {
                continue;
            }
            if (isset($byRef[$ref])) {
                $byRef[$ref]['seen'] = $byRef[$ref]['seen'] || (bool) $row->is_read;
                continue;
            }
            $byRef[$ref] = [
                'refId' => $ref,
                'studentId' => $m[1],
                'kind' => $m[2],
                'month' => $m[3].'/'.$m[4],
                'title' => $row->title,
                'message' => $row->message,
                'senderId' => $row->sender_id,
                'seen' => (bool) $row->is_read,
                'createdAt' => (string) $row->created_at,
            ];
        }

        $items = array_values($byRef);
        $studentIds = array_unique(array_column($items, 'studentId'));
        $students = $studentIds === [] ? collect() : DB::table('students')->whereIn('id', $studentIds)->get(['id', 'first_name', 'last_name', 'class_id'])->keyBy('id');
        $classNames = DB::table('school_classes')->pluck('name', 'id');
        $senders = User::query()->whereIn('id', array_filter(array_unique(array_column($items, 'senderId'))))->pluck('name', 'id');

        foreach ($items as &$it) {
            $st = $students[$it['studentId']] ?? null;
            $it['studentName'] = $st ? trim($st->first_name.' '.$st->last_name) : '—';
            $it['className'] = $st ? (string) ($classNames[$st->class_id] ?? '') : '';
            $it['senderName'] = (string) ($senders[$it['senderId']] ?? '');
        }
        unset($it);

        return response()->json(['referrals' => $items]);
    }

    /** @return array<int, string> */
    private function receivers(): array
    {
        return User::query()->where('role', 'vice_nurturing')->where('is_active', true)->pluck('id')->all();
    }

    /**
     * @param  array<int, string>  $receivers
     * @param  array{studentId: string, kind: string, month: string, summary: string, note?: ?string}  $data
     * @return array{status: 'ok'|'duplicate'|'missing', refId: ?string}
     */
    private function create(User $user, array $receivers, array $data): array
    {
        $student = DB::table('students')->where('id', $data['studentId'])->first(['id', 'first_name', 'last_name', 'class_id']);
        if (! $student) {
            return ['status' => 'missing', 'refId' => null];
        }
        $className = (string) (DB::table('school_classes')->where('id', $student->class_id)->value('name') ?? '');

        $refId = sprintf('ref-%s-%s-%s', $student->id, $data['kind'], str_replace('/', '-', $data['month']));
        if (DB::table('notifications')->where('type', 'referral')->where('ref_id', $refId)->exists()) {
            return ['status' => 'duplicate', 'refId' => $refId];
        }

        $title = match ($data['kind']) {
            'absence' => 'ارجاع دانش‌آموز بابت غیبت غیرموجه',
            'delay' => 'ارجاع دانش‌آموز بابت تأخیر مکرر',
            'warning' => 'ارجاع دانش‌آموز دارای هشدار انضباطی',
            default => 'ارجاع دانش‌آموز نیازمند توجه',
        };
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

        return ['status' => 'ok', 'refId' => $refId];
    }
}
