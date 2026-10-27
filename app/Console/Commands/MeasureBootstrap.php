<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\Sync\DataExporter;
use Illuminate\Console\Command;

/** گزارش فقط‌خواندنی حجم بستهٔ /api/bootstrap به‌تفکیک مجموعه برای نقش‌های مختلف */
class MeasureBootstrap extends Command
{
    protected $signature = 'sync:measure {--user= : شناسهٔ کاربر؛ بدون آن، یک کاربر فعال از هر نقش}';

    protected $description = 'حجم داده‌ای که هر نقش هنگام ورود از /api/bootstrap دریافت می‌کند (فقط خواندن)';

    public function handle(DataExporter $exporter): int
    {
        $users = $this->option('user')
            ? User::query()->whereKey($this->option('user'))->get()
            : User::query()->where('is_active', true)->get()->unique('role')->values();

        foreach ($users as $user) {
            $m = $exporter->measure($user);
            $total = array_sum(array_column($m, 'bytes'));
            $this->info(sprintf('== %s (%s): جمع %s KB (بدون پرونده‌های تربیتی)', $user->id, $user->role, number_format($total / 1024, 1)));
            uasort($m, static fn ($a, $b) => ($b['bytes'] ?? 0) <=> ($a['bytes'] ?? 0));
            $rows = [];
            foreach (array_slice($m, 0, 10, true) as $name => $v) {
                $rows[] = [$name, $v['rows'], $v['bytes'] === null ? 'رد شد' : number_format($v['bytes'] / 1024, 1).' KB', $v['bytes'] ? round($v['bytes'] / max(1, $total) * 100).'%' : ''];
            }
            $this->table(['مجموعه', 'رکورد', 'حجم', 'سهم'], $rows);
        }

        return self::SUCCESS;
    }
}
