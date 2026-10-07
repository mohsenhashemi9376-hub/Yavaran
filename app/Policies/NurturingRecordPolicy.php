<?php

namespace App\Policies;

use App\Models\NurturingRecord;
use App\Models\StudentObservation;
use App\Models\User;
use App\Support\PasswordConfirmation;
use App\Support\Sync\AccessPolicy;
use Illuminate\Auth\Access\Response;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * دسترسی به پرونده‌های تربیتی، ارزیابی رشد و مشاهدات رفتاری.
 *
 * - مدیر سامانه (admin): هیچ دسترسی‌ای ندارد (ایزولاسیون کامل)؛ Gate::before برای این مدل‌ها او را دور نمی‌زند.
 * - معاون تربیتی (vice_nurturing): با مجوز مربوطه به همه‌ی دانش‌آموزان دسترسی دارد.
 * - مربی: فقط به دانش‌آموزان کلاس‌های تخصیص‌یافته به خودش (خواندن با مجوز view-nurturing-file یا counseling-report،
 *   نوشتن با counseling-report).
 * - سایر نقش‌ها (سایر معاونین، دبیر و ...): هیچ دسترسی‌ای ندارند.
 *
 * خطای دسترسی در بک‌اند به 403 Forbidden تبدیل می‌شود؛ مستقل از رابط کاربری.
 */
class NurturingRecordPolicy
{
    /** @var array<string, array<int, string>> */
    private array $classCache = [];

    private function deny(string $message = 'شما به این پرونده تربیتی دسترسی ندارید.'): Response
    {
        return Response::denyWithStatus(403, $message);
    }

    private function baseCheck(User $user, bool $write, bool $touch = true): ?Response
    {
        if (! $user->isActive()) {
            return $this->deny('حساب کاربری شما غیرفعال است.');
        }
        if ($user->role === 'admin') {
            return $this->deny('پرونده‌های تربیتی برای مدیر سامانه قابل دسترسی نیست.');
        }

        if (! in_array($user->role, self::ROLES, true)) {
            return $this->deny();
        }

        if ($user->requiresTwoFactor() && ! $user->hasTwoFactor()) {
            return $this->deny('برای دسترسی به پرونده‌های تربیتی ابتدا ورود دومرحله‌ای را در حساب خود فعال کنید.');
        }

        if ($user->requiresReauth() && ! PasswordConfirmation::isFresh($touch)) {
            return $this->deny('برای ادامه، رمز عبور خود را دوباره وارد کنید.');
        }

        $permitted = $write
            ? $user->hasPermission('counseling-report')
            : ($user->hasPermission('view-nurturing-file') || $user->hasPermission('counseling-report'));

        return $permitted ? null : $this->deny('مجوز لازم برای این بخش به حساب شما داده نشده است.');
    }

    /** تنها نقش‌هایی که به پرونده‌های تربیتی و مشاهدات رفتاری دسترسی دارند */
    public const ROLES = ['coach', 'vice_nurturing'];

    /** آیا کاربر در محدوده‌ی همه‌ی دانش‌آموزان دسترسی دارد (معاون تربیتی)؟ */
    public static function seesAllStudents(User $user): bool
    {
        return $user->role === 'vice_nurturing';
    }

    /** @return array<int, string> */
    private function classIds(User $user): array
    {
        return $this->classCache[$user->id] ??= (new AccessPolicy($user))->nurturingClassIds();
    }

    private function studentInScope(User $user, ?string $studentId): bool
    {
        if (self::seesAllStudents($user)) {
            return true;
        }
        if ($studentId === null || $studentId === '') {
            return false;
        }
        $classId = DB::table('students')->where('id', $studentId)->value('class_id');

        return $classId !== null && $classId !== '' && in_array($classId, $this->classIds($user), true);
    }

    private function check(User $user, NurturingRecord $record, bool $write): Response
    {
        if ($denied = $this->baseCheck($user, $write)) {
            return $denied;
        }

        return $this->studentInScope($user, $record->student_id)
            ? Response::allow()
            : $this->deny('شما فقط به پرونده‌ی دانش‌آموزان کلاس‌های تخصیص‌یافته به خودتان دسترسی دارید.');
    }

    public function viewAny(User $user): Response
    {
        // خواندن فهرست (بازخوانی خودکار پس‌زمینه) مهلت را تمدید نمی‌کند
        return $this->baseCheck($user, false, false) ?? Response::allow();
    }

    public function view(User $user, NurturingRecord $record): Response
    {
        $base = $this->check($user, $record, false);

        return $base->denied() ? $base : $this->observationVisibility($user, $record);
    }

    public function create(User $user, NurturingRecord $record): Response
    {
        return $this->check($user, $record, true);
    }

    public function update(User $user, NurturingRecord $record): Response
    {
        $base = $this->check($user, $record, true);

        return $base->denied() ? $base : $this->observationOwnership($user, $record);
    }

    public function delete(User $user, NurturingRecord $record): Response
    {
        return $this->update($user, $record);
    }

    /**
     * مشاهده‌گری‌های معاون تربیتی برای مربی قابل مشاهده نیست (و مشاهده‌های بدون نویسنده‌ی مشخص هم، به‌صورت محافظه‌کارانه).
     * معاون تربیتی همه‌ی مشاهده‌ها (از جمله مشاهده‌های مربیان) را می‌بیند.
     */
    private function observationVisibility(User $user, NurturingRecord $record): Response
    {
        if ($record instanceof StudentObservation && $user->role === 'coach' && $record->author_role !== 'coach') {
            return $this->deny('این مشاهده‌گری توسط معاون تربیتی ثبت شده و برای مربی قابل مشاهده نیست.');
        }

        return Response::allow();
    }

    /** ویرایش و حذف مشاهده‌گری فقط توسط نویسنده‌اش (مشاهده‌ی قدیمی بدون نویسنده را معاون تربیتی مدیریت می‌کند) */
    private function observationOwnership(User $user, NurturingRecord $record): Response
    {
        if (! $record instanceof StudentObservation || $record->author_id === null) {
            return $record instanceof StudentObservation && $user->role !== 'vice_nurturing'
                ? $this->deny('ویرایش این مشاهده‌گری فقط توسط معاون تربیتی ممکن است.')
                : Response::allow();
        }

        return $record->author_id === $user->id
            ? Response::allow()
            : $this->deny('هر مشاهده‌گری فقط توسط ثبت‌کننده‌ی آن قابل ویرایش یا حذف است.');
    }

    /**
     * محدود کردن کوئری خواندن به دانش‌آموزان مجاز کاربر (برای فهرست‌ها).
     * برای معاونین بدون محدودیت؛ برای مربی فقط کلاس‌های خودش.
     */
    public function scopeStudentIds(User $user): ?Builder
    {
        if (self::seesAllStudents($user)) {
            return null;
        }

        return DB::table('students')->whereIn('class_id', $this->classIds($user))->select('id');
    }
}
