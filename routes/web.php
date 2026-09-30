<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BootstrapController;
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
        Route::post('auth/switch', [AuthController::class, 'switch'])
            ->middleware('throttle:30,1')
            ->name('api.switch');
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
