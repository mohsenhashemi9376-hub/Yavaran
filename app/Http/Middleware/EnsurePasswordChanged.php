<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** تا زمانی که کاربر رمز عبور اجباری را تغییر نداده، فقط تغییر رمز، خروج و تنظیم ورود دومرحله‌ای در دسترس است */
class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && $user->mustChangePassword() && ! $request->is('api/profile', 'api/auth/logout', 'api/two-factor', 'api/two-factor/*')) {
            return response()->json([
                'message' => 'برای ادامه، ابتدا رمز عبور خود را تغییر دهید.',
                'mustChangePassword' => true,
            ], 403);
        }

        return $next($request);
    }
}
