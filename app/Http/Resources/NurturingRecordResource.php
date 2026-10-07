<?php

namespace App\Http\Resources;

use App\Models\NurturingDossier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * پرونده تربیتی (فقط کارکنان مجاز). محتوا از ستون رمزنگاری‌شده خوانده می‌شود.
 * این Resource هرگز نباید در پنل والدین یا هر خروجی عمومی استفاده شود.
 *
 * @mixin NurturingDossier
 */
class NurturingRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $content = json_decode((string) $this->data, true);

        return [
            'studentId' => $this->student_id,
            'record' => is_array($content) ? $content : [],
            'updatedAt' => optional($this->updated_at)->toIso8601String(),
        ];
    }
}
