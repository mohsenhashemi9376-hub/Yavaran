<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\NurturingAudit;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** خروج خودکار، بستن نشست‌ها توسط معاون، زنجیره‌ی هش لاگ و حداقل طول رمز مربی/معاون تربیتی */
class NurturingSessionSecurityTest extends TestCase
{
    private function login(User $user, string $password = 'Str0ng-Pass!-long')
    {
        return $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => $password]);
    }

    private function nurturing(string $role): User
    {
        $u = $this->makeUser($role, ['password' => \Illuminate\Support\Facades\Hash::make('Str0ng-Pass!-long')]);
        $this->enableTwoFactor($u);

        return $u;
    }

    /** ورود کامل (رمز + کد دومرحله‌ای) */
    private function fullLogin(User $user): void
    {
        $secret = 'JBSWY3DPEHPK3PXP';
        $this->login($user)->assertOk()->assertJsonPath('requiresTwoFactor', true);
        $this->postJson('/api/auth/two-factor', ['code' => $this->currentTotp($secret)])->assertOk();
    }

    public function test_idle_coach_is_logged_out_after_the_idle_limit(): void
    {
        config(['app.nurturing_idle_minutes' => 20, 'app.require_password_reconfirm_nurturing' => false]);
        $coach = $this->nurturing('coach');
        $this->fullLogin($coach);
        $this->getJson('/api/notifications')->assertOk();

        $this->travel(21)->minutes();
        $this->postJson('/api/sync', ['collection' => 'observations', 'upserts' => [], 'deletes' => []])
            ->assertStatus(401)->assertJsonPath('sessionExpired', true);
        $this->assertGuest();
    }

    public function test_bootstrap_after_expiry_reports_unauthenticated_with_message(): void
    {
        config(['app.nurturing_idle_minutes' => 20]);
        $this->fullLogin($this->nurturing('coach'));

        $this->travel(21)->minutes();
        $this->getJson('/api/bootstrap')->assertOk()
            ->assertJsonPath('authenticated', false)->assertJsonPath('sessionExpired', true);
        $this->assertGuest();
    }

    public function test_background_polling_does_not_extend_the_idle_window(): void
    {
        config(['app.nurturing_idle_minutes' => 20]);
        $this->fullLogin($this->nurturing('vice_nurturing'));

        $this->travel(15)->minutes();
        $this->getJson('/api/bootstrap')->assertOk()->assertJsonPath('authenticated', true);
        $this->getJson('/api/notifications')->assertOk();
        $this->travel(7)->minutes(); // 22 دقیقه از آخرین فعالیت واقعی
        $this->getJson('/api/bootstrap')->assertOk()->assertJsonPath('authenticated', false);
    }

    public function test_real_activity_extends_the_idle_window(): void
    {
        config(['app.nurturing_idle_minutes' => 20, 'app.require_password_reconfirm_nurturing' => false]);
        $this->fullLogin($this->nurturing('coach'));

        for ($i = 0; $i < 3; $i++) {
            $this->travel(15)->minutes();
            $this->postJson('/api/sync', ['collection' => 'observations', 'upserts' => [], 'deletes' => []])->assertOk();
        }
    }

    public function test_absolute_session_limit_applies_even_when_active(): void
    {
        config(['app.nurturing_idle_minutes' => 600, 'app.nurturing_session_max_hours' => 1, 'app.require_password_reconfirm_nurturing' => false]);
        $this->fullLogin($this->nurturing('coach'));

        $this->travel(61)->minutes();
        $this->postJson('/api/sync', ['collection' => 'observations', 'upserts' => [], 'deletes' => []])->assertStatus(401);
    }

    public function test_teacher_is_not_subject_to_idle_logout(): void
    {
        config(['app.nurturing_idle_minutes' => 1]);
        $teacher = $this->makeUser('teacher', ['password' => \Illuminate\Support\Facades\Hash::make('Str0ng-Pass!-long')]);
        $this->login($teacher)->assertOk();

        $this->travel(120)->minutes();
        $this->getJson('/api/bootstrap')->assertOk()->assertJsonPath('authenticated', true);
    }

    // ---------- بستن نشست‌ها ----------

    public function test_vice_can_revoke_a_coach_session(): void
    {
        $vice = $this->nurturing('vice_nurturing');
        $coach = $this->nurturing('coach');
        $this->fullLogin($coach);
        $this->getJson('/api/bootstrap')->assertJsonPath('authenticated', true);

        $this->travel(1)->seconds();
        $this->actingAs($vice)->postJson('/api/nurturing/revoke-sessions', ['password' => 'Str0ng-Pass!-long', 'userId' => $coach->id])
            ->assertOk()->assertJsonPath('count', 1);

        // نشست قبلی مربی نامعتبر است
        $this->flushSession();
        $this->app['auth']->forgetGuards();
        $this->assertNotNull(DB::table('users')->where('id', $coach->id)->value('sessions_revoked_at'));
        $this->assertNull(DB::table('users')->where('id', $vice->id)->value('sessions_revoked_at'));
    }

    public function test_revoked_session_is_rejected_but_new_login_works(): void
    {
        config(['app.require_password_reconfirm_nurturing' => false]);
        $coach = $this->nurturing('coach');
        $this->fullLogin($coach);

        DB::table('users')->where('id', $coach->id)->update(['sessions_revoked_at' => now()->addSecond()]);
        $this->travel(2)->seconds();
        $this->app['auth']->forgetGuards(); // در محیط واقعی هر درخواست کاربر را تازه از دیتابیس می‌خواند
        $this->getJson('/api/bootstrap')->assertOk()->assertJsonPath('authenticated', false);

        $this->travel(31)->seconds();
        \Illuminate\Support\Facades\Cache::flush(); // کد دومرحله‌ای همان بازه‌ی ۳۰ ثانیه‌ای دوباره پذیرفته نمی‌شود؛ در واقعیت کد جدید است
        $this->fullLogin($coach);
        $this->getJson('/api/bootstrap')->assertOk()->assertJsonPath('authenticated', true);
    }

    public function test_revoke_requires_vice_and_correct_password(): void
    {
        $vice = $this->nurturing('vice_nurturing');
        $coach = $this->nurturing('coach');

        $this->actingAs($coach)->postJson('/api/nurturing/revoke-sessions', ['password' => 'Str0ng-Pass!-long', 'userId' => $vice->id])->assertStatus(403);
        $this->actingAs($vice)->postJson('/api/nurturing/revoke-sessions', ['password' => 'wrong', 'userId' => $coach->id])->assertStatus(422);
        $this->assertNull(DB::table('users')->where('id', $coach->id)->value('sessions_revoked_at'));
    }

    // ---------- زنجیره‌ی هش لاگ ----------

    public function test_audit_chain_is_valid_and_detects_tampering_and_deletion(): void
    {
        $coach = $this->nurturing('coach');
        foreach (['view', 'create', 'update'] as $a) {
            NurturingAudit::log($coach, $a, 'observations', 'stu-1', 'r-'.$a);
        }
        NurturingAudit::log($coach, 'update', 'observations', 'stu-1', 'r-x', false);
        $this->assertSame(['ok' => true, 'checked' => 4, 'unprotected' => 0, 'brokenAt' => null], NurturingAudit::verifyChain());

        $ids = DB::table('nurturing_access_logs')->orderBy('id')->pluck('id')->all();

        // تغییر یک ردیف
        DB::table('nurturing_access_logs')->where('id', $ids[1])->update(['student_id' => 'stu-2']);
        $res = NurturingAudit::verifyChain();
        $this->assertFalse($res['ok']);
        $this->assertSame($ids[1], $res['brokenAt']);
        DB::table('nurturing_access_logs')->where('id', $ids[1])->update(['student_id' => 'stu-1']);
        $this->assertTrue(NurturingAudit::verifyChain()['ok']);

        // حذف یک ردیف میانی
        DB::table('nurturing_access_logs')->where('id', $ids[2])->delete();
        $this->assertFalse(NurturingAudit::verifyChain()['ok']);
    }

    public function test_review_endpoint_reports_integrity(): void
    {
        $vice = $this->nurturing('vice_nurturing');
        config(['app.require_password_reconfirm_nurturing' => false]);

        $this->actingAs($vice)->getJson('/api/nurturing-audit')->assertOk()->assertJsonPath('integrity.ok', true);
    }

    // ---------- رمز عبور ----------

    public function test_short_password_forces_change_for_coach_but_not_teacher(): void
    {
        $coach = $this->makeUser('coach', ['password' => \Illuminate\Support\Facades\Hash::make('Short-Pass1')]); // ۱۱ کاراکتر
        $teacher = $this->makeUser('teacher', ['password' => \Illuminate\Support\Facades\Hash::make('Short-Pass1')]);

        $this->enableTwoFactor($coach);
        $this->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Short-Pass1'])->assertOk();
        $this->assertSame(1, (int) DB::table('users')->where('id', $coach->id)->value('must_change_password'));

        $this->postJson('/api/auth/login', ['username' => $teacher->username, 'password' => 'Short-Pass1'])->assertOk();
        $this->assertSame(0, (int) DB::table('users')->where('id', $teacher->id)->value('must_change_password'));
    }

    public function test_profile_rejects_new_password_shorter_than_twelve_for_nurturing_roles(): void
    {
        $coach = $this->makeUser('coach');
        $teacher = $this->makeUser('teacher');

        $this->actingAs($coach)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Short-Pass-1', 'new_password_confirmation' => 'Short-Pass-1x',
        ])->assertStatus(422);
        $this->actingAs($coach)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Eleven-Pass', 'new_password_confirmation' => 'Eleven-Pass',
        ])->assertStatus(422)->assertJsonValidationErrors('new_password');
        $this->actingAs($coach)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Twelve-Pass-9', 'new_password_confirmation' => 'Twelve-Pass-9',
        ])->assertOk();

        $this->actingAs($teacher)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Abc-123456', 'new_password_confirmation' => 'Abc-123456',
        ])->assertOk();
    }
}
