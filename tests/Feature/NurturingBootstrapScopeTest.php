<?php

namespace Tests\Feature;

use App\Models\CoachEvaluation;
use App\Models\StudentObservation;
use Tests\TestCase;

class NurturingBootstrapScopeTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->makeClass('cls-mine');
        $this->makeClass('cls-other');
        $this->makeStudent('stu-mine', 'cls-mine');
        $this->makeStudent('stu-other', 'cls-other');
        $this->makeDossier('stu-mine', ['note' => 'MINE']);
        $this->makeDossier('stu-other', ['note' => 'OTHER']);

        foreach (['stu-mine', 'stu-other'] as $sid) {
            (new StudentObservation)->forceFill([
                'id' => 'obs-'.$sid, 'student_id' => $sid, 'record_date' => '1405/07/10', 'sort_order' => 0,
                'author_id' => 'coach-writer', 'author_role' => 'coach',
                'data' => json_encode(['id' => 'obs-'.$sid, 'studentId' => $sid, 'text' => 'OBS-'.$sid]),
            ])->save();
            (new CoachEvaluation)->forceFill([
                'id' => 'ev-'.$sid, 'student_id' => $sid, 'coach_id' => 'c', 'sort_order' => 0,
                'data' => json_encode(['id' => 'ev-'.$sid, 'studentId' => $sid, 'text' => 'EV-'.$sid]),
            ])->save();
        }
    }

    /** @return array<string, mixed> */
    private function bootstrapAs(\App\Models\User $user): array
    {
        return $this->actingAs($user)->getJson('/api/bootstrap')->assertOk()->json('data');
    }

    private function ids(array $rows, string $key = 'studentId'): array
    {
        $ids = array_map(fn ($r) => $r[$key] ?? $r['id'], $rows);
        sort($ids);

        return $ids;
    }

    public function test_vice_nurturing_receives_all_decrypted_records(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);

        $data = $this->bootstrapAs($vice);

        $this->assertSame(['stu-mine', 'stu-other'], $this->ids($data['nurturingDossiers']));
        $this->assertSame(['stu-mine', 'stu-other'], $this->ids($data['observations']));
        $this->assertSame(['stu-mine', 'stu-other'], $this->ids($data['coachEvaluations']));
        $this->assertContains('MINE', array_column($data['nurturingDossiers'], 'note'));
    }

    public function test_coach_receives_only_assigned_class_records(): void
    {
        $coach = $this->makeUser('coach', ['id' => 'coach-writer'], ['assignedClassIds' => ['cls-mine']]);
        $this->enableTwoFactor($coach);

        $data = $this->bootstrapAs($coach);

        $this->assertSame(['stu-mine'], $this->ids($data['nurturingDossiers']));
        $this->assertSame(['stu-mine'], $this->ids($data['observations']));
        $this->assertSame(['stu-mine'], $this->ids($data['coachEvaluations']));
    }

    public function test_coach_without_two_factor_receives_nothing(): void
    {
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-mine']]);

        $response = $this->actingAs($coach)->getJson('/api/bootstrap')->assertOk();

        $this->assertSame([], $response->json('data.nurturingDossiers'));
        $this->assertSame([], $response->json('data.observations'));
        $this->assertTrue($response->json('security.twoFactorRequired'));
        $this->assertFalse($response->json('security.twoFactorEnabled'));
    }

    public function test_teacher_admin_and_other_vices_receive_nothing(): void
    {
        foreach (['teacher', 'admin', 'vice_educational', 'vice_disciplinary', 'vice_principal'] as $role) {
            $user = $this->makeUser($role, [], ['assignedClassIds' => ['cls-mine']]);
            $this->enableTwoFactor($user);

            $data = $this->bootstrapAs($user);

            foreach (['nurturingDossiers', 'observations', 'coachEvaluations'] as $collection) {
                $this->assertSame([], $data[$collection], "$role $collection");
            }
        }
    }

    public function test_no_secret_text_reaches_unauthorized_response_body(): void
    {
        $teacher = $this->makeUser('teacher', [], ['assignedClassIds' => ['cls-mine']]);

        $body = $this->actingAs($teacher)->getJson('/api/bootstrap')->getContent();

        foreach (['MINE', 'OTHER', 'OBS-stu', 'EV-stu'] as $needle) {
            $this->assertStringNotContainsString($needle, $body);
        }
    }

    public function test_security_flags_reflect_enrollment(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);
        $teacher = $this->makeUser('teacher');

        $this->actingAs($vice)->getJson('/api/bootstrap')
            ->assertJsonPath('security.twoFactorEnabled', true)
            ->assertJsonPath('security.twoFactorRequired', true);
        $this->actingAs($teacher)->getJson('/api/bootstrap')
            ->assertJsonPath('security.twoFactorEnabled', false)
            ->assertJsonPath('security.twoFactorRequired', false);
    }
}
