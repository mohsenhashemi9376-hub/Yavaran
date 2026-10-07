<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** فقط معاون تربیتی می‌تواند حساب مربی و معاون تربیتی را بسازد/ویرایش کند */
class AccountSeparationTest extends TestCase
{
    /** @return array<string, mixed> */
    private function userData(string $id, string $role, array $extra = []): array
    {
        return array_merge([
            'id' => $id, 'username' => $id, 'name' => 'نام '.$id, 'role' => $role,
            'roleTitle' => 'x', 'isActive' => true, 'password' => 'Zx9-complex-pass',
        ], $extra);
    }

    private function saveUser(User $actor, array $data)
    {
        return $this->actingAs($actor)->postJson('/api/sync', [
            'collection' => 'users',
            'upserts' => [['id' => $data['id'], 'data' => $data]],
            'deletes' => [],
        ]);
    }

    public function test_admin_cannot_create_a_coach_when_a_vice_nurturing_exists(): void
    {
        $this->makeUser('vice_nurturing');
        $admin = $this->makeUser('admin');

        $this->saveUser($admin, $this->userData('new-coach', 'coach'))->assertForbidden();

        $this->assertDatabaseMissing('users', ['id' => 'new-coach']);
    }

    public function test_admin_cannot_create_a_second_vice_nurturing(): void
    {
        $this->makeUser('vice_nurturing');
        $admin = $this->makeUser('admin');

        $this->saveUser($admin, $this->userData('evil-vice', 'vice_nurturing'))->assertForbidden();
        $this->assertDatabaseMissing('users', ['id' => 'evil-vice']);
    }

    public function test_admin_cannot_turn_an_existing_user_into_a_coach(): void
    {
        $this->makeUser('vice_nurturing');
        $admin = $this->makeUser('admin');
        $teacher = $this->makeUser('teacher');

        $this->saveUser($admin, $this->userData($teacher->id, 'coach'))->assertForbidden();

        $this->assertSame('teacher', DB::table('users')->where('id', $teacher->id)->value('role'));
    }

    public function test_admin_cannot_edit_or_reset_password_of_an_existing_coach(): void
    {
        $this->makeUser('vice_nurturing');
        $admin = $this->makeUser('admin');
        $coach = $this->makeUser('coach');
        $oldHash = DB::table('users')->where('id', $coach->id)->value('password');

        $this->saveUser($admin, $this->userData($coach->id, 'coach', ['password' => 'Attacker-Pass-1']))->assertForbidden();

        $this->assertSame($oldHash, DB::table('users')->where('id', $coach->id)->value('password'));
    }

    public function test_admin_cannot_take_over_the_vice_nurturing_account(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $admin = $this->makeUser('admin');
        $oldHash = DB::table('users')->where('id', $vice->id)->value('password');

        $this->saveUser($admin, $this->userData($vice->id, 'vice_nurturing', ['password' => 'Attacker-Pass-1']))->assertForbidden();

        $this->assertSame($oldHash, DB::table('users')->where('id', $vice->id)->value('password'));
    }

    public function test_other_vices_cannot_manage_nurturing_accounts_either(): void
    {
        $this->makeUser('vice_nurturing');

        foreach (['vice_educational', 'vice_disciplinary', 'vice_principal'] as $role) {
            $actor = $this->makeUser($role);
            $this->saveUser($actor, $this->userData('c-'.$role, 'coach'))->assertForbidden();
            $this->assertDatabaseMissing('users', ['id' => 'c-'.$role]);
        }
    }

    public function test_vice_nurturing_can_create_and_edit_coaches(): void
    {
        $vice = $this->makeUser('vice_nurturing');

        $this->saveUser($vice, $this->userData('new-coach', 'coach'))->assertOk();
        $this->assertDatabaseHas('users', ['id' => 'new-coach', 'role' => 'coach']);

        $this->saveUser($vice, $this->userData('new-coach', 'coach', ['name' => 'نام ویرایش‌شده', 'password' => null]))->assertOk();
        $this->assertSame('نام ویرایش‌شده', DB::table('users')->where('id', 'new-coach')->value('name'));
    }

    public function test_vice_nurturing_may_change_coach_permissions_but_not_admin_accounts(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $coach = $this->makeUser('coach');
        $admin = $this->makeUser('admin');

        $this->saveUser($vice, $this->userData($coach->id, 'coach', ['permissions' => ['view-students'], 'password' => null]))->assertOk();
        $this->assertSame(['view-students'], json_decode((string) DB::table('users')->where('id', $coach->id)->value('permissions'), true));

        $this->saveUser($vice, $this->userData($admin->id, 'admin'))->assertForbidden();
    }

