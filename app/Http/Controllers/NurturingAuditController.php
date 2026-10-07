<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Sync\AccessPolicy;
use App\Support\SecurityAlerts;
use App\Support\NurturingAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** گزارش دسترسی به پرونده‌های تربیتی؛ فقط معاون تربیتی (فقط‌خواندنی، بدون امکان ویرایش یا حذف) */
class NurturingAuditController extends Controller
{
    private function authorizeViewer(Request $request): User
    {
        /** @var User $user */
        $user = $request->user();
        abort_unless(
            $user->isActive() && $user->role === 'vice_nurturing' && $user->hasPermission('view-nurturing-file')
                && (! $user->requiresTwoFactor() || $user->hasTwoFactor())
                && (! $user->requiresReauth() || \App\Support\PasswordConfirmation::isFresh()),
            403,
            'گزارش دسترسی‌ها فقط برای معاون تربیتی قابل مشاهده است.'
        );

        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeViewer($request);

        if (! NurturingAudit::ensureTable()) {
            return response()->json(['logs' => []]);
        }

        $rows = DB::table('nurturing_access_logs as l')
            ->leftJoin('users as u', 'u.id', '=', 'l.user_id')
            ->leftJoin('students as s', 's.id', '=', 'l.student_id')
            ->leftJoin('users as ru', function ($j): void {
                $j->on('ru.id', '=', 'l.record_id')->where('l.collection', '=', 'users');
            })
            ->orderByDesc('l.id')
            ->limit(500)
            ->get(['l.id', 'l.user_id', 'l.user_role', 'l.action', 'l.collection', 'l.student_id', 'l.record_id', 'l.allowed', 'l.items', 'l.ip', 'l.created_at',
                'u.name as user_name', 'ru.name as target_name', 's.first_name', 's.last_name']);

        return response()->json([
            'logs' => $rows->map(fn ($r) => [
                'id' => (int) $r->id,
                'userId' => $r->user_id,
                'userName' => $r->user_name ?? $r->user_id,
                'userRole' => $r->user_role,
                'action' => $r->action,
                'collection' => $r->collection,
                'recordId' => $r->record_id,
                'targetName' => $r->target_name,
                'studentId' => $r->student_id,
                'studentName' => trim(($r->last_name ?? '').' '.($r->first_name ?? '')) ?: null,
                'allowed' => (bool) $r->allowed,
                'items' => $r->items,
                'ip' => $r->ip,
                'createdAt' => $r->created_at ? str_replace(' ', 'T', (string) $r->created_at).'Z' : null,
            ])->all(),
        ]);
    }

    /**
     * بازبینی حساب‌ها: مربیان و معاون تربیتی با کلاس‌های تخصیص‌یافته، ورود دومرحله‌ای، آخرین ورود و آخرین دسترسی به پرونده‌ها.
     * حساب‌های بدون ورود در ۳۰ روز اخیر یا بدون ورود دومرحله‌ای علامت می‌خورند تا معاون تصمیم بگیرد (مثلاً غیرفعال‌سازی).
     */
    public function review(Request $request): JsonResponse
    {
        $this->authorizeViewer($request);
        User::ensureTwoFactorColumns();
        NurturingAudit::ensureTable();
        SecurityAlerts::ensureDevicesTable();

        $classNames = DB::table('school_classes')->pluck('name', 'id');
        $since = now()->subDays(30);
        $accounts = [];

        foreach (User::query()->whereIn('role', SecurityAlerts::WATCHED_ROLES)->orderBy('role')->orderBy('name')->get() as $u) {
            $classIds = $u->role === 'coach' ? (new AccessPolicy($u))->nurturingClassIds() : [];
            $lastLogin = DB::table('login_devices')->where('user_id', $u->id)->max('last_seen_at');
            $logs = DB::table('nurturing_access_logs')->where('user_id', $u->id);

            $lastAccess = (clone $logs)->where('allowed', true)->whereIn('action', ['view', 'create', 'update', 'delete'])->max('created_at');
            $views = (clone $logs)->where('action', 'view')->where('allowed', true)->where('created_at', '>=', $since)->count();
            $denied = (clone $logs)->where('allowed', false)->where('action', '!=', 'alert')->where('created_at', '>=', $since)->count();
            $alerts = (clone $logs)->where('action', 'alert')->where('created_at', '>=', $since)->count();

            $accounts[] = [
                'id' => $u->id,
                'name' => $u->name,
                'username' => $u->username,
                'role' => $u->role,
                'isActive' => $u->isActive(),
                'twoFactor' => $u->hasTwoFactor(),
                'classes' => array_values(array_filter(array_map(fn ($id) => $classNames[$id] ?? null, $classIds))),
                'lastLoginAt' => $lastLogin ? str_replace(' ', 'T', (string) $lastLogin).'Z' : null,
                'lastAccessAt' => $lastAccess ? str_replace(' ', 'T', (string) $lastAccess).'Z' : null,
                'views30' => $views,
                'denied30' => $denied,
                'alerts30' => $alerts,
                'inactive30' => $u->isActive() && (! $lastLogin || $lastLogin < $since->toDateTimeString()),
            ];
        }

        return response()->json(['accounts' => $accounts]);
    }
}
