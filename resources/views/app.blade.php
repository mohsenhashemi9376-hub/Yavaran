<!doctype html>
<html lang="fa" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
    <title>مدرسه یاوران ولایت</title>
    <link rel="icon" type="image/svg+xml" href="/yavaran-logo.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#0b4838" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="یاوران ولایت" />
    <meta name="application-name" content="یاوران ولایت" />
    <meta name="msapplication-TileColor" content="#0b4838" />
    <meta name="msapplication-TileImage" content="/icons/icon-192.png" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="description" content="سامانه جامع مدیریت آموزشی، انضباطی و تربیتی مدرسه یاوران ولایت شامل مدیریت دروس و تخصیص اساتید دوره اول متوسطه، دفتر نمرات و مانیتورینگ کارنامه، و پنل‌های معاونت تربیتی و انضباطی" />
    <meta property="og:title" content="مدرسه یاوران ولایت" />
    <meta property="og:description" content="سامانه جامع مدیریت آموزشی، انضباطی و تربیتی مدرسه یاوران ولایت" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    @vite('resources/js/main.tsx')
  </head>
  <body class="bg-slate-50 text-slate-900 font-['Vazirmatn',sans-serif] antialiased selection:bg-emerald-500 selection:text-white">
    <div id="root"></div>
    <script nonce="{{ $cspNonce ?? '' }}">
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
        });
      }
    </script>
  </body>
</html>
