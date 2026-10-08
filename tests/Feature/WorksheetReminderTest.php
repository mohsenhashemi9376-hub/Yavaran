<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Jalali;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** یادآوری کاربرگ به مربی: فقط وقتی کلاس خودش هنوز هیچ کاربرگی ثبت نکرده؛ هر نوع یادآوری یک‌بار */
class WorksheetReminderTest extends TestCase
{
    private User $coach;

    protected function setUp(): void
    {
        parent::setUp();
        $this->coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-mine']]);
        $this->makeClass('cls-mine', ['name' => 'هشتم الف', 'coachIds' => [$this->coach->id]]);
        $this->makeClass('cls-other');
        $this->makeStudent('stu-mine', 'cls-mine');
        $this->makeStudent('stu-other', 'cls-other');
    }

    private function shamsiOffset(int $days): string
    {
        [$y, $m, $d] = Jalali::fromCarbon(now()->addDays($days));

        return sprintf('%04d/%02d/%02d', $y, $m, $d);
    }

    private function week(string $deadline, string $weekStart = '1405/07/15'): void
    {
        DB::table('worksheet_weeks')->insert([
            'id' => 'wk-'.str_replace('/', '-', $weekStart), 'week_start' => $weekStart, 'deadline' => $deadline, 'sort_order' => 0,
            'data' => json_encode(['weekStart' => $weekStart, 'deadline' => $deadline]), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function record(string $student, string $classId, string $weekStart = '1405/07/15'): void
    {
        DB::table('worksheet_records')->insert([
            'id' => 'ws-'.$student.'-'.str_replace('/', '-', $weekStart), 'student_id' => $student, 'class_id' => $classId, 'week_start' => $weekStart, 'status' => 'complete', 'sort_order' => 0,
            'data' => json_encode(['studentId' => $student, 'status' => 'complete']), 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function notifications(User $u): array
    {
        Cache::flush();

        return $this->actingAs($u)->getJson('/api/notifications')->assertOk()->json('notifications');
    }

    public function test_reminder_kinds_for_an_unmarked_class(): void
    {
        foreach ([[1, 'soon', 'فردا'], [0, 'due', 'امروز'], [-2, 'overdue', 'گذشته']] as [$offset, $kind, $word]) {
            DB::table('worksheet_weeks')->delete();
            DB::table('notifications')->delete();
            $this->week($this->shamsiOffset($offset));

            $n = $this->notifications($this->coach);
            $this->assertCount(1, $n, $kind);
            $this->assertSame('worksheet', $n[0]['type']);
            $this->assertSame("ws-remind:$kind:1405/07/15", $n[0]['refId']);
            $this->assertStringContainsString('هشتم الف', $n[0]['message']);
            $this->assertStringContainsString($word, $n[0]['title'].$n[0]['message']);
            $this->assertStringNotContainsString('کلاس '.'cls-other', $n[0]['message']);
        }
    }

    public function test_each_reminder_is_sent_once(): void
    {
        $this->week($this->shamsiOffset(0));

        $this->assertCount(1, $this->notifications($this->coach));
        $this->assertCount(1, $this->notifications($this->coach));
        $this->assertCount(1, $this->notifications($this->coach));
    }

    public function test_no_reminder_when_class_already_has_records_or_deadline_is_far_or_old(): void
    {
        $this->week($this->shamsiOffset(0));
        $this->record('stu-mine', 'cls-mine');
        $this->assertSame([], $this->notifications($this->coach));

        DB::table('worksheet_records')->delete();
        DB::table('worksheet_weeks')->delete();
        $this->week($this->shamsiOffset(5));
        $this->assertSame([], $this->notifications($this->coach));

        DB::table('worksheet_weeks')->delete();
        $this->week($this->shamsiOffset(-20));
        $this->assertSame([], $this->notifications($this->coach));
    }

    public function test_records_of_another_class_do_not_silence_the_reminder(): void
    {
        $this->week($this->shamsiOffset(0));
        $this->record('stu-other', 'cls-other');

        $this->assertCount(1, $this->notifications($this->coach));
    }

    public function test_only_coaches_with_the_permission_get_reminders(): void
    {
        $this->week($this->shamsiOffset(0));

        foreach (['teacher', 'vice_educational', 'vice_nurturing'] as $role) {
            $this->assertSame([], $this->notifications($this->makeUser($role)), $role);
        }
        $noPerm = $this->makeUser('coach', ['permissions' => json_encode(['view-nurturing-file'])], ['assignedClassIds' => ['cls-mine']]);
        $this->assertSame([], $this->notifications($noPerm));
    }
}
