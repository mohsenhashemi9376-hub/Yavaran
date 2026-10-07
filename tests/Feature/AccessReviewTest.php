<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** بازبینی حساب‌های دارای دسترسی به پرونده‌های تربیتی */
class AccessReviewTest extends TestCase
{
    private User $vice;

    protected function setUp(): void
    {
        parent::setUp();

        $this->vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($this->vice);
        $this->makeClass('cls-1', ['name' => 'هفتم الف']);
        $this->makeClass('cls-2', ['name' => 'هشتم ب']);
    }

    private function review()
    {
        return $this->actingAs($this->vice)->getJson('/api/nurturing-audit/review');
    }

    private function account(array $accounts, string $id): array
    {
        return collect($accounts)->firstWhere('id', $id);
    }

    private function seenToday(User $user): void
    {
        DB::table('login_devices')->insert([
            'user_id' => $user->id, 'ua_hash' => hash('sha256', $user->id), 'ip' => '127.0.0.1', 'user_agent' => 'x',
            'first_seen_at' => now(), 'last_seen_at' => now(),
        ]);
    }

    public function test_lists_only_coaches_and_vice_nurturing_accounts(): void
    {
        $coach = $this->makeUser('coach');
        $this->makeUser('teacher');
        $this->makeUser('admin');

        $ids = collect($this->review()->assertOk()->json('accounts'))->pluck('id')->all();

        $this->assertEqualsCanonicalizing([$this->vice->id, $coach->id], $ids);
    }

    public function test_shows_classes_two_factor_login_and_access_counts(): void
    {
        $this->makeStudent('stu-1', 'cls-1');
        $this->makeDossier('stu-1');
        $coach = $this->makeUser('coach', ['name' => 'مربی الف'], ['assignedClassIds' => ['cls-1']]);
        $this->enableTwoFactor($coach);
        $this->enableTwoFactor($coach);
        DB::table('login_devices')->insert([
            'user_id' => $coach->id, 'ua_hash' => 'h', 'ip' => '1.1.1.1', 'user_agent' => 'x',
            'first_seen_at' => now()->subDay(), 'last_seen_at' => now()->subHour(),
        ]);
        $this->actingAs($coach)->getJson('/api/students/stu-1/nurturing-record')->assertOk();
        $this->actingAs($coach)->getJson('/api/students/stu-1/nurturing-record')->assertOk();

        $a = $this->account($this->review()->assertOk()->json('accounts'), $coach->id);

        $this->assertSame('مربی الف', $a['name']);
        $this->assertSame(['هفتم الف'], $a['classes']);
        $this->assertTrue($a['twoFactor']);
        $this->assertTrue($a['isActive']);
        $this->assertSame(2, $a['views30']);
        $this->assertNotNull($a['lastLoginAt']);
        $this->assertNotNull($a['lastAccessAt']);
        $this->assertFalse($a['inactive30']);
    }

    public function test_counts_denied_attempts_and_alerts(): void
    {
        $this->makeStudent('stu-2', 'cls-2');
        $this->makeDossier('stu-2');
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-1']]);
        $this->enableTwoFactor($coach);
        $this->actingAs($coach)->getJson('/api/students/stu-2/nurturing-record')->assertForbidden();
        $this->actingAs($coach)->getJson('/api/students/stu-2/nurturing-record')->assertForbidden();
        DB::table('nurturing_access_logs')->insert([
            'user_id' => $coach->id, 'user_role' => 'coach', 'action' => 'alert', 'collection' => 'security',
            'record_id' => 'new_device', 'allowed' => 0, 'created_at' => now(),
        ]);

        $a = $this->account($this->review()->json('accounts'), $coach->id);

        $this->assertSame(2, $a['denied30']);
        $this->assertSame(1, $a['alerts30']);
        $this->assertSame(0, $a['views30']);
    }

    public function test_flags_accounts_without_recent_login(): void
    {
        $never = $this->makeUser('coach');
        $old = $this->makeUser('coach');
        $recent = $this->makeUser('coach');
        $inactive = $this->makeUser('coach', ['is_active' => false]);
        DB::table('login_devices')->insert([
            'user_id' => $old->id, 'ua_hash' => 'h', 'ip' => '1.1.1.1', 'user_agent' => 'x',
            'first_seen_at' => now()->subDays(90), 'last_seen_at' => now()->subDays(45),
        ]);
        $this->seenToday($recent);

        $accounts = $this->review()->json('accounts');

        $this->assertTrue($this->account($accounts, $never->id)['inactive30']);
        $this->assertTrue($this->account($accounts, $old->id)['inactive30']);
        $this->assertFalse($this->account($accounts, $recent->id)['inactive30']);
        $this->assertFalse($this->account($accounts, $inactive->id)['inactive30']);
        $this->assertFalse($this->account($accounts, $inactive->id)['isActive']);
    }

    public function test_flags_coach_without_two_factor_and_lists_no_classes(): void
    {
        $coach = $this->makeUser('coach');

        $a = $this->account($this->review()->json('accounts'), $coach->id);

        $this->assertFalse($a['twoFactor']);
        $this->assertSame([], $a['classes']);
    }

    public function test_class_assignment_through_class_record_is_shown(): void
    {
        $coach = $this->makeUser('coach', ['id' => 'coach-z']);
        DB::table('school_classes')->where('id', 'cls-2')->update(['data' => json_encode(['id' => 'cls-2', 'name' => 'هشتم ب', 'coachIds' => ['coach-z']])]);

        $a = $this->account($this->review()->json('accounts'), $coach->id);

        $this->assertSame(['هشتم ب'], $a['classes']);
    }

    public function test_only_vice_nurturing_with_two_factor_may_review(): void
    {
        foreach (['coach', 'teacher', 'admin', 'vice_educational', 'vice_disciplinary', 'vice_principal'] as $role) {
            $user = $this->makeUser($role);
            $this->enableTwoFactor($user);
            $this->actingAs($user)->getJson('/api/nurturing-audit/review')->assertForbidden();
        }

        $noTwoFactor = $this->makeUser('vice_nurturing');
        $this->actingAs($noTwoFactor)->getJson('/api/nurturing-audit/review')->assertForbidden();
        $this->getJson('/api/nurturing-audit/review')->assertStatus(403);
    }

    public function test_requires_login(): void
    {
        $this->app['auth']->guard('web')->logout();
        $this->app['session.store']->flush();

        $this->getJson('/api/nurturing-audit/review')->assertUnauthorized();
    }

    public function test_review_requires_fresh_password_confirmation_when_enabled(): void
    {
        config(['app.require_password_reconfirm_nurturing' => true]);

        $this->review()->assertForbidden();
        $this->actingAs($this->vice)->postJson('/api/auth/confirm-password', ['password' => 'Str0ng-Pass!'])->assertOk();
        $this->review()->assertOk();
    }
}
