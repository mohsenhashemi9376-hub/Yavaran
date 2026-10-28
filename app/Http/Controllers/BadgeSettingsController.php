<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** شرایط نشان‌های افتخار پرونده‌ی دانش‌آموز: همه می‌خوانند، فقط مدیر مدرسه تغییر می‌دهد */
class BadgeSettingsController extends Controller
{
    public const DEFAULTS = [
        'windowDays' => 30,
        'discipline' => ['maxNotes' => 0, 'maxUnexcusedAbsences' => 0, 'maxLates' => 0, 'lateAfter' => '07:15'],
        'academic' => ['minScore' => 12, 'maxMissedWorksheets' => 0, 'maxMissedHomework' => 0],
    ];

    public static function current(): array
    {
        if (Schema::hasTable('badge_settings')) {
            $raw = DB::table('badge_settings')->where('key', 'conditions')->value('value');
            $saved = $raw ? json_decode($raw, true) : null;
            if (is_array($saved)) {
                return array_replace_recursive(self::DEFAULTS, $saved);
            }
        }

        return self::DEFAULTS;
    }

    public function show(): JsonResponse
    {
        return response()->json(self::current());
    }

    public function save(Request $request): JsonResponse
    {
        if (! $request->user()->isAdmin()) {
            abort(403, 'تغییر شرایط نشان‌ها فقط برای مدیر مدرسه امکان‌پذیر است.');
        }
        $data = $request->validate([
            'windowDays' => ['required', 'integer', 'between:7,365'],
            'discipline.maxNotes' => ['required', 'integer', 'between:0,20'],
            'discipline.maxUnexcusedAbsences' => ['required', 'integer', 'between:0,20'],
            'discipline.maxLates' => ['required', 'integer', 'between:0,50'],
            'discipline.lateAfter' => ['required', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'academic.minScore' => ['required', 'numeric', 'between:0,20'],
            'academic.maxMissedWorksheets' => ['required', 'integer', 'between:0,20'],
            'academic.maxMissedHomework' => ['required', 'integer', 'between:0,50'],
        ], [
            'discipline.lateAfter.regex' => 'ساعت تأخیر معتبر نیست (مثل ۰۷:۱۵).',
            '*.between' => 'مقدار واردشده خارج از محدودهٔ مجاز است.',
        ]);

        $value = [
            'windowDays' => (int) $data['windowDays'],
            'discipline' => [
                'maxNotes' => (int) $data['discipline']['maxNotes'],
                'maxUnexcusedAbsences' => (int) $data['discipline']['maxUnexcusedAbsences'],
                'maxLates' => (int) $data['discipline']['maxLates'],
                'lateAfter' => $data['discipline']['lateAfter'],
            ],
            'academic' => [
                'minScore' => (float) $data['academic']['minScore'],
                'maxMissedWorksheets' => (int) $data['academic']['maxMissedWorksheets'],
                'maxMissedHomework' => (int) $data['academic']['maxMissedHomework'],
            ],
        ];

        if (! Schema::hasTable('badge_settings')) {
            Schema::create('badge_settings', function ($table) {
                $table->string('key', 40)->primary();
                $table->longText('value')->nullable();
                $table->timestamps();
            });
        }
        DB::table('badge_settings')->updateOrInsert(
            ['key' => 'conditions'],
            ['value' => json_encode($value, JSON_UNESCAPED_UNICODE), 'updated_at' => now(), 'created_at' => now()]
        );

        return response()->json($value);
    }
}
