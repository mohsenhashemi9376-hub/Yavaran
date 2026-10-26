<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\TimesheetCalendar;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** ساعت کاری ماهانه و خودارزیابی اساتید (سال تحصیلی ۱۴۰۵-۱۴۰۶) */
class TeacherTimesheetController extends Controller
{
    public const AXES = [
        ['id' => 'growth', 'title' => 'تلاش برای ارتقاء شخصی'],
        ['id' => 'punctuality', 'title' => 'حضور به موقع در مدرسه'],
        ['id' => 'lesson_plan', 'title' => 'طرح درس نویسی و آمادگی'],
        ['id' => 'dedication', 'title' => 'دلسوزی و کار را برای خود دانستن'],
        ['id' => 'extra', 'title' => 'کارهای اضافه‌تر از وظایف اصلی'],
    ];

    /** تگ‌های فعالیت روزانه (کلید ⇒ عنوان)؛ «تدریس موظفی» تگ پیش‌فرض پر کردن خودکار است */
    public const TAGS = [
        'teaching' => 'تدریس موظفی',
        'parents' => 'جلسه اولیا',
        'exam_design' => 'طراحی آزمون',
        'council' => 'حضور در شورا',
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
                'axes' => self::AXES,
                'tags' => self::TAGS,
                'teacherName' => $user->name,
            ],
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        $month = $request->validate(['month' => ['required', Rule::in(TimesheetCalendar::keys())]])['month'];

        $row = DB::table('teacher_timesheets')
            ->where('user_id', $request->user()->id)
            ->where('month_key', $month)
            ->first();

        return response()->json([
            'entries' => $row?->entries ? json_decode($row->entries, true) : new \stdClass,
            'selfEvaluation' => $row?->self_evaluation ? json_decode($row->self_evaluation, true) : new \stdClass,
        ]);
    }

    public function save(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', Rule::in(TimesheetCalendar::keys())],
            'entries' => ['present', 'array', 'max:31'],
            'entries.*.in' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'entries.*.out' => ['nullable', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'entries.*.tags' => ['nullable', 'array', 'max:'.count(self::TAGS)],
            'entries.*.tags.*' => ['string', Rule::in(array_keys(self::TAGS))],
            'selfEvaluation' => ['present', 'array'],
            'selfEvaluation.scores' => ['nullable', 'array', 'max:5'],
            'selfEvaluation.scores.*' => ['integer', 'between:0,5'],
            'selfEvaluation.extraNote' => ['nullable', 'string', 'max:3000'],
        ], [
            'entries.*.in.regex' => 'ساعت ورود معتبر نیست.',
            'entries.*.out.regex' => 'ساعت خروج معتبر نیست.',
        ]);

        // فقط تاریخ‌های همین ماه کاری پذیرفته می‌شود
        $allowed = array_column(TimesheetCalendar::month($data['month'])['days'], 'date');
        $entries = array_intersect_key($data['entries'], array_flip($allowed));
        foreach ($entries as $date => $entry) {
            $entries[$date] = [
                'in' => $entry['in'] ?? null,
                'out' => $entry['out'] ?? null,
                'tags' => array_values(array_unique($entry['tags'] ?? [])),
            ];
        }

        $axisIds = array_column(self::AXES, 'id');
        $scores = array_intersect_key($data['selfEvaluation']['scores'] ?? [], array_flip($axisIds));
        $evaluation = [
            'scores' => $scores,
            'extraNote' => (string) ($data['selfEvaluation']['extraNote'] ?? ''),
        ];

        $key = ['user_id' => $request->user()->id, 'month_key' => $data['month']];
        $values = [
            'entries' => json_encode($entries, JSON_UNESCAPED_UNICODE | JSON_FORCE_OBJECT),
            'self_evaluation' => json_encode($evaluation, JSON_UNESCAPED_UNICODE | JSON_FORCE_OBJECT),
            'updated_at' => now(),
        ];
        DB::table('teacher_timesheets')->updateOrInsert($key, $values + ['created_at' => now()]);

        return response()->json(['ok' => true, 'savedAt' => now()->toIso8601String()]);
    }
}
