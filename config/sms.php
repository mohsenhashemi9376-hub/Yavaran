<?php

return [
    /*
     * ورود با کد یکبارمصرف پیامکی برای مربی و معاون تربیتی (در هر بار ورود). معلم‌ها شامل نمی‌شوند.
     * تا زمانی که درگاه پیامک تنظیم نشده، false بماند تا کسی از سامانه بیرون نماند.
     */
    'otp_enabled' => (bool) env('SMS_OTP_ENABLED', false),
    'otp_roles' => ['coach', 'vice_nurturing'],
    'otp_ttl_seconds' => (int) env('SMS_OTP_TTL', 180),
    'otp_resend_seconds' => (int) env('SMS_OTP_RESEND', 60),

    /* kavenegar | log (log فقط برای آزمایش و در محیط production غیرمجاز است) */
    'driver' => env('SMS_DRIVER', 'kavenegar'),
    'api_key' => env('SMS_API_KEY'),
    /* نام قالب (Template) تأیید در پنل کاوه‌نگار؛ متن قالب: «کد ورود شما: %token» */
    'template' => env('SMS_TEMPLATE', 'yavaran-otp'),
];
