<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** ورود دومرحله‌ای فقط در اولین ورود با هر دستگاه؛ دستگاه ناشناس همیشه کد می‌خواهد */
class TrustedDeviceTest extends TestCase
{
    private const SECRET = 'JBSWY3DPEHPK3PXP';

    private function coach(): User
    {
        $coach = $this->makeUser('coach');
        $this->enableTwoFactor($coach, self::SECRET);

        return $coach;
    }

    private function loginPassword(User $user)
    {
        return $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'Str0ng-Pass!']);
    }

    /** ورود کامل با کد؛ در صورت trust=true، مقدار کوکی دستگاه را برمی‌گرداند */
    private function loginWithCode(User $user, bool $trust): ?string
    {
        $this->loginPassword($user)->assertOk()->assertJsonPath('requiresTwoFactor', true);
        $res = $this->postJson('/api/auth/two-factor', ['code' => $this->currentTotp(self::SECRET), 'trustDevice' => $trust])->assertOk();

        return $res->getCookie('yv_td', true)?->getValue();
    }

    public function test_first_login_on_a_device_needs_code_then_only_password(): void
    {
        $coach = $this->coach();
        $token = $this->loginWithCode($coach, true);
        $this->assertNotEmpty($token);
        $this->assertDatabaseHas('trusted_devices', ['user_id' => $coach->id]);
        // فقط هش توکن ذخیره می‌شود
        $this->assertDatabaseMissing('trusted_devices', ['token_hash' => $token]);

        $this->postJson('/api/auth/logout')->assertOk();
        $this->flushSession();

        $this->withCredentials()->withCookie('yv_td', $token)->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!'])
            ->assertOk()->assertJsonMissingPath('requiresTwoFactor');
        $this->assertAuthenticatedAs($coach);
    }

    public function test_unknown_device_always_requires_code(): void
    {
        $coach = $this->coach();
        $this->loginWithCode($coach, true);
        $this->postJson('/api/auth/logout')->assertOk();
        $this->flushSession();

        // بدون کوکی دستگاه
        $this->loginPassword($coach)->assertOk()->assertJsonPath('requiresTwoFactor', true);
        $this->assertGuest();

        // کوکی نامعتبر
        $this->flushSession();
        $this->withCredentials()->withCookie('yv_td', 'forged-token')->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!'])
            ->assertOk()->assertJsonPath('requiresTwoFactor', true);
    }

    public function test_device_is_not_trusted_unless_requested(): void
    {
        $coach = $this->coach();
        $this->assertNull($this->loginWithCode($coach, false));
        $this->assertDatabaseCount('trusted_devices', 0);
    }

    public function test_trusted_device_still_needs_the_password(): void
    {
        $coach = $this->coach();
        $token = $this->loginWithCode($coach, true);
        $this->postJson('/api/auth/logout')->assertOk();
        $this->flushSession();

        $this->withCredentials()->withCookie('yv_td', $token)->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'wrong'])->assertStatus(422);
        $this->assertGuest();
    }

    public function test_token_of_one_user_does_not_work_for_another(): void
    {
        $a = $this->coach();
        $b = $this->coach();
        $token = $this->loginWithCode($a, true);
        $this->postJson('/api/auth/logout')->assertOk();
        $this->flushSession();

        $this->withCredentials()->withCookie('yv_td', $token)->postJson('/api/auth/login', ['username' => $b->username, 'password' => 'Str0ng-Pass!'])
            ->assertOk()->assertJsonPath('requiresTwoFactor', true);
    }

    public function test_expired_trust_requires_code_again(): void
    {
        $coach = $this->coach();
        $token = $this->loginWithCode($coach, true);
        $this->postJson('/api/auth/logout')->assertOk();
        $this->flushSession();

        $this->travel(181)->days();
        $this->withCredentials()->withCookie('yv_td', $token)->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!'])
            ->assertOk()->assertJsonPath('requiresTwoFactor', true);
    }

    public function test_password_change_revokes_trust_on_all_devices(): void
    {
        $coach = $this->coach();
        $this->loginWithCode($coach, true);
        $this->assertDatabaseCount('trusted_devices', 1);

        $this->actingAs($coach)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'New-Strong-1', 'new_password_confirmation' => 'New-Strong-1',
            'code' => $this->currentTotp(self::SECRET),
        ])->assertOk();

        $this->assertDatabaseCount('trusted_devices', 0);
    }

    public function test_vice_revoking_sessions_also_revokes_device_trust(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);
        $coach = $this->coach();
        DB::table('trusted_devices')->insert([
            'user_id' => $coach->id, 'token_hash' => hash('sha256', 'x'), 'created_at' => now(), 'last_used_at' => now(), 'expires_at' => now()->addDays(10),
        ]);

        $this->actingAs($vice)->postJson('/api/nurturing/revoke-sessions', ['password' => 'Str0ng-Pass!', 'userId' => $coach->id])->assertOk();

        $this->assertDatabaseCount('trusted_devices', 0);
    }

    public function test_disabling_or_resetting_two_factor_revokes_trust(): void
    {
        $coach = $this->coach();
        DB::table('trusted_devices')->insert([
            'user_id' => $coach->id, 'token_hash' => hash('sha256', 'y'), 'created_at' => now(), 'last_used_at' => now(), 'expires_at' => now()->addDays(10),
        ]);

        $this->artisan('two-factor:reset', ['username' => $coach->username])->assertSuccessful();
        $this->assertDatabaseCount('trusted_devices', 0);
    }
}
