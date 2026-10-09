<?php

namespace Tests\Feature;

use App\Http\Controllers\MentorMessageController;
use Illuminate\Support\Facades\DB;
use App\Models\StudentObservation;
use App\Support\NurturingCrypt;
use App\Support\Sync\NurturingEncryptor;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
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

    // ---------- مشاهده‌گری‌های قبلی مربی ----------

    public function test_coach_gets_back_legacy_and_out_of_scope_observations_he_wrote(): void
    {
        $this->makeClass('cls-1');
        $this->makeClass('cls-old');
        $this->makeStudent('stu-1', 'cls-1');
        $this->makeStudent('stu-old', 'cls-old');
        $coach = $this->makeUser('coach', ['name' => 'مربی یکتا'], ['assignedClassIds' => ['cls-1']]);
        $this->enableTwoFactor($coach);

        // مشاهده‌ی قدیمی بدون نویسنده (فقط recordedBy) و مشاهده‌ی خودش برای دانش‌آموز کلاس قبلی
        foreach (['legacy' => ['stu-1', null], 'mine-old-class' => ['stu-old', $coach->id], 'other' => ['stu-1', 'someone-else']] as $id => [$stu, $author]) {
            (new StudentObservation)->forceFill([
                'id' => $id, 'student_id' => $stu, 'record_date' => '1405/07/01', 'sort_order' => 0,
                'author_id' => $author, 'author_role' => $author ? 'coach' : null,
                'data' => json_encode(['id' => $id, 'studentId' => $stu, 'content' => 'x', 'recordedBy' => $id === 'other' ? 'دیگری' : 'مربی یکتا']),
            ])->save();
        }

        $ids = collect($this->actingAs($coach)->getJson('/api/bootstrap')->assertOk()->json('data.observations'))->pluck('id')->all();
        sort($ids);
        $this->assertSame(['legacy', 'mine-old-class'], $ids);
        $this->assertDatabaseHas('student_observations', ['id' => 'legacy', 'author_id' => $coach->id]);
    }

    // ---------- کلید اختصاصی ----------

    public function test_dedicated_key_encrypts_and_old_app_key_data_still_reads_until_rotation(): void
    {
        $legacy = \Illuminate\Support\Facades\Crypt::encryptString('قدیمی');
        config(['app.nurturing_key' => 'base64:'.base64_encode(random_bytes(32))]);
        NurturingCrypt::reset();

        $this->assertTrue(NurturingCrypt::usesDedicatedKey());
        $this->assertSame('قدیمی', NurturingCrypt::decryptString($legacy)); // APP_KEY همچنان به‌عنوان کلید قبلی خوانده می‌شود
        $this->assertFalse(NurturingCrypt::isCurrent($legacy));

        $new = NurturingCrypt::encryptString('جدید');
        $this->assertTrue(NurturingCrypt::isCurrent($new));
        $this->assertSame('جدید', NurturingCrypt::decryptString($new));
        // با APP_KEY تنها باز نمی‌شود
        $this->expectException(\Illuminate\Contracts\Encryption\DecryptException::class);
        \Illuminate\Support\Facades\Crypt::decryptString($new);
    }

    public function test_rotate_reencrypts_records_with_the_current_key(): void
    {
        $this->makeClass('cls-1');
        $this->makeStudent('stu-1', 'cls-1');
        $this->makeDossier('stu-1');
        $before = DB::table('nurturing_dossiers')->value('data');

        config(['app.nurturing_key' => 'base64:'.base64_encode(random_bytes(32))]);
        NurturingCrypt::reset();
        $this->assertSame(1, NurturingEncryptor::rotate());
        $this->assertSame(0, NurturingEncryptor::rotate());
        $this->assertNotSame($before, DB::table('nurturing_dossiers')->value('data'));
        $this->assertTrue(NurturingCrypt::isCurrent((string) DB::table('nurturing_dossiers')->value('data')));
    }

    // ---------- شبکه/ساعت، ایتا، زنجیره، پشتیبان ----------

    public function test_login_is_refused_from_networks_outside_the_allowlist(): void
    {
        config(['app.nurturing_allowed_ips' => '10.1.0.0/16', 'app.require_two_factor_nurturing' => false]);
        $coach = $this->makeUser('coach', ['password' => Hash::make('Str0ng-Pass!-long')]);

        $this->withServerVariables(['REMOTE_ADDR' => '8.8.8.8'])
            ->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!-long'])->assertStatus(403);
        $this->withServerVariables(['REMOTE_ADDR' => '10.1.2.3'])
            ->postJson('/api/auth/login', ['username' => $coach->username, 'password' => 'Str0ng-Pass!-long'])->assertOk();
    }

    public function test_security_alerts_are_sent_to_eitaa_without_student_data(): void
    {
        config(['app.eitaa_token' => 'TKN', 'app.eitaa_chat_id' => '@chan']);
        Http::fake(['*' => Http::response(['ok' => true], 200)]);
        $this->makeUser('vice_nurturing');
        $coach = $this->makeUser('coach');

        \App\Support\SecurityAlerts::lockout($coach, 'کد ورود دومرحله‌ای');

        Http::assertSent(fn ($r) => str_contains($r->url(), '/api/TKN/sendMessage') && $r['chat_id'] === '@chan' && str_contains($r['text'], $coach->name));
    }

    public function test_verify_audit_command_alerts_when_chain_is_tampered(): void
    {
        Http::fake();
        config(['app.eitaa_token' => 'TKN', 'app.eitaa_chat_id' => '@chan']);
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);
        \App\Support\NurturingAudit::log($vice, 'view', 'nurturingDossiers', 'stu-1', null, true);
        \App\Support\NurturingAudit::log($vice, 'view', 'nurturingDossiers', 'stu-2', null, true);

        $this->artisan('nurturing:verify-audit')->assertSuccessful();

        DB::table('nurturing_access_logs')->orderBy('id')->limit(1)->update(['student_id' => 'tampered']);
        $this->artisan('nurturing:verify-audit')->assertFailed();
        Http::assertSent(fn ($r) => str_contains($r['text'], 'دفتر دسترسی'));
    }

    public function test_encrypted_backup_is_written_and_unreadable_without_key(): void
    {
        config(['app.backup_key' => 'base64:'.base64_encode(random_bytes(32))]);
        $this->makeUser('teacher', ['name' => 'نام-در-پشتیبان']);

        $this->artisan('db:backup')->assertSuccessful();
        $files = glob(storage_path('app/backups/backup-*.enc'));
        $this->assertNotEmpty($files);
        $this->assertStringNotContainsString('نام-در-پشتیبان', (string) file_get_contents($files[0]));
        array_map('unlink', $files);
    }

    public function test_profile_change_needs_totp_for_nurturing_roles_and_alerts_vice(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $coach = $this->makeUser('coach', ['password' => Hash::make('Str0ng-Pass!-long')]);
        $secret = $this->enableTwoFactor($coach);
        $this->actingAs($coach);

        $body = ['current_password' => 'Str0ng-Pass!-long', 'new_password' => 'Another-Str0ng-Pass!', 'new_password_confirmation' => 'Another-Str0ng-Pass!'];
        $this->postJson('/api/profile', $body)->assertStatus(422)->assertJsonValidationErrors('code');
        $this->postJson('/api/profile', $body + ['code' => $this->currentTotp($secret)])->assertOk();
        $this->assertDatabaseHas('notifications', ['receiver_id' => $vice->id, 'ref_id' => 'credentials_changed']);
    }
}
