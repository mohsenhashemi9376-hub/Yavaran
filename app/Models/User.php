<?php

namespace App\Models;

use App\Support\Permissions;
use App\Support\Sync\AccessPolicy;
use Illuminate\Foundation\Auth\User as Authenticatable;
use stdClass;

/**
 * @property string $id
 * @property string|null $username
 * @property string $name
 * @property string $role
 * @property string|null $phone
 * @property bool $is_active
 * @property array<int, string>|null $permissions
 * @property string|null $password
 * @property string|null $password_encrypted
 * @property string $data
 */
class User extends Authenticatable
{
    protected $table = 'users';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id', 'username', 'name', 'role', 'phone', 'is_active', 'permissions', 'password', 'password_encrypted', 'data', 'sort_order',
    ];

    protected $hidden = [
        'password', 'password_encrypted', 'remember_token', 'data',
        'two_factor_secret', 'two_factor_confirmed_at', 'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'permissions' => 'array',
        ];
    }

    /**
     * پروفایل کامل کاربر (همان ساختار شیء User در فرانت‌اند).
     */
    public function profile(): object
    {
        $decoded = json_decode((string) $this->data, false);

        return is_object($decoded) ? $decoded : new stdClass;
    }

    /**
     * دسترسی‌های مؤثر کاربر: فهرست اختصاصی یا پیش‌فرض نقش (مدیر همیشه همه را دارد).
     *
     * @return array<int, string>
     */
    public function permissionList(): array
    {
        $explicit = is_array($this->permissions) ? $this->permissions : null;
        $effective = Permissions::effective((string) $this->role, $explicit);

        // کاربری که درسی به او واگذار شده، دسترسی‌های پیش‌فرض تدریس را نیز دارد
        if ($explicit === null && $this->role !== 'teacher' && $this->teachesAnyCourse()) {
            $effective = array_values(array_unique([...$effective, ...Permissions::defaultsFor('teacher')]));
        }

        return $effective;
    }

    private function teachesAnyCourse(): bool
    {
        if (($this->profile()->isAlsoTeacher ?? false) === true) {
            return true;
        }

        return \App\Support\Sync\CollectionRegistry::tableExists('course_assignments')
            && \Illuminate\Support\Facades\DB::table('course_assignments')->where('user_id', $this->id)->exists();
    }

    public function hasPermission(string $key): bool
    {
        return in_array($key, $this->permissionList(), true);
    }

    /** ورود دومرحله‌ای (TOTP) برای این کاربر فعال و تأیید شده است؟ */
    public function hasTwoFactor(): bool
    {
        return ! empty($this->getAttribute('two_factor_secret')) && ! empty($this->getAttribute('two_factor_confirmed_at'));
    }

    /** نقش‌هایی که به پرونده‌های تربیتی دسترسی دارند باید ورود دومرحله‌ای داشته باشند */
    public function requiresTwoFactor(): bool
    {
        return (bool) config('app.require_two_factor_nurturing', true)
            && in_array($this->role, ['coach', 'vice_nurturing'], true);
    }

    /** باید در اولین ورود رمز عبور را تغییر دهد (رمز را شخص دیگری تعیین کرده یا رمز پیش‌فرض/ضعیف است) */
    public function mustChangePassword(): bool
    {
        return (bool) $this->getAttribute('must_change_password');
    }

    /** افزودن ستون‌های امنیتی (ورود دومرحله‌ای، تغییر اجباری رمز) به جدول users در دیتابیس‌های به‌روزنشده */
    public static function ensureTwoFactorColumns(): bool
    {
        static $ready = null;
        if ($ready !== null) {
            return $ready;
        }
        try {
            $schema = \Illuminate\Support\Facades\Schema::class;
            if (! $schema::hasColumn('users', 'two_factor_secret')) {
                $schema::table('users', function ($t): void {
                    $t->text('two_factor_secret')->nullable();
                    $t->timestamp('two_factor_confirmed_at')->nullable();
                    $t->text('two_factor_recovery_codes')->nullable();
                });
            }
            if (! $schema::hasColumn('users', 'must_change_password')) {
                $schema::table('users', function ($t): void {
                    $t->boolean('must_change_password')->default(false);
                });
            }
        } catch (\Throwable) {
        }

        return $ready = \Illuminate\Support\Facades\Schema::hasColumn('users', 'two_factor_secret')
            && \Illuminate\Support\Facades\Schema::hasColumn('users', 'must_change_password');
    }

    public function isActive(): bool
    {
        return (bool) $this->is_active;
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isManager(): bool
    {
        return in_array($this->role, AccessPolicy::MANAGER_ROLES, true);
    }
}
