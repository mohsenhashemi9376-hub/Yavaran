<?php

namespace Tests\Unit;

use App\Support\PasswordRules;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class PasswordRulesTest extends TestCase
{
    #[DataProvider('weakPasswords')]
    public function test_common_passwords_are_weak(string $password): void
    {
        $this->assertTrue(PasswordRules::isWeak($password));
    }

    /** @return array<string, array{string}> */
    public static function weakPasswords(): array
    {
        return [
            'default 123' => ['123'],
            'sequence' => ['123456'],
            'word' => ['password'],
            'uppercase variant' => ['QWERTY'],
            'padded' => ['  123  '],
            'empty' => [''],
        ];
    }

    public function test_password_equal_to_username_is_weak(): void
    {
        $this->assertTrue(PasswordRules::isWeak('Reza.Ahmadi', 'reza.ahmadi'));
    }

    public function test_reasonable_password_is_accepted(): void
    {
        $this->assertFalse(PasswordRules::isWeak('Str0ng-Pass!'));
        $this->assertFalse(PasswordRules::isWeak('آسمان۱۴۰۵-مدرسه', 'someone'));
    }

    public function test_forced_change_minimum_length_is_eight(): void
    {
        $this->assertSame(8, PasswordRules::MIN_LENGTH_FORCED);
    }
}
