<?php

namespace App\Http\Controllers;

use App\Http\Resources\NurturingRecordResource;
use App\Models\Student;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

/** نمایش پرونده تربیتی یک دانش‌آموز؛ مجوز در بک‌اند اعمال می‌شود (403 در صورت عدم دسترسی) */
class NurturingRecordController extends Controller
{
    use AuthorizesRequests;

    public function show(Student $student)
    {
        $this->authorize('viewNurturingRecord', $student);

        abort_if($student->nurturingRecord === null, 404, 'برای این دانش‌آموز پرونده تربیتی ثبت نشده است.');

        return new NurturingRecordResource($student->nurturingRecord);
    }
}
