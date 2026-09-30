<?php

namespace App\Models;

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
        'id', 'username', 'name', 'role', 'phone', 'is_active', 'password', 'password_encrypted', 'data', 'sort_order',
    ];

    protected $hidden = [
        'password', 'password_encrypted', 'remember_token', 'data',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
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
