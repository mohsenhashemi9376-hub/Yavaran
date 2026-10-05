<?php
/**
 * دریافت و اکسترکت خودکار بسته‌ی دیپلوی روی هاست (cPanel).
 * ورک‌فلو گیت‌هاب زیپ را با cURL (فیلد multipart به نام package) از طریق HTTPS می‌فرستد:
 *   curl -F "package=@deploy.zip" "https://example.ir/deploy-extract.php?token=..."
 * این فایل باید یک بار به‌صورت دستی در public_html قرار داده شود.
 *
 * توکن از متغیر DEPLOY_TOKEN داخل فایل .env همین پوشه خوانده می‌شود (فایل .env هرگز دیپلوی نمی‌شود).
 */
header('Content-Type: text/plain; charset=utf-8');

$root = __DIR__;
$token = '';
$envFile = $root . '/.env';
if (is_readable($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES) as $line) {
        if (preg_match('/^\s*DEPLOY_TOKEN\s*=\s*"?([^"\r\n]+)"?\s*$/', $line, $m)) {
            $token = trim($m[1]);
        }
    }
}

$given = (string) ($_GET['token'] ?? '');
if ($token === '' || !hash_equals($token, $given)) {
    http_response_code(403);
    exit('forbidden');
}

$zipPath = $root . '/deploy.zip';
if (isset($_FILES['package'])) {
    $up = $_FILES['package'];
    if ($up['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($up['tmp_name']) || !move_uploaded_file($up['tmp_name'], $zipPath)) {
        http_response_code(400);
        exit('upload failed (code ' . (int) $up['error'] . ')');
    }
}
if (!is_file($zipPath)) {
    http_response_code(404);
    exit('deploy.zip not found');
}

@set_time_limit(300);
$zip = new ZipArchive();
if ($zip->open($zipPath) !== true) {
    http_response_code(500);
    exit('cannot open zip');
}

// فایل‌های حساس سرور هرگز بازنویسی نمی‌شوند
foreach (['.env'] as $protected) {
    if ($zip->locateName($protected) !== false) {
        $zip->deleteName($protected);
    }
}

if (!$zip->extractTo($root)) {
    $zip->close();
    http_response_code(500);
    exit('extract failed');
}
$count = $zip->numFiles;
$zip->close();
@unlink($zipPath);

foreach (glob($root . '/bootstrap/cache/*.php') ?: [] as $f) {
    @unlink($f);
}

echo "ok: extracted {$count} files";
