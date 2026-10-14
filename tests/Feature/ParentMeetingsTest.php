<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\AcademicYear;
use App\Support\Jalali;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** حضور پدر و مادر در سه جلسه‌ی عمومی اولیاء: تاریخ و سال تحصیلی را سرور می‌گذارد */
class ParentMeetingsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->makeClass('cls-1');
        $this->makeStudent('stu-1', 'cls-1');
    }

    private function sync(User $u, array $upserts = [], array $deletes = [])
    {
        return $this->actingAs($u)->postJson('/api/sync', ['collection' => 'parentMeetings', 'upserts' => $upserts, 'deletes' => $deletes]);
    }

    private function year(): string
    {
        return (string) AcademicYear::current()[0];
    }

    private function row(int $no = 1, bool $father = true, bool $mother = false, array $extra = []): array
    {
        $id = 'pm-'.$this->year().'-'.$no.'-stu-1';

        return ['id' => $id, 'data' => $extra + ['id' => $id, 'studentId' => 'stu-1', 'meetingNo' => $no, 'father' => $father, 'mother' => $mother]];
    }

    public function test_date_class_and_recorder_are_set_by_server(): void
    {
        $vice = $this->makeUser('vice_disciplinary', ['name' => 'معاون']);
        $this->sync($vice, [$this->row(1, true, true, ['date' => '1300/01/01', 'classId' => 'forged', 'academicYear' => '1200'])])->assertOk();

        [$jy, $jm, $jd] = Jalali::fromCarbon(now('Asia/Tehran'));
        $stored = json_decode((string) DB::table('parent_meetings')->value('data'), true);
        $this->assertSame(sprintf('%04d/%02d/%02d', $jy, $jm, $jd), $stored['date']);
        $this->assertSame('cls-1', $stored['classId']);
        $this->assertSame($this->year(), $stored['academicYear']);
        $this->assertSame('معاون', $stored['recordedBy']);
        $this->assertDatabaseHas('parent_meetings', ['student_id' => 'stu-1', 'meeting_no' => 1, 'father_present' => 1, 'mother_present' => 1]);
    }

    public function test_date_is_kept_on_edit_and_father_mother_are_independent(): void
    {
        $vice = $this->makeUser('vice_disciplinary');
        $this->sync($vice, [$this->row(2, true, false)])->assertOk();
        DB::table('parent_meetings')->update(['data' => json_encode(array_merge(json_decode((string) DB::table('parent_meetings')->value('data'), true), ['date' => '1405/07/10']))]);

        $this->sync($vice, [$this->row(2, true, true)])->assertOk();
        $stored = json_decode((string) DB::table('parent_meetings')->value('data'), true);
        $this->assertSame('1405/07/10', $stored['date']);
        $this->assertDatabaseHas('parent_meetings', ['meeting_no' => 2, 'father_present' => 1, 'mother_present' => 1]);
        $this->assertDatabaseCount('parent_meetings', 1);
    }

    public function test_only_three_meetings_and_deterministic_ids(): void
    {
        $admin = $this->makeUser('admin');
        $this->sync($admin, [$this->row(4)])->assertStatus(422);
        $this->sync($admin, [['id' => 'random', 'data' => ['id' => 'random', 'studentId' => 'stu-1', 'meetingNo' => 1, 'father' => true]]])->assertStatus(422);
        $this->sync($admin, [['id' => 'pm-'.$this->year().'-1-nope', 'data' => ['id' => 'pm-'.$this->year().'-1-nope', 'studentId' => 'nope', 'meetingNo' => 1]]])->assertStatus(422);
        $this->assertDatabaseCount('parent_meetings', 0);
    }

    public function test_delete_resets_to_unrecorded(): void
    {
        $vice = $this->makeUser('vice_disciplinary');
        $this->sync($vice, [$this->row(3)])->assertOk();
        $this->sync($vice, [], ['pm-'.$this->year().'-3-stu-1'])->assertOk();
        $this->assertDatabaseCount('parent_meetings', 0);
    }

    public function test_access_is_limited_to_managers_with_permission(): void
    {
        foreach (['teacher', 'coach'] as $role) {
            $this->sync($this->makeUser($role), [$this->row()])->assertStatus(403);
        }
        $this->sync($this->makeUser('vice_nurturing'), [$this->row()])->assertStatus(403);
        $this->assertDatabaseCount('parent_meetings', 0);

        foreach (['admin', 'vice_disciplinary', 'vice_educational'] as $role) {
            $this->sync($this->makeUser($role), [$this->row()])->assertOk();
        }

        foreach (['teacher', 'coach', 'vice_nurturing'] as $role) {
            $this->assertSame([], $this->actingAs($this->makeUser($role))->getJson('/api/bootstrap')->json('data.parentMeetings'));
        }
        $this->assertCount(1, $this->actingAs($this->makeUser('vice_disciplinary'))->getJson('/api/bootstrap')->json('data.parentMeetings'));
    }
}
