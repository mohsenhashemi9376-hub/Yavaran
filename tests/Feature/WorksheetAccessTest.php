<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** کاربرگ هفتگی: مربی فقط کلاس خودش؛ معاونت آموزش همه؛ معاون تربیتی فقط مشاهده؛ دبیر هیچ */
class WorksheetAccessTest extends TestCase
{
    private User $coach;

    protected function setUp(): void
    {
        parent::setUp();
        $this->coach = $this->makeUser('coach', ['name' => 'مربی الف'], ['assignedClassIds' => ['cls-mine']]);
        $this->makeClass('cls-mine', ['coachIds' => [$this->coach->id]]);
        $this->makeClass('cls-other');
        $this->makeStudent('stu-mine', 'cls-mine');
        $this->makeStudent('stu-other', 'cls-other');
    }

    private function rec(string $student, string $status = 'complete', string $week = '1405/07/15', array $extra = []): array
    {
        $id = 'ws-'.$student.'-'.str_replace('/', '-', $week);

        return ['id' => $id, 'data' => array_merge(['id' => $id, 'studentId' => $student, 'weekStart' => $week, 'status' => $status], $extra)];
    }

    private function saveWs(User $u, array $upserts = [], array $deletes = [], string $collection = 'worksheets')
    {
        return $this->actingAs($u)->postJson('/api/sync', ['collection' => $collection, 'upserts' => $upserts, 'deletes' => $deletes]);
    }

    private function visible(User $u, string $collection = 'worksheets'): array
    {
        $ids = collect($this->actingAs($u)->getJson('/api/bootstrap')->assertOk()->json('data.'.$collection))->pluck('id')->all();
        sort($ids);

        return $ids;
    }

    private function seedBoth(): void
    {
        $edu = $this->makeUser('vice_educational');
        $this->saveWs($edu, [$this->rec('stu-mine'), $this->rec('stu-other', 'partial')])->assertOk();
    }

    public function test_coach_records_own_class_with_server_stamped_fields(): void
    {
        $this->saveWs($this->coach, [$this->rec('stu-mine', 'partial', '1405/07/15', ['classId' => 'forged', 'recordedBy' => 'جعلی', 'recordedById' => 'x', 'note' => 'ناقص'])])->assertOk();

        $row = json_decode((string) DB::table('worksheet_records')->where('id', 'ws-stu-mine-1405-07-15')->value('data'), true);
        $this->assertSame('cls-mine', $row['classId']);
        $this->assertSame($this->coach->id, $row['recordedById']);
        $this->assertSame('مربی الف', $row['recordedBy']);
        $this->assertSame('partial', $row['status']);
        $this->assertDatabaseHas('worksheet_records', ['student_id' => 'stu-mine', 'class_id' => 'cls-mine', 'week_start' => '1405/07/15', 'status' => 'partial']);
    }

    public function test_coach_cannot_touch_other_class_students(): void
    {
        $this->seedBoth();
        $this->saveWs($this->coach, [$this->rec('stu-other', 'complete', '1405/07/22')])->assertStatus(403);
        $this->saveWs($this->coach, [$this->rec('stu-other', 'complete')])->assertStatus(403); // رکورد موجود دیگران
        $this->saveWs($this->coach, [], ['ws-stu-other-1405-07-15'])->assertStatus(403);
        $this->assertDatabaseHas('worksheet_records', ['id' => 'ws-stu-other-1405-07-15', 'status' => 'partial']);
    }

    public function test_status_can_change_and_record_can_be_removed_back_to_default(): void
    {
        $this->saveWs($this->coach, [$this->rec('stu-mine', 'complete')])->assertOk();
        $this->saveWs($this->coach, [$this->rec('stu-mine', 'absent')])->assertOk();
        $this->assertDatabaseHas('worksheet_records', ['id' => 'ws-stu-mine-1405-07-15', 'status' => 'absent']);

        $this->saveWs($this->coach, [], ['ws-stu-mine-1405-07-15'])->assertOk();
        $this->assertDatabaseMissing('worksheet_records', ['id' => 'ws-stu-mine-1405-07-15']);
        $this->assertDatabaseCount('worksheet_records', 0);
    }

