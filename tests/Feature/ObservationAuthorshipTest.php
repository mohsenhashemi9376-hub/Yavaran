<?php

namespace Tests\Feature;

use App\Models\StudentObservation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

/**
 * مشاهده‌گری‌های معاون تربیتی برای مربی پنهان است؛ مشاهده‌گری‌های مربی را معاون تربیتی می‌بیند؛
 * ویرایش و حذف فقط با نویسنده است.
 */
class ObservationAuthorshipTest extends TestCase
{
    private User $vice;

    private User $coach;

    protected function setUp(): void
    {
        parent::setUp();

        $this->makeClass('cls-1');
        $this->makeStudent('stu-1', 'cls-1');
        $this->vice = $this->makeUser('vice_nurturing');
        $this->coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-1']]);
        $this->enableTwoFactor($this->vice);
        $this->enableTwoFactor($this->coach);
    }

    private function obs(string $id, string $text = 'متن مشاهده', array $extra = []): array
    {
        return ['id' => $id, 'data' => array_merge([
            'id' => $id, 'studentId' => 'stu-1', 'date' => '1405/07/14', 'title' => 'عنوان', 'content' => $text, 'recordedBy' => 'x',
        ], $extra)];
    }

    private function save(User $user, array $upserts = [], array $deletes = [])
    {
        return $this->actingAs($user)->postJson('/api/sync', ['collection' => 'observations', 'upserts' => $upserts, 'deletes' => $deletes]);
    }

    private function visibleIds(User $user): array
    {
        $ids = collect($this->actingAs($user)->getJson('/api/bootstrap')->assertOk()->json('data.observations'))->pluck('id')->all();
        sort($ids);

        return $ids;
    }

    private function legacy(string $id): void
    {
        (new StudentObservation)->forceFill([
            'id' => $id, 'student_id' => 'stu-1', 'record_date' => '1405/07/01', 'sort_order' => 0,
            'data' => json_encode(['id' => $id, 'studentId' => 'stu-1', 'content' => 'قدیمی', 'recordedBy' => 'معاون']),
        ])->save();
    }

    // ---------- ثبت نویسنده ----------

    public function test_author_is_stamped_by_the_server(): void
    {
        $this->save($this->coach, [$this->obs('o-coach')])->assertOk();
        $this->save($this->vice, [$this->obs('o-vice')])->assertOk();

        $this->assertDatabaseHas('student_observations', ['id' => 'o-coach', 'author_id' => $this->coach->id, 'author_role' => 'coach']);
        $this->assertDatabaseHas('student_observations', ['id' => 'o-vice', 'author_id' => $this->vice->id, 'author_role' => 'vice_nurturing']);
    }

    public function test_client_cannot_spoof_the_author(): void
    {
        $this->save($this->vice, [$this->obs('o-1', 'x', ['authorId' => $this->coach->id, 'authorRole' => 'coach'])])->assertOk();

        $this->assertDatabaseHas('student_observations', ['id' => 'o-1', 'author_id' => $this->vice->id, 'author_role' => 'vice_nurturing']);
        $stored = json_decode(StudentObservation::query()->find('o-1')->data, true);
        $this->assertSame($this->vice->id, $stored['authorId']);
        $this->assertSame('vice_nurturing', $stored['authorRole']);
    }

    public function test_author_is_stored_inside_encrypted_payload_too(): void
    {
        $this->save($this->coach, [$this->obs('o-1')])->assertOk();

        $raw = (string) DB::table('student_observations')->where('id', 'o-1')->value('data');
        $this->assertStringNotContainsString('authorRole', $raw);
        $this->assertStringNotContainsString('متن مشاهده', $raw);
    }

    // ---------- دیدن ----------

    public function test_coach_does_not_see_vice_observations_but_vice_sees_everything(): void
    {
        $this->save($this->coach, [$this->obs('o-coach')])->assertOk();
        $this->save($this->vice, [$this->obs('o-vice')])->assertOk();

        $this->assertSame(['o-coach'], $this->visibleIds($this->coach));
        $this->assertSame(['o-coach', 'o-vice'], $this->visibleIds($this->vice));
    }

    public function test_hidden_observation_text_never_reaches_the_coach(): void
    {
        $this->save($this->vice, [$this->obs('o-vice', 'راز-معاون-تربیتی')])->assertOk();

        $body = $this->actingAs($this->coach)->getJson('/api/bootstrap')->assertOk()->getContent();

        $this->assertStringNotContainsString('راز-معاون-تربیتی', $body);
    }

