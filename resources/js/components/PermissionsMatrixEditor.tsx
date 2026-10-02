import React from 'react';
import { PERMISSION_GROUPS } from '../utils/permissions';
import { ShieldCheck } from 'lucide-react';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  onResetToRoleDefault?: () => void;
  disabled?: boolean;
}

/** سطوح دسترسی به بخش‌های سامانه؛ کارت‌های گروه‌بندی‌شده با سوئیچ */
export const PermissionsMatrixEditor: React.FC<Props> = ({ value, onChange, onResetToRoleDefault, disabled }) => {
  const set = new Set(value);

  const toggle = (key: string) => {
    if (disabled) return;
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  const setGroup = (keys: string[], on: boolean) => {
    if (disabled) return;
    const next = new Set(set);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    onChange(Array.from(next));
  };

  return (
    <section className="space-y-3 pt-4 border-t border-slate-100" aria-label="سطوح دسترسی به بخش‌های سامانه">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-teal-800" />
          سطوح دسترسی به بخش‌های سامانه
        </h4>
        {onResetToRoleDefault && !disabled && (
          <button
            type="button"
            onClick={onResetToRoleDefault}
            className="text-[11px] font-bold text-slate-500 hover:text-teal-800 cursor-pointer"
          >
            بازگشت به پیش‌فرض نقش
          </button>
        )}
      </div>

      {PERMISSION_GROUPS.map((group) => {
        const keys = group.items.map((i) => i.key);
        const allOn = keys.every((k) => set.has(k));
        return (
          <div key={group.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-800">{group.label}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setGroup(keys, !allOn)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer disabled:opacity-50"
              >
                {allOn ? 'لغو همه' : 'انتخاب همه'}
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {group.items.map((item) => {
                const on = set.has(item.key);
                return (
                  <li key={item.key} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-xs text-slate-700">{item.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={item.label}
                      disabled={disabled}
                      onClick={() => toggle(item.key)}
                      dir="ltr"
                      className={`relative w-10 h-6 rounded-full transition shrink-0 cursor-pointer disabled:opacity-50 ${
                        on ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          on ? 'translate-x-4' : ''
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
};
