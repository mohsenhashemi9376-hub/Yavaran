<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** معاونی که درس هم تدریس می‌کند، باید بتواند حضور و غیاب درس خودش را ثبت کند (نه کلاس‌های دیگر) */
class ViceTeachingAttendanceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->makeClass('cls-mine');
        $this->makeClass('cls-other');
        DB::table('academic_subjects')->insert([
            'id' => 'sub-golestan', 'name' => 'گلستان سعدی', 'code' => 'G', 'sort_order' => 0,
            'data' => json_encode(['id' => 'sub-golestan', 'name' => 'گلستان سعدی']), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function assign(string $userId): void
    {
        DB::table('course_assignments')->insert([
            'id' => 'ca-1', 'class_id' => 'cls-mine', 'subject_id' => 'sub-golestan', 'user_id' => $userId, 'sort_order' => 0,
            'data' => json_encode(['classId' => 'cls-mine', 'subjectId' => 'sub-golestan', 'teacherId' => $userId]), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function push($user, string $classId)
    {
        $id = 'sess-'.$classId;

        return $this->actingAs($user)->postJson('/api/sync', [
            'collection' => 'sessions',
            'upserts' => [['id' => $id, 'data' => [
                'id' => $id, 'classId' => $classId, 'teacherId' => $user->id, 'subject' => 'گلستان سعدی', 'subjectId' => 'sub-golestan',
                'date' => '1405/07/14', 'lessonTopic' => 'مبحث', 'periodNumber' => 1, 'records' => [],
            ]]],
            'deletes' => [],
        ]);
    }

    public function test_nurturing_vice_can_record_attendance_for_the_class_he_teaches(): void
    {
        $vice = $this->makeUser('vice_nurturing');
        $this->assign($vice->id);

        $this->push($vice, 'cls-mine')->assertOk();
    }

    public function test_explicit_permission_list_without_attendance_does_not_block_own_course(): void
    {
        $vice = $this->makeUser('vice_nurturing', ['permissions' => json_encode(['view-students', 'counseling-report'])]);
        $this->assign($vice->id);

        $this->push($vice, 'cls-mine')->assertOk();
    }

    public function test_explicit_permission_list_still_blocks_attendance_for_other_classes(): void
    {
        $vice = $this->makeUser('vice_nurturing', ['permissions' => json_encode(['view-students', 'counseling-report'])]);
        $this->assign($vice->id);

        $this->push($vice, 'cls-other')->assertForbidden();
    }
}
