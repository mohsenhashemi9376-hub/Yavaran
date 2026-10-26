-- ارتقای ایمن دیتابیس موجود (بدون حذف یا بازنویسی داده‌ها)
-- این فایل را به‌جای database.sql روی دیتابیس فعلی اجرا کنید.
-- هر دستور فقط در صورت نبودن جدول/ستون اعمال می‌شود (اجرای مجدد بی‌خطر است).

CREATE TABLE IF NOT EXISTS `comprehensive_exams` (
  `id` varchar(100) NOT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `comprehensive_exams_class_id_index` (`class_id`),
  KEY `comprehensive_exams_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_assignments` (
  `id` varchar(100) NOT NULL,
  `class_id` varchar(100) NOT NULL,
  `subject_id` varchar(100) NOT NULL,
  `user_id` varchar(100) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `course_assignments_class_subject_unique` (`class_id`,`subject_id`),
  KEY `course_assignments_class_id_index` (`class_id`),
  KEY `course_assignments_subject_id_index` (`subject_id`),
  KEY `course_assignments_user_id_index` (`user_id`),
  KEY `course_assignments_sort_order_index` (`sort_order`),
  CONSTRAINT `course_assignments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `morning_attendance` (
  `id` varchar(100) NOT NULL,
  `student_id` varchar(100) NOT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `record_date` varchar(20) NOT NULL,
  `status` varchar(10) NOT NULL DEFAULT 'absent',
  `entry_time` time DEFAULT NULL,
  `delay_minutes` int NOT NULL DEFAULT 0,
  `is_acknowledged` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `morning_attendance_student_date_unique` (`student_id`,`record_date`),
  KEY `morning_attendance_student_id_index` (`student_id`),
  KEY `morning_attendance_class_id_index` (`class_id`),
  KEY `morning_attendance_record_date_index` (`record_date`),
  KEY `morning_attendance_is_acknowledged_index` (`is_acknowledged`),
  KEY `morning_attendance_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MySQL 8 / MariaDB 10.0.2+ : ADD COLUMN IF NOT EXISTS فقط در MariaDB پشتیبانی می‌شود.
-- اگر MySQL دارید و خطای «Duplicate column» گرفتید یعنی ستون از قبل وجود دارد؛ بی‌خطر است.
ALTER TABLE `users` ADD COLUMN `permissions` json DEFAULT NULL AFTER `is_active`;

-- ستون‌های گزارش‌پذیر جلسات کلاسی (اگر خطای «Duplicate column» گرفتید یعنی از قبل وجود دارد؛ بی‌خطر است)
ALTER TABLE `attendance_sessions` ADD COLUMN `subject_id` varchar(100) DEFAULT NULL AFTER `subject`;
ALTER TABLE `attendance_sessions` ADD COLUMN `period_number` tinyint unsigned DEFAULT NULL AFTER `subject_id`;
ALTER TABLE `attendance_sessions` ADD COLUMN `lesson_topic` varchar(255) DEFAULT NULL AFTER `period_number`;

-- موجه/غیرموجه و یادداشت علت غیبت صبحگاه (اگر خطای «Duplicate column» گرفتید یعنی از قبل وجود دارد؛ بی‌خطر است)
ALTER TABLE `morning_attendance` ADD COLUMN `is_excused` tinyint(1) DEFAULT 0 AFTER `is_acknowledged`;
ALTER TABLE `morning_attendance` ADD COLUMN `absence_note` text DEFAULT NULL AFTER `is_excused`;

-- اعلان‌ها و فعالیت‌های خارج از مدرسه معلمان
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sender_id` varchar(100) DEFAULT NULL,
  `receiver_id` varchar(100) NOT NULL,
  `title` varchar(191) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(30) NOT NULL DEFAULT 'announcement',
  `priority` varchar(20) NOT NULL DEFAULT 'normal',
  `ref_id` varchar(100) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_sender_id_index` (`sender_id`),
  KEY `notifications_receiver_id_index` (`receiver_id`),
  KEY `notifications_receiver_read_index` (`receiver_id`,`is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `teacher_activities` (
  `id` varchar(100) NOT NULL,
  `teacher_id` varchar(100) NOT NULL,
  `date` date NOT NULL,
  `activity_title` text NOT NULL,
  `hours` decimal(4,2) NOT NULL DEFAULT 0.00,
  `status` varchar(20) NOT NULL DEFAULT 'approved',
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `teacher_activities_teacher_id_index` (`teacher_id`),
  KEY `teacher_activities_date_index` (`date`),
  KEY `teacher_activities_sort_order_index` (`sort_order`),
  CONSTRAINT `teacher_activities_teacher_id_foreign` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- بازه‌های ثبت نمره (فقط «مستمر مهر» در ابتدا فعال است؛ معاون آموزش سایر بازه‌ها را فعال می‌کند)
CREATE TABLE IF NOT EXISTS `grade_periods` (
  `id` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL DEFAULT '',
  `code` varchar(50) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `deadline` date DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `grade_periods_code_index` (`code`),
  KEY `grade_periods_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `grade_periods` (`id`, `name`, `code`, `is_active`, `deadline`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('mehrContinuous', 'مستمر مهر', 'mehrContinuous', 1, NULL, 0, '{"id":"mehrContinuous","code":"mehrContinuous","name":"مستمر مهر","isActive":true}', NOW(), NOW()),
('abanContinuous', 'مستمر آبان', 'abanContinuous', 0, NULL, 1, '{"id":"abanContinuous","code":"abanContinuous","name":"مستمر آبان","isActive":false}', NOW(), NOW()),
('azarContinuous', 'مستمر آذر', 'azarContinuous', 0, NULL, 2, '{"id":"azarContinuous","code":"azarContinuous","name":"مستمر آذر","isActive":false}', NOW(), NOW()),
('term1Continuous', 'مستمر دی', 'term1Continuous', 0, NULL, 3, '{"id":"term1Continuous","code":"term1Continuous","name":"مستمر دی","isActive":false}', NOW(), NOW()),
('term1Final', 'پایانی نوبت اول (دی)', 'term1Final', 0, NULL, 4, '{"id":"term1Final","code":"term1Final","name":"پایانی نوبت اول (دی)","isActive":false}', NOW(), NOW()),
('bahmanContinuous', 'مستمر بهمن', 'bahmanContinuous', 0, NULL, 5, '{"id":"bahmanContinuous","code":"bahmanContinuous","name":"مستمر بهمن","isActive":false}', NOW(), NOW()),
('esfandContinuous', 'مستمر اسفند', 'esfandContinuous', 0, NULL, 6, '{"id":"esfandContinuous","code":"esfandContinuous","name":"مستمر اسفند","isActive":false}', NOW(), NOW()),
('farvardinContinuous', 'مستمر فروردین', 'farvardinContinuous', 0, NULL, 7, '{"id":"farvardinContinuous","code":"farvardinContinuous","name":"مستمر فروردین","isActive":false}', NOW(), NOW()),
('ordibeheshtContinuous', 'مستمر اردیبهشت', 'ordibeheshtContinuous', 0, NULL, 8, '{"id":"ordibeheshtContinuous","code":"ordibeheshtContinuous","name":"مستمر اردیبهشت","isActive":false}', NOW(), NOW()),
('term2Continuous', 'مستمر ترم دوم (خرداد)', 'term2Continuous', 0, NULL, 9, '{"id":"term2Continuous","code":"term2Continuous","name":"مستمر ترم دوم (خرداد)","isActive":false}', NOW(), NOW()),
('term2Final', 'پایانی نوبت دوم (خرداد)', 'term2Final', 0, NULL, 10, '{"id":"term2Final","code":"term2Final","name":"پایانی نوبت دوم (خرداد)","isActive":false}', NOW(), NOW());

-- کارگاه‌های انتخابی علمی و مهارتی (۶ کارگاه اولیه)
CREATE TABLE IF NOT EXISTS `workshops` (
  `id` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL DEFAULT '',
  `type` varchar(20) NOT NULL DEFAULT 'workshop',
  `category` varchar(20) NOT NULL DEFAULT 'scientific',
  `teacher_id` varchar(100) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `workshops_teacher_id_index` (`teacher_id`),
  KEY `workshops_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `workshops` (`id`, `name`, `type`, `category`, `teacher_id`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('ws-medicine', 'طب', 'workshop', 'scientific', NULL, 0, '{"id":"ws-medicine","name":"طب","category":"scientific","studentIds":[]}', NOW(), NOW()),
('ws-social', 'روابط اجتماعی', 'workshop', 'scientific', NULL, 1, '{"id":"ws-social","name":"روابط اجتماعی","category":"scientific","studentIds":[]}', NOW(), NOW()),
('ws-history', 'تاریخ', 'workshop', 'scientific', NULL, 2, '{"id":"ws-history","name":"تاریخ","category":"scientific","studentIds":[]}', NOW(), NOW()),
('ws-technical', 'فنی', 'workshop', 'skill', NULL, 3, '{"id":"ws-technical","name":"فنی","category":"skill","studentIds":[]}', NOW(), NOW()),
('ws-writing', 'نویسندگی', 'workshop', 'skill', NULL, 4, '{"id":"ws-writing","name":"نویسندگی","category":"skill","studentIds":[]}', NOW(), NOW()),
('ws-ai', 'هوش مصنوعی', 'workshop', 'skill', NULL, 5, '{"id":"ws-ai","name":"هوش مصنوعی","category":"skill","studentIds":[]}', NOW(), NOW());

-- تکلیف جلسه درسی (اگر خطای «Duplicate column» گرفتید یعنی از قبل وجود دارد؛ بی‌خطر است)
ALTER TABLE `attendance_sessions` ADD COLUMN `homework` TEXT NULL AFTER `lesson_topic`;

-- جداسازی کارگاه‌های پایه هشتم و نهم (اگر خطای «Duplicate column» گرفتید یعنی از قبل وجود دارد؛ بی‌خطر است)
ALTER TABLE `workshops` ADD COLUMN `grade_level` TINYINT NOT NULL DEFAULT 8 AFTER `category`;
UPDATE `workshops` SET `grade_level` = 8 WHERE `id` IN ('ws-medicine','ws-social','ws-history','ws-technical','ws-writing','ws-ai');
INSERT IGNORE INTO `workshops` (`id`, `name`, `type`, `category`, `grade_level`, `teacher_id`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('ws9-medicine', 'طب', 'workshop', 'scientific', 9, NULL, 6, '{"id":"ws9-medicine","name":"طب","category":"scientific","gradeLevel":9,"studentIds":[]}', NOW(), NOW()),
('ws9-social', 'روابط اجتماعی', 'workshop', 'scientific', 9, NULL, 7, '{"id":"ws9-social","name":"روابط اجتماعی","category":"scientific","gradeLevel":9,"studentIds":[]}', NOW(), NOW()),
('ws9-history', 'تاریخ', 'workshop', 'scientific', 9, NULL, 8, '{"id":"ws9-history","name":"تاریخ","category":"scientific","gradeLevel":9,"studentIds":[]}', NOW(), NOW()),
('ws9-technical', 'فنی', 'workshop', 'skill', 9, NULL, 9, '{"id":"ws9-technical","name":"فنی","category":"skill","gradeLevel":9,"studentIds":[]}', NOW(), NOW()),
('ws9-writing', 'نویسندگی', 'workshop', 'skill', 9, NULL, 10, '{"id":"ws9-writing","name":"نویسندگی","category":"skill","gradeLevel":9,"studentIds":[]}', NOW(), NOW()),
('ws9-ai', 'هوش مصنوعی', 'workshop', 'skill', 9, NULL, 11, '{"id":"ws9-ai","name":"هوش مصنوعی","category":"skill","gradeLevel":9,"studentIds":[]}', NOW(), NOW());

-- امانات و لوازم مدرسه (تحویل و تحویل‌گیری وسایل)
CREATE TABLE IF NOT EXISTS `loan_items` (
  `id` varchar(100) NOT NULL,
  `item_name` varchar(191) NOT NULL DEFAULT '',
  `recipient_name` varchar(191) NOT NULL DEFAULT '',
  `loan_date` varchar(20) DEFAULT NULL,
  `is_returned` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `loan_items_loan_date_index` (`loan_date`),
  KEY `loan_items_is_returned_index` (`is_returned`),
  KEY `loan_items_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- دفتر ثبت دسترسی به پرونده‌های تربیتی و مشاهدات رفتاری
CREATE TABLE IF NOT EXISTS `nurturing_access_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `user_role` varchar(40) NOT NULL DEFAULT '',
  `action` varchar(20) NOT NULL,
  `collection` varchar(40) NOT NULL,
  `student_id` varchar(100) DEFAULT NULL,
  `record_id` varchar(100) DEFAULT NULL,
  `allowed` tinyint(1) NOT NULL DEFAULT 1,
  `items` int unsigned DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `nurturing_access_logs_user_id_index` (`user_id`),
  KEY `nurturing_access_logs_student_id_index` (`student_id`),
  KEY `nurturing_access_logs_allowed_index` (`allowed`),
  KEY `nurturing_access_logs_created_at_index` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- حذف نسخه‌های برگشت‌پذیر رمز عبور (از این پس فقط هش یک‌طرفه نگهداری می‌شود)
UPDATE `users` SET `password_encrypted` = NULL;

-- ورود دومرحله‌ای (TOTP) — اگر ستون‌ها از قبل وجود دارند، خطای «Duplicate column» را نادیده بگیرید
ALTER TABLE `users` ADD COLUMN `two_factor_secret` text NULL, ADD COLUMN `two_factor_confirmed_at` timestamp NULL DEFAULT NULL, ADD COLUMN `two_factor_recovery_codes` text NULL;

-- تغییر اجباری رمز عبور در اولین ورود (حساب‌های دارای رمز پیش‌فرض ۱۲۳ هنگام اولین ورود خودکار علامت می‌خورند)
-- اگر ستون از قبل وجود دارد، خطای «Duplicate column» را نادیده بگیرید
ALTER TABLE `users` ADD COLUMN `must_change_password` tinyint(1) NOT NULL DEFAULT 0;

-- نویسنده‌ی مشاهده‌گری (برای مخفی بودن مشاهده‌های معاون تربیتی از مربی). اگر ستون وجود دارد، خطای «Duplicate column» را نادیده بگیرید.
-- مشاهده‌های قدیمی بدون نویسنده برای مربی مخفی و برای معاون تربیتی قابل مشاهده می‌مانند.
ALTER TABLE `student_observations` ADD COLUMN `author_id` varchar(100) NULL, ADD COLUMN `author_role` varchar(40) NULL, ADD KEY `student_observations_author_id_index` (`author_id`);

-- دستگاه‌های شناخته‌شده‌ی ورود (هشدار ورود از دستگاه جدید)
CREATE TABLE IF NOT EXISTS `login_devices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `ua_hash` varchar(64) NOT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `first_seen_at` timestamp NULL DEFAULT NULL,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `login_devices_user_ua_unique` (`user_id`, `ua_hash`),
  KEY `login_devices_user_id_index` (`user_id`),
  KEY `login_devices_last_seen_at_index` (`last_seen_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- بستن نشست‌ها توسط معاون تربیتی و زنجیره‌ی هش لاگ دسترسی. اگر ستون وجود دارد، خطای «Duplicate column» را نادیده بگیرید.
ALTER TABLE `users` ADD COLUMN `sessions_revoked_at` timestamp NULL DEFAULT NULL;
ALTER TABLE `nurturing_access_logs` ADD COLUMN `prev_hash` varchar(64) NULL, ADD COLUMN `row_hash` varchar(64) NULL;

-- دستگاه‌های مطمئن (ورود دومرحله‌ای فقط در اولین ورود با هر دستگاه)
CREATE TABLE IF NOT EXISTS `trusted_devices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trusted_devices_token_hash_unique` (`token_hash`),
  KEY `trusted_devices_user_id_index` (`user_id`),
  KEY `trusted_devices_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- کاربرگ هفتگی دانش‌آموزان
CREATE TABLE IF NOT EXISTS `worksheet_records` (
  `id` varchar(150) NOT NULL,
  `student_id` varchar(100) NOT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `week_start` varchar(20) NOT NULL,
  `status` varchar(12) NOT NULL DEFAULT 'complete',
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `worksheet_records_student_week_unique` (`student_id`, `week_start`),
  KEY `worksheet_records_student_id_index` (`student_id`),
  KEY `worksheet_records_class_id_index` (`class_id`),
  KEY `worksheet_records_week_start_index` (`week_start`),
  KEY `worksheet_records_status_index` (`status`),
  KEY `worksheet_records_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `worksheet_weeks` (
  `id` varchar(100) NOT NULL,
  `week_start` varchar(20) NOT NULL,
  `deadline` varchar(20) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `worksheet_weeks_week_start_unique` (`week_start`),
  KEY `worksheet_weeks_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- روزهای تعطیل اعلام‌شده‌ی مدرسه
CREATE TABLE IF NOT EXISTS `school_holidays` (
  `id` varchar(100) NOT NULL,
  `holiday_date` varchar(20) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `school_holidays_holiday_date_unique` (`holiday_date`),
  KEY `school_holidays_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ساعت ورود تعیین‌شده‌ی روزهای مدرسه (ورود پس از آن تأخیر است)
CREATE TABLE IF NOT EXISTS `school_entry_times` (
  `id` varchar(100) NOT NULL,
  `entry_date` varchar(20) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `school_entry_times_entry_date_unique` (`entry_date`),
  KEY `school_entry_times_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- طرح درس روزانه‌ی اساتید و بررسی معاونت آموزش
CREATE TABLE IF NOT EXISTS `lesson_plans` (
  `id` varchar(100) NOT NULL,
  `teacher_id` varchar(100) NOT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `plan_date` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `lesson_plans_teacher_id_index` (`teacher_id`),
  KEY `lesson_plans_class_id_index` (`class_id`),
  KEY `lesson_plans_plan_date_index` (`plan_date`),
  KEY `lesson_plans_status_index` (`status`),
  KEY `lesson_plans_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- حضور اولیا در جلسات عمومی اولیاء (سه جلسه در سال)
CREATE TABLE IF NOT EXISTS `parent_meetings` (
  `id` varchar(150) NOT NULL,
  `student_id` varchar(100) NOT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `academic_year` varchar(20) NOT NULL,
  `meeting_no` tinyint unsigned NOT NULL,
  `father_present` tinyint(1) NOT NULL DEFAULT 0,
  `mother_present` tinyint(1) NOT NULL DEFAULT 0,
  `meeting_date` varchar(20) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `parent_meetings_student_year_no_unique` (`student_id`, `academic_year`, `meeting_no`),
  KEY `parent_meetings_student_id_index` (`student_id`),
  KEY `parent_meetings_class_id_index` (`class_id`),
  KEY `parent_meetings_academic_year_index` (`academic_year`),
  KEY `parent_meetings_meeting_no_index` (`meeting_no`),
  KEY `parent_meetings_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- باز/بسته بودن جلسات عمومی اولیاء (جلسه‌ی بسته: برگزارشده و پایان‌یافته)
CREATE TABLE IF NOT EXISTS `parent_meeting_states` (
  `id` varchar(60) NOT NULL,
  `academic_year` varchar(20) NOT NULL,
  `meeting_no` tinyint unsigned NOT NULL,
  `is_open` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `parent_meeting_states_year_no_unique` (`academic_year`, `meeting_no`),
  KEY `parent_meeting_states_academic_year_index` (`academic_year`),
  KEY `parent_meeting_states_meeting_no_index` (`meeting_no`),
  KEY `parent_meeting_states_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- گزارش نقاط تفکر: تحویل / عدم تحویل هر دانش‌آموز در هر هفته (معاون تربیتی و مربی)
CREATE TABLE IF NOT EXISTS `reflection_points` (
  `id` varchar(150) NOT NULL,
  `student_id` varchar(100) NOT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `week_start` varchar(20) NOT NULL,
  `delivered` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reflection_points_student_week_unique` (`student_id`,`week_start`),
  KEY `reflection_points_student_id_index` (`student_id`),
  KEY `reflection_points_class_id_index` (`class_id`),
  KEY `reflection_points_week_start_index` (`week_start`),
  KEY `reflection_points_delivered_index` (`delivered`),
  KEY `reflection_points_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- وضعیت پیگیری آموزشی دانش‌آموزان (مدیر و معاونت آموزش)
CREATE TABLE IF NOT EXISTS `academic_follow_ups` (
  `id` varchar(150) NOT NULL,
  `student_id` varchar(100) NOT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'open',
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `academic_follow_ups_student_id_unique` (`student_id`),
  KEY `academic_follow_ups_class_id_index` (`class_id`),
  KEY `academic_follow_ups_status_index` (`status`),
  KEY `academic_follow_ups_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- لیست خاکستری آموزش: یک رکورد برای هر دانش‌آموز در هر ماه (ارسال توسط معاونت آموزش)
CREATE TABLE IF NOT EXISTS `grey_list_entries` (
  `id` varchar(150) NOT NULL,
  `student_id` varchar(100) NOT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `month` varchar(7) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `grey_list_entries_student_month_unique` (`student_id`,`month`),
  KEY `grey_list_entries_student_id_index` (`student_id`),
  KEY `grey_list_entries_class_id_index` (`class_id`),
  KEY `grey_list_entries_month_index` (`month`),
  KEY `grey_list_entries_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- حذف ماژول قدیمی «فعالیت خارج از مدرسه» و ایجاد «ساعت کاری و خودارزیابی اساتید»
DROP TABLE IF EXISTS `teacher_activities`;

CREATE TABLE IF NOT EXISTS `teacher_timesheets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(100) NOT NULL,
  `month_key` varchar(20) NOT NULL,
  `entries` longtext DEFAULT NULL,
  `self_evaluation` longtext DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `teacher_timesheets_user_month_unique` (`user_id`,`month_key`),
  CONSTRAINT `teacher_timesheets_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
