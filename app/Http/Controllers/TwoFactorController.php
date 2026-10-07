<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Digits;
use App\Support\Totp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/** مدیریت ورود دومرحله‌ای (TOTP) حساب جاری: وضعیت، شروع تنظیم، تأیید و غیرفعال‌سازی */
class TwoFactorController extends Controller
{
    private function current(Request $request): User
    {
        User::ensureTwoFactorColumns();

        /** @var User $user */
        $user = User::query()->findOrFail($request->user()->getKey());

        return $user;
    }

    public function status(Request $request): JsonResponse
    {
        $user = $this->current($request);

        return response()->json([
            'enabled' => $user->hasTwoFactor(),
            'required' => $user->requiresTwoFactor(),
        ]);
    }

    /** شروع تنظیم: ساخت کلید جدید (تا تأیید، ورود دومرحله‌ای فعال نمی‌شود) */
    public function setup(Request $request): JsonResponse
    {
        $user = $this->current($request);
        if ($user->hasTwoFactor()) {
            throw ValidationException::withMessages(['code' => 'ورود دومرحله‌ای قبلاً فعال شده است.']);
        }

        $secret = Totp::generateSecret();
        $user->forceFill([
            'two_factor_secret' => Crypt::encryptString($secret),
            'two_factor_confirmed_at' => null,
            'two_factor_recovery_codes' => null,
        ])->save();

        return response()->json([
            'secret' => trim(chunk_split($secret, 4, ' ')),
            'uri' => Totp::uri($secret, $user->username ?: $user->name, 'Yavaran'),
        ]);
    }

    /** تأیید کد برنامه‌ی احراز هویت و فعال‌سازی؛ کدهای بازیابی فقط همین یک‌بار نمایش داده می‌شود */
    public function confirm(Request $request): JsonResponse
    {
        $user = $this->current($request);
        $data = $request->validate(['code' => ['required', 'string', 'max:16']]);

        $key = 'tfa-confirm:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, 8)) {
            throw ValidationException::withMessages(['code' => 'تلاش‌های ناموفق زیاد است؛ چند دقیقه بعد دوباره تلاش کنید.']);
        }

        $encrypted = $user->getAttribute('two_factor_secret');
        if (empty($encrypted) || $user->hasTwoFactor()) {
            throw ValidationException::withMessages(['code' => 'ابتدا تنظیم ورود دومرحله‌ای را شروع کنید.']);
        }

        $secret = Crypt::decryptString($encrypted);
        if (Totp::verify($secret, Digits::toEnglish($data['code'])) === null) {
            RateLimiter::hit($key, 300);
            throw ValidationException::withMessages(['code' => 'کد وارد‌شده درست نیست.']);
        }
        RateLimiter::clear($key);

        $plainCodes = [];
        $hashed = [];
        for ($i = 0; $i < 8; $i++) {
            $code = strtolower(substr(bin2hex(random_bytes(5)), 0, 10));
            $plainCodes[] = substr($code, 0, 5).'-'.substr($code, 5);
            $hashed[] = Hash::make($code);
        }

        $user->forceFill([
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => json_encode($hashed),
        ])->save();

        return response()->json(['enabled' => true, 'recoveryCodes' => $plainCodes]);
    }

    /** غیرفعال‌سازی (فقط برای نقش‌هایی که اجباری نیستند؛ نیازمند رمز عبور و کد) */
    public function disable(Request $request): JsonResponse
    {
        $user = $this->current($request);
        if ($user->requiresTwoFactor()) {
            throw ValidationException::withMessages(['code' => 'برای این نقش، ورود دومرحله‌ای اجباری است و غیرفعال نمی‌شود.']);
        }
        $data = $request->validate([
            'password' => ['required', 'string', 'max:191'],
            'code' => ['required', 'string', 'max:16'],
        ]);

        if (! $user->password || ! password_verify(trim(Digits::toEnglish($data['password'])), $user->password)) {
            throw ValidationException::withMessages(['password' => 'رمز عبور اشتباه است.']);
        }
        if (! $user->hasTwoFactor() || Totp::verify(Crypt::decryptString($user->two_factor_secret), Digits::toEnglish($data['code'])) === null) {
            throw ValidationException::withMessages(['code' => 'کد وارد‌شده درست نیست.']);
        }

        DB::table('users')->where('id', $user->id)->update([
            'two_factor_secret' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_recovery_codes' => null,
        ]);

        return response()->json(['enabled' => false]);
    }

    /**
     * تأیید مرحله‌ی دوم هنگام ورود (بدون نشست احراز‌شده؛ شناسه‌ی کاربر در نشستِ مرحله‌ی اول نگهداری می‌شود).
     * کد برنامه یا یکی از کدهای بازیابی پذیرفته می‌شود.
     */
    public static function verifyLoginCode(User $user, string $input): bool
    {
        $input = trim(Digits::toEnglish($input));
        $secret = Crypt::decryptString((string) $user->two_factor_secret);

        $step = Totp::verify($secret, $input);
        if ($step !== null) {
            // هر کد فقط یک‌بار قابل استفاده است
            return Cache::add("tfa-used:{$user->id}:{$step}", 1, now()->addMinutes(3));
        }

        $normalized = strtolower(str_replace(['-', ' '], '', $input));
        if (strlen($normalized) === 10 && ctype_xdigit($normalized)) {
            $hashes = json_decode((string) $user->two_factor_recovery_codes, true);
            if (is_array($hashes)) {
                foreach ($hashes as $i => $hash) {
                    if (Hash::check($normalized, $hash)) {
                        unset($hashes[$i]);
                        DB::table('users')->where('id', $user->id)->update(['two_factor_recovery_codes' => json_encode(array_values($hashes))]);

                        return true;
                    }
                }
            }
        }

        return false;
    }
}
