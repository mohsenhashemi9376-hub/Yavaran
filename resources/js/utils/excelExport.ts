import * as XLSX from 'xlsx';
import { SchoolClass, Student, AttendanceSession, AttendanceStatus, HomeworkStatus } from '../types';
import { toPersianDigits } from './persianDate';

const getStatusLabel = (status?: AttendanceStatus, delayMinutes?: number): string => {
  if (!status) return '-';
  switch (status) {
    case 'present':
      return 'حاضر (✔)';
    case 'absent':
      return 'غایب (✖)';
    case 'excused':
      return 'غیبت موجه (م)';
    case 'late':
      return delayMinutes ? `تاخیر (${delayMinutes}دقیقه)` : 'تاخیر (ت)';
    default:
      return '-';
  }
};

/**
 * Export Class Attendance Report to Excel (.xlsx)
 */
export const exportClassAttendanceToExcel = (
  schoolClass: SchoolClass,
  students: Student[],
  sessions: AttendanceSession[],
  options?: {
    monthFilter?: number; // 1-12 or undefined for all
    monthName?: string;
  }
) => {
  const classStudents = students.filter((s) => s.classId === schoolClass.id);
  
  // Sort sessions chronologically
  const sortedSessions = [...sessions]
    .filter((s) => s.classId === schoolClass.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Filter by month if requested
  const filteredSessions = options?.monthFilter
    ? sortedSessions.filter((s) => {
        const parts = s.date.split('/');
        return Number(parts[1]) === options.monthFilter;
      })
    : sortedSessions;

  // 1. Prepare Sheet 1: Matrix Data
  const matrixData: Record<string, any>[] = [];

  classStudents.forEach((student, index) => {
    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    let lateCount = 0;
    let totalDelayMinutes = 0;

    const row: Record<string, any> = {
      'ردیف': index + 1,
      'نام و نام خانوادگی': `${student.firstName} ${student.lastName}`,
      'کد دانش‌آموزی': student.studentCode || '-',
      'کد ملی': student.nationalId || '-',
      'شماره تماس ولی': student.parentPhone || '-',
    };

    // Add session attendance columns
    filteredSessions.forEach((session) => {
      const colTitle = `${session.date} (${session.subject})`;
      const record = session.records[student.id];
      if (record) {
        row[colTitle] = getStatusLabel(record.status, record.delayMinutes);
        if (record.status === 'present') presentCount++;
        else if (record.status === 'absent') absentCount++;
        else if (record.status === 'excused') excusedCount++;
        else if (record.status === 'late') {
          lateCount++;
          totalDelayMinutes += record.delayMinutes || 0;
        }
      } else {
        row[colTitle] = 'ثبت‌نشده';
      }
    });

    const totalRecordedSessions = presentCount + absentCount + excusedCount + lateCount;
    const rate = totalRecordedSessions > 0 ? Math.round(((presentCount + lateCount) / totalRecordedSessions) * 100) : 100;

    row['تعداد حاضر'] = presentCount;
    row['تعداد غایب غیرموجه'] = absentCount;
    row['تعداد غایب موجه'] = excusedCount;
    row['تعداد تاخیر'] = lateCount;
    row['مجموع دقایق تاخیر'] = totalDelayMinutes;
    row['درصد حضور'] = `${rate}%`;
    row['وضعیت انضباطی'] = absentCount >= 3 ? 'نیازمند اخطار و تماس' : absentCount > 0 ? 'معمولی' : 'عالی';

    matrixData.push(row);
  });

  // 2. Prepare Sheet 2: Sessions and Topics Log
  const sessionLogData = filteredSessions.map((session, idx) => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    Object.values(session.records).forEach((rec) => {
      if (rec.status === 'present') present++;
      else if (rec.status === 'absent') absent++;
      else if (rec.status === 'late') late++;
      else if (rec.status === 'excused') excused++;
    });

    return {
      'شماره جلسه': idx + 1,
      'تاریخ شمسی': session.date,
      'روز هفته': session.dayOfWeek || '-',
      'درس / ماده درسی': session.subject,
      'استاد / دبیر': session.teacherName,
      'ساعت کلاس': session.startTime && session.endTime ? `${session.startTime} تا ${session.endTime}` : '-',
      'مبحث تدریس شده': session.lessonTopic || 'ذکر نشده',
      'تکالیف داده شده': session.homeworkDescription || 'ندارد',
      'یادداشت جلسه': session.sessionNotes || '-',
      'تعداد حاضر': present,
      'تعداد غایب': absent,
      'تعداد تاخیر': late,
      'تعداد موجه': excused,
    };
  });

  // 3. Prepare Sheet 3: Warning List (Students with >= 2 absences)
  const warningStudents = classStudents
    .map((student) => {
      let absentCount = 0;
      let lateCount = 0;
      filteredSessions.forEach((s) => {
        const rec = s.records[student.id];
        if (rec?.status === 'absent') absentCount++;
        if (rec?.status === 'late') lateCount++;
      });
      return { student, absentCount, lateCount };
    })
    .filter((item) => item.absentCount >= 2 || item.lateCount >= 3)
    .map((item, idx) => ({
      'ردیف': idx + 1,
      'نام و نام خانوادگی': `${item.student.firstName} ${item.student.lastName}`,
      'نام پدر': item.student.fatherName || '-',
      'تلفن ولی': item.student.parentPhone,
      'تعداد غیبت غیرموجه': item.student.notes || item.absentCount,
      'تعداد تاخیر': item.lateCount,
      'اقدام پیشنهادی': item.absentCount >= 3 ? 'ارسال احضاریه و جلسه با اولیا' : 'پیامک تذکر به ولی',
    }));

  // Create Workbook
  const wb = XLSX.utils.book_new();

  // Add Sheet 1
  const ws1 = XLSX.utils.json_to_sheet(matrixData.length > 0 ? matrixData : [{ 'اطلاعات': 'دانش‌آموزی یافت نشد' }]);
  XLSX.utils.book_append_sheet(wb, ws1, 'ماتریس حضور و غیاب');

  // Add Sheet 2
  const ws2 = XLSX.utils.json_to_sheet(sessionLogData.length > 0 ? sessionLogData : [{ 'اطلاعات': 'جلسه‌ای ثبت نشده است' }]);
  XLSX.utils.book_append_sheet(wb, ws2, 'ریز جلسات و مباحث');

  // Add Sheet 3
  if (warningStudents.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(warningStudents);
    XLSX.utils.book_append_sheet(wb, ws3, 'لیست غایبین پرتکرار');
  }

  // Generate filename
  const sanitizedClassName = schoolClass.name.replace(/\s+/g, '_');
  const monthSuffix = options?.monthName ? `_ماه_${options.monthName}` : '_کل_دوره';
  const fileName = `گزارش_حضور_غیاب_${sanitizedClassName}${monthSuffix}.xlsx`;

  // Write file and trigger download
  XLSX.writeFile(wb, fileName);
};

