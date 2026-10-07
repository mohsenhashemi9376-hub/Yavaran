<?php

namespace Tests\Unit;

use App\Support\Totp;
use PHPUnit\Framework\TestCase;

class TotpTest extends TestCase
{
    /** رمز آزمایشی RFC 6238 (ASCII: 12345678901234567890) */
    private const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    public function test_matches_rfc6238_test_vectors(): void
    {
        // مقادیر ۸رقمی RFC: 94287082، 07081804، 89005924 ← ۶ رقم آخر
        $this->assertSame('287082', Totp::code(self::RFC_SECRET, 59));
        $this->assertSame('081804', Totp::code(self::RFC_SECRET, 1111111109));
        $this->assertSame('005924', Totp::code(self::RFC_SECRET, 1234567890));
    }

    public function test_generated_secret_is_base32_and_unique(): void
    {
        $a = Totp::generateSecret();
        $b = Totp::generateSecret();

        $this->assertMatchesRegularExpression('/^[A-Z2-7]{32}$/', $a);
        $this->assertNotSame($a, $b);
    }

    public function test_verify_accepts_current_code_and_returns_its_step(): void
    {
        $secret = Totp::generateSecret();

        $step = Totp::verify($secret, Totp::code($secret));

        $this->assertSame(intdiv(time(), 30), $step);
    }

    public function test_verify_tolerates_one_step_of_clock_drift(): void
    {
        $secret = Totp::generateSecret();

        $this->assertNotNull(Totp::verify($secret, Totp::code($secret, time() - 30)));
        $this->assertNotNull(Totp::verify($secret, Totp::code($secret, time() + 30)));
    }

    public function test_verify_rejects_codes_outside_the_window(): void
    {
        $secret = Totp::generateSecret();

        $this->assertNull(Totp::verify($secret, Totp::code($secret, time() - 300)));
        $this->assertNull(Totp::verify($secret, Totp::code($secret, time() + 300)));
    }

    public function test_verify_rejects_malformed_input(): void
    {
        $secret = Totp::generateSecret();

        $this->assertNull(Totp::verify($secret, ''));
        $this->assertNull(Totp::verify($secret, '12345'));
        $this->assertNull(Totp::verify($secret, '1234567'));
        $this->assertNull(Totp::verify($secret, 'abcdef'));
    }

    public function test_verify_ignores_spaces_and_separators_in_the_code(): void
    {
        $secret = Totp::generateSecret();
        $code = Totp::code($secret);

        $this->assertNotNull(Totp::verify($secret, substr($code, 0, 3).' '.substr($code, 3)));
    }

    public function test_code_from_another_secret_is_rejected(): void
    {
        $this->assertNull(Totp::verify(Totp::generateSecret(), Totp::code(Totp::generateSecret())));
    }

    public function test_uri_contains_secret_issuer_and_account(): void
    {
        $uri = Totp::uri('ABCDEFGH', 'ali@school', 'Yavaran');

        $this->assertStringStartsWith('otpauth://totp/Yavaran:', $uri);
        $this->assertStringContainsString('secret=ABCDEFGH', $uri);
        $this->assertStringContainsString('issuer=Yavaran', $uri);
        $this->assertStringContainsString('ali%40school', $uri);
    }
}
