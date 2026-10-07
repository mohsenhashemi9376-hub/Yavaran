<?php

namespace App\Policies;

use App\Models\NurturingDossier;
use App\Models\Student;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/** مجوزهای مربوط به دانش‌آموز؛ دسترسی به پرونده تربیتی به NurturingRecordPolicy واگذار می‌شود */
class StudentPolicy
{
    public function __construct(private readonly NurturingRecordPolicy $nurturing)
    {
    }

    private function dossierOf(Student $student): NurturingDossier
    {
        $dossier = new NurturingDossier;
        $dossier->student_id = (string) $student->getKey();

        return $dossier;
    }

    public function viewNurturingRecord(User $user, Student $student): Response
    {
        return $this->nurturing->view($user, $this->dossierOf($student));
    }

    public function updateNurturingRecord(User $user, Student $student): Response
    {
        return $this->nurturing->update($user, $this->dossierOf($student));
    }
}