/**
 * Export School Overall Summary (For Admin / Vice Principal)
 */
export const exportOverallSchoolSummaryToExcel = (
  classes: SchoolClass[],
  students: Student[],
  sessions: AttendanceSession[],
  teachers: { id: string; name: string; subject?: string }[]
) => {
  const classSummaryRows = classes.map((c, idx) => {
    const classStudents = students.filter((s) => s.classId === c.id);
    const classSessions = sessions.filter((s) => s.classId === c.id);

    let totalPossibleAttendances = 0;
    let totalActualPresents = 0;
    let totalAbsences = 0;
    let totalLates = 0;

    classSessions.forEach((session) => {
      Object.values(session.records).forEach((r) => {
        totalPossibleAttendances++;
        if (r.status === 'present') totalActualPresents++;
        else if (r.status === 'late') {
          totalActualPresents++;
          totalLates++;
        } else if (r.status === 'absent') {
          totalAbsences++;
        }
      });
    });

    const rate = totalPossibleAttendances > 0 ? Math.round((totalActualPresents / totalPossibleAttendances) * 100) : 100;

    return {
      'ردیف': idx + 1,
      'نام کلاس': c.name,
      'پایه': c.grade,
      'رشته': c.major,
      'تعداد دانش‌آموز': classStudents.length,
      'تعداد جلسات برگزار شده': classSessions.length,
      'مجموع غیبت‌ها': totalAbsences,
      'مجموع تاخیرها': totalLates,
      'میانگین حضور کلاس': `${rate}%`,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(classSummaryRows);
  XLSX.utils.book_append_sheet(wb, ws, 'جمعبندی کلی مدرسه');

  XLSX.writeFile(wb, 'گزارش_جامع_حضور_غیاب_کل_مدرسه.xlsx');
};

/**
 * Export Individual Student Report & Transcript to Excel (.xlsx)
 */
export const exportStudentIndividualReportToExcel = (
  student: Student,
  schoolClass?: SchoolClass,
  sessionLogs: {
    session: AttendanceSession;
    status: AttendanceStatus;
    delayMinutes?: number;
    score?: number;
    homeworkStatus?: HomeworkStatus;
    note?: string;
  }[] = []
) => {
  const metaSheet = [
    { 'مشخصه': 'نام و نام خانوادگی', 'مقدار': `${student.firstName} ${student.lastName}` },
    { 'مشخصه': 'نام پدر', 'مقدار': student.fatherName || '-' },
    { 'مشخصه': 'کد دانش‌آموزی', 'مقدار': student.studentCode || '-' },
    { 'مشخصه': 'کد ملی', 'مقدار': student.nationalId || '-' },
    { 'مشخصه': 'کلاس و رشته', 'مقدار': schoolClass ? `${schoolClass.name} (${schoolClass.grade} - ${schoolClass.major})` : '-' },
    { 'مشخصه': 'شماره تماس اولیاء', 'مقدار': student.parentPhone || '-' },
    { 'مشخصه': 'یادداشت‌های پرونده', 'مقدار': student.notes || '-' },
  ];

  let presentCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  let lateCount = 0;
  let totalDelay = 0;
  let totalScore = 0;
  let scoreCount = 0;

  const logsRows = sessionLogs.map((item, idx) => {
    if (item.status === 'present') presentCount++;
    else if (item.status === 'absent') absentCount++;
    else if (item.status === 'excused') excusedCount++;
    else if (item.status === 'late') {
      lateCount++;
      totalDelay += item.delayMinutes || 0;
    }

    if (item.score !== undefined) {
      totalScore += item.score;
      scoreCount++;
    }

    let statusPersian = 'حاضر';
    if (item.status === 'absent') statusPersian = 'غایب غیرموجه';
    else if (item.status === 'excused') statusPersian = 'غایب موجه';
    else if (item.status === 'late') statusPersian = `تاخیر (${item.delayMinutes || 10} دقیقه)`;

    let homeworkPersian = '-';
    if (item.homeworkStatus === 'done') homeworkPersian = 'انجام شده (کامل)';
    else if (item.homeworkStatus === 'incomplete') homeworkPersian = 'ناقص';
    else if (item.homeworkStatus === 'not_done') homeworkPersian = 'انجام‌نشده';

    return {
      'شماره': idx + 1,
      'تاریخ جلسه': item.session.date,
      'روز هفته': item.session.dayOfWeek || '-',
      'ماده درسی': item.session.subject,
      'دبیر / استاد': item.session.teacherName,
      'مبحث تدریس شده': item.session.lessonTopic || '-',
      'وضعیت حضور و غیاب': statusPersian,
      'نمره مستمر (از ۲۰)': item.score !== undefined ? item.score : '-',
      'وضعیت تکلیف': homeworkPersian,
      'یادداشت دبیر': item.note || item.session.sessionNotes || '-',
    };
  });

  const totalSessions = sessionLogs.length;
  const rate = totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 100;
  const avg = scoreCount > 0 ? (totalScore / scoreCount).toFixed(2) : '-';

  metaSheet.push(
    { 'مشخصه': 'تعداد کل جلسات', 'مقدار': String(totalSessions) },
    { 'مشخصه': 'تعداد حضور', 'مقدار': String(presentCount) },
    { 'مشخصه': 'تعداد غیبت غیرموجه', 'مقدار': String(absentCount) },
    { 'مشخصه': 'تعداد غیبت موجه', 'مقدار': String(excusedCount) },
    { 'مشخصه': 'تعداد تاخیر', 'مقدار': String(lateCount) },
    { 'مشخصه': 'مجموع دقایق تاخیر', 'مقدار': `${totalDelay} دقیقه` },
    { 'مشخصه': 'درصد حضور کلاسی', 'مقدار': `${rate}%` },
    { 'مشخصه': 'معدل نمرات مستمر', 'مقدار': `${avg} از ۲۰` }
  );

  const wb = XLSX.utils.book_new();

  const wsMeta = XLSX.utils.json_to_sheet(metaSheet);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'خلاصه پرونده دانش‌آموز');

  const wsLogs = XLSX.utils.json_to_sheet(logsRows.length > 0 ? logsRows : [{ 'اطلاعات': 'جلسه‌ای ثبت نشده است' }]);
  XLSX.utils.book_append_sheet(wb, wsLogs, 'ریز جلسات و نمرات');

  const fileName = `کارنامه_${student.firstName}_${student.lastName}_${schoolClass?.name || 'کلاس'}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

/**
 * Export Teacher Activity and Class Performance to Excel
 */
export const exportTeacherReportToExcel = (
  teacher: any,
  classes: SchoolClass[],
  sessions: AttendanceSession[],
  students: Student[]
) => {
  const assignedClasses = classes.filter(
    (c) => c.teacherIds.includes(teacher.id) || (teacher.assignedClassIds || []).includes(c.id)
  );

  const teacherSessions = sessions.filter(
    (s) => s.teacherId === teacher.id || s.teacherName === teacher.name
  );

  const metaSheet = [
    { 'مشخصه': 'نام معلم', 'مقدار': teacher.name },
    { 'مشخصه': 'کد کاربری', 'مقدار': teacher.username },
    { 'مشخصه': 'درس تدریسی', 'مقدار': teacher.subjectSpecialty || teacher.subject || 'عمومی' },
    { 'مشخصه': 'تعداد کلاس‌های تخصیص‌یافته', 'مقدار': String(assignedClasses.length) },
    { 'مشخصه': 'کلاس‌های فعال', 'مقدار': assignedClasses.map((c) => c.name).join('، ') || 'تعیین نشده' },
    { 'مشخصه': 'تعداد کل جلسات برگزارشده', 'مقدار': String(teacherSessions.length) },
  ];

  // Class Breakdown Sheet
  const classBreakdown = assignedClasses.map((cls, idx) => {
    const clsStudents = students.filter((s) => s.classId === cls.id);
    const clsSessions = teacherSessions.filter((s) => s.classId === cls.id);
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;

    clsSessions.forEach((sess) => {
      Object.values(sess.records || {}).forEach((rec: any) => {
        if (rec.status === 'present') totalPresent++;
        else if (rec.status === 'absent') totalAbsent++;
        else if (rec.status === 'late') totalLate++;
      });
    });

    const totalRecords = totalPresent + totalAbsent + totalLate;
    const attendanceRate = totalRecords > 0 ? `${Math.round(((totalPresent + totalLate) / totalRecords) * 100)}%` : '-';

    return {
      'ردیف': idx + 1,
      'نام کلاس': cls.name,
      'پایه': cls.grade,
      'تعداد دانش‌آموزان': clsStudents.length,
      'جلسات ثبت‌شده این درس': clsSessions.length,
      'مجموع حاضرین': totalPresent,
      'مجموع غایبین': totalAbsent,
      'مجموع تاخیرها': totalLate,
      'نرخ حضور': attendanceRate,
    };
  });

  // Recent Sessions Sheet
  const sessionRows = teacherSessions.map((sess, idx) => {
    const cls = classes.find((c) => c.id === sess.classId);
    const recs = Object.values(sess.records || {});
    const p = recs.filter((r: any) => r.status === 'present').length;
    const a = recs.filter((r: any) => r.status === 'absent').length;

    return {
      'ردیف': idx + 1,
      'تاریخ': sess.date,
      'کلاس': cls?.name || sess.classId,
      'درس': sess.subject,
      'ساعت برگزاری': `${sess.startTime || '-'} تا ${sess.endTime || '-'}`,
      'مبحث تدریس': sess.lessonTopic || '-',
      'حاضرین': p,
      'غایبین': a,
      'یادداشت جلسه': sess.sessionNotes || '-',
    };
  });

  const wb = XLSX.utils.book_new();
  const wsMeta = XLSX.utils.json_to_sheet(metaSheet);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'اطلاعات معلم');

  const wsClasses = XLSX.utils.json_to_sheet(classBreakdown.length > 0 ? classBreakdown : [{ 'اطلاعات': 'کلاسی تخصیص نیافته است' }]);
  XLSX.utils.book_append_sheet(wb, wsClasses, 'کلاس‌ها و آمار');

  const wsSessions = XLSX.utils.json_to_sheet(sessionRows.length > 0 ? sessionRows : [{ 'اطلاعات': 'جلسه‌ای ثبت نشده است' }]);
  XLSX.utils.book_append_sheet(wb, wsSessions, 'ریز جلسات');

  const fileName = `گزارش_معلم_${teacher.name.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

/**
 * Export Coach Activity and Covered Students to Excel
 */
export const exportCoachReportToExcel = (
  coach: any,
  classes: SchoolClass[],
  students: Student[],
  coachEvaluations: any[] = []
) => {
  const assignedClasses = classes.filter(
    (c) => (coach.assignedClassIds || []).includes(c.id) || c.coachId === coach.id
  );

  const classIds = new Set(assignedClasses.map((c) => c.id));
  const coveredStudents = assignedClasses.length > 0
    ? students.filter((s) => classIds.has(s.classId))
    : students;

  const evaluations = coachEvaluations.filter((e) => e.coachId === coach.id);

  const metaSheet = [
    { 'مشخصه': 'نام مربی', 'مقدار': coach.name },
    { 'مشخصه': 'کد کاربری', 'مقدار': coach.username },
    { 'مشخصه': 'حوزه و مسئولیت تربیتی', 'مقدار': coach.coachRoleTitle || 'مربی تربیتی' },
    { 'مشخصه': 'تعداد کلاس‌های تحت پوشش', 'مقدار': String(assignedClasses.length) },
    { 'مشخصه': 'کلاس‌های تحت پوشش', 'مقدار': assignedClasses.map((c) => c.name).join('، ') || 'همه کلاس‌ها' },
    { 'مشخصه': 'تعداد دانش‌آموزان تحت نظر', 'مقدار': String(coveredStudents.length) },
    { 'مشخصه': 'تعداد ارزیابی‌های ثبت‌شده', 'مقدار': String(evaluations.length) },
  ];

  const studentsRows = coveredStudents.map((stu, idx) => {
    const cls = classes.find((c) => c.id === stu.classId);
    const stuEvaluations = evaluations.filter((e) => e.studentId === stu.id);

    return {
      'ردیف': idx + 1,
      'نام و نام خانوادگی': `${stu.firstName} ${stu.lastName}`,
      'کد ملی': stu.nationalId || '-',
      'کد دانش‌آموزی': stu.studentCode || '-',
      'کلاس': cls?.name || '-',
      'پایه': cls?.grade || '-',
      'شماره تماس ولی': stu.parentPhone || '-',
      'تعداد ارزیابی‌های تربیتی': stuEvaluations.length,
      'وضعیت انضباطی': stu.disciplinaryStatus === 'normal' ? 'عادی' : (stu.disciplinaryStatus || 'عادی'),
    };
  });

  const wb = XLSX.utils.book_new();
  const wsMeta = XLSX.utils.json_to_sheet(metaSheet);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'مشخصات مربی');

  const wsStudents = XLSX.utils.json_to_sheet(studentsRows.length > 0 ? studentsRows : [{ 'اطلاعات': 'دانش‌آموزی یافت نشد' }]);
  XLSX.utils.book_append_sheet(wb, wsStudents, 'دانش‌آموزان تحت نظر');

  const fileName = `گزارش_مربی_${coach.name.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
};


