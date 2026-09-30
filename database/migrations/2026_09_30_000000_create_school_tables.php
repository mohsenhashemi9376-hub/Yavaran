<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ساختار کامل دیتابیس مدرسه یاوران ولایت (معادل database.sql).
 * هر رکورد کامل در ستون data (JSON) نگهداری می‌شود و ستون‌های کلیدی
 * برای جستجو، گزارش‌گیری و کنترل دسترسی ایندکس شده‌اند.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->string('id', 100)->primary();
            $table->string('username', 100)->nullable()->unique();
            $table->string('name', 191)->default('');
            $table->string('role', 40)->default('teacher')->index();
            $table->string('phone', 30)->nullable()->index();
            $table->boolean('is_active')->default(true);
            $table->string('password')->nullable();
            $table->text('password_encrypted')->nullable();
            $table->rememberToken();
            $this->common($table);
        });

        $this->dataTable('school_classes', function (Blueprint $table) {
            $table->string('name', 191)->default('');
            $table->string('grade', 100)->nullable()->index();
            $table->string('academic_year', 30)->nullable();
        });

        $this->dataTable('bell_periods', function (Blueprint $table) {
            $table->string('name', 100)->default('');
        });

        $this->dataTable('students', function (Blueprint $table) {
            $table->string('class_id', 100)->nullable()->index();
            $table->string('first_name', 100)->default('');
            $table->string('last_name', 100)->default('');
            $table->string('national_id', 30)->nullable()->index();
            $table->string('student_code', 30)->nullable();
            $table->index(['last_name', 'first_name'], 'students_name_index');
        });

        $this->dataTable('attendance_sessions', function (Blueprint $table) {
            $table->string('class_id', 100)->nullable()->index();
            $table->string('teacher_id', 100)->nullable()->index();
            $table->string('subject', 191)->nullable();
            $table->string('session_date', 20)->nullable()->index();
        });

        $this->dataTable('academic_subjects', function (Blueprint $table) {
            $table->string('name', 191)->default('');
            $table->string('code', 50)->nullable();
        });

        $this->dataTable('academic_grades', function (Blueprint $table) {
            $table->string('student_id', 100)->nullable()->index();
            $table->string('class_id', 100)->nullable()->index();
            $table->string('subject_id', 100)->nullable()->index();
        });

        foreach (['morning_delays', 'school_absences'] as $name) {
            $this->dataTable($name, function (Blueprint $table) {
                $table->string('student_id', 100)->nullable()->index();
                $table->string('class_id', 100)->nullable()->index();
                $table->string('record_date', 20)->nullable()->index();
            });
        }

        $this->dataTable('student_observations', function (Blueprint $table) {
            $table->string('student_id', 100)->nullable()->index();
            $table->string('record_date', 20)->nullable();
        });

        $this->dataTable('nurturing_dossiers', function (Blueprint $table) {
            $table->string('student_id', 100)->nullable()->index();
        });

        $this->dataTable('coach_evaluations', function (Blueprint $table) {
            $table->string('student_id', 100)->nullable()->index();
            $table->string('coach_id', 100)->nullable()->index();
        });

        $this->dataTable('teacher_evaluations', function (Blueprint $table) {
            $table->string('teacher_id', 100)->nullable()->index();
        });

        $this->dataTable('school_announcements', function (Blueprint $table) {
            $table->string('title', 191)->nullable();
            $table->string('priority', 20)->nullable();
        });

        $this->dataTable('school_grades', function (Blueprint $table) {
            $table->string('name', 100)->default('');
            $table->string('status', 20)->default('active');
        });

        $this->dataTable('school_settings', function (Blueprint $table) {
            //
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('user_id', 100)->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration');
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration');
        });
    }

    public function down(): void
    {
        foreach ([
            'cache_locks', 'cache', 'sessions', 'school_settings', 'school_grades', 'school_announcements',
            'teacher_evaluations', 'coach_evaluations', 'nurturing_dossiers', 'student_observations',
            'school_absences', 'morning_delays', 'academic_grades', 'academic_subjects', 'attendance_sessions',
            'students', 'bell_periods', 'school_classes', 'users',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function dataTable(string $name, Closure $columns): void
    {
        Schema::create($name, function (Blueprint $table) use ($columns) {
            $table->string('id', 100)->primary();
            $columns($table);
            $this->common($table);
        });
    }

    private function common(Blueprint $table): void
    {
        $table->integer('sort_order')->default(0)->index();
        $table->longText('data');
        $table->timestamps();
    }
};
