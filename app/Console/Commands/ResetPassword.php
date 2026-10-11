<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\PasswordRecovery;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class ResetPassword extends Command
{
    protected $signature = 'password:reset {username : نام کاربری}';

    protected $description = 'تعیین رمز موقت تصادفی برای یک کاربر (مثلاً مدیری که رمزش را فراموش کرده) — فقط با دسترسی سرور';

    public function handle(): int
    {
        $user = User::query()->where('username', $this->argument('username'))->first();
        if (! $user) {
            $this->error('کاربر یافت نشد.');

            return self::FAILURE;
        }

        $temp = Str::password(12, symbols: false);
        PasswordRecovery::apply($user, $temp, true);
        $this->info("رمز موقت «{$user->name}»: {$temp}");
        $this->line('کاربر در اولین ورود باید رمز را تغییر دهد؛ نشست‌های قبلی او بسته شد.');

        return self::SUCCESS;
    }
}
