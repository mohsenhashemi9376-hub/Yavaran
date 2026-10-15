<?php

namespace App\Support\Sync;

use App\Models\NurturingRecord;
use App\Models\StudentObservation;
use App\Models\User;
use App\Support\Notifier;
use App\Support\Digits;
use App\Support\PasswordRules;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use stdClass;

/**
 * اعمال تغییرات ارسالی از رابط کاربری (افزودن/ویرایش/حذف) روی دیتابیس
 * به‌صورت تراکنشی و با بررسی کامل مجوزها.
 */
final class SyncService
{
    public const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE;

    /**
     * @param  array<int, object{id:string,data:object,prepend?:bool}>  $upserts
     * @param  array<int, string>  $deletes
     */
    public function apply(User $user, string $collection, array $upserts, array $deletes): void
    {
        \App\Support\SchoolCalendar::reset(); // تعطیلی‌ها هر درخواست تازه خوانده می‌شود
        $policy = new AccessPolicy($user);
        $table = CollectionRegistry::table($collection);

        if (! CollectionRegistry::ensureTable($table)) {
            abort(503, 'ساختار دیتابیس هنوز به‌روزرسانی نشده است. لطفاً فایل upgrade.sql را روی دیتابیس اجرا کنید.');
        }

        // پرونده‌های تربیتی و مشاهدات رفتاری: خواندن/نوشتن از مسیر مدل برای رمزنگاری/رمزگشایی (کست encrypted)
        $sensitive = NurturingRecord::modelFor($collection);

        try {
        DB::transaction(function () use ($policy, $collection, $table, $upserts, $deletes, $sensitive, $user): void {
            if ($deletes !== []) {
                $rows = $sensitive
                    ? $sensitive::query()->whereIn('id', $deletes)->lockForUpdate()->get()
                    : DB::table($table)->whereIn('id', $deletes)->lockForUpdate()->get(['id', 'data']);

                foreach ($rows as $row) {
                    $policy->authorizeDelete($collection, $this->decode($row->data, (string) $row->id));
                }

                if ($rows->isNotEmpty()) {
                    DB::table($table)->whereIn('id', $rows->pluck('id')->all())->delete();
                }
            }

            if ($upserts === []) {
                return;
            }

            $ids = array_map(static fn (object $item): string => $item->id, $upserts);
            $existing = $sensitive
                ? $sensitive::query()->whereIn('id', $ids)->lockForUpdate()->get()->keyBy('id')
                : DB::table($table)->whereIn('id', $ids)->lockForUpdate()->get()->keyBy('id');

            $minOrder = (int) (DB::table($table)->min('sort_order') ?? 0);
            $maxOrder = (int) (DB::table($table)->max('sort_order') ?? 0);
            $now = now();

            foreach ($upserts as $item) {
                /** @var object $data */
                $data = $item->data;
                $data->id = $item->id;

                $oldRow = $existing->get($item->id);
                $oldData = $oldRow ? $this->decode($oldRow->data, (string) $oldRow->id) : null;

                // نویسنده‌ی مشاهده‌گری را سرور تعیین می‌کند؛ مقدار ارسالی کلاینت نادیده گرفته می‌شود
                if ($collection === 'observations') {
                    StudentObservation::ensureAuthorColumns();
                    $authorId = $oldRow ? ($oldRow->author_id ?? ($oldData->authorId ?? null)) : null;
                    $authorRole = $oldRow ? ($oldRow->author_role ?? ($oldData->authorRole ?? null)) : null;
                    if ($oldData !== null) {
                        $oldData->authorId = $authorId;
                        $oldData->authorRole = $authorRole;
                    }
                    $data->authorId = $authorId;
                    $data->authorRole = $authorRole;
                }

                if ($collection === 'schoolHolidays') {
                    $this->normalizeHoliday($data, (string) $item->id, $user);
                }
                if (in_array($collection, self::DATED_ATTENDANCE, true)) {
                    $this->requireSchoolDay($data);
                }

                if ($collection === 'worksheets' || $collection === 'worksheetWeeks') {
                    $this->normalizeWorksheet($collection, $data, (string) $item->id, $user);
                }
                if ($collection === 'parentMeetings') {
                    $this->normalizeParentMeeting($data, (string) $item->id, $oldData, $user, $policy);
                }

                $policy->authorizeUpsert($collection, $oldData, $data);

                if ($collection === 'observations' && empty($data->authorId)) {
                    // رکورد تازه (یا مشاهده‌ی قدیمیِ بدون نویسنده که معاون ویرایش می‌کند) به نام کاربر جاری ثبت می‌شود
                    $data->authorId = $policy->userId();
                    $data->authorRole = $policy->role();
                }

                if ($collection === 'sessions') {
                    $this->validateSession($data, $item->id);
                }

                $extra = $collection === 'users' ? $this->passwordColumns($data, $oldRow, $policy->userId(), (string) $item->id) : [];

                if ($collection === 'observations' && StudentObservation::ensureAuthorColumns()) {
                    $extra += ['author_id' => $data->authorId, 'author_role' => $data->authorRole];
                }

                $values = CollectionRegistry::columns($collection, $data) + $extra + [
                    'data' => json_encode($data, self::JSON_FLAGS),
                    'updated_at' => $now,
                ];

                if ($sensitive) {
                    // ستون data هنگام ذخیره با کست encrypted رمزنگاری می‌شود
                    if ($oldRow instanceof NurturingRecord) {
                        $oldRow->forceFill($values)->save();
                    } else {
                        $order = ! empty($item->prepend) ? --$minOrder : ++$maxOrder;
                        (new $sensitive)->forceFill($values + [
                            'id' => $item->id,
                            'sort_order' => $order,
                            'created_at' => $now,
                        ])->save();
                        $existing->put($item->id, (object) ['id' => $item->id, 'data' => $values['data']]);
                    }
                } elseif ($oldRow) {
                    DB::table($table)->where('id', $item->id)->update($values);
                } else {
                    $order = ! empty($item->prepend) ? --$minOrder : ++$maxOrder;
                    DB::table($table)->insert($values + [
                        'id' => $item->id,
                        'sort_order' => $order,
                        'created_at' => $now,
                    ]);
                    $existing->put($item->id, (object) (['id' => $item->id, 'data' => $values['data']] + $extra));

                    if ($collection === 'schoolAnnouncements') {
                        $this->notifyCircular($policy, $data, $item->id);
                    }
                }
            }
        });
        } catch (\Throwable $e) {
            // تراکنش برگشت خورده؛ تلاش‌های ردشده‌ی تربیتی باید همچنان ثبت و اطلاع‌رسانی شوند
            $policy->runAfterRollback();

            throw $e;
        }
    }

