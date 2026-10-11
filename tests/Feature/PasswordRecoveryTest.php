<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PasswordRecoveryTest extends TestCase
{
    private const KEY = 'recovery-key-0123456789';

    private function inboxCount(string $userId): int
    {
        return \Illuminate\Support\Facades\Schema::hasTable('notifications')
            ? DB::table('notifications')->where('receiver_id', $userId)->where('ref_id', 'password_request')->count()
            : 0;
    }

    public function test_forgot_request_answers_the_same_for_unknown_users(): void
    {
        $known = $this->makeUser('teacher');
        $a = $this->postJson('/api/auth/forgot-password', ['username' => $known->username])->assertOk()->json('message');
        $b = $this->postJson('/api/auth/forgot-password', ['username' => 'nobody-here'])->assertOk()->json('message');

        $this->assertSame($a, $b);
    }

    public function test_forgot_request_notifies_the_admin_once(): void
    {
        $admin = $this->makeUser('admin');
        $teacher = $this->makeUser('teacher');

        $this->postJson('/api/auth/forgot-password', ['username' => $teacher->username])->assertOk();
        $this->postJson('/api/auth/forgot-password', ['username' => $teacher->username])->assertOk();

        $this->assertSame(1, $this->inboxCount($admin->id));
    }

    public function test_recovery_key_resets_password_and_signs_out_other_sessions(): void
    {
        config(['app.password_recovery_key' => self::KEY]);
        $admin = $this->makeUser('admin');

        $this->postJson('/api/auth/recover-password', [
            'username' => $admin->username, 'recovery_key' => self::KEY, 'new_password' => 'Brand-New-Pass9',
        ])->assertOk();

        $this->assertTrue(password_verify('Brand-New-Pass9', DB::table('users')->where('id', $admin->id)->value('password')));
        $this->postJson('/api/auth/login', ['username' => $admin->username, 'password' => 'Brand-New-Pass9'])->assertOk();
    }

    public function test_wrong_key_or_disabled_key_is_rejected(): void
    {
        $admin = $this->makeUser('admin');
        $payload = ['username' => $admin->username, 'recovery_key' => self::KEY, 'new_password' => 'Brand-New-Pass9'];

        config(['app.password_recovery_key' => '']);
        $this->postJson('/api/auth/recover-password', $payload)->assertStatus(422);

        config(['app.password_recovery_key' => self::KEY]);
        $this->postJson('/api/auth/recover-password', ['recovery_key' => 'wrong-wrong-wrong-1'] + $payload)->assertStatus(422);

        $this->assertTrue(password_verify('Str0ng-Pass!', DB::table('users')->where('id', $admin->id)->value('password')));
    }

    public function test_weak_new_password_is_rejected(): void
    {
        config(['app.password_recovery_key' => self::KEY]);
        $admin = $this->makeUser('admin');

        $this->postJson('/api/auth/recover-password', [
            'username' => $admin->username, 'recovery_key' => self::KEY, 'new_password' => '123456',
        ])->assertStatus(422);
    }

    public function test_recovery_is_rate_limited(): void
    {
        config(['app.password_recovery_key' => self::KEY]);
        $admin = $this->makeUser('admin');
        $bad = ['username' => $admin->username, 'recovery_key' => 'wrong-wrong-wrong-1', 'new_password' => 'Brand-New-Pass9'];

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/recover-password', $bad)->assertStatus(422);
        }
        $this->postJson('/api/auth/recover-password', ['recovery_key' => self::KEY] + $bad)->assertStatus(429);
    }

    public function test_artisan_reset_sets_temp_password_and_forces_change(): void
    {
        $admin = $this->makeUser('admin');

        $this->artisan('password:reset', ['username' => $admin->username])->assertSuccessful();

        $this->assertFalse(password_verify('Str0ng-Pass!', DB::table('users')->where('id', $admin->id)->value('password')));
        $this->assertSame(1, (int) DB::table('users')->where('id', $admin->id)->value('must_change_password'));
    }
}
