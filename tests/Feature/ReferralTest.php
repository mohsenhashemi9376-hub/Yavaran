<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** ارجاع دانش‌آموز از معاون انضباطی به معاون تربیتی */
class ReferralTest extends TestCase
{
    private function payload(array $over = []): array
    {
        return array_merge(['studentId' => 'stu-1', 'kind' => 'absence', 'month' => '1405/07', 'summary' => '۳ روز غیبت غیرموجه', 'note' => 'پیگیری شود'], $over);
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->makeClass('cls-1');
        $this->makeStudent('stu-1', 'cls-1');
    }

    public function test_disciplinary_vice_refers_and_nurturing_vice_gets_notified_once(): void
    {
        $nurturing = $this->makeUser('vice_nurturing');
        $vice = $this->makeUser('vice_disciplinary');

        $this->actingAs($vice)->postJson('/api/referrals', $this->payload())->assertCreated();
        $this->actingAs($vice)->postJson('/api/referrals', $this->payload())->assertOk()->assertJsonPath('duplicate', true);

        $this->assertSame(1, DB::table('notifications')->where('receiver_id', $nurturing->id)->where('type', 'referral')->count());
        $this->actingAs($vice)->getJson('/api/referrals')->assertOk()->assertJsonPath('referrals.0', 'ref-stu-1-absence-1405-07');
    }

    public function test_only_disciplinary_vice_can_refer(): void
    {
        $this->makeUser('vice_nurturing');
        foreach (['teacher', 'coach', 'vice_educational', 'vice_nurturing', 'admin'] as $role) {
            $this->actingAs($this->makeUser($role))->postJson('/api/referrals', $this->payload())->assertForbidden();
        }
    }
}
