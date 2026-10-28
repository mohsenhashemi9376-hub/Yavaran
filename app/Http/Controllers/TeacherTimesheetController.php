<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\TimesheetCalendar;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

/** ساعت کاری ماهانه و خودارزیابی اساتید (سال تحصیلی ۱۴۰۵-۱۴۰۶) */
class TeacherTimesheetController extends Controller
{
    /** شاخص‌های پیش‌فرض؛ مدیر مدرسه می‌تواند فهرست را ویرایش کند (timesheet_settings.axes) */
    public const DEFAULT_AXES = [
        ['id' => 'growth', 'title' => 'تلاش برای ارتقاء شخصی'],
        ['id' => 'punctuality', 'title' => 'حضور به موقع در مدرسه'],
        ['id' => 'lesson_plan', 'title' => 'طرح درس نویسی و آمادگی'],
        ['id' => 'dedication', 'title' => 'دلسوزی و کار را برای خود دانستن'],
        ['id' => 'extra', 'title' => 'کارهای اضافه‌تر از وظایف اصلی'],
    ];

    /** شناسه‌ی چهار شاخص شخصی که هر استاد می‌تواند خودش اضافه کند */
    public const CUSTOM_IDS = ['c1', 'c2', 'c3', 'c4'];

    /** شاخص‌های فعلی: ویرایش مدیر یا پیش‌فرض */
    public static function axes(): array
    {
        try {
            if (Schema::hasTable('timesheet_settings')) {
                $raw = DB::table('timesheet_settings')->where('key', 'axes')->value('value');
                $list = $raw ? json_decode($raw, true) : null;
                if (is_array($list) && $list !== []) {
                    return array_values($list);
                }
            }
        } catch (\Throwable $e) {
            Log::warning('timesheet axes read failed', ['error' => $e->getMessage()]);
        }

        return self::DEFAULT_AXES;
    }

    /** شاخص‌های شخصی ثبت‌شده‌ی استاد (آخرین ماهی که داشته)؛ برای ماه جدید همان‌ها نمایش داده می‌شود */
    private static function customAxesFor(string $userId, string $month): array
    {
        $rows = DB::table('teacher_timesheets')->where('user_id', $userId)
            ->orderByRaw('month_key = ? desc', [$month])->orderByDesc('updated_at')->get(['self_evaluation']);
        foreach ($rows as $row) {
            $ev = $row->self_evaluation ? json_decode($row->self_evaluation, true) : [];
            if (! empty($ev['customAxes']) && is_array($ev['customAxes'])) {
                return array_values($ev['customAxes']);
            }
        }

        return [];
    }

    /** تگ‌های فعالیت روزانه (کلید ⇒ عنوان)؛ «سایر موارد» یک متن آزاد (otherText) هم می‌گیرد */
    public const TAGS = [
        'teaching' => 'تدریس',
        'exam_design' => 'طراحی آزمون',
        'grading' => 'تصحیح سوالات',
        'score_entry' => 'وارد کردن نمرات',
        'makeup_class' => 'کلاس جبرانی',
        'lesson_plan' => 'نوشتن طرح درس',
        'other' => 'سایر موارد',
    ];

    public function page(Request $request): View|RedirectResponse
    {
        /** @var User|null $user */
        $user = $request->user();
        if ($user === null || $user->mustChangePassword()) {
            return redirect('/');
        }

        return view('teacher-timesheet', [
            'config' => [
                'academicYear' => TimesheetCalendar::ACADEMIC_YEAR,
                'months' => TimesheetCalendar::months(),
                'axes' => self::axes(),
            'customLimit' => count(self::CUSTOM_IDS),
                'tags' => self::TAGS,
                'teacherName' => $user->name,
                'serverNow' => (int) now()->getTimestampMs(),
            ],
        ]);
    }

    /** تقویم ماه‌های کاری، محورهای خودارزیابی و تگ‌ها برای صفحهٔ React پنل */
    public function config(): JsonResponse
    {
        return response()->json([
            'academicYear' => TimesheetCalendar::ACADEMIC_YEAR,
            'months' => TimesheetCalendar::months(),
            'axes' => self::axes(),
            'customLimit' => count(self::CUSTOM_IDS),
            'tags' => self::TAGS,
        ]);
    }

