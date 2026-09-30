import { StudentAcademicGrade, AcademicSubject, AttendanceSession, MonthlyPeriodKey, MONTHLY_EVALUATION_PERIODS } from '../types';

export interface SubjectAnalysis {
  subjectId: string;
  subjectName: string;
  coefficient: number;
  
  // 8 Monthly Continuous Marks
  mehrContinuous?: number;
  abanContinuous?: number;
  azarContinuous?: number;
  bahmanContinuous?: number;
  esfandContinuous?: number;
  farvardinContinuous?: number;
  ordibeheshtContinuous?: number;

  // 4 Official Iranian Ministry Term Marks
  term1Continuous?: number;
  term1Final?: number;
  term2Continuous?: number;
  term2Final?: number;
  
  term1Overall?: number; // (C1*1 + F1*2) / 3
  term2Overall?: number; // (C2*1 + F2*6) / 7 or (C2*1 + F2*2) / 3
  annualScore?: number;  // (C1*1 + F1*2 + C2*1 + F2*6) / 10
  growthDelta?: number;  // term2Final - term1Final or term2Overall - term1Overall
  growthStatus: 'great_growth' | 'positive_growth' | 'steady' | 'minor_decline' | 'critical_decline' | 'insufficient_data';
  passStatus: 'passed' | 'conditional' | 'failed' | 'in_progress';
  notes?: string;
  teacherName?: string;
}

export interface StudentComprehensiveAcademicReport {
  studentId: string;
  subjectAnalyses: SubjectAnalysis[];
  
  // GPAs
  term1ContinuousGpa?: number;
  term1FinalGpa?: number;
  term1OverallGpa?: number;
  
  term2ContinuousGpa?: number;
  term2FinalGpa?: number;
  term2OverallGpa?: number;
  
  annualGpa?: number;

  // Monthly Continuous GPAs across all subjects
  monthlyAverages: {
    periodKey: MonthlyPeriodKey;
    label: string;
    shortLabel: string;
    semester: 1 | 2;
    average?: number;
  }[];
  
  // Growth Metrics
  overallGrowthDelta: number;
  growthCategory: 'exceptional' | 'improving' | 'stable' | 'needs_attention' | 'critical';
  
  // Insights
  strengths: SubjectAnalysis[];
  weaknesses: SubjectAnalysis[];
  highestSubject?: SubjectAnalysis;
  lowestSubject?: SubjectAnalysis;
  
  // Attendance & Homework Correlation
  attendanceCorrelationNote?: string;
  recommendations: string[];
}

/**
 * Calculates official Iranian high school annual score:
 * Annual Score = (Term1_Continuous * 1 + Term1_Final * 2 + Term2_Continuous * 1 + Term2_Final * 6) / 10
 */
export function calculateAnnualScore(
  c1?: number,
  f1?: number,
  c2?: number,
  f2?: number
): number | undefined {
  if (c1 === undefined && f1 === undefined && c2 === undefined && f2 === undefined) {
    return undefined;
  }
  
  // If all 4 are present: Standard Ministry of Education formula
  if (c1 !== undefined && f1 !== undefined && c2 !== undefined && f2 !== undefined) {
    const total = (c1 * 1) + (f1 * 2) + (c2 * 1) + (f2 * 6);
    return Math.round((total / 10) * 100) / 100;
  }

  // If only Term 1 is entered:
  if (c1 !== undefined && f1 !== undefined && c2 === undefined && f2 === undefined) {
    return Math.round((((c1 * 1) + (f1 * 2)) / 3) * 100) / 100;
  }

  // If Term 1 & Term 2 Continuous are entered:
  const weights: number[] = [];
  const scores: number[] = [];
  if (c1 !== undefined) { weights.push(1); scores.push(c1 * 1); }
  if (f1 !== undefined) { weights.push(2); scores.push(f1 * 2); }
  if (c2 !== undefined) { weights.push(1); scores.push(c2 * 1); }
  if (f2 !== undefined) { weights.push(6); scores.push(f2 * 6); }

  const weightSum = weights.reduce((a, b) => a + b, 0);
  const scoreSum = scores.reduce((a, b) => a + b, 0);
  if (weightSum === 0) return undefined;
  return Math.round((scoreSum / weightSum) * 100) / 100;
}

