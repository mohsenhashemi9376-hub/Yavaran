<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * دبیر فقط نام دانش‌آموزان کلاس‌های خودش و سوابقی را می‌بیند که خودش ثبت کرده؛
 * نه مشخصات دانش‌آموز، نه موارد تربیتی و انضباطی، نه پرونده، نه اطلاعات حساب دیگران.
 */
class TeacherDataIsolationTest extends TestCase
{
    private User $teacher;

    private User $other;

    protected function setUp(): void
    {
        parent::setUp();

        $this->teacher = $this->makeUser('teacher', ['phone' => '09120000011'], []);
        $this->other = $this->makeUser('teacher', ['phone' => '09120000022']);

        $this->makeClass('cls-mine', ['teacherIds' => [$this->teacher->id], 'coachId' => 'someone', 'coachIds' => ['someone'], 'academicAdvisor' => 'مشاور']);
        $this->makeClass('cls-other', ['teacherIds' => [$this->other->id], 'grade' => 'نهم']);

        $this->rich('stu-mine', 'cls-mine');
        $this->rich('stu-other', 'cls-other');

        // موارد انضباطی
        foreach (['morning_delays' => 'd', 'school_absences' => 'a'] as $table => $p) {
            DB::table($table)->insert([
                'id' => $p.'-1', 'student_id' => 'stu-mine', 'class_id' => 'cls-mine', 'record_date' => '1405/07/10', 'sort_order' => 0,
                'data' => json_encode(['id' => $p.'-1', 'studentId' => 'stu-mine', 'classId' => 'cls-mine', 'date' => '1405/07/10', 'recordedBy' => 'معاون']),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        DB::table('morning_attendance')->insert([
            'id' => 'm-1', 'student_id' => 'stu-mine', 'class_id' => 'cls-mine', 'record_date' => '1405/07/10', 'status' => 'absent',
            'sort_order' => 0, 'data' => json_encode(['id' => 'm-1', 'studentId' => 'stu-mine', 'classId' => 'cls-mine', 'date' => '1405/07/10', 'status' => 'absent']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        // پرونده و مشاهده
        $this->makeDossier('stu-mine');
        (new \App\Models\StudentObservation)->forceFill([
            'id' => 'o-1', 'student_id' => 'stu-mine', 'record_date' => '1405/07/01', 'sort_order' => 0,
            'data' => json_encode(['id' => 'o-1', 'studentId' => 'stu-mine', 'content' => 'محرمانه']),
        ])->save();

        // درس‌ها و نمرات: دبیر فقط درس خودش را دارد
        foreach (['sub-mine' => $this->teacher->id, 'sub-other' => $this->other->id] as $id => $tid) {
            DB::table('academic_subjects')->insert([
                'id' => $id, 'name' => $id, 'code' => $id, 'sort_order' => 0,
                'data' => json_encode(['id' => $id, 'name' => $id, 'teacherId' => $tid, 'grade' => 'هشتم']), 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('academic_grades')->insert([
                'id' => 'g-'.$id, 'student_id' => 'stu-mine', 'class_id' => 'cls-mine', 'subject_id' => $id, 'sort_order' => 0,
                'data' => json_encode(['id' => 'g-'.$id, 'studentId' => 'stu-mine', 'classId' => 'cls-mine', 'subjectId' => $id]),
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        DB::table('course_assignments')->insert([
            'id' => 'ca-1', 'class_id' => 'cls-mine', 'subject_id' => 'sub-mine', 'user_id' => $this->teacher->id, 'sort_order' => 0,
            'data' => json_encode(['classId' => 'cls-mine', 'subjectId' => 'sub-mine', 'teacherId' => $this->teacher->id]), 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('course_assignments')->insert([
            'id' => 'ca-2', 'class_id' => 'cls-mine', 'subject_id' => 'sub-other', 'user_id' => $this->other->id, 'sort_order' => 0,
            'data' => json_encode(['classId' => 'cls-mine', 'subjectId' => 'sub-other', 'teacherId' => $this->other->id]), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function rich(string $id, string $classId): void
    {
        DB::table('students')->insert([
            'id' => $id, 'class_id' => $classId, 'first_name' => 'علی', 'last_name' => 'رضایی', 'sort_order' => 0,
            'data' => json_encode([
                'id' => $id, 'classId' => $classId, 'firstName' => 'علی', 'lastName' => 'رضایی', 'studentCode' => 'C-'.$id,
                'nationalId' => '0012345678', 'parentPhone' => '09123334444', 'fatherName' => 'حسن', 'notes' => 'یادداشت خصوصی',
                'disciplineScore' => 15, 'disciplinaryStatus' => 'warning', 'disciplinaryNotes' => [['text' => 'تذکر']], 'avatar' => 'data:image/png;base64,AAA',
            ], JSON_UNESCAPED_UNICODE),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function data()
    {
        return $this->actingAs($this->teacher)->getJson('/api/bootstrap')->assertOk()->json('data');
    }

    public function test_teacher_sees_only_the_name_of_students_in_own_classes(): void
    {
        $students = $this->data()['students'];

        $this->assertCount(1, $students);
        $this->assertEqualsCanonicalizing(['id', 'classId', 'firstName', 'lastName', 'studentCode', 'nationalId', 'parentPhone'], array_keys($students[0]));
        $this->assertSame(['', '', ''], [$students[0]['studentCode'], $students[0]['nationalId'], $students[0]['parentPhone']]);
        $this->assertSame('stu-mine', $students[0]['id']);
        $this->assertSame('رضایی', $students[0]['lastName']);
    }

    public function test_raw_response_contains_no_student_details(): void
    {
        $raw = $this->actingAs($this->teacher)->getJson('/api/bootstrap')->getContent();

        foreach (['0012345678', '09123334444', 'یادداشت خصوصی', 'تذکر', 'محرمانه', 'warning', 'حسن', 'C-stu-mine', 'stu-other'] as $secret) {
            $this->assertStringNotContainsString($secret, $raw, $secret);
        }
    }

    public function test_teacher_gets_no_disciplinary_or_nurturing_data(): void
    {
        $d = $this->data();

        foreach (['morningDelays', 'schoolAbsences', 'morningAttendance', 'observations', 'nurturingDossiers', 'coachEvaluations'] as $c) {
            $this->assertSame([], $d[$c], $c);
        }
    }

    public function test_teacher_sees_grades_and_assignments_of_own_course_only(): void
    {
        $d = $this->data();

        $this->assertSame(['g-sub-mine'], array_column($d['academicGrades'], 'id'));
        $this->assertSame([$this->teacher->id], array_column($d['courseAssignments'], 'teacherId'));
    }

    public function test_teacher_sees_only_own_classes_without_coach_fields(): void
    {
        $classes = $this->data()['classes'];

        $this->assertSame(['cls-mine'], array_column($classes, 'id'));
        $this->assertArrayNotHasKey('coachId', $classes[0]);
        $this->assertArrayNotHasKey('coachIds', $classes[0]);
        $this->assertArrayNotHasKey('academicAdvisor', $classes[0]);
    }

    public function test_other_accounts_are_reduced_to_name_and_role(): void
    {
        $users = collect($this->data()['users'])->keyBy('id');

        $otherRow = $users[$this->other->id];
        $this->assertEmpty(array_diff(array_keys($otherRow), ['id', 'name', 'role', 'isActive']));
        $this->assertArrayNotHasKey('phone', $otherRow);
        $this->assertArrayNotHasKey('username', $otherRow);
        $this->assertArrayNotHasKey('password', $users[$this->teacher->id]);
    }

    public function test_teacher_cannot_open_dossier_or_observation_endpoints(): void
    {
        $this->actingAs($this->teacher)->getJson('/api/students/stu-mine/nurturing-record')->assertForbidden();
        $this->actingAs($this->teacher)->getJson('/api/nurturing-audit')->assertForbidden();
    }

    public function test_teacher_cannot_read_or_write_disciplinary_collections(): void
    {
        foreach (['morningDelays' => 'x-d', 'schoolAbsences' => 'x-a', 'morningAttendance' => 'x-m'] as $collection => $id) {
            $this->actingAs($this->teacher)->postJson('/api/sync', ['collection' => $collection, 'upserts' => [
                ['id' => $id, 'data' => ['id' => $id, 'studentId' => 'stu-mine', 'classId' => 'cls-mine', 'date' => '1405/07/14', 'status' => 'absent', 'recordedBy' => 'x']],
            ], 'deletes' => []])->assertStatus(403);
        }
        $this->actingAs($this->teacher)->postJson('/api/sync', ['collection' => 'morningDelays', 'upserts' => [], 'deletes' => ['d-1']])->assertStatus(403);
        $this->assertDatabaseHas('morning_delays', ['id' => 'd-1']);
    }

    public function test_teacher_cannot_write_nurturing_collections(): void
    {
        $this->actingAs($this->teacher)->postJson('/api/sync', ['collection' => 'observations', 'upserts' => [
            ['id' => 'o-x', 'data' => ['id' => 'o-x', 'studentId' => 'stu-mine', 'content' => 'x']],
        ], 'deletes' => []])->assertStatus(403);
    }

    public function test_teacher_editing_a_student_changes_only_the_name_and_keeps_hidden_details(): void
    {
        $this->actingAs($this->teacher)->postJson('/api/sync', ['collection' => 'students', 'upserts' => [
            ['id' => 'stu-mine', 'data' => ['id' => 'stu-mine', 'classId' => 'cls-mine', 'firstName' => 'محمد', 'lastName' => 'رضایی', 'nationalId' => 'HACK', 'parentPhone' => 'HACK', 'disciplineScore' => 1]],
        ], 'deletes' => []])->assertOk();

        $stored = json_decode((string) DB::table('students')->where('id', 'stu-mine')->value('data'), true);
        $this->assertSame('محمد', $stored['firstName']);
        $this->assertSame('0012345678', $stored['nationalId']);
        $this->assertSame('09123334444', $stored['parentPhone']);
        $this->assertSame(15, $stored['disciplineScore']);
        $this->assertSame('یادداشت خصوصی', $stored['notes']);
        $this->assertSame('محمد', DB::table('students')->where('id', 'stu-mine')->value('first_name'));
    }

    public function test_teacher_cannot_move_student_to_another_class_via_edit(): void
    {
        $this->actingAs($this->teacher)->postJson('/api/sync', ['collection' => 'students', 'upserts' => [
            ['id' => 'stu-mine', 'data' => ['id' => 'stu-mine', 'classId' => 'cls-other', 'firstName' => 'علی', 'lastName' => 'رضایی']],
        ], 'deletes' => []])->assertOk();

        $this->assertSame('cls-mine', DB::table('students')->where('id', 'stu-mine')->value('class_id'));
    }

    public function test_teacher_cannot_edit_or_delete_student_of_other_class(): void
    {
        $this->actingAs($this->teacher)->postJson('/api/sync', ['collection' => 'students', 'upserts' => [
            ['id' => 'stu-other', 'data' => ['id' => 'stu-other', 'classId' => 'cls-other', 'firstName' => 'x', 'lastName' => 'y']],
        ], 'deletes' => []])->assertStatus(403);
        $this->actingAs($this->teacher)->postJson('/api/sync', ['collection' => 'students', 'upserts' => [], 'deletes' => ['stu-mine']])->assertStatus(403);
    }

    public function test_own_sessions_are_still_visible_and_writable(): void
    {
        $this->actingAs($this->teacher)->postJson('/api/sync', ['collection' => 'sessions', 'upserts' => [
            ['id' => 's1', 'data' => ['id' => 's1', 'classId' => 'cls-mine', 'teacherId' => $this->teacher->id, 'subject' => 'sub-mine', 'subjectId' => 'sub-mine',
                'date' => '1405/07/14', 'lessonTopic' => 'مبحث', 'periodNumber' => 1, 'records' => ['stu-mine' => ['studentId' => 'stu-mine', 'status' => 'present']]]],
        ], 'deletes' => []])->assertOk();

        $this->assertSame(['s1'], array_column($this->data()['sessions'], 'id'));
    }

    public function test_managers_and_coaches_still_receive_full_student_records(): void
    {
        $vice = $this->makeUser('vice_educational');
        $students = $this->actingAs($vice)->getJson('/api/bootstrap')->json('data.students');

        $this->assertCount(2, $students);
        $this->assertArrayHasKey('nationalId', $students[0]);
    }
}
