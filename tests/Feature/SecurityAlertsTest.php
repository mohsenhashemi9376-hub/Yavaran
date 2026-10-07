<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** هشدارهای امنیتی برای معاون تربیتی */
class SecurityAlertsTest extends TestCase
{
    private User $vice;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.require_two_factor_nurturing' => false]);
        $this->travelTo(Carbon::parse('2026-10-14 10:00', 'Asia/Tehran'));
        $this->vice = $this->makeUser('vice_nurturing', ['name' => 'معاون تربیتی']);
        $this->admin = $this->makeUser('admin', ['name' => 'مدیر']);
    }

    private function alertsFor(User $receiver)
    {
        return DB::table('notifications')->where('receiver_id', $receiver->id)->where('priority', 'urgent')->get();
    }

    private function login(User $user, string $agent = 'Browser-A', string $password = 'Str0ng-Pass!')
    {
        return $this->withHeader('User-Agent', $agent)->postJson('/api/auth/login', ['username' => $user->username, 'password' => $password]);
    }

    // ---------- تلاش ناموفق ----------

    public function test_five_failed_logins_for_a_coach_alert_the_vice_once(): void
    {
        $coach = $this->makeUser('coach', ['name' => 'مربی هدف']);

        for ($i = 0; $i < 4; $i++) {
            $this->login($coach, 'A', 'wrong')->assertStatus(422);
        }
        $this->assertCount(0, $this->alertsFor($this->vice));

        // پنجمین تلاش (ممکن است با محدودیت نرخ ورود ۴۲۹ شود؛ هشدار مستقل از آن است)
        $this->login($coach, 'A', 'wrong');
        $this->login($coach, 'A', 'wrong');

        $alerts = $this->alertsFor($this->vice);
        $this->assertCount(1, $alerts);
        $this->assertStringContainsString('مربی هدف', $alerts[0]->message);
        $this->assertSame('failed_logins', $alerts[0]->ref_id);
        $this->assertDatabaseHas('nurturing_access_logs', ['user_id' => $coach->id, 'action' => 'alert', 'record_id' => 'failed_logins']);
    }

    public function test_failed_logins_of_other_roles_or_unknown_users_do_not_alert(): void
    {
        $teacher = $this->makeUser('teacher');

        for ($i = 0; $i < 6; $i++) {
            $this->login($teacher, 'A', 'wrong');
            $this->postJson('/api/auth/login', ['username' => 'nobody', 'password' => 'x']);
        }

        $this->assertCount(0, $this->alertsFor($this->vice));
    }

    // ---------- دستگاه جدید ----------

    public function test_first_device_is_silent_but_a_new_device_alerts(): void
    {
        $coach = $this->makeUser('coach', ['name' => 'مربی']);

        $this->login($coach, 'Browser-A')->assertOk();
        $this->assertCount(0, $this->alertsFor($this->vice));
        $this->postJson('/api/auth/logout');

        $this->login($coach, 'Browser-A')->assertOk();
        $this->assertCount(0, $this->alertsFor($this->vice));
        $this->postJson('/api/auth/logout');

        $this->login($coach, 'Browser-B')->assertOk();
        $alerts = $this->alertsFor($this->vice);
        $this->assertCount(1, $alerts);
        $this->assertSame('new_device', $alerts[0]->ref_id);
        $this->assertStringContainsString('دستگاه', $alerts[0]->title);
    }

    public function test_devices_are_recorded_for_every_role_but_only_watched_roles_alert(): void
    {
        $teacher = $this->makeUser('teacher');

        $this->login($teacher, 'Browser-A')->assertOk();
        $this->postJson('/api/auth/logout');
        $this->login($teacher, 'Browser-B')->assertOk();

        $this->assertSame(2, DB::table('login_devices')->where('user_id', $teacher->id)->count());
        $this->assertCount(0, $this->alertsFor($this->vice));
    }

    public function test_vice_nurturing_new_device_alerts_the_admin_not_himself(): void
    {
        $this->login($this->vice, 'Browser-A')->assertOk();
        $this->postJson('/api/auth/logout');
        $this->login($this->vice, 'Browser-B')->assertOk();

        $this->assertCount(1, $this->alertsFor($this->admin));
        $this->assertCount(0, $this->alertsFor($this->vice));
    }

    // ---------- ساعت غیرمعمول ----------

    public function test_login_outside_school_hours_alerts_once_per_day(): void
    {
        $coach = $this->makeUser('coach');
        $this->login($coach, 'A')->assertOk();   // ساعت ۱۰ صبح: عادی
        $this->assertCount(0, $this->alertsFor($this->vice));
        $this->postJson('/api/auth/logout');

        $this->travelTo(Carbon::parse('2026-10-14 23:30', 'Asia/Tehran'));
        $this->login($coach, 'A')->assertOk();
        $this->postJson('/api/auth/logout');
        $this->login($coach, 'A')->assertOk();

        $alerts = $this->alertsFor($this->vice);
        $this->assertCount(1, $alerts);
        $this->assertSame('off_hours', $alerts[0]->ref_id);
    }

    public function test_early_morning_is_also_outside_hours(): void
    {
        $coach = $this->makeUser('coach');
        $this->travelTo(Carbon::parse('2026-10-14 03:00', 'Asia/Tehran'));

        $this->login($coach, 'A')->assertOk();

        $this->assertSame(['off_hours'], $this->alertsFor($this->vice)->pluck('ref_id')->all());
    }

    public function test_school_hours_are_configurable(): void
    {
        config(['app.nurturing_hours_start' => 11, 'app.nurturing_hours_end' => 12]);
        $coach = $this->makeUser('coach');

        $this->login($coach, 'A')->assertOk();   // ساعت ۱۰ ← خارج از بازه‌ی ۱۱–۱۲

        $this->assertSame(['off_hours'], $this->alertsFor($this->vice)->pluck('ref_id')->all());
    }

    // ---------- خواندن انبوه ----------

    public function test_opening_many_records_quickly_alerts_the_vice(): void
    {
        $this->makeClass('cls-1');
        $coach = $this->makeUser('coach', ['name' => 'مربی پرکار'], ['assignedClassIds' => ['cls-1']]);
        for ($i = 1; $i <= 16; $i++) {
            $this->makeStudent("stu-$i", 'cls-1');
            $this->makeDossier("stu-$i");
        }

        for ($i = 1; $i <= 14; $i++) {
            $this->actingAs($coach)->getJson("/api/students/stu-$i/nurturing-record")->assertOk();
        }
        $this->assertCount(0, $this->alertsFor($this->vice));

        $this->actingAs($coach)->getJson('/api/students/stu-15/nurturing-record')->assertOk();
        $this->actingAs($coach)->getJson('/api/students/stu-16/nurturing-record')->assertOk();

        $alerts = $this->alertsFor($this->vice);
        $this->assertCount(1, $alerts);
        $this->assertSame('bulk_read', $alerts[0]->ref_id);
        $this->assertStringContainsString('مربی پرکار', $alerts[0]->message);
    }

    public function test_repeated_views_of_the_same_student_do_not_count_as_bulk(): void
    {
        $this->makeClass('cls-1');
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-1']]);
        $this->makeStudent('stu-1', 'cls-1');
        $this->makeDossier('stu-1');

        for ($i = 0; $i < 20; $i++) {
            $this->actingAs($coach)->getJson('/api/students/stu-1/nurturing-record')->assertOk();
        }

        $this->assertCount(0, $this->alertsFor($this->vice));
    }

    public function test_views_spread_over_time_do_not_alert(): void
    {
        $this->makeClass('cls-1');
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-1']]);
        for ($i = 1; $i <= 16; $i++) {
            $this->makeStudent("stu-$i", 'cls-1');
            $this->makeDossier("stu-$i");
        }

        for ($i = 1; $i <= 16; $i++) {
            $this->actingAs($coach)->getJson("/api/students/stu-$i/nurturing-record")->assertOk();
            $this->travel(11)->minutes();
        }

        $this->assertCount(0, $this->alertsFor($this->vice));
    }

    // ---------- قفل شدن ----------

    public function test_two_factor_lockout_alerts_the_vice(): void
    {
        $coach = $this->makeUser('coach');
        $this->enableTwoFactor($coach);
        $this->login($coach, 'A')->assertOk();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/two-factor', ['code' => '000000'])->assertStatus(422);
        }
        $this->postJson('/api/auth/two-factor', ['code' => '000000'])->assertStatus(429);

        $this->assertSame(['lockout'], $this->alertsFor($this->vice)->pluck('ref_id')->all());
    }

    public function test_password_reconfirmation_lockout_alerts_the_vice(): void
    {
        $coach = $this->makeUser('coach');

        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($coach)->postJson('/api/auth/confirm-password', ['password' => 'wrong'])->assertStatus(422);
        }
        $this->actingAs($coach)->postJson('/api/auth/confirm-password', ['password' => 'wrong'])->assertStatus(429);

        $this->assertSame(['lockout'], $this->alertsFor($this->vice)->pluck('ref_id')->all());
    }

    // ---------- ثبت و نمایش ----------

    public function test_alerts_appear_in_the_audit_viewer(): void
    {
        $coach = $this->makeUser('coach', ['name' => 'مربی']);
        $this->login($coach, 'Browser-A')->assertOk();
        $this->postJson('/api/auth/logout');
        $this->login($coach, 'Browser-B')->assertOk();
        $this->postJson('/api/auth/logout');

        $this->enableTwoFactor($this->vice);
        $logs = $this->actingAs($this->vice)->getJson('/api/nurturing-audit')->assertOk()->json('logs');

        $alert = collect($logs)->firstWhere('action', 'alert');
        $this->assertNotNull($alert);
        $this->assertSame('new_device', $alert['recordId']);
        $this->assertSame($coach->id, $alert['userId']);
    }

    public function test_alert_failures_never_break_login(): void
    {
        $coach = $this->makeUser('coach');
        DB::table('users')->where('role', 'vice_nurturing')->delete(); // گیرنده‌ای وجود ندارد

        $this->login($coach, 'Browser-A')->assertOk();
        $this->postJson('/api/auth/logout');
        $this->login($coach, 'Browser-B')->assertOk();
    }
}
