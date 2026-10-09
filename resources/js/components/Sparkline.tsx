import React, { useId } from 'react';

/** نمودار خطی کوچک (بدون وابستگی): روند چند روز اخیر در یک نگاه */
export const Sparkline: React.FC<{ values: number[]; color?: string; height?: number }> = ({ values, color = '#0f766e', height = 44 }) => {
  const id = useId();
  const w = 120;
  const h = height;
  const pad = 3;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  // راست‌به‌چپ: جدیدترین روز سمت چپ؛ روند را از راست (قدیمی) به چپ (جدید) می‌کشیم
  const pts = values.map((v, i) => [w - pad - i * step, h - pad - (v / max) * (h - pad * 2)] as const).reverse();
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="روند چند روز اخیر">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={`M${last[0]},${last[1]} h0.01`} stroke={color} strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export const TrendTile: React.FC<{ label: string; total: number | string; hint: string; values: number[]; color: string }> = ({ label, total, hint, values, color }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className="text-[11px] text-slate-400">{hint}</span>
    </div>
    <div className="text-2xl font-black text-slate-900 mt-1">{total}</div>
    <div className="mt-2"><Sparkline values={values} color={color} /></div>
  </div>
);
