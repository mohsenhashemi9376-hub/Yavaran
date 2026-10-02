<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Digits;
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
            $changes['password_encrypted'] = Crypt::encryptString($newPassword);
        }

        if ($changes === []) {
            throw ValidationException::withMessages(['username' => 'تغییری برای ذخیره وجود ندارد.']);
        }

        $changes['data'] = json_encode($profile, SyncService::JSON_FLAGS);
        $user->forceFill($changes)->save();

        return response()->json([
            'success' => true,
            'message' => 'اطلاعات حساب کاربری شما با موفقیت به‌روزرسانی شد.',
            'username' => $user->username,
        ]);
    }
}
