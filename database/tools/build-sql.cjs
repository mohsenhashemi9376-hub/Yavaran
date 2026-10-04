// ساخت فایل database.sql از روی seed.json
const fs = require('fs');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const seed = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outFile = process.argv[3];

const q = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return String(v);
  return "'" + String(v)
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z')
    .replace(/'/g, "\\'") + "'";
};
const s = (o, k, max) => (o[k] === undefined || o[k] === null || typeof o[k] === 'object') ? null : String(o[k]).trim().slice(0, max);

const TS = "'2026-09-30 12:00:00'";
const common = ['`sort_order` int NOT NULL DEFAULT 0', '`data` longtext NOT NULL', '`created_at` timestamp NULL DEFAULT NULL', '`updated_at` timestamp NULL DEFAULT NULL'];

const tables = {
  users: { table: 'users',
    cols: ['`username` varchar(100) DEFAULT NULL', "`name` varchar(191) NOT NULL DEFAULT ''", "`role` varchar(40) NOT NULL DEFAULT 'teacher'", '`phone` varchar(30) DEFAULT NULL', '`is_active` tinyint(1) NOT NULL DEFAULT 1', '`permissions` json DEFAULT NULL', '`password` varchar(255) DEFAULT NULL', '`password_encrypted` text DEFAULT NULL', '`remember_token` varchar(100) DEFAULT NULL'],
    keys: ['UNIQUE KEY `users_username_unique` (`username`)', 'KEY `users_role_index` (`role`)', 'KEY `users_phone_index` (`phone`)'],
    extract: (d) => ({ username: s(d, 'username', 100) || null, name: s(d, 'name', 191) || '', role: s(d, 'role', 40) || 'teacher', phone: s(d, 'phone', 30), is_active: d.isActive === false ? 0 : 1 }) },
  classes: { table: 'school_classes',
    cols: ["`name` varchar(191) NOT NULL DEFAULT ''", '`grade` varchar(100) DEFAULT NULL', '`academic_year` varchar(30) DEFAULT NULL'],
    keys: ['KEY `school_classes_grade_index` (`grade`)'],
    extract: (d) => ({ name: s(d, 'name', 191) || '', grade: s(d, 'grade', 100), academic_year: s(d, 'academicYear', 30) }) },
  bellPeriods: { table: 'bell_periods', cols: ["`name` varchar(100) NOT NULL DEFAULT ''"], keys: [],
    extract: (d) => ({ name: s(d, 'name', 100) || '' }) },
  students: { table: 'students',
    cols: ['`class_id` varchar(100) DEFAULT NULL', "`first_name` varchar(100) NOT NULL DEFAULT ''", "`last_name` varchar(100) NOT NULL DEFAULT ''", '`national_id` varchar(30) DEFAULT NULL', '`student_code` varchar(30) DEFAULT NULL'],
    keys: ['KEY `students_class_id_index` (`class_id`)', 'KEY `students_national_id_index` (`national_id`)', 'KEY `students_name_index` (`last_name`,`first_name`)'],
    extract: (d) => ({ class_id: s(d, 'classId', 100), first_name: s(d, 'firstName', 100) || '', last_name: s(d, 'lastName', 100) || '', national_id: s(d, 'nationalId', 30), student_code: s(d, 'studentCode', 30) }) },
  sessions: { table: 'attendance_sessions',
    cols: ['`class_id` varchar(100) DEFAULT NULL', '`teacher_id` varchar(100) DEFAULT NULL', '`subject` varchar(191) DEFAULT NULL', '`subject_id` varchar(100) DEFAULT NULL', '`period_number` tinyint unsigned DEFAULT NULL', '`lesson_topic` varchar(255) DEFAULT NULL', '`session_date` varchar(20) DEFAULT NULL'],
    keys: ['KEY `attendance_sessions_class_id_index` (`class_id`)', 'KEY `attendance_sessions_teacher_id_index` (`teacher_id`)', 'KEY `attendance_sessions_session_date_index` (`session_date`)'],
    extract: (d) => ({ class_id: s(d, 'classId', 100), teacher_id: s(d, 'teacherId', 100), subject: s(d, 'subject', 191), subject_id: s(d, 'subjectId', 100), period_number: Number.isFinite(Number(d.periodNumber)) && d.periodNumber != null ? Number(d.periodNumber) : null, lesson_topic: s(d, 'lessonTopic', 255), session_date: s(d, 'date', 20) }) },
  academicSubjects: { table: 'academic_subjects', cols: ["`name` varchar(191) NOT NULL DEFAULT ''", '`code` varchar(50) DEFAULT NULL'], keys: [],
    extract: (d) => ({ name: s(d, 'name', 191) || '', code: s(d, 'code', 50) }) },
  academicGrades: { table: 'academic_grades',
    cols: ['`student_id` varchar(100) DEFAULT NULL', '`class_id` varchar(100) DEFAULT NULL', '`subject_id` varchar(100) DEFAULT NULL'],
    keys: ['KEY `academic_grades_student_id_index` (`student_id`)', 'KEY `academic_grades_class_id_index` (`class_id`)', 'KEY `academic_grades_subject_id_index` (`subject_id`)'],
    extract: (d) => ({ student_id: s(d, 'studentId', 100), class_id: s(d, 'classId', 100), subject_id: s(d, 'subjectId', 100) }) },
  morningDelays: { table: 'morning_delays',
    cols: ['`student_id` varchar(100) DEFAULT NULL', '`class_id` varchar(100) DEFAULT NULL', '`record_date` varchar(20) DEFAULT NULL'],
    keys: ['KEY `morning_delays_student_id_index` (`student_id`)', 'KEY `morning_delays_class_id_index` (`class_id`)', 'KEY `morning_delays_record_date_index` (`record_date`)'],
    extract: (d) => ({ student_id: s(d, 'studentId', 100), class_id: s(d, 'classId', 100), record_date: s(d, 'date', 20) }) },
  morningAttendance: { table: 'morning_attendance',
    cols: ['`student_id` varchar(100) NOT NULL', '`class_id` varchar(100) DEFAULT NULL', '`record_date` varchar(20) NOT NULL', "`status` varchar(10) NOT NULL DEFAULT 'absent'", '`entry_time` time DEFAULT NULL', '`delay_minutes` int NOT NULL DEFAULT 0', '`is_acknowledged` tinyint(1) NOT NULL DEFAULT 0'],
    keys: ['UNIQUE KEY `morning_attendance_student_date_unique` (`student_id`,`record_date`)', 'KEY `morning_attendance_student_id_index` (`student_id`)', 'KEY `morning_attendance_class_id_index` (`class_id`)', 'KEY `morning_attendance_record_date_index` (`record_date`)', 'KEY `morning_attendance_is_acknowledged_index` (`is_acknowledged`)'],
    extract: (d) => ({ student_id: s(d, 'studentId', 100) || '', class_id: s(d, 'classId', 100), record_date: s(d, 'date', 20) || '', status: d.status === 'present' ? 'present' : 'absent', entry_time: /^([01]?\d|2[0-3]):[0-5]\d$/.test(d.entryTime || '') ? d.entryTime + ':00' : null, delay_minutes: Math.max(0, Math.min(1440, parseInt(d.delayMinutes, 10) || 0)), is_acknowledged: d.isAcknowledged ? 1 : 0 }) },
  schoolAbsences: { table: 'school_absences',
    cols: ['`student_id` varchar(100) DEFAULT NULL', '`class_id` varchar(100) DEFAULT NULL', '`record_date` varchar(20) DEFAULT NULL'],
    keys: ['KEY `school_absences_student_id_index` (`student_id`)', 'KEY `school_absences_class_id_index` (`class_id`)', 'KEY `school_absences_record_date_index` (`record_date`)'],
    extract: (d) => ({ student_id: s(d, 'studentId', 100), class_id: s(d, 'classId', 100), record_date: s(d, 'date', 20) }) },
  observations: { table: 'student_observations',
    cols: ['`student_id` varchar(100) DEFAULT NULL', '`record_date` varchar(20) DEFAULT NULL'],
    keys: ['KEY `student_observations_student_id_index` (`student_id`)'],
    extract: (d) => ({ student_id: s(d, 'studentId', 100), record_date: s(d, 'date', 20) }) },
  nurturingDossiers: { table: 'nurturing_dossiers', cols: ['`student_id` varchar(100) DEFAULT NULL'],
    keys: ['KEY `nurturing_dossiers_student_id_index` (`student_id`)'],
    extract: (d) => ({ student_id: s(d, 'studentId', 100) || s(d, 'id', 100) }) },
  coachEvaluations: { table: 'coach_evaluations',
    cols: ['`student_id` varchar(100) DEFAULT NULL', '`coach_id` varchar(100) DEFAULT NULL'],
    keys: ['KEY `coach_evaluations_student_id_index` (`student_id`)', 'KEY `coach_evaluations_coach_id_index` (`coach_id`)'],
    extract: (d) => ({ student_id: s(d, 'studentId', 100), coach_id: s(d, 'coachId', 100) }) },
  teacherEvaluations: { table: 'teacher_evaluations', cols: ['`teacher_id` varchar(100) DEFAULT NULL'],
    keys: ['KEY `teacher_evaluations_teacher_id_index` (`teacher_id`)'],
    extract: (d) => ({ teacher_id: s(d, 'teacherId', 100) }) },
  schoolAnnouncements: { table: 'school_announcements',
    cols: ['`title` varchar(191) DEFAULT NULL', '`priority` varchar(20) DEFAULT NULL'], keys: [],
    extract: (d) => ({ title: s(d, 'title', 191), priority: s(d, 'priority', 20) }) },
  grades: { table: 'school_grades',
    cols: ["`name` varchar(100) NOT NULL DEFAULT ''", "`status` varchar(20) NOT NULL DEFAULT 'active'"], keys: [],
    extract: (d) => ({ name: s(d, 'name', 100) || '', status: s(d, 'status', 20) || 'active' }) },
  settings: { table: 'school_settings', cols: [], keys: [], extract: () => ({}) },
};

