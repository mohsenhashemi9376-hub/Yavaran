<?php

namespace Tests\Feature;

use Tests\TestCase;

class MeasureBootstrapTest extends TestCase
{
    public function test_measure_command_runs_and_reports(): void
    {
        $this->makeUser('vice_educational', ['phone' => '09120000091']);
        $this->makeUser('teacher', ['phone' => '09120000092']);
        $this->artisan('sync:measure')->assertSuccessful();
    }

    public function test_version_changes_only_when_data_changes(): void
    {
        $u = $this->makeUser('admin', ['phone' => '09120000093']);
        $this->getJson('/api/bootstrap/version')->assertJson(['authenticated' => false]);

        $v1 = $this->actingAs($u)->getJson('/api/bootstrap/version')->assertOk()->json('version');
        $v2 = $this->actingAs($u)->getJson('/api/bootstrap/version')->json('version');
        $this->assertSame($v1, $v2);
        $this->assertSame($v1, $this->actingAs($u)->getJson('/api/bootstrap')->json('version'));

        $this->actingAs($u)->postJson('/api/sync', [
            'collection' => 'schoolHolidays',
            'upserts' => [['id' => 'hol-1405-07-14', 'data' => ['id' => 'hol-1405-07-14', 'date' => '1405/07/14', 'title' => 'تست']]],
            'deletes' => [],
        ])->assertOk();
        $v3 = $this->actingAs($u)->getJson('/api/bootstrap/version')->json('version');
        $this->assertNotSame($v1, $v3);
    }
}
