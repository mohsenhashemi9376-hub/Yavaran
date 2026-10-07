<?php

namespace Tests\Feature;

use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    private function csp(string $header = 'Content-Security-Policy'): string
    {
        return (string) $this->get('/')->assertOk()->headers->get($header);
    }

    public function test_csp_blocks_inline_scripts_and_foreign_origins(): void
    {
        $csp = $this->csp();

        $this->assertStringContainsString("default-src 'self'", $csp);
        $this->assertStringContainsString("object-src 'none'", $csp);
        $this->assertStringContainsString("base-uri 'self'", $csp);
        $this->assertStringContainsString("frame-ancestors 'self'", $csp);
        $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-[A-Za-z0-9+\\/=]+'/", $csp);
        $this->assertDoesNotMatchRegularExpression("/script-src[^;]*unsafe-inline/", $csp);
        $this->assertDoesNotMatchRegularExpression("/script-src[^;]*unsafe-eval/", $csp);
    }

    public function test_csp_allows_only_the_google_fonts_hosts(): void
    {
        $csp = $this->csp();

        $this->assertStringContainsString('https://fonts.googleapis.com', $csp);
        $this->assertStringContainsString('https://fonts.gstatic.com', $csp);
        $this->assertStringNotContainsString('*', $csp);
    }

    public function test_inline_script_carries_the_same_nonce_as_the_header(): void
    {
        $response = $this->get('/')->assertOk();

        preg_match("/'nonce-([^']+)'/", (string) $response->headers->get('Content-Security-Policy'), $m);
        $this->assertNotEmpty($m[1] ?? null);
        $this->assertStringContainsString('<script nonce="'.$m[1].'">', $response->getContent());
    }

    public function test_nonce_changes_on_every_request(): void
    {
        preg_match("/'nonce-([^']+)'/", $this->csp(), $a);
        preg_match("/'nonce-([^']+)'/", $this->csp(), $b);

        $this->assertNotSame($a[1], $b[1]);
    }

    public function test_report_only_mode_uses_the_report_only_header(): void
    {
        config(['app.csp_mode' => 'report-only']);

        $response = $this->get('/')->assertOk();

        $this->assertNull($response->headers->get('Content-Security-Policy'));
        $this->assertNotEmpty($response->headers->get('Content-Security-Policy-Report-Only'));
    }

    public function test_csp_can_be_turned_off(): void
    {
        config(['app.csp_mode' => 'off']);

        $response = $this->get('/')->assertOk();

        $this->assertNull($response->headers->get('Content-Security-Policy'));
        $this->assertNull($response->headers->get('Content-Security-Policy-Report-Only'));
    }

    public function test_hsts_is_sent_only_over_https(): void
    {
        $this->assertNull($this->get('/')->headers->get('Strict-Transport-Security'));

        $secure = $this->get('https://localhost/')->assertOk();
        $this->assertStringContainsString('max-age=31536000', (string) $secure->headers->get('Strict-Transport-Security'));
        $this->assertStringContainsString('includeSubDomains', (string) $secure->headers->get('Strict-Transport-Security'));
        $this->assertStringContainsString('upgrade-insecure-requests', (string) $secure->headers->get('Content-Security-Policy'));
    }

    public function test_basic_hardening_headers_are_present(): void
    {
        $headers = $this->get('/')->headers;

        $this->assertSame('SAMEORIGIN', $headers->get('X-Frame-Options'));
        $this->assertSame('nosniff', $headers->get('X-Content-Type-Options'));
        $this->assertSame('strict-origin-when-cross-origin', $headers->get('Referrer-Policy'));
        $this->assertSame('same-origin', $headers->get('Cross-Origin-Opener-Policy'));
        $this->assertStringContainsString('camera=()', (string) $headers->get('Permissions-Policy'));
    }

    public function test_api_responses_are_never_cached(): void
    {
        $response = $this->getJson('/api/bootstrap')->assertOk();

        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }
}
