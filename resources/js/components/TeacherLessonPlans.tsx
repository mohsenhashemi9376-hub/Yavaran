import React, { useMemo, useState } from 'react';
import { BookOpenCheck, Eye, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { LessonPlan, SchoolClass } from '../types';
import { STATUS_LABEL, emptyLessonPlan, normalizeLessonPlan } from '../utils/lessonPlan';
import { formatShamsiWithWeekday, getActiveAcademicYear, toPersianDigits } from '../utils/persianDate';
import { Modal } from './ui/Modal';
import { LessonPlanView } from './LessonPlanView';
import { LessonPlanWizard } from './LessonPlanWizard';

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

  const mine = useMemo(
    () => lessonPlans.filter((p) => p.teacherId === currentUser.id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [lessonPlans, currentUser.id]
  );
  const shown = filter === 'all' ? mine : mine.filter((p) => p.status === filter);
  const count = (s: LessonPlan['status']) => mine.filter((p) => p.status === s).length;

  const classOf = (id: string) => classes.find((c) => c.id === id);

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

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.subject || 'طرح درس'} subtitle={viewing ? STATUS_LABEL[viewing.status] : ''} size="lg">
        {viewing && <LessonPlanView plan={normalizeLessonPlan(viewing)} tone="emerald" />}
      </Modal>
    </div>
  );
};
