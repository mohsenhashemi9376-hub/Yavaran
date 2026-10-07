<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\NurturingAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** گزارش دسترسی به پرونده‌های تربیتی؛ فقط معاون تربیتی (فقط‌خواندنی، بدون امکان ویرایش یا حذف) */
class NurturingAuditController extends Controller
{
    public function index(Request $request): JsonResponse
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
            ->get(['l.id', 'l.user_id', 'l.user_role', 'l.action', 'l.collection', 'l.student_id', 'l.allowed', 'l.items', 'l.ip', 'l.created_at',
                'u.name as user_name', 'ru.name as target_name', 's.first_name', 's.last_name']);

        return response()->json([
            'logs' => $rows->map(fn ($r) => [
                'id' => (int) $r->id,
                'userId' => $r->user_id,
                'userName' => $r->user_name ?? $r->user_id,
                'userRole' => $r->user_role,
                'action' => $r->action,
                'collection' => $r->collection,
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
}
