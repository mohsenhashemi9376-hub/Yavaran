<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

/** تأیید مجدد رمز برای دسترسی به پرونده‌های تربیتی (۳۰ دقیقه بی‌فعالیتی) */
class ReauthTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config(['app.require_password_reconfirm_nurturing' => true]);
        $this->makeClass('cls-mine');
        $this->makeStudent('stu-mine', 'cls-mine');
        $this->makeDossier('stu-mine');
    }

    private function coach(): User
    {
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-mine']]);
        $this->enableTwoFactor($coach);

        return $coach;
    }

    private function record(User $user)
    {
        return $this->actingAs($user)->getJson('/api/students/stu-mine/nurturing-record');
    }

    private function confirm(User $user, string $password = 'Str0ng-Pass!')
    {
        return $this->actingAs($user)->postJson('/api/auth/confirm-password', ['password' => $password]);
    }

    public function test_without_confirmation_record_is_forbidden_and_bootstrap_is_empty(): void
    {
        $coach = $this->coach();

        $this->record($coach)->assertForbidden()->assertJsonFragment(['message' => 'برای ادامه، رمز عبور خود را دوباره وارد کنید.']);

        $res = $this->actingAs($coach)->getJson('/api/bootstrap')->assertOk();
        $this->assertSame([], $res->json('data.nurturingDossiers'));
        $res->assertJsonPath('security.reauthRequired', true);
    }

    public function test_confirming_password_unlocks_access(): void
    {
        $coach = $this->coach();

        $this->confirm($coach)->assertOk()->assertJsonPath('success', true);

        $this->record($coach)->assertOk()->assertJsonPath('data.studentId', 'stu-mine');
        $res = $this->actingAs($coach)->getJson('/api/bootstrap')->assertOk();
        $this->assertCount(1, $res->json('data.nurturingDossiers'));
        $res->assertJsonPath('security.reauthRequired', false);
    }

    public function test_wrong_password_is_rejected_and_attempts_are_limited(): void
    {
        $coach = $this->coach();

        for ($i = 0; $i < 5; $i++) {
            $this->confirm($coach, 'wrong')->assertStatus(422);
        }

        $this->confirm($coach)->assertStatus(429);
        $this->record($coach)->assertForbidden();
    }

    public function test_confirmation_requires_login(): void
    {
        $this->postJson('/api/auth/confirm-password', ['password' => 'x'])->assertUnauthorized();
    }

    public function test_successful_login_counts_as_confirmation(): void
    {
        config(['app.require_two_factor_nurturing' => false]);
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-mine']]);

        $this->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!'])->assertOk();

        $this->getJson('/api/students/stu-mine/nurturing-record')->assertOk();
    }

    public function test_login_with_two_factor_counts_as_confirmation(): void
    {
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-mine']]);
        $secret = $this->enableTwoFactor($coach);

        $this->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!'])->assertOk();
        $this->postJson('/api/auth/two-factor', ['code' => $this->currentTotp($secret)])->assertOk();

        $this->getJson('/api/students/stu-mine/nurturing-record')->assertOk();
    }

    public function test_confirmation_expires_after_thirty_idle_minutes(): void
    {
        $coach = $this->coach();
        $this->confirm($coach)->assertOk();

        $this->travel(29)->minutes();
        $this->record($coach)->assertOk();

        $this->travel(31)->minutes();
        $this->record($coach)->assertForbidden();
    }

    public function test_user_activity_extends_the_window(): void
    {
        $coach = $this->coach();
        $this->confirm($coach)->assertOk();

        $this->travel(20)->minutes();
        $this->record($coach)->assertOk();   // فعالیت ← تمدید
        $this->travel(20)->minutes();
        $this->record($coach)->assertOk();   // ۴۰ دقیقه از تأیید، ولی ۲۰ دقیقه از آخرین فعالیت
    }

    public function test_background_refresh_does_not_extend_the_window(): void
    {
        $coach = $this->coach();
        $this->confirm($coach)->assertOk();

        $this->travel(20)->minutes();
        $this->actingAs($coach)->getJson('/api/bootstrap')->assertOk();   // بازخوانی پس‌زمینه تمدید نمی‌کند
        $this->travel(20)->minutes();

        $this->record($coach)->assertForbidden();
        $this->actingAs($coach)->getJson('/api/bootstrap')->assertJsonPath('security.reauthRequired', true);
    }

    public function test_writes_also_require_a_fresh_confirmation(): void
    {
        $coach = $this->coach();
        $payload = ['collection' => 'nurturingDossiers', 'upserts' => [['id' => 'stu-mine', 'data' => ['id' => 'stu-mine', 'studentId' => 'stu-mine', 'note' => 'x']]], 'deletes' => []];

        $this->actingAs($coach)->postJson('/api/sync', $payload)->assertForbidden();

        $this->confirm($coach)->assertOk();
        $this->actingAs($coach)->postJson('/api/sync', $payload)->assertOk();
    }

    public function test_audit_viewer_requires_confirmation_for_vice_nurturing(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);

        $this->actingAs($vice)->getJson('/api/nurturing-audit')->assertForbidden();
        $this->confirm($vice)->assertOk();
        $this->actingAs($vice)->getJson('/api/nurturing-audit')->assertOk();
    }

    public function test_other_roles_are_not_asked_to_reconfirm(): void
    {
        $teacher = $this->makeUser('teacher');

        $this->actingAs($teacher)->getJson('/api/bootstrap')->assertOk()->assertJsonPath('security.reauthRequired', false);
    }

    public function test_requirement_can_be_switched_off(): void
    {
        config(['app.require_password_reconfirm_nurturing' => false]);
        $coach = $this->coach();

        $this->record($coach)->assertOk();
    }
}