    public function test_coach_does_not_see_observations_of_other_coaches_even_in_the_same_class(): void
    {
        $other = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-1']]);
        $this->enableTwoFactor($other);
        $this->save($other, [$this->obs('o-other', 'راز-مربی-دیگر')])->assertOk();
        $this->save($this->coach, [$this->obs('o-mine')])->assertOk();

        $this->assertSame(['o-mine'], $this->visibleIds($this->coach));
        $this->assertSame(['o-other'], $this->visibleIds($other));
        $this->assertSame(['o-mine', 'o-other'], $this->visibleIds($this->vice));
        $this->assertStringNotContainsString('راز-مربی-دیگر', $this->actingAs($this->coach)->getJson('/api/bootstrap')->getContent());
    }

    public function test_coach_loses_access_to_own_old_observations_when_reassigned_to_another_class(): void
    {
        $this->save($this->coach, [$this->obs('o-mine')])->assertOk();
        $this->makeClass('cls-2');
        $this->makeStudent('stu-2', 'cls-2');
        $profile = json_decode((string) DB::table('users')->where('id', $this->coach->id)->value('data'), true);
        $profile['assignedClassIds'] = ['cls-2'];
        DB::table('users')->where('id', $this->coach->id)->update(['data' => json_encode($profile)]);
        $this->coach->refresh();

        $this->assertSame([], $this->visibleIds($this->coach));
        $this->save($this->coach, [$this->obs('o-mine', 'تغییر')])->assertForbidden();
    }

    public function test_coach_cannot_read_dossiers_or_observations_of_other_classes(): void
    {
        $this->makeClass('cls-2');
        $this->makeStudent('stu-2', 'cls-2');
        $this->makeDossier('stu-2', ['note' => 'پرونده-کلاس-دیگر']);
        $this->makeDossier('stu-1', ['note' => 'پرونده-کلاس-من']);
        (new StudentObservation)->forceFill([
            'id' => 'o-foreign', 'student_id' => 'stu-2', 'sort_order' => 0, 'author_id' => $this->coach->id, 'author_role' => 'coach',
            'data' => json_encode(['id' => 'o-foreign', 'studentId' => 'stu-2', 'content' => 'مشاهده-کلاس-دیگر']),
        ])->save();

        $body = $this->actingAs($this->coach)->getJson('/api/bootstrap')->assertOk()->getContent();

        $this->assertStringContainsString('پرونده-کلاس-من', $body);
        $this->assertStringNotContainsString('پرونده-کلاس-دیگر', $body);
        $this->assertStringNotContainsString('مشاهده-کلاس-دیگر', $body);
        $this->actingAs($this->coach)->getJson('/api/students/stu-2/nurturing-record')->assertForbidden();
    }

    public function test_legacy_observations_without_author_are_hidden_from_coach_but_visible_to_vice(): void
    {
        $this->legacy('o-legacy');

        $this->assertSame([], $this->visibleIds($this->coach));
        $this->assertSame(['o-legacy'], $this->visibleIds($this->vice));
    }

    // ---------- ویرایش و حذف ----------

    public function test_coach_cannot_overwrite_or_delete_a_vice_observation(): void
    {
        $this->save($this->vice, [$this->obs('o-vice', 'اصلی')])->assertOk();

        $this->save($this->coach, [$this->obs('o-vice', 'دستکاری')])->assertForbidden();
        $this->save($this->coach, [], ['o-vice'])->assertForbidden();

        $this->assertSame('اصلی', json_decode(StudentObservation::query()->find('o-vice')->data, true)['content']);
    }

    public function test_vice_can_see_but_not_edit_or_delete_coach_observations(): void
    {
        $this->save($this->coach, [$this->obs('o-coach', 'اصلی')])->assertOk();

        $this->save($this->vice, [$this->obs('o-coach', 'تغییر')])->assertForbidden();
        $this->save($this->vice, [], ['o-coach'])->assertForbidden();

        $this->assertSame('اصلی', json_decode(StudentObservation::query()->find('o-coach')->data, true)['content']);
        $this->assertContains('o-coach', $this->visibleIds($this->vice));
    }

