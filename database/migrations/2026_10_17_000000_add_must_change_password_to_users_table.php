<?php

use App\Support\PasswordRules;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** تغییر اجباری رمز عبور در اولین ورود؛ حساب‌هایی که هنوز رمز پیش‌فرض/ضعیف دارند علامت می‌خورند */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'must_change_password')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('must_change_password')->default(false);
            });
        }

        DB::table('users')->select(['id', 'username', 'password'])->orderBy('id')->chunk(100, function ($users): void {
            foreach ($users as $u) {
                if (! $u->password) {
                    continue;
                }
                foreach (['123', '1234', '12345', '123456', '12345678', 'password'] as $weak) {
                    if (password_verify($weak, $u->password)) {
                        DB::table('users')->where('id', $u->id)->update(['must_change_password' => true]);
                        break;
                    }
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('must_change_password');
        });
    }
};
