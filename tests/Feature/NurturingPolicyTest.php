<?php

namespace Tests\Feature;

use App\Models\CoachEvaluation;
use App\Models\NurturingDossier;
use App\Models\Student;
use App\Models\StudentObservation;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class NurturingPolicyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->makeClass('cls-mine', ['coachIds' => []]);
        $this->makeClass('cls-other');
        $this->makeStudent('stu-mine', 'cls-mine');
        $this->makeStudent('stu-other', 'cls-other');
    }

    private function dossierOf(string $studentId): NurturingDossier
    {
        $d = new NurturingDossier;
        $d->student_id = $studentId;

        return $d;
    }

    private function coach(bool $twoFactor = true): User
    {
        $coach = $this->makeUser('coach', [], ['assignedClassIds' => ['cls-mine']]);
        if ($twoFactor) {
            $this->enableTwoFactor($coach);
        }

        return $coach;
    }

    private function vice(): User
    {
        $vice = $this->makeUser('vice_nurturing');
        $this->enableTwoFactor($vice);

        return $vice;
    }

    public function test_vice_nurturing_can_access_every_student(): void
    {
        $gate = Gate::forUser($this->vice());

        foreach (['stu-mine', 'stu-other'] as $id) {
            foreach (['view', 'create', 'update', 'delete'] as $ability) {
                $this->assertTrue($gate->allows($ability, $this->dossierOf($id)), "$ability $id");
            }
        }
        $this->assertTrue($gate->allows('viewAny', NurturingDossier::class));
    }

    public function test_coach_can_access_only_students_of_assigned_classes(): void
    {
        $gate = Gate::forUser($this->coach());

        $this->assertTrue($gate->allows('view', $this->dossierOf('stu-mine')));
        $this->assertTrue($gate->allows('update', $this->dossierOf('stu-mine')));

        foreach (['view', 'create', 'update', 'delete'] as $ability) {
            $this->assertFalse($gate->allows($ability, $this->dossierOf('stu-other')), $ability);
        }
    }

    public function test_coach_access_is_scoped_by_class_coach_assignment_too(): void
    {
        $this->makeClass('cls-by-class', ['coachIds' => ['coach-x']]);
        $this->makeStudent('stu-by-class', 'cls-by-class');
        $coach = $this->makeUser('coach', ['id' => 'coach-x']);
        $this->enableTwoFactor($coach);

        $this->assertTrue(Gate::forUser($coach)->allows('view', $this->dossierOf('stu-by-class')));
        $this->assertFalse(Gate::forUser($coach)->allows('view', $this->dossierOf('stu-mine')));
    }

    public function test_unknown_or_unassigned_student_is_denied_for_coach(): void
    {
        $gate = Gate::forUser($this->coach());

        $this->assertFalse($gate->allows('view', $this->dossierOf('does-not-exist')));
        $this->assertFalse($gate->allows('view', new NurturingDossier));
    }

    public function test_denial_carries_http_403_status(): void
    {
        $response = Gate::forUser($this->coach())->inspect('view', $this->dossierOf('stu-other'));

        $this->assertTrue($response->denied());
        $this->assertSame(403, $response->status());
        $this->assertNotSame('', (string) $response->message());
    }

    /** @return array<string, array{string}> */
    public static function forbiddenRoles(): array
    {
        return [
            'admin' => ['admin'],
            'vice_educational' => ['vice_educational'],
            'vice_disciplinary' => ['vice_disciplinary'],
            'vice_principal' => ['vice_principal'],
            'teacher' => ['teacher'],
        ];
    }

    #[DataProvider('forbiddenRoles')]
    public function test_other_roles_are_always_denied(string $role): void
    {
        $user = $this->makeUser($role, [], ['assignedClassIds' => ['cls-mine']]);
        $this->enableTwoFactor($user);
        $gate = Gate::forUser($user);

        foreach (['view', 'create', 'update', 'delete'] as $ability) {
            $this->assertFalse($gate->allows($ability, $this->dossierOf('stu-mine')), "$role $ability");
        }
        $this->assertFalse($gate->allows('viewAny', NurturingDossier::class), "$role viewAny");
    }

    public function test_admin_is_not_bypassed_by_gate_before_for_nurturing_models(): void
    {
        $admin = $this->makeUser('admin');

        // ادمین برای سایر بخش‌ها همچنان دور زده می‌شود ...
        $this->assertTrue(Gate::forUser($admin)->allows('manage-grades'));
        // ... ولی برای هر سه مدل تربیتی و دانشجوی مرتبط خیر
        foreach ([NurturingDossier::class, StudentObservation::class, CoachEvaluation::class] as $class) {
            $this->assertFalse(Gate::forUser($admin)->allows('viewAny', $class), $class);
        }
        $this->assertFalse(Gate::forUser($admin)->allows('viewNurturingRecord', Student::query()->findOrFail('stu-mine')));
    }

    public function test_student_policy_delegates_to_nurturing_rules(): void
    {
        $student = Student::query()->findOrFail('stu-other');

        $this->assertTrue(Gate::forUser($this->vice())->allows('viewNurturingRecord', $student));
        $this->assertFalse(Gate::forUser($this->coach())->allows('viewNurturingRecord', $student));
        $this->assertTrue(Gate::forUser($this->coach())->allows('viewNurturingRecord', Student::query()->findOrFail('stu-mine')));
    }

    public function test_inactive_user_is_denied(): void
    {
        $vice = $this->makeUser('vice_nurturing', ['is_active' => false]);
        $this->enableTwoFactor($vice);

        $this->assertFalse(Gate::forUser($vice)->allows('view', $this->dossierOf('stu-mine')));
    }

    public function test_coach_without_required_permission_is_denied(): void
    {
        $coach = $this->makeUser('coach', ['permissions' => json_encode(['view-students'])], ['assignedClassIds' => ['cls-mine']]);
        $this->enableTwoFactor($coach);

        $this->assertFalse(Gate::forUser($coach)->allows('view', $this->dossierOf('stu-mine')));
    }

    public function test_reading_needs_view_or_counseling_permission_but_writing_needs_counseling_report(): void
    {
        $reader = $this->makeUser('coach', ['permissions' => json_encode(['view-nurturing-file'])], ['assignedClassIds' => ['cls-mine']]);
        $this->enableTwoFactor($reader);
        $gate = Gate::forUser($reader);

        $this->assertTrue($gate->allows('view', $this->dossierOf('stu-mine')));
        $this->assertFalse($gate->allows('update', $this->dossierOf('stu-mine')));
    }

    public function test_two_factor_is_required_for_access_when_enforced(): void
    {
        $coach = $this->coach(twoFactor: false);

        $this->assertFalse(Gate::forUser($coach)->allows('view', $this->dossierOf('stu-mine')));
        $this->assertStringContainsString('دومرحله', (string) Gate::forUser($coach)->inspect('view', $this->dossierOf('stu-mine'))->message());
    }

    public function test_two_factor_requirement_can_be_switched_off(): void
    {
        config(['app.require_two_factor_nurturing' => false]);
        $coach = $this->coach(twoFactor: false);

        $this->assertTrue(Gate::forUser($coach)->allows('view', $this->dossierOf('stu-mine')));
    }
}
