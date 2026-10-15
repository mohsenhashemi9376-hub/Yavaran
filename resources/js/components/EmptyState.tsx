import React from 'react';
import { Inbox } from 'lucide-react';

interface Props {
  title: string;
  /** علت خالی بودن و کار بعدی */
  hint?: string;
  /** هم‌معنی hint */
  description?: string;
  /** آیکون اختیاری (پیش‌فرض: صندوق خالی) */
  icon?: React.ElementType;
  actionLabel?: string;
  onAction?: () => void;
}

/** حالت خالی توضیحی: چرا چیزی نمایش داده نمی‌شود و کاربر بعد از آن چه کند */
export const EmptyState: React.FC<Props> = ({ title, hint, description, icon: Icon = Inbox, actionLabel, onAction }) => (
  <div className="text-center py-12 px-4 space-y-2" role="note">
    <Icon className="w-8 h-8 text-slate-300 mx-auto" />
    <div className="text-sm font-bold text-slate-600">{title}</div>
    {(hint || description) && <p className="text-xs text-slate-400 leading-6 max-w-sm mx-auto">{hint || description}</p>}
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-1 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
