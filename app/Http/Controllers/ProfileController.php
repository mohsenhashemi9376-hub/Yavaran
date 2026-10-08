<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Digits;
use App\Support\PasswordRules;
use App\Support\Sync\SyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * ویرایش نام کاربری و رمز عبور توسط خود کاربر (پنل شخصی).
 */
class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required', 'string', 'max:191'],
            'username' => ['nullable', 'string', 'min:3', 'max:100'],
            'new_password' => ['nullable', 'string', 'min:6', 'max:191'],
            'new_password_confirmation' => ['nullable', 'string', 'max:191'],
        ], [
            'current_password.required' => 'لطفاً رمز عبور فعلی خود را وارد کنید.',
            'username.min' => 'نام کاربری باید حداقل ۳ کاراکتر باشد.',
            'username.max' => 'نام کاربری نباید بیش از ۱۰۰ کاراکتر باشد.',
            'new_password.min' => 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.',
        ]);

        $current = trim(Digits::toEnglish($validated['current_password']));
        if (! $user->password || ! password_verify($current, $user->password)) {
            throw ValidationException::withMessages(['current_password' => 'رمز عبور فعلی اشتباه است.']);
        }

        $newUsername = isset($validated['username']) ? trim(Digits::toEnglish($validated['username'])) : '';
        $newPassword = isset($validated['new_password']) ? trim(Digits::toEnglish($validated['new_password'])) : '';

        if ($newPassword !== '') {
            $confirm = trim(Digits::toEnglish((string) ($validated['new_password_confirmation'] ?? '')));
            if ($confirm !== $newPassword) {
                throw ValidationException::withMessages(['new_password_confirmation' => 'تکرار رمز عبور جدید با رمز عبور جدید یکسان نیست.']);
            }
        }

        $forced = $user->mustChangePassword();
        if ($forced && $newPassword === '') {
            throw ValidationException::withMessages(['new_password' => 'تعیین رمز عبور جدید الزامی است.']);
        }
        if ($newPassword !== '') {
            $min = $forced ? max(PasswordRules::MIN_LENGTH_FORCED, PasswordRules::minLengthFor($user->role)) : PasswordRules::minLengthFor($user->role);
            if ($min > 6 && mb_strlen($newPassword) < $min) {
                throw ValidationException::withMessages(['new_password' => 'رمز عبور جدید باید حداقل '.strtr((string) $min, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']).' کاراکتر باشد.']);
            }
            if (PasswordRules::isWeak($newPassword, $user->username)) {
                throw ValidationException::withMessages(['new_password' => 'این رمز عبور ساده و قابل حدس است؛ رمز دیگری انتخاب کنید.']);
            }
            if (hash_equals($current, $newPassword)) {
                throw ValidationException::withMessages(['new_password' => 'رمز جدید باید با رمز فعلی متفاوت باشد.']);
            }
        }

        $changes = [];
        $profile = $user->profile();

        if ($newUsername !== '' && $newUsername !== $user->username) {
            $taken = User::query()
                ->where('id', '!=', $user->id)
                ->where(function ($q) use ($newUsername) {
                    $q->whereRaw('LOWER(username) = ?', [mb_strtolower($newUsername)])
                        ->orWhere('phone', $newUsername);
                })
                ->exists();
            if ($taken) {
                throw ValidationException::withMessages(['username' => 'این نام کاربری قبلاً برای کاربر دیگری ثبت شده است.']);
            }
            $changes['username'] = $newUsername;
            $profile->username = $newUsername;
        }

        if ($newPassword !== '') {
            $changes['password'] = Hash::make($newPassword);
            $changes['password_encrypted'] = null;
            if (\Illuminate\Support\Facades\Schema::hasColumn('users', 'must_change_password')) {
                $changes['must_change_password'] = false;
            }
        }

        if ($changes === []) {
            throw ValidationException::withMessages(['username' => 'تغییری برای ذخیره وجود ندارد.']);
        }

        $changes['data'] = json_encode($profile, SyncService::JSON_FLAGS);
        $user->forceFill($changes)->save();
        if ($newPassword !== '') {
            \App\Support\TrustedDevices::revokeAll($user->id); // با تغییر رمز، اعتماد همه‌ی دستگاه‌ها لغو می‌شود
        }

        return response()->json([
            'success' => true,
            'message' => 'اطلاعات حساب کاربری شما با موفقیت به‌روزرسانی شد.',
            'username' => $user->username,
        ]);
    }
}
