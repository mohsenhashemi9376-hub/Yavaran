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
}
