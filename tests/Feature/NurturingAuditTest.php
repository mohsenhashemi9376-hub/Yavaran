<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class NurturingAuditTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->makeClass('cls-mine');
        $this->makeClass('cls-other');
        $this->makeStudent('stu-mine', 'cls-mine');
        $this->makeStudent('stu-other', 'cls-other');
    }

    private function vice(): User
    {
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);

        return $vice;
    }

    private function coach(): User
    {
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-mine']]);
        $this->enableTwoFactor($coach);

        return $coach;
    }

    private function sync(User $user, string $collection, array $upserts = [], array $deletes = [])
    {
        return $this->actingAs($user)->postJson('/api/sync', compact('collection', 'upserts', 'deletes'));
    }

    private function dossierPayload(string $sid, string $note = 'n'): array
    {
        return ['id' => $sid, 'data' => ['id' => $sid, 'studentId' => $sid, 'note' => $note]];
    }

    public function test_create_update_delete_are_logged_with_one_row_each(): void
    {
        $coach = $this->coach();

        $this->sync($coach, 'nurturingDossiers', [$this->dossierPayload('stu-mine')])->assertOk();
        $this->sync($coach, 'nurturingDossiers', [$this->dossierPayload('stu-mine', 'changed')])->assertOk();
        $this->sync($coach, 'nurturingDossiers', [], ['stu-mine'])->assertOk();

        $actions = DB::table('nurturing_access_logs')->where('student_id', 'stu-mine')->orderBy('id')->pluck('action')->all();

        $this->assertSame(['create', 'update', 'delete'], $actions);
    }

    public function test_denied_write_is_logged_as_not_allowed_and_nothing_is_stored(): void
    {
        $coach = $this->coach();

        $this->sync($coach, 'nurturingDossiers', [$this->dossierPayload('stu-other')])->assertForbidden();

        $row = DB::table('nurturing_access_logs')->where('student_id', 'stu-other')->first();
        $this->assertNotNull($row);
        $this->assertSame(0, (int) $row->allowed);
        $this->assertSame(0, DB::table('nurturing_dossiers')->count());
    }

    public function test_teacher_write_attempt_is_rejected_with_403(): void
    {
        $teacher = $this->makeUser('teacher', [], ['assignedClassIds' => ['cls-mine']]);

        $this->sync($teacher, 'nurturingDossiers', [$this->dossierPayload('stu-mine')])->assertForbidden();
        $this->sync($teacher, 'observations', [['id' => 'o1', 'data' => ['id' => 'o1', 'studentId' => 'stu-mine', 'date' => '1405/07/10']]])->assertForbidden();
        $this->assertSame(0, DB::table('nurturing_dossiers')->count());
        $this->assertSame(0, DB::table('student_observations')->count());
    }

    public function test_log_row_records_actor_ip_and_user_agent(): void
    {
        $coach = $this->coach();

        $this->actingAs($coach)->withHeader('User-Agent', 'PHPUnit-Agent')->postJson('/api/sync', [
            'collection' => 'nurturingDossiers', 'upserts' => [$this->dossierPayload('stu-mine')], 'deletes' => [],
        ])->assertOk();

        $row = DB::table('nurturing_access_logs')->first();
        $this->assertSame($coach->id, $row->user_id);
        $this->assertSame('coach', $row->user_role);
        $this->assertSame('nurturingDossiers', $row->collection);
        $this->assertSame('PHPUnit-Agent', $row->user_agent);
        $this->assertNotEmpty($row->ip);
    }

    public function test_bulk_list_reads_are_logged_once_per_window(): void
    {
        $vice = $this->vice();

        $this->actingAs($vice)->getJson('/api/bootstrap')->assertOk();
        $this->actingAs($vice)->getJson('/api/bootstrap')->assertOk();

        $this->assertSame(3, DB::table('nurturing_access_logs')->where('action', 'list')->where('user_id', $vice->id)->count());
    }

    public function test_viewer_is_available_to_vice_nurturing_only(): void
    {
        $this->sync($this->coach(), 'nurturingDossiers', [$this->dossierPayload('stu-mine')])->assertOk();

        $response = $this->actingAs($this->vice())->getJson('/api/nurturing-audit')->assertOk();
        $this->assertNotEmpty($response->json('logs'));
        $this->assertSame('create', $response->json('logs.0.action'));
        $this->assertSame('stu-mine', $response->json('logs.0.studentId'));
        $this->assertNotEmpty($response->json('logs.0.studentName'));

        foreach (['coach', 'teacher', 'admin', 'vice_educational', 'vice_disciplinary'] as $role) {
            $user = $this->makeUser($role);
            $this->enableTwoFactor($user);
            $this->actingAs($user)->getJson('/api/nurturing-audit')->assertForbidden();
        }
    }

    public function test_viewer_requires_two_factor_for_vice(): void
    {
        $vice = $this->makeUser('vice_nurturing');

        $this->actingAs($vice)->getJson('/api/nurturing-audit')->assertForbidden();
    }

    public function test_viewer_requires_login(): void
    {
        $this->getJson('/api/nurturing-audit')->assertUnauthorized();
    }

    public function test_log_cannot_be_modified_through_the_api(): void
    {
        $vice = $this->vice();

        foreach (['delete', 'put', 'patch', 'post'] as $method) {
            $status = $this->actingAs($vice)->json(strtoupper($method), '/api/nurturing-audit')->getStatusCode();
            $this->assertContains($status, [404, 405], $method);
        }
    }

    public function test_logging_failure_is_swallowed(): void
    {
        // کاربر بدون شناسه ← نقض NOT NULL در دیتابیس؛ ثبت لاگ نباید استثنا پرتاب کند
        \App\Support\NurturingAudit::log(new User, 'view', 'nurturingDossiers', 'stu-mine');

        $this->assertSame(0, DB::table('nurturing_access_logs')->count());
    }
}
