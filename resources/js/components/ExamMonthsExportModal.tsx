import React, { useMemo, useRef, useState } from 'react';
import { X, Check, FileText, FileType2, Loader2 } from 'lucide-react';
import { ComprehensiveExamRecord, Student } from '../types';
import { examMonthsWithData, examMonthLabel, ExamMonth } from '../utils/examReport';
import { buildExamMonthSection } from '../utils/examMonthsReport';
import { exportExamDocx, exportSheetsPdf } from '../utils/examSheetExport';
import { toPersianDigits } from '../utils/persianDate';

type Month = Exclude<ExamMonth, 'all'>;
const TONE: Record<string, string> = { good: '#047857', ok: '#0369a1', mid: '#b45309', bad: '#be123c', none: '#94a3b8' };

interface Props {
  className: string;
  record: ComprehensiveExamRecord | undefined;
  students: Student[];
  initialMonth: Month;
  hasUnsaved: boolean;
  onClose: () => void;
  onDone: (msg: string, type: 'success' | 'error') => void;
}

/** انتخاب ماه‌های دلخواه و گرفتن PDF یا Word (جدول قابل ویرایش) از نمرات و تحلیل هر ماه */
export const ExamMonthsExportModal: React.FC<Props> = ({ className, record, students, initialMonth, hasUnsaved, onClose, onDone }) => {
  const available = useMemo(() => examMonthsWithData(record), [record]);
  const [picked, setPicked] = useState<Month[]>(() => (available.includes(initialMonth) ? [initialMonth] : available.slice(0, 1)));
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null);
  const sheetRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const sections = useMemo(
    () => available.filter((m) => picked.includes(m)).map((m) => buildExamMonthSection(record, students, m)),
    [available, picked, record, students]
  );
  const toggle = (m: Month) => setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  const baseName = `آزمون-جامع-${className}`.replace(/\s+/g, '-');

  const run = async (format: 'pdf' | 'docx') => {
    if (!sections.length || busy) return;
    setBusy(format);
    try {
      if (format === 'docx') {
        await exportExamDocx(
          sections.map((s) => ({ title: s.title, className, summary: s.analysis, head: s.head, rows: s.rows, landscape: s.landscape })),
          baseName
        );
      } else {
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        const items = sections.map((s) => ({ node: sheetRefs.current[s.month]!, landscape: s.landscape }));
        await exportSheetsPdf(items, baseName);
      }
      onDone('خروجی آماده و دانلود شد.', 'success');
      onClose();
    } catch {
      onDone('ساخت خروجی انجام نشد. دوباره تلاش کنید.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={onClose} dir="rtl">
      <div role="dialog" aria-modal="true" aria-label="خروجی ماه‌های آزمون جامع" className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 className="flex-1 text-base font-extrabold text-slate-900">خروجی ماه‌های آزمون جامع</h2>
          <button type="button" onClick={onClose} aria-label="بستن" className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-500">ماه‌های دلخواه را انتخاب کنید؛ نمرات و تحلیل هر ماه در یک بخش جداگانه می‌آید.</p>

        {available.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400">برای این کلاس هنوز نمره‌ای ثبت نشده است.</div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-500">{toPersianDigits(picked.length)} ماه انتخاب شده</span>
              <button type="button" onClick={() => setPicked(picked.length === available.length ? [] : [...available])} className="text-emerald-700 cursor-pointer min-h-9">
                {picked.length === available.length ? 'لغو همه' : 'انتخاب همه'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {available.map((m) => {
                const on = picked.includes(m);
                return (
                  <button key={m} type="button" aria-pressed={on} onClick={() => toggle(m)} className={`min-h-12 px-3 rounded-2xl border text-sm font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'}`}>
                    {on && <Check className="w-4 h-4" />}
                    {examMonthLabel(m)}
                  </button>
                );
              })}
            </div>
            {hasUnsaved && <p className="text-[11px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2">خروجی از نمرات ذخیره‌شده ساخته می‌شود؛ تغییرات ذخیره‌نشده‌ی صفحه در آن نیست.</p>}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" disabled={!picked.length || Boolean(busy)} onClick={() => run('pdf')} className="min-h-12 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed">
                {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
              </button>
              <button type="button" disabled={!picked.length || Boolean(busy)} onClick={() => run('docx')} className="min-h-12 rounded-2xl bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 border border-slate-200 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed">
                {busy === 'docx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileType2 className="w-4 h-4" />} Word (قابل ویرایش)
              </button>
            </div>
          </>
        )}
      </div>

      {/* برگه‌های ثابت PDF (بیرون از دید): فقط هنگام ساخت PDF لازم‌اند */}
      {busy === 'pdf' && (
        <div aria-hidden="true" style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }}>
          {sections.map((s) => (
            <div key={s.month} ref={(el) => { sheetRefs.current[s.month] = el; }} dir="rtl" style={{ width: s.landscape ? 1400 : 1000, background: '#fff', padding: 32, fontFamily: "'Vazirmatn', sans-serif", color: '#0f172a', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #047857', paddingBottom: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#047857' }}>دبیرستان دوره اول یاوران ولایت</div>
                  <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{s.title}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', textAlign: 'left' }}>
                  <div>کلاس: {className}</div>
                  <div>تعداد دانش‌آموز: {toPersianDigits(s.rows.length)}</div>
                </div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, fontWeight: 600, lineHeight: 2, color: '#334155' }}>
                {s.analysis.map((l, i) => <div key={i}>{l}</div>)}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: '#047857', color: '#fff' }}>
                    {s.head.map((h, i) => <th key={i} style={{ padding: '10px 6px', border: '1px solid #cbd5e1', textAlign: i === 1 ? 'right' : 'center' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, ri) => (
                    <tr key={ri} style={{ background: ri % 2 ? '#f8fafc' : '#fff' }}>
                      {r.cells.map((c, i) => (
                        <td key={i} style={{ padding: '8px 6px', border: '1px solid #e2e8f0', textAlign: i === 1 ? 'right' : 'center', fontWeight: i === 0 ? 400 : 800, whiteSpace: 'nowrap', color: i > 1 && i < r.cells.length - 2 ? TONE[r.tone] : i === 0 ? '#64748b' : undefined }}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, fontSize: 11, color: '#64748b' }}>سامانه یاوران</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
