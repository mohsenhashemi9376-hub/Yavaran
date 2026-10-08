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

    public function test_session_is_never_expired_automatically_but_sensitive_access_needs_password_after_six_hours(): void
    {
        config(['app.require_password_reconfirm_nurturing' => true, 'app.reauth_minutes' => 360]);
        $this->makeClass('cls-1');
        $this->makeStudent('stu-1', 'cls-1');
        $this->makeDossier('stu-1');
        $coach = $this->makeUser('coach', ['password' => \Illuminate\Support\Facades\Hash::make('Str0ng-Pass!-long')], ['assignedClassIds' => ['cls-1']]);
        $this->enableTwoFactor($coach);
        $this->fullLogin($coach);

        $this->travel(5)->hours();
        $this->getJson('/api/students/stu-1/nurturing-record')->assertOk();

        // ۶ ساعت بی‌فعالیتی: هنوز وارد است ولی برای پرونده‌ها رمز دوباره می‌خواهد
        $this->travel(361)->minutes();
        $this->getJson('/api/bootstrap')->assertOk()->assertJsonPath('authenticated', true);
        $this->getJson('/api/students/stu-1/nurturing-record')->assertForbidden();
        $this->postJson('/api/auth/confirm-password', ['password' => 'Str0ng-Pass!-long'])->assertOk();
        $this->getJson('/api/students/stu-1/nurturing-record')->assertOk();
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
        $coach = $this->makeUser('coach', ['password' => \Illuminate\Support\Facades\Hash::make('Abc-123')]); // ۷ کاراکتر
        $teacher = $this->makeUser('teacher', ['password' => \Illuminate\Support\Facades\Hash::make('Abc-123')]);

        $this->enableTwoFactor($coach);
        $this->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Abc-123'])->assertOk();
        $this->assertSame(1, (int) DB::table('users')->where('id', $coach->id)->value('must_change_password'));

        $this->postJson('/api/auth/login', ['username' => $teacher->username, 'password' => 'Abc-123'])->assertOk();
        $this->assertSame(0, (int) DB::table('users')->where('id', $teacher->id)->value('must_change_password'));
    }

    public function test_profile_rejects_new_password_shorter_than_eight_for_nurturing_roles(): void
    {
        $coach = $this->makeUser('coach');
        $teacher = $this->makeUser('teacher');

        $this->actingAs($coach)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Abc-123', 'new_password_confirmation' => 'Abc-123',
        ])->assertStatus(422)->assertJsonValidationErrors('new_password');
        $this->actingAs($coach)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Abc-1234', 'new_password_confirmation' => 'Abc-1234',
        ])->assertOk();

        $this->actingAs($teacher)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!', 'new_password' => 'Abc-12', 'new_password_confirmation' => 'Abc-12',
        ])->assertOk();
    }
}
