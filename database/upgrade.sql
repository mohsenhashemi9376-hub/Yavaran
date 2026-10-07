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
