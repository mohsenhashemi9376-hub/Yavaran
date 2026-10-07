<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property string $id
 * @property string|null $class_id
 * @property string $first_name
 * @property string $last_name
 * @property string $data
 */
class Student extends Model
{
    protected $table = 'students';

    public $incrementing = false;

    protected $keyType = 'string';

    /** پرونده‌ی تربیتی دانش‌آموز (محتوا رمزنگاری‌شده) */
    public function nurturingRecord(): HasOne
    {
        return $this->hasOne(NurturingDossier::class, 'student_id', 'id');
    }
}
