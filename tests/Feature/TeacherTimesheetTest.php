<?php

namespace Tests\Feature;

use App\Support\TimesheetCalendar;
use Tests\TestCase;

/** ساعت کاری و خودارزیابی اساتید: هر استاد فقط دادهٔ خودش را می‌بیند و می‌نویسد */
class TeacherTimesheetTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // در CI فایل‌های build (manifest ویت) ساخته نمی‌شوند؛ صفحه‌های Blade بدون Vite رندر می‌شوند
        $this->withoutVite();
    }

    public function test_calendar_runs_from_26th_to_25th(): void
    {
        $aban = TimesheetCalendar::month('aban');
        $this->assertSame('آبان ۱۴۰۵ (۲۶ مهر تا ۲۵ آبان)', $aban['label']);
        $this->assertSame('1405/07/26', $aban['days'][0]['date']);
        $this->assertSame('1405/08/25', $aban['days'][array_key_last($aban['days'])]['date']);
        $this->assertCount(30, $aban['days']);

        $farvardin = TimesheetCalendar::month('farvardin');
        $this->assertSame('1405/12/26', $farvardin['days'][0]['date']);
        $this->assertSame('1406/01/25', $farvardin['days'][array_key_last($farvardin['days'])]['date']);

        // هیچ تاریخی پیش از ۱ مهر ۱۴۰۵ نیست؛ فقط جمعه تعطیل است
        $mehr = TimesheetCalendar::month('mehr');
        $this->assertSame('1405/07/01', $mehr['days'][0]['date']);
        $this->assertSame('مهر ۱۴۰۵ (۱ تا ۲۵ مهر)', $mehr['label']);
        $this->assertCount(25, $mehr['days']);
        // 1405/07/14 سه‌شنبه، 1405/07/16 پنج‌شنبه، 1405/07/17 جمعه
        $byDate = array_column($mehr['days'], 'off', 'date');
        $this->assertFalse($byDate['1405/07/14']);
        $this->assertFalse($byDate['1405/07/16']);
        $this->assertTrue($byDate['1405/07/17']);
        $all = array_merge(...array_map(fn ($m) => array_column($m['days'], 'date'), TimesheetCalendar::months()));
        $this->assertSame('1405/07/01', min($all));
        $this->assertSame('1406/03/25', max($all));

        $this->assertSame(['mehr', 'aban', 'azar', 'dey', 'bahman', 'esfand', 'farvardin', 'ordibehesht', 'khordad'], TimesheetCalendar::keys());
    }

    public function test_old_blade_page_redirects_home(): void
    {
        $this->get('/teacher-timesheet')->assertRedirect('/');
        $teacher = $this->makeUser('teacher');
        $this->actingAs($teacher)->get('/teacher-timesheet')->assertRedirect('/');
    }

    public function test_save_and_load_are_per_user_and_month(): void
    {
        $a = $this->makeUser('teacher', ['phone' => '09120000031']);
        $b = $this->makeUser('teacher', ['phone' => '09120000032']);

        $payload = [
            'month' => 'aban',
            'entries' => [
                '1405/07/26' => ['in' => '08:00', 'out' => '14:30', 'tags' => ['teaching', 'other'], 'otherText' => 'نظارت بر امتحان'],
                '1399/01/01' => ['in' => '08:00', 'out' => '09:00', 'tags' => []],
            ],
            'selfEvaluation' => ['scores' => ['growth' => 4, 'extra' => 5], 'extraNote' => 'کلاس تقویتی'],
        ];
        $this->actingAs($a)->postJson('/api/teacher-timesheet', $payload)->assertOk();

        $res = $this->actingAs($a)->getJson('/api/teacher-timesheet?month=aban')->assertOk();
        $this->assertSame(['1405/07/26'], array_keys($res->json('entries')));
        $this->assertSame('08:00', $res->json('entries.1405/07/26.in'));
        $this->assertSame(['teaching', 'other'], $res->json('entries.1405/07/26.tags'));
        $this->assertSame('نظارت بر امتحان', $res->json('entries.1405/07/26.otherText'));
        $this->assertSame(5, $res->json('selfEvaluation.scores.extra'));
        $this->assertSame('کلاس تقویتی', $res->json('selfEvaluation.extraNote'));

        $this->actingAs($b)->getJson('/api/teacher-timesheet?month=aban')->assertOk()->assertJson(['entries' => []]);
        $this->actingAs($a)->getJson('/api/teacher-timesheet?month=azar')->assertOk()->assertJson(['entries' => []]);
    }

    public function test_rejects_bad_month_time_and_score(): void
    {
        $u = $this->makeUser('teacher');
        $this->actingAs($u)->getJson("/api/teacher-timesheet?month=shahrivar")->assertStatus(422);
        $this->actingAs($u)->postJson('/api/teacher-timesheet', [
            'month' => 'aban', 'entries' => ['1405/07/26' => ['in' => '25:99']], 'selfEvaluation' => ['scores' => []],
        ])->assertStatus(422);
        $this->actingAs($u)->postJson('/api/teacher-timesheet', [
            'month' => 'aban', 'entries' => [], 'selfEvaluation' => ['scores' => ['growth' => 6]],
        ])->assertStatus(422);
    }

    public function test_managers_see_overview_with_hours_and_scores(): void
    {
        $teacher = $this->makeUser('teacher', ['phone' => '09120000061']);
        $vice = $this->makeUser('vice_educational', ['phone' => '09120000062']);
        $this->actingAs($teacher)->postJson('/api/teacher-timesheet', [
            'month' => 'aban',
            'entries' => ['1405/08/01' => ['in' => '08:00', 'out' => '12:00', 'in2' => '13:00', 'out2' => '15:30', 'tags' => ['teaching']]],
            'selfEvaluation' => ['scores' => ['growth' => 4, 'extra' => 5], 'extraNote' => 'کلاس تقویتی'],
        ])->assertOk();

        $this->actingAs($teacher)->get('/teacher-timesheets')->assertRedirect('/');
        $this->actingAs($teacher)->getJson('/api/teacher-timesheets?month=aban')->assertStatus(403);

        $this->actingAs($vice)->get('/teacher-timesheets')->assertOk();
        $row = collect($this->actingAs($vice)->getJson('/api/teacher-timesheets?month=aban')->assertOk()->json('teachers'))->firstWhere('id', $teacher->id);
        $this->assertSame(6.5, (float) $row['hours']);
        $this->assertSame(1, $row['days']);
        $this->assertSame(9, $row['scoreTotal']);
        $this->assertSame('کلاس تقویتی', $row['extraNote']);
    }

    public function test_managers_can_save_their_own_hours(): void
    {
        foreach (['vice_educational', 'vice_disciplinary', 'vice_nurturing', 'vice_principal', 'coach', 'admin'] as $i => $role) {
            $u = $this->makeUser($role, ['phone' => '0912000071'.$i]);
            $this->actingAs($u)->postJson('/api/teacher-timesheet', [
                'month' => 'aban', 'entries' => ['1405/08/01' => ['in' => '08:00', 'tags' => ['teaching']]], 'selfEvaluation' => ['scores' => []],
            ])->assertOk();
        }
    }

    public function test_config_endpoint_feeds_the_panel(): void
    {
        $teacher = $this->makeUser('teacher', ['phone' => '09120000081']);
        $this->getJson('/api/teacher-timesheet/config')->assertStatus(401);
        $res = $this->actingAs($teacher)->getJson('/api/teacher-timesheet/config')->assertOk();
        $this->assertCount(9, $res->json('months'));
        $this->assertCount(5, $res->json('axes'));
        $this->assertArrayHasKey('teaching', $res->json('tags'));
    }

    public function test_teacher_can_add_up_to_four_custom_axes_and_they_carry_to_next_month(): void
    {
        $t = $this->makeUser('teacher', ['phone' => '09120000041']);
        $base = ['month' => 'aban', 'entries' => []];
        $custom = [
            ['id' => 'c1', 'title' => 'مشارکت فرهنگی'], ['id' => 'c2', 'title' => 'پیگیری اولیا'],
            ['id' => 'c3', 'title' => 'کلاس تقویتی'], ['id' => 'c4', 'title' => 'همکاری با همکاران'],
        ];
        $this->actingAs($t)->postJson('/api/teacher-timesheet', $base + ['selfEvaluation' => ['scores' => ['c1' => 5, 'growth' => 3], 'customAxes' => $custom]])->assertOk();

        // پنجمین شاخص (یا شناسه‌ی نامعتبر) پذیرفته نمی‌شود
        $this->actingAs($t)->postJson('/api/teacher-timesheet', $base + ['selfEvaluation' => ['scores' => [], 'customAxes' => array_merge($custom, [['id' => 'c5', 'title' => 'پنجم']])]])->assertStatus(422);

        $aban = $this->actingAs($t)->getJson('/api/teacher-timesheet?month=aban')->assertOk();
        $this->assertCount(4, $aban->json('customAxes'));
        $this->assertSame(5, $aban->json('selfEvaluation.scores.c1'));
        // ماه بعد همان عنوان‌ها پیش‌نمایش داده می‌شود
        $azar = $this->actingAs($t)->getJson('/api/teacher-timesheet?month=azar')->assertOk();
        $this->assertSame('مشارکت فرهنگی', $azar->json('customAxes.0.title'));

        // استاد دیگر شاخص‌های این استاد را نمی‌بیند
        $other = $this->makeUser('teacher', ['phone' => '09120000042']);
        $this->assertSame([], $this->actingAs($other)->getJson('/api/teacher-timesheet?month=aban')->json('customAxes'));
    }

    public function test_only_school_admin_can_edit_axes(): void
    {
        $axes = [['id' => 'growth', 'title' => 'ارتقاء شخصی'], ['id' => null, 'title' => 'همکاری با تیم']];
        $teacher = $this->makeUser('teacher', ['phone' => '09120000043']);
        $this->actingAs($teacher)->putJson('/api/teacher-timesheet/axes', ['axes' => $axes])->assertStatus(403);
        $vice = $this->makeUser('vice_educational', ['phone' => '09120000044']);
        $this->actingAs($vice)->putJson('/api/teacher-timesheet/axes', ['axes' => $axes])->assertStatus(403);

        $admin = $this->makeUser('admin', ['phone' => '09120000045']);
        $res = $this->actingAs($admin)->putJson('/api/teacher-timesheet/axes', ['axes' => $axes])->assertOk();
        $this->assertSame('growth', $res->json('axes.0.id'));
        $this->assertNotEmpty($res->json('axes.1.id'));

        $this->actingAs($teacher)->getJson('/api/teacher-timesheet/config')->assertJsonCount(2, 'axes');
        $this->actingAs($admin)->putJson('/api/teacher-timesheet/axes', ['axes' => []])->assertStatus(422);
    }
}
