<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ResetTwoFactor extends Command
{
    protected $signature = 'two-factor:reset {username : نام کاربری}';

    protected $description = 'غیرفعال‌سازی ورود دومرحله‌ای یک کاربر (مثلاً پس از گم شدن گوشی و کدهای بازیابی) — فقط با دسترسی سرور';

    public function handle(): int
    {
        User::ensureTwoFactorColumns();
        $user = User::query()->where('username', $this->argument('username'))->first();
        if (! $user) {
            $this->error('کاربر یافت نشد.');

            return self::FAILURE;
        }

        DB::table('users')->where('id', $user->id)->update([
            'two_factor_secret' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_recovery_codes' => null,
        ]);
        \App\Support\TrustedDevices::revokeAll((string) $user->id);
        $this->info("ورود دومرحله‌ای «{$user->name}» غیرفعال شد؛ در ورود بعدی باید دوباره تنظیم شود.");

        return self::SUCCESS;
    }
}
