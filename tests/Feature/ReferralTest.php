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

    public function test_warning_and_attention_kinds_are_accepted_with_note(): void
    {
        $nurturing = $this->makeUser('vice_nurturing');
        $vice = $this->makeUser('vice_disciplinary');

        foreach (['warning', 'attention'] as $kind) {
            $this->actingAs($vice)->postJson('/api/referrals', $this->payload(['kind' => $kind]))->assertCreated();
        }
        $msg = DB::table('notifications')->where('receiver_id', $nurturing->id)->where('ref_id', 'ref-stu-1-warning-1405-07')->value('message');
        $this->assertStringContainsString('توضیح: پیگیری شود', $msg);
        $this->actingAs($vice)->postJson('/api/referrals', $this->payload(['kind' => 'bogus']))->assertUnprocessable();
    }

    public function test_bulk_refer_and_history_views(): void
    {
        $nurturing = $this->makeUser('vice_nurturing');
        $vice = $this->makeUser('vice_disciplinary');
        $this->makeStudent('stu-2', 'cls-1');

        $res = $this->actingAs($vice)->postJson('/api/referrals/bulk', [
            'kind' => 'warning', 'month' => '1405/07', 'note' => 'مشترک',
            'items' => [
                ['studentId' => 'stu-1', 'summary' => 'الف'],
                ['studentId' => 'stu-2', 'summary' => 'ب'],
                ['studentId' => 'stu-1', 'summary' => 'تکراری'],
                ['studentId' => 'nope', 'summary' => 'ج'],
            ],
        ])->assertCreated();
        $this->assertCount(2, $res->json('created'));
        $this->assertSame(['nope'], $res->json('missing'));

        $this->actingAs($vice)->getJson('/api/referrals/history')->assertOk()->assertJsonCount(2, 'referrals');
        $this->actingAs($nurturing)->getJson('/api/referrals/history?studentId=stu-1')->assertOk()
            ->assertJsonCount(1, 'referrals')->assertJsonPath('referrals.0.kind', 'warning')->assertJsonPath('referrals.0.seen', false);
        $this->actingAs($this->makeUser('teacher'))->getJson('/api/referrals/history')->assertForbidden();
        $this->actingAs($nurturing)->postJson('/api/referrals/bulk', ['kind' => 'warning', 'month' => '1405/07', 'items' => [['studentId' => 'stu-1', 'summary' => 'x']]])->assertForbidden();
    }
}
