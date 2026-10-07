<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        // نانس CSP برای اسکریپت‌های درون‌صفحه (و تگ‌های Vite)؛ باید پیش از رندر View ساخته شود
        $nonce = base64_encode(random_bytes(16));
        $request->attributes->set('csp_nonce', $nonce);
        view()->share('cspNonce', $nonce);
        Vite::useCspNonce($nonce);

        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');

        // HSTS: فقط روی HTTPS (پشت پروکسی هم با trustProxies تشخیص داده می‌شود)
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        $this->contentSecurityPolicy($request, $response, $nonce);

        if ($request->is('api/*')) {
            $response->headers->set('Cache-Control', 'no-store, private');
        }

        return $response;
    }

    private function contentSecurityPolicy(Request $request, Response $response, string $nonce): void
    {
        $mode = (string) config('app.csp_mode', 'enforce');
        // در حالت توسعه (سرور Vite) اسکریپت‌ها از localhost:5173 می‌آیند؛ CSP اعمال نمی‌شود
        if ($mode === 'off' || file_exists(public_path('hot'))) {
            return;
        }

        $directives = [
            "default-src 'self'",
            "script-src 'self' 'nonce-{$nonce}'",
            // React از style درون‌خطی استفاده می‌کند؛ اسکریپت درون‌خطی همچنان ممنوع است
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' data: https://fonts.gstatic.com",
            "img-src 'self' data: blob:",
            "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
            "worker-src 'self'",
            "manifest-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
        ];
        if ($request->isSecure()) {
            $directives[] = 'upgrade-insecure-requests';
        }

        $header = $mode === 'report-only' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
        $response->headers->set($header, implode('; ', $directives));
    }
}