export function analyzeSubjectGrade(grade: StudentAcademicGrade): SubjectAnalysis {
  // If term1Continuous is not explicitly set, average monthly marks of Semester 1
  let c1 = grade.term1Continuous;
  if (c1 === undefined) {
    const s1Months = [grade.mehrContinuous, grade.abanContinuous, grade.azarContinuous].filter(v => v !== undefined) as number[];
    if (s1Months.length > 0) {
      c1 = Math.round((s1Months.reduce((a, b) => a + b, 0) / s1Months.length) * 100) / 100;
    }
  }

  // If term2Continuous is not explicitly set, average monthly marks of Semester 2
  let c2 = grade.term2Continuous;
  if (c2 === undefined) {
    const s2Months = [grade.bahmanContinuous, grade.esfandContinuous, grade.farvardinContinuous, grade.ordibeheshtContinuous].filter(v => v !== undefined) as number[];
    if (s2Months.length > 0) {
      c2 = Math.round((s2Months.reduce((a, b) => a + b, 0) / s2Months.length) * 100) / 100;
    }
  }

  const f1 = grade.term1Final;
  const f2 = grade.term2Final;

  let term1Overall: number | undefined = undefined;
  if (c1 !== undefined && f1 !== undefined) {
    term1Overall = Math.round((((c1 * 1) + (f1 * 2)) / 3) * 100) / 100;
  } else if (f1 !== undefined) {
    term1Overall = f1;
  } else if (c1 !== undefined) {
    term1Overall = c1;
  }

  let term2Overall: number | undefined = undefined;
  if (c2 !== undefined && f2 !== undefined) {
    term2Overall = Math.round((((c2 * 1) + (f2 * 6)) / 7) * 100) / 100;
  } else if (f2 !== undefined) {
    term2Overall = f2;
  } else if (c2 !== undefined) {
    term2Overall = c2;
  }

  const annualScore = calculateAnnualScore(c1, f1, c2, f2);

  // Growth Delta calculation
  let growthDelta: number | undefined = undefined;
  let growthStatus: SubjectAnalysis['growthStatus'] = 'insufficient_data';

  if (f1 !== undefined && f2 !== undefined) {
    growthDelta = Math.round((f2 - f1) * 100) / 100;
  } else if (term1Overall !== undefined && term2Overall !== undefined) {
    growthDelta = Math.round((term2Overall - term1Overall) * 100) / 100;
  } else if (c1 !== undefined && c2 !== undefined) {
    growthDelta = Math.round((c2 - c1) * 100) / 100;
  }

  if (growthDelta !== undefined) {
    if (growthDelta >= 2.0) growthStatus = 'great_growth';
    else if (growthDelta > 0.25) growthStatus = 'positive_growth';
    else if (growthDelta >= -0.5) growthStatus = 'steady';
    else if (growthDelta >= -2.0) growthStatus = 'minor_decline';
    else growthStatus = 'critical_decline';
  }

  // Pass status
  let passStatus: SubjectAnalysis['passStatus'] = 'in_progress';
  if (annualScore !== undefined) {
    if (annualScore >= 10 && (f2 === undefined || f2 >= 10)) {
      passStatus = 'passed';
    } else if (annualScore >= 7) {
      passStatus = 'conditional';
    } else {
      passStatus = 'failed';
    }
  }

  return {
    subjectId: grade.subjectId,
    subjectName: grade.subjectName,
    coefficient: grade.coefficient || 1,
    mehrContinuous: grade.mehrContinuous,
    abanContinuous: grade.abanContinuous,
    azarContinuous: grade.azarContinuous,
    bahmanContinuous: grade.bahmanContinuous,
    esfandContinuous: grade.esfandContinuous,
    farvardinContinuous: grade.farvardinContinuous,
    ordibeheshtContinuous: grade.ordibeheshtContinuous,
    term1Continuous: c1,
    term1Final: f1,
    term2Continuous: c2,
    term2Final: f2,
    term1Overall,
    term2Overall,
    annualScore,
    growthDelta,
    growthStatus,
    passStatus,
    notes: grade.notes,
    teacherName: grade.teacherName,
  };
}

