<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // TRUSTED_PROXIES: آدرس IP پروکسی/CDN (با ویرگول جدا شود) یا * ؛ هدرهای X-Forwarded-* فقط از این مبداها پذیرفته می‌شوند
        $trusted = trim((string) env('TRUSTED_PROXIES', '*'));
        $middleware->trustProxies(at: $trusted === '*' ? '*' : array_values(array_filter(array_map('trim', explode(',', $trusted)))));
        $middleware->redirectGuestsTo('/');
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
        $middleware->alias(['password.changed' => \App\Http\Middleware\EnsurePasswordChanged::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson()
        );
    })
    ->create();
