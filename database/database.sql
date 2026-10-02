-- ============================================================
-- مدرسه یاوران ولایت — دیتابیس کامل سامانه (Laravel 12)
-- سازگار با MySQL 5.7+ / MariaDB 10.3+ — قابل ایمپورت در phpMyAdmin
-- رمز عبور پیش‌فرض همه حساب‌ها: 123  (پس از ورود حتماً تغییر دهید)
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
START TRANSACTION;

-- ------------------------------------------------------------
-- جدول users
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` varchar(100) NOT NULL,
  `username` varchar(100) DEFAULT NULL,
  `name` varchar(191) NOT NULL DEFAULT '',
  `role` varchar(40) NOT NULL DEFAULT 'teacher',
  `phone` varchar(30) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `permissions` json DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `password_encrypted` text DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `users_sort_order_index` (`sort_order`),
  UNIQUE KEY `users_username_unique` (`username`),
  KEY `users_role_index` (`role`),
  KEY `users_phone_index` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`id`, `username`, `name`, `role`, `phone`, `is_active`, `password`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('usr-admin-1', 'admin', 'دکتر صادقی', 'admin', '09121112233', 1, '$6$NkzlBB3Np7iLESO$2tSJBMFrfoY6zEXLceHrDYYtruJfXoyEy6AfdRIGDawU.BmU2CRTeYj89sgK67VfzWugizHMwJPz.GD5efK5x/', 0, '{"id":"usr-admin-1","username":"admin","name":"دکتر صادقی","role":"admin","roleTitle":"مدیر دبیرستان","phone":"09121112233","assignedClassIds":["cls-101","cls-102","cls-201","cls-301"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-vp-edu-1', 'edu_kazemi', 'مهندس کاظمی', 'vice_educational', '09122223344', 1, '$6$Ax1lcTt2F0nEc6LT$sq3jyMfXd.NOdq.2x.U64GwNiD8.ISNLa4ZEk6N32pLYoO2Mav8el9G1oUN762TJWi2JclxvwEReIPlfCFTSG.', 1, '{"id":"usr-vp-edu-1","username":"edu_kazemi","name":"مهندس کاظمی","role":"vice_educational","roleTitle":"معاون آموزشی","phone":"09122223344","assignedClassIds":["cls-101","cls-102","cls-201","cls-301"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-vp-disc-1', 'disc_taghavi', 'استاد تقوی', 'vice_disciplinary', '09129998877', 1, '$6$0DiW2UJ3lo4V6fyR$ARac4seVkY90f5AP/nuCpl7qNts7bkNmjGMB5/3bKWNeKLB.cEd1oEZXFNcanVL8NByE9.WzmXcyPc1B5oIRx/', 2, '{"id":"usr-vp-disc-1","username":"disc_taghavi","name":"استاد تقوی","role":"vice_disciplinary","roleTitle":"معاون انضباطی","phone":"09129998877","assignedClassIds":["cls-101","cls-102","cls-201","cls-301"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-vp-nurture-1', 'nurture_falesiri', 'استاد فال اسیری', 'vice_nurturing', '09127776655', 1, '$6$7SMw7CYgbrBP1PfH$JPErMRCf0Y2g7C76ER0uxsUT./Br1QsvdAQA/VCq1gPta.siV8nMmcIBZ1WuGM2r5LR4FuHFKDHJAmVWQ42Wf0', 3, '{"id":"usr-vp-nurture-1","username":"nurture_falesiri","name":"استاد فال اسیری","role":"vice_nurturing","roleTitle":"معاون تربیتی و پرورشی","phone":"09127776655","assignedClassIds":["cls-101","cls-102","cls-201","cls-301"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-coach-1', 'coach_mehdipour', 'حجت‌الاسلام مهدی‌پور', 'coach', '09123330011', 1, '$6$5iMtnEOIzWAabWED$Hx7VnQmfMMo3SS9U10NQVjs/DuxRiqwosMTT963Z.svyTgSVV4jdWXkEB8NHHrxITo5TWnXWgdApJBbAYptLM.', 4, '{"id":"usr-coach-1","username":"coach_mehdipour","name":"حجت‌الاسلام مهدی‌پور","role":"coach","roleTitle":"مربی پایه دهم (یاوران ولایت)","phone":"09123330011","assignedClassIds":["cls-101","cls-102"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-coach-2', 'coach_ahmadi', 'استاد علیرضا احمدی', 'coach', '09123330022', 1, '$6$dcZDwqv8SvLwwWHU$SkS.8n.wmYK5YD/Qe7xW1tAHOAg0aHp4Z2RgN/MEhMumFCqPdMbAG17Qk9Zq59Mnp0iochs8PcZ5S/343pnNJ.', 5, '{"id":"usr-coach-2","username":"coach_ahmadi","name":"استاد علیرضا احمدی","role":"coach","roleTitle":"مربی پایه یازدهم و دوازدهم (یاوران ولایت)","phone":"09123330022","assignedClassIds":["cls-201","cls-301"],"isAlsoTeacher":true,"teachingSubject":"ریاضی","teachingClassIds":["cls-101","cls-102"],"teachingAssignments":[{"id":"ta-ahmadi-math","subjectId":"sub-1","subjectName":"ریاضی","classIds":["cls-101","cls-102"]}]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-tea-1', 'rezaei', 'استاد احمد رضایی', 'teacher', '09123334455', 1, '$6$ohBZkiwwB2N3lwz4$V8DSKdn6NBPXB4cOHiQ9cdnl6SAqec3RKKMWl2qZimxeWo6mUp2jSbPKYxu9XV4wkGtbQp/0p7JLE8NfeFpRI0', 6, '{"id":"usr-tea-1","username":"rezaei","name":"استاد احمد رضایی","role":"teacher","roleTitle":"دبیر علوم تجربی","subject":"علوم تجربی","phone":"09123334455","assignedClassIds":["cls-101","cls-102","cls-201"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-tea-2', 'hosseini', 'استاد حسین حسینی', 'teacher', '09124445566', 1, '$6$4dl6G1wjhleNgQAU$.uDdeTkmqrNnFXGPb4qia/k4QRT914dmWuzjOFsx2VrEbhFTTuzHSnh7jNcEp14HVOxLyZp9JMzdp1dwrpIuo0', 7, '{"id":"usr-tea-2","username":"hosseini","name":"استاد حسین حسینی","role":"teacher","roleTitle":"دبیر ریاضی","subject":"ریاضی","phone":"09124445566","assignedClassIds":["cls-101","cls-102","cls-301"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-tea-3', 'karimi', 'استاد مریم کریمی', 'teacher', '09125556677', 1, '$6$bHuKjAZ8iBZyfuB$3e6x4S5CCKYSkp9tCDg5X3lIXVdCHpOBGZgczHXy/hiikHKGWvzLuCjjlqoQKTwHhb.TOwpW9T0AE8ttJ7r36/', 8, '{"id":"usr-tea-3","username":"karimi","name":"استاد مریم کریمی","role":"teacher","roleTitle":"دبیر زبان انگلیسی","subject":"زبان انگلیسی","phone":"09125556677","assignedClassIds":["cls-101","cls-102","cls-301"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-tea-4', 'mahdavi', 'استاد علی مهدوی', 'teacher', '09126667788', 1, '$6$g1KJdQxDVFYDXVf$6oz8.k0FCeB3yOlEuCxeKkyvY5dfWLuLXr26txr.L7iHWopGx8cuTGPyrdmAtML4oRo8qHrWW4Y4bcWSAepjf/', 9, '{"id":"usr-tea-4","username":"mahdavi","name":"استاد علی مهدوی","role":"teacher","roleTitle":"دبیر مطالعات اجتماعی","subject":"مطالعات اجتماعی","phone":"09126667788","assignedClassIds":["cls-101","cls-102","cls-201"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-tea-5', 'karimian', 'استاد علیرضا کریمیان', 'teacher', '09127778899', 1, '$6$8QljgUI7K8Z5JJt$1pC53VHDO/uDZEP.0O1B1OINCaHV4SaGBj0urvyCR/iDEN6YYK9PP855JtiWMmMyi1Cw0cmyuRB6GZ3TVqu.f1', 10, '{"id":"usr-tea-5","username":"karimian","name":"استاد علیرضا کریمیان","role":"teacher","roleTitle":"دبیر ادبیات فارسی و نگارش","subject":"فارسی و نگارش","phone":"09127778899","assignedClassIds":["cls-101","cls-201","cls-301"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-tea-6', 'alavi', 'استاد محسن علوی', 'teacher', '09128889900', 1, '$6$qpWN2VjElOomhwO4$Lragw4Llgo3QilhzOCXQvPdJPbvnGRhlmCagGJoEGEW8mGA5rEh3qh8bcrUOHg/PDnthjavcybBeBe2cNTDw/.', 11, '{"id":"usr-tea-6","username":"alavi","name":"استاد محسن علوی","role":"teacher","roleTitle":"دبیر پیام‌های آسمان و قرآن","subject":"پیام‌های آسمان و قرآن","phone":"09128889900","assignedClassIds":["cls-101","cls-102","cls-201","cls-301"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-tea-7', 'mousavi', 'استاد سید مهدی موسوی', 'teacher', '09129990011', 1, '$6$tJ2fRkp2OIqdQm$SSrgJCFW6CnnfXMNs3uEUemNySBIzu995qnn0ZsVkpZc6KWISPFCfsEYweWNkGlge.qaOxQ0XaD.a7EiCMPDB0', 12, '{"id":"usr-tea-7","username":"mousavi","name":"استاد سید مهدی موسوی","role":"teacher","roleTitle":"دبیر زبان عربی","subject":"عربی","phone":"09129990011","assignedClassIds":["cls-101","cls-102","cls-201","cls-301"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-tea-8', 'akbari', 'استاد مسعود اکبری', 'teacher', '09121113344', 1, '$6$8CH6EBwfQAlTWBSI$JioTLycmkYrp52X5j6EhvPprskcoXz9cS0JzTrqgQOZy9Zy8lMw/gMadhfII0rgfg/iZZ3JYbIAqTev4jYna2.', 13, '{"id":"usr-tea-8","username":"akbari","name":"استاد مسعود اکبری","role":"teacher","roleTitle":"دبیر کار و فناوری و تفکر","subject":"کار و فناوری و تفکر","phone":"09121113344","assignedClassIds":["cls-101","cls-201"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('usr-tea-9', 'radmanesh', 'استاد بهرام رادمنش', 'teacher', '09122224455', 1, '$6$yFytZkX6WhgtuiI9$JR6jOkNaROb8UNnaZKn4eZxOb.8J34Wfo3Y5vsau/UKuiTmVC3R3cTQxy9xKrk..x0m8YOAQht2hBHSh3x2j70', 14, '{"id":"usr-tea-9","username":"radmanesh","name":"استاد بهرام رادمنش","role":"teacher","roleTitle":"دبیر فرهنگ و هنر و تربیت بدنی","subject":"فرهنگ و هنر و تربیت بدنی","phone":"09122224455","assignedClassIds":["cls-101","cls-102","cls-201","cls-301"]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول school_classes
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `school_classes`;
CREATE TABLE `school_classes` (
  `id` varchar(100) NOT NULL,
  `name` varchar(191) NOT NULL DEFAULT '',
  `grade` varchar(100) DEFAULT NULL,
  `academic_year` varchar(30) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `school_classes_sort_order_index` (`sort_order`),
  KEY `school_classes_grade_index` (`grade`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `school_classes` (`id`, `name`, `grade`, `academic_year`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('cls-101', 'هفتم ۱ (کلاس ۱۰۱)', 'پایه هفتم', '۱۴۰۴-۱۴۰۵', 0, '{"id":"cls-101","name":"هفتم ۱ (کلاس ۱۰۱)","grade":"پایه هفتم","major":"متوسطه اول","academicYear":"۱۴۰۴-۱۴۰۵","roomNumber":"۱۰۱","teacherIds":["usr-tea-1","usr-tea-2","usr-tea-3","usr-tea-4","usr-tea-5","usr-tea-6","usr-coach-2"],"coachId":"usr-coach-1","defaultStartTime":"07:45","defaultEndTime":"09:15","defaultBellPeriodId":"bell-1"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('cls-102', 'هفتم ۲ (کلاس ۱۰۲)', 'پایه هفتم', '۱۴۰۴-۱۴۰۵', 1, '{"id":"cls-102","name":"هفتم ۲ (کلاس ۱۰۲)","grade":"پایه هفتم","major":"متوسطه اول","academicYear":"۱۴۰۴-۱۴۰۵","roomNumber":"۱۰۲","teacherIds":["usr-tea-1","usr-tea-2","usr-tea-3","usr-tea-6","usr-tea-7","usr-coach-2"],"coachId":"usr-coach-1","defaultStartTime":"07:45","defaultEndTime":"09:15","defaultBellPeriodId":"bell-1"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('cls-201', 'هشتم ۱ (کلاس ۲۰۱)', 'پایه هشتم', '۱۴۰۴-۱۴۰۵', 2, '{"id":"cls-201","name":"هشتم ۱ (کلاس ۲۰۱)","grade":"پایه هشتم","major":"متوسطه اول","academicYear":"۱۴۰۴-۱۴۰۵","roomNumber":"۲۰۱","teacherIds":["usr-tea-1","usr-tea-2","usr-tea-4","usr-tea-5","usr-tea-8"],"coachId":"usr-coach-2","defaultStartTime":"07:45","defaultEndTime":"09:15","defaultBellPeriodId":"bell-1"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('cls-301', 'نهم ۱ (کلاس ۳۰۱)', 'پایه نهم', '۱۴۰۴-۱۴۰۵', 3, '{"id":"cls-301","name":"نهم ۱ (کلاس ۳۰۱)","grade":"پایه نهم","major":"متوسطه اول","academicYear":"۱۴۰۴-۱۴۰۵","roomNumber":"۳۰۱","teacherIds":["usr-tea-2","usr-tea-3","usr-tea-5","usr-tea-6","usr-tea-9"],"coachId":"usr-coach-2","defaultStartTime":"07:45","defaultEndTime":"09:15","defaultBellPeriodId":"bell-1"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول bell_periods
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `bell_periods`;
CREATE TABLE `bell_periods` (
  `id` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL DEFAULT '',
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `bell_periods_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `bell_periods` (`id`, `name`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('bell-1', 'زنگ اول', 0, '{"id":"bell-1","name":"زنگ اول","startTime":"07:45","endTime":"09:15","order":1,"description":"نوبت اول صبحگاهی (آموزش دروس پایه و تخصصی)"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('bell-2', 'زنگ دوم', 1, '{"id":"bell-2","name":"زنگ دوم","startTime":"09:30","endTime":"11:00","order":2,"description":"نوبت دوم صبحگاهی (پس از استراحت اول)"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('bell-3', 'زنگ سوم', 2, '{"id":"bell-3","name":"زنگ سوم","startTime":"11:15","endTime":"12:45","order":3,"description":"نوبت سوم (پیش از فریضه نماز و ناهار)"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('bell-4', 'زنگ چهارم', 3, '{"id":"bell-4","name":"زنگ چهارم","startTime":"13:00","endTime":"14:15","order":4,"description":"نوبت چهارم (مهارتی، پژوهش، کارگاه و پرورشی)"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول students
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id` varchar(100) NOT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `first_name` varchar(100) NOT NULL DEFAULT '',
  `last_name` varchar(100) NOT NULL DEFAULT '',
  `national_id` varchar(30) DEFAULT NULL,
  `student_code` varchar(30) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `students_sort_order_index` (`sort_order`),
  KEY `students_class_id_index` (`class_id`),
  KEY `students_national_id_index` (`national_id`),
  KEY `students_name_index` (`last_name`,`first_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `students` (`id`, `class_id`, `first_name`, `last_name`, `national_id`, `student_code`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('stu-101-1', 'cls-101', 'امیرحسین', 'محمدی', '0021456781', '40410101', 0, '{"id":"stu-101-1","classId":"cls-101","studentCode":"40410101","nationalId":"0021456781","firstName":"امیرحسین","lastName":"محمدی","fatherName":"محسن","parentPhone":"09123450001","disciplineScore":20,"disciplinaryStatus":"normal","disciplinaryNotes":[]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-101-2', 'cls-101', 'علی‌رضا', 'احمدی', '0021456782', '40410102', 1, '{"id":"stu-101-2","classId":"cls-101","studentCode":"40410102","nationalId":"0021456782","firstName":"علی‌رضا","lastName":"احمدی","fatherName":"حسین","parentPhone":"09123450002","disciplineScore":19.5,"disciplinaryStatus":"normal","disciplinaryNotes":[{"id":"dn-1","date":"1404/08/12","title":"تاخیر در ورود به کلاس","description":"۱۰ دقیقه تاخیر در زنگ اول","scoreDeduction":0.5,"recordedBy":"معاون انضباطی","type":"delay"}]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-101-3', 'cls-101', 'سهراب', 'سپهری', '0021456783', '40410103', 2, '{"id":"stu-101-3","classId":"cls-101","studentCode":"40410103","nationalId":"0021456783","firstName":"سهراب","lastName":"سپهری","fatherName":"منوچهر","parentPhone":"09123450003","disciplineScore":17,"disciplinaryStatus":"written_warning","disciplinaryNotes":[{"id":"dn-2","date":"1404/08/10","title":"غیبت غیرموجه","description":"غیبت بدون هماهنگی و عذر موجه در زنگ فیزیک","scoreDeduction":1.5,"recordedBy":"معاون انضباطی","type":"absence"},{"id":"dn-3","date":"1404/08/17","title":"اخطار کتبی غیبت مکرر","description":"صدور اخطار کتبی و اطلاع‌رسانی به ولی دانش‌آموز","scoreDeduction":1.5,"recordedBy":"معاون انضباطی","type":"absence"}]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-101-4', 'cls-101', 'محمدمهدی', 'کریمیان', '0021456784', '40410104', 3, '{"id":"stu-101-4","classId":"cls-101","studentCode":"40410104","nationalId":"0021456784","firstName":"محمدمهدی","lastName":"کریمیان","fatherName":"مرتضی","parentPhone":"09123450004","disciplineScore":19.5,"disciplinaryStatus":"verbal_warning","disciplinaryNotes":[{"id":"dn-4","date":"1404/08/10","title":"تاخیر صبحگاهی","description":"۱۵ دقیقه تاخیر در ورود به مدرسه","scoreDeduction":0.5,"recordedBy":"معاون انضباطی","type":"delay"}]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-101-5', 'cls-101', 'پویا', 'رحمانی', '0021456785', '40410105', 4, '{"id":"stu-101-5","classId":"cls-101","studentCode":"40410105","nationalId":"0021456785","firstName":"پویا","lastName":"رحمانی","fatherName":"داوود","parentPhone":"09123450005","disciplineScore":20,"disciplinaryStatus":"normal","disciplinaryNotes":[]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-101-6', 'cls-101', 'آرش', 'نیک‌پور', '0021456786', '40410106', 5, '{"id":"stu-101-6","classId":"cls-101","studentCode":"40410106","nationalId":"0021456786","firstName":"آرش","lastName":"نیک‌پور","fatherName":"بهروز","parentPhone":"09123450006","disciplineScore":18.5,"disciplinaryStatus":"verbal_warning","disciplinaryNotes":[{"id":"dn-5","date":"1404/08/17","title":"تاخیر در کلاس و نقص تکلیف","description":"۲۰ دقیقه تاخیر در کلاس فیزیک","scoreDeduction":1.5,"recordedBy":"معاون انضباطی","type":"delay"}]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-101-7', 'cls-101', 'کیان', 'شجاعی', '0021456787', '40410107', 6, '{"id":"stu-101-7","classId":"cls-101","studentCode":"40410107","nationalId":"0021456787","firstName":"کیان","lastName":"شجاعی","fatherName":"فرهاد","parentPhone":"09123450007","disciplineScore":20,"disciplinaryStatus":"normal","disciplinaryNotes":[]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-101-8', 'cls-101', 'بردیا', 'صادق‌پور', '0021456788', '40410108', 7, '{"id":"stu-101-8","classId":"cls-101","studentCode":"40410108","nationalId":"0021456788","firstName":"بردیا","lastName":"صادق‌پور","fatherName":"سعید","parentPhone":"09123450008","disciplineScore":20,"disciplinaryStatus":"normal","disciplinaryNotes":[]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-102-1', 'cls-102', 'فرهاد', 'مهرابی', '0022456701', '40410201', 8, '{"id":"stu-102-1","classId":"cls-102","studentCode":"40410201","nationalId":"0022456701","firstName":"فرهاد","lastName":"مهرابی","fatherName":"جواد","parentPhone":"09123460001","disciplineScore":20,"disciplinaryStatus":"normal"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-102-2', 'cls-102', 'دانیال', 'حکیمی', '0022456702', '40410202', 9, '{"id":"stu-102-2","classId":"cls-102","studentCode":"40410202","nationalId":"0022456702","firstName":"دانیال","lastName":"حکیمی","fatherName":"عباس","parentPhone":"09123460002","disciplineScore":20,"disciplinaryStatus":"normal"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-102-3', 'cls-102', 'امید', 'قاسمی', '0022456703', '40410203', 10, '{"id":"stu-102-3","classId":"cls-102","studentCode":"40410203","nationalId":"0022456703","firstName":"امید","lastName":"قاسمی","fatherName":"قاسم","parentPhone":"09123460003","disciplineScore":19,"disciplinaryStatus":"verbal_warning","disciplinaryNotes":[{"id":"dn-6","date":"1404/08/11","title":"تاخیر در زنگ شیمی","description":"۱۵ دقیقه تاخیر","scoreDeduction":1,"recordedBy":"معاون انضباطی","type":"delay"}]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-102-4', 'cls-102', 'عرفان', 'جعفری', '0022456704', '40410204', 11, '{"id":"stu-102-4","classId":"cls-102","studentCode":"40410204","nationalId":"0022456704","firstName":"عرفان","lastName":"جعفری","fatherName":"علیرضا","parentPhone":"09123460004","disciplineScore":20,"disciplinaryStatus":"normal"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-102-5', 'cls-102', 'پرهام', 'یوسفی', '0022456705', '40410205', 12, '{"id":"stu-102-5","classId":"cls-102","studentCode":"40410205","nationalId":"0022456705","firstName":"پرهام","lastName":"یوسفی","fatherName":"محمد","parentPhone":"09123460005","disciplineScore":18.5,"disciplinaryStatus":"verbal_warning","disciplinaryNotes":[{"id":"dn-7","date":"1404/08/11","title":"غیبت غیرموجه","description":"غیبت غیرموجه در زنگ دوم","scoreDeduction":1.5,"recordedBy":"معاون انضباطی","type":"absence"}]}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-201-1', 'cls-201', 'متین', 'روستایی', '0023456701', '40420101', 13, '{"id":"stu-201-1","classId":"cls-201","studentCode":"40420101","nationalId":"0023456701","firstName":"متین","lastName":"روستایی","fatherName":"اکبر","parentPhone":"09123470001","disciplineScore":20,"disciplinaryStatus":"normal"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-201-2', 'cls-201', 'شایان', 'طباطبایی', '0023456702', '40420102', 14, '{"id":"stu-201-2","classId":"cls-201","studentCode":"40420102","nationalId":"0023456702","firstName":"شایان","lastName":"طباطبایی","fatherName":"مهدی","parentPhone":"09123470002","disciplineScore":20,"disciplinaryStatus":"normal"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-201-3', 'cls-201', 'نیما', 'کاظمیان', '0023456703', '40420103', 15, '{"id":"stu-201-3","classId":"cls-201","studentCode":"40420103","nationalId":"0023456703","firstName":"نیما","lastName":"کاظمیان","fatherName":"هادی","parentPhone":"09123470003","disciplineScore":20,"disciplinaryStatus":"normal"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-301-1', 'cls-301', 'سینا', 'فروغی', '0024456701', '40430101', 16, '{"id":"stu-301-1","classId":"cls-301","studentCode":"40430101","nationalId":"0024456701","firstName":"سینا","lastName":"فروغی","fatherName":"کامبیز","parentPhone":"09123480001","disciplineScore":20,"disciplinaryStatus":"normal"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-301-2', 'cls-301', 'یاشار', 'افشار', '0024456702', '40430102', 17, '{"id":"stu-301-2","classId":"cls-301","studentCode":"40430102","nationalId":"0024456702","firstName":"یاشار","lastName":"افشار","fatherName":"ناصر","parentPhone":"09123480002","disciplineScore":20,"disciplinaryStatus":"normal"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('stu-301-3', 'cls-301', 'ماهان', 'موسوی', '0024456703', '40430103', 18, '{"id":"stu-301-3","classId":"cls-301","studentCode":"40430103","nationalId":"0024456703","firstName":"ماهان","lastName":"موسوی","fatherName":"سید علی","parentPhone":"09123480003","disciplineScore":20,"disciplinaryStatus":"normal"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول attendance_sessions
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `attendance_sessions`;
CREATE TABLE `attendance_sessions` (
  `id` varchar(100) NOT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `teacher_id` varchar(100) DEFAULT NULL,
  `subject` varchar(191) DEFAULT NULL,
  `session_date` varchar(20) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `attendance_sessions_sort_order_index` (`sort_order`),
  KEY `attendance_sessions_class_id_index` (`class_id`),
  KEY `attendance_sessions_teacher_id_index` (`teacher_id`),
  KEY `attendance_sessions_session_date_index` (`session_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `attendance_sessions` (`id`, `class_id`, `teacher_id`, `subject`, `session_date`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('ses-101-1', 'cls-101', 'usr-tea-1', 'فیزیک ۱', '1404/08/10', 0, '{"id":"ses-101-1","classId":"cls-101","teacherId":"usr-tea-1","teacherName":"استاد احمد رضایی","subject":"فیزیک ۱","date":"1404/08/10","dayOfWeek":"شنبه","startTime":"08:00","endTime":"09:30","lessonTopic":"فصل ۲: کار، انرژی و توان - قضیه کار و انرژی جنبشی","homeworkDescription":"حل تمرین‌های انتهای فصل صفحه ۴۲ تا ۴۵ کتاب درسی","sessionNotes":"حل ۵ مثال متنوع از قضیه کار و انرژی - پرسش شفاهی از دانش‌آموزان","records":{"stu-101-1":{"studentId":"stu-101-1","status":"present","score":19,"homeworkStatus":"done"},"stu-101-2":{"studentId":"stu-101-2","status":"present","score":18,"homeworkStatus":"done"},"stu-101-3":{"studentId":"stu-101-3","status":"absent","note":"غیبت غیرموجه بدون اطلاع اولیا"},"stu-101-4":{"studentId":"stu-101-4","status":"late","delayMinutes":15,"homeworkStatus":"done"},"stu-101-5":{"studentId":"stu-101-5","status":"present","score":20,"homeworkStatus":"done"},"stu-101-6":{"studentId":"stu-101-6","status":"present","score":17,"homeworkStatus":"incomplete"},"stu-101-7":{"studentId":"stu-101-7","status":"excused","note":"گواهی پزشکی ارائه شد"},"stu-101-8":{"studentId":"stu-101-8","status":"present","score":18,"homeworkStatus":"done"}},"createdAt":"2026-09-30T12:22:25.501Z","updatedAt":"2026-09-30T12:22:25.501Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('ses-101-2', 'cls-101', 'usr-tea-2', 'ریاضی ۱', '1404/08/12', 1, '{"id":"ses-101-2","classId":"cls-101","teacherId":"usr-tea-2","teacherName":"استاد حسین حسینی","subject":"ریاضی ۱","date":"1404/08/12","dayOfWeek":"دوشنبه","startTime":"09:45","endTime":"11:15","lessonTopic":"اتحادها و عبارتهای جبری - روش‌های تجزیه چندجمله‌ای‌ها","homeworkDescription":"حل مسایل آزمونک ۱ و تمرین صفحه ۵۸","sessionNotes":"کوئیز کلاسی ۱۰ دقیقه‌ای برگزار شد","records":{"stu-101-1":{"studentId":"stu-101-1","status":"present","score":20,"homeworkStatus":"done"},"stu-101-2":{"studentId":"stu-101-2","status":"late","delayMinutes":10,"homeworkStatus":"done"},"stu-101-3":{"studentId":"stu-101-3","status":"absent","note":"دومین جلسه غیبت"},"stu-101-4":{"studentId":"stu-101-4","status":"present","score":16,"homeworkStatus":"done"},"stu-101-5":{"studentId":"stu-101-5","status":"present","score":19,"homeworkStatus":"done"},"stu-101-6":{"studentId":"stu-101-6","status":"present","score":15,"homeworkStatus":"done"},"stu-101-7":{"studentId":"stu-101-7","status":"present","score":18,"homeworkStatus":"done"},"stu-101-8":{"studentId":"stu-101-8","status":"present","score":17,"homeworkStatus":"done"}},"createdAt":"2026-09-30T12:22:25.501Z","updatedAt":"2026-09-30T12:22:25.501Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('ses-101-3', 'cls-101', 'usr-tea-1', 'فیزیک ۱', '1404/08/17', 2, '{"id":"ses-101-3","classId":"cls-101","teacherId":"usr-tea-1","teacherName":"استاد احمد رضایی","subject":"فیزیک ۱","date":"1404/08/17","dayOfWeek":"شنبه","startTime":"08:00","endTime":"09:30","lessonTopic":"پایستگی انرژی مکانیکی و بررسی اصطکاک","homeworkDescription":"تکلیف آنلاین سامانه حل شود","sessionNotes":"مشارکت کلاسی بسیار خوب بود","records":{"stu-101-1":{"studentId":"stu-101-1","status":"present","score":19,"homeworkStatus":"done"},"stu-101-2":{"studentId":"stu-101-2","status":"present","score":17,"homeworkStatus":"done"},"stu-101-3":{"studentId":"stu-101-3","status":"absent","note":"غیبت مکرر - نیازمند اخطار"},"stu-101-4":{"studentId":"stu-101-4","status":"present","score":18,"homeworkStatus":"done"},"stu-101-5":{"studentId":"stu-101-5","status":"present","score":20,"homeworkStatus":"done"},"stu-101-6":{"studentId":"stu-101-6","status":"late","delayMinutes":20,"homeworkStatus":"not_done"},"stu-101-7":{"studentId":"stu-101-7","status":"present","score":19,"homeworkStatus":"done"},"stu-101-8":{"studentId":"stu-101-8","status":"present","score":18,"homeworkStatus":"done"}},"createdAt":"2026-09-30T12:22:25.501Z","updatedAt":"2026-09-30T12:22:25.501Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('ses-102-1', 'cls-102', 'usr-tea-3', 'شیمی ۱', '1404/08/11', 3, '{"id":"ses-102-1","classId":"cls-102","teacherId":"usr-tea-3","teacherName":"استاد مریم کریمی","subject":"شیمی ۱","date":"1404/08/11","dayOfWeek":"یکشنبه","startTime":"10:00","endTime":"11:30","lessonTopic":"آرایش الکترونی عناصر و جدول تناوبی","homeworkDescription":"رسم آرایش الکترونی عناصر دوره ۳ و ۴","sessionNotes":"حل تست‌های کنکور سراسری","records":{"stu-102-1":{"studentId":"stu-102-1","status":"present","score":19,"homeworkStatus":"done"},"stu-102-2":{"studentId":"stu-102-2","status":"present","score":18,"homeworkStatus":"done"},"stu-102-3":{"studentId":"stu-102-3","status":"late","delayMinutes":15,"homeworkStatus":"done"},"stu-102-4":{"studentId":"stu-102-4","status":"present","score":17,"homeworkStatus":"done"},"stu-102-5":{"studentId":"stu-102-5","status":"absent","note":"غیبت غیرموجه"}},"createdAt":"2026-09-30T12:22:25.501Z","updatedAt":"2026-09-30T12:22:25.501Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول academic_subjects
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `academic_subjects`;
CREATE TABLE `academic_subjects` (
  `id` varchar(100) NOT NULL,
  `name` varchar(191) NOT NULL DEFAULT '',
  `code` varchar(50) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `academic_subjects_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `academic_subjects` (`id`, `name`, `code`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('sub-1', 'ریاضی', 'MATH', 0, '{"id":"sub-1","code":"MATH","name":"ریاضی","coefficient":4,"hoursPerWeek":4,"category":"علوم پایه","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-2","defaultTeacherName":"استاد حسین حسینی","description":"آموزش هندسه، جبر و معادلات، اعداد صحیح و توان و جذر"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-2', 'علوم تجربی', 'SCI', 1, '{"id":"sub-2","code":"SCI","name":"علوم تجربی","coefficient":3,"hoursPerWeek":3,"category":"علوم پایه","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-1","defaultTeacherName":"استاد احمد رضایی","description":"فیزیک، شیمی، زیست‌شناسی و زمین‌شناسی پایه متوسطه اول و آزمایشگاه"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-3', 'فارسی (ادبیات فارسی)', 'LIT', 2, '{"id":"sub-3","code":"LIT","name":"فارسی (ادبیات فارسی)","coefficient":4,"hoursPerWeek":4,"category":"ادبیات و معارف","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-5","defaultTeacherName":"استاد علیرضا کریمیان","description":"آرایه‌های ادبی، درک مطلب، دستور زبان فارسی و تاریخ ادبیات"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-4', 'نگارش و انشا', 'WRIT', 3, '{"id":"sub-4","code":"WRIT","name":"نگارش و انشا","coefficient":2,"hoursPerWeek":2,"category":"ادبیات و معارف","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-5","defaultTeacherName":"استاد علیرضا کریمیان","description":"اصول نگارش، سنجش و بازآفرینی متن و مهارت‌های نوشتاری"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-5', 'آموزش قرآن', 'QUR', 4, '{"id":"sub-5","code":"QUR","name":"آموزش قرآن","coefficient":2,"hoursPerWeek":2,"category":"ادبیات و معارف","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-6","defaultTeacherName":"استاد محسن علوی","description":"روخوانی، روان‌خوانی، مفاهیم قرآنی و درک پیام آیات"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-6', 'پیام‌های آسمان (دینی)', 'REL', 5, '{"id":"sub-6","code":"REL","name":"پیام‌های آسمان (دینی)","coefficient":2,"hoursPerWeek":2,"category":"ادبیات و معارف","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-6","defaultTeacherName":"استاد محسن علوی","description":"معارف اسلامی، احکام، اخلاق و سیره نبوی و اهل بیت (ع)"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-7', 'مطالعات اجتماعی (تاریخ، جغرافیا، مدنی)', 'SOC', 6, '{"id":"sub-7","code":"SOC","name":"مطالعات اجتماعی (تاریخ، جغرافیا، مدنی)","coefficient":3,"hoursPerWeek":3,"category":"علوم اجتماعی و فرهنگ","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-4","defaultTeacherName":"استاد علی مهدوی","description":"تاریخ ایران و اسلام، جغرافیای عمومی و کشور، حقوق و تکالیف شهروندی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-8', 'عربی (زبان قرآن)', 'ARB', 7, '{"id":"sub-8","code":"ARB","name":"عربی (زبان قرآن)","coefficient":2,"hoursPerWeek":2,"category":"زبان‌های خارجی","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-7","defaultTeacherName":"استاد سید مهدی موسوی","description":"قواعد عربی، ترجمه و متون کاربردی دوره اول دبیرستان"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-9', 'زبان انگلیسی', 'ENG', 8, '{"id":"sub-9","code":"ENG","name":"زبان انگلیسی","coefficient":2,"hoursPerWeek":2,"category":"زبان‌های خارجی","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-3","defaultTeacherName":"استاد مریم کریمی","description":"مهارت‌های چهارگانه شنیداری، گفتاری، خواندن و نوشتن انگلیسی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-10', 'کار و فناوری', 'TECH', 9, '{"id":"sub-10","code":"TECH","name":"کار و فناوری","coefficient":2,"hoursPerWeek":2,"category":"مهارتی و فناوری","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-8","defaultTeacherName":"استاد مسعود اکبری","description":"مهارت‌های عملی، پودمان‌های کاربردی، فناوری اطلاعات و کارآفرینی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-11', 'فرهنگ و هنر', 'ART', 10, '{"id":"sub-11","code":"ART","name":"فرهنگ و هنر","coefficient":2,"hoursPerWeek":2,"category":"علوم اجتماعی و فرهنگ","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-9","defaultTeacherName":"استاد بهرام رادمنش","description":"طراحی، خوشنویسی، هنرهای سنتی، عکاسی و سرود"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-12', 'تفکر و سبک زندگی', 'THINK', 11, '{"id":"sub-12","code":"THINK","name":"تفکر و سبک زندگی","coefficient":2,"hoursPerWeek":2,"category":"مهارتی و فناوری","grade":"پایه هفتم و هشتم","targetGrades":["پایه هفتم","پایه هشتم"],"major":"متوسطه اول","teacherId":"usr-tea-8","defaultTeacherName":"استاد مسعود اکبری","description":"تفکر نقاد، حل مسئله، مهارت‌های ارتباطی و سبک زندگی اسلامی-ایرانی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-13', 'آمادگی دفاعی (پایه نهم)', 'DEF', 12, '{"id":"sub-13","code":"DEF","name":"آمادگی دفاعی (پایه نهم)","coefficient":2,"hoursPerWeek":2,"category":"علوم اجتماعی و فرهنگ","grade":"پایه نهم","targetGrades":["پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-9","defaultTeacherName":"استاد بهرام رادمنش","description":"آشنایی با مفاهیم دفاع مقدس، پدافند غیرعامل، امداد و نجات و امنیت ملی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('sub-14', 'تربیت بدنی و سلامت', 'PE', 13, '{"id":"sub-14","code":"PE","name":"تربیت بدنی و سلامت","coefficient":2,"hoursPerWeek":2,"category":"تربیت بدنی و سلامت","grade":"عمومی متوسطه اول","targetGrades":["پایه هفتم","پایه هشتم","پایه نهم"],"major":"متوسطه اول","teacherId":"usr-tea-9","defaultTeacherName":"استاد بهرام رادمنش","description":"آمادگی جسمانی، مهارت‌های ورزشی توپی، بهداشت فردی و تغذیه سالم"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول academic_grades
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `academic_grades`;
CREATE TABLE `academic_grades` (
  `id` varchar(100) NOT NULL,
  `student_id` varchar(100) DEFAULT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `subject_id` varchar(100) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `academic_grades_sort_order_index` (`sort_order`),
  KEY `academic_grades_student_id_index` (`student_id`),
  KEY `academic_grades_class_id_index` (`class_id`),
  KEY `academic_grades_subject_id_index` (`subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `academic_grades` (`id`, `student_id`, `class_id`, `subject_id`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('grd-101-1-1', 'stu-101-1', 'cls-101', 'sub-1', 0, '{"id":"grd-101-1-1","studentId":"stu-101-1","classId":"cls-101","subjectId":"sub-1","subjectName":"ریاضی و حسابان","coefficient":4,"mehrContinuous":16.5,"abanContinuous":17,"azarContinuous":18,"term1Continuous":17.5,"term1Final":16,"bahmanContinuous":18,"esfandContinuous":18.5,"farvardinContinuous":19,"ordibeheshtContinuous":19.5,"term2Continuous":18.5,"term2Final":19.5,"teacherName":"استاد حسین حسینی","notes":"پیشرفت عالی در مباحث مشتق و حد"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-1-2', 'stu-101-1', 'cls-101', 'sub-2', 1, '{"id":"grd-101-1-2","studentId":"stu-101-1","classId":"cls-101","subjectId":"sub-2","subjectName":"فیزیک","coefficient":3,"mehrContinuous":17,"abanContinuous":18,"azarContinuous":18.5,"term1Continuous":18,"term1Final":17.5,"bahmanContinuous":18.5,"esfandContinuous":19,"farvardinContinuous":19.5,"ordibeheshtContinuous":20,"term2Continuous":19,"term2Final":20,"teacherName":"استاد احمد رضایی","notes":"پاسخگویی بی‌نقص در حل مسائل مغناطیس"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-1-3', 'stu-101-1', 'cls-101', 'sub-3', 2, '{"id":"grd-101-1-3","studentId":"stu-101-1","classId":"cls-101","subjectId":"sub-3","subjectName":"شیمی","coefficient":3,"mehrContinuous":15,"abanContinuous":16,"azarContinuous":16.5,"term1Continuous":16,"term1Final":15.5,"bahmanContinuous":16.5,"esfandContinuous":17,"farvardinContinuous":17.5,"ordibeheshtContinuous":18,"term2Continuous":17,"term2Final":18.5,"teacherName":"استاد مریم کریمی","notes":"رشد چشمگیر پس از کلاس‌های فوق‌برنامه"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-1-4', 'stu-101-1', 'cls-101', 'sub-4', 3, '{"id":"grd-101-1-4","studentId":"stu-101-1","classId":"cls-101","subjectId":"sub-4","subjectName":"هندسه","coefficient":2,"mehrContinuous":14,"abanContinuous":15,"azarContinuous":15.5,"term1Continuous":15,"term1Final":14.5,"bahmanContinuous":16,"esfandContinuous":16.5,"farvardinContinuous":17,"ordibeheshtContinuous":17,"term2Continuous":16.5,"term2Final":17.5,"teacherName":"استاد حسین حسینی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-1-5', 'stu-101-1', 'cls-101', 'sub-5', 4, '{"id":"grd-101-1-5","studentId":"stu-101-1","classId":"cls-101","subjectId":"sub-5","subjectName":"زبان انگلیسی","coefficient":2,"mehrContinuous":19,"abanContinuous":19,"azarContinuous":19.5,"term1Continuous":19,"term1Final":18.5,"bahmanContinuous":19.5,"esfandContinuous":19.5,"farvardinContinuous":20,"ordibeheshtContinuous":20,"term2Continuous":19.5,"term2Final":20,"teacherName":"استاد علی مهدوی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-1-6', 'stu-101-1', 'cls-101', 'sub-6', 5, '{"id":"grd-101-1-6","studentId":"stu-101-1","classId":"cls-101","subjectId":"sub-6","subjectName":"ادبیات فارسی و نگارش","coefficient":4,"mehrContinuous":18,"abanContinuous":18.5,"azarContinuous":19,"term1Continuous":18.5,"term1Final":18,"bahmanContinuous":19,"esfandContinuous":19,"farvardinContinuous":19.5,"ordibeheshtContinuous":19.5,"term2Continuous":19,"term2Final":19,"teacherName":"استاد کریمیان"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-2-1', 'stu-101-2', 'cls-101', 'sub-1', 6, '{"id":"grd-101-2-1","studentId":"stu-101-2","classId":"cls-101","subjectId":"sub-1","subjectName":"ریاضی و حسابان","coefficient":4,"mehrContinuous":15.5,"abanContinuous":16,"azarContinuous":16.5,"term1Continuous":16,"term1Final":15,"bahmanContinuous":16.5,"esfandContinuous":17,"farvardinContinuous":17,"ordibeheshtContinuous":17.5,"term2Continuous":17,"term2Final":17.5,"teacherName":"استاد حسین حسینی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-2-2', 'stu-101-2', 'cls-101', 'sub-2', 7, '{"id":"grd-101-2-2","studentId":"stu-101-2","classId":"cls-101","subjectId":"sub-2","subjectName":"فیزیک","coefficient":3,"mehrContinuous":15,"abanContinuous":15.5,"azarContinuous":16,"term1Continuous":15.5,"term1Final":16,"bahmanContinuous":16,"esfandContinuous":16.5,"farvardinContinuous":17,"ordibeheshtContinuous":17,"term2Continuous":16.5,"term2Final":17,"teacherName":"استاد احمد رضایی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-2-3', 'stu-101-2', 'cls-101', 'sub-3', 8, '{"id":"grd-101-2-3","studentId":"stu-101-2","classId":"cls-101","subjectId":"sub-3","subjectName":"شیمی","coefficient":3,"mehrContinuous":17.5,"abanContinuous":18,"azarContinuous":18,"term1Continuous":18,"term1Final":18.5,"bahmanContinuous":18,"esfandContinuous":18.5,"farvardinContinuous":19,"ordibeheshtContinuous":19,"term2Continuous":18.5,"term2Final":19,"teacherName":"استاد مریم کریمی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-2-5', 'stu-101-2', 'cls-101', 'sub-5', 9, '{"id":"grd-101-2-5","studentId":"stu-101-2","classId":"cls-101","subjectId":"sub-5","subjectName":"زبان انگلیسی","coefficient":2,"mehrContinuous":16.5,"abanContinuous":17,"azarContinuous":17,"term1Continuous":17,"term1Final":16.5,"bahmanContinuous":17,"esfandContinuous":17.5,"farvardinContinuous":18,"ordibeheshtContinuous":18,"term2Continuous":17.5,"term2Final":18,"teacherName":"استاد علی مهدوی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-3-1', 'stu-101-3', 'cls-101', 'sub-1', 10, '{"id":"grd-101-3-1","studentId":"stu-101-3","classId":"cls-101","subjectId":"sub-1","subjectName":"ریاضی و حسابان","coefficient":4,"mehrContinuous":13,"abanContinuous":12,"azarContinuous":11.5,"term1Continuous":12,"term1Final":10.5,"bahmanContinuous":12.5,"esfandContinuous":13,"farvardinContinuous":13,"ordibeheshtContinuous":13.5,"term2Continuous":13,"term2Final":12,"teacherName":"استاد حسین حسینی","notes":"نیازمند تمرین بیشتر در جبر و آنالیز"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-3-2', 'stu-101-3', 'cls-101', 'sub-2', 11, '{"id":"grd-101-3-2","studentId":"stu-101-3","classId":"cls-101","subjectId":"sub-2","subjectName":"فیزیک","coefficient":3,"mehrContinuous":12.5,"abanContinuous":11.5,"azarContinuous":11,"term1Continuous":11.5,"term1Final":9.5,"bahmanContinuous":11.5,"esfandContinuous":12,"farvardinContinuous":12.5,"ordibeheshtContinuous":12.5,"term2Continuous":12,"term2Final":11,"teacherName":"استاد احمد رضایی","notes":"همبستگی افت نمره با غیبت‌های مکرر در جلسات"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-3-5', 'stu-101-3', 'cls-101', 'sub-5', 12, '{"id":"grd-101-3-5","studentId":"stu-101-3","classId":"cls-101","subjectId":"sub-5","subjectName":"زبان انگلیسی","coefficient":2,"mehrContinuous":18,"abanContinuous":18,"azarContinuous":18.5,"term1Continuous":18,"term1Final":19,"bahmanContinuous":18.5,"esfandContinuous":19,"farvardinContinuous":19.5,"ordibeheshtContinuous":19.5,"term2Continuous":19,"term2Final":19.5,"teacherName":"استاد علی مهدوی","notes":"نقطه قوت شاخص دانش‌آموز"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-3-6', 'stu-101-3', 'cls-101', 'sub-6', 13, '{"id":"grd-101-3-6","studentId":"stu-101-3","classId":"cls-101","subjectId":"sub-6","subjectName":"ادبیات فارسی و نگارش","coefficient":4,"mehrContinuous":19,"abanContinuous":19.5,"azarContinuous":20,"term1Continuous":19.5,"term1Final":20,"bahmanContinuous":20,"esfandContinuous":20,"farvardinContinuous":20,"ordibeheshtContinuous":20,"term2Continuous":20,"term2Final":20,"teacherName":"استاد کریمیان","notes":"استعداد درخشان در انشا و تحلیل متون ادبی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-4-1', 'stu-101-4', 'cls-101', 'sub-1', 14, '{"id":"grd-101-4-1","studentId":"stu-101-4","classId":"cls-101","subjectId":"sub-1","subjectName":"ریاضی و حسابان","coefficient":4,"mehrContinuous":18.5,"abanContinuous":19,"azarContinuous":19,"term1Continuous":19,"term1Final":18.5,"bahmanContinuous":19,"esfandContinuous":19.5,"farvardinContinuous":20,"ordibeheshtContinuous":20,"term2Continuous":19.5,"term2Final":20,"teacherName":"استاد حسین حسینی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-4-2', 'stu-101-4', 'cls-101', 'sub-2', 15, '{"id":"grd-101-4-2","studentId":"stu-101-4","classId":"cls-101","subjectId":"sub-2","subjectName":"فیزیک","coefficient":3,"mehrContinuous":18,"abanContinuous":18.5,"azarContinuous":19,"term1Continuous":18.5,"term1Final":19,"bahmanContinuous":19,"esfandContinuous":19,"farvardinContinuous":19.5,"ordibeheshtContinuous":20,"term2Continuous":19,"term2Final":19.5,"teacherName":"استاد احمد رضایی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-5-1', 'stu-101-5', 'cls-101', 'sub-1', 16, '{"id":"grd-101-5-1","studentId":"stu-101-5","classId":"cls-101","subjectId":"sub-1","subjectName":"ریاضی و حسابان","coefficient":4,"mehrContinuous":20,"abanContinuous":20,"azarContinuous":20,"term1Continuous":20,"term1Final":20,"bahmanContinuous":20,"esfandContinuous":20,"farvardinContinuous":20,"ordibeheshtContinuous":20,"term2Continuous":20,"term2Final":20,"teacherName":"استاد حسین حسینی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-101-5-2', 'stu-101-5', 'cls-101', 'sub-2', 17, '{"id":"grd-101-5-2","studentId":"stu-101-5","classId":"cls-101","subjectId":"sub-2","subjectName":"فیزیک","coefficient":3,"mehrContinuous":19.5,"abanContinuous":19.5,"azarContinuous":20,"term1Continuous":19.5,"term1Final":20,"bahmanContinuous":20,"esfandContinuous":20,"farvardinContinuous":20,"ordibeheshtContinuous":20,"term2Continuous":20,"term2Final":20,"teacherName":"استاد احمد رضایی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-102-1-3', 'stu-102-1', 'cls-102', 'sub-3', 18, '{"id":"grd-102-1-3","studentId":"stu-102-1","classId":"cls-102","subjectId":"sub-3","subjectName":"شیمی","coefficient":3,"mehrContinuous":18,"abanContinuous":18.5,"azarContinuous":19,"term1Continuous":18.5,"term1Final":18,"bahmanContinuous":19,"esfandContinuous":19,"farvardinContinuous":19.5,"ordibeheshtContinuous":20,"term2Continuous":19,"term2Final":19.5,"teacherName":"استاد مریم کریمی"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول morning_delays
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `morning_delays`;
CREATE TABLE `morning_delays` (
  `id` varchar(100) NOT NULL,
  `student_id` varchar(100) DEFAULT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `record_date` varchar(20) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `morning_delays_sort_order_index` (`sort_order`),
  KEY `morning_delays_student_id_index` (`student_id`),
  KEY `morning_delays_class_id_index` (`class_id`),
  KEY `morning_delays_record_date_index` (`record_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `morning_delays` (`id`, `student_id`, `class_id`, `record_date`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('md-1', 'stu-101-2', 'cls-101', '1404/08/18', 0, '{"id":"md-1","studentId":"stu-101-2","classId":"cls-101","date":"1404/08/18","dayOfWeek":"یکشنبه","arrivalTime":"07:50","delayMinutes":20,"reason":"ترافیک و تاخیر سرویس","isExcused":true,"recordedBy":"استاد تقوی (معاون انضباطی)","disciplinaryActionTaken":"ثبت و تذکر شفاهی","notes":"ولی دانش‌آموز تلفنی ترافیک سنگین را تایید کرد.","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('md-2', 'stu-101-2', 'cls-101', '1404/08/20', 1, '{"id":"md-2","studentId":"stu-101-2","classId":"cls-101","date":"1404/08/20","dayOfWeek":"سه‌شنبه","arrivalTime":"07:45","delayMinutes":15,"reason":"خواب ماندن","isExcused":false,"recordedBy":"استاد تقوی (معاون انضباطی)","disciplinaryActionTaken":"کسر ۰.۵ نمره انضباط","notes":"دومین تاخیر در این هفته","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('md-3', 'stu-101-4', 'cls-101', '1404/08/12', 2, '{"id":"md-3","studentId":"stu-101-4","classId":"cls-101","date":"1404/08/12","dayOfWeek":"دوشنبه","arrivalTime":"08:05","delayMinutes":35,"reason":"کسالت و مراجعه به پزشک","isExcused":true,"recordedBy":"استاد تقوی (معاون انضباطی)","disciplinaryActionTaken":"ثبت گواهی پزشک","notes":"گواهی پزشک به دفتر تحویل داده شد.","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('md-4', 'stu-101-4', 'cls-101', '1404/08/19', 3, '{"id":"md-4","studentId":"stu-101-4","classId":"cls-101","date":"1404/08/19","dayOfWeek":"دوشنبه","arrivalTime":"07:55","delayMinutes":25,"reason":"بدون عذر موجه","isExcused":false,"recordedBy":"استاد تقوی (معاون انضباطی)","disciplinaryActionTaken":"ارسال پیامک به ولی","notes":"تاخیر مکرر در روزهای دوشنبه","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('md-5', 'stu-102-2', 'cls-102', '1404/08/17', 4, '{"id":"md-5","studentId":"stu-102-2","classId":"cls-102","date":"1404/08/17","dayOfWeek":"شنبه","arrivalTime":"07:40","delayMinutes":10,"reason":"مشکل وسیله نقلیه","isExcused":false,"recordedBy":"استاد تقوی (معاون انضباطی)","disciplinaryActionTaken":"تذکر شفاهی","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('md-6', 'stu-201-1', 'cls-201', '1404/08/15', 5, '{"id":"md-6","studentId":"stu-201-1","classId":"cls-201","date":"1404/08/15","dayOfWeek":"پنج‌شنبه","arrivalTime":"08:00","delayMinutes":30,"reason":"ترافیک ورودی اتوبان","isExcused":true,"recordedBy":"استاد تقوی (معاون انضباطی)","disciplinaryActionTaken":"تایید موجه بودن","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('md-7', 'stu-301-2', 'cls-301', '1404/08/19', 6, '{"id":"md-7","studentId":"stu-301-2","classId":"cls-301","date":"1404/08/19","dayOfWeek":"دوشنبه","arrivalTime":"07:50","delayMinutes":20,"reason":"خواب ماندن","isExcused":false,"recordedBy":"استاد تقوی (معاون انضباطی)","disciplinaryActionTaken":"کسر ۰.۵ نمره انضباط","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول school_absences
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `school_absences`;
CREATE TABLE `school_absences` (
  `id` varchar(100) NOT NULL,
  `student_id` varchar(100) DEFAULT NULL,
  `class_id` varchar(100) DEFAULT NULL,
  `record_date` varchar(20) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `school_absences_sort_order_index` (`sort_order`),
  KEY `school_absences_student_id_index` (`student_id`),
  KEY `school_absences_class_id_index` (`class_id`),
  KEY `school_absences_record_date_index` (`record_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `school_absences` (`id`, `student_id`, `class_id`, `record_date`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('abs-1', 'stu-101-3', 'cls-101', '1404/08/18', 0, '{"id":"abs-1","studentId":"stu-101-3","classId":"cls-101","date":"1404/08/18","dayOfWeek":"یک‌شنبه","isExcused":false,"reason":"کسالت و عدم حضور در مدرسه بدون هماهنگی قبلی","recordedBy":"استاد تقوی (معاون انضباطی)","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('abs-2', 'stu-102-3', 'cls-102', '1404/08/19', 1, '{"id":"abs-2","studentId":"stu-102-3","classId":"cls-102","date":"1404/08/19","dayOfWeek":"دوشنبه","isExcused":true,"reason":"مراجعه به پزشک و ارائه گواهی استعلاجی","recordedBy":"استاد تقوی (معاون انضباطی)","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول student_observations
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `student_observations`;
CREATE TABLE `student_observations` (
  `id` varchar(100) NOT NULL,
  `student_id` varchar(100) DEFAULT NULL,
  `record_date` varchar(20) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `student_observations_sort_order_index` (`sort_order`),
  KEY `student_observations_student_id_index` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `student_observations` (`id`, `student_id`, `record_date`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('obs-1', 'stu-101-1', '1404/08/18', 0, '{"id":"obs-1","studentId":"stu-101-1","date":"1404/08/18","time":"10:45","title":"روحیه کار گروهی و راهنمایی همکلاسی‌ها در حل تمرین","category":"social","categoryLabel":"اجتماعی و ارتباطی","content":"در زنگ تفریح و پس از کلاس هندسه، با سعه صدر به دو تن از دانش‌آموزان ضعیف‌تر کلاس تمرینات را توضیح می‌داد و بسیار صبور و خوش‌برخورد بود.","tags":["همدلی","مسئولیت‌پذیری","کار تیمی"],"location":"کلاس ۱۰۱","recordedBy":"حجت‌الاسلام رستمی (معاون تربیتی)","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('obs-2', 'stu-101-1', '1404/08/10', 1, '{"id":"obs-2","studentId":"stu-101-1","date":"1404/08/10","time":"12:30","title":"حضور داوطلبانه در اقامه نماز جماعت و نظم صفوف","category":"moral","categoryLabel":"اخلاقی و ارزشی","content":"بدون نیاز به تذکر، در آماده‌سازی نمازخانه و چیدن مهرها کمک کرد و رفتار موقری در جمع دانش‌آموزان داشت.","tags":["معنویت","نظم","داوطلبانه"],"location":"نمازخانه دبیرستان","recordedBy":"حجت‌الاسلام رستمی (معاون تربیتی)","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('obs-3', 'stu-101-2', '1404/08/19', 2, '{"id":"obs-3","studentId":"stu-101-2","date":"1404/08/19","time":"11:15","title":"نشانه‌های اضطراب در هنگام پرسش کلاسی و امتحانات مستمر","category":"emotional","categoryLabel":"عاطفی و هیجانی","content":"در زنگ فیزیک قبل از شروع کوییز دچار استرس و تعریق کف دست بود. نیاز به تمرین تن‌آرامی و تقویت باور به توانمندی‌های شخصی دارد.","tags":["مدیریت اضطراب","اعتماد به نفس"],"location":"راهرو طبقه اول","recordedBy":"حجت‌الاسلام رستمی (معاون تربیتی)","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('obs-4', 'stu-101-3', '1404/08/16', 3, '{"id":"obs-4","studentId":"stu-101-3","date":"1404/08/16","time":"09:15","title":"تمرکز بالا و اشتیاق به تفکر انتزاعی در مباحث فلسفی/دینی","category":"learning_attitude","categoryLabel":"نگرش و انگیزش تحصیلی","content":"پرسش‌های عمیق هستی‌شناسانه و تمایل به مطالعه فراتر از کتب درسی نشان داد. ظرفیت بالایی برای پژوهش و کتابخوانی دارد.","tags":["پرسشگری","استعداد تحلیلی"],"location":"کتابخانه مدرسه","recordedBy":"حجت‌الاسلام رستمی (معاون تربیتی)","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول nurturing_dossiers
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `nurturing_dossiers`;
CREATE TABLE `nurturing_dossiers` (
  `id` varchar(100) NOT NULL,
  `student_id` varchar(100) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `nurturing_dossiers_sort_order_index` (`sort_order`),
  KEY `nurturing_dossiers_student_id_index` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `nurturing_dossiers` (`id`, `student_id`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('stu-101-1', 'stu-101-1', 0, '{"studentId":"stu-101-1","thinkingPoints":[{"id":"tp-1","date":"1404/08/12","title":"تفکر ساختارمند و اولویت‌بندی اهداف","content":"دانش‌آموز دارای قدرت استدلال منطقی بسیار بالایی است. به چرایی مسائل اهمیت می‌دهد و مسائل را با دید علمی و فلسفی تحلیل می‌کند. به مفاهیم عدالت و اخلاق کاربردی گرایش زیادی دارد.","tags":["منطق‌گرا","عدالت‌خواه"],"keyTakeaways":["تقویت کتابخوانی در حوزه منطق و تاریخ علم","تشویق به حضور در المپیادها"],"createdAt":"2026-09-30T12:22:25.502Z"}],"privateSessions":[{"id":"ps-1","date":"1404/08/15","title":"جلسه مشاوره فردی: مدیریت زمان و برنامه‌ریزی کنکوری","content":"در این جلسه درباره تقسیم انرژی بین دروس تخصصی و عمومی گفت‌وگو شد. دانش‌آموز از کمال‌گرایی افراطی و نگرانی از عقب افتادن برنامه ابراز ناراحتی می‌کرد. تکنیک‌های پومودورو و اولویت‌بندی ماتریس آیزنهاور به وی آموزش داده شد.","tags":["کمال‌گرایی","برنامه‌ریزی"],"keyTakeaways":["پذیرش خطاهای احتمالی","تثبیت خواب شبانه حداقل ۷ ساعت"],"createdAt":"2026-09-30T12:22:25.502Z"}],"parentInterviews":[{"id":"pi-1","date":"1404/08/05","title":"مصاحبه حضوری با پدر و مادر (آقای دکتر محمدی)","content":"محیط خانواده بسیار فرهنگی و حامی است. والدین انتظارات منطقی دارند اما پدر به صورت ناخودآگاه استانداردهای بسیار بالایی برای نمرات تعیین می‌کند که موجب فشار روانی روی فرزند شده است. توافق شد بازخوردها بیشتر روی تلاش باشد تا صرفاً نمره ۲۰.","tags":["انتظارات والدین","تعامل سازنده"],"keyTakeaways":["کاهش مقایسه با همسالان","اختصاص زمان تفریح خانوادگی در آخر هفته"],"createdAt":"2026-09-30T12:22:25.502Z"}],"temperament":{"dominantType":"دموی - صفراوی","physicalTraits":"قامت کشیده، چهره گندمگون روشن، نبض پر و حرارت بدنی معتدل متمایل به گرم","behavioralTraits":"پرانرژی، برون‌گرا، پیشگام در فعالیت‌های جمعی، شجاع و صریح، گاهی کم‌طاقت در کارهای یکنواخت","entries":[{"id":"temp-1","date":"1404/07/25","title":"بررسی اولیه طبایع و ویژگی‌های رفتاری","content":"به دلیل غلبه طبع گرم و تر، استعداد یادگیری سریع دارد اما برای تمرکز طولانی‌مدت به تنوع و تغییر زاویه مطالعه نیاز دارد. پرهیز از ادویه‌جات تند و مصرف شربت سکنجبین و عناب توصیه شد.","createdAt":"2026-09-30T12:22:25.502Z"}]},"growthPath":[{"id":"gp-1","date":"1404/08/01","title":"نقشه راه ترم اول: رشد مهارت حل تعارض و رهبری مثبت","content":"هدف‌گذاری شده تا پایان نیمسال اول، مسئولیت هدایت حلقه علمی کلاس را بر عهده بگیرد و فن بیان و مدیریت هیجانات در گفت‌وگوهای چالشی را ارتقا دهد.","tags":["رهبری تیم","فن بیان"],"keyTakeaways":["عضویت در شورای دانش‌آموزی","ارائه کنفرانس در مجمع عمومی"],"createdAt":"2026-09-30T12:22:25.502Z"}],"lifestyle":[{"id":"ls-1","date":"1404/08/10","title":"ارزیابی الگوی خواب، تغذیه و استفاده از گوشی همراه","content":"میانگین خواب: ۲۳:۳۰ الی ۰۶:۱۵ (مناسب). استفاده از فضای مجازی روزانه حدود ۱.۵ ساعت که کنترل‌شده است. ورزش منظم شنا دو روز در هفته دارد. صبحانه کامل میل می‌کند.","tags":["نظم فردی","ورزش مداوم"],"createdAt":"2026-09-30T12:22:25.502Z"}],"interviews":[{"id":"int-1","date":"1404/07/15","title":"مصاحبه ورودی سال تحصیلی جدید","content":"در مصاحبه انگیزه بالایی برای قبولی در دانشگاه‌های برتر مهندسی نشان داد. علایق جانبی وی برنامه‌نویسی پایتون و نجوم است.","createdAt":"2026-09-30T12:22:25.502Z"}],"nurturingSummary":{"overallSummary":"علی دانش‌آموزی باهوش، مسئولیت‌پذیر، باوجدان و دارای ظرفیت‌های بالای مدیریتی است. چالش اصلی او کنترل کمال‌گرایی و مدارا با نوسانات مقطعی تحصیلی است. تعامل با مربیان بسیار محترمانه و سازنده است.","strengths":["اخلاق‌مداری","اشتیاق به کمک به دیگران","تفکر منطقی و منسجم","نظم در تکالیف"],"growthOpportunities":["انعطاف‌پذیری در برابر ناملایمات","مهارت آرام‌سازی ذهنی در موقعیت‌های پرفشار"],"entries":[{"id":"ns-1","date":"1404/08/18","title":"جمعبندی تربیتی آبان‌ماه","content":"روند رشد بسیار امیدبخش و رو به جلو است. خانواده همراهی عالی دارند و دانش‌آموز به خودآگاهی مطلوبی رسیده است.","createdAt":"2026-09-30T12:22:25.502Z"}]},"updatedAt":"2026-09-30T12:22:25.502Z","id":"stu-101-1"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول coach_evaluations
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `coach_evaluations`;
CREATE TABLE `coach_evaluations` (
  `id` varchar(100) NOT NULL,
  `student_id` varchar(100) DEFAULT NULL,
  `coach_id` varchar(100) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `coach_evaluations_sort_order_index` (`sort_order`),
  KEY `coach_evaluations_student_id_index` (`student_id`),
  KEY `coach_evaluations_coach_id_index` (`coach_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `coach_evaluations` (`id`, `student_id`, `coach_id`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('ce-1', 'std-101-1', 'usr-coach-1', 0, '{"id":"ce-1","studentId":"std-101-1","coachId":"usr-coach-1","coachName":"حجت‌الاسلام مهدی‌پور","date":"1404/08/15","period":"فصل پاییز (آبان ۱۴۰۴)","criteria":{"responsibility":"excellent","teamwork":"very_good","moralSpiritual":"excellent","problemSolving":"very_good","socialEtiquette":"excellent","academicMotivation":"very_good"},"overallRating":"excellent","strengths":["پایبندی فوق‌العاده به نماز اول وقت و برنامه‌های معنوی","خوش‌خلقی با هم‌کلاسی‌ها و روحیه امانت‌داری","همکاری مؤثر در فعالیت‌های فرهنگی و مذهبی مدرسه"],"growthRecommendations":["تقویت اعتماد به نفس در ارائه نظرات در مباحثات جمعی","کاهش استرس و دغدغه‌های کمال‌گرایانه در آزمون‌ها"],"notes":"جلسه بازخورد با حضور خود دانش‌آموز برگزار شد و اهداف رشد فردی تا دی‌ماه مشخص گردید.","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('ce-2', 'std-101-2', 'usr-coach-1', 1, '{"id":"ce-2","studentId":"std-101-2","coachId":"usr-coach-1","coachName":"حجت‌الاسلام مهدی‌پور","date":"1404/08/18","period":"فصل پاییز (آبان ۱۴۰۴)","criteria":{"responsibility":"very_good","teamwork":"excellent","moralSpiritual":"very_good","problemSolving":"good","socialEtiquette":"very_good","academicMotivation":"good"},"overallRating":"very_good","strengths":["توانایی بالا در ایجاد نشاط و انگیزه در جمع دوستان","صداقت و روحیه گذشت در موقعیت‌های چالش‌برانگیز"],"growthRecommendations":["برنامه‌ریزی منظم‌تر برای مطالعات روزانه","تمرین مدیریت زمان و اولویت‌بندی در تکالیف"],"notes":"پایش مستمر تکالیف و سبک زندگی با همکاری اولیا در حال پیگیری است.","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول teacher_evaluations
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `teacher_evaluations`;
CREATE TABLE `teacher_evaluations` (
  `id` varchar(100) NOT NULL,
  `teacher_id` varchar(100) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `teacher_evaluations_sort_order_index` (`sort_order`),
  KEY `teacher_evaluations_teacher_id_index` (`teacher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `teacher_evaluations` (`id`, `teacher_id`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('te-1', 'usr-tea-1', 0, '{"id":"te-1","teacherId":"usr-tea-1","teacherName":"استاد احمد رضایی","evaluatorId":"usr-vp-edu-1","evaluatorName":"مهندس کاظمی (معاونت آموزش)","date":"1404/08/20","period":"ارزیابی جامع آبان‌ماه (فصل پاییز)","criteria":{"lessonPlanning":"excellent","punctuality":"excellent","creativity":"very_good","academicFollowUp":"excellent","classroomManagement":"very_good","studentSatisfaction":"excellent"},"overallRating":"excellent","strengths":["تدوین بودجه‌بندی دقیق و ارائه پیش‌نویس طرح درس قبل از آغاز ماه","حضور همواره سر وقت قبل از نواخته شدن زنگ در کلاس","ارائه آزمایش‌های کاربردی فیزیک و تشویق دانش‌آموزان به پروژه‌های عملی","ثبت دقیق و به موقع تکالیف و نمرات مستمر در سامانه"],"growthRecommendations":["استفاده بیشتر از پلتفرم‌های تعاملی و شبیه‌سازهای دیجیتال فیزیک","برگزاری جلسات رفع اشکال انفرادی برای دانش‌آموزان دارای افت در مبحث ترمودینامیک"],"generalNotes":"عملکرد آموزشی استاد رضایی در سطح الگو و بسیار شایسته تقدیر است. دانش‌آموزان کلاس‌های دهم و یازدهم رضایت حداکثری از شیوه تدریس ایشان دارند.","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('te-2', 'usr-tea-2', 1, '{"id":"te-2","teacherId":"usr-tea-2","teacherName":"استاد حسین حسینی","evaluatorId":"usr-vp-edu-1","evaluatorName":"مهندس کاظمی (معاونت آموزش)","date":"1404/08/22","period":"ارزیابی جامع آبان‌ماه (فصل پاییز)","criteria":{"lessonPlanning":"very_good","punctuality":"very_good","creativity":"excellent","academicFollowUp":"very_good","classroomManagement":"excellent","studentSatisfaction":"very_good"},"overallRating":"very_good","strengths":["تسلط مثال‌زدنی بر مفاهیم حسابان و جبر پیشرفته","قدرت بالا در برقراری سکوت پویا و مشارکت فعال همه دانش‌آموزان پای تخته","طراحی سوالات مفهومی و مبتکرانه برای تمرین‌های هفتگی"],"growthRecommendations":["ارائه بازخورد تشریحی بر روی تکالیف تحویلی دانش‌آموزان ضعیف‌تر","تطبیق زمان‌بندی جلسات تدریس با بودجه‌بندی رسمی امتحانات نهایی"],"generalNotes":"جلسه بازخورد با استاد حسینی با توافق بر سر ارتقای پایش انفرادی دانش‌آموزان نیازمند توجه برگزار شد.","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('te-3', 'usr-tea-3', 2, '{"id":"te-3","teacherId":"usr-tea-3","teacherName":"استاد مریم کریمی","evaluatorId":"usr-vp-edu-1","evaluatorName":"مهندس کاظمی (معاونت آموزش)","date":"1404/08/25","period":"ارزیابی جامع آبان‌ماه (فصل پاییز)","criteria":{"lessonPlanning":"very_good","punctuality":"excellent","creativity":"very_good","academicFollowUp":"good","classroomManagement":"very_good","studentSatisfaction":"very_good"},"overallRating":"very_good","strengths":["طراحی جزوات کمک‌آموزشی بسیار منظم با نمودارهای ساختار مولکولی","نظم فوق‌العاده در ورود و خروج و رعایت دقیق سرفصل‌ها"],"growthRecommendations":["پیگیری منظم‌تر تکالیف هفتگی و ثبت غیبت در تکالیف در سامانه مدرسه","افزایش زمان پرسش کلاسی ابتدای هر زنگ"],"generalNotes":"روند آموزشی مثبت است و هماهنگی‌های لازم با آزمایشگاه انجام گرفته است.","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول school_announcements
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `school_announcements`;
CREATE TABLE `school_announcements` (
  `id` varchar(100) NOT NULL,
  `title` varchar(191) DEFAULT NULL,
  `priority` varchar(20) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `school_announcements_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `school_announcements` (`id`, `title`, `priority`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('ann-1', 'دستورالعمل برگزاری آزمون‌های مستمر آبان و آذرماه ۱۴۰۴', 'urgent', 0, '{"id":"ann-1","title":"دستورالعمل برگزاری آزمون‌های مستمر آبان و آذرماه ۱۴۰۴","content":"همکاران گرامی و اساتید محترم؛ پیرو مصوبه شورای آموزشی مدرسه یاوران ولایت، بودجه‌بندی آزمون‌های میان‌ترم اول و ثبت نمرات مستمر تا تاریخ ۳۰ آذرماه در سامانه الزامی می‌باشد. لطفاً پیش‌نویس سوالات را حداقل یک هفته قبل به معاونت آموزش تحویل فرمایید.","date":"1404/08/20","category":"educational","priority":"urgent","targetRoles":["teacher","vice_educational","admin"],"authorName":"مهندس کاظمی (معاونت آموزش)","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('ann-2', 'نشست هم‌اندیشی اساتید، مربیان یاوران ولایت و کادر تربیتی', 'important', 1, '{"id":"ann-2","title":"نشست هم‌اندیشی اساتید، مربیان یاوران ولایت و کادر تربیتی","content":"نشست ماهانه بررسی روند تحصیلی-تربیتی دانش‌آموزان و هم‌افزایی معلمان و مربیان یاوران ولایت روز چهارشنبه ساعت ۱۴:۳۰ در سالن جلسات برگزار می‌گردد. حضور کلیه اساتید محترم مزید امتنان است.","date":"1404/08/18","category":"general","priority":"important","targetRoles":["teacher","coach","vice_nurturing","vice_educational","vice_disciplinary","admin"],"authorName":"دکتر صادقی (مدیریت دبیرستان)","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('ann-3', 'کارگاه آموزشی: روش‌های نوین طراحی سوالات مفهومی و طرح درس هوشمند', 'normal', 2, '{"id":"ann-3","title":"کارگاه آموزشی: روش‌های نوین طراحی سوالات مفهومی و طرح درس هوشمند","content":"معاونت آموزش با همکاری اساتید برتر، کارگاه دانش‌افزایی ویژه کادر تدریس با محوریت ارزشیابی کیفی و تلفیق فناوری در آموزش را در هفته آینده برگزار می‌نماید.","date":"1404/08/15","category":"educational","priority":"normal","targetRoles":["teacher","vice_educational"],"authorName":"معاونت آموزش","createdAt":"2026-09-30T12:22:25.502Z"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول school_grades
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `school_grades`;
CREATE TABLE `school_grades` (
  `id` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL DEFAULT '',
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `school_grades_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `school_grades` (`id`, `name`, `status`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('grd-7', 'پایه هفتم', 'active', 0, '{"id":"grd-7","name":"پایه هفتم","stage":"دوره اول متوسطه","status":"active"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-8', 'پایه هشتم', 'active', 1, '{"id":"grd-8","name":"پایه هشتم","stage":"دوره اول متوسطه","status":"active"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00'),
('grd-9', 'پایه نهم', 'active', 2, '{"id":"grd-9","name":"پایه نهم","stage":"دوره اول متوسطه","status":"active"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جدول school_settings
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `school_settings`;
CREATE TABLE `school_settings` (
  `id` varchar(100) NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `data` longtext NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `school_settings_sort_order_index` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `school_settings` (`id`, `sort_order`, `data`, `created_at`, `updated_at`) VALUES
('default', 0, '{"schoolName":"دبیرستان دوره اول یاوران ولایت","phone":"۰۲۱-۸۸۷۷۶۶۵۵","address":"تهران، میدان انقلاب، خیابان فخر رازی، پلاک ۱۱۰","academicYear":"۱۴۰۴-۱۴۰۵","schoolCode":"۹۶۰۲۱۴۸۸","principalName":"دکتر صادقی","id":"default"}', '2026-09-30 12:00:00', '2026-09-30 12:00:00');

-- ------------------------------------------------------------
-- جداول استاندارد لاراول
-- ------------------------------------------------------------
DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions` (
  `id` varchar(191) NOT NULL,
  `user_id` varchar(100) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `cache`;
CREATE TABLE `cache` (
  `key` varchar(191) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `cache_locks`;
CREATE TABLE `cache_locks` (
  `key` varchar(191) NOT NULL,
  `owner` varchar(191) NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `comprehensive_exams`;
CREATE TABLE `comprehensive_exams` (
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

DROP TABLE IF EXISTS `course_assignments`;
CREATE TABLE `course_assignments` (
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

DROP TABLE IF EXISTS `mentor_messages`;
CREATE TABLE `mentor_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `sender_id` varchar(100) NOT NULL,
  `target_type` varchar(10) NOT NULL DEFAULT 'all',
  `target_mentor_id` varchar(100) DEFAULT NULL,
  `priority` varchar(10) NOT NULL DEFAULT 'normal',
  `title` varchar(191) NOT NULL DEFAULT '',
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `mentor_messages_sender_id_index` (`sender_id`),
  KEY `mentor_messages_target_mentor_id_index` (`target_mentor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `mentor_message_reads`;
CREATE TABLE `mentor_message_reads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `message_id` bigint unsigned NOT NULL,
  `mentor_id` varchar(100) NOT NULL,
  `acknowledged_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mentor_message_reads_unique` (`message_id`,`mentor_id`),
  KEY `mentor_message_reads_message_id_index` (`message_id`),
  KEY `mentor_message_reads_mentor_id_index` (`mentor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `migrations`;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(191) NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '2026_09_30_000000_create_school_tables', 1),
(2, '2026_10_01_000000_create_mentor_messages_tables', 1),
(3, '2026_10_02_000000_create_comprehensive_exams_table', 1),
(4, '2026_10_03_000000_create_course_assignments_table', 1),
(5, '2026_10_04_000000_add_permissions_to_users_table', 1);

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