export function generateComprehensiveAcademicReport(
  studentId: string,
  grades: StudentAcademicGrade[],
  sessions: AttendanceSession[]
): StudentComprehensiveAcademicReport {
  const subjectAnalyses = grades.map(analyzeSubjectGrade);

  // Compute weighted GPAs
  const calculateWeightedAverage = (getter: (s: SubjectAnalysis) => number | undefined) => {
    let totalScore = 0;
    let totalCoeff = 0;
    subjectAnalyses.forEach((sa) => {
      const val = getter(sa);
      if (val !== undefined && !isNaN(val)) {
        totalScore += val * sa.coefficient;
        totalCoeff += sa.coefficient;
      }
    });
    return totalCoeff > 0 ? Math.round((totalScore / totalCoeff) * 100) / 100 : undefined;
  };

  const term1ContinuousGpa = calculateWeightedAverage((s) => s.term1Continuous);
  const term1FinalGpa = calculateWeightedAverage((s) => s.term1Final);
  const term1OverallGpa = calculateWeightedAverage((s) => s.term1Overall);

  const term2ContinuousGpa = calculateWeightedAverage((s) => s.term2Continuous);
  const term2FinalGpa = calculateWeightedAverage((s) => s.term2Final);
  const term2OverallGpa = calculateWeightedAverage((s) => s.term2Overall);

  const annualGpa = calculateWeightedAverage((s) => s.annualScore);

  // Monthly Continuous GPAs across all periods
  const monthlyAverages = MONTHLY_EVALUATION_PERIODS.map((period) => {
    let total = 0;
    let count = 0;
    grades.forEach((g) => {
      const score = g[period.key];
      if (score !== undefined && !isNaN(score)) {
        const coeff = g.coefficient || 1;
        total += score * coeff;
        count += coeff;
      }
    });
    return {
      periodKey: period.key,
      label: period.label,
      shortLabel: period.shortLabel,
      semester: period.term,
      average: count > 0 ? Math.round((total / count) * 100) / 100 : undefined,
    };
  });

  // Overall Growth
  let overallGrowthDelta = 0;
  if (term2FinalGpa !== undefined && term1FinalGpa !== undefined) {
    overallGrowthDelta = Math.round((term2FinalGpa - term1FinalGpa) * 100) / 100;
  } else if (term2OverallGpa !== undefined && term1OverallGpa !== undefined) {
    overallGrowthDelta = Math.round((term2OverallGpa - term1OverallGpa) * 100) / 100;
  }

  let growthCategory: StudentComprehensiveAcademicReport['growthCategory'] = 'stable';
  if (overallGrowthDelta >= 1.5) growthCategory = 'exceptional';
  else if (overallGrowthDelta > 0.25) growthCategory = 'improving';
  else if (overallGrowthDelta >= -0.5) growthCategory = 'stable';
  else if (overallGrowthDelta >= -1.5) growthCategory = 'needs_attention';
  else growthCategory = 'critical';

  // Strengths and Weaknesses
  const sortedByPerformance = [...subjectAnalyses].sort((a, b) => {
    const scoreA = a.annualScore ?? a.term2Final ?? a.term1Final ?? 0;
    const scoreB = b.annualScore ?? b.term2Final ?? b.term1Final ?? 0;
    return scoreB - scoreA;
  });

  const strengths = sortedByPerformance.filter((s) => (s.annualScore ?? s.term2Final ?? s.term1Final ?? 0) >= 16);
  const weaknesses = sortedByPerformance.filter((s) => (s.annualScore ?? s.term2Final ?? s.term1Final ?? 0) < 14);

  const highestSubject = sortedByPerformance[0];
  const lowestSubject = sortedByPerformance[sortedByPerformance.length - 1];

  // Correlation with Attendance and Sessions
  let studentAbsences = 0;
  let studentLates = 0;
  let incompleteHomeworks = 0;

  sessions.forEach((ses) => {
    const rec = ses.records[studentId];
    if (rec) {
      if (rec.status === 'absent') studentAbsences++;
      if (rec.status === 'late') studentLates++;
      if (rec.homeworkStatus === 'not_done' || rec.homeworkStatus === 'incomplete') {
        incompleteHomeworks++;
      }
    }
  });

  let attendanceCorrelationNote: string | undefined = undefined;
  if (studentAbsences >= 3 && weaknesses.length > 0) {
    attendanceCorrelationNote = `افت نمره در دروس (${weaknesses.map(w => w.subjectName).slice(0, 2).join('، ')}) با ${studentAbsences} جلسه غیبت ثبت‌شده همبستگی مستقیم دارد.`;
  } else if (incompleteHomeworks >= 2) {
    attendanceCorrelationNote = `عدم تحویل به‌موقع تکالیف بر نمرات ارزشیابی مستمر تاثیر منفی داشته است.`;
  } else if (studentAbsences === 0 && growthCategory === 'improving') {
    attendanceCorrelationNote = `حضور منظم ۱۰۰ درصدی در کلاس‌ها منجر به ارتقای بارز معدل شده است.`;
  }

  // Recommendations
  const recommendations: string[] = [];
  if (weaknesses.length > 0) {
    recommendations.push(`برگزاری جلسات رفع اشکال و تمرین ویژه در درس‌های ${weaknesses.map(w => w.subjectName).join(' و ')}`);
  }
  if (growthCategory === 'exceptional' || growthCategory === 'improving') {
    recommendations.push(`تشویق دانش‌آموز در صف صبحگاه به پاس رشد تحصیلی مثبت و پیشرفت چشمگیر`);
  }
  if (studentAbsences >= 2) {
    recommendations.push(`پیگیری علت غیبت‌ها و هماهنگی جلسه حضوری با اولیاء جهت تثبیت نظم تحصیلی`);
  }
  if (strengths.length > 0) {
    recommendations.push(`معرفی دانش‌آموز به المپیاد یا مسابقات علمی در درس سرآمد (${strengths[0].subjectName})`);
  }
  if (recommendations.length === 0) {
    recommendations.push(`ادامه روند منظم مطالعاتی و شرکت مستمر در آزمون‌های دوره‌ای مدرسه`);
  }

  return {
    studentId,
    subjectAnalyses,
    term1ContinuousGpa,
    term1FinalGpa,
    term1OverallGpa,
    term2ContinuousGpa,
    term2FinalGpa,
    term2OverallGpa,
    annualGpa,
    monthlyAverages,
    overallGrowthDelta,
    growthCategory,
    strengths,
    weaknesses,
    highestSubject,
    lowestSubject,
    attendanceCorrelationNote,
    recommendations,
  };
}
