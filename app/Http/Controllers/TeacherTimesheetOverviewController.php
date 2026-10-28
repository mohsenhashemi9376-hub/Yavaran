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
                'axes' => TeacherTimesheetController::axes(),
                'canEditAxes' => $user->isAdmin(),
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

        $axisIds = array_column(TeacherTimesheetController::axes(), 'id');
        $list = [];
        foreach ($teachers as $t) {
            $row = $rows->get($t->id);
            $entries = $row?->entries ? (json_decode($row->entries, true) ?: []) : [];
            $eval = $row?->self_evaluation ? (json_decode($row->self_evaluation, true) ?: []) : [];

            $minutes = 0;
            $days = 0;
            foreach ($entries as $e) {
                // مجموع نوبت اول و دوم (ورود/خروج اول و دوم)
                $dayMinutes = 0;
                foreach ([['in', 'out'], ['in2', 'out2']] as [$inKey, $outKey]) {
                    if (! empty($e[$inKey]) && ! empty($e[$outKey]) && $e[$outKey] > $e[$inKey]) {
                        [$ih, $im] = array_map('intval', explode(':', $e[$inKey]));
                        [$oh, $om] = array_map('intval', explode(':', $e[$outKey]));
                        $dayMinutes += ($oh * 60 + $om) - ($ih * 60 + $im);
                    }
                }
                if ($dayMinutes > 0) {
                    $minutes += $dayMinutes;
                    $days++;
                }
            }
            $scores = [];
            foreach ($axisIds as $id) {
                $scores[$id] = (int) ($eval['scores'][$id] ?? 0);
            }
            // شاخص‌های شخصی استاد (حداکثر ۴) هم در امتیاز کل می‌آیند
            $custom = [];
            foreach ($eval['customAxes'] ?? [] as $c) {
                $custom[] = ['title' => (string) ($c['title'] ?? ''), 'score' => (int) ($eval['scores'][$c['id'] ?? ''] ?? 0)];
            }
            $list[] = [
                'id' => (string) $t->id,
                'name' => (string) $t->name,
                'hours' => round($minutes / 60, 2),
                'days' => $days,
                'scores' => $scores,
                'custom' => $custom,
                'scoreTotal' => array_sum($scores) + array_sum(array_column($custom, 'score')),
                'scoreMax' => (count($axisIds) + count($custom)) * 5,
                'hasEval' => $eval !== [],
                'extraNote' => (string) ($eval['extraNote'] ?? ''),
            ];
        }

        return response()->json(['teachers' => $list]);
    }
}
