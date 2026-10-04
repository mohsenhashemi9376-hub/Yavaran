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
