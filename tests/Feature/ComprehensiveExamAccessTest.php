<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** آزمون جامع: مربی/معاونِ دارای درس نمره‌ی درس خودش را ثبت می‌کند؛ غیبت را فقط معاون آموزش ثبت می‌کند و نمره را می‌بندد */
class ComprehensiveExamAccessTest extends TestCase
{
    private function setUpClass(User $teacher): void
    {
        $this->makeClass('cls-1', ['teacherIds' => [$teacher->id]]);
        $this->makeStudent('stu-1', 'cls-1');
        $this->makeStudent('stu-2', 'cls-1');
        DB::table('academic_subjects')->insert([
            'id' => 'sub-math', 'name' => 'ریاضی', 'code' => 'm', 'sort_order' => 0,
            'data' => json_encode(['id' => 'sub-math', 'name' => 'ریاضی', 'grade' => 'هشتم']), 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('course_assignments')->insert([
            'id' => 'ca-1', 'class_id' => 'cls-1', 'subject_id' => 'sub-math', 'user_id' => $teacher->id, 'sort_order' => 0,
            'data' => json_encode(['classId' => 'cls-1', 'subjectId' => 'sub-math', 'teacherId' => $teacher->id]), 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('grade_periods')->updateOrInsert(['id' => 'mehrContinuous'], [
            'name' => 'مستمر مهر', 'code' => 'mehrContinuous', 'is_active' => 1, 'sort_order' => 0,
            'data' => json_encode(['id' => 'mehrContinuous', 'code' => 'mehrContinuous', 'isActive' => true]), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function exam(array $extra = [], array $monthly = ['stu-1' => ['math' => 17], 'stu-2' => ['math' => 15]]): array
    {
        $rec = ['id' => 'cexam-cls-1', 'classId' => 'cls-1', 'activeSubjects' => ['math'], 'scores' => (object) [], 'monthly' => ['mehrContinuous' => $monthly]] + $extra;

        return ['id' => $rec['id'], 'data' => $rec];
    }

    private function sync(User $u, array $upserts)
    {
        return $this->actingAs($u)->postJson('/api/sync', ['collection' => 'comprehensiveExams', 'upserts' => $upserts, 'deletes' => []]);
    }

    public function test_coach_who_teaches_a_course_can_enter_own_subject_scores(): void
    {
        $coach = $this->makeUser('coach', ['phone' => '09120000041'], ['isAlsoTeacher' => true]);
        $this->setUpClass($coach);

        $this->sync($coach, [$this->exam()])->assertOk();
        $row = DB::table('comprehensive_exams')->where('class_id', 'cls-1')->first();
        $this->assertSame(17, json_decode($row->data, true)['monthly']['mehrContinuous']['stu-1']['math']);
    }

    public function test_vice_without_exam_permission_who_teaches_can_enter_scores_but_not_edit_whole_record(): void
    {
        $vice = $this->makeUser('vice_disciplinary', ['phone' => '09120000042', 'permissions' => json_encode(['manage-attendance'])], ['isAlsoTeacher' => true]);
        $this->setUpClass($vice);

        $this->sync($vice, [$this->exam()])->assertOk();
        // دروس فعال از رکورد قبلی می‌ماند و فقط درس خودش تغییر می‌کند
        $data = json_decode(DB::table('comprehensive_exams')->where('class_id', 'cls-1')->value('data'), true);
        $this->assertSame(15, $data['monthly']['mehrContinuous']['stu-2']['math']);
    }

    public function test_absence_is_vice_educational_only_and_locks_scores(): void
    {
        $teacher = $this->makeUser('teacher', ['phone' => '09120000043']);
        $this->setUpClass($teacher);
        $viceEdu = $this->makeUser('vice_educational', ['phone' => '09120000044']);
        $admin = $this->makeUser('vice_principal', ['phone' => '09120000045']);

        $this->sync($viceEdu, [$this->exam()])->assertOk();

        // معاون غیرِ آموزش نمی‌تواند غیبت ثبت کند
        $this->sync($admin, [$this->exam(['monthlyAbsent' => ['mehrContinuous' => ['stu-2' => true]]], ['stu-1' => ['math' => 17]])])->assertStatus(403);

        // نمره‌ی دانش‌آموز غایب نباید باقی بماند
        $this->sync($viceEdu, [$this->exam(['monthlyAbsent' => ['mehrContinuous' => ['stu-2' => true]]])])->assertStatus(403);

        $this->sync($viceEdu, [$this->exam(['monthlyAbsent' => ['mehrContinuous' => ['stu-2' => true]]], ['stu-1' => ['math' => 17]])])->assertOk();

        // دبیر نمره‌ی دانش‌آموز غایب را نمی‌تواند بنویسد (نادیده گرفته می‌شود) و غیبت را هم لغو نمی‌کند
        $this->sync($teacher, [$this->exam(['monthlyAbsent' => (object) []], ['stu-1' => ['math' => 18], 'stu-2' => ['math' => 20]])])->assertOk();
        $data = json_decode(DB::table('comprehensive_exams')->where('class_id', 'cls-1')->value('data'), true);
        $this->assertSame(18, $data['monthly']['mehrContinuous']['stu-1']['math']);
        $this->assertArrayNotHasKey('stu-2', $data['monthly']['mehrContinuous']);
        $this->assertTrue($data['monthlyAbsent']['mehrContinuous']['stu-2']);
    }
}
