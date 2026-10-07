<?php

namespace Tests;

use App\Models\User;
use App\Support\Totp;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    public function createApplication(): Application
    {
        $app = require __DIR__.'/../bootstrap/app.php';
        $app->make(Kernel::class)->bootstrap();

        return $app;
    }

    /**
     * ساخت کاربر آزمایشی با نقش مشخص (رمز پیش‌فرض آزمون: «Str0ng-Pass!» تا اجباری تغییر رمز فعال نشود).
     *
     * @param  array<string, mixed>  $attrs
     * @param  array<string, mixed>  $profile  محتوای ستون data (assignedClassIds و ...)
     */
    protected function makeUser(string $role, array $attrs = [], array $profile = []): User
    {
        $id = $attrs['id'] ?? ($role.'-'.bin2hex(random_bytes(3)));
        $row = array_merge([
            'id' => $id,
            'username' => $id,
            'name' => 'کاربر '.$id,
            'role' => $role,
            'is_active' => true,
            'password' => Hash::make('Str0ng-Pass!'),
            'data' => json_encode(array_merge(['id' => $id, 'name' => 'کاربر '.$id, 'role' => $role, 'username' => $id], $profile), JSON_UNESCAPED_UNICODE),
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attrs);

        DB::table('users')->insert($row);
        User::ensureTwoFactorColumns();

        return User::query()->findOrFail($id);
    }

    /** فعال‌سازی ورود دومرحله‌ای برای کاربر (برای عبور از شرط اجباری پرونده‌های تربیتی) */
    protected function enableTwoFactor(User $user, string $secret = 'JBSWY3DPEHPK3PXP'): string
    {
        User::ensureTwoFactorColumns();
        DB::table('users')->where('id', $user->id)->update([
            'two_factor_secret' => Crypt::encryptString($secret),
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => json_encode([]),
        ]);
        $user->refresh();

        return $secret;
    }

    protected function currentTotp(string $secret): string
    {
        return Totp::code($secret);
    }

    /** @param  array<string, mixed>  $extra */
    protected function makeClass(string $id, array $extra = []): void
    {
        $data = array_merge(['id' => $id, 'name' => 'کلاس '.$id, 'grade' => 'هشتم', 'teacherIds' => []], $extra);
        DB::table('school_classes')->insert([
            'id' => $id,
            'name' => $data['name'],
            'grade' => $data['grade'],
            'academic_year' => '1405-1406',
            'sort_order' => 0,
            'data' => json_encode($data, JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function makeStudent(string $id, string $classId): void
    {
        DB::table('students')->insert([
            'id' => $id,
            'class_id' => $classId,
            'first_name' => 'علی',
            'last_name' => 'رضایی',
            'sort_order' => 0,
            'data' => json_encode(['id' => $id, 'classId' => $classId, 'firstName' => 'علی', 'lastName' => 'رضایی', 'studentCode' => $id, 'nationalId' => '0', 'parentPhone' => '09120000001'], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * ثبت مستقیم یک پرونده تربیتی رمزنگاری‌شده از مسیر مدل.
     *
     * @param  array<string, mixed>  $content
     */
    protected function makeDossier(string $studentId, array $content = []): void
    {
        $payload = array_merge(['id' => $studentId, 'studentId' => $studentId, 'note' => 'یادداشت بسیار محرمانه'], $content);
        $model = new \App\Models\NurturingDossier;
        $model->forceFill([
            'id' => $studentId,
            'student_id' => $studentId,
            'sort_order' => 0,
            'data' => json_encode($payload, JSON_UNESCAPED_UNICODE),
        ])->save();
    }
}