const hashPassword = (plain) => {
  const salt = crypto.randomBytes(12).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 16);
  return execFileSync('openssl', ['passwd', '-6', '-salt', salt, plain]).toString().trim();
};

let sql = `-- ============================================================
-- مدرسه یاوران ولایت — دیتابیس کامل سامانه (Laravel 12)
-- سازگار با MySQL 5.7+ / MariaDB 10.3+ — قابل ایمپورت در phpMyAdmin
-- رمز عبور پیش‌فرض همه حساب‌ها: 123  (پس از ورود حتماً تغییر دهید)
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
START TRANSACTION;

`;

for (const [key, def] of Object.entries(tables)) {
  const cols = ['`id` varchar(100) NOT NULL', ...def.cols, ...common];
  sql += `-- ------------------------------------------------------------\n-- جدول ${def.table}\n-- ------------------------------------------------------------\n`;
  sql += `DROP TABLE IF EXISTS \`${def.table}\`;\n`;
  sql += `CREATE TABLE \`${def.table}\` (\n  ${[...cols, 'PRIMARY KEY (`id`)', 'KEY `' + def.table + '_sort_order_index` (`sort_order`)', ...def.keys].join(',\n  ')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;

  const rows = seed[key] || [];
  if (!rows.length) continue;
  const inserts = rows.map((item, index) => {
    const data = { ...item };
    const extra = {};
    if (key === 'users') {
      const plain = String(data.password || '123');
      delete data.password;
      extra.password = hashPassword(plain);
    }
    const values = { id: item.id, ...def.extract(data), ...extra, sort_order: index, data: JSON.stringify(data) };
    const names = Object.keys(values);
    return { names, vals: names.map((n) => q(values[n])) };
  });
  const names = [...inserts[0].names, 'created_at', 'updated_at'];
  sql += `INSERT INTO \`${def.table}\` (${names.map((n) => '`' + n + '`').join(', ')}) VALUES\n`;
  sql += inserts.map((r) => `(${[...r.vals, TS, TS].join(', ')})`).join(',\n') + ';\n\n';
}

