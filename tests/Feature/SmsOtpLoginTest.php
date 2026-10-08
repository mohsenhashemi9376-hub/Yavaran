<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Sms;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class SmsOtpLoginTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'sms.otp_enabled' => true,
            'sms.driver' => 'kavenegar',
            'sms.api_key' => 'test-key',
            'sms.template' => 'yavaran-otp',
        ]);
    }

    /** ورود با رمز و برگرداندن کدی که به Kavenegar فرستاده شد */
    private function loginAndCaptureCode(User $user, string $password = 'Str0ng-Pass!'): array
    {
        Http::fake(['api.kavenegar.com/*' => Http::response(['return' => ['status' => 200]])]);
        $res = $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => $password]);
        $code = null;
        Http::assertSent(function ($request) use (&$code) {
            $code = $request['token'];

            return str_contains($request->url(), '/v1/test-key/verify/lookup.json');
        });

        return [$res, $code];
    }

    public function test_coach_must_enter_sms_code_on_every_login(): void
    {
        $coach = $this->makeUser('coach', ['phone' => '09123456789']);

        [$res, $code] = $this->loginAndCaptureCode($coach);
        $res->assertOk()->assertJsonPath('requiresTwoFactor', true)->assertJsonPath('method', 'sms')->assertJsonPath('phone', '0912***789');
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $this->assertGuest();

        $this->postJson('/api/auth/two-factor', ['code' => $code])->assertOk();
        $this->assertAuthenticatedAs($coach);

        // خروج و ورود دوباره: دوباره کد لازم است
        $this->postJson('/api/auth/logout')->assertOk();
        [$res2] = $this->loginAndCaptureCode($coach);
        $res2->assertJsonPath('requiresTwoFactor', true);
        $this->assertGuest();
    }

    public function test_vice_nurturing_also_requires_sms_code(): void
    {
        $vice = $this->makeUser('vice_nurturing', ['phone' => '+98 912 345 6789']);

        [$res] = $this->loginAndCaptureCode($vice);
        $res->assertJsonPath('requiresTwoFactor', true)->assertJsonPath('method', 'sms');
    }

    public function test_teacher_does_not_need_code(): void
    {
        Http::fake();
        $teacher = $this->makeUser('teacher', ['phone' => '09123456789']);

        $this->postJson('/api/auth/login', ['username' => $teacher->username, 'password' => 'Str0ng-Pass!'])
            ->assertOk()->assertJsonMissingPath('requiresTwoFactor');
        $this->assertAuthenticatedAs($teacher);
        Http::assertNothingSent();
    }

    public function test_wrong_password_sends_no_sms(): void
    {
        Http::fake();
        $coach = $this->makeUser('coach', ['phone' => '09123456789']);

        $this->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'wrong'])->assertStatus(422);
        Http::assertNothingSent();
    }

    public function test_wrong_code_is_rejected_and_correct_code_works_only_once(): void
    {
        $coach = $this->makeUser('coach', ['phone' => '09123456789']);
        [, $code] = $this->loginAndCaptureCode($coach);
        $wrong = $code === '000000' ? '111111' : '000000';

        $this->postJson('/api/auth/two-factor', ['code' => $wrong])->assertStatus(422);
        $this->assertGuest();
        $this->postJson('/api/auth/two-factor', ['code' => $code])->assertOk();

        // کد مصرف‌شده دوباره قابل استفاده نیست
        $this->postJson('/api/auth/logout')->assertOk();
        $this->postJson('/api/auth/two-factor', ['code' => $code])->assertStatus(422)->assertJsonPath('restart', true);
        $this->assertGuest();
    }

    public function test_code_is_voided_after_five_wrong_attempts(): void
    {
        $coach = $this->makeUser('coach', ['phone' => '09123456789']);
        [, $code] = $this->loginAndCaptureCode($coach);
        $wrong = $code === '000000' ? '111111' : '000000';

        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/api/auth/two-factor', ['code' => $wrong])->assertStatus(422);
        }
        $this->postJson('/api/auth/two-factor', ['code' => $wrong])->assertStatus(422)->assertJsonPath('restart', true);
        $this->postJson('/api/auth/two-factor', ['code' => $code])->assertStatus(422);
        $this->assertGuest();
    }

    public function test_expired_code_is_rejected(): void
    {
        $coach = $this->makeUser('coach', ['phone' => '09123456789']);
        [, $code] = $this->loginAndCaptureCode($coach);

        $this->travel(config('sms.otp_ttl_seconds') + 5)->seconds();
        $this->postJson('/api/auth/two-factor', ['code' => $code])->assertStatus(422)->assertJsonPath('restart', true);
        $this->assertGuest();
    }

    public function test_persian_digits_are_accepted(): void
    {
        $coach = $this->makeUser('coach', ['phone' => '۰۹۱۲۳۴۵۶۷۸۹']);
        [, $code] = $this->loginAndCaptureCode($coach);

        $this->postJson('/api/auth/two-factor', ['code' => strtr($code, '0123456789', '۰۱۲۳۴۵۶۷۸۹')])->assertOk();
        $this->assertAuthenticatedAs($coach);
    }

    public function test_missing_or_invalid_phone_blocks_login_with_clear_message(): void
    {
        Http::fake();
        $coach = $this->makeUser('coach', ['phone' => null]);
        $bad = $this->makeUser('coach', ['phone' => '12345']);

        foreach ([$coach, $bad] as $u) {
            $this->postJson('/api/auth/login', ['username' => $u->username, 'password' => 'Str0ng-Pass!'])
                ->assertStatus(422)->assertJsonPath('success', false);
            $this->assertGuest();
        }
        Http::assertNothingSent();
    }

    public function test_provider_failure_does_not_log_in_and_does_not_leak_code(): void
    {
        Http::fake(['api.kavenegar.com/*' => Http::response(['return' => ['status' => 418]], 200)]);
        $coach = $this->makeUser('coach', ['phone' => '09123456789']);

        $res = $this->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!'])
            ->assertStatus(422);
        $this->assertGuest();
        $this->assertStringNotContainsString('token', json_encode($res->json()));
        $this->postJson('/api/auth/two-factor', ['code' => '123456'])->assertStatus(422);
    }

    public function test_resend_respects_cooldown_and_replaces_the_code(): void
    {
        $coach = $this->makeUser('coach', ['phone' => '09123456789']);
        [, $first] = $this->loginAndCaptureCode($coach);

        $this->postJson('/api/auth/two-factor/resend')->assertStatus(429);

        $this->travel(config('sms.otp_resend_seconds') + 1)->seconds();
        Http::fake(['api.kavenegar.com/*' => Http::response(['return' => ['status' => 200]])]);
        $this->postJson('/api/auth/two-factor/resend')->assertOk()->assertJsonPath('phone', '0912***789');
        $second = null;
        Http::assertSent(function ($request) use (&$second) {
            $second = $request['token'];

            return true;
        });

        if ($first !== $second) {
            $this->postJson('/api/auth/two-factor', ['code' => $first])->assertStatus(422);
        }
        $this->postJson('/api/auth/two-factor', ['code' => $second])->assertOk();
    }

    public function test_resend_without_pending_login_is_rejected(): void
    {
        $this->postJson('/api/auth/two-factor/resend')->assertStatus(422)->assertJsonPath('restart', true);
    }

    public function test_sms_otp_replaces_totp_requirement_for_nurturing_access(): void
    {
        $coach = $this->makeUser('coach', ['phone' => '09123456789']);
        $this->assertFalse($coach->requiresTwoFactor());

        config(['sms.otp_enabled' => false]);
        $this->assertTrue($coach->requiresTwoFactor());
    }

    public function test_disabled_flag_keeps_old_behaviour(): void
    {
        config(['sms.otp_enabled' => false]);
        Http::fake();
        $coach = $this->makeUser('coach', ['phone' => '09123456789']);

        $this->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!'])
            ->assertOk()->assertJsonMissingPath('requiresTwoFactor');
        Http::assertNothingSent();
    }

    public function test_log_driver_is_refused_in_production(): void
    {
        config(['sms.driver' => 'log']);
        Log::spy();
        $this->app['env'] = 'production';
        $coach = $this->makeUser('coach', ['phone' => '09123456789']);

        $this->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!'])->assertStatus(422);
        $this->assertGuest();
    }

    public function test_phone_normalization(): void
    {
        $this->assertSame('09123456789', Sms::normalizePhone('0912 345 6789'));
        $this->assertSame('09123456789', Sms::normalizePhone('+989123456789'));
        $this->assertSame('09123456789', Sms::normalizePhone('00989123456789'));
        $this->assertSame('09123456789', Sms::normalizePhone('9123456789'));
        $this->assertNull(Sms::normalizePhone('02112345678'));
        $this->assertNull(Sms::normalizePhone(''));
        $this->assertNull(Sms::normalizePhone(null));
    }
}
