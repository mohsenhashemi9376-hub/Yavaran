<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** کارتابل بررسی طرح درس: فقط معاون آموزش؛ تأیید ۵۰ امتیاز (یک‌بار)، ارجاع برای اصلاح، فقط سال ۱۴۰۵-۱۴۰۶ */
class LessonPlanReviewTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // در CI فایل‌های build (manifest ویت) ساخته نمی‌شوند؛ صفحه‌های Blade بدون Vite رندر می‌شوند
        $this->withoutVite();
    }

    private function plan(string $id, string $teacherId, string $status, string $date = '1405/08/03', array $extra = []): void
    {
        DB::table('lesson_plans')->insert([
            'id' => $id, 'teacher_id' => $teacherId, 'class_id' => null, 'plan_date' => $date, 'status' => $status, 'sort_order' => 0,
            'data' => json_encode(['id' => $id, 'teacherId' => $teacherId, 'teacherName' => 'استاد', 'subject' => 'ریاضی', 'date' => $date, 'status' => $status, 'mainTopic' => 'اعداد', 'submittedAt' => now()->toIso8601String()] + $extra, JSON_UNESCAPED_UNICODE),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_only_vice_educational_sees_the_inbox(): void
    {
        $teacher = $this->makeUser('teacher', ['phone' => '09120000051']);
        $this->actingAs($teacher)->get('/lesson-plan-review')->assertRedirect('/');
        $this->actingAs($teacher)->getJson('/api/lesson-plan-review')->assertStatus(403);

        $vice = $this->makeUser('vice_educational', ['phone' => '09120000052']);
        $this->plan('p-sub', $teacher->id, 'submitted');
        $this->plan('p-draft', $teacher->id, 'draft');
        $this->plan('p-old', $teacher->id, 'submitted', '1404/08/03');
        $this->actingAs($vice)->get('/lesson-plan-review')->assertOk()->assertSee('کارتابل بررسی طرح درس‌ها')->assertSee('۱۴۰۵-۱۴۰۶');
        $ids = array_column($this->actingAs($vice)->getJson('/api/lesson-plan-review')->assertOk()->json('plans'), 'id');
        $this->assertSame(['p-sub'], $ids);
    }

    public function test_approve_awards_points_once_and_return_sends_back_for_revision(): void
    {
        $teacher = $this->makeUser('teacher', ['phone' => '09120000053']);
        $vice = $this->makeUser('vice_educational', ['phone' => '09120000054']);
        $this->plan('p1', $teacher->id, 'submitted');
        $this->plan('p2', $teacher->id, 'submitted');

        $this->actingAs($vice)->postJson('/api/lesson-plan-review/p2', ['action' => 'return'])->assertStatus(422);
        $this->actingAs($vice)->postJson('/api/lesson-plan-review/p2', ['action' => 'return', 'tags' => ['time_challenge'], 'note' => 'زمان‌بندی'])
            ->assertOk()->assertJson(['state' => 'revision']);
        $this->assertSame('draft', DB::table('lesson_plans')->where('id', 'p2')->value('status'));
        $this->assertSame(0, (int) DB::table('teacher_points')->where('user_id', $teacher->id)->sum('points'));

        $this->actingAs($vice)->postJson('/api/lesson-plan-review/p1', ['action' => 'approve', 'tags' => ['creative_start']])
            ->assertOk()->assertJson(['state' => 'approved', 'awarded' => 50, 'totalPoints' => 50]);
        $this->actingAs($vice)->postJson('/api/lesson-plan-review/p1', ['action' => 'approve'])
            ->assertOk()->assertJson(['awarded' => 0, 'totalPoints' => 50]);

        $states = array_column($this->actingAs($vice)->getJson('/api/lesson-plan-review')->json('plans'), 'state', 'id');
        $this->assertSame(['p1' => 'approved', 'p2' => 'revision'], $states);

        $this->actingAs($teacher)->postJson('/api/lesson-plan-review/p1', ['action' => 'approve'])->assertStatus(403);
    }
}
