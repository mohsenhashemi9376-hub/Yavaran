import React, { useEffect, useState } from 'react';
import { ArrowRight, Brain, CheckCircle2, ChevronLeft, CircleDashed, Lock, Plus, Printer, ShieldAlert, Users } from 'lucide-react';
import { DossierSectionEntry, NurturingSectionKey, Student, StudentNurturingDossier } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';

export interface DossierSectionConfig {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgLight: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
}

interface Props {
  student: Student;
  className: string;
  dossier: StudentNurturingDossier;
  configs: Record<NurturingSectionKey, DossierSectionConfig>;
  complete: boolean;
  onBack: () => void;
  onOpenSection: (key: NurturingSectionKey) => void;
  /** محتوای اضافه (مثل ارجاع‌ها) زیر کارت مشخصات */
  children?: React.ReactNode;
}

const countOf = (d: StudentNurturingDossier, key: NurturingSectionKey): number => {
  if (key === 'temperament') return d.temperament?.entries?.length || 0;
  if (key === 'nurturingSummary') return d.nurturingSummary?.entries?.length || 0;
  return ((d[key] as DossierSectionEntry[]) || []).length;
};

const previewOf = (d: StudentNurturingDossier, key: NurturingSectionKey): string => {
  if (key === 'temperament') return d.temperament?.dominantType ? `طبع: ${d.temperament.dominantType}` : 'طبع ثبت نشده است';
  if (key === 'nurturingSummary') return d.nurturingSummary?.overallSummary || 'جمعبندی کلی ثبت نشده است';
  return ((d[key] as DossierSectionEntry[]) || [])[0]?.title || 'یادداشتی درج نشده است';
};

const countLabel = (n: number) => (n > 0 ? `${toPersianDigits(n)} یادداشت` : '۰ یادداشت');

/**
 * نمای جزئیات پرونده تربیتی دانش‌آموز (موبایل‌محور):
 * نوار باریک چسبان، کارت مشخصات بدون شکست نام، دو کارت اصلی (نقاط تفکری / جلسات خصوصی محرمانه)،
 * کارت فشرده‌ی مصاحبه با والدین و سایر بخش‌ها در شبکه‌ی فشرده.
 */
