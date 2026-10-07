<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** دسترسی دبیر: کلاس‌های خودش، جلسات خودش و نمره‌ی درس خودش */
class TeacherAccessTest extends TestCase
{
    private function subject(string $id, string $name, ?string $teacherId, array $extra = []): void
    {
        DB::table('academic_subjects')->insert([
            'id' => $id, 'name' => $name, 'code' => $id, 'sort_order' => 0,
            'data' => json_encode(array_merge(['id' => $id, 'name' => $name, 'teacherId' => $teacherId], $extra), JSON_UNESCAPED_UNICODE),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function assignCourse(string $classId, string $subjectId, string $userId): void
    {
        DB::table('course_assignments')->insert([
            'id' => "ca-$classId-$subjectId", 'class_id' => $classId, 'subject_id' => $subjectId, 'user_id' => $userId,
            'sort_order' => 0, 'data' => json_encode(['classId' => $classId, 'subjectId' => $subjectId, 'teacherId' => $userId]),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function sessionData(string $id, string $classId, string $teacherId, string $subjectId, string $subject): array
    {
        return ['id' => $id, 'data' => [
            'id' => $id, 'classId' => $classId, 'teacherId' => $teacherId, 'subject' => $subject, 'subjectId' => $subjectId,
            'date' => '1405/07/14', 'lessonTopic' => 'مبحث آزمایشی', 'periodNumber' => 1, 'records' => ['stu-1' => ['studentId' => 'stu-1', 'status' => 'present']],
        ]];
    }

    private function sync(User $user, string $collection, array $upserts)
    {
        return $this->actingAs($user)->postJson('/api/sync', ['collection' => $collection, 'upserts' => $upserts, 'deletes' => []]);
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->makeClass('cls-8', ['grade' => 'هشتم']);
        $this->makeStudent('stu-1', 'cls-8');
    }

    // ---------- کلاس‌های مجاز ----------

    public function test_default_subject_teacher_may_register_attendance_for_the_class(): void
    {
        $teacher = $this->makeUser('teacher');
        $this->subject('sub-math', 'ریاضی', $teacher->id);

        $this->sync($teacher, 'sessions', [$this->sessionData('s1', 'cls-8', $teacher->id, 'sub-math', 'ریاضی')])->assertOk();

        $this->assertDatabaseHas('attendance_sessions', ['id' => 's1', 'class_id' => 'cls-8']);
    }

    public function test_teacher_without_any_assignment_gets_403(): void
    {
        $teacher = $this->makeUser('teacher');
        $this->subject('sub-math', 'ریاضی', null);

        $this->sync($teacher, 'sessions', [$this->sessionData('s1', 'cls-8', $teacher->id, 'sub-math', 'ریاضی')])->assertForbidden();
        $this->assertDatabaseMissing('attendance_sessions', ['id' => 's1']);
    }

    public function test_subject_of_another_grade_does_not_grant_access(): void
    {
        $teacher = $this->makeUser('teacher');
        $this->subject('sub-9', 'ریاضی نهم', $teacher->id, ['targetGrades' => ['پایه نهم']]);

        $this->sync($teacher, 'sessions', [$this->sessionData('s1', 'cls-8', $teacher->id, 'sub-9', 'ریاضی نهم')])->assertForbidden();
    }

    public function test_general_subject_without_grade_applies_to_every_class(): void
    {
        $teacher = $this->makeUser('teacher');
        $this->subject('sub-gen', 'قرآن', $teacher->id, ['targetGrades' => ['عمومی']]);

        $this->sync($teacher, 'sessions', [$this->sessionData('s1', 'cls-8', $teacher->id, 'sub-gen', 'قرآن')])->assertOk();
    }

    public function test_explicit_course_assignment_overrides_the_default_teacher(): void
    {
        $default = $this->makeUser('teacher');
        $other = $this->makeUser('teacher');
        $this->subject('sub-math', 'ریاضی', $default->id);
        $this->assignCourse('cls-8', 'sub-math', $other->id);

        $this->sync($default, 'sessions', [$this->sessionData('s1', 'cls-8', $default->id, 'sub-math', 'ریاضی')])->assertForbidden();
        $this->sync($other, 'sessions', [$this->sessionData('s2', 'cls-8', $other->id, 'sub-math', 'ریاضی')])->assertOk();
    }

    // ---------- جلسات قابل مشاهده ----------

    public function test_teacher_receives_only_own_sessions_not_other_teachers_in_shared_class(): void
    {
        $a = $this->makeUser('teacher');
        $b = $this->makeUser('teacher');
        $this->subject('sub-a', 'ریاضی', $a->id);
        $this->subject('sub-b', 'قرآن', $b->id);

        $this->sync($a, 'sessions', [$this->sessionData('sa', 'cls-8', $a->id, 'sub-a', 'ریاضی')])->assertOk();
        $this->sync($b, 'sessions', [$this->sessionData('sb', 'cls-8', $b->id, 'sub-b', 'قرآن')])->assertOk();

        $idsA = collect($this->actingAs($a)->getJson('/api/bootstrap')->json('data.sessions'))->pluck('id')->all();
        $idsB = collect($this->actingAs($b)->getJson('/api/bootstrap')->json('data.sessions'))->pluck('id')->all();

        $this->assertSame(['sa'], $idsA);
        $this->assertSame(['sb'], $idsB);
    }

    public function test_session_by_substitute_in_my_assigned_subject_is_still_visible(): void
    {
        $a = $this->makeUser('teacher');
        $b = $this->makeUser('teacher');
        $this->subject('sub-a', 'ریاضی', $a->id);
        $this->subject('sub-b', 'ریاضی ۲', $b->id);

        // جلسه‌ی درس «الف» را شخص دیگری ثبت کرده (جایگزین) ← برای دبیر درس «الف» قابل مشاهده است
        DB::table('attendance_sessions')->insert([
            'id' => 'sub-session', 'class_id' => 'cls-8', 'teacher_id' => $b->id, 'subject' => 'ریاضی', 'session_date' => '1405/07/14',
            'sort_order' => 0, 'created_at' => now(), 'updated_at' => now(),
            'data' => json_encode(['id' => 'sub-session', 'classId' => 'cls-8', 'teacherId' => $b->id, 'subject' => 'ریاضی', 'subjectId' => 'sub-a', 'date' => '1405/07/14', 'records' => []]),
        ]);

        $ids = collect($this->actingAs($a)->getJson('/api/bootstrap')->json('data.sessions'))->pluck('id')->all();

        $this->assertContains('sub-session', $ids);
    }

    public function test_managers_still_receive_all_sessions(): void
    {
        $a = $this->makeUser('teacher');
        $b = $this->makeUser('teacher');
        $this->subject('sub-a', 'ریاضی', $a->id);
        $this->subject('sub-b', 'قرآن', $b->id);
        $this->sync($a, 'sessions', [$this->sessionData('sa', 'cls-8', $a->id, 'sub-a', 'ریاضی')])->assertOk();
        $this->sync($b, 'sessions', [$this->sessionData('sb', 'cls-8', $b->id, 'sub-b', 'قرآن')])->assertOk();

        $admin = $this->makeUser('admin');

        $this->assertCount(2, $this->actingAs($admin)->getJson('/api/bootstrap')->json('data.sessions'));
    }

    // ---------- نمره ----------

    private function grade(string $id, string $subjectId): array
    {
        return ['id' => $id, 'data' => ['id' => $id, 'studentId' => 'stu-1', 'classId' => 'cls-8', 'subjectId' => $subjectId, 'subjectName' => $subjectId, 'mehrContinuous' => '18']];
    }

    public function test_teacher_can_grade_only_own_subject(): void
    {
        $teacher = $this->makeUser('teacher');
        $this->subject('sub-mine', 'ریاضی', $teacher->id);
        $this->subject('sub-else', 'قرآن', null);

        $this->sync($teacher, 'academicGrades', [$this->grade('g1', 'sub-mine')])->assertOk();
        $this->assertDatabaseHas('academic_grades', ['id' => 'g1', 'subject_id' => 'sub-mine']);

        $this->sync($teacher, 'academicGrades', [$this->grade('g2', 'sub-else')])->assertForbidden();
        $this->assertDatabaseMissing('academic_grades', ['id' => 'g2']);
    }

    public function test_teacher_cannot_edit_or_delete_a_grade_of_another_subject(): void
    {
        $teacher = $this->makeUser('teacher');
        $this->subject('sub-mine', 'ریاضی', $teacher->id);
        $this->subject('sub-else', 'قرآن', null);
        $admin = $this->makeUser('admin');
        $this->sync($admin, 'academicGrades', [$this->grade('g-else', 'sub-else')])->assertOk();

        $this->sync($teacher, 'academicGrades', [$this->grade('g-else', 'sub-else')])->assertForbidden();
        $this->actingAs($teacher)->postJson('/api/sync', ['collection' => 'academicGrades', 'upserts' => [], 'deletes' => ['g-else']])->assertForbidden();
        $this->assertDatabaseHas('academic_grades', ['id' => 'g-else']);
    }

    public function test_managers_may_grade_any_subject(): void
    {
        $this->subject('sub-else', 'قرآن', null);

        foreach (['admin', 'vice_educational'] as $role) {
            $this->sync($this->makeUser($role), 'academicGrades', [$this->grade('g-'.$role, 'sub-else')])->assertOk();
        }
    }

    public function test_course_assignment_grants_grading_for_that_class_and_subject(): void
    {
        $teacher = $this->makeUser('teacher');
        $this->subject('sub-x', 'علوم', null);
        $this->assignCourse('cls-8', 'sub-x', $teacher->id);

        $this->sync($teacher, 'academicGrades', [$this->grade('g1', 'sub-x')])->assertOk();
    }
}
