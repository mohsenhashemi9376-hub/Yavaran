<?php

namespace Tests\Feature;

use App\Models\CoachEvaluation;
use App\Models\NurturingDossier;
use App\Models\StudentObservation;
use App\Support\Sync\NurturingEncryptor;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class NurturingEncryptionTest extends TestCase
{
    private const SECRET_TEXT = 'یادداشت بسیار محرمانه';

    private function rawData(string $table, string $id): string
    {
        return (string) DB::table($table)->where('id', $id)->value('data');
    }

    public function test_dossier_content_is_encrypted_at_rest(): void
    {
        $this->makeDossier('stu-1');

        $raw = $this->rawData('nurturing_dossiers', 'stu-1');

        $this->assertStringNotContainsString(self::SECRET_TEXT, $raw);
        $this->assertStringNotContainsString('studentId', $raw);
        $this->assertNotSame('{', $raw[0]);
    }

    public function test_model_decrypts_content_transparently(): void
    {
        $this->makeDossier('stu-1');

        $dossier = NurturingDossier::query()->findOrFail('stu-1');

        $this->assertSame(self::SECRET_TEXT, json_decode($dossier->data, true)['note']);
    }

    public function test_all_three_models_use_the_encrypted_cast(): void
    {
        foreach ([StudentObservation::class, NurturingDossier::class, CoachEvaluation::class] as $class) {
            /** @var \App\Models\NurturingRecord $m */
            $m = new $class;
            $this->assertSame(\App\Casts\NurturingEncrypted::class, $m->getCasts()['data'], $class);
        }
    }

    public function test_observation_and_coach_evaluation_are_encrypted_too(): void
    {
        foreach ([[StudentObservation::class, 'student_observations'], [CoachEvaluation::class, 'coach_evaluations']] as [$class, $table]) {
            (new $class)->forceFill([
                'id' => 'rec-1',
                'student_id' => 'stu-1',
                'sort_order' => 0,
                'data' => json_encode(['text' => self::SECRET_TEXT], JSON_UNESCAPED_UNICODE),
            ])->save();

            $this->assertStringNotContainsString(self::SECRET_TEXT, $this->rawData($table, 'rec-1'), $table);
        }
    }

    public function test_index_columns_stay_queryable_and_contain_no_free_text(): void
    {
        $this->makeDossier('stu-1');

        $row = DB::table('nurturing_dossiers')->where('id', 'stu-1')->first();

        $this->assertSame('stu-1', $row->student_id);
    }

    public function test_legacy_plaintext_rows_are_still_readable_and_get_encrypted_on_read(): void
    {
        DB::table('nurturing_dossiers')->insert([
            'id' => 'stu-legacy',
            'student_id' => 'stu-legacy',
            'sort_order' => 0,
            'data' => json_encode(['note' => self::SECRET_TEXT], JSON_UNESCAPED_UNICODE),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $dossier = NurturingDossier::query()->findOrFail('stu-legacy');

        $this->assertSame(self::SECRET_TEXT, json_decode($dossier->data, true)['note']);
        $this->assertStringNotContainsString(self::SECRET_TEXT, $this->rawData('nurturing_dossiers', 'stu-legacy'));
    }

    public function test_encryptor_converts_legacy_rows_and_is_idempotent(): void
    {
        foreach (['nurturing_dossiers', 'student_observations', 'coach_evaluations'] as $table) {
            DB::table($table)->insert([
                'id' => 'legacy-'.$table,
                'student_id' => 'stu-1',
                'sort_order' => 0,
                'data' => json_encode(['note' => self::SECRET_TEXT], JSON_UNESCAPED_UNICODE),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->assertSame(3, NurturingEncryptor::run());
        $this->assertSame(0, NurturingEncryptor::run());

        foreach (['nurturing_dossiers', 'student_observations', 'coach_evaluations'] as $table) {
            $this->assertStringNotContainsString(self::SECRET_TEXT, $this->rawData($table, 'legacy-'.$table));
        }
    }

    public function test_encryptor_command_runs(): void
    {
        DB::table('nurturing_dossiers')->insert([
            'id' => 'stu-x', 'student_id' => 'stu-x', 'sort_order' => 0,
            'data' => json_encode(['note' => self::SECRET_TEXT], JSON_UNESCAPED_UNICODE),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->artisan('nurturing:encrypt')->assertSuccessful();

        $this->assertStringNotContainsString(self::SECRET_TEXT, $this->rawData('nurturing_dossiers', 'stu-x'));
    }

    public function test_content_saved_through_sync_endpoint_is_encrypted(): void
    {
        $this->makeClass('cls-1', ['coachIds' => []]);
        $this->makeStudent('stu-1', 'cls-1');
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);

        $this->actingAs($vice)->postJson('/api/sync', [
            'collection' => 'nurturingDossiers',
            'upserts' => [['id' => 'stu-1', 'data' => ['id' => 'stu-1', 'studentId' => 'stu-1', 'note' => self::SECRET_TEXT]]],
            'deletes' => [],
        ])->assertOk();

        $this->assertStringNotContainsString(self::SECRET_TEXT, $this->rawData('nurturing_dossiers', 'stu-1'));
        $this->assertSame(self::SECRET_TEXT, json_decode(NurturingDossier::query()->find('stu-1')->data, true)['note']);
    }

    public function test_update_through_sync_keeps_content_encrypted(): void
    {
        $this->makeClass('cls-1');
        $this->makeStudent('stu-1', 'cls-1');
        $this->makeDossier('stu-1');
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);

        $this->actingAs($vice)->postJson('/api/sync', [
            'collection' => 'nurturingDossiers',
            'upserts' => [['id' => 'stu-1', 'data' => ['id' => 'stu-1', 'studentId' => 'stu-1', 'note' => 'متن جدید']]],
            'deletes' => [],
        ])->assertOk();

        $this->assertStringNotContainsString('متن جدید', $this->rawData('nurturing_dossiers', 'stu-1'));
        $this->assertSame(1, DB::table('nurturing_dossiers')->count());
    }
}
