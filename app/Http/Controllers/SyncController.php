<?php

namespace App\Http\Controllers;

use App\Support\Sync\CollectionRegistry;
use App\Support\Sync\SyncService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use JsonException;

class SyncController extends Controller
{
    private const MAX_ITEMS = 1000;

    public function __invoke(Request $request, SyncService $sync): JsonResponse
    {
        try {
            // داده‌ها به‌صورت شیء خوانده می‌شوند تا تفاوت {} و [] حفظ شود
            $payload = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return $this->invalid('ساختار داده ارسالی نامعتبر است.');
        }

        if (! is_object($payload) || ! isset($payload->collection) || ! is_string($payload->collection)
            || ! CollectionRegistry::has($payload->collection)) {
            return $this->invalid('مجموعه داده نامعتبر است.');
        }

        $upserts = isset($payload->upserts) && is_array($payload->upserts) ? $payload->upserts : [];
        $deletes = isset($payload->deletes) && is_array($payload->deletes) ? $payload->deletes : [];

        if (count($upserts) + count($deletes) > self::MAX_ITEMS) {
            return $this->invalid('حجم تغییرات ارسالی بیش از حد مجاز است.');
        }

        $cleanUpserts = [];
        $seen = [];
        foreach ($upserts as $item) {
            if (! is_object($item) || ! $this->validId($item->id ?? null) || ! isset($item->data) || ! is_object($item->data)) {
                return $this->invalid('رکورد ارسالی نامعتبر است.');
            }
            $cleanUpserts[$item->id] = (object) [
                'id' => $item->id,
                'data' => $item->data,
                'prepend' => ! empty($item->prepend),
            ];
            $seen[$item->id] = true;
        }

        $cleanDeletes = [];
        foreach ($deletes as $id) {
            if (! $this->validId($id)) {
                return $this->invalid('شناسه حذف نامعتبر است.');
            }
            if (! isset($seen[$id])) {
                $cleanDeletes[] = $id;
            }
        }

        try {
            $sync->apply($request->user(), $payload->collection, array_values($cleanUpserts), array_values(array_unique($cleanDeletes)));
        } catch (QueryException $e) {
            if (($e->errorInfo[0] ?? null) === '23000') {
                return $this->invalid('اطلاعات تکراری است (نام کاربری یا شناسه قبلاً ثبت شده است).');
            }
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    private function validId(mixed $id): bool
    {
        return is_string($id) && $id !== '' && mb_strlen($id) <= 100 && ! preg_match('/[\x00-\x1F]/', $id);
    }

    private function invalid(string $message): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message], 422);
    }
}