    /**
     * رمز عبور هرگز داخل ستون data ذخیره نمی‌شود و فقط به‌صورت هش یک‌طرفه (bcrypt) نگهداری می‌شود؛
     * هیچ نسخه‌ی برگشت‌پذیر یا قابل نمایش از رمز وجود ندارد (ستون password_encrypted همیشه خالی می‌ماند).
     *
     * @return array<string, string>
     */
    private function passwordColumns(object $data, ?object $oldRow, string $actorId, string $targetId): array
    {
        User::ensureTwoFactorColumns(); // ستون must_change_password
        $plain = null;

        if (property_exists($data, 'password')) {
            $plain = is_scalar($data->password) ? trim(Digits::toEnglish((string) $data->password)) : null;
            unset($data->password);
        }

        if ($plain === null || $plain === '') {
            if ($oldRow) {
                return [];
            }

            $plain = Str::password(10, symbols: false);
        }

        $plain = mb_substr($plain, 0, 191);
        $oldHash = $oldRow->password ?? null;

        if ($oldHash && password_verify($plain, $oldHash)) {
            $columns = [];
            if (! empty($oldRow->password_encrypted)) {
                $columns['password_encrypted'] = null; // پاک‌سازی نسخه‌ی برگشت‌پذیر قدیمی
            }
            if (Hash::needsRehash($oldHash)) {
                $columns['password'] = Hash::make($plain);
            }

            return $columns;
        }

        // رمزی که شخص دیگری برای حساب تعیین کرده (یا تصادفی ساخته شده) باید در اولین ورود تغییر کند
        return [
            'password' => Hash::make($plain),
            'password_encrypted' => null,
            'must_change_password' => $actorId !== $targetId || PasswordRules::isWeak($plain),
        ];
    }

