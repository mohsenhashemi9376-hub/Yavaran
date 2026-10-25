import React, { useMemo, useState } from 'react';
import { BookOpenCheck, Eye, History, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { LessonPlan, SchoolClass } from '../types';
import { STATUS_LABEL, emptyLessonPlan, normalizeLessonPlan } from '../utils/lessonPlan';
import { formatShamsiWithWeekday, getActiveAcademicYear, getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import { Modal } from './ui/Modal';
import { LessonPlanView } from './LessonPlanView';
import { LessonPlanWizard } from './LessonPlanWizard';
import { LessonPlanReflectionModal } from './LessonPlanReflectionModal';

const STATUS_TONE: Record<LessonPlan['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  submitted: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

interface Props {
  classes: SchoolClass[];
  subjectNames: string[];
}

/** طرح درس روزانه در پنل دبیر: فهرست طرح‌های خود دبیر + ویزارد ۴ مرحله‌ای */
export const TeacherLessonPlans: React.FC<Props> = ({ classes, subjectNames }) => {
  const { lessonPlans, saveLessonPlan, deleteLessonPlan, currentUser, students, showConfirm, showToast } = useSchool();
  const [editing, setEditing] = useState<LessonPlan | null>(null);
  const [viewing, setViewing] = useState<LessonPlan | null>(null);
  const [filter, setFilter] = useState<'all' | LessonPlan['status']>('all');
  const [tab, setTab] = useState<'plans' | 'history'>('plans');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [reflecting, setReflecting] = useState<LessonPlan | null>(null);

  const mine = useMemo(
    () => lessonPlans.filter((p) => p.teacherId === currentUser.id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [lessonPlans, currentUser.id]
  );
  const shown = filter === 'all' ? mine : mine.filter((p) => p.status === filter);
  const count = (s: LessonPlan['status']) => mine.filter((p) => p.status === s).length;

  const classOf = (id: string) => classes.find((c) => c.id === id);

  // سوابق: طرح‌هایی که تاریخ‌شان رسیده یا گذشته است (تجربه‌نگاری پس از کلاس)
  const today = getTodayShamsi().formattedDate;
  const past = useMemo(() => mine.filter((p) => p.date <= today), [mine, today]);
  const isReflected = (p: LessonPlan) => Boolean(p.reflection?.trim() || p.reflectionTags?.length);
  const pendingCount = past.filter((p) => !isReflected(p)).length;
  const history = historyFilter === 'all' ? past : past.filter((p) => (historyFilter === 'done' ? isReflected(p) : !isReflected(p)));

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 shrink-0 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><BookOpenCheck className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-black text-slate-900">طرح درس روزانه</h2>
          <p className="text-[11px] text-slate-500">سال تحصیلی {toPersianDigits(getActiveAcademicYear())}</p>
        </div>
        <button type="button" onClick={() => setEditing(emptyLessonPlan(currentUser.id))} className="h-11 px-4 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-sm">
          <Plus className="w-4 h-4" /> طرح جدید
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="tablist" aria-label="بخش‌های طرح درس">
        <button type="button" role="tab" aria-selected={tab === 'plans'} onClick={() => setTab('plans')} className={`!min-h-0 h-11 rounded-xl text-xs font-extrabold cursor-pointer ${tab === 'plans' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>طرح‌های من</button>
        <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')} className={`!min-h-0 h-11 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer ${tab === 'history' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>
          <History className="w-4 h-4" /> سوابق طرح درس‌های من
          {pendingCount > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-black grid place-items-center">{toPersianDigits(pendingCount)}</span>}
        </button>
      </div>

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {([['all', `همه (${toPersianDigits(past.length)})`], ['pending', `منتظر تجربه‌نگاری (${toPersianDigits(pendingCount)})`], ['done', `ثبت‌شده (${toPersianDigits(past.length - pendingCount)})`]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setHistoryFilter(k)} className={`h-10 px-3.5 shrink-0 rounded-full border text-xs font-bold whitespace-nowrap cursor-pointer ${historyFilter === k ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>{label}</button>
            ))}
          </div>
          {history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-sm text-slate-500">
              {past.length === 0 ? 'هنوز طرح درسی با تاریخ گذشته ندارید.' : 'موردی با این وضعیت نیست.'}
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {history.map((p) => (
                <li key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-extrabold text-slate-900 truncate">{p.subject || 'بدون نام درس'}</h3>
                      <p className="text-xs text-slate-600 truncate">{p.mainTopic}{p.subTopic ? ` — ${p.subTopic}` : ''}</p>
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-bold ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{classOf(p.classId)?.name || p.className} · {toPersianDigits(formatShamsiWithWeekday(p.date))}</div>
                  {isReflected(p) && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-1.5">
                      {p.reflectionTags && p.reflectionTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">{p.reflectionTags.map((t) => <span key={t} className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">{t}</span>)}</div>
                      )}
                      {p.reflection?.trim() && <p className="text-xs text-slate-700 leading-6 line-clamp-3 whitespace-pre-wrap">{p.reflection}</p>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button type="button" onClick={() => setViewing(p)} className="h-10 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"><Eye className="w-4 h-4" /> مشاهده</button>
                    <button type="button" onClick={() => setReflecting(normalizeLessonPlan(p))} className={`h-10 px-3 flex-1 rounded-xl border text-xs font-extrabold cursor-pointer ${isReflected(p) ? 'bg-white border-slate-200 text-slate-700' : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'}`}>
                      {isReflected(p) ? '📝 ویرایش تجربه‌نگاری' : '📝 ثبت تجربه‌نگاری (پس از کلاس)'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'plans' && (<>
      <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([['all', `همه (${toPersianDigits(mine.length)})`], ['draft', `پیش‌نویس (${toPersianDigits(count('draft'))})`], ['submitted', `در انتظار بررسی (${toPersianDigits(count('submitted'))})`], ['approved', `تأییدشده (${toPersianDigits(count('approved'))})`]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`h-10 px-3.5 shrink-0 rounded-full border text-xs font-bold whitespace-nowrap cursor-pointer ${filter === k ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>{label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-12 text-center text-sm text-slate-500">
          {mine.length === 0 ? 'هنوز طرح درسی ثبت نکرده‌اید. با «طرح جدید» شروع کنید.' : 'طرحی با این وضعیت نیست.'}
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {shown.map((p) => (
            <li key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-extrabold text-slate-900 truncate">{p.subject || 'بدون نام درس'}</h3>
                  <p className="text-xs text-slate-600 truncate">{p.mainTopic}{p.subTopic ? ` — ${p.subTopic}` : ''}</p>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-bold ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
              </div>
              <div className="text-[11px] text-slate-500">{classOf(p.classId)?.name || p.className} · {toPersianDigits(formatShamsiWithWeekday(p.date))}</div>
              {p.review?.feedback && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 text-xs text-blue-900 leading-6 flex gap-2">
                  <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
                  <div><b>بازخورد معاونت: </b>{p.review.feedback}</div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={() => setViewing(p)} className="h-10 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"><Eye className="w-4 h-4" /> مشاهده</button>
                <button type="button" onClick={() => setEditing(normalizeLessonPlan(p))} className="h-10 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"><Pencil className="w-4 h-4" /> ویرایش</button>
                {p.status !== 'approved' && (
                  <button type="button" aria-label="حذف طرح" onClick={() => showConfirm({ title: 'حذف طرح درس', message: 'این طرح درس حذف شود؟', confirmLabel: 'حذف', cancelLabel: 'انصراف', isDangerous: true, onConfirm: () => deleteLessonPlan(p.id) })} className="mr-auto w-10 h-10 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4 mx-auto" /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      </>)}

      {editing && (
        <LessonPlanWizard
          initial={editing}
          classes={classes}
          subjectNames={subjectNames}
          studentCountOf={(id) => students.filter((s) => s.classId === id).length}
          onClose={() => setEditing(null)}
          onSave={(plan) => {
            saveLessonPlan(plan);
            setEditing(null);
            showToast(plan.status === 'draft' ? 'پیش‌نویس طرح درس ذخیره شد.' : 'طرح درس برای معاونت آموزش ارسال شد.', 'success');
          }}
        />
      )}

      <LessonPlanReflectionModal
        plan={reflecting}
        onClose={() => setReflecting(null)}
        onSave={(plan) => {
          saveLessonPlan(plan);
          setReflecting(null);
          showToast('تجربه‌نگاری ثبت شد.', 'success');
        }}
      />

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.subject || 'طرح درس'} subtitle={viewing ? STATUS_LABEL[viewing.status] : ''} size="lg">
        {viewing && <LessonPlanView plan={normalizeLessonPlan(viewing)} tone="emerald" />}
      </Modal>
    </div>
  );
};
