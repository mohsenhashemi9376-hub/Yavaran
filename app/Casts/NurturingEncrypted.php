<?php

namespace App\Casts;

use App\Support\NurturingCrypt;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Contracts\Encryption\DecryptException;

/** کست رمزنگاری با کلید اختصاصی اطلاعات تربیتی؛ متن ساده‌ی قدیمی همچنان خوانده می‌شود */
class NurturingEncrypted implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes)
    {
        if ($value === null || $value === '') {
            return $value;
        }
        try {
            return NurturingCrypt::decryptString((string) $value);
        } catch (DecryptException) {
            return $value;
        }
    }

    public function set($model, string $key, $value, array $attributes)
    {
        return $value === null ? null : NurturingCrypt::encryptString((string) $value);
    }
}