    /** خواندن ساعت کاری؛ همان نکتهٔ نقش‌های Manager / Deputy / Coach در save() اینجا هم صدق می‌کند. */
    public function show(Request $request): JsonResponse
    {
        self::ensureTable();
        $month = $request->validate(['month' => ['required', Rule::in(TimesheetCalendar::keys())]])['month'];

        $row = DB::table('teacher_timesheets')
            ->where('user_id', $request->user()->id)
            ->where('month_key', $month)
            ->first();

        return response()->json([
            'entries' => $row?->entries ? json_decode($row->entries, true) : new \stdClass,
            'selfEvaluation' => $row?->self_evaluation ? json_decode($row->self_evaluation, true) : new \stdClass,
            'customAxes' => self::customAxesFor((string) $request->user()->id, $month),
        ]);
    }

    /**
     * ذخیرهٔ ساعت کاری و خودارزیابی.
     *
     * توجه برای توسعه‌دهندهٔ بک‌اند: کاربران نقش‌های Manager، Deputy و Coach (در صورت داشتن
     * نقش آموزشی) هم باید برای این API مجاز (Authorized) باشند و ساعت کاری خود را ذخیره کنند.
     * در غیر این صورت درخواست ذخیره برای آن‌ها خطای 500 Server Error برمی‌گرداند
     * (در صفحه زیر نوار پایین «Server Error» دیده می‌شود). هر بررسی نقشی (Gate/Policy/Middleware)
     * روی مسیرهای api/teacher-timesheet باید این نقش‌ها را بپذیرد و در صورت رد، ۴۰۳ بدهد نه ۵۰۰.
     */
    public function save(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', Rule::in(TimesheetCalendar::keys())],
            'entries' => ['present', 'array', 'max:31'],
            'entries.*.in' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'entries.*.out' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'entries.*.in2' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'entries.*.out2' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'entries.*.tags' => ['nullable', 'array', 'max:'.count(self::TAGS)],
            'entries.*.tags.*' => ['string', Rule::in(array_keys(self::TAGS))],
            'entries.*.otherText' => ['nullable', 'string', 'max:120'],
            'selfEvaluation' => ['present', 'array'],
            'selfEvaluation.scores' => ['nullable', 'array', 'max:'.(count(self::axes()) + count(self::CUSTOM_IDS))],
            'selfEvaluation.scores.*' => ['integer', 'between:0,5'],
            'selfEvaluation.customAxes' => ['nullable', 'array', 'max:'.count(self::CUSTOM_IDS)],
            'selfEvaluation.customAxes.*.id' => ['required', 'string', Rule::in(self::CUSTOM_IDS)],
            'selfEvaluation.customAxes.*.title' => ['required', 'string', 'min:2', 'max:60'],
            'selfEvaluation.extraNote' => ['nullable', 'string', 'max:3000'],
        ], [
            'entries.*.in.regex' => 'ساعت ورود معتبر نیست.',
            'entries.*.out.regex' => 'ساعت خروج معتبر نیست.',
            'entries.*.in2.regex' => 'ساعت ورود دوم معتبر نیست.',
            'entries.*.out2.regex' => 'ساعت خروج دوم معتبر نیست.',
        ]);

        // فقط تاریخ‌های همین ماه کاری پذیرفته می‌شود
        $allowed = array_column(TimesheetCalendar::month($data['month'])['days'], 'date');
        $entries = array_intersect_key($data['entries'], array_flip($allowed));
        foreach ($entries as $date => $entry) {
            $tags = array_values(array_unique($entry['tags'] ?? []));
            $entries[$date] = [
                'in' => $entry['in'] ?? null,
                'out' => $entry['out'] ?? null,
                'in2' => $entry['in2'] ?? null,
                'out2' => $entry['out2'] ?? null,
                'tags' => $tags,
                'otherText' => in_array('other', $tags, true) ? trim((string) ($entry['otherText'] ?? '')) : '',
            ];
        }

        // شاخص‌های شخصی: حداکثر ۴ مورد، بدون شناسه‌ی تکراری
        $custom = [];
        foreach ($data['selfEvaluation']['customAxes'] ?? [] as $axis) {
            $custom[$axis['id']] = ['id' => $axis['id'], 'title' => trim($axis['title'])];
        }
        $custom = array_values($custom);

        $axisIds = array_merge(array_column(self::axes(), 'id'), array_column($custom, 'id'));
        $scores = array_intersect_key($data['selfEvaluation']['scores'] ?? [], array_flip($axisIds));
        $evaluation = [
            'scores' => $scores,
            'customAxes' => $custom,
            'extraNote' => (string) ($data['selfEvaluation']['extraNote'] ?? ''),
        ];

        $key = ['user_id' => $request->user()->id, 'month_key' => $data['month']];
        $values = [
            'entries' => json_encode($entries, JSON_UNESCAPED_UNICODE | JSON_FORCE_OBJECT),
            'self_evaluation' => json_encode($evaluation, JSON_UNESCAPED_UNICODE | JSON_FORCE_OBJECT),
            'updated_at' => now(),
        ];
        self::ensureTable();
        try {
            DB::table('teacher_timesheets')->updateOrInsert($key, $values + ['created_at' => now()]);
        } catch (\Throwable $e) {
            // علت واقعی در لاگ ثبت می‌شود و کاربر به‌جای «Server Error» پیام قابل فهم می‌بیند
            Log::error('teacher-timesheet save failed', ['user' => $key['user_id'], 'role' => $request->user()->role, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'ذخیره ساعت کاری انجام نشد. چند لحظه بعد دوباره تلاش کنید.'], 503);
        }

        return response()->json(['ok' => true, 'savedAt' => now()->toIso8601String()]);
    }

    /** ویرایش فهرست شاخص‌های خودارزیابی؛ فقط مدیر مدرسه */
    public function saveAxes(Request $request): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            abort(403, 'ویرایش شاخص‌ها فقط برای مدیر مدرسه امکان‌پذیر است.');
        }
        $data = $request->validate([
            'axes' => ['required', 'array', 'min:1', 'max:12'],
            'axes.*.id' => ['nullable', 'string', 'regex:/^[a-z0-9_]{1,30}$/'],
            'axes.*.title' => ['required', 'string', 'min:2', 'max:80'],
        ], ['axes.*.title.required' => 'عنوان شاخص نمی‌تواند خالی باشد.', 'axes.*.title.min' => 'عنوان شاخص خیلی کوتاه است.']);

        $used = [];
        $axes = [];
        foreach ($data['axes'] as $axis) {
            $id = $axis['id'] ?? null;
            if ($id === null || in_array($id, self::CUSTOM_IDS, true) || isset($used[$id])) {
                $id = 'a'.bin2hex(random_bytes(4));
            }
            $used[$id] = true;
            $axes[] = ['id' => $id, 'title' => trim($axis['title'])];
        }

        self::ensureSettingsTable();
        DB::table('timesheet_settings')->updateOrInsert(
            ['key' => 'axes'],
            ['value' => json_encode($axes, JSON_UNESCAPED_UNICODE), 'updated_at' => now(), 'created_at' => now()]
        );

        return response()->json(['axes' => $axes]);
    }

    private static function ensureSettingsTable(): void
    {
        if (Schema::hasTable('timesheet_settings')) {
            return;
        }
        Schema::create('timesheet_settings', function ($table) {
            $table->string('key', 60)->primary();
            $table->longText('value')->nullable();
            $table->timestamps();
        });
    }

    /** اگر مهاجرت جدول روی سرور اجرا نشده باشد، جدول (بدون کلید خارجی) ساخته می‌شود تا ثبت ساعت خطای ۵۰۰ ندهد. */
    private static function ensureTable(): void
    {
        if (Schema::hasTable('teacher_timesheets')) {
            return;
        }
        Schema::create('teacher_timesheets', function ($table) {
            $table->bigIncrements('id');
            $table->string('user_id', 100);
            $table->string('month_key', 20);
            $table->longText('entries')->nullable();
            $table->longText('self_evaluation')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'month_key'], 'teacher_timesheets_user_month_unique');
        });
    }
}
