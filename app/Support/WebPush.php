<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * اعلان Web Push بدون متن (payload خالی): مرورگر فقط متن ثابتِ service worker را نشان می‌دهد
 * و هیچ اطلاعاتی از پیام از مسیر سرویس‌های Google/Apple/Mozilla عبور نمی‌کند.
 */
final class WebPush
{
    private const ALLOWED_HOSTS = [
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'web.push.apple.com',
    ];

    private const ALLOWED_SUFFIXES = ['.push.apple.com', '.notify.windows.com', '.push.services.mozilla.com'];

    public static function configured(): bool
    {
        return (string) config('app.vapid_public') !== '' && (string) config('app.vapid_private') !== '';
    }

    public static function endpointAllowed(string $endpoint): bool
    {
        $parts = parse_url($endpoint);
        if (! is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) {
            return false;
        }
        $host = strtolower((string) $parts['host']);
        if (in_array($host, self::ALLOWED_HOSTS, true)) {
            return true;
        }
        foreach (self::ALLOWED_SUFFIXES as $suffix) {
            if (str_ends_with($host, $suffix)) {
                return true;
            }
        }

        return false;
    }

    /** @param  array<int, string>  $userIds */
    public static function notifyUsers(array $userIds): void
    {
        if (! self::configured() || $userIds === []) {
            return;
        }
        try {
            $rows = DB::table('push_subscriptions')->whereIn('user_id', $userIds)->limit(200)->get(['id', 'endpoint']);
            foreach ($rows as $row) {
                $status = self::send((string) $row->endpoint);
                if (in_array($status, [404, 410], true)) {
                    DB::table('push_subscriptions')->where('id', $row->id)->delete();
                }
            }
        } catch (\Throwable) {
            // اعلان گوشی مکمل است؛ خطا نباید ارسال پیام را مختل کند
        }
    }

    private static function send(string $endpoint): int
    {
        if (! self::endpointAllowed($endpoint)) {
            return 410;
        }
        $origin = parse_url($endpoint, PHP_URL_SCHEME).'://'.parse_url($endpoint, PHP_URL_HOST);
        $jwt = self::jwt($origin);
        if ($jwt === null) {
            return 0;
        }
        try {
            $response = Http::timeout(4)->withHeaders([
                'Authorization' => 'vapid t='.$jwt.', k='.config('app.vapid_public'),
                'TTL' => '3600',
                'Urgency' => 'high',
                'Topic' => 'inbox-urgent',
                'Content-Length' => '0',
            ])->send('POST', $endpoint, ['body' => '']);

            return $response->status();
        } catch (\Throwable) {
            return 0;
        }
    }

    private static function jwt(string $audience): ?string
    {
        $pem = base64_decode((string) config('app.vapid_private'), true);
        if ($pem === false || $pem === '') {
            return null;
        }
        $header = self::b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $claims = self::b64u(json_encode([
            'aud' => $audience,
            'exp' => time() + 12 * 3600,
            'sub' => (string) config('app.vapid_subject'),
        ]));
        $input = $header.'.'.$claims;
        if (! openssl_sign($input, $der, $pem, OPENSSL_ALGO_SHA256)) {
            return null;
        }
        $raw = self::derToRaw($der);

        return $raw === null ? null : $input.'.'.self::b64u($raw);
    }

    /** امضای DER به قالب خام R||S (۶۴ بایت) برای JWT */
    private static function derToRaw(string $der): ?string
    {
        $o = 2;
        if (ord($der[1] ?? "\0") === 0x81) {
            $o = 3;
        }
        if (ord($der[$o] ?? "\0") !== 0x02) {
            return null;
        }
        $rl = ord($der[$o + 1]);
        $r = substr($der, $o + 2, $rl);
        $o += 2 + $rl;
        if (ord($der[$o] ?? "\0") !== 0x02) {
            return null;
        }
        $sl = ord($der[$o + 1]);
        $s = substr($der, $o + 2, $sl);

        return str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT).str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
    }

    public static function b64u(string $v): string
    {
        return rtrim(strtr(base64_encode($v), '+/', '-_'), '=');
    }
}
