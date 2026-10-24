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
                if ($collection === 'entryTimes') {
                    $this->normalizeEntryTime($data, (string) $item->id, $user);
                }
                if (in_array($collection, self::DATED_ATTENDANCE, true)) {
                    $this->requireSchoolDay($data);
                }

                if ($collection === 'worksheets' || $collection === 'worksheetWeeks') {
                    $this->normalizeWorksheet($collection, $data, (string) $item->id, $user);
                }
                if ($collection === 'academicFollowUps') {
                    $this->normalizeAcademicFollowUp($data, (string) $item->id, $user);
                }
                if ($collection === 'greyList') {
                    $this->normalizeGreyEntry($data, (string) $item->id, $user, $oldData, $policy);
                }
                if ($collection === 'reflectionPoints') {
                    $this->normalizeReflectionPoint($data, (string) $item->id, $user);
                }
                if ($collection === 'parentMeetings') {
                    $this->normalizeParentMeeting($data, (string) $item->id, $oldData, $user, $policy);
                }
                if ($collection === 'parentMeetingStates') {
                    $this->normalizeParentMeetingState($data, (string) $item->id, $oldData, $user, $policy);
                }

                if ($collection === 'lessonPlans') {
                    $data = $this->normalizeLessonPlan($data, (string) $item->id, $oldData, $user, $policy);
                    $data->id = $item->id;
                }

                if ($collection === 'comprehensiveExams' && $policy->isTeacher()) {
                    $data = $policy->mergeTeacherExam($data, $oldData);
                    $data->id = $item->id;
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

                if ($collection === 'parentMeetings') {
                    $this->alertParentAbsenceStreak($data);
                }
                if ($collection === 'parentMeetingStates' && empty($data->open) && $oldData !== null && ! empty($oldData->open)) {
                    $this->alertUnrecordedAtMeetingClose($data);
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
        } elseif (mb_strlen($plain) < PasswordRules::MIN_LENGTH_FORCED) {
            abort(422, PasswordRules::tooShortMessage());
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
     * طرح درس: دبیر فقط محتوای طرح را تعیین می‌کند (نویسنده و بخش «بررسی» را سرور تعیین می‌کند)؛
     * بررسی‌کننده فقط بازخورد و تأیید را ثبت می‌کند و بقیه‌ی طرح از رکورد قبلی می‌ماند.
     */
    private function normalizeLessonPlan(object $data, string $id, ?object $oldData, User $user, AccessPolicy $policy): object
    {
        if ($policy->isTeacher()) {
            $date = isset($data->date) && is_string($data->date) ? \App\Support\SchoolCalendar::normalize($data->date) : '';
            if (! preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $date)) {
                abort(422, 'تاریخ طرح درس نامعتبر است.');
            }
            $data->date = $date;
            $data->teacherId = (string) $user->id;
            $data->teacherName = (string) $user->name;
            $status = ($data->status ?? 'draft') === 'draft' ? 'draft' : 'submitted';
            $review = $oldData->review ?? null;
            if ($oldData !== null && ($oldData->status ?? '') === 'approved') {
                // ویرایش پس از تأیید: دوباره برای بررسی ارسال می‌شود
                $status = 'submitted';
                if (is_object($review)) {
                    $review->approved = false;
                }
            }
            $data->status = $status;
            $data->review = $review;
            $data->updatedAt = now()->toIso8601String();

            return $data;
        }

        if ($oldData === null || ($oldData->status ?? 'draft') === 'draft') {
            abort(403, 'این طرح هنوز برای بررسی ارسال نشده است.');
        }
        $incoming = is_object($data->review ?? null) ? $data->review : new \stdClass();
        $approved = ! empty($incoming->approved);
        $feedback = isset($incoming->feedback) && is_string($incoming->feedback) ? mb_substr(trim($incoming->feedback), 0, 2000) : '';
        $oldData->review = (object) [
            'approved' => $approved,
            'feedback' => $feedback,
            'reviewerId' => (string) $user->id,
            'reviewerName' => (string) $user->name,
            'reviewedAt' => now()->toIso8601String(),
        ];
        $oldData->status = $approved ? 'approved' : 'submitted';

        return $oldData;
    }

    /** ساعت ورود تعیین‌شده‌ی یک روز (ورود پس از آن تأخیر است)؛ شناسه ent-{تاریخ با خط تیره} */
    private function normalizeEntryTime(object $data, string $id, User $user): void
    {
        $date = isset($data->date) && is_string($data->date) ? \App\Support\SchoolCalendar::normalize($data->date) : '';
        if (! preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $date) || \App\Support\Jalali::shamsiToDate($date) === null) {
            abort(422, 'تاریخ ساعت ورود نامعتبر است.');
        }
        if ($id !== 'ent-'.str_replace('/', '-', $date)) {
            abort(422, 'شناسه‌ی ساعت ورود نامعتبر است.');
        }
        $time = isset($data->time) && is_string($data->time) ? $data->time : '';
        if (! preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time)) {
            abort(422, 'ساعت ورود نامعتبر است.');
        }
        $data->date = $date;
        $data->time = $time;
        $data->setById = (string) $user->id;
        $data->setBy = (string) $user->name;
        $data->updatedAt = now()->toIso8601String();
    }

    /**
     * هشدار خودکار به معاون تربیتی: ولیِ دانش‌آموز در دو جلسه‌ی عمومیِ پشت‌سرهم (جلسه‌های متوالی همان سال) هیچ‌کدام حاضر نبوده‌اند.
     * هر زوج جلسه برای هر دانش‌آموز فقط یک بار اعلان می‌دهد (ویرایش‌های بعدی تکرار نمی‌شود).
     */
    private function alertParentAbsenceStreak(object $data): void
    {
        try {
            if (($data->hasAttendance ?? true) === false || ! empty($data->father) || ! empty($data->mother) || ! Notifier::ensureTable()) {
                return;
            }
            $no = (int) $data->meetingNo;
            $studentId = (string) $data->studentId;
            $year = (string) $data->academicYear;

            foreach ([$no - 1, $no + 1] as $other) {
                if ($other < 1 || $other > 3) {
                    continue;
                }
                $row = DB::table('parent_meetings')->where('student_id', $studentId)->where('academic_year', $year)->where('meeting_no', $other)->value('data');
                $d = is_string($row) ? json_decode($row, false) : null;
                if (! is_object($d) || ($d->hasAttendance ?? true) === false || ! empty($d->father) || ! empty($d->mother)) {
                    continue;
                }

                $first = min($no, $other);
                $ref = 'pm2:'.sha1($year.'|'.$studentId.'|'.$first);
                $receivers = DB::table('users')->where('role', 'vice_nurturing')->where('is_active', true)->pluck('id')->map(fn ($v) => (string) $v)->all();
                $receivers = array_values(array_filter($receivers, static fn (string $id): bool => ! DB::table('notifications')->where('receiver_id', $id)->where('ref_id', $ref)->exists()));
                if ($receivers === []) {
                    continue;
                }

                $student = DB::table('students')->where('id', $studentId)->first(['class_id', 'data']);
                $sd = $student && is_string($student->data) ? json_decode($student->data, false) : null;
                $name = trim(((string) ($sd->lastName ?? '')).' '.((string) ($sd->firstName ?? ''))) ?: $studentId;
                $className = $student ? (string) (DB::table('school_classes')->where('id', $student->class_id)->value('name') ?? '') : '';
                $labels = [1 => 'اول', 2 => 'دوم', 3 => 'سوم'];

                Notifier::send($receivers, [
                    'title' => 'هشدار حضور أولیا: غیبت پشت‌سرهم',
                    'message' => sprintf(
                        'پدر و مادر «%s»%s در جلسه‌های عمومی %s و %s أولیا حاضر نبوده‌اند. پیگیری و گفتگو با خانواده توصیه می‌شود.',
                        $name,
                        $className !== '' ? " ({$className})" : '',
                        $labels[$first],
                        $labels[$first + 1]
                    ),
                    'type' => 'announcement',
                    'priority' => 'urgent',
                    'ref_id' => $ref,
                ]);
            }
        } catch (\Throwable) {
            // هشدار نباید ثبت حضور را مختل کند
        }
    }

    /**
     * وضعیت باز/بسته‌ی جلسه‌ی عمومی اولیاء: فقط مدیر و معاون اجرایی؛ شناسه قطعی است و سال تحصیلی و زمان‌ها را سرور می‌گذارد.
     * «بسته» یعنی جلسه برگزار و تمام شده است.
     */
    private function normalizeParentMeetingState(object $data, string $id, ?object $old, User $user, AccessPolicy $policy): void
    {
        if (! $policy->canManageParentMeetingStates()) {
            abort(403, 'باز و بسته کردن جلسه‌های اولیا فقط با مدیر و معاون اجرایی است.');
        }
        $no = isset($data->meetingNo) && is_numeric($data->meetingNo) ? (int) $data->meetingNo : 0;
        if ($no < 1 || $no > 3) {
            abort(422, 'شماره‌ی جلسه‌ی أولیا نامعتبر است (فقط جلسه‌ی اول تا سوم).');
        }
        $year = (string) \App\Support\AcademicYear::current()[0];
        if ($id !== 'pms-'.$year.'-'.$no) {
            abort(422, 'شناسه‌ی وضعیت جلسه‌ی أولیا نامعتبر است.');
        }
        $now = now()->toIso8601String();
        $open = ! empty($data->open);
        $wasOpen = $old !== null && ! empty($old->open);

        $data->academicYear = $year;
        $data->meetingNo = $no;
        $data->open = $open;
        if ($open) {
            $data->openedAt = $wasOpen ? ($old->openedAt ?? $now) : $now;
            $data->closedAt = null;
        } else {
            $data->openedAt = $old->openedAt ?? null;
            $data->closedAt = $wasOpen ? $now : ($old->closedAt ?? null);
        }
        $data->changedById = (string) $user->id;
        $data->changedBy = (string) $user->name;
        $data->updatedAt = $now;
    }

    /** هشدار به مدیر و معاون اجرایی: جلسه بسته شد ولی حضور اولیای برخی دانش‌آموزان ثبت نشده است */
    private function alertUnrecordedAtMeetingClose(object $state): void
    {
        try {
            if (! Notifier::ensureTable()) {
                return;
            }
            $year = (string) $state->academicYear;
            $no = (int) $state->meetingNo;
            $total = DB::table('students')
                ->join('school_classes', 'school_classes.id', '=', 'students.class_id')
                ->count();
            $recorded = 0;
            foreach (DB::table('parent_meetings')->where('academic_year', $year)->where('meeting_no', $no)->pluck('data') as $raw) {
                $d = is_string($raw) ? json_decode($raw, false) : null;
                if (is_object($d) && ($d->hasAttendance ?? true) !== false) {
                    $recorded++;
                }
            }
            $missing = max(0, $total - $recorded);
            if ($missing === 0) {
                return;
            }
            $ref = 'pmclose:'.$year.'-'.$no.'-'.($state->closedAt ?? '');
            $receivers = DB::table('users')->whereIn('role', ['admin', 'vice_principal'])->where('is_active', true)->pluck('id')->map(fn ($v) => (string) $v)->all();
            $labels = [1 => 'اول', 2 => 'دوم', 3 => 'سوم'];
            Notifier::send($receivers, [
                'title' => 'هشدار حضور أولیا: جلسه بسته شد',
                'message' => sprintf('جلسه‌ی عمومی %s أولیا بسته شد، اما حضور و غیاب پدر و مادر %d دانش‌آموز ثبت نشده است. در صورت نیاز جلسه را دوباره باز کنید.', $labels[$no], $missing),
                'type' => 'announcement',
                'priority' => 'urgent',
                'ref_id' => $ref,
            ]);
        } catch (\Throwable) {
            // هشدار نباید باز و بسته کردن جلسه را مختل کند
        }
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
            $changed = $has !== $oldHas
                || ($has && (! empty($data->father) !== ($oldHas && ! empty($old->father)) || ! empty($data->mother) !== ($oldHas && ! empty($old->mother))));
            if ($changed && ! \App\Support\ParentMeetingGate::isOpen($year, $no)) {
                abort(422, 'این جلسه‌ی اولیا بسته شده (برگزار و تمام شده) و حضور و غیاب آن دیگر قابل ثبت نیست؛ مدیر یا معاون اجرایی باید جلسه را باز کند.');
            }
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
        // کسی که فقط اجازه‌ی یادداشت دارد، رکورد خالیِ بدون یادداشت نمی‌سازد (یعنی تلاش برای ثبت حضور)
        if (! $policy->canRecordParentMeetings() && $old === null && $note === null) {
            abort(403, 'ثبت حضور پدر و مادر فقط با مدیر و معاون انضباطی است؛ شما فقط می‌توانید یادداشت بنویسید.');
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
        // ثبت وضعیت فقط برای هفته‌ای ممکن است که مهلت دارد و روز تعیین‌شده رسیده است (یادداشت فردی بدون وضعیت آزاد است)
        if ($data->status !== 'none') {
            $deadline = CollectionRegistry::tableExists('worksheet_weeks')
                ? DB::table('worksheet_weeks')->where('week_start', $weekStart)->value('deadline')
                : null;
            $deadlineDate = is_string($deadline) && $deadline !== '' ? \App\Support\Jalali::shamsiToDate($deadline) : null;
            if ($deadlineDate === null) {
                abort(422, 'برای این هفته مهلت تعیین نشده است؛ ابتدا معاونت آموزش مهلت را مشخص کند.');
            }
            if (\Illuminate\Support\Carbon::now('Asia/Tehran')->format('Y-m-d') < $deadlineDate) {
                abort(422, 'هنوز روز تعیین‌شده برای تحویل کاربرگ نرسیده است.');
            }
        }
        $data->classId = (string) $classId;
        $data->note = isset($data->note) && is_string($data->note) && trim($data->note) !== '' ? mb_substr(trim($data->note), 0, 500) : null;
        $data->recordedById = (string) $user->id;
        $data->recordedBy = (string) $user->name;
        $data->updatedAt = $now;
    }

    /** معیارهای نیازمند پیگیری آموزشی: فقط کلیدهای شناخته‌شده با مقادیر محدود پذیرفته می‌شود */
    private function normalizeFollowUpConfig(object $data, User $user): void
    {
        $kinds = ['low_continuous', 'low_continuous_avg', 'score_decline', 'low_exam', 'low_exam_avg', 'exam_gap',
            'homework_not_done', 'homework_incomplete', 'homework_streak', 'worksheet_streak',
            'subject_absences', 'class_lates', 'class_warnings'];
        $in = isset($data->config) && is_object($data->config) ? $data->config : new stdClass();
        $enabledIn = isset($in->enabled) && is_object($in->enabled) ? $in->enabled : new stdClass();
        $enabled = [];
        foreach ($kinds as $k) {
            $enabled[$k] = ! isset($enabledIn->{$k}) || (bool) $enabledIn->{$k};
        }
        $num = static function (string $key, float $min, float $max, float $default) use ($in): float {
            $v = isset($in->{$key}) && is_numeric($in->{$key}) ? (float) $in->{$key} : $default;

            return round(max($min, min($max, $v)), 2);
        };
        $data->config = [
            'enabled' => $enabled,
            'lowScore' => $num('lowScore', 1, 20, 12),
            'homeworkNotDonePerMonth' => (int) $num('homeworkNotDonePerMonth', 1, 31, 3),
            'homeworkIncompletePerMonth' => (int) $num('homeworkIncompletePerMonth', 1, 31, 4),
            'homeworkNotDoneStreak' => (int) $num('homeworkNotDoneStreak', 2, 31, 3),
            'subjectAbsencesPerMonth' => (int) $num('subjectAbsencesPerMonth', 1, 31, 3),
            'classLatesPerMonth' => (int) $num('classLatesPerMonth', 1, 31, 3),
            'classWarningsPerMonth' => (int) $num('classWarningsPerMonth', 1, 31, 2),
            'dropFromPreviousMonth' => $num('dropFromPreviousMonth', 0.5, 20, 2),
            'continuousVsExamGap' => $num('continuousVsExamGap', 1, 20, 5),
            'worksheetStreakWeeks' => (int) $num('worksheetStreakWeeks', 1, 20, 2),
        ];
        $data->studentId = '';
        $data->classId = null;
        $data->status = 'open';
        $data->updatedById = (string) $user->id;
        $data->updatedBy = (string) $user->name;
        $data->updatedAt = now()->toIso8601String();
    }

    /** وضعیت پیگیری آموزشی: یک رکورد برای هر دانش‌آموز؛ کلاس و ثبت‌کننده را سرور تعیین می‌کند */
    private function normalizeAcademicFollowUp(object $data, string $id, User $user): void
    {
        // تنظیمات «پیشرفته»ی معیارهای نیازمند پیگیری (یک رکورد برای کل مدرسه)
        if ($id === 'afu-config') {
            $this->normalizeFollowUpConfig($data, $user);

            return;
        }
        $studentId = isset($data->studentId) && is_string($data->studentId) ? $data->studentId : '';
        $classId = $studentId !== '' ? DB::table('students')->where('id', $studentId)->value('class_id') : null;
        if ($classId === null) {
            abort(422, 'دانش‌آموز نامعتبر است.');
        }
        if ($id !== 'afu-'.$studentId) {
            abort(422, 'شناسه‌ی پیگیری نامعتبر است.');
        }
        if (! isset($data->status) || ! in_array($data->status, ['open', 'in_progress', 'called_parent', 'resolved'], true)) {
            abort(422, 'وضعیت پیگیری نامعتبر است.');
        }
        $data->classId = (string) $classId;
        $data->note = isset($data->note) && is_string($data->note) && trim($data->note) !== '' ? mb_substr(trim($data->note), 0, 500) : null;
        $data->updatedById = (string) $user->id;
        $data->updatedBy = (string) $user->name;
        $data->updatedAt = now()->toIso8601String();
    }

    /**
     * لیست خاکستری آموزش: یک رکورد برای هر دانش‌آموز در هر ماه. معاونت آموزش هنگام ارسال، تصویر ثابت (میانگین، دروس ضعیف،
     * دلایل) را می‌گذارد که بعد از آن تغییر نمی‌کند. مربی و معاون تربیتی فقط علت ضعف، اقدام‌ها و تاریخ پیگیری بعدی را می‌نویسند.
     * ثبت‌کننده و زمان هر اقدام را سرور می‌گذارد و اقدام‌های قبلی تغییر نمی‌کنند (تاریخچه‌ی ثابت).
     */
    private function normalizeGreyEntry(object $data, string $id, User $user, ?object $old, AccessPolicy $policy): void
    {
        $studentId = isset($data->studentId) && is_string($data->studentId) ? $data->studentId : '';
        $classId = $studentId !== '' ? DB::table('students')->where('id', $studentId)->value('class_id') : null;
        if ($classId === null) {
            abort(422, 'دانش‌آموز نامعتبر است.');
        }
        $month = isset($data->month) && is_string($data->month) ? trim($data->month) : '';
        if (! preg_match('/^\d{4}\/\d{2}$/', $month)) {
            abort(422, 'ماه لیست خاکستری نامعتبر است.');
        }
        if ($id !== 'gl-'.$studentId.'-'.str_replace('/', '-', $month)) {
            abort(422, 'شناسه‌ی لیست خاکستری نامعتبر است.');
        }
        $now = now()->toIso8601String();
        $data->classId = (string) $classId;
        $data->month = $month;

        if ($old === null) {
            // تصویر ثابت زمان ارسال
            $snap = isset($data->snapshot) && is_object($data->snapshot) ? $data->snapshot : new stdClass();
            $average = isset($snap->average) && is_numeric($snap->average) ? max(0, min(20, round((float) $snap->average, 2))) : null;
            $weak = [];
            foreach (array_slice(isset($snap->weakSubjects) && is_array($snap->weakSubjects) ? $snap->weakSubjects : [], 0, 40) as $w) {
                if (is_object($w) && isset($w->name) && is_string($w->name) && isset($w->score) && is_numeric($w->score)) {
                    $weak[] = ['name' => mb_substr($w->name, 0, 100), 'score' => max(0, min(20, round((float) $w->score, 2)))];
                }
            }
            $reasons = [];
            foreach (array_slice(isset($snap->reasons) && is_array($snap->reasons) ? $snap->reasons : [], 0, 30) as $r) {
                if (is_object($r) && isset($r->label) && is_string($r->label)) {
                    $reasons[] = [
                        'kind' => mb_substr((string) ($r->kind ?? ''), 0, 40),
                        'group' => mb_substr((string) ($r->group ?? ''), 0, 20),
                        'label' => mb_substr($r->label, 0, 100),
                        'detail' => mb_substr((string) ($r->detail ?? ''), 0, 1000),
                    ];
                }
            }
            $data->snapshot = ['average' => $average, 'weakSubjects' => $weak, 'reasons' => $reasons];
            $data->sentById = (string) $user->id;
            $data->sentBy = (string) $user->name;
            $data->sentAt = $now;
        } else {
            // بعد از ارسال، تصویر ثابت و مشخصات ارسال تغییر نمی‌کند
            foreach (['snapshot', 'sentById', 'sentBy', 'sentAt'] as $k) {
                $data->{$k} = $old->{$k} ?? null;
            }
        }

        $causes = isset($data->causes) && is_array($data->causes) ? array_values(array_unique(array_filter($data->causes, static fn ($c) => is_string($c) && preg_match('/^[a-z_]{1,40}$/', $c)))) : [];
        $data->causes = array_slice($causes, 0, 20);
        $data->causeOther = isset($data->causeOther) && is_string($data->causeOther) && trim($data->causeOther) !== '' ? mb_substr(trim($data->causeOther), 0, 300) : null;

        $next = isset($data->nextFollowUp) && is_string($data->nextFollowUp) ? trim($data->nextFollowUp) : '';
        if ($next !== '' && ! preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $next)) {
            abort(422, 'تاریخ پیگیری بعدی نامعتبر است.');
        }
        $data->nextFollowUp = $next === '' ? null : $next;

        // تاریخچه‌ی اقدام‌ها: قبلی‌ها ثابت، فقط موارد تازه اضافه می‌شود (ثبت‌کننده و زمان از سرور)
        $oldActions = [];
        $oldIds = [];
        foreach (isset($old->actions) && is_array($old->actions) ? $old->actions : [] as $a) {
            $oldActions[] = $a;
            if (is_object($a) && isset($a->id)) {
                $oldIds[(string) $a->id] = true;
            }
        }
        $actions = $oldActions;
        foreach (isset($data->actions) && is_array($data->actions) ? $data->actions : [] as $a) {
            if (! is_object($a) || ! isset($a->id) || ! is_string($a->id) || isset($oldIds[$a->id])) {
                continue;
            }
            $text = isset($a->text) && is_string($a->text) ? trim($a->text) : '';
            if ($text === '' || count($actions) >= 200) {
                continue;
            }
            $actions[] = (object) [
                'id' => mb_substr($a->id, 0, 40),
                'text' => mb_substr($text, 0, 1000),
                'at' => $now,
                'by' => (string) $user->name,
                'byId' => (string) $user->id,
            ];
        }
        $data->actions = $actions;
        $data->updatedById = (string) $user->id;
        $data->updatedBy = (string) $user->name;
        $data->updatedAt = $now;
    }

    /**
     * نقاط تفکر: شناسه‌ی رکورد قطعی است (یک رکورد برای هر دانش‌آموز در هر هفته)، کلاس از دیتابیس تعیین می‌شود
     * و ثبت‌کننده و زمان را سرور می‌گذارد.
     */
    private function normalizeReflectionPoint(object $data, string $id, User $user): void
    {
        $weekStart = isset($data->weekStart) && is_string($data->weekStart) ? trim($data->weekStart) : '';
        if (! preg_match('/^\d{4}\/\d{2}\/\d{2}$/', $weekStart)) {
            abort(422, 'تاریخ شروع هفته نامعتبر است.');
        }
        $studentId = isset($data->studentId) && is_string($data->studentId) ? $data->studentId : '';
        $classId = $studentId !== '' ? DB::table('students')->where('id', $studentId)->value('class_id') : null;
        if ($classId === null) {
            abort(422, 'دانش‌آموز نامعتبر است.');
        }
        if ($id !== 'rp-'.$studentId.'-'.str_replace('/', '-', $weekStart)) {
            abort(422, 'شناسه‌ی رکورد نقاط تفکر نامعتبر است.');
        }
        $data->classId = (string) $classId;
        $data->delivered = ! empty($data->delivered);
        $data->note = isset($data->note) && is_string($data->note) && trim($data->note) !== '' ? mb_substr(trim($data->note), 0, 500) : null;
        $data->recordedById = (string) $user->id;
        $data->recordedBy = (string) $user->name;
        $data->updatedAt = now()->toIso8601String();
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