export const StudentDossierDetail: React.FC<Props> = ({ student, className, dossier, configs, complete, onBack, onOpenSection, children }) => {
  // نوار چسبان درست زیر هدر برنامه (که خودش چسبان است) قرار می‌گیرد
  const [top, setTop] = useState(0);
  useEffect(() => {
    const measure = () => setTop(document.querySelector<HTMLElement>('.yv-header')?.offsetHeight || 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const fullName = studentFullName(student);
  const others = (['temperament', 'growthPath', 'lifestyle', 'interviews', 'nurturingSummary'] as NurturingSectionKey[]);

  return (
    <div className="space-y-4 animate-in fade-in" dir="rtl">
      {/* نوار چسبان */}
      <div
        className="sticky z-20 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-slate-50/90 backdrop-blur-md flex items-center gap-2.5"
        style={{ top }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="بازگشت به فهرست دانش‌آموزان"
          className="h-11 w-11 shrink-0 rounded-xl bg-white border border-slate-200 shadow-xs text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h2 className="flex-1 min-w-0 text-sm sm:text-base font-black text-slate-900 truncate">پرونده تربیتی دانش‌آموز</h2>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-11 px-3.5 shrink-0 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>چاپ</span>
        </button>
      </div>

      {/* مشخصات دانش‌آموز */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white text-lg font-black flex items-center justify-center shadow-xs" aria-hidden="true">
            {fullName.trim().charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-black text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis" title={fullName}>{fullName}</h3>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-extrabold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-200 whitespace-nowrap">{className}</span>
              <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 whitespace-nowrap ${complete ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                {complete ? <CheckCircle2 className="w-3 h-3" /> : <CircleDashed className="w-3 h-3" />}
                {complete ? 'پرونده کامل' : 'پرونده ناقص'}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-slate-500">
          <span className="whitespace-nowrap">کد ملی: <b className="font-bold text-slate-800 tabular-nums">{toPersianDigits(student.nationalId || '—')}</b></span>
          <span className="whitespace-nowrap">کد دانش‌آموزی: <b className="font-bold text-slate-800 tabular-nums">{toPersianDigits(student.studentCode || '—')}</b></span>
        </div>
      </div>

      {children}

      {/* نقاط تفکری */}
      {(() => {
        const cfg = configs.thinkingPoints;
        const n = countOf(dossier, 'thinkingPoints');
        return (
          <section className="rounded-2xl border border-indigo-200/70 bg-indigo-50/50 p-4 space-y-3 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 shrink-0 rounded-xl bg-white/80 border border-indigo-200 text-indigo-600 flex items-center justify-center"><Brain className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-black text-slate-900">{cfg.title}</h3>
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 whitespace-nowrap">{countLabel(n)}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">طرز فکر، باورها و پرسش‌های فکری دانش‌آموز</p>
              </div>
            </div>
            <button type="button" onClick={() => onOpenSection('thinkingPoints')} className="w-full min-h-12 rounded-xl bg-white/70 border border-indigo-200/70 px-3 flex items-center justify-between gap-2 text-right cursor-pointer hover:bg-white">
              <span className="text-xs font-medium text-slate-700 truncate">{previewOf(dossier, 'thinkingPoints')}</span>
              <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
            <button type="button" onClick={() => onOpenSection('thinkingPoints')} className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-extrabold shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              ثبت یادداشت تفکری
            </button>
          </section>
        );
      })()}

      {/* جلسات خصوصی (محرمانه) */}
      {(() => {
        const n = countOf(dossier, 'privateSessions');
        return (
          <section className="rounded-2xl border border-rose-200/70 bg-rose-50/50 p-4 space-y-3 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 shrink-0 rounded-xl bg-white/80 border border-rose-200 text-rose-600 flex items-center justify-center"><Lock className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-black text-slate-900">جلسات خصوصی و خلوت‌های تربیتی</h3>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-600 text-white inline-flex items-center gap-1 whitespace-nowrap"><ShieldAlert className="w-3 h-3" />محرمانه</span>
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 whitespace-nowrap">{n > 0 ? `${toPersianDigits(n)} جلسه` : '۰ جلسه'}</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-5">مشاوره‌های فردی، دغدغه‌ها و رازهای شخصی؛ فقط برای افراد مجاز.</p>
            <button type="button" onClick={() => onOpenSection('privateSessions')} className="w-full min-h-12 rounded-xl bg-white/70 border border-rose-200/70 px-3 flex items-center justify-between gap-2 text-right cursor-pointer hover:bg-white">
              <span className="text-xs font-medium text-slate-700 truncate">{previewOf(dossier, 'privateSessions')}</span>
              <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
            <button type="button" onClick={() => onOpenSection('privateSessions')} className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-sm font-extrabold shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              ثبت جلسه جدید
            </button>
          </section>
        );
      })()}

      {/* مصاحبه و ارتباط با والدین */}
      {(() => {
        const n = countOf(dossier, 'parentInterviews');
        return (
          <button
            type="button"
            onClick={() => onOpenSection('parentInterviews')}
            className="w-full rounded-2xl border border-emerald-200/70 bg-emerald-50/50 p-4 flex items-center gap-3 text-right shadow-xs cursor-pointer hover:bg-emerald-50"
          >
            <span className="w-11 h-11 shrink-0 rounded-xl bg-white/80 border border-emerald-200 text-emerald-700 flex items-center justify-center"><Users className="w-5 h-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">مصاحبه و ارتباط با والدین</span>
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap">{n > 0 ? `${toPersianDigits(n)} جلسه` : '۰ جلسه'}</span>
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5 truncate">{previewOf(dossier, 'parentInterviews')}</span>
            </span>
            <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        );
      })()}

      {/* سایر بخش‌ها */}
      <div>
        <h3 className="text-xs font-black text-slate-500 mb-2 px-1">سایر بخش‌های پرونده</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          {others.map((key) => {
            const cfg = configs[key];
            const Icon = cfg.icon;
            const n = countOf(dossier, key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onOpenSection(key)}
                className={`min-h-[5.5rem] rounded-2xl border ${cfg.borderColor} bg-white p-3 text-right flex flex-col gap-2 shadow-xs hover:shadow-md transition cursor-pointer`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={`w-9 h-9 rounded-xl ${cfg.bgLight} border ${cfg.borderColor} ${cfg.color} flex items-center justify-center`}><Icon className="w-4 h-4" /></span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText} whitespace-nowrap`}>{n > 0 ? toPersianDigits(n) : 'خالی'}</span>
                </span>
                <span className="text-xs font-extrabold text-slate-900 leading-5">{cfg.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
