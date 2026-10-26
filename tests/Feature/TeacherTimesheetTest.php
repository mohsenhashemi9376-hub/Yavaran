<?php

namespace Tests\Feature;

use App\Support\TimesheetCalendar;
use Tests\TestCase;

/** ساعت کاری و خودارزیابی اساتید: هر استاد فقط دادهٔ خودش را می‌بیند و می‌نویسد */
class TeacherTimesheetTest extends TestCase
{
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

        // هیچ تاریخی پیش از ۱ مهر ۱۴۰۵ نیست؛ پنج‌شنبه و جمعه تعطیل‌اند
        $mehr = TimesheetCalendar::month('mehr');
        $this->assertSame('1405/07/01', $mehr['days'][0]['date']);
        $this->assertSame('مهر ۱۴۰۵ (۱ تا ۲۵ مهر)', $mehr['label']);
        $this->assertCount(25, $mehr['days']);
        // 1405/07/14 سه‌شنبه، 1405/07/16 پنج‌شنبه، 1405/07/17 جمعه
        $byDate = array_column($mehr['days'], 'off', 'date');
        $this->assertFalse($byDate['1405/07/14']);
        $this->assertTrue($byDate['1405/07/16']);
        $this->assertTrue($byDate['1405/07/17']);
        $all = array_merge(...array_map(fn ($m) => array_column($m['days'], 'date'), TimesheetCalendar::months()));
        $this->assertSame('1405/07/01', min($all));
        $this->assertSame('1406/03/25', max($all));

        $this->assertSame(['mehr', 'aban', 'azar', 'dey', 'bahman', 'esfand', 'farvardin', 'ordibehesht', 'khordad'], TimesheetCalendar::keys());
    }

    public function test_guest_is_redirected_and_teacher_sees_page(): void
    {
        $this->get('/teacher-timesheet')->assertRedirect('/');

        $teacher = $this->makeUser('teacher');
        $this->actingAs($teacher)->get('/teacher-timesheet')
            ->assertOk()
            ->assertSee('ساعت کاری و خودارزیابی')
            ->assertSee('۱۴۰۵-۱۴۰۶');
    }

    public function test_save_and_load_are_per_user_and_month(): void
    {
        $a = $this->makeUser('teacher', ['phone' => '09120000031']);
        $b = $this->makeUser('teacher', ['phone' => '09120000032']);

        $payload = [
            'month' => 'aban',
            'entries' => [
                '1405/07/26' => ['in' => '08:00', 'out' => '14:30', 'tags' => ['teaching', 'council']],
                '1399/01/01' => ['in' => '08:00', 'out' => '09:00', 'tags' => []],
            ],
            'selfEvaluation' => ['scores' => ['growth' => 4, 'extra' => 5], 'extraNote' => 'کلاس تقویتی'],
        ];
        $this->actingAs($a)->postJson('/api/teacher-timesheet', $payload)->assertOk();

        $res = $this->actingAs($a)->getJson('/api/teacher-timesheet?month=aban')->assertOk();
        $this->assertSame(['1405/07/26'], array_keys($res->json('entries')));
        $this->assertSame('08:00', $res->json('entries.1405/07/26.in'));
        $this->assertSame(['teaching', 'council'], $res->json('entries.1405/07/26.tags'));
        $this->assertSame(5, $res->json('selfEvaluation.scores.extra'));
        $this->assertSame('کلاس تقویتی', $res->json('selfEvaluation.extraNote'));

        $this->actingAs($b)->getJson('/api/teacher-timesheet?month=aban')->assertOk()->assertJson(['entries' => []]);
        $this->actingAs($a)->getJson('/api/teacher-timesheet?month=azar')->assertOk()->assertJson(['entries' => []]);
    }

    public function test_rejects_bad_month_time_and_score(): void
    {
        $u = $this->makeUser('teacher');
        $this->actingAs($u)->getJson('/api/teacher-timesheet?month=mehr')->assertStatus(422);
        $this->actingAs($u)->postJson('/api/teacher-timesheet', [
            'month' => 'aban', 'entries' => ['1405/07/26' => ['in' => '25:99']], 'selfEvaluation' => ['scores' => []],
        ])->assertStatus(422);
        $this->actingAs($u)->postJson('/api/teacher-timesheet', [
            'month' => 'aban', 'entries' => [], 'selfEvaluation' => ['scores' => ['growth' => 6]],
        ])->assertStatus(422);
    }
}
