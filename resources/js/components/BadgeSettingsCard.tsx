import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, Trophy } from 'lucide-react';
import { useBadgeSettings, saveBadgeSettings } from '../lib/badgeSettingsStore';
import { BadgeSettings, DEFAULT_BADGE_SETTINGS } from '../utils/studentBadges';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';

const input = 'min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 text-center outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200';

const Field: React.FC<{ label: string; hint?: string; value: string; onChange: (v: string) => void; mode?: 'numeric' | 'decimal' | 'text'; dir?: 'ltr' }> = ({ label, hint, value, onChange, mode = 'numeric', dir }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold text-slate-600">{label}</span>
    <input type="text" inputMode={mode} dir={dir} value={value} onChange={(e) => onChange(toEnglishDigits(e.target.value))} className={input} />
    {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
  </label>
);

/** ویرایش شرایط نشان‌های «ممتاز انضباطی» و «ممتاز آموزشی» (فقط مدیر مدرسه؛ سرور هم بررسی می‌کند) */
export const BadgeSettingsCard: React.FC = () => {
  const current = useBadgeSettings();
  const [f, setF] = useState({ windowDays: '', maxNotes: '', maxAbs: '', maxLates: '', lateAfter: '', minScore: '', maxWs: '', maxHw: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setF({
      windowDays: String(current.windowDays), maxNotes: String(current.discipline.maxNotes), maxAbs: String(current.discipline.maxUnexcusedAbsences),
      maxLates: String(current.discipline.maxLates), lateAfter: current.discipline.lateAfter, minScore: String(current.academic.minScore),
      maxWs: String(current.academic.maxMissedWorksheets), maxHw: String(current.academic.maxMissedHomework),
    });
  }, [current]);

  const set = (k: keyof typeof f) => (v: string) => { setF((p) => ({ ...p, [k]: v })); setMsg(null); };

  const toSettings = (): BadgeSettings => ({
    windowDays: Number(f.windowDays),
    discipline: { maxNotes: Number(f.maxNotes), maxUnexcusedAbsences: Number(f.maxAbs), maxLates: Number(f.maxLates), lateAfter: f.lateAfter.trim() },
    academic: { minScore: Number(f.minScore), maxMissedWorksheets: Number(f.maxWs), maxMissedHomework: Number(f.maxHw) },
  });

  const save = async () => {
    setSaving(true);
    try {
      await saveBadgeSettings(toSettings());
      setMsg({ ok: true, text: 'شرایط نشان‌ها ذخیره شد.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'ذخیره انجام نشد.' });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    const d = DEFAULT_BADGE_SETTINGS;
    setF({ windowDays: String(d.windowDays), maxNotes: String(d.discipline.maxNotes), maxAbs: String(d.discipline.maxUnexcusedAbsences), maxLates: String(d.discipline.maxLates), lateAfter: d.discipline.lateAfter, minScore: String(d.academic.minScore), maxWs: String(d.academic.maxMissedWorksheets), maxHw: String(d.academic.maxMissedHomework) });
    setMsg(null);
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-5" aria-label="شرایط نشان‌های افتخار">
      <div>
        <h3 className="text-base font-extrabold text-slate-900">شرایط نشان‌های افتخار دانش‌آموز</h3>
        <p className="mt-1 text-xs leading-6 text-slate-500">تغییر این مقادیر بلافاصله روی نشان‌های همهٔ دانش‌آموزان اعمال می‌شود. صفر یعنی هیچ مورد مجاز نیست.</p>
      </div>

      <Field label="بازهٔ ارزیابی (روز گذشته)" value={f.windowDays} onChange={set('windowDays')} hint={`فعلاً ${toPersianDigits(current.windowDays)} روز`} />

      <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-teal-800"><ShieldCheck className="w-4 h-4" /> 🛡️ ممتاز انضباطی</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="حداکثر مورد انضباطی" value={f.maxNotes} onChange={set('maxNotes')} />
          <Field label="حداکثر غیبت غیرموجه" value={f.maxAbs} onChange={set('maxAbs')} />
          <Field label="حداکثر تأخیر" value={f.maxLates} onChange={set('maxLates')} />
          <Field label="تأخیر یعنی ورود بعد از" value={f.lateAfter} onChange={set('lateAfter')} mode="text" dir="ltr" hint="مثل 07:15" />
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-amber-800"><Trophy className="w-4 h-4" /> 🏆 ممتاز آموزشی</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="نمرهٔ هر درس بالاتر از" value={f.minScore} onChange={set('minScore')} mode="decimal" hint="از ۲۰" />
          <Field label="حداکثر کاربرگ تحویل‌نشده" value={f.maxWs} onChange={set('maxWs')} />
          <Field label="حداکثر تکلیف انجام‌نشده" value={f.maxHw} onChange={set('maxHw')} />
        </div>
      </div>

      {msg && (
        <p className={`flex items-center gap-1.5 text-xs font-bold ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
          {msg.ok && <CheckCircle2 className="w-4 h-4" />}
          {msg.text}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={reset} className="min-h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-extrabold text-slate-700 cursor-pointer">مقادیر پیش‌فرض</button>
        <button type="button" onClick={() => void save()} disabled={saving} className="min-h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-sm font-extrabold text-white cursor-pointer disabled:opacity-50">{saving ? 'در حال ذخیره…' : 'ذخیره شرایط'}</button>
      </div>
    </section>
  );
};
