import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Clock, MessageSquare } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { LessonPlan } from '../types';
import { STATUS_LABEL, monthOfDate, normalizeLessonPlan } from '../utils/lessonPlan';
import { PERSIAN_MONTHS, formatShamsiWithWeekday, getActiveAcademicYear, toPersianDigits } from '../utils/persianDate';
import { Modal } from './ui/Modal';
import { LessonPlanView } from './LessonPlanView';

const TONE: Record<LessonPlan['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  submitted: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-blue-50 text-blue-800 border-blue-200',
};

/**
 * نظارت معاونت آموزش بر طرح درس‌های اساتید: فهرست طرح‌های ارسال‌شده (فیلتر ماه و کلاس)،
 * مشاهده‌ی فقط‌خواندنیِ کامل طرح، ثبت بازخورد و تأیید نهایی. (پیش‌نویس‌ها برای معاونت دیده نمی‌شوند.)
 */
export const LessonPlansReview: React.FC = () => {
  const { lessonPlans, classes, reviewLessonPlan, showToast } = useSchool();
  const [month, setMonth] = useState(0);
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<'all' | 'submitted' | 'approved'>('all');
  const [open, setOpen] = useState<LessonPlan | null>(null);
  const [feedback, setFeedback] = useState('');

  const plans = useMemo(
    () => lessonPlans.filter((p) => p.status !== 'draft').sort((a, b) => (a.date < b.date ? 1 : -1)),
    [lessonPlans]
  );
  const shown = plans.filter((p) => (!month || monthOfDate(p.date) === month) && (!classId || p.classId === classId) && (status === 'all' || p.status === status));
  const pending = plans.filter((p) => p.status === 'submitted').length;
  const monthsWithPlans = Array.from(new Set(plans.map((p) => monthOfDate(p.date)).filter(Boolean))).sort((a, b) => ((a + 5) % 12) - ((b + 5) % 12));

  // با هر تغییر رکورد (مثلاً پس از ثبت بازخورد) نسخه‌ی باز در مودال تازه می‌شود
  const live = open ? lessonPlans.find((p) => p.id === open.id) || open : null;
  useEffect(() => { setFeedback(live?.review?.feedback || ''); }, [open?.id]);

  const className = (id: string, fallback?: string) => classes.find((c) => c.id === id)?.name || fallback || '—';

  const submit = (approved: boolean) => {
    if (!live) return;
    if (!approved && !feedback.trim()) return showToast('متن بازخورد را بنویسید.', 'error');
    reviewLessonPlan(live.id, { feedback: feedback.trim(), approved });
    showToast(approved ? 'طرح درس تأیید شد.' : 'بازخورد برای استاد ثبت شد.', 'success');
    setOpen(null);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 shrink-0 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center"><ClipboardCheck className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black text-slate-900">نظارت بر طرح درس اساتید</h2>
          <p className="text-[11px] text-slate-500">سال تحصیلی {toPersianDigits(getActiveAcademicYear())}</p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold whitespace-nowrap">{toPersianDigits(pending)} در انتظار بررسی</span>
      </div>

      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-slate-50/85 backdrop-blur-md space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="ماه" className="h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
            <option value={0}>همه‌ی ماه‌ها</option>
            {monthsWithPlans.map((m) => <option key={m} value={m}>{PERSIAN_MONTHS[m - 1]}</option>)}
          </select>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} aria-label="کلاس" className="h-11 bg-white border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
            <option value="">همه‌ی کلاس‌ها</option>
            {classes.filter((c) => !c.isWorkshop).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([['all', 'همه'], ['submitted', 'در انتظار بررسی'], ['approved', 'تأییدشده']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setStatus(k)} className={`h-10 px-3.5 shrink-0 rounded-full border text-xs font-bold whitespace-nowrap cursor-pointer ${status === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>{l}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-sm text-slate-500">طرح درسی با این فیلترها یافت نشد.</div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setOpen(p)} className="w-full text-right bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition p-3.5 space-y-2 cursor-pointer">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-slate-900 truncate">{p.teacherName || 'استاد'}</div>
                    <div className="text-xs text-slate-600 truncate">{p.subject} · {className(p.classId, p.className)}</div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${TONE[p.status]}`}>
                    {p.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {p.status === 'approved' ? 'تأییدشده' : STATUS_LABEL[p.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-700 line-clamp-2 leading-6">{p.mainTopic}{p.subTopic ? ` — ${p.subTopic}` : ''}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{toPersianDigits(formatShamsiWithWeekday(p.date))}</span>
                  {p.review?.feedback && <span className="inline-flex items-center gap-1 text-blue-600 font-bold"><MessageSquare className="w-3.5 h-3.5" /> بازخورد ثبت شده</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={Boolean(live)}
        onClose={() => setOpen(null)}
        title={live ? `${live.teacherName || 'استاد'} — ${live.subject}` : ''}
        subtitle={live ? `${className(live.classId, live.className)} · ${STATUS_LABEL[live.status]}` : ''}
        size="lg"
      >
        {live && (
          <div className="space-y-4" dir="rtl">
            <LessonPlanView plan={normalizeLessonPlan(live)} tone="blue" />
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-2.5">
              <label htmlFor="lp-feedback" className="text-xs font-black text-blue-900 inline-flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> ثبت نظر و بازخورد اختصاصی</label>
              <textarea id="lp-feedback" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="نکات اصلاحی، پیشنهادها یا تقدیر از استاد…" className="w-full bg-white border border-blue-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-6" />
              {live.review?.reviewedAt && <div className="text-[10px] text-slate-400">آخرین بررسی: {live.review.reviewerName}</div>}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => submit(false)} className="h-12 px-4 rounded-xl bg-white border border-blue-300 text-blue-800 text-sm font-bold cursor-pointer">ثبت بازخورد</button>
                <button type="button" onClick={() => submit(true)} className="h-12 flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"><CheckCircle2 className="w-4 h-4" /> تأیید طرح درس</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
