<?php

namespace App\Console\Commands;

use App\Support\NurturingAudit;
use App\Support\SecurityAlerts;
use Illuminate\Console\Command;

class VerifyNurturingAudit extends Command
{
    protected $signature = 'nurturing:verify-audit';

    protected $description = 'بررسی یکپارچگی زنجیره‌ی هش دفتر دسترسی پرونده‌های تربیتی؛ در صورت گسست، هشدار فوری (درون‌سامانه و ایتا)';

    public function handle(): int
    {
        $r = NurturingAudit::verifyChain();

        if (! $r['ok']) {
            SecurityAlerts::system(
                'audit_chain_broken',
                'دست‌کاری در دفتر دسترسی پرونده‌های تربیتی',
                'زنجیره‌ی هش دفتر دسترسی در رکورد شماره‌ی '.$r['brokenAt'].' گسسته شده است؛ ممکن است رکوردی تغییر یا حذف شده باشد. بررسی فوری لازم است.'
            );
            $this->error('زنجیره گسسته است (رکورد '.$r['brokenAt'].').');

            return self::FAILURE;
        }

        $this->info("زنجیره سالم است ({$r['checked']} رکورد بررسی شد).");

        return self::SUCCESS;
    }
}
