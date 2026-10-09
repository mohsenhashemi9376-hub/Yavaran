<?php

namespace Tests\Feature;

use App\Http\Controllers\MentorMessageController;
use App\Support\Sync\NurturingEncryptor;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** سخت‌گیری‌های کم‌هزینه: رمزنگاری پیام مربیان، قفل نام کاربری، عمر نشست و سقف مشاهده‌ی پرونده */
class NurturingHardeningTest extends TestCase
{
    private const SECRET_TEXT = 'متن-محرمانه-پیام';

    public function test_mentor_messages_are_stored_encrypted_and_readable_by_the_coach(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $coach = $this->makeUser('coach');

        $this->actingAs($vice)->postJson('/api/mentor-messages', [
            'targetType' => 'all', 'priority' => 'normal', 'title' => 'عنوان-محرمانه', 'content' => self::SECRET_TEXT,
        ])->assertCreated();

        $raw = json_encode(DB::table('mentor_messages')->first(), JSON_UNESCAPED_UNICODE);
        $this->assertStringNotContainsString(self::SECRET_TEXT, $raw);
        $this->assertStringNotContainsString('عنوان-محرمانه', $raw);

        $this->actingAs($coach)->getJson('/api/mentor-messages/active')
            ->assertOk()
            ->assertJsonPath('messages.0.content', self::SECRET_TEXT)
            ->assertJsonPath('messages.0.title', 'عنوان-محرمانه');
    }

    public function test_legacy_plaintext_messages_still_readable_and_encryptor_converts_them(): void
    {
        DB::table('mentor_messages')->insert([
            'sender_id' => 'x', 'target_type' => 'all', 'priority' => 'normal',
            'title' => 'قدیمی', 'content' => self::SECRET_TEXT, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $row = DB::table('mentor_messages')->first();
        $this->assertSame(self::SECRET_TEXT, MentorMessageController::open($row->title, $row->content)['content']);

        $this->assertSame(1, NurturingEncryptor::run());
        $this->assertSame(0, NurturingEncryptor::run());
        $row = DB::table('mentor_messages')->first();
        $this->assertStringNotContainsString(self::SECRET_TEXT, $row->content);
        $this->assertSame('قدیمی', MentorMessageController::open($row->title, $row->content)['title']);
    }

    public function test_account_lock_cannot_be_bypassed_by_changing_ip(): void
    {
        $user = $this->makeUser('teacher', ['password' => Hash::make('Str0ng-Pass!-long')]);

        for ($i = 0; $i < 10; $i++) {
            $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.'.($i + 1)])
                ->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'wrong'])->assertStatus(422);
        }

        // IP جدید و رمز درست: همچنان قفل است
        $this->withServerVariables(['REMOTE_ADDR' => '10.9.9.9'])
            ->postJson('/api/auth/login', ['username' => $user->username, 'password' => 'Str0ng-Pass!-long'])->assertStatus(429);
    }

    public function test_nurturing_session_has_an_absolute_lifetime(): void
    {
        config(['app.nurturing_session_max_hours' => 14, 'app.require_two_factor_nurturing' => false]);
        $coach = $this->makeUser('coach', ['password' => Hash::make('Str0ng-Pass!-long')]);

        $this->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!-long'])->assertOk();
        $this->travel(13)->hours();
        $this->getJson('/api/bootstrap')->assertOk()->assertJsonPath('authenticated', true);

        $this->travel(2)->hours();
        $this->getJson('/api/bootstrap')->assertOk()->assertJsonPath('authenticated', false)->assertJsonPath('sessionExpired', true);
    }

    public function test_coach_is_blocked_after_opening_too_many_dossiers_quickly(): void
    {
        config(['app.nurturing_bulk_block_limit' => 3, 'app.require_password_reconfirm_nurturing' => false]);
        $this->makeClass('cls-1');
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-1']]);
        $this->enableTwoFactor($coach);
        foreach (['a', 'b', 'c', 'd'] as $id) {
            $this->makeStudent('stu-'.$id, 'cls-1');
            $this->makeDossier('stu-'.$id);
        }

        foreach (['a', 'b', 'c'] as $id) {
            $this->actingAs($coach)->getJson("/api/students/stu-$id/nurturing-record")->assertOk();
        }
        $this->actingAs($coach)->getJson('/api/students/stu-d/nurturing-record')->assertStatus(429);
    }
}