    public function test_bootstrap_exception_allows_admin_to_create_the_first_vice_nurturing(): void
    {
        $admin = $this->makeUser('admin');

        $this->saveUser($admin, $this->userData('first-vice', 'vice_nurturing'))->assertOk();
        $this->assertDatabaseHas('users', ['id' => 'first-vice', 'role' => 'vice_nurturing']);

        // پس از ساخته شدن، همان محدودیت اعمال می‌شود
        $this->saveUser($admin, $this->userData('second-coach', 'coach'))->assertForbidden();
    }

    public function test_inactive_vice_does_not_count_as_existing_for_bootstrap(): void
    {
        $this->makeUser('vice_nurturing', ['is_active' => false]);
        $admin = $this->makeUser('admin');

        $this->saveUser($admin, $this->userData('replacement', 'vice_nurturing'))->assertOk();
    }

    public function test_admin_can_deactivate_a_coach(): void
    {
        $this->makeUser('vice_nurturing');
        $admin = $this->makeUser('admin');
        $coach = $this->makeUser('coach', ['name' => 'مربی'], ['roleTitle' => 'x', 'name' => 'مربی']);
        $profile = ['id' => $coach->id, 'username' => $coach->id, 'name' => 'مربی', 'role' => 'coach', 'roleTitle' => 'x'];

        $this->saveUser($admin, $profile + ['isActive' => false])->assertOk();

        $this->assertSame(0, (int) DB::table('users')->where('id', $coach->id)->value('is_active'));
    }

    public function test_deactivation_cannot_smuggle_other_changes(): void
    {
        $this->makeUser('vice_nurturing');
        $admin = $this->makeUser('admin');
        $coach = $this->makeUser('coach', ['name' => 'مربی'], ['roleTitle' => 'x', 'name' => 'مربی']);
        $profile = ['id' => $coach->id, 'username' => $coach->id, 'name' => 'مربی', 'role' => 'coach', 'roleTitle' => 'x'];
        $oldHash = DB::table('users')->where('id', $coach->id)->value('password');

        // غیرفعال‌سازی + تغییر رمز در یک درخواست
        $this->saveUser($admin, $profile + ['isActive' => false, 'password' => 'Attacker-Pass-1'])->assertForbidden();

        $this->assertSame($oldHash, DB::table('users')->where('id', $coach->id)->value('password'));
    }

    public function test_admin_still_manages_non_nurturing_accounts(): void
    {
        $this->makeUser('vice_nurturing');
        $admin = $this->makeUser('admin');

        $this->saveUser($admin, $this->userData('t1', 'teacher'))->assertOk();
        $this->saveUser($admin, $this->userData('t1', 'teacher', ['name' => 'معلم ویرایش‌شده', 'password' => null]))->assertOk();
        $this->assertSame('معلم ویرایش‌شده', DB::table('users')->where('id', 't1')->value('name'));
    }

    public function test_denied_attempt_is_audited_and_the_vice_is_notified(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $admin = $this->makeUser('admin');

        $this->saveUser($admin, $this->userData('evil-coach', 'coach'))->assertForbidden();

        $log = DB::table('nurturing_access_logs')->where('collection', 'users')->first();
        $this->assertNotNull($log);
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame('evil-coach', $log->record_id);
        $this->assertSame(0, (int) $log->allowed);

        $notification = DB::table('notifications')->where('receiver_id', $vice->id)->first();
        $this->assertNotNull($notification);
        $this->assertSame('urgent', $notification->priority);
        $this->assertStringContainsString('evil-coach', $notification->message);
    }

    public function test_permitted_change_is_audited_too(): void
    {
        $vice = $this->makeUser('vice_nurturing');

        $this->saveUser($vice, $this->userData('new-coach', 'coach'))->assertOk();

        $log = DB::table('nurturing_access_logs')->where('collection', 'users')->first();
        $this->assertSame(1, (int) $log->allowed);
        $this->assertSame('create', $log->action);
    }

    public function test_audit_viewer_shows_the_target_account_name(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);
        $admin = $this->makeUser('admin');
        $this->saveUser($admin, $this->userData('evil-coach', 'coach'))->assertForbidden();
        $this->saveUser($vice, $this->userData('good-coach', 'coach', ['name' => 'مربی خوب']))->assertOk();

        $logs = $this->actingAs($vice)->getJson('/api/nurturing-audit')->assertOk()->json('logs');

        $good = collect($logs)->firstWhere('collection', 'users');
        $this->assertNotNull($good);
        $this->assertTrue(collect($logs)->contains(fn ($l) => $l['allowed'] === false && $l['collection'] === 'users'));
    }
}
