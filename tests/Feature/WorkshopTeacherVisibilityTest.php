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
}
