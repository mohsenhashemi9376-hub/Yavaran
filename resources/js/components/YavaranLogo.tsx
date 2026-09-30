import React from 'react';

export interface YavaranLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  alt?: string;
  useImageTag?: boolean;
}

export const YavaranLogo: React.FC<YavaranLogoProps> = ({ 
  className = '', 
  size = 'md',
  showText = false,
  alt = 'لوگوی مجتمع تربیتی آموزشی یاوران ولایت',
  useImageTag = false
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10 sm:w-11 sm:h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  return (
    <div className={`inline-flex items-center gap-3 shrink-0 ${className}`}>
      {/* Official Geometric Emblem - Pure Transparent Background, Object-Fit Contain */}
      <div 
        className={`relative ${sizeClasses[size]} shrink-0 flex items-center justify-center select-none`}
        title={alt}
        role="img"
        aria-label={alt}
      >
        {useImageTag ? (
          <img
            src="/yavaran-logo.svg"
            alt={alt}
            className="w-full h-full object-contain filter drop-shadow-xs"
            referrerPolicy="no-referrer"
          />
        ) : (
          <svg
            viewBox="0 0 320 320"
            className="w-full h-full object-contain filter drop-shadow-xs"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Authentic Yavaran Velayat Emerald Gradients */}
              <linearGradient id="yavaranOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#157c62" />
                <stop offset="50%" stopColor="#10634e" />
                <stop offset="100%" stopColor="#0b4838" />
              </linearGradient>

              <linearGradient id="yavaranMiddleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#198a6d" />
                <stop offset="60%" stopColor="#126b55" />
                <stop offset="100%" stopColor="#0a4435" />
              </linearGradient>

              <linearGradient id="yavaranCoreGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0f5c47" />
                <stop offset="100%" stopColor="#23a07e" />
              </linearGradient>

              {/* Islamic Geometric Girih Pattern (Shamseh & Arabesque Motif) */}
              <pattern id="girihPattern" width="36" height="36" patternUnits="userSpaceOnUse">
                <path d="M 18 0 L 36 18 L 18 36 L 0 18 Z" stroke="#ffffff" strokeWidth="0.8" strokeOpacity="0.14" fill="none" />
                <circle cx="18" cy="18" r="9" stroke="#ffffff" strokeWidth="0.6" strokeOpacity="0.11" fill="none" />
                <path d="M 0 0 L 36 36 M 36 0 L 0 36" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.08" />
              </pattern>

              <filter id="emblemShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#062e24" floodOpacity="0.22" />
              </filter>
            </defs>

            {/* Layer 1: Outermost Toranj / Pointed Medallion with subtle shadow */}
            <g filter="url(#emblemShadow)">
              <path
                d="M 160 20 
                   C 208 48, 256 94, 276 148 
                   C 256 202, 208 248, 160 276 
                   C 112 248, 64 202, 44 148 
                   C 64 94, 112 48, 160 20 Z"
                fill="url(#yavaranOuterGrad)"
              />

              {/* Islamic Girih Overlay Pattern inside the crest */}
              <path
                d="M 160 20 
                   C 208 48, 256 94, 276 148 
                   C 256 202, 208 248, 160 276 
                   C 112 248, 64 202, 44 148 
                   C 64 94, 112 48, 160 20 Z"
                fill="url(#girihPattern)"
              />

              {/* Layer 2: White Bold Dividing Arch (Contour Stroke) */}
              <path
                d="M 160 56 
                   C 198 84, 234 118, 248 156 
                   C 232 194, 198 226, 160 252 
                   C 122 226, 88 194, 72 156 
                   C 86 118, 122 84, 160 56 Z"
                stroke="#ffffff"
                strokeWidth="11"
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              />

              {/* Layer 3: Middle Emerald Arch */}
              <path
                d="M 160 70 
                   C 192 96, 222 126, 234 158 
                   C 220 190, 192 216, 160 240 
                   C 128 216, 100 190, 86 158 
                   C 98 126, 128 96, 160 70 Z"
                fill="url(#yavaranMiddleGrad)"
              />

              {/* Layer 4: Inner White Accent Contour Line */}
              <path
                d="M 160 102 
                   C 182 124, 204 146, 212 170 
                   C 202 194, 182 212, 160 228 
                   C 138 212, 118 194, 108 170 
                   C 116 146, 138 124, 160 102 Z"
                stroke="#ffffff"
                strokeWidth="4.5"
                strokeOpacity="0.92"
                strokeLinejoin="round"
                fill="none"
              />

              {/* Layer 5: Central Core Bud (Emerald Gradient) */}
              <path
                d="M 160 114 
                   C 178 134, 196 154, 202 174 
                   C 194 194, 178 208, 160 220 
                   C 142 208, 126 194, 118 174 
                   C 124 154, 142 134, 160 114 Z"
                fill="url(#yavaranCoreGrad)"
              />

              {/* Layer 6: Central Core Eye Aperture */}
              <ellipse cx="160" cy="172" rx="9" ry="15" fill="#ffffff" />
            </g>
          </svg>
        )}
      </div>

      {/* Optional Typography if requested */}
      {showText && (
        <div className="text-right">
          <div className="text-[10px] text-emerald-800 font-semibold tracking-wide">
            مجتمع تربیتی آموزشی
          </div>
          <div className="text-base font-black text-slate-900 leading-tight">
            یاوران ولایت
          </div>
          <div className="text-[9px] text-slate-500 font-mono">
            تأسیس ۱۳۹۱
          </div>
        </div>
      )}
    </div>
  );
};
