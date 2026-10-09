<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BootstrapController;
use App\Http\Controllers\MentorMessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\NurturingAuditController;
use App\Http\Controllers\NurturingRecordController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ReferralController;
use App\Http\Controllers\SpaController;
use App\Http\Controllers\SyncController;
use App\Http\Controllers\TwoFactorController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API داخلی سامانه (Session + CSRF — هم‌دامنه با رابط کاربری)
|--------------------------------------------------------------------------
*/
Route::prefix('api')->middleware(\App\Http\Middleware\NurturingSessionGuard::class)->group(function (): void {
    Route::get('bootstrap', BootstrapController::class)->name('api.bootstrap');

    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:30,1')
        ->name('api.login');

    Route::post('auth/two-factor', [AuthController::class, 'twoFactorLogin'])
        ->middleware('throttle:30,1')
        ->name('api.login.two-factor');

    Route::middleware(['auth', \Illuminate\Session\Middleware\AuthenticateSession::class, 'password.changed'])->group(function (): void {
        Route::prefix('two-factor')->middleware('throttle:30,1')->group(function (): void {
            Route::get('/', [TwoFactorController::class, 'status'])->name('api.two-factor.status');
            Route::post('setup', [TwoFactorController::class, 'setup'])->name('api.two-factor.setup');
            Route::post('confirm', [TwoFactorController::class, 'confirm'])->name('api.two-factor.confirm');
            Route::post('disable', [TwoFactorController::class, 'disable'])->name('api.two-factor.disable');
        });
        Route::post('auth/confirm-password', [AuthController::class, 'confirmPassword'])
            ->middleware('throttle:20,1')
            ->name('api.confirm-password');
        Route::post('auth/logout-others', [AuthController::class, 'logoutOtherDevices'])
            ->middleware('throttle:10,1')
            ->name('api.logout-others');
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
            Route::get('circulars/{circular}/readers', [NotificationController::class, 'circularReaders'])
                ->where('circular', '[A-Za-z0-9_\-]+')
                ->name('api.notifications.circular-readers');
            Route::post('{notification}/read', [NotificationController::class, 'read'])
                ->whereNumber('notification')
                ->name('api.notifications.read');
        });
        Route::prefix('referrals')->middleware('throttle:60,1')->group(function (): void {
            Route::get('/', [ReferralController::class, 'index'])->name('api.referrals.index');
            Route::post('/', [ReferralController::class, 'store'])->name('api.referrals.store');
        });
        Route::get('students/{student}/nurturing-record', [NurturingRecordController::class, 'show'])
            ->middleware('throttle:120,1')
            ->name('api.students.nurturing-record');
        Route::get('nurturing-audit/review', [NurturingAuditController::class, 'review'])
            ->middleware('throttle:60,1')
            ->name('api.nurturing-audit.review');
        Route::post('nurturing/revoke-sessions', [NurturingAuditController::class, 'revokeSessions'])
            ->middleware('throttle:20,1')
            ->name('api.nurturing.revoke-sessions');
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
