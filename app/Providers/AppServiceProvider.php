<?php

namespace App\Providers;

use App\Models\CoachEvaluation;
use App\Models\NurturingDossier;
use App\Models\NurturingRecord;
use App\Models\Student;
use App\Models\StudentObservation;
use App\Models\User;
use App\Policies\NurturingRecordPolicy;
use App\Policies\StudentPolicy;
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
        // استثنا: پرونده‌های تربیتی و مشاهدات رفتاری (ایزولاسیون کامل؛ مدیر سامانه هم از Policy عبور می‌کند)
        Gate::before(function (User $user, string $ability, array $arguments = []) {
            $subject = $arguments[0] ?? null;
            // دسترسی به پرونده تربیتی از مسیر دانش‌آموز: مدیر سامانه هم باید از Policy عبور کند
            if (str_ends_with($ability, 'NurturingRecord')) {
                return null;
            }
            if ($subject instanceof NurturingRecord || (is_string($subject) && is_a($subject, NurturingRecord::class, true))) {
                return null;
            }

            return $user->isAdmin() ? true : null;
        });

        Gate::policy(Student::class, StudentPolicy::class);

        foreach ([StudentObservation::class, NurturingDossier::class, CoachEvaluation::class] as $model) {
            Gate::policy($model, NurturingRecordPolicy::class);
        }

        // Gate::allows('manage-grades') و ...
        foreach (Permissions::all() as $key) {
            Gate::define($key, fn (User $user): bool => $user->hasPermission($key));
        }

        if ($this->app->environment('production') && str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }
    }
}
