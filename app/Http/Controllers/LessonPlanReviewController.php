<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Jalali;
use App\Support\Sync\AccessPolicy;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** کارتابل بررسی طرح درس اساتید توسط معاون آموزش (سال تحصیلی ۱۴۰۵-۱۴۰۶) */
class LessonPlanReviewController extends Controller
{
    public const ACADEMIC_YEAR = '۱۴۰۵-۱۴۰۶';

    /** پاداش تأیید طرح درس */
    public const APPROVE_POINTS = 50;

    /** برچسب‌های هوشمند بازخورد: کلید ⇒ [عنوان، رنگ] */
    public const TAGS = [
        'creative_start' => ['💡 شروع خلاقانه', 'emerald'],
        'clear_goals' => ['🎯 اهداف شفاف', 'sky'],
        'active_methods' => ['🧩 روش‌های فعال و متنوع', 'emerald'],
        'time_challenge' => ['⏱️ چالش زمان‌بندی', 'orange'],
        'weak_evaluation' => ['📝 ارزشیابی ناقص', 'amber'],
        'needs_detail' => ['🔍 نیاز به جزئیات بیشتر', 'amber'],
    ];

    private const FROM = '1405/07/01';

    private const TO = '1406/03/31';

    private function reviewer(Request $request): ?User
    {
        /** @var User|null $user */
        $user = $request->user();

        return $user !== null && (new AccessPolicy($user))->isLessonPlanReviewer() ? $user : null;
    }