sql += `-- ------------------------------------------------------------
-- جداول استاندارد لاراول
-- ------------------------------------------------------------
DROP TABLE IF EXISTS \`sessions\`;
CREATE TABLE \`sessions\` (
  \`id\` varchar(191) NOT NULL,
  \`user_id\` varchar(100) DEFAULT NULL,
  \`ip_address\` varchar(45) DEFAULT NULL,
  \`user_agent\` text DEFAULT NULL,
  \`payload\` longtext NOT NULL,
  \`last_activity\` int NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`sessions_user_id_index\` (\`user_id\`),
  KEY \`sessions_last_activity_index\` (\`last_activity\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS \`cache\`;
CREATE TABLE \`cache\` (
  \`key\` varchar(191) NOT NULL,
  \`value\` mediumtext NOT NULL,
  \`expiration\` int NOT NULL,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS \`cache_locks\`;
CREATE TABLE \`cache_locks\` (
  \`key\` varchar(191) NOT NULL,
  \`owner\` varchar(191) NOT NULL,
  \`expiration\` int NOT NULL,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS \`comprehensive_exams\`;
CREATE TABLE \`comprehensive_exams\` (
  \`id\` varchar(100) NOT NULL,
  \`class_id\` varchar(100) DEFAULT NULL,
  \`sort_order\` int NOT NULL DEFAULT 0,
  \`data\` longtext NOT NULL,
  \`created_at\` timestamp NULL DEFAULT NULL,
  \`updated_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`comprehensive_exams_class_id_index\` (\`class_id\`),
  KEY \`comprehensive_exams_sort_order_index\` (\`sort_order\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS \`course_assignments\`;
CREATE TABLE \`course_assignments\` (
  \`id\` varchar(100) NOT NULL,
  \`class_id\` varchar(100) NOT NULL,
  \`subject_id\` varchar(100) NOT NULL,
  \`user_id\` varchar(100) NOT NULL,
  \`sort_order\` int NOT NULL DEFAULT 0,
  \`data\` longtext NOT NULL,
  \`created_at\` timestamp NULL DEFAULT NULL,
  \`updated_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`course_assignments_class_subject_unique\` (\`class_id\`,\`subject_id\`),
  KEY \`course_assignments_class_id_index\` (\`class_id\`),
  KEY \`course_assignments_subject_id_index\` (\`subject_id\`),
  KEY \`course_assignments_user_id_index\` (\`user_id\`),
  KEY \`course_assignments_sort_order_index\` (\`sort_order\`),
  CONSTRAINT \`course_assignments_user_id_foreign\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS \`mentor_messages\`;
CREATE TABLE \`mentor_messages\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`sender_id\` varchar(100) NOT NULL,
  \`target_type\` varchar(10) NOT NULL DEFAULT 'all',
  \`target_mentor_id\` varchar(100) DEFAULT NULL,
  \`priority\` varchar(10) NOT NULL DEFAULT 'normal',
  \`title\` varchar(191) NOT NULL DEFAULT '',
  \`content\` text NOT NULL,
  \`created_at\` timestamp NULL DEFAULT NULL,
  \`updated_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`mentor_messages_sender_id_index\` (\`sender_id\`),
  KEY \`mentor_messages_target_mentor_id_index\` (\`target_mentor_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS \`mentor_message_reads\`;
CREATE TABLE \`mentor_message_reads\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`message_id\` bigint unsigned NOT NULL,
  \`mentor_id\` varchar(100) NOT NULL,
  \`acknowledged_at\` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`mentor_message_reads_unique\` (\`message_id\`,\`mentor_id\`),
  KEY \`mentor_message_reads_message_id_index\` (\`message_id\`),
  KEY \`mentor_message_reads_mentor_id_index\` (\`mentor_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS \`migrations\`;
CREATE TABLE \`migrations\` (
  \`id\` int unsigned NOT NULL AUTO_INCREMENT,
  \`migration\` varchar(191) NOT NULL,
  \`batch\` int NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO \`migrations\` (\`id\`, \`migration\`, \`batch\`) VALUES
(1, '2026_09_30_000000_create_school_tables', 1),
(2, '2026_10_01_000000_create_mentor_messages_tables', 1),
(3, '2026_10_02_000000_create_comprehensive_exams_table', 1),
(4, '2026_10_03_000000_create_course_assignments_table', 1),
(5, '2026_10_04_000000_add_permissions_to_users_table', 1),
(6, '2026_10_05_000000_create_morning_attendance_table', 1);

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
`;

fs.writeFileSync(outFile, sql);
console.log('written', outFile, sql.length);