    public function test_authors_can_edit_and_delete_their_own(): void
    {
        $this->save($this->coach, [$this->obs('o-c')])->assertOk();
        $this->save($this->vice, [$this->obs('o-v')])->assertOk();

        $this->save($this->coach, [$this->obs('o-c', 'ویرایش مربی')])->assertOk();
        $this->save($this->vice, [$this->obs('o-v', 'ویرایش معاون')])->assertOk();
        $this->assertDatabaseHas('student_observations', ['id' => 'o-c', 'author_id' => $this->coach->id]);

        $this->save($this->coach, [], ['o-c'])->assertOk();
        $this->save($this->vice, [], ['o-v'])->assertOk();
        $this->assertSame(0, DB::table('student_observations')->count());
    }

    public function test_one_coach_cannot_edit_another_coachs_observation(): void
    {
        $other = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-1']]);
        $this->enableTwoFactor($other);
        $this->save($other, [$this->obs('o-other', 'اصلی')])->assertOk();

        $this->save($this->coach, [$this->obs('o-other', 'تغییر')])->assertForbidden();
    }

    public function test_editing_cannot_change_the_author(): void
    {
        $this->save($this->coach, [$this->obs('o-1')])->assertOk();

        $this->save($this->coach, [$this->obs('o-1', 'ویرایش', ['authorId' => $this->vice->id, 'authorRole' => 'vice_nurturing'])])->assertOk();

        $this->assertDatabaseHas('student_observations', ['id' => 'o-1', 'author_id' => $this->coach->id, 'author_role' => 'coach']);
    }

    public function test_vice_can_manage_legacy_observations_and_becomes_their_author(): void
    {
        $this->legacy('o-legacy');

        $this->save($this->coach, [$this->obs('o-legacy', 'تغییر مربی')])->assertForbidden();
        $this->save($this->vice, [$this->obs('o-legacy', 'ویرایش معاون')])->assertOk();

        $this->assertDatabaseHas('student_observations', ['id' => 'o-legacy', 'author_id' => $this->vice->id, 'author_role' => 'vice_nurturing']);
        $this->assertSame([], $this->visibleIds($this->coach));
    }

    public function test_coach_cannot_move_a_vice_observation_to_another_student(): void
    {
        $this->makeClass('cls-2');
        $this->makeStudent('stu-2', 'cls-2');
        $this->save($this->vice, [$this->obs('o-vice')])->assertOk();

        $this->save($this->coach, [$this->obs('o-vice', 'x', ['studentId' => 'stu-2'])])->assertForbidden();
    }

    // ---------- Policy مستقیم ----------

    public function test_policy_decisions(): void
    {
        $byVice = new StudentObservation;
        $byVice->student_id = 'stu-1';
        $byVice->author_id = $this->vice->id;
        $byVice->author_role = 'vice_nurturing';
        $byCoach = new StudentObservation;
        $byCoach->student_id = 'stu-1';
        $byCoach->author_id = $this->coach->id;
        $byCoach->author_role = 'coach';

        $coach = Gate::forUser($this->coach);
        $vice = Gate::forUser($this->vice);

        $otherCoach = new StudentObservation;
        $otherCoach->student_id = 'stu-1';
        $otherCoach->author_id = 'someone-else';
        $otherCoach->author_role = 'coach';

        $this->assertFalse($coach->allows('view', $byVice));
        $this->assertFalse($coach->allows('view', $otherCoach));
        $this->assertTrue($coach->allows('view', $byCoach));
        $this->assertTrue($vice->allows('view', $otherCoach));
        $this->assertTrue($vice->allows('view', $byVice));
        $this->assertTrue($vice->allows('view', $byCoach));
        $this->assertTrue($coach->allows('update', $byCoach));
        $this->assertFalse($coach->allows('delete', $byVice));
        $this->assertFalse($vice->allows('update', $byCoach));
        $this->assertTrue($vice->allows('delete', $byVice));
    }

    // ---------- مهاجرت ----------

    public function test_migration_backfills_author_from_recorded_by_name(): void
    {
        DB::table('users')->where('id', $this->coach->id)->update(['name' => 'مربی یکتا']);
        $this->legacy('o-by-coach');
        $this->legacy('o-unknown');
        $row = StudentObservation::query()->find('o-by-coach');
        $row->forceFill(['data' => json_encode(['id' => 'o-by-coach', 'studentId' => 'stu-1', 'recordedBy' => 'مربی یکتا'])])->save();

        (require base_path('database/migrations/2026_10_18_000000_add_author_to_student_observations.php'))->up();

        $this->assertDatabaseHas('student_observations', ['id' => 'o-by-coach', 'author_id' => $this->coach->id, 'author_role' => 'coach']);
        $this->assertDatabaseHas('student_observations', ['id' => 'o-unknown', 'author_id' => null]);
    }
}
