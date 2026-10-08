<?php

namespace App\Http\Controllers;

use App\Http\Controllers\TwoFactorController;
use App\Models\User;
use App\Support\Digits;
use App\Support\NurturingSession;
use App\Support\PasswordConfirmation;
use App\Support\PasswordRules;
use App\Support\SecurityAlerts;
use App\Support\TrustedDevices;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
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
            SecurityAlerts::failedLogin($user);

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

        // رمز پیش‌فرض/ضعیف (مثل ۱۲۳) یا کوتاه‌تر از حد مجاز مربی و معاون تربیتی: تا تغییر رمز، به سامانه دسترسی ندارد
        if (! $user->mustChangePassword()
            && (PasswordRules::isWeak($password, $user->username) || mb_strlen($password) < PasswordRules::minLengthFor($user->role))) {
            DB::table('users')->where('id', $user->id)->update(['must_change_password' => true]);
            $user->refresh();
        }

        // ورود دومرحله‌ای: کاربر هنوز وارد نشده؛ فقط شناسه‌اش برای مرحله‌ی دوم (۵ دقیقه) در نشست می‌ماند
        // دستگاه مطمئن (پیش‌تر با کد دومرحله‌ای تأیید شده): فقط رمز عبور کافی است؛ دستگاه ناشناس همیشه کد می‌خواهد
        if ($user->hasTwoFactor() && ! TrustedDevices::isTrusted($request, $user)) {
            $request->session()->regenerate();
            $request->session()->put('two_factor', ['user_id' => $user->id, 'expires' => now()->addMinutes(5)->timestamp]);

            return response()->json(['success' => true, 'requiresTwoFactor' => true]);
        }

        Auth::login($user);
        $request->session()->regenerate();
        PasswordConfirmation::confirm(); // ورود موفق = تأیید رمز
        NurturingSession::start($request);
        SecurityAlerts::loginSucceeded($user, $request);

        return response()->json(['success' => true]);
    }

    /** خروج از همه‌ی دستگاه‌های دیگر (نشست‌های دیگر با تغییر هش رمز نامعتبر می‌شوند)؛ نشست جاری باقی می‌ماند */
    public function logoutOtherDevices(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate(['password' => ['required', 'string', 'max:191']]);
        $plain = trim(Digits::toEnglish($data['password']));

        $key = 'logout-others:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['success' => false, 'message' => 'تعداد تلاش‌های ناموفق زیاد است. چند دقیقه بعد دوباره تلاش کنید.'], 429);
        }
        if (! $user->password || ! password_verify($plain, $user->password)) {
            RateLimiter::hit($key, 900);

            return response()->json(['success' => false, 'message' => 'رمز عبور اشتباه است.'], 422);
        }
        RateLimiter::clear($key);

        Auth::guard('web')->logoutOtherDevices($plain);
        TrustedDevices::revokeAll($user->id, $request, exceptCurrent: true);

        return response()->json(['success' => true, 'message' => 'از همه‌ی دستگاه‌های دیگر خارج شدید.']);
    }

    /** تأیید مجدد رمز عبور برای ورود به بخش‌های محرمانه (پرونده‌های تربیتی) */
    public function confirmPassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $data = $request->validate(['password' => ['required', 'string', 'max:191']]);

        $key = 'confirm-password:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, 5)) {
            SecurityAlerts::lockout($user, 'تأیید مجدد رمز');

            return response()->json([
                'success' => false,
                'message' => 'تعداد تلاش‌های ناموفق زیاد است. چند دقیقه بعد دوباره تلاش کنید.',
            ], 429);
        }

        if (! $user->password || ! password_verify(trim(Digits::toEnglish($data['password'])), $user->password)) {
            RateLimiter::hit($key, 900);

            return response()->json(['success' => false, 'message' => 'رمز عبور اشتباه است.'], 422);
        }

        RateLimiter::clear($key);
        PasswordConfirmation::confirm();

        return response()->json(['success' => true]);
    }

    /** مرحله‌ی دوم ورود: کد برنامه‌ی احراز هویت یا کد بازیابی */
    public function twoFactorLogin(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:32'], 'trustDevice' => ['nullable', 'boolean']]);
        $pending = $request->session()->get('two_factor');

        if (! is_array($pending) || ($pending['expires'] ?? 0) < now()->timestamp) {
            $request->session()->forget('two_factor');

            return response()->json(['success' => false, 'message' => 'زمان تأیید به پایان رسید. دوباره وارد شوید.', 'restart' => true], 422);
        }

        $throttleKey = 'tfa-login:'.$pending['user_id'].'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            SecurityAlerts::lockout(User::query()->find($pending['user_id']), 'کد ورود دومرحله‌ای');
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
        PasswordConfirmation::confirm();
        NurturingSession::start($request);
        if ($request->boolean('trustDevice')) {
            TrustedDevices::trust($request, $user); // از این پس در همین دستگاه فقط رمز عبور
        }
        SecurityAlerts::loginSucceeded($user, $request);

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
