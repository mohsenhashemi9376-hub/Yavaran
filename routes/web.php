<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BootstrapController;
use App\Http\Controllers\MentorMessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NurturingAuditController;
use App\Http\Controllers\NurturingRecordController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SpaController;
use App\Http\Controllers\SyncController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API داخلی سامانه (Session + CSRF — هم‌دامنه با رابط کاربری)
|--------------------------------------------------------------------------
*/
Route::prefix('api')->group(function (): void {
    Route::get('bootstrap', BootstrapController::class)->name('api.bootstrap');

    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:30,1')
        ->name('api.login');

    Route::middleware('auth')->group(function (): void {
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('api.logout');
        Route::post('profile', [ProfileController::class, 'update'])
            ->middleware('throttle:20,1')
            ->name('api.profile.update');
        Route::prefix('mentor-messages')->middleware('throttle:120,1')->group(function (): void {
            Route::post('/', [MentorMessageController::class, 'store'])->name('api.mentor-messages.store');
            Route::get('active', [MentorMessageController::class, 'active'])->name('api.mentor-messages.active');
            Route::get('sent', [MentorMessageController::class, 'sent'])->name('api.mentor-messages.sent');
            Route::post('{message}/acknowledge', [MentorMessageController::class, 'acknowledge'])
                ->whereNumber('message')
                ->name('api.mentor-messages.acknowledge');
        });
        Route::prefix('notifications')->middleware('throttle:240,1')->group(function (): void {
            Route::get('/', [NotificationController::class, 'index'])->name('api.notifications.index');
            Route::post('/', [NotificationController::class, 'store'])->name('api.notifications.store');
            Route::post('read-all', [NotificationController::class, 'readAll'])->name('api.notifications.read-all');
            Route::post('{notification}/read', [NotificationController::class, 'read'])
                ->whereNumber('notification')
                ->name('api.notifications.read');
        });
        Route::get('students/{student}/nurturing-record', [NurturingRecordController::class, 'show'])
            ->middleware('throttle:120,1')
            ->name('api.students.nurturing-record');
        Route::get('nurturing-audit', [NurturingAuditController::class, 'index'])
            ->middleware('throttle:60,1')
            ->name('api.nurturing-audit');
        Route::post('sync', SyncController::class)
            ->middleware('throttle:240,1')
            ->name('api.sync');
    });

    Route::any('{any}', fn () => response()->json(['message' => 'مسیر یافت نشد.'], 404))->where('any', '.*');
});

/*
|--------------------------------------------------------------------------
| رابط کاربری (React SPA)
|--------------------------------------------------------------------------
*/
Route::get('/{any?}', SpaController::class)
    ->where('any', '.*')
    ->name('app');
