<?php

namespace App\Http\Controllers;

use App\Http\Resources\NurturingRecordResource;
use App\Models\Student;
use App\Support\NurturingAudit;
use App\Support\SecurityAlerts;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

/** نمایش پرونده تربیتی یک دانش‌آموز؛ مجوز در بک‌اند اعمال می‌شود (403 در صورت عدم دسترسی) */
class NurturingRecordController extends Controller
{
    use AuthorizesRequests;

    public function show(Student $student)
    {
        try {
            $this->authorize('viewNurturingRecord', $student);
        } catch (AuthorizationException $e) {
            NurturingAudit::log(request()->user(), 'view', 'nurturingDossiers', (string) $student->getKey(), null, false);
            throw $e;
        }

        if ($reason = SecurityAlerts::viewBlockReason(request()->user())) {
            NurturingAudit::log(request()->user(), 'view', 'nurturingDossiers', (string) $student->getKey(), null, false);
            abort(429, $reason);
        }

        abort_if($student->nurturingRecord === null, 404, 'برای این دانش‌آموز پرونده تربیتی ثبت نشده است.');
        NurturingAudit::log(request()->user(), 'view', 'nurturingDossiers', (string) $student->getKey(), (string) $student->nurturingRecord->getKey());
        SecurityAlerts::afterRecordView(request()->user());

        return new NurturingRecordResource($student->nurturingRecord);
    }
}
