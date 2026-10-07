<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** تغییر رمز و «خروج از همه‌ی دستگاه‌های دیگر» نشست‌های دیگر را نامعتبر می‌کند */
class SessionInvalidationTest extends TestCase
{
    private function loginAs(User $user, string $password = 'Str0ng-Pass!'): void
    {
        $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => $password])->assertOk();
        $this->getJson('/api/two-factor')->assertOk(); // اولین درخواست احراز‌شده، هش رمز را در نشست ثبت می‌کند
    }

    public function test_session_dies_when_the_password_changes_elsewhere(): void
    {
        $user = $this->makeUser('teacher');
        $this->loginAs($user);

        DB::table('users')->where('id', $user->id)->update(['password' => Hash::make('Changed-Elsewhere-1')]);
        $this->app['auth']->forgetGuards(); // هر درخواست واقعی کاربر را تازه از دیتابیس می‌خواند

        $this->getJson('/api/two-factor')->assertUnauthorized();
    }

    public function test_admin_resetting_a_password_invalidates_the_users_old_session(): void
    {
        $admin = $this->makeUser('admin');
        $teacher = $this->makeUser('teacher');
        $this->loginAs($teacher);
        $staleHash = $this->app['session.store']->get('password_hash_web');
        $this->assertNotEmpty($staleHash);

        $this->actingAs($admin)->postJson('/api/sync', [
            'collection' => 'users',
            'upserts' => [['id' => $teacher->id, 'data' => ['id' => $teacher->id, 'username' => $teacher->id, 'name' => 'معلم', 'role' => 'teacher', 'isActive' => true, 'password' => 'Reset-By-Admin-1']]],
            'deletes' => [],
        ])->assertOk();

        // دستگاه قدیمیِ معلم هنوز هش رمز قبلی را دارد
        $this->app['auth']->forgetGuards();
        $this->app['auth']->guard('web')->loginUsingId($teacher->id);
        $this->app['session.store']->put('password_hash_web', $staleHash);

        $this->getJson('/api/two-factor')->assertUnauthorized();
    }

    public function test_changing_own_password_keeps_the_current_session_alive(): void
    {
        $user = $this->makeUser('teacher');
        $this->loginAs($user);

        $this->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Brand-New-Pass1', 'new_password_confirmation' => 'Brand-New-Pass1',
        ])->assertOk();

        $this->getJson('/api/two-factor')->assertOk();
        $this->getJson('/api/two-factor')->assertOk();
    }

    public function test_changing_own_password_invalidates_a_stale_session_of_another_device(): void
    {
        $user = $this->makeUser('teacher');
        $this->loginAs($user);
        $otherDeviceHash = $this->app['session.store']->get('password_hash_web');

        $this->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Brand-New-Pass1', 'new_password_confirmation' => 'Brand-New-Pass1',
        ])->assertOk();

        // «دستگاه دیگر» هنوز هش رمز قدیمی را دارد
        $this->app['session.store']->put('password_hash_web', $otherDeviceHash);
        $this->getJson('/api/two-factor')->assertUnauthorized();
    }

    public function test_logout_other_devices_requires_the_correct_password(): void
    {
        $user = $this->makeUser('teacher');
        $this->loginAs($user);

        $this->postJson('/api/auth/logout-others', ['password' => 'wrong'])->assertStatus(422);
        $this->postJson('/api/auth/logout-others', [])->assertStatus(422);
    }

    public function test_logout_other_devices_ends_other_sessions_but_not_the_current_one(): void
    {
        $user = $this->makeUser('teacher');
        $this->loginAs($user);
        $otherDeviceHash = $this->app['session.store']->get('password_hash_web');

        $this->postJson('/api/auth/logout-others', ['password' => 'Str0ng-Pass!'])->assertOk()->assertJsonPath('success', true);

        $this->getJson('/api/two-factor')->assertOk();
        // رمز همان است و ورود با آن همچنان ممکن است
        $this->assertTrue(password_verify('Str0ng-Pass!', (string) DB::table('users')->where('id', $user->id)->value('password')));

        $this->app['session.store']->put('password_hash_web', $otherDeviceHash);
        $this->getJson('/api/two-factor')->assertUnauthorized();
    }

    public function test_logout_other_devices_is_rate_limited(): void
    {
        $user = $this->makeUser('teacher');
        $this->loginAs($user);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/logout-others', ['password' => 'wrong'])->assertStatus(422);
        }

        $this->postJson('/api/auth/logout-others', ['password' => 'Str0ng-Pass!'])->assertStatus(429);
    }

    public function test_logout_other_devices_requires_login(): void
    {
        $this->postJson('/api/auth/logout-others', ['password' => 'x'])->assertUnauthorized();
    }

    public function test_normal_use_is_not_affected(): void
    {
        $user = $this->makeUser('teacher');
        $this->loginAs($user);

        for ($i = 0; $i < 3; $i++) {
            $this->getJson('/api/bootstrap')->assertOk()->assertJsonPath('authenticated', true);
        }
    }
}
