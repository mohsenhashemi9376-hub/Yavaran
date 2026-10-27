<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CleanStudentPlaceholdersTest extends TestCase
{
    private function student(string $id, string $national, string $code): void
    {
        DB::table('students')->insert([
            'id' => $id, 'class_id' => null, 'first_name' => 'الف', 'last_name' => 'ب', 'national_id' => $national, 'student_code' => $code,
            'data' => json_encode(['id' => $id, 'nationalId' => $national, 'studentCode' => $code], JSON_UNESCAPED_UNICODE),
            'sort_order' => 0, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_dry_run_changes_nothing_and_apply_clears_only_fakes(): void
    {
        $this->student('s1', '0012345678', '12345678');   // ساختگی (۰۰ + کد)
        $this->student('s2', '۰۰۰۰۰۰۰۰۰۰', '555555');      // ساختگی (پیش‌فرض)
        $this->student('s3', '0074939204', '987654');      // واقعی؛ نباید دست بخورد

        $this->artisan('students:clean-placeholders')->assertSuccessful();
        $this->assertSame('0012345678', DB::table('students')->where('id', 's1')->value('national_id'));

        $this->artisan('students:clean-placeholders', ['--apply' => true])->assertSuccessful();
        $this->assertNull(DB::table('students')->where('id', 's1')->value('national_id'));
        $this->assertNull(DB::table('students')->where('id', 's2')->value('national_id'));
        $this->assertSame('0074939204', DB::table('students')->where('id', 's3')->value('national_id'));
        $this->assertSame('987654', DB::table('students')->where('id', 's3')->value('student_code'));
        $this->assertSame('555555', json_decode(DB::table('students')->where('id', 's2')->value('data'), true)['studentCode']);
    }
}
