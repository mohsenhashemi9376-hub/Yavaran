<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Digits;
use App\Support\NurturingSession;
use Illuminate\Support\Facades\RateLimiter;
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
            return response()->json(['logs' => [], 'integrity' => null]);
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
            'integrity' => NurturingAudit::verifyChain(),
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

    /**
     * بستن فوری نشست‌های یک مربی (یا همه‌ی مربیان) از سوی معاون تربیتی؛ برای گم شدن گوشی/دستگاه یا شک به نفوذ.
     * نیازمند رمز عبور معاون؛ نشست خود معاون بسته نمی‌شود. کاربر باید دوباره وارد شود و دستگاه‌هایش دوباره با کد دومرحله‌ای تأیید می‌شوند.
     */
    public function revokeSessions(Request $request): JsonResponse
    {
        $vice = $this->authorizeViewer($request);
        $data = $request->validate([
            'password' => ['required', 'string', 'max:191'],
            'userId' => ['nullable', 'string', 'max:100'],
            'all' => ['nullable', 'boolean'],
        ]);

        $key = 'revoke-sessions:'.$vice->id;
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['success' => false, 'message' => 'تعداد تلاش‌های ناموفق زیاد است. چند دقیقه بعد دوباره تلاش کنید.'], 429);
        }
        if (! $vice->password || ! password_verify(trim(Digits::toEnglish($data['password'])), $vice->password)) {
            RateLimiter::hit($key, 900);

            return response()->json(['success' => false, 'message' => 'رمز عبور اشتباه است.'], 422);
        }
        RateLimiter::clear($key);

        if (! NurturingSession::ensureColumn()) {
            return response()->json(['success' => false, 'message' => 'ساختار دیتابیس هنوز به‌روزرسانی نشده است.'], 503);
        }

        $query = User::query()->whereIn('role', NurturingSession::ROLES)->where('id', '!=', $vice->id);
        if (! empty($data['all'])) {
            // همه‌ی مربیان و سایر معاونین تربیتی (به‌جز خود)
        } elseif (! empty($data['userId'])) {
            $query->where('id', $data['userId']);
        } else {
            return response()->json(['success' => false, 'message' => 'کاربر را مشخص کنید.'], 422);
        }

        $targets = $query->pluck('id')->all();
        if ($targets === []) {
            return response()->json(['success' => false, 'message' => 'کاربری برای بستن نشست پیدا نشد.'], 404);
        }

        DB::table('users')->whereIn('id', $targets)->update(['sessions_revoked_at' => now()]);
        foreach ($targets as $id) {
            \App\Support\TrustedDevices::revokeAll((string) $id); // دستگاه‌ها دوباره باید با کد دومرحله‌ای تأیید شوند
        }
        foreach ($targets as $id) {
            NurturingAudit::log($vice, 'alert', 'users', null, (string) $id, true);
        }

        return response()->json(['success' => true, 'count' => count($targets), 'message' => 'نشست‌ها بسته شد.']);
    }
}
