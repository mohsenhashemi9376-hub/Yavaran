import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, ListPlus, MessageSquareText, PencilLine, PhoneCall, Undo2 } from 'lucide-react';
import { AcademicFollowUpStatus, Student } from '../types';
import { FollowUpReason } from '../utils/academicFollowUp';
import { scorePillClass } from '../utils/gradePeriods';
import { toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { Modal } from './ui';
import { parentPhoneOf } from './ParentPhoneButton';

export interface FollowUpTableItem {
  student: Student;
  className: string;
  gpa?: number;
  priority: number;
  followUps: FollowUpReason[];
  followRecord?: { status?: AcademicFollowUpStatus; note?: string | null; updatedBy?: string };
}

interface Props {
  items: FollowUpTableItem[];
  onOpenReportCard: (student: Student) => void;
  onSetFollowUp: (student: Student, patch: { status?: AcademicFollowUpStatus; note?: string }) => void;
  /** شناسه‌ی رکورد لیست خاکستری این ماه (در صورت ارسال‌شده بودن) */
  greySentId: (student: Student) => string | undefined;
  onSendGrey: (item: FollowUpTableItem) => void;
  onWithdrawGrey: (id: string) => void;
}

const STATUS: Record<AcademicFollowUpStatus, { label: string; cls: string }> = {
  open: { label: 'پیگیری نشده', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_progress: { label: 'در حال بررسی', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  called_parent: { label: 'تماس با ولی', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  resolved: { label: 'حل شد', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

/** سبز بالای ۱۴، زرد ۱۲ تا ۱۴، قرمز زیر ۱۲ */
const gpaTone = (g?: number) =>
  g === undefined ? 'bg-slate-100/70 border-slate-200 text-slate-400'
    : g > 14 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : g >= 12 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';

const phoneFmt = (p: string) => p.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3');
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}‌${parts[parts.length - 1][0]}` : parts[0]?.[0] || '؟';
};

const priorityBadge = (p: number) => (p >= 4 ? ['فوری', 'bg-rose-50 text-rose-700 border-rose-200'] : p === 3 ? ['مهم', 'bg-orange-50 text-orange-700 border-orange-200'] : ['توجه', 'bg-amber-50 text-amber-700 border-amber-200']);

/** جدول «دانش‌آموزان نیازمند پیگیری»؛ جدول در دسکتاپ/تبلت (اسکرول افقی نرم) و کارت لمسی در موبایل */
export const AcademicFollowUpTable: React.FC<Props> = ({ items, onOpenReportCard, onSetFollowUp, greySentId, onSendGrey, onWithdrawGrey }) => {
  const [noteFor, setNoteFor] = useState<FollowUpTableItem | null>(null);
  const [draft, setDraft] = useState('');

  const openNote = (it: FollowUpTableItem) => { setNoteFor(it); setDraft(it.followRecord?.note ?? ''); };
  const saveNote = () => {
    if (noteFor && draft.trim() !== (noteFor.followRecord?.note ?? '')) onSetFollowUp(noteFor.student, { note: draft.trim() });
    setNoteFor(null);
  };

  const StatusSelect = ({ it }: { it: FollowUpTableItem }) => {
    const v = it.followRecord?.status ?? 'open';
    return (
      <select
        value={v}
        onChange={(e) => onSetFollowUp(it.student, { status: e.target.value as AcademicFollowUpStatus })}
        aria-label={`وضعیت پیگیری ${studentFullName(it.student)}`}
        className={`!min-h-0 h-8 rounded-full border px-3 text-xs font-bold outline-none cursor-pointer whitespace-nowrap ${STATUS[v].cls}`}
      >
        {(Object.keys(STATUS) as AcademicFollowUpStatus[]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
      </select>
    );
  };

  const NoteButton = ({ it }: { it: FollowUpTableItem }) => {
    const has = Boolean(it.followRecord?.note);
    return (
      <button
        type="button"
        onClick={() => openNote(it)}
        className={`!min-h-0 h-8 px-3 rounded-lg border text-xs font-medium whitespace-nowrap cursor-pointer inline-flex items-center gap-1 ${has ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100' : 'border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-700'}`}
      >
        {has ? <MessageSquareText className="w-3.5 h-3.5" /> : <PencilLine className="w-3.5 h-3.5" />}
        {has ? 'نمایش یادداشت' : 'ثبت یادداشت'}
      </button>
    );
  };

  const GreyButton = ({ it }: { it: FollowUpTableItem }) => {
    const id = greySentId(it.student);
    return id ? (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold">✓ در لیست خاکستری</span>
        <button type="button" onClick={() => onWithdrawGrey(id)} className="!min-h-0 text-[11px] font-bold text-rose-600 cursor-pointer">برگرداندن</button>
      </span>
    ) : (
      <button type="button" onClick={() => onSendGrey(it)} className="!min-h-0 h-8 px-3 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-extrabold whitespace-nowrap cursor-pointer">
        ارسال به لیست خاکستری
      </button>
    );
  };

  const Reasons = ({ it }: { it: FollowUpTableItem }) => (
    <div className="flex flex-wrap gap-1.5">
      {it.followUps.map((f, i) => (
        <span key={`${f.kind}-${i}`} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 whitespace-nowrap">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{f.label}: {toPersianDigits(f.detail)}</span>
        </span>
      ))}
    </div>
  );

  const Phone = ({ s, big }: { s: Student; big?: boolean }) => {
    const p = parentPhoneOf(s);
    if (!p) return <span className="text-slate-300">—</span>;
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <a href={`tel:${p}`} title="تماس با ولی" aria-label="تماس با ولی" className={`${big ? 'w-9 h-9' : 'w-8 h-8'} shrink-0 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition flex items-center justify-center`}>
          <PhoneCall className="w-4 h-4" />
        </a>
        <span dir="ltr" className="font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">{phoneFmt(p)}</span>
      </span>
    );
  };

  const ReportButton = ({ it }: { it: FollowUpTableItem }) => (
    <button type="button" onClick={() => onOpenReportCard(it.student)} className="!min-h-0 h-8 px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-white rounded-lg text-[11px] font-bold whitespace-nowrap inline-flex items-center gap-1 cursor-pointer">
      <FileText className="w-3.5 h-3.5" /> کارنامه
    </button>
  );

  /** عملیات سطر در دسکتاپ: یادداشت، لیست خاکستری، تماس و کارنامه به‌صورت دکمه‌های آیکونی کنار هم */
  const RowActions = ({ it }: { it: FollowUpTableItem }) => {
    const has = Boolean(it.followRecord?.note);
    const greyId = greySentId(it.student);
    const phone = parentPhoneOf(it.student);
    const iconBtn = 'relative !min-h-0 w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center transition cursor-pointer';
    return (
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => openNote(it)} title={has ? 'نمایش یادداشت' : 'ثبت یادداشت'} aria-label={has ? 'نمایش یادداشت' : 'ثبت یادداشت'}
          className={`${iconBtn} ${has ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-400 hover:text-emerald-700'}`}>
          {has ? <MessageSquareText className="w-4 h-4" /> : <PencilLine className="w-4 h-4" />}
          {has && <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-sky-500 border-2 border-white" />}
        </button>
        {greyId ? (
          <span className="inline-flex items-center gap-1 h-9 rounded-xl border border-emerald-200 bg-emerald-50 pr-2.5 pl-1 text-[11px] font-extrabold text-emerald-800 whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5" />
            لیست خاکستری
            <button type="button" onClick={() => onWithdrawGrey(greyId)} title="برگرداندن از لیست خاکستری" aria-label="برگرداندن از لیست خاکستری" className="!min-h-0 w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-100 flex items-center justify-center cursor-pointer">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => onSendGrey(it)} title="ارسال به لیست خاکستری" aria-label="ارسال به لیست خاکستری"
            className={`${iconBtn} border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50`}>
            <ListPlus className="w-4 h-4" />
          </button>
        )}
        {phone ? (
          <a href={`tel:${phone}`} title={`تماس با ولی: ${phoneFmt(phone)}`} aria-label="تماس با ولی" className={`${iconBtn} border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700`}>
            <PhoneCall className="w-4 h-4" />
          </a>
        ) : (
          <span title="شماره‌ای ثبت نشده" className={`${iconBtn} border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed`}><PhoneCall className="w-4 h-4" /></span>
        )}
        <button type="button" onClick={() => onOpenReportCard(it.student)} title="کارنامه" aria-label="کارنامه" className={`${iconBtn} border-slate-200 bg-slate-900 text-white hover:bg-slate-700`}>
          <FileText className="w-4 h-4" />
        </button>
      </div>
    );
  };

  if (items.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">موردی برای پیگیری یافت نشد.</div>;
  }

  return (
    <>
      {/* دسکتاپ و تبلت */}
      <div className="hidden md:block overflow-x-auto scroll-smooth rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[900px] w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold">
              <th className="px-3 py-2.5 w-12 text-center">ردیف</th>
              <th className="px-3 py-2.5">دانش‌آموز</th>
              <th className="px-3 py-2.5 text-center w-24">معدل کل</th>
              <th className="px-3 py-2.5">علت پیگیری</th>
              <th className="px-3 py-2.5 w-36">وضعیت</th>
              <th className="px-3 py-2.5 w-[15rem]">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it, idx) => {
              const [pl, pc] = priorityBadge(it.priority);
              return (
                <tr key={it.student.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-3 py-2.5 text-center align-middle text-slate-400">{toPersianDigits(idx + 1)}</td>
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 shrink-0 rounded-full bg-emerald-100 text-emerald-700 text-xs font-extrabold flex items-center justify-center">{initials(studentFullName(it.student))}</span>
                      <div className="min-w-0">
                        <button type="button" onClick={() => onOpenReportCard(it.student)} className="!min-h-0 block font-bold text-slate-900 text-sm hover:text-emerald-700 cursor-pointer whitespace-nowrap">{studentFullName(it.student)}</button>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 whitespace-nowrap">
                          <span>کلاس {it.className}</span>
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${pc}`}>{pl} • {toPersianDigits(it.priority)} مورد</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center align-middle">
                    <span className={`inline-block px-3 py-1 rounded-lg border font-extrabold text-sm ${gpaTone(it.gpa)}`}>{it.gpa !== undefined ? toPersianDigits(it.gpa) : '—'}</span>
                  </td>
                  <td className="px-3 py-2.5 align-middle max-w-[26rem]"><Reasons it={it} /></td>
                  <td className="px-3 py-2.5 align-middle"><StatusSelect it={it} /></td>
                  <td className="px-3 py-2.5 align-middle"><RowActions it={it} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* موبایل: کارت */}
      <div className="md:hidden space-y-3">
        {items.map((it) => {
          const [pl, pc] = priorityBadge(it.priority);
          return (
            <article key={it.student.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <header className="flex items-start gap-3">
                <span className="w-11 h-11 shrink-0 rounded-full bg-emerald-100 text-emerald-700 text-sm font-extrabold flex items-center justify-center">{initials(studentFullName(it.student))}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900">{studentFullName(it.student)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>کلاس {it.className}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${pc}`}>{pl} • {toPersianDigits(it.priority)} مورد</span>
                  </div>
                </div>
                <span className={`shrink-0 px-3 py-1 rounded-full border font-extrabold text-sm ${gpaTone(it.gpa)}`}>{it.gpa !== undefined ? toPersianDigits(it.gpa) : '—'}</span>
              </header>
              <div className="mt-3"><Reasons it={it} /></div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <StatusSelect it={it} />
                <NoteButton it={it} />
              </div>
              <div className="mt-3"><GreyButton it={it} /></div>
              <footer className="mt-3 flex items-center justify-between gap-2">
                <Phone s={it.student} big />
                <ReportButton it={it} />
              </footer>
            </article>
          );
        })}
      </div>

      <Modal isOpen={noteFor !== null} onClose={() => setNoteFor(null)} title="یادداشت پیگیری" subtitle={noteFor ? studentFullName(noteFor.student) : ''} size="md">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          rows={5}
          placeholder="یادداشت پیگیری را بنویسید…"
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
        />
        {noteFor?.followRecord?.updatedBy && <div className="text-[10px] text-slate-400">آخرین ویرایش: {noteFor.followRecord.updatedBy}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setNoteFor(null)} className="h-10 px-4 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 cursor-pointer">انصراف</button>
          <button type="button" onClick={saveNote} className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer">ذخیره</button>
        </div>
      </Modal>
    </>
  );
};
