import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine,
  Area,
  AreaChart
} from 'recharts';
import { StudentAcademicGrade, MONTHLY_EVALUATION_PERIODS, MonthlyPeriodKey } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { analyzeSubjectGrade } from '../utils/academicAnalysis';
import { TrendingUp, TrendingDown, Minus, Filter, Sparkles, Award, Calendar, BookOpen } from 'lucide-react';

interface StudentGrowthChartProps {
  grades: StudentAcademicGrade[];
  studentName: string;
}

const OFFICIAL_4TERM_LABELS = [
  { key: 'c1', label: 'مستمر اول' },
  { key: 'f1', label: 'پایانی ترم ۱' },
  { key: 'c2', label: 'مستمر دوم' },
  { key: 'f2', label: 'پایانی ترم ۲' },
];

const SUBJECT_COLORS = [
  '#4f46e5', // Indigo
  '#059669', // Emerald
  '#d97706', // Amber
  '#dc2626', // Red
  '#7c3aed', // Purple
  '#0284c7', // Sky
  '#db2777', // Pink
  '#0d9488', // Teal
  '#475569', // Slate
];

export const StudentGrowthChart: React.FC<StudentGrowthChartProps> = ({ grades, studentName }) => {
  const [timelineMode, setTimelineMode] = useState<'monthly' | 'official_4terms'>('monthly');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [chartType, setChartType] = useState<'line' | 'area'>('line');

  if (!grades || grades.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-500 font-medium">
          هنوز نمره‌ای برای این دانش‌آموز ثبت نشده است.
        </p>
      </div>
    );
  }

  // Choose labels based on timelineMode
  const activePeriods = timelineMode === 'monthly'
    ? MONTHLY_EVALUATION_PERIODS.map(p => ({ key: p.key, label: p.shortLabel, fullLabel: p.label }))
    : OFFICIAL_4TERM_LABELS.map(p => ({ key: p.key, label: p.label, fullLabel: p.label }));

  // Build chart dataset
  const chartData = activePeriods.map((period) => {
    const point: Record<string, any> = {
      period: period.label,
      fullPeriod: period.fullLabel,
      key: period.key,
    };

    const validScores: number[] = [];

    grades.forEach((g) => {
      let val: number | undefined = undefined;
      if (timelineMode === 'monthly') {
        val = g[period.key as MonthlyPeriodKey];
      } else {
        if (period.key === 'c1') val = g.term1Continuous;
        if (period.key === 'f1') val = g.term1Final;
        if (period.key === 'c2') val = g.term2Continuous;
        if (period.key === 'f2') val = g.term2Final;
      }

      point[g.subjectId] = val !== undefined ? val : null;
      point[`${g.subjectId}_name`] = g.subjectName;

      if (val !== undefined && !isNaN(val)) {
        validScores.push(val);
      }
    });

    point['overallAverage'] = validScores.length > 0
      ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 100) / 100
      : null;

    return point;
  });

  const selectedSubject = grades.find((g) => g.subjectId === selectedSubjectId);
  const selectedAnalysis = selectedSubject ? analyzeSubjectGrade(selectedSubject) : null;

  // Single Subject Data for Area or Focused Line
  const singleSubjectData = activePeriods.map((p) => {
    let val: number | null = null;
    if (selectedSubject) {
      if (timelineMode === 'monthly') {
        val = selectedSubject[p.key as MonthlyPeriodKey] ?? null;
      } else {
        if (p.key === 'c1') val = selectedSubject.term1Continuous ?? null;
        if (p.key === 'f1') val = selectedSubject.term1Final ?? null;
        if (p.key === 'c2') val = selectedSubject.term2Continuous ?? null;
        if (p.key === 'f2') val = selectedSubject.term2Final ?? null;
      }
    }
    return {
      period: p.label,
      fullPeriod: p.fullLabel,
      score: val,
    };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs font-['Vazirmatn',sans-serif]">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              تحلیل و نمودار روند نمرات {studentName}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {timelineMode === 'monthly' 
              ? 'نمودار نمرات مستمر ۸ ماهه (مهر، آبان، آذر، ترم ۱، بهمن، اسفند، فروردین، اردیبهشت)'
              : 'روند رسمی ۴ نوبته (مستمر اول ← پایانی اول ← مستمر دوم ← پایانی دوم)'}
          </p>
        </div>

        {/* Filters & Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
            <button
              onClick={() => setTimelineMode('monthly')}
              className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                timelineMode === 'monthly' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>مستمر ماهانه (۸ ماه)</span>
            </button>
            <button
              onClick={() => setTimelineMode('official_4terms')}
              className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                timelineMode === 'official_4terms' ? 'bg-white text-indigo-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>۴ نوبته سالانه</span>
            </button>
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <Filter className="w-3.5 h-3.5 text-slate-500 mr-1" />
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">📊 مقایسه تمام دروس</option>
              {grades.map((g) => (
                <option key={g.subjectId} value={g.subjectId}>
                  {g.subjectName} (ضریب {toPersianDigits(g.coefficient)})
                </option>
              ))}
            </select>
          </div>

          {/* Line/Area switch */}
          {selectedSubjectId !== 'all' && (
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setChartType('line')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  chartType === 'line' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                خطی
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  chartType === 'area' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                مساحتی
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Growth Metric Highlight for Selected Subject */}
      {selectedAnalysis && (
        <div className="my-3 p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-900">{selectedAnalysis.subjectName}:</span>
            <span className="text-slate-600">
              نمره سالانه: <b className="text-slate-900 font-mono">{toPersianDigits(selectedAnalysis.annualScore ?? '-')}</b>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedAnalysis.growthDelta !== undefined && (
              <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full ${
                selectedAnalysis.growthDelta > 0 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : selectedAnalysis.growthDelta < 0 
                  ? 'bg-rose-100 text-rose-800' 
                  : 'bg-slate-200 text-slate-800'
              }`}>
                {selectedAnalysis.growthDelta > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : selectedAnalysis.growthDelta < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                <span>
                  {selectedAnalysis.growthDelta > 0 ? '+' : ''}
                  {toPersianDigits(selectedAnalysis.growthDelta)} نمره رشد ترمی
                </span>
              </span>
            )}

            <span className={`px-2 py-0.5 rounded-full font-bold ${
              selectedAnalysis.passStatus === 'passed'
                ? 'bg-emerald-100 text-emerald-800'
                : selectedAnalysis.passStatus === 'conditional'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-rose-100 text-rose-800'
            }`}>
              {selectedAnalysis.passStatus === 'passed' ? 'قبول قطعی' : selectedAnalysis.passStatus === 'conditional' ? 'تبصره' : 'نیاز به تلاش'}
            </span>
          </div>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="h-64 sm:h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          {selectedSubjectId === 'all' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="period" 
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <YAxis 
                domain={[0, 20]} 
                ticks={[0, 5, 10, 15, 20]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(val) => toPersianDigits(val)}
              />
              <Tooltip 
                formatter={(val: any, name: string) => {
                  if (name === 'overallAverage') {
                    return [toPersianDigits(val), 'میانگین کل دروس'];
                  }
                  const subj = grades.find((g) => g.subjectId === name);
                  return [toPersianDigits(val), subj ? subj.subjectName : name];
                }}
                labelFormatter={(label, payload) => {
                  const pt = payload?.[0]?.payload;
                  return pt?.fullPeriod || label;
                }}
                labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'حد قبولی (۱۰)', position: 'insideTopLeft', fill: '#ef4444', fontSize: 10 }} />
              
              {/* Overall Average dashed Line */}
              <Line
                type="monotone"
                dataKey="overallAverage"
                name="overallAverage"
                stroke="#0f172a"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                dot={{ r: 4, fill: '#0f172a' }}
              />

              {/* Subject Lines */}
              {grades.map((g, idx) => (
                <Line
                  key={g.subjectId}
                  type="monotone"
                  dataKey={g.subjectId}
                  name={g.subjectId}
                  stroke={SUBJECT_COLORS[idx % SUBJECT_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={singleSubjectData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis 
                domain={[0, 20]} 
                ticks={[0, 5, 10, 15, 20]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(val) => toPersianDigits(val)}
              />
              <Tooltip 
                formatter={(val: any) => [toPersianDigits(val), 'نمره']}
                labelFormatter={(label, payload) => {
                  const pt = payload?.[0]?.payload;
                  return pt?.fullPeriod || label;
                }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'حد نصاب قبولی (۱۰)', position: 'insideTopLeft', fill: '#ef4444', fontSize: 10 }} />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="#4f46e5" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorScore)" 
                dot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#ffffff' }}
                connectNulls
              />
            </AreaChart>
          ) : (
            <LineChart data={singleSubjectData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis 
                domain={[0, 20]} 
                ticks={[0, 5, 10, 15, 20]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(val) => toPersianDigits(val)}
              />
              <Tooltip 
                formatter={(val: any) => [toPersianDigits(val), 'نمره']}
                labelFormatter={(label, payload) => {
                  const pt = payload?.[0]?.payload;
                  return pt?.fullPeriod || label;
                }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'حد قبولی (۱۰)', position: 'insideTopLeft', fill: '#ef4444', fontSize: 10 }} />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#4f46e5" 
                strokeWidth={3}
                dot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 7 }}
                connectNulls
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend Badges */}
      {selectedSubjectId === 'all' && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500 ml-1">راهنمای دروس:</span>
          <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900"></span>
            <span>میانگین کل دوره</span>
          </div>
          {grades.map((g, idx) => (
            <button
              key={g.subjectId}
              onClick={() => setSelectedSubjectId(g.subjectId)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-slate-100 transition cursor-pointer text-slate-700"
            >
              <span 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: SUBJECT_COLORS[idx % SUBJECT_COLORS.length] }}
              />
              <span>{g.subjectName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
