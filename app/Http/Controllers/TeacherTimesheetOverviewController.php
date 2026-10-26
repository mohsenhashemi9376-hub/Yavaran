<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Sync\AccessPolicy;
use App\Support\TimesheetCalendar;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/** نمای مدیریتی تایم‌شیت و خودارزیابی اساتید (مدیر و معاونین) — سال تحصیلی ۱۴۰۵-۱۴۰۶ */
class TeacherTimesheetOverviewController extends Controller
{
    private function allowed(Request $request): ?User
    {
        /** @var User|null $user */
        $user = $request->user();

        return $user !== null && (new AccessPolicy($user))->isManager() ? $user : null;
    }

    public function page(Request $request): View|RedirectResponse
    {
        $user = $this->allowed($request);
        if ($user === null || $user->mustChangePassword()) {
            return redirect('/');
        }

        return view('teacher-timesheets', [
            'config' => [
                'academicYear' => TimesheetCalendar::ACADEMIC_YEAR,
                'months' => array_map(static fn (array $m): array => ['key' => $m['key'], 'label' => $m['label']], TimesheetCalendar::months()),
                'axes' => TeacherTimesheetController::AXES,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        if ($this->allowed($request) === null) {
            abort(403, 'مشاهده تایم‌شیت اساتید فقط برای مدیر و معاونین است.');
        }
        $month = $request->validate(['month' => ['required', Rule::in(TimesheetCalendar::keys())]])['month'];

        $rows = DB::table('teacher_timesheets')->where('month_key', $month)->get()->keyBy('user_id');
        $teachers = DB::table('users')->where('is_active', true)
            ->where(static fn ($q) => $q->where('role', 'teacher')->orWhereIn('id', $rows->keys()->all()))
            ->orderBy('name')->get(['id', 'name']);

        $axisIds = array_column(TeacherTimesheetController::AXES, 'id');
        $list = [];
        foreach ($teachers as $t) {
            $row = $rows->get($t->id);
            $entries = $row?->entries ? (json_decode($row->entries, true) ?: []) : [];
            $eval = $row?->self_evaluation ? (json_decode($row->self_evaluation, true) ?: []) : [];

            $minutes = 0;
            $days = 0;
            foreach ($entries as $e) {
                if (! empty($e['in']) && ! empty($e['out']) && $e['out'] > $e['in']) {
                    [$ih, $im] = array_map('intval', explode(':', $e['in']));
                    [$oh, $om] = array_map('intval', explode(':', $e['out']));
                    $minutes += ($oh * 60 + $om) - ($ih * 60 + $im);
                    $days++;
                }
            }
            $scores = [];
            foreach ($axisIds as $id) {
                $scores[$id] = (int) ($eval['scores'][$id] ?? 0);
            }
            $list[] = [
                'id' => (string) $t->id,
                'name' => (string) $t->name,
                'hours' => round($minutes / 60, 2),
                'days' => $days,
                'scores' => $scores,
                'scoreTotal' => array_sum($scores),
                'hasEval' => $eval !== [],
                'extraNote' => (string) ($eval['extraNote'] ?? ''),
            ];
        }

        return response()->json(['teachers' => $list]);
    }
}
