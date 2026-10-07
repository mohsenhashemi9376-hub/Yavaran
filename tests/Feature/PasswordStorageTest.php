<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** رمز عبور فقط به‌صورت هش یک‌طرفه ذخیره می‌شود و هرگز به کلاینت نمی‌رسد */
class PasswordStorageTest extends TestCase
{
    private const PLAIN = 'Zx9-complex-pass';

    private function createViaSync(User $actor, string $id = 'new-teacher')
    {
        return $this->actingAs($actor)->postJson('/api/sync', [
            'collection' => 'users',
            'upserts' => [['id' => $id, 'data' => [
                'id' => $id, 'username' => $id, 'name' => 'معلم جدید', 'role' => 'teacher', 'isActive' => true, 'password' => self::PLAIN,
            ]]],
            'deletes' => [],
        ]);
    }

    public function test_sync_stores_only_a_one_way_hash(): void
    {
        $this->createViaSync($this->makeUser('admin'))->assertOk();

        $row = DB::table('users')->where('id', 'new-teacher')->first();

        $this->assertTrue(password_verify(self::PLAIN, $row->password));
        $this->assertNull($row->password_encrypted);
        $this->assertStringNotContainsString(self::PLAIN, (string) $row->data);
        $this->assertStringNotContainsString(self::PLAIN, json_encode($row));
    }

    public function test_password_is_never_sent_to_the_client_even_for_admin(): void
    {
        $admin = $this->makeUser('admin');
        $this->createViaSync($admin)->assertOk();

        $body = $this->actingAs($admin)->getJson('/api/bootstrap')->assertOk()->getContent();

        $this->assertStringNotContainsString(self::PLAIN, $body);
        $this->assertStringNotContainsString('"password"', $body);
        $this->assertStringNotContainsString('password_encrypted', $body);
    }

    public function test_legacy_reversible_copy_is_not_exported_and_is_wiped_on_login(): void
    {
        $user = $this->makeUser('teacher', ['password_encrypted' => Crypt::encryptString('Str0ng-Pass!')]);
        $admin = $this->makeUser('admin');

        $body = $this->actingAs($admin)->getJson('/api/bootstrap')->getContent();
        $this->assertStringNotContainsString('Str0ng-Pass!', $body);

        $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'Str0ng-Pass!'])->assertOk();

        $this->assertNull(DB::table('users')->where('id', $user->id)->value('password_encrypted'));
    }

    public function test_resaving_a_user_with_the_same_password_wipes_legacy_copy(): void
    {
        $admin = $this->makeUser('admin');
        $this->createViaSync($admin)->assertOk();
        DB::table('users')->where('id', 'new-teacher')->update(['password_encrypted' => Crypt::encryptString(self::PLAIN)]);

        $this->createViaSync($admin)->assertOk();

        $this->assertNull(DB::table('users')->where('id', 'new-teacher')->value('password_encrypted'));
    }

    public function test_editing_without_a_password_keeps_the_existing_hash(): void
    {
        $admin = $this->makeUser('admin');
        $teacher = $this->makeUser('teacher', ['name' => 'قدیمی']);
        $hash = DB::table('users')->where('id', $teacher->id)->value('password');

        $this->actingAs($admin)->postJson('/api/sync', [
            'collection' => 'users',
            'upserts' => [['id' => $teacher->id, 'data' => ['id' => $teacher->id, 'username' => $teacher->id, 'name' => 'جدید', 'role' => 'teacher', 'isActive' => true]]],
            'deletes' => [],
        ])->assertOk();

        $this->assertSame($hash, DB::table('users')->where('id', $teacher->id)->value('password'));
        $this->assertSame('جدید', DB::table('users')->where('id', $teacher->id)->value('name'));
    }

    public function test_profile_password_change_stores_a_hash_and_no_reversible_copy(): void
    {
        $user = $this->makeUser('teacher');

        $this->actingAs($user)->postJson('/api/profile', [
            'current_password' => 'Str0ng-Pass!',
            'new_password' => 'Another-Str0ng-1',
            'new_password_confirmation' => 'Another-Str0ng-1',
        ])->assertOk();

        $row = DB::table('users')->where('id', $user->id)->first();
        $this->assertTrue(password_verify('Another-Str0ng-1', $row->password));
        $this->assertNull($row->password_encrypted);
    }

    public function test_login_still_works_with_the_hash(): void
    {
        $user = $this->makeUser('teacher');

        $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'Str0ng-Pass!'])
            ->assertOk()->assertJsonPath('success', true);
        $this->assertAuthenticatedAs($user);
    }

    public function test_wrong_password_is_rejected(): void
    {
        $user = $this->makeUser('teacher');

        $this->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'wrong'])->assertStatus(422);
        $this->assertGuest();
    }

    public function test_cleanup_migration_wipes_existing_reversible_copies(): void
    {
        $a = $this->makeUser('teacher', ['password_encrypted' => Crypt::encryptString('a')]);
        $b = $this->makeUser('coach', ['password_encrypted' => Crypt::encryptString('b')]);

        (require base_path('database/migrations/2026_10_15_000000_wipe_reversible_passwords.php'))->up();

        $this->assertNull(DB::table('users')->where('id', $a->id)->value('password_encrypted'));
        $this->assertNull(DB::table('users')->where('id', $b->id)->value('password_encrypted'));
    }
}
