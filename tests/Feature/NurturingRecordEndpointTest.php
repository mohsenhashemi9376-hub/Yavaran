<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class NurturingRecordEndpointTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->makeClass('cls-mine');
        $this->makeClass('cls-other');
        $this->makeStudent('stu-mine', 'cls-mine');
        $this->makeStudent('stu-other', 'cls-other');
        $this->makeDossier('stu-mine');
        $this->makeDossier('stu-other', ['note' => 'پرونده کلاس دیگر']);
    }

    private function coach(): \App\Models\User
    {
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-mine']]);
        $this->enableTwoFactor($coach);

        return $coach;
    }

    private function url(string $studentId): string
    {
        return "/api/students/{$studentId}/nurturing-record";
    }

    public function test_guest_gets_401(): void
    {
        $this->getJson($this->url('stu-mine'))->assertUnauthorized();
    }

    public function test_coach_reads_own_class_record_decrypted(): void
    {
        $this->actingAs($this->coach())->getJson($this->url('stu-mine'))
            ->assertOk()
            ->assertJsonPath('data.studentId', 'stu-mine')
            ->assertJsonPath('data.record.note', 'یادداشت بسیار محرمانه');
    }

    public function test_coach_gets_403_for_other_class_and_no_content_is_leaked(): void
    {
        $response = $this->actingAs($this->coach())->getJson($this->url('stu-other'));

        $response->assertForbidden();
        $this->assertStringNotContainsString('پرونده کلاس دیگر', $response->getContent());
    }

    public function test_vice_nurturing_reads_any_record(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);

        $this->actingAs($vice)->getJson($this->url('stu-other'))->assertOk()->assertJsonPath('data.record.note', 'پرونده کلاس دیگر');
    }

    public function test_admin_teacher_and_other_vices_get_403(): void
    {
        foreach (['admin', 'teacher', 'vice_educational', 'vice_disciplinary', 'vice_principal'] as $role) {
            $user = $this->makeUser($role, [], ['assignedClassIds' => ['cls-mine']]);
            $this->enableTwoFactor($user);

            $this->actingAs($user)->getJson($this->url('stu-mine'))->assertForbidden();
        }
    }

    public function test_missing_dossier_is_404_for_authorized_user_but_403_for_unauthorized(): void
    {
        $this->makeStudent('stu-empty', 'cls-mine');
        $this->makeStudent('stu-empty-other', 'cls-other');

        $this->actingAs($this->coach())->getJson($this->url('stu-empty'))->assertNotFound();
        // عدم دسترسی مقدم است: کسی نمی‌تواند وجود/عدم وجود پرونده کلاس دیگر را حدس بزند
        $this->actingAs($this->coach())->getJson($this->url('stu-empty-other'))->assertForbidden();
    }

    public function test_unknown_student_is_404(): void
    {
        $this->actingAs($this->coach())->getJson($this->url('nope'))->assertNotFound();
    }

    public function test_coach_without_two_factor_is_forbidden(): void
    {
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-mine']]);

        $this->actingAs($coach)->getJson($this->url('stu-mine'))->assertForbidden();
    }

    public function test_user_who_must_change_password_is_blocked(): void
    {
        $coach = $this->coach();
        DB::table('users')->where('id', $coach->id)->update(['must_change_password' => true]);
        $coach->refresh();

        $this->actingAs($coach)->getJson($this->url('stu-mine'))
            ->assertForbidden()
            ->assertJsonPath('mustChangePassword', true);
    }

    public function test_response_is_not_cacheable(): void
    {
        $response = $this->actingAs($this->coach())->getJson($this->url('stu-mine'));

        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }

    public function test_successful_view_and_denied_attempt_are_audited(): void
    {
        $coach = $this->coach();

        $this->actingAs($coach)->getJson($this->url('stu-mine'))->assertOk();
        $this->actingAs($coach)->getJson($this->url('stu-other'))->assertForbidden();

        $ok = DB::table('nurturing_access_logs')->where('student_id', 'stu-mine')->first();
        $denied = DB::table('nurturing_access_logs')->where('student_id', 'stu-other')->first();

        $this->assertNotNull($ok);
        $this->assertSame('view', $ok->action);
        $this->assertSame($coach->id, $ok->user_id);
        $this->assertSame('coach', $ok->user_role);
        $this->assertSame(1, (int) $ok->allowed);
        $this->assertNotNull($denied);
        $this->assertSame(0, (int) $denied->allowed);
    }
}