    /** اعلان خودکار «بخشنامه جدید» برای اعضای مشمول */
    private function notifyCircular(AccessPolicy $policy, object $data, string $id): void
    {
        $roles = [];
        if (isset($data->targetRoles) && is_array($data->targetRoles) && $data->targetRoles !== []) {
            $roles = array_values(array_filter($data->targetRoles, 'is_string'));
        } else {
            $roles = match ($data->targetRole ?? 'everyone') {
                'coaches' => ['coach'],
                'all_teachers' => ['teacher'],
                default => [],
            };
        }

        $query = DB::table('users')->where('is_active', true)->where('id', '!=', $policy->userId());
        if ($roles !== []) {
            $query->whereIn('role', $roles);
        } else {
            $query->whereIn('role', ['teacher', 'coach']);
        }

        $title = isset($data->title) && is_scalar($data->title) ? trim((string) $data->title) : '';
        $content = isset($data->content) && is_scalar($data->content) ? trim((string) $data->content) : '';
        $priority = ($data->priority ?? 'normal') === 'urgent' ? 'urgent' : 'normal';

        Notifier::send($query->pluck('id')->all(), [
            'sender_id' => $policy->userId(),
            'title' => 'بخشنامه جدید',
            'message' => "بخشنامه جدید با عنوان «{$title}» ثبت شد.".($content !== '' ? "\n\n".mb_substr($content, 0, 1500) : ''),
            'type' => 'circular',
            'priority' => $priority,
            'ref_id' => $id,
        ]);
    }

    /**
     * اعتبارسنجی جلسه کلاسی: مبحث تدریس‌شده اجباری است و یک زنگ برای یک درس در
     * یک تاریخ نمی‌تواند دو بار ثبت شود.
     */
    /** مجموعه‌هایی که ثبت آن‌ها در جمعه‌ها و روزهای تعطیل اعلام‌شده ممکن نیست */
    private const DATED_ATTENDANCE = ['sessions', 'morningAttendance', 'morningDelays', 'schoolAbsences'];

    private function requireSchoolDay(object $data): void
    {
        $date = isset($data->date) && is_string($data->date) ? $data->date : null;
        $reason = \App\Support\SchoolCalendar::closedReason($date);
        if ($reason !== null) {
            abort(422, $reason === 'friday' ? 'جمعه روز درسی نیست و ثبت حضور و غیاب در آن ممکن نیست.' : 'این روز تعطیل اعلام شده است و ثبت حضور و غیاب در آن ممکن نیست.');
        }
    }

