<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Digits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    private const MAX_ATTEMPTS = 5;

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:100'],
            'password' => ['required', 'string', 'max:191'],
        ]);

        $username = trim(Digits::toEnglish($validated['username']));
        $password = trim(Digits::toEnglish($validated['password']));
        $throttleKey = 'login:'.Str::lower($username).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return response()->json([
                'success' => false,
                'message' => "تعداد تلاش‌های ناموفق زیاد است. لطفاً {$seconds} ثانیه دیگر دوباره تلاش کنید.",
            ], 429);
        }

        /** @var User|null $user */
        $user = User::query()
            ->where('username', $username)
            ->orWhere('phone', $username)
            ->orderByRaw('CASE WHEN username = ? THEN 0 ELSE 1 END', [$username])
            ->first();

        if (! $user || ! $user->password || ! password_verify($password, $user->password)) {
            RateLimiter::hit($throttleKey, 60);

            return response()->json([
                'success' => false,
                'message' => 'نام کاربری یا رمز عبور اشتباه است.',
            ], 422);
        }

        if (! $user->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سامانه تماس بگیرید.',
            ], 403);
        }

        RateLimiter::clear($throttleKey);

        $dirty = false;
        if (Hash::needsRehash($user->password)) {
            $user->password = Hash::make($password);
            $dirty = true;
        }
        if (empty($user->password_encrypted)) {
            $user->password_encrypted = Crypt::encryptString($password);
            $dirty = true;
        }
        if ($dirty) {
            $user->save();
        }

        Auth::login($user);
        $request->session()->regenerate();
        $request->session()->forget('impersonator_id');

        return response()->json(['success' => true]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['success' => true]);
    }

    /**
     * تغییر سریع حساب (ویژه مدیر سامانه برای بررسی نقش‌ها).
     */
    public function switch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'userId' => ['required', 'string', 'max:100'],
        ]);

        /** @var User $current */
        $current = $request->user();
        $originalId = (string) $request->session()->get('impersonator_id', $current->id);
        $original = User::query()->find($originalId);

        if (! $original || ! $original->isAdmin() || ! $original->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'تغییر حساب بدون رمز عبور فقط برای مدیر سامانه مجاز است. لطفاً از «ورود با نام کاربری و رمز» استفاده کنید.',
            ], 403);
        }

        /** @var User|null $target */
        $target = User::query()->find($validated['userId']);

        if (! $target) {
            return response()->json(['success' => false, 'message' => 'کاربر مورد نظر یافت نشد.'], 404);
        }

        Auth::login($target);
        $request->session()->regenerate();

        if ($target->id === $original->id) {
            $request->session()->forget('impersonator_id');
        } else {
            $request->session()->put('impersonator_id', $original->id);
        }

        return response()->json(['success' => true]);
    }
}
