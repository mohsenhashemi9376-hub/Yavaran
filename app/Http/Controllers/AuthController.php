<?php

namespace App\Http\Controllers;

use App\Http\Controllers\TwoFactorController;
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
        if (! empty($user->password_encrypted)) {
            $user->password_encrypted = null; // پاک‌سازی نسخه‌ی برگشت‌پذیر قدیمی رمز
            $dirty = true;
        }
        if ($dirty) {
            $user->save();
        }

        User::ensureTwoFactorColumns();
        $user->refresh();

        // ورود دومرحله‌ای: کاربر هنوز وارد نشده؛ فقط شناسه‌اش برای مرحله‌ی دوم (۵ دقیقه) در نشست می‌ماند
        if ($user->hasTwoFactor()) {
            $request->session()->regenerate();
            $request->session()->put('two_factor', ['user_id' => $user->id, 'expires' => now()->addMinutes(5)->timestamp]);

            return response()->json(['success' => true, 'requiresTwoFactor' => true]);
        }

        Auth::login($user);
        $request->session()->regenerate();

        return response()->json(['success' => true]);
    }

    /** مرحله‌ی دوم ورود: کد برنامه‌ی احراز هویت یا کد بازیابی */
    public function twoFactorLogin(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:32']]);
        $pending = $request->session()->get('two_factor');

        if (! is_array($pending) || ($pending['expires'] ?? 0) < now()->timestamp) {
            $request->session()->forget('two_factor');

            return response()->json(['success' => false, 'message' => 'زمان تأیید به پایان رسید. دوباره وارد شوید.', 'restart' => true], 422);
        }

        $throttleKey = 'tfa-login:'.$pending['user_id'].'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $request->session()->forget('two_factor');

            return response()->json([
                'success' => false,
                'message' => 'تعداد تلاش‌های ناموفق زیاد است. چند دقیقه بعد دوباره وارد شوید.',
                'restart' => true,
            ], 429);
        }

        /** @var User|null $user */
        $user = User::query()->find($pending['user_id']);
        if (! $user || ! $user->isActive() || ! $user->hasTwoFactor() || ! TwoFactorController::verifyLoginCode($user, $data['code'])) {
            RateLimiter::hit($throttleKey, 300);

            return response()->json(['success' => false, 'message' => 'کد وارد‌شده درست نیست.'], 422);
        }

        RateLimiter::clear($throttleKey);
        $request->session()->forget('two_factor');
        Auth::login($user);
        $request->session()->regenerate();

        return response()->json(['success' => true]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['success' => true]);
    }
}
