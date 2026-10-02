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

        return \Illuminate\Support\Facades\DB::table('course_assignments')->where('user_id', $this->id)->exists();
    }

    public function hasPermission(string $key): bool
    {
        return in_array($key, $this->permissionList(), true);
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