    /** تعطیلی: شناسه‌ی قطعی «hol-سال-ماه-روز»؛ اعلام‌کننده را سرور تعیین می‌کند */
    private function normalizeHoliday(object $data, string $id, User $user): void
    {
        $date = isset($data->date) && is_string($data->date) ? \App\Support\SchoolCalendar::normalize($data->date) : '';
        if (! preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $date) || \App\Support\Jalali::shamsiToDate($date) === null) {
            abort(422, 'تاریخ تعطیلی نامعتبر است.');
        }
        if ($id !== 'hol-'.str_replace('/', '-', $date)) {
            abort(422, 'شناسه‌ی تعطیلی نامعتبر است.');
        }
        $data->date = $date;
        $data->title = isset($data->title) && is_string($data->title) && trim($data->title) !== '' ? mb_substr(trim($data->title), 0, 120) : null;
        $data->setById = (string) $user->id;
        $data->setBy = (string) $user->name;
        $data->updatedAt = now()->toIso8601String();
        \App\Support\SchoolCalendar::reset();
    }

    /**
     * حضور أولیا در جلسه‌ی عمومی: شناسه قطعی است (یک رکورد برای هر دانش‌آموز در هر جلسه‌ی سال تحصیلی جاری)،
     * کلاس از دیتابیس و سال تحصیلی و تاریخ ثبت از ساعت سرور تعیین می‌شود؛ تاریخ پس از اولین ثبت تغییر نمی‌کند.
     * فقط ثبت‌کنندگان حضور (مدیر و معاون انضباطی) حضور پدر و مادر را تغییر می‌دهند؛ مربی و معاون تربیتی فقط یادداشت می‌نویسند
     * و مقدار حضور ارسالی آن‌ها نادیده گرفته می‌شود. نویسنده و زمان یادداشت را هم سرور می‌گذارد.
     */
    private function normalizeParentMeeting(object $data, string $id, ?object $old, User $user, AccessPolicy $policy): void
    {
        $no = isset($data->meetingNo) && is_numeric($data->meetingNo) ? (int) $data->meetingNo : 0;
        if ($no < 1 || $no > 3) {
            abort(422, 'شماره‌ی جلسه‌ی أولیا نامعتبر است (فقط جلسه‌ی اول تا سوم).');
        }
        $studentId = isset($data->studentId) && is_string($data->studentId) ? $data->studentId : '';
        $classId = $studentId !== '' ? DB::table('students')->where('id', $studentId)->value('class_id') : null;
        if ($classId === null) {
            abort(422, 'دانش‌آموز نامعتبر است.');
        }
        $year = (string) \App\Support\AcademicYear::current()[0];
        if ($id !== 'pm-'.$year.'-'.$no.'-'.$studentId) {
            abort(422, 'شناسه‌ی رکورد حضور أولیا نامعتبر است.');
        }

        $now = now()->toIso8601String();
        [$jy, $jm, $jd] = \App\Support\Jalali::fromCarbon(now('Asia/Tehran'));
        $today = sprintf('%04d/%02d/%02d', $jy, $jm, $jd);
        $oldHas = $old !== null && ($old->hasAttendance ?? true) !== false;
        $oldDate = $oldHas && isset($old->date) && is_string($old->date) && preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $old->date) ? $old->date : null;

        if ($policy->canRecordParentMeetings()) {
            $has = ($data->hasAttendance ?? true) !== false;
            $data->father = $has && ! empty($data->father);
            $data->mother = $has && ! empty($data->mother);
            $data->hasAttendance = $has;
            $data->date = $has ? ($oldDate ?? $today) : null;
        } else {
            // فقط یادداشت: وضعیت حضور (و تاریخش) از رکورد قبلی می‌ماند؛ رکورد تازه «بدون ثبت حضور» است
            $data->father = $oldHas && ! empty($old->father);
            $data->mother = $oldHas && ! empty($old->mother);
            $data->hasAttendance = $oldHas;
            $data->date = $oldDate;
        }

        $oldNote = $old !== null && isset($old->note) && is_string($old->note) && $old->note !== '' ? $old->note : null;
        if ($policy->canNoteParentMeetings()) {
            $note = isset($data->note) && is_string($data->note) && trim($data->note) !== '' ? mb_substr(trim($data->note), 0, 500) : null;
        } else {
            $note = $oldNote;
        }
        $data->note = $note;
        if ($note === null) {
            $data->noteBy = $data->noteById = $data->noteAt = null;
        } elseif ($note === $oldNote && $old !== null) {
            $data->noteBy = $old->noteBy ?? null;
            $data->noteById = $old->noteById ?? null;
            $data->noteAt = $old->noteAt ?? null;
        } else {
            $data->noteBy = (string) $user->name;
            $data->noteById = (string) $user->id;
            $data->noteAt = $now;
        }

        $data->academicYear = $year;
        $data->meetingNo = $no;
        $data->classId = (string) $classId;
        // ثبت‌کننده‌ی حضور فقط وقتی عوض می‌شود که خودِ حضور را ثبت کرده باشد
        if ($policy->canRecordParentMeetings()) {
            $data->recordedById = (string) $user->id;
            $data->recordedBy = (string) $user->name;
        } else {
            $data->recordedById = $old->recordedById ?? null;
            $data->recordedBy = $old->recordedBy ?? null;
        }
        $data->updatedAt = $now;
    }

    /**
     * کاربرگ: شناسه‌ی رکورد قطعی است (یک رکورد برای هر دانش‌آموز در هر هفته)، کلاس از روی دیتابیس تعیین می‌شود
     * و ثبت‌کننده و زمان را سرور می‌گذارد؛ مقدار ارسالی کلاینت برای این فیلدها نادیده گرفته می‌شود.
     */
    private function normalizeWorksheet(string $collection, object $data, string $id, User $user): void
    {
        $weekStart = isset($data->weekStart) && is_string($data->weekStart) ? trim($data->weekStart) : '';
        if (! preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $weekStart)) {
            abort(422, 'تاریخ شروع هفته نامعتبر است.');
        }
        $weekKey = str_replace('/', '-', $weekStart);
        $now = now()->toIso8601String();

        if ($collection === 'worksheetWeeks') {
            if ($id !== 'wk-'.$weekKey) {
                abort(422, 'شناسه‌ی هفته نامعتبر است.');
            }
            $deadline = isset($data->deadline) && is_string($data->deadline) ? trim($data->deadline) : '';
            if ($deadline !== '' && ! preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $deadline)) {
                abort(422, 'مهلت ثبت نامعتبر است.');
            }
            $data->deadline = $deadline === '' ? null : $deadline;
            $data->setById = (string) $user->id;
            $data->setBy = (string) $user->name;
            $data->updatedAt = $now;

            return;
        }

        $studentId = isset($data->studentId) && is_string($data->studentId) ? $data->studentId : '';
        $classId = $studentId !== '' ? DB::table('students')->where('id', $studentId)->value('class_id') : null;
        if ($classId === null) {
            abort(422, 'دانش‌آموز نامعتبر است.');
        }
        if ($id !== 'ws-'.$studentId.'-'.$weekKey) {
            abort(422, 'شناسه‌ی رکورد کاربرگ نامعتبر است.');
        }
        if (! isset($data->status) || ! in_array($data->status, ['complete', 'partial', 'absent', 'none'], true)) {
            abort(422, 'وضعیت کاربرگ نامعتبر است.');
        }
        // تا نرسیدن روز تعیین‌شده برای تحویل، ثبت وضعیت کاربرگ ممکن نیست (یادداشت فردی بدون وضعیت آزاد است)
        if ($data->status !== 'none' && CollectionRegistry::tableExists('worksheet_weeks')) {
            $deadline = DB::table('worksheet_weeks')->where('week_start', $weekStart)->value('deadline');
            $deadlineDate = is_string($deadline) ? \App\Support\Jalali::shamsiToDate($deadline) : null;
            if ($deadlineDate !== null && \Illuminate\Support\Carbon::now('Asia/Tehran')->format('Y-m-d') < $deadlineDate) {
                abort(422, 'هنوز روز تعیین‌شده برای تحویل کاربرگ نرسیده است.');
            }
        }
        $data->classId = (string) $classId;
        $data->note = isset($data->note) && is_string($data->note) && trim($data->note) !== '' ? mb_substr(trim($data->note), 0, 500) : null;
        $data->recordedById = (string) $user->id;
        $data->recordedBy = (string) $user->name;
        $data->updatedAt = $now;
    }

    private function validateSession(object $data, string $id): void
    {
        $topic = isset($data->lessonTopic) && is_scalar($data->lessonTopic) ? trim((string) $data->lessonTopic) : '';

        Validator::make(['topic' => $topic], ['topic' => 'required|string|min:2'], [
            'topic.required' => 'لطفاً مبحث تدریس‌شده این جلسه را وارد کنید',
            'topic.min' => 'لطفاً مبحث تدریس‌شده این جلسه را وارد کنید',
        ])->validate();

        $period = isset($data->periodNumber) && is_numeric($data->periodNumber) ? (int) $data->periodNumber : null;
        if ($period === null) {
            return;
        }

        $subjectKey = isset($data->subjectId) && is_scalar($data->subjectId) && $data->subjectId !== ''
            ? 'subjectId' : 'subject';
        $subjectValue = (string) ($data->{$subjectKey} ?? '');

        $rows = DB::table('attendance_sessions')
            ->where('class_id', $data->classId ?? null)
            ->where('session_date', $data->date ?? null)
            ->where('id', '!=', $id)
            ->pluck('data');

        foreach ($rows as $json) {
            $other = json_decode((string) $json, false);
            if (is_object($other)
                && (int) ($other->periodNumber ?? 0) === $period
                && (string) ($other->{$subjectKey} ?? '') === $subjectValue) {
                throw ValidationException::withMessages([
                    'period' => 'حضور و غیاب این زنگ برای این درس در این تاریخ قبلاً ثبت شده است.',
                ]);
            }
        }
    }

    private function decode(?string $json, string $id): object
    {
        $decoded = json_decode((string) $json, false);
        $object = is_object($decoded) ? $decoded : new stdClass;
        if (! isset($object->id)) {
            $object->id = $id;
        }

        return $object;
    }
}
