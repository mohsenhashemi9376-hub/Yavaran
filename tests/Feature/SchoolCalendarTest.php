<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\SchoolCalendar;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** جمعه‌ها روز درسی نیستند؛ تعطیلی اعلام‌شده (مدیر / معاون انضباطی) حضور و غیاب آن روز را می‌بندد */
class SchoolCalendarTest extends TestCase
{
    // ۱۴۰۵/۰۷/۱۴ = سه‌شنبه؛ ۱۴۰۵/۰۷/۱۷ = جمعه؛ ۱۴۰۵/۰۷/۱۸ = شنبه
    private const TUESDAY = '1405/07/14';

    private const FRIDAY = '1405/07/17';

    private const SATURDAY = '1405/07/18';

    protected function setUp(): void
    {
        parent::setUp();
        SchoolCalendar::reset();
        $this->makeClass('cls-1');
        $this->makeStudent('stu-1', 'cls-1');
    }

    private function sync(User $u, string $collection, array $upserts = [], array $deletes = [])
    {
        return $this->actingAs($u)->postJson('/api/sync', ['collection' => $collection, 'upserts' => $upserts, 'deletes' => $deletes]);
    }

    private function morning(string $date, string $id = 'm-1'): array
    {
        return ['id' => $id, 'data' => ['id' => $id, 'studentId' => 'stu-1', 'classId' => 'cls-1', 'date' => $date, 'dayOfWeek' => 'x', 'status' => 'present', 'delayMinutes' => 0, 'isAcknowledged' => false]];
    }

    private function holiday(string $date, ?string $title = null): array
    {
        $id = 'hol-'.str_replace('/', '-', $date);

        return ['id' => $id, 'data' => ['id' => $id, 'date' => $date, 'title' => $title]];
    }

    public function test_calendar_detects_fridays_and_declared_holidays(): void
    {
        $this->assertNull(SchoolCalendar::closedReason(self::TUESDAY));
        $this->assertSame('friday', SchoolCalendar::closedReason(self::FRIDAY));
        $this->assertSame('friday', SchoolCalendar::closedReason('۱۴۰۵/۰۷/۱۷'));
        $this->assertNull(SchoolCalendar::closedReason(self::SATURDAY));
        $this->assertNull(SchoolCalendar::closedReason('garbage'));
        $this->assertNull(SchoolCalendar::closedReason(null));
    }

    public function test_morning_attendance_is_closed_on_fridays(): void
    {
        $vice = $this->makeUser('vice_disciplinary');
        $this->sync($vice, 'morningAttendance', [$this->morning(self::FRIDAY)])->assertStatus(422);
        $this->assertDatabaseCount('morning_attendance', 0);

        $this->sync($vice, 'morningAttendance', [$this->morning(self::TUESDAY)])->assertOk();
    }

    public function test_class_sessions_and_ledgers_are_closed_on_fridays(): void
    {
        $teacher = $this->makeUser('teacher', [], ['teachingClassIds' => ['cls-1']]);
        $this->sync($teacher, 'sessions', [['id' => 's1', 'data' => ['id' => 's1', 'classId' => 'cls-1', 'teacherId' => $teacher->id, 'subject' => 'x', 'date' => self::FRIDAY, 'lessonTopic' => 'مبحث', 'records' => []]]])->assertStatus(422);
        $this->assertDatabaseCount('attendance_sessions', 0);

        $vice = $this->makeUser('vice_disciplinary');
        foreach (['morningDelays', 'schoolAbsences'] as $c) {
            $this->sync($vice, $c, [['id' => 'x-'.$c, 'data' => ['id' => 'x-'.$c, 'studentId' => 'stu-1', 'classId' => 'cls-1', 'date' => self::FRIDAY, 'delayMinutes' => 5, 'recordedBy' => 'x']]])->assertStatus(422);
        }
    }

    public function test_admin_and_disciplinary_vice_declare_and_cancel_holidays(): void
    {
        foreach (['admin', 'vice_disciplinary'] as $role) {
            $u = $this->makeUser($role, ['name' => 'ثبت‌کننده']);
            $this->sync($u, 'schoolHolidays', [$this->holiday(self::TUESDAY, 'برف')])->assertOk();
            $this->assertDatabaseHas('school_holidays', ['holiday_date' => self::TUESDAY]);
            $stored = json_decode((string) DB::table('school_holidays')->value('data'), true);
            $this->assertSame('ثبت‌کننده', $stored['setBy']);
            $this->assertSame('برف', $stored['title']);

            $this->sync($u, 'schoolHolidays', [], ['hol-1405-07-14'])->assertOk();
            $this->assertDatabaseCount('school_holidays', 0);
        }
    }

    public function test_declared_holiday_closes_attendance_and_cancelling_reopens_it(): void
    {
        $vice = $this->makeUser('vice_disciplinary');
        $this->sync($vice, 'schoolHolidays', [$this->holiday(self::TUESDAY)])->assertOk();

        $this->sync($vice, 'morningAttendance', [$this->morning(self::TUESDAY)])->assertStatus(422)->assertJsonFragment(['message' => 'این روز تعطیل اعلام شده است و ثبت حضور و غیاب در آن ممکن نیست.']);
        $this->sync($vice, 'morningAttendance', [$this->morning(self::SATURDAY, 'm-2')])->assertOk();

        $this->sync($vice, 'schoolHolidays', [], ['hol-1405-07-14'])->assertOk();
        $this->sync($vice, 'morningAttendance', [$this->morning(self::TUESDAY)])->assertOk();
    }

    public function test_other_roles_cannot_declare_holidays_but_everyone_can_read_them(): void
    {
        foreach (['vice_educational', 'vice_nurturing', 'vice_principal', 'coach', 'teacher'] as $role) {
            $this->sync($this->makeUser($role), 'schoolHolidays', [$this->holiday(self::TUESDAY)])->assertStatus(403);
        }
        $this->assertDatabaseCount('school_holidays', 0);

        $this->sync($this->makeUser('admin'), 'schoolHolidays', [$this->holiday(self::TUESDAY)])->assertOk();
        foreach (['vice_educational', 'coach', 'teacher', 'vice_nurturing'] as $role) {
            $rows = $this->actingAs($this->makeUser($role))->getJson('/api/bootstrap')->json('data.schoolHolidays');
            $this->assertSame(['hol-1405-07-14'], array_column($rows, 'id'), $role);
        }
    }

    public function test_invalid_holiday_payloads_are_rejected(): void
    {
        $admin = $this->makeUser('admin');
        $this->sync($admin, 'schoolHolidays', [['id' => 'hol-x', 'data' => ['id' => 'hol-x', 'date' => self::TUESDAY]]])->assertStatus(422);
        $this->sync($admin, 'schoolHolidays', [$this->holiday('امروز')])->assertStatus(422);
        $this->assertDatabaseCount('school_holidays', 0);
    }
}
