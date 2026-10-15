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

    public function test_only_admin_and_disciplinary_vice_record_attendance(): void
    {
        foreach (['teacher', 'coach', 'vice_nurturing', 'vice_educational', 'vice_principal'] as $role) {
            $this->sync($this->makeUser($role, [], ['assignedClassIds' => ['cls-1']]), [$this->row(1, true, true)])->assertStatus(403);
        }
        $this->assertDatabaseCount('parent_meetings', 0);

        foreach (['admin', 'vice_disciplinary'] as $role) {
            $this->sync($this->makeUser($role), [$this->row(1, true, true)])->assertOk();
        }
    }

    public function test_nurturing_roles_only_add_notes_and_cannot_change_attendance(): void
    {
        $this->sync($this->makeUser('vice_disciplinary'), [$this->row(1, true, false)])->assertOk();
        $before = json_decode((string) DB::table('parent_meetings')->value('data'), true);

        $vice = $this->makeUser('vice_nurturing', ['name' => 'معاون تربیتی']);
        // تلاش برای تغییر حضور همراه با یادداشت: حضور دست‌نخورده می‌ماند
        $this->sync($vice, [$this->row(1, false, true, ['note' => 'با پدر صحبت شد', 'date' => '1300/01/01'])])->assertOk();
        $after = json_decode((string) DB::table('parent_meetings')->value('data'), true);
        $this->assertTrue($after['father']);
        $this->assertFalse($after['mother']);
        $this->assertSame($before['date'], $after['date']);
        $this->assertSame('با پدر صحبت شد', $after['note']);
        $this->assertSame('معاون تربیتی', $after['noteBy']);
        $this->assertDatabaseHas('parent_meetings', ['father_present' => 1, 'mother_present' => 0]);

        // حذف رکورد حضور برای معاون تربیتی ممنوع است
        $this->sync($vice, [], ['pm-'.$this->year().'-1-stu-1'])->assertStatus(403);
        $this->assertDatabaseCount('parent_meetings', 1);
    }

    public function test_note_on_unrecorded_student_does_not_count_as_attendance(): void
    {
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-1']]);
        $this->sync($coach, [$this->row(2, true, true, ['note' => 'یادداشت'])])->assertOk();

        $stored = json_decode((string) DB::table('parent_meetings')->value('data'), true);
        $this->assertFalse($stored['hasAttendance']);
        $this->assertFalse($stored['father']);
        $this->assertNull($stored['date']);
        $this->assertDatabaseHas('parent_meetings', ['father_present' => 0, 'mother_present' => 0]);

        // ثبت حضور بعدی توسط معاون انضباطی، یادداشت را نگه می‌دارد و تاریخ را امروز می‌گذارد
        $this->sync($this->makeUser('vice_disciplinary'), [$this->row(2, false, true, ['note' => 'یادداشت', 'noteBy' => 'x'])])->assertOk();
        $stored = json_decode((string) DB::table('parent_meetings')->value('data'), true);
        $this->assertTrue($stored['hasAttendance']);
        $this->assertTrue($stored['mother']);
        $this->assertNotNull($stored['date']);
        $this->assertSame('یادداشت', $stored['note']);
    }

    public function test_coach_is_limited_to_own_classes(): void
    {
        $this->makeClass('cls-2');
        $this->makeStudent('stu-2', 'cls-2');
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-1']]);

        $id = 'pm-'.$this->year().'-1-stu-2';
        $this->sync($coach, [['id' => $id, 'data' => ['id' => $id, 'studentId' => 'stu-2', 'meetingNo' => 1, 'note' => 'x']]])->assertStatus(403);

        $admin = $this->makeUser('admin');
        $this->sync($admin, [$this->row(1)])->assertOk();
        $id2 = 'pm-'.$this->year().'-1-stu-2';
        $this->sync($admin, [['id' => $id2, 'data' => ['id' => $id2, 'studentId' => 'stu-2', 'meetingNo' => 1, 'father' => true, 'mother' => true]]])->assertOk();

        $rows = $this->actingAs($coach)->getJson('/api/bootstrap')->json('data.parentMeetings');
        $this->assertCount(1, $rows);
        $this->assertSame('stu-1', $rows[0]['studentId']);
    }

    public function test_visibility_by_role(): void
    {
        $this->sync($this->makeUser('admin'), [$this->row()])->assertOk();

        foreach (['teacher', 'vice_educational'] as $role) {
            $this->assertSame([], $this->actingAs($this->makeUser($role))->getJson('/api/bootstrap')->json('data.parentMeetings'));
        }
        foreach (['admin', 'vice_disciplinary', 'vice_nurturing'] as $role) {
            $this->assertCount(1, $this->actingAs($this->makeUser($role))->getJson('/api/bootstrap')->json('data.parentMeetings'));
        }
    }
}
