<?php

namespace App\Http\Middleware;

use App\Support\NurturingSession;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** خروج خودکار مربی و معاون تربیتی در صورت بی‌فعالیتی، پایان عمر نشست یا بسته شدن نشست توسط معاون تربیتی */
class NurturingSessionGuard
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! NurturingSession::applies($user) || ! $request->hasSession()) {
            return $next($request);
        }

        $reason = NurturingSession::violation($request, $user);
        if ($reason === null) {
            NurturingSession::touch($request);

            return $next($request);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        $message = NurturingSession::message($reason);

        // بازخوانی اطلاعات: پاسخ «وارد نشده» تا رابط کاربری فوراً به صفحه‌ی ورود برگردد
        if ($request->isMethod('GET') && $request->is('api/bootstrap')) {
            return response()->json(['authenticated' => false, 'sessionExpired' => true, 'message' => $message]);
        }

        return response()->json(['message' => $message, 'sessionExpired' => true], 401);
    }
}
