<?php

namespace Tests\Feature;

use Tests\TestCase;

/** استاد/مربی مسئول کارگاه، کارگاه و فهرست اعضای آن را (حتی از کلاس‌های دیگر) می‌بیند */
class WorkshopTeacherVisibilityTest extends TestCase
{
    private function setup8th(string $role): array
    {
        $admin = $this->makeUser('admin');
        $leader = $this->makeUser($role);
        $this->actingAs($admin)->postJson('/api/sync', ['collection' => 'classes', 'deletes' => [], 'upserts' => [
            ['id' => 'c8', 'data' => ['id' => 'c8', 'name' => 'هشتم الف', 'grade' => 'هشتم']],
        ]])->assertOk();
        $this->actingAs($admin)->postJson('/api/sync', ['collection' => 'students', 'deletes' => [], 'upserts' => array_map(
            static fn ($id) => ['id' => $id, 'data' => ['id' => $id, 'classId' => 'c8', 'firstName' => $id, 'lastName' => 'تست', 'nationalId' => '0012345678']],
            ['s-in', 's-out'],
        )])->assertOk();

        $this->actingAs($admin)->postJson('/api/sync', [
            'collection' => 'workshops',
            'upserts' => [['id' => 'ws-ai', 'data' => [
                'id' => 'ws-ai', 'name' => 'هوش مصنوعی', 'category' => 'skill', 'gradeLevel' => 8,
                'teacherId' => $leader->id, 'teacherName' => $leader->name, 'studentIds' => ['s-in'],
            ]]],
            'deletes' => [],
        ])->assertOk();

        return [$leader];
    }

    private function bootstrap($user): array
    {
        return $this->actingAs($user)->getJson('/api/bootstrap')->assertOk()->json('data');
    }

    public function test_assigned_teacher_receives_workshop_and_only_its_members(): void
    {
        [$teacher] = $this->setup8th('teacher');
        $data = $this->bootstrap($teacher);

        $this->assertSame($teacher->id, collect($data['workshops'])->firstWhere('id', 'ws-ai')['teacherId'] ?? null);

        $students = collect($data['students']);
        $this->assertNotNull($students->firstWhere('id', 's-in'));
        $this->assertNull($students->firstWhere('id', 's-out'));
        $this->assertSame('', $students->firstWhere('id', 's-in')['nationalId']);
    }

    public function test_assigned_coach_gets_members_with_limited_fields_only(): void
    {
        [$coach] = $this->setup8th('coach');
        $data = $this->bootstrap($coach);

        $member = collect($data['students'])->firstWhere('id', 's-in');
        $this->assertNotNull($member);
        $this->assertSame('', $member['nationalId']);
        $this->assertNull(collect($data['students'])->firstWhere('id', 's-out'));
    }
    private function sessionPayload(string $teacherId): array
    {
        return ['collection' => 'sessions', 'deletes' => [], 'upserts' => [
            ['id' => 'sess-ws-1', 'data' => [
                'id' => 'sess-ws-1', 'classId' => 'ws-ai', 'teacherId' => $teacherId, 'teacherName' => 'استاد',
                'subject' => 'کارگاه مهارتی هوش مصنوعی', 'date' => '1405/07/20', 'dayOfWeek' => 'شنبه',
                'periodNumber' => 1, 'lessonTopic' => 'مقدمه', 'homeworkDescription' => 'تمرین ۱',
                'records' => ['s-in' => ['studentId' => 's-in', 'status' => 'present']],
                'createdAt' => '2026-10-12T00:00:00Z', 'updatedAt' => '2026-10-12T00:00:00Z',
            ]],
        ]];
    }

    public function test_workshop_teacher_can_record_a_session_like_a_regular_class(): void
    {
        [$teacher] = $this->setup8th('teacher');

        $this->actingAs($teacher)->postJson('/api/sync', $this->sessionPayload($teacher->id))->assertOk();

        $data = $this->bootstrap($teacher);
        $this->assertSame('مقدمه', collect($data['sessions'])->firstWhere('id', 'sess-ws-1')['lessonTopic'] ?? null);
    }

    public function test_other_teacher_cannot_record_a_session_for_the_workshop(): void
    {
        [$teacher] = $this->setup8th('teacher');
        $other = $this->makeUser('teacher');

        $this->actingAs($other)->postJson('/api/sync', $this->sessionPayload($other->id))->assertStatus(403);
    }
}
