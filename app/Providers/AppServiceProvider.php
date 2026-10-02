<?php

namespace App\Providers;

use App\Models\User;
use App\Support\Permissions;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // سازگاری با نسخه‌های قدیمی MySQL/MariaDB روی هاست‌های اشتراکی
        Schema::defaultStringLength(191);

        // مدیر مدرسه به همه‌ی دسترسی‌ها دسترسی دارد (Superadmin Bypass)
        Gate::before(fn (User $user) => $user->isAdmin() ? true : null);

        // Gate::allows('manage-grades') و ...
        foreach (Permissions::all() as $key) {
            Gate::define($key, fn (User $user): bool => $user->hasPermission($key));
        }

        if ($this->app->environment('production') && str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }
    }
}
