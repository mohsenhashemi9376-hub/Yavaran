<?php

use Illuminate\Support\Facades\Schedule;

// نیازمند کرون‌جاب cPanel: * * * * * php /path/to/artisan schedule:run
Schedule::command('nurturing:verify-audit')->dailyAt('02:30');
Schedule::command('db:backup')->dailyAt('03:15')->when(fn () => (string) config('app.backup_key') !== '');
