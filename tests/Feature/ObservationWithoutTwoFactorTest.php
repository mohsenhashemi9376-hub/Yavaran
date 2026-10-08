<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

/**
 * تا زمانی که ورود دومرحله‌ای فعال نشده: ثبت مشاهده‌گری جدید آزاد است، اما هیچ سابقه‌ای
 * (حتی مشاهده‌گری‌های خودِ کاربر) خوانده، ویرایش یا حذف نمی‌شود.
 */
class ObservationWithoutTwoFactorTest extends TestCase
{
    private User $coach;

    private User $vice;

    protected function setUp(): void
    {
        parent::setUp();
        $this->makeClass('cls-1');
        $this->makeStudent('stu-1', 'cls-1');
        $this->coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-1']]);
        $this->vice = $this->makeUser('vice_nurturing');
    }

    private function obs(string $id, string $text = 'متن'): array
    {
        return ['id' => $id, 'data' => [
            'id' => $id, 'studentId' => 'stu-1', 'date' => '1405/07/14', 'time' => '10:30', 'title' => 'عنوان', 'content' => $text, 'recordedBy' => 'x',
        ]];
    }

    private function save(User $user, array $upserts = [], array $deletes = [])
    {
        return $this->actingAs($user)->postJson('/api/sync', ['collection' => 'observations', 'upserts' => $upserts, 'deletes' => $deletes]);
    }

    public function test_coach_and_vice_can_record_an_observation_without_two_factor(): void
    {
        $this->save($this->coach, [$this->obs('o-coach')])->assertOk();
        $this->save($this->vice, [$this->obs('o-vice')])->assertOk();

        $this->assertDatabaseHas('student_observations', ['id' => 'o-coach', 'author_id' => $this->coach->id]);
        $this->assertDatabaseHas('student_observations', ['id' => 'o-vice', 'author_id' => $this->vice->id]);
    }

    public function test_no_history_is_returned_without_two_factor_even_own_observations(): void
    {
        $this->save($this->coach, [$this->obs('o-1')])->assertOk();
        $this->save($this->vice, [$this->obs('o-2')])->assertOk();

        foreach ([$this->coach, $this->vice] as $user) {
            $res = $this->actingAs($user)->getJson('/api/bootstrap')->assertOk();
            $this->assertSame([], $res->json('data.observations'));
            $this->assertSame([], $res->json('data.nurturingDossiers'));
            $this->assertSame([], $res->json('data.coachEvaluations'));
        }
    }

    public function test_history_appears_after_two_factor_is_enabled(): void
    {
        $this->save($this->coach, [$this->obs('o-1')])->assertOk();
        $this->enableTwoFactor($this->coach);

        $ids = collect($this->actingAs($this->coach)->getJson('/api/bootstrap')->json('data.observations'))->pluck('id')->all();
        $this->assertSame(['o-1'], $ids);
    }

    public function test_existing_observation_cannot_be_overwritten_or_deleted_without_two_factor(): void
    {
        $this->save($this->coach, [$this->obs('o-1', 'اصلی')])->assertOk();

        $this->save($this->coach, [$this->obs('o-1', 'تغییر')])->assertStatus(403);
        $this->save($this->coach, [], ['o-1'])->assertStatus(403);
        $this->assertDatabaseHas('student_observations', ['id' => 'o-1']);
    }

    public function test_recording_still_respects_class_scope(): void
    {
        $this->makeClass('cls-other');
        $this->makeStudent('stu-other', 'cls-other');
        $row = $this->obs('o-x');
        $row['data']['studentId'] = 'stu-other';

        $this->save($this->coach, [$row])->assertStatus(403);
    }

    public function test_dossiers_and_evaluations_still_require_two_factor_for_writing(): void
    {
        $res = $this->actingAs($this->coach)->postJson('/api/sync', ['collection' => 'nurturingDossiers', 'upserts' => [
            ['id' => 'stu-1', 'data' => ['id' => 'stu-1', 'studentId' => 'stu-1']],
        ], 'deletes' => []]);

        $res->assertStatus(403);
    }
}
