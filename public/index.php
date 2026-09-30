<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

if (! file_exists(__DIR__.'/../vendor/autoload.php')) {
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>مدرسه یاوران ولایت</title>'
        .'<body style="font-family:tahoma;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh">'
        .'<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;max-width:480px;text-align:center">'
        .'<h2 style="color:#065f46">بستهٔ نصب کامل نیست</h2>'
        .'<p style="color:#475569;line-height:2">پوشهٔ <b>vendor</b> روی هاست وجود ندارد. لطفاً فایل <b>yavaran-cpanel.zip</b> '
        .'(خروجی ساخته‌شده) را آپلود و استخراج کنید.</p></div></body></html>';
    exit;
}

require __DIR__.'/../vendor/autoload.php';
require __DIR__.'/../bootstrap/ensure-environment.php';

/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
