<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Totp;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TwoFactorTest extends TestCase
{
    /** @return array{0: User, 1: string} کاربر با ورود دومرحله‌ای فعال و کلید آن */
    private function userWithTwoFactor(string $role = 'coach'): array
    {
        $user = $this->makeUser($role);
        $secret = $this->enableTwoFactor($user);

        return [$user, $secret];
    }

    private function login(User $user, string $password = 'Str0ng-Pass!')
    {
        return $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => $password]);
    }

    // ---------- تنظیم و تأیید ----------

    public function test_status_reports_required_and_enabled(): void
    {
        $coach = $this->makeUser('coach');
        $teacher = $this->makeUser('teacher');

        $this->actingAs($coach)->getJson('/api/two-factor')->assertOk()->assertExactJson(['enabled' => false, 'required' => true]);
        $this->actingAs($teacher)->getJson('/api/two-factor')->assertOk()->assertExactJson(['enabled' => false, 'required' => false]);
    }

    public function test_setup_returns_secret_and_uri_and_stores_it_encrypted_but_unconfirmed(): void
    {
        $coach = $this->makeUser('coach');

        $res = $this->actingAs($coach)->postJson('/api/two-factor/setup')->assertOk();

        $plain = str_replace(' ', '', $res->json('secret'));
        $this->assertMatchesRegularExpression('/^[A-Z2-7]{32}$/', $plain);
        $this->assertStringContainsString($plain, $res->json('uri'));

        $row = DB::table('users')->where('id', $coach->id)->first();
        $this->assertNotSame($plain, $row->two_factor_secret);
        $this->assertSame($plain, Crypt::decryptString($row->two_factor_secret));
        $this->assertNull($row->two_factor_confirmed_at);
        $this->assertFalse(User::query()->find($coach->id)->hasTwoFactor());
    }

    public function test_confirm_with_wrong_code_fails_and_correct_code_enables_with_recovery_codes(): void
    {
        $coach = $this->makeUser('coach');
        $secret = str_replace(' ', '', $this->actingAs($coach)->postJson('/api/two-factor/setup')->json('secret'));

        $this->actingAs($coach)->postJson('/api/two-factor/confirm', ['code' => '000000'])->assertStatus(422);
        $this->assertFalse(User::query()->find($coach->id)->hasTwoFactor());

        $res = $this->actingAs($coach)->postJson('/api/two-factor/confirm', ['code' => Totp::code($secret)])->assertOk();

        $codes = $res->json('recoveryCodes');
        $this->assertCount(8, $codes);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{5}-[0-9a-f]{5}$/', $codes[0]);
        $this->assertTrue(User::query()->find($coach->id)->hasTwoFactor());

        // کدهای بازیابی فقط به‌صورت هش ذخیره می‌شوند
        $stored = (string) DB::table('users')->where('id', $coach->id)->value('two_factor_recovery_codes');
        $this->assertStringNotContainsString(str_replace('-', '', $codes[0]), $stored);
    }

    public function test_confirm_without_setup_is_rejected(): void
    {
        $coach = $this->makeUser('coach');

        $this->actingAs($coach)->postJson('/api/two-factor/confirm', ['code' => '123456'])->assertStatus(422);
    }

    public function test_setup_is_refused_when_already_enabled(): void
    {
        [$coach] = $this->userWithTwoFactor();

        $this->actingAs($coach)->postJson('/api/two-factor/setup')->assertStatus(422);
    }

    public function test_confirm_is_rate_limited(): void
    {
        $coach = $this->makeUser('coach');
        $secret = str_replace(' ', '', $this->actingAs($coach)->postJson('/api/two-factor/setup')->json('secret'));

        for ($i = 0; $i < 8; $i++) {
            $this->actingAs($coach)->postJson('/api/two-factor/confirm', ['code' => '000000'])->assertStatus(422);
        }

        // حتی کد درست هم پس از سقف تلاش پذیرفته نمی‌شود
        $this->actingAs($coach)->postJson('/api/two-factor/confirm', ['code' => Totp::code($secret)])->assertStatus(422);
        $this->assertFalse(User::query()->find($coach->id)->hasTwoFactor());
    }

    // ---------- ورود ----------

    public function test_login_without_two_factor_signs_in_immediately(): void
    {
        $teacher = $this->makeUser('teacher');

        $this->login($teacher)->assertOk()->assertJsonMissing(['requiresTwoFactor' => true]);
        $this->assertAuthenticatedAs($teacher);
    }

    public function test_login_with_two_factor_does_not_sign_in_until_code_is_verified(): void
    {
        [$coach, $secret] = $this->userWithTwoFactor();

        $this->login($coach)->assertOk()->assertJsonPath('requiresTwoFactor', true);
        $this->assertGuest();
        $this->getJson('/api/two-factor')->assertUnauthorized();

        $this->postJson('/api/auth/two-factor', ['code' => Totp::code($secret)])->assertOk()->assertJsonPath('success', true);
        $this->assertAuthenticatedAs($coach);
    }

    public function test_wrong_password_never_reaches_the_second_step(): void
    {
        [$coach] = $this->userWithTwoFactor();

        $this->login($coach, 'wrong')->assertStatus(422);
        $this->postJson('/api/auth/two-factor', ['code' => '123456'])->assertStatus(422)->assertJsonPath('restart', true);
        $this->assertGuest();
    }

    public function test_wrong_code_is_rejected(): void
    {
        [$coach] = $this->userWithTwoFactor();
        $this->login($coach)->assertOk();

        $this->postJson('/api/auth/two-factor', ['code' => '000000'])->assertStatus(422)->assertJsonPath('success', false);
        $this->assertGuest();
    }

    public function test_second_step_without_first_step_is_rejected(): void
    {
        $this->postJson('/api/auth/two-factor', ['code' => '123456'])->assertStatus(422)->assertJsonPath('restart', true);
    }

    public function test_pending_login_expires_after_five_minutes(): void
    {
        [$coach, $secret] = $this->userWithTwoFactor();
        $this->login($coach)->assertOk();

        $this->travel(6)->minutes();

        $this->postJson('/api/auth/two-factor', ['code' => Totp::code($secret)])->assertStatus(422)->assertJsonPath('restart', true);
        $this->assertGuest();
    }

    public function test_five_wrong_codes_lock_the_attempt(): void
    {
        [$coach, $secret] = $this->userWithTwoFactor();
        $this->login($coach)->assertOk();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/two-factor', ['code' => '000000'])->assertStatus(422);
        }

        $this->postJson('/api/auth/two-factor', ['code' => Totp::code($secret)])->assertStatus(429);
        $this->assertGuest();
    }

    public function test_a_code_cannot_be_used_twice(): void
    {
        [$coach, $secret] = $this->userWithTwoFactor();
        $code = Totp::code($secret);

        $this->login($coach)->assertOk();
        $this->postJson('/api/auth/two-factor', ['code' => $code])->assertOk();
        $this->postJson('/api/auth/logout')->assertOk();

        $this->login($coach)->assertOk();
        $this->postJson('/api/auth/two-factor', ['code' => $code])->assertStatus(422);
        $this->assertGuest();
    }

    public function test_inactive_user_cannot_finish_second_step(): void
    {
        [$coach, $secret] = $this->userWithTwoFactor();
        $this->login($coach)->assertOk();
        DB::table('users')->where('id', $coach->id)->update(['is_active' => false]);

        $this->postJson('/api/auth/two-factor', ['code' => Totp::code($secret)])->assertStatus(422);
        $this->assertGuest();
    }

    // ---------- کدهای بازیابی ----------

    public function test_recovery_code_logs_in_once(): void
    {
        $coach = $this->makeUser('coach');
        $secret = str_replace(' ', '', $this->actingAs($coach)->postJson('/api/two-factor/setup')->json('secret'));
        $codes = $this->actingAs($coach)->postJson('/api/two-factor/confirm', ['code' => Totp::code($secret)])->json('recoveryCodes');
        $this->postJson('/api/auth/logout')->assertOk();

        $this->login($coach)->assertOk();
        $this->postJson('/api/auth/two-factor', ['code' => $codes[0]])->assertOk();
        $this->assertAuthenticatedAs($coach);
        $this->postJson('/api/auth/logout')->assertOk();

        $this->login($coach)->assertOk();
        $this->postJson('/api/auth/two-factor', ['code' => $codes[0]])->assertStatus(422);
        $this->assertGuest();

        // کد دیگر همچنان کار می‌کند
        $this->postJson('/api/auth/two-factor', ['code' => $codes[1]])->assertOk();
    }

    // ---------- غیرفعال‌سازی ----------

    public function test_required_roles_cannot_disable(): void
    {
        [$coach, $secret] = $this->userWithTwoFactor();

        $this->actingAs($coach)->postJson('/api/two-factor/disable', ['password' => 'Str0ng-Pass!', 'code' => Totp::code($secret)])
            ->assertStatus(422);
        $this->assertTrue(User::query()->find($coach->id)->hasTwoFactor());
    }

    public function test_optional_roles_can_disable_with_password_and_code(): void
    {
        [$teacher, $secret] = $this->userWithTwoFactor('teacher');

        $this->actingAs($teacher)->postJson('/api/two-factor/disable', ['password' => 'wrong', 'code' => Totp::code($secret)])->assertStatus(422);
        $this->actingAs($teacher)->postJson('/api/two-factor/disable', ['password' => 'Str0ng-Pass!', 'code' => '000000'])->assertStatus(422);
        $this->assertTrue(User::query()->find($teacher->id)->hasTwoFactor());

        $this->actingAs($teacher)->postJson('/api/two-factor/disable', ['password' => 'Str0ng-Pass!', 'code' => Totp::code($secret)])->assertOk();

        $this->assertFalse(User::query()->find($teacher->id)->hasTwoFactor());
        $this->assertNull(DB::table('users')->where('id', $teacher->id)->value('two_factor_secret'));
    }

    // ---------- دستور بازنشانی ----------

    public function test_reset_command_disables_two_factor(): void
    {
        [$coach] = $this->userWithTwoFactor();

        $this->artisan('two-factor:reset', ['username' => $coach->username])->assertSuccessful();

        $this->assertFalse(User::query()->find($coach->id)->hasTwoFactor());
    }

    public function test_reset_command_fails_for_unknown_user(): void
    {
        $this->artisan('two-factor:reset', ['username' => 'ghost'])->assertFailed();
    }

    public function test_secrets_are_hidden_from_serialization(): void
    {
        [$coach] = $this->userWithTwoFactor();

        $array = User::query()->find($coach->id)->toArray();

        foreach (['two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at', 'password'] as $key) {
            $this->assertArrayNotHasKey($key, $array);
        }
    }
}
