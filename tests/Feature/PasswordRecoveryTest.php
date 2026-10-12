<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** فراموشی رمز: رمز موقت فقط به ایمیل ثبت‌شده فرستاده می‌شود */
class PasswordRecoveryTest extends TestCase
{
    private function withEmail(string $role = 'teacher', string $email = 'teacher@example.com')
    {
        return $this->makeUser($role, [], ['email' => $email]);
    }

    private function forgot(string $username)
    {
        return $this->postJson('/api/auth/forgot-password', ['username' => $username]);
    }

    private function hash(string $id): string
    {
        return (string) DB::table('users')->where('id', $id)->value('password');
    }

    public function test_temporary_password_is_emailed_and_must_be_changed(): void
    {
        config(['mail.default' => 'smtp']);
        Mail::fake();
        $user = $this->withEmail();

        $this->forgot($user->username)->assertOk();

        $this->assertFalse(password_verify('Str0ng-Pass!', $this->hash($user->id)));
        $this->assertSame(1, (int) DB::table('users')->where('id', $user->id)->value('must_change_password'));
    }

    public function test_answer_is_identical_for_unknown_users_and_users_without_email(): void
    {
        config(['mail.default' => 'smtp']);
        Mail::fake();
        $noEmail = $this->makeUser('teacher');

        $a = $this->forgot($noEmail->username)->assertOk()->json('message');
        $b = $this->forgot('nobody-here')->assertOk()->json('message');

        $this->assertSame($a, $b);
        $this->assertTrue(password_verify('Str0ng-Pass!', $this->hash($noEmail->id)));
    }

    public function test_password_is_untouched_when_mail_is_not_configured(): void
    {
        config(['mail.default' => 'log']);
        $user = $this->withEmail();

        $this->forgot($user->username)->assertOk();

        $this->assertTrue(password_verify('Str0ng-Pass!', $this->hash($user->id)));
    }

    public function test_password_is_untouched_when_sending_fails(): void
    {
        config(['mail.default' => 'smtp']);
        Mail::shouldReceive('raw')->andThrow(new \RuntimeException('smtp down'));
        $user = $this->withEmail();

        $this->forgot($user->username)->assertOk();

        $this->assertTrue(password_verify('Str0ng-Pass!', $this->hash($user->id)));
    }

    public function test_second_request_within_ten_minutes_does_not_reset_again(): void
    {
        config(['mail.default' => 'smtp']);
        Mail::fake();
        $user = $this->withEmail();

        $this->forgot($user->username)->assertOk();
        $first = $this->hash($user->id);
        $this->forgot($user->username)->assertOk();

        $this->assertSame($first, $this->hash($user->id));
    }

    public function test_profile_can_save_email(): void
    {
        $user = $this->makeUser('teacher');

        $this->actingAs($user)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'email' => 'me@example.com',
        ])->assertOk();

        $this->assertSame('me@example.com', $user->fresh()->profile()->email);
    }

    public function test_profile_rejects_invalid_email(): void
    {
        $user = $this->makeUser('teacher');

        $this->actingAs($user)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'email' => 'not-an-email',
        ])->assertStatus(422);
    }
}
