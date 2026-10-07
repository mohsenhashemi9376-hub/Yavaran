<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ForcePasswordChangeTest extends TestCase
{
    private function flag(string $id): int
    {
        return (int) DB::table('users')->where('id', $id)->value('must_change_password');
    }

    private function userWithPassword(string $role, string $password)
    {
        return $this->makeUser($role, ['password' => password_hash($password, PASSWORD_BCRYPT)]);
    }

    public function test_login_with_default_password_flags_the_account(): void
    {
        $user = $this->userWithPassword('teacher', '123');

        $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => '123'])->assertOk();

        $this->assertSame(1, $this->flag($user->id));
    }

    public function test_login_with_strong_password_does_not_flag(): void
    {
        $user = $this->makeUser('teacher');

        $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'Str0ng-Pass!'])->assertOk();

        $this->assertSame(0, $this->flag($user->id));
    }

    public function test_password_equal_to_username_is_flagged(): void
    {
        $user = $this->makeUser('teacher', ['username' => 'reza_ahmadi', 'password' => password_hash('reza_ahmadi', PASSWORD_BCRYPT)]);

        $this->postJson('/api/auth/login', ['username' => 'reza_ahmadi', 'password' => 'reza_ahmadi'])->assertOk();

        $this->assertSame(1, $this->flag($user->id));
    }

    public function test_bootstrap_returns_no_data_while_password_change_is_pending(): void
    {
        $this->makeClass('cls-1');
        $this->makeStudent('stu-1', 'cls-1');
        $user = $this->makeUser('admin', ['must_change_password' => true]);

        $res = $this->actingAs($user)->getJson('/api/bootstrap')->assertOk();

        $res->assertJsonPath('authenticated', true)->assertJsonPath('mustChangePassword', true);
        $this->assertEmpty($res->json('data'));
        $this->assertStringNotContainsString('stu-1', $res->getContent());
        $this->assertStringNotContainsString('cls-1', $res->getContent());
    }

    public function test_api_is_blocked_with_403_until_password_is_changed(): void
    {
        $user = $this->makeUser('admin', ['must_change_password' => true]);

        $this->actingAs($user)->postJson('/api/sync', ['collection' => 'students', 'upserts' => [], 'deletes' => []])
            ->assertForbidden()->assertJsonPath('mustChangePassword', true);
        $this->actingAs($user)->getJson('/api/notifications')->assertForbidden();
        $this->actingAs($user)->getJson('/api/nurturing-audit')->assertForbidden();
    }

    public function test_logout_profile_and_two_factor_remain_available(): void
    {
        $user = $this->makeUser('teacher', ['must_change_password' => true]);

        $this->actingAs($user)->getJson('/api/two-factor')->assertOk();
        $this->actingAs($user)->postJson('/api/auth/logout')->assertOk();
    }

    public function test_changing_to_a_weak_password_is_rejected(): void
    {
        $user = $this->makeUser('teacher', ['must_change_password' => true]);

        foreach (['123456', 'password', 'qwerty123'] as $weak) {
            $this->actingAs($user)->postJson('/api/profile', [
                'current_password' => 'Str0ng-Pass!', 'new_password' => $weak, 'new_password_confirmation' => $weak,
            ])->assertStatus(422)->assertJsonValidationErrors('new_password');
        }
        $this->assertSame(1, $this->flag($user->id));
    }

    public function test_forced_change_requires_eight_characters_and_a_new_password(): void
    {
        $user = $this->makeUser('teacher', ['must_change_password' => true]);

        $this->actingAs($user)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Ab1-xyz', 'new_password_confirmation' => 'Ab1-xyz',
        ])->assertStatus(422)->assertJsonValidationErrors('new_password');

        $this->actingAs($user)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Str0ng-Pass!', 'new_password_confirmation' => 'Str0ng-Pass!',
        ])->assertStatus(422)->assertJsonValidationErrors('new_password');

        $this->actingAs($user)->postJson('/api/profile', ['current_password' => 'Str0ng-Pass!'])
            ->assertStatus(422)->assertJsonValidationErrors('new_password');

        $this->assertSame(1, $this->flag($user->id));
    }

    public function test_wrong_current_password_is_rejected(): void
    {
        $user = $this->makeUser('teacher', ['must_change_password' => true]);

        $this->actingAs($user)->postJson('/api/profile', [
            'current_password' => 'nope', 'new_password' => 'Brand-New-Pass1', 'new_password_confirmation' => 'Brand-New-Pass1',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');
    }

    public function test_successful_change_clears_flag_and_restores_access(): void
    {
        $this->makeClass('cls-1');
        $user = $this->userWithPassword('admin', '123');
        DB::table('users')->where('id', $user->id)->update(['must_change_password' => true]);

        $this->actingAs($user)->postJson('/api/profile', [
            'current_password' => '123', 'new_password' => 'Brand-New-Pass1', 'new_password_confirmation' => 'Brand-New-Pass1',
        ])->assertOk();

        $this->assertSame(0, $this->flag($user->id));
        $res = $this->actingAs($user)->getJson('/api/bootstrap')->assertOk();
        $this->assertNotEmpty($res->json('data.classes'));
        $this->actingAs($user)->getJson('/api/notifications')->assertOk();
    }

    public function test_account_created_by_someone_else_must_change_password(): void
    {
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)->postJson('/api/sync', [
            'collection' => 'users',
            'upserts' => [['id' => 't-new', 'data' => ['id' => 't-new', 'username' => 't-new', 'name' => 'معلم', 'role' => 'teacher', 'isActive' => true, 'password' => 'Fine-Pass-123']]],
            'deletes' => [],
        ])->assertOk();

        $this->assertSame(1, $this->flag('t-new'));
    }

    public function test_password_reset_by_admin_flags_the_account(): void
    {
        $admin = $this->makeUser('admin');
        $teacher = $this->makeUser('teacher');
        $this->assertSame(0, $this->flag($teacher->id));

        $this->actingAs($admin)->postJson('/api/sync', [
            'collection' => 'users',
            'upserts' => [['id' => $teacher->id, 'data' => ['id' => $teacher->id, 'username' => $teacher->id, 'name' => 'معلم', 'role' => 'teacher', 'isActive' => true, 'password' => 'Reset-By-Admin-1']]],
            'deletes' => [],
        ])->assertOk();

        $this->assertSame(1, $this->flag($teacher->id));
    }

    public function test_login_of_a_flagged_two_factor_user_still_requires_the_code_first(): void
    {
        $coach = $this->makeUser('coach', ['must_change_password' => true]);
        $secret = $this->enableTwoFactor($coach);

        $this->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!'])
            ->assertOk()->assertJsonPath('requiresTwoFactor', true);
        $this->assertGuest();

        $this->postJson('/api/auth/two-factor', ['code' => $this->currentTotp($secret)])->assertOk();
        $this->getJson('/api/bootstrap')->assertJsonPath('mustChangePassword', true);
    }

    public function test_migration_flags_accounts_that_still_have_the_default_password(): void
    {
        $weak = $this->userWithPassword('teacher', '123');
        $strong = $this->makeUser('teacher');

        (require base_path('database/migrations/2026_10_17_000000_add_must_change_password_to_users_table.php'))->up();

        $this->assertSame(1, $this->flag($weak->id));
        $this->assertSame(0, $this->flag($strong->id));
    }
}