    public function page(Request $request): View|RedirectResponse
    {
        $user = $this->reviewer($request);
        if ($user === null || $user->mustChangePassword()) {
            return redirect('/');
        }

        return view('lesson-plan-review', [
            'config' => [
                'academicYear' => self::ACADEMIC_YEAR,
                'approvePoints' => self::APPROVE_POINTS,
                'tags' => array_map(static fn (array $t, string $k): array => ['key' => $k, 'label' => $t[0], 'tone' => $t[1]], self::TAGS, array_keys(self::TAGS)),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        if ($this->reviewer($request) === null) {
            abort(403, 'بررسی طرح درس فقط با معاون آموزش است.');
        }

        $classNames = DB::table('school_classes')->pluck('name', 'id')->all();
        $plans = [];
        foreach (DB::table('lesson_plans')->get(['id', 'class_id', 'status', 'data']) as $row) {
            $d = json_decode((string) $row->data, false);
            if (! is_object($d)) {
                continue;
            }
            $date = (string) ($d->date ?? '');
            if ($date < self::FROM || $date > self::TO) {
                continue; // فقط سال تحصیلی ۱۴۰۵-۱۴۰۶
            }
            $state = $this->stateOf($d);
            if ($state === null) {
                continue; // پیش‌نویس‌ها برای معاونت دیده نمی‌شوند
            }
            $plans[] = [
                'id' => (string) $row->id,
                'state' => $state,
                'teacherName' => (string) ($d->teacherName ?? 'استاد'),
                'subject' => (string) ($d->subject ?? ''),
                'className' => (string) ($classNames[$row->class_id] ?? $d->className ?? ''),
                'grade' => (string) ($d->grade ?? ''),
                'date' => $date,
                'sentAt' => $this->jalaliOf($d->submittedAt ?? $d->updatedAt ?? null),
                'sentSort' => (string) ($d->submittedAt ?? $d->updatedAt ?? ''),
                'mainTopic' => (string) ($d->mainTopic ?? ''),
                'subTopic' => (string) ($d->subTopic ?? ''),
                'objectives' => [
                    'cognitive' => array_values((array) ($d->objectives->cognitive ?? [])),
                    'affective' => array_values((array) ($d->objectives->affective ?? [])),
                    'psychomotor' => array_values((array) ($d->objectives->psychomotor ?? [])),
                ],
                'methods' => array_values((array) ($d->methods ?? [])),
                'scenario' => array_map(static fn ($s): array => [
                    'description' => (string) ($s->description ?? ''),
                    'minutes' => (string) ($s->minutes ?? ''),
                ], array_values((array) ($d->scenario ?? []))),
                'evaluation' => [
                    'initial' => (string) ($d->evaluation->initial ?? ''),
                    'process' => (string) ($d->evaluation->process ?? ''),
                    'final' => (string) ($d->evaluation->final ?? ''),
                ],
                'review' => is_object($d->review ?? null) ? [
                    'tags' => array_values((array) ($d->review->tags ?? [])),
                    'note' => (string) ($d->review->note ?? ''),
                    'feedback' => (string) ($d->review->feedback ?? ''),
                    'points' => (int) ($d->review->points ?? 0),
                    'reviewedAt' => $this->jalaliOf($d->review->reviewedAt ?? null),
                ] : null,
            ];
        }
        usort($plans, static fn (array $a, array $b): int => strcmp($b['sentSort'], $a['sentSort']));

        return response()->json(['plans' => $plans]);
    }

    public function review(Request $request, string $plan): JsonResponse
    {
        $user = $this->reviewer($request);
        if ($user === null) {
            abort(403, 'بررسی طرح درس فقط با معاون آموزش است.');
        }

        $data = $request->validate([
            'action' => ['required', Rule::in(['approve', 'return'])],
            'tags' => ['nullable', 'array', 'max:'.count(self::TAGS)],
            'tags.*' => ['string', Rule::in(array_keys(self::TAGS))],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        $tags = array_values(array_unique($data['tags'] ?? []));
        $note = trim((string) ($data['note'] ?? ''));
        if ($data['action'] === 'return' && $tags === [] && $note === '') {
            abort(422, 'برای ارجاع جهت اصلاح، دست‌کم یک برچسب یا یادداشت بنویسید.');
        }

        $result = DB::transaction(function () use ($plan, $data, $tags, $note, $user): array {
            $row = DB::table('lesson_plans')->where('id', $plan)->lockForUpdate()->first();
            $d = $row ? json_decode((string) $row->data, false) : null;
            if (! is_object($d) || $this->stateOf($d) === null) {
                abort(404, 'طرح درس یافت نشد یا هنوز ارسال نشده است.');
            }

            $approve = $data['action'] === 'approve';
            $labels = array_map(static fn (string $k): string => self::TAGS[$k][0], $tags);
            $feedback = trim(implode('، ', $labels).($labels && $note !== '' ? "\n" : '').$note);

            $awarded = 0;
            if ($approve) {
                // هر طرح درس فقط یک‌بار پاداش می‌گیرد (حتی اگر تأیید دوباره ثبت شود)
                $awarded = DB::table('teacher_points')->insertOrIgnore([
                    'user_id' => (string) $d->teacherId,
                    'points' => self::APPROVE_POINTS,
                    'reason' => 'تأیید طرح درس',
                    'ref' => 'lesson-plan:'.$plan,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]) > 0 ? self::APPROVE_POINTS : 0;
            }

            $d->review = (object) [
                'approved' => $approve,
                'returned' => ! $approve,
                'feedback' => $feedback,
                'tags' => $tags,
                'note' => $note,
                'points' => $approve ? self::APPROVE_POINTS : 0,
                'reviewerId' => (string) $user->id,
                'reviewerName' => (string) $user->name,
                'reviewedAt' => now()->toIso8601String(),
            ];
            // ارجاع برای اصلاح: طرح به پیش‌نویس استاد برمی‌گردد و با ارسال دوباره، دوباره در کارتابل می‌آید
            $d->status = $approve ? 'approved' : 'draft';
            DB::table('lesson_plans')->where('id', $plan)->update([
                'status' => $d->status,
                'data' => json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'updated_at' => now(),
            ]);

            return ['state' => $this->stateOf($d), 'awarded' => $awarded, 'teacherId' => (string) $d->teacherId];
        });

        return response()->json([
            'ok' => true,
            'state' => $result['state'],
            'awarded' => $result['awarded'],
            'totalPoints' => (int) DB::table('teacher_points')->where('user_id', $result['teacherId'])->sum('points'),
        ]);
    }

    /** pending: در انتظار بررسی، revision: نیاز به اصلاح، approved: تأییدشده؛ null: پیش‌نویس */
    private function stateOf(object $d): ?string
    {
        $status = (string) ($d->status ?? 'draft');
        if ($status === 'approved') {
            return 'approved';
        }
        if ($status === 'submitted') {
            return 'pending';
        }

        return ! empty($d->review->returned) ? 'revision' : null;
    }

    private function jalaliOf(?string $iso): string
    {
        if ($iso === null || $iso === '') {
            return '';
        }
        try {
            [$y, $m, $day] = Jalali::fromCarbon(Carbon::parse($iso)->timezone(config('app.timezone')));
        } catch (\Throwable) {
            return '';
        }

        return sprintf('%04d/%02d/%02d', $y, $m, $day);
    }
}
