import React from 'react';
import { Filter } from 'lucide-react';
import { SCORE_BAND_STYLE, ScoreBand } from '../utils/gradePeriods';

export const BAND_CYCLE: (ScoreBand | undefined)[] = [undefined, 'excellent', 'good', 'weak'];

/** حالت بعدیِ فیلتر ستون: همه ← ممتازین ← متوسط ← ضعیف ← همه */
export const nextBand = (band?: ScoreBand): ScoreBand | undefined => BAND_CYCLE[(BAND_CYCLE.indexOf(band) + 1) % BAND_CYCLE.length];

interface Props {
  title: string;
  band?: ScoreBand;
  onCycle: () => void;
}

/** عنوان ستون نمرات با فیلتر ممتاز (۱۷ به بالا) / متوسط (۱۰ تا ۱۷) / ضعیف (زیر ۱۰) */
export const ScoreColumnHeader: React.FC<Props> = ({ title, band, onCycle }) => (
  <th className="px-2 py-2 text-center align-bottom min-w-24">
    <button
      type="button"
      onClick={onCycle}
      aria-label={`فیلتر ستون ${title}`}
      className={`w-full min-h-[44px] px-2 py-1.5 rounded-xl border text-[11px] font-extrabold leading-4 cursor-pointer transition flex flex-col items-center justify-center gap-0.5 ${
        band ? SCORE_BAND_STYLE[band].chip : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span>{title}</span>
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold opacity-80">
        <Filter className="w-3 h-3" />
        {band ? SCORE_BAND_STYLE[band].label.split(' ')[0] : 'همه'}
      </span>
    </button>
  </th>
);