    public function test_invalid_payloads_are_rejected(): void
    {
        $this->saveWs($this->coach, [$this->rec('stu-mine', 'missing')])->assertStatus(422);       // «تحویل نداده» رکورد ندارد
        $this->saveWs($this->coach, [$this->rec('stu-mine', 'complete', '1405-07-15')])->assertStatus(422);
        $this->saveWs($this->coach, [['id' => 'ws-random', 'data' => ['id' => 'ws-random', 'studentId' => 'stu-mine', 'weekStart' => '1405/07/15', 'status' => 'complete']]])->assertStatus(422);
        $this->saveWs($this->coach, [$this->rec('ghost')])->assertStatus(422);
        $this->assertDatabaseCount('worksheet_records', 0);
    }

    public function test_visibility_per_role(): void
    {
        $this->seedBoth();
        $all = ['ws-stu-mine-1405-07-15', 'ws-stu-other-1405-07-15'];

        $this->assertSame(['ws-stu-mine-1405-07-15'], $this->visible($this->coach));
        foreach (['vice_educational', 'admin', 'vice_principal', 'vice_nurturing'] as $role) {
            $this->assertSame($all, $this->visible($this->makeUser($role)), $role);
        }
        foreach (['vice_disciplinary', 'teacher'] as $role) {
            $this->assertSame([], $this->visible($this->makeUser($role)), $role);
        }
    }

    public function test_educational_vice_and_admin_can_record_for_every_class(): void
    {
        foreach (['vice_educational', 'admin', 'vice_principal'] as $role) {
            $this->saveWs($this->makeUser($role), [$this->rec('stu-other', 'complete', '1405/08/01')])->assertOk();
            DB::table('worksheet_records')->delete();
        }
    }

    public function test_nurturing_vice_disciplinary_vice_and_teacher_cannot_write(): void
    {
        foreach (['vice_nurturing', 'vice_disciplinary', 'teacher'] as $role) {
            $u = $this->makeUser($role);
            $this->saveWs($u, [$this->rec('stu-mine')])->assertStatus(403);
            $this->saveWs($u, [['id' => 'wk-1405-07-15', 'data' => ['id' => 'wk-1405-07-15', 'weekStart' => '1405/07/15', 'deadline' => '1405/07/19']]], [], 'worksheetWeeks')->assertStatus(403);
        }
        $this->assertDatabaseCount('worksheet_records', 0);
        $this->assertDatabaseCount('worksheet_weeks', 0);
    }

    public function test_only_educational_management_sets_the_deadline_and_coach_can_read_it(): void
    {
        $week = ['id' => 'wk-1405-07-15', 'data' => ['id' => 'wk-1405-07-15', 'weekStart' => '1405/07/15', 'deadline' => '1405/07/19']];

        $this->saveWs($this->coach, [$week], [], 'worksheetWeeks')->assertStatus(403);

        $edu = $this->makeUser('vice_educational', ['name' => 'معاون آموزشی']);
        $this->saveWs($edu, [$week], [], 'worksheetWeeks')->assertOk();
        $this->assertDatabaseHas('worksheet_weeks', ['week_start' => '1405/07/15', 'deadline' => '1405/07/19']);
        $this->assertSame('معاون آموزشی', json_decode((string) DB::table('worksheet_weeks')->value('data'), true)['setBy']);

        $this->assertSame(['wk-1405-07-15'], $this->visible($this->coach, 'worksheetWeeks'));
        $this->assertSame(['wk-1405-07-15'], $this->visible($this->makeUser('vice_nurturing'), 'worksheetWeeks'));
        $this->assertSame([], $this->visible($this->makeUser('teacher'), 'worksheetWeeks'));

        // مهلت نامعتبر
        $bad = ['id' => 'wk-1405-07-22', 'data' => ['id' => 'wk-1405-07-22', 'weekStart' => '1405/07/22', 'deadline' => 'فردا']];
        $this->saveWs($edu, [$bad], [], 'worksheetWeeks')->assertStatus(422);
    }

    public function test_without_the_permission_nothing_is_readable_or_writable(): void
    {
        $coach = $this->makeUser('coach', ['permissions' => json_encode(['view-nurturing-file'])], ['assignedClassIds' => ['cls-mine']]);
        $this->saveWs($coach, [$this->rec('stu-mine')])->assertStatus(403);
        $this->assertSame([], $this->visible($coach));
    }
}
