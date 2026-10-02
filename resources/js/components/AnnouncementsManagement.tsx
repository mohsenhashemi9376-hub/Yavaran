import React, { useState } from 'react';
import { useSchool } from '../context/SchoolContext';
import { SchoolAnnouncement } from '../types';
import { getTodayShamsi, toPersianDigits } from '../utils/persianDate';
import {
  Bell, Plus, Pencil, Trash2, Archive, ArchiveRestore, Paperclip, X, ArrowRight, Menu, Eye, Send,
} from 'lucide-react';

interface Props {
  onBack: () => void;
  onOpenSidebar: () => void;
}

const PRIORITY_LABEL = { normal: 'عادی', important: 'مهم', urgent: 'فوری' } as const;
const PRIORITY_CLASS = {
  normal: 'bg-sky-50 text-sky-800 border-sky-200',
  important: 'bg-amber-50 text-amber-800 border-amber-200',
  urgent: 'bg-rose-50 text-rose-800 border-rose-200',
} as const;
const MAX_ATTACHMENT_BYTES = 700 * 1024;

const fieldClass =
  'w-full text-sm bg-slate-50 rounded-2xl px-4 py-3 text-slate-900 outline-none border border-transparent focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100 transition';

const emptyForm = () => ({
  title: '',
  content: '',
  priority: 'normal' as SchoolAnnouncement['priority'],
  date: getTodayShamsi().formattedDate,
  attachments: [] as NonNullable<SchoolAnnouncement['attachments']>,
});

/** مدیریت بخشنامه‌ها و اطلاعیه‌ها — ویژه معاون آموزش و مدیر مدرسه */
export const AnnouncementsManagement: React.FC<Props> = ({ onBack, onOpenSidebar }) => {
  const {
    schoolAnnouncements,
    addSchoolAnnouncement,
    updateSchoolAnnouncement,
    deleteSchoolAnnouncement,
    currentUser,
    showToast,
    showConfirm,
  } = useSchool();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [viewing, setViewing] = useState<SchoolAnnouncement | null>(null);
  const [error, setError] = useState('');

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setIsFormOpen(true);
  };

  const openEdit = (a: SchoolAnnouncement) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      content: a.content,
      priority: a.priority,
      date: a.date,
      attachments: a.attachments || [],
    });
    setError('');
    setIsFormOpen(true);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        showToast('پیوست بزرگ است', `حجم «${file.name}» از ۷۰۰ کیلوبایت بیشتر است.`, 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setForm((f) => ({
          ...f,
          attachments: [...f.attachments, { name: file.name, type: file.type, dataUrl: String(reader.result) }],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError('عنوان و متن بخشنامه الزامی است.');
      return;
    }
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      priority: form.priority,
      date: form.date,
      attachments: form.attachments,
    };
    if (editingId) {
      updateSchoolAnnouncement(editingId, payload);
      showToast('ویرایش موفق', 'بخشنامه به‌روزرسانی شد.', 'success');
    } else {
      addSchoolAnnouncement({
        ...payload,
        status: 'active',
        category: 'educational',
        targetRole: 'everyone',
        authorName: `${currentUser.name} (${currentUser.roleTitle})`,
      });
      showToast('ثبت موفق', 'بخشنامه برای کادر مدرسه ابلاغ شد.', 'success');
    }
    setIsFormOpen(false);
  };

  const remove = (a: SchoolAnnouncement) =>
    showConfirm({
      title: 'حذف بخشنامه؟',
      message: `بخشنامه «${a.title}» برای همیشه حذف می‌شود.`,
      confirmLabel: 'بله، حذف شود',
      cancelLabel: 'انصراف',
      isDangerous: true,
      onConfirm: () => deleteSchoolAnnouncement(a.id),
    });

  return (
    <div className="space-y-5 font-['Vazirmatn',sans-serif]" dir="rtl">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200 cursor-pointer"
          aria-label="بازگشت"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-extrabold text-slate-900 flex-1">بخشنامه‌ها و اطلاعیه‌ها</h1>
        <button
          onClick={onOpenSidebar}
          className="lg:hidden h-10 px-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-bold flex items-center gap-1.5 border border-slate-200 cursor-pointer"
        >
          <Menu className="w-4 h-4" />
          <span>منو</span>
        </button>
        <button
          onClick={openNew}
          className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-extrabold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت بخشنامه جدید</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {schoolAnnouncements.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <Bell className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm font-bold text-slate-600">هنوز بخشنامه‌ای ثبت نشده است.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-emerald-50/60 text-emerald-900 font-bold border-b border-emerald-100">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">عنوان</th>
                  <th className="p-3.5 whitespace-nowrap">فوریت</th>
                  <th className="p-3.5 whitespace-nowrap">تاریخ</th>
                  <th className="p-3.5 whitespace-nowrap">وضعیت</th>
                  <th className="p-3.5 whitespace-nowrap text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schoolAnnouncements.map((a) => {
                  const archived = a.status === 'archived';
                  return (
                    <tr key={a.id} className={`hover:bg-slate-50/70 transition-colors ${archived ? 'opacity-60' : ''}`}>
                      <td className="p-3.5 font-bold text-slate-900 max-w-xs">
                        <div className="truncate">{a.title}</div>
                        {a.attachments && a.attachments.length > 0 && (
                          <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1 mt-0.5">
                            <Paperclip className="w-3 h-3" />
                            {toPersianDigits(a.attachments.length)} پیوست
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${PRIORITY_CLASS[a.priority]}`}>
                          {PRIORITY_LABEL[a.priority]}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">{toPersianDigits(a.date)}</td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                            archived
                              ? 'bg-slate-50 text-slate-600 border-slate-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {archived ? 'آرشیو' : 'فعال'}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => setViewing(a)} title="مشاهده" aria-label="مشاهده" className="p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => openEdit(a)} title="ویرایش" aria-label="ویرایش" className="p-2 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"><Pencil className="w-4 h-4" /></button>
                          <button
                            onClick={() => updateSchoolAnnouncement(a.id, { status: archived ? 'active' : 'archived' })}
                            title={archived ? 'فعال‌سازی' : 'آرشیو'}
                            aria-label={archived ? 'فعال‌سازی' : 'آرشیو'}
                            className="p-2 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                          >
                            {archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                          </button>
                          <button onClick={() => remove(a)} title="حذف" aria-label="حذف" className="p-2 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && setViewing(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-extrabold text-slate-900">{viewing.title}</h3>
              <button onClick={() => setViewing(null)} aria-label="بستن" className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-700 leading-7 whitespace-pre-line">{viewing.content}</p>
            {(viewing.attachments || []).map((f, i) => (
              <a key={i} href={f.dataUrl} download={f.name} className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2">
                <Paperclip className="w-3.5 h-3.5" />
                <span className="truncate">{f.name}</span>
              </a>
            ))}
            <div className="text-[11px] text-slate-400">{viewing.authorName || viewing.author} • {toPersianDigits(viewing.date)}</div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && setIsFormOpen(false)}>
          <form onSubmit={submit} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">{editingId ? 'ویرایش بخشنامه' : 'ثبت بخشنامه جدید'}</h3>
              <button type="button" onClick={() => setIsFormOpen(false)} aria-label="بستن" className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            {error && <div role="alert" className="text-xs font-bold text-rose-700 bg-rose-50 rounded-xl p-3">{error}</div>}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">عنوان</label>
              <input className={fieldClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">متن کامل بخشنامه</label>
              <textarea rows={5} className={fieldClass} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">فوریت</label>
                <select className={fieldClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as SchoolAnnouncement['priority'] })}>
                  <option value="normal">عادی</option>
                  <option value="important">مهم</option>
                  <option value="urgent">فوری</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">تاریخ</label>
                <input className={fieldClass} dir="ltr" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} placeholder="1404/08/20" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">پیوست فایل (حداکثر ۷۰۰ کیلوبایت)</label>
              <input type="file" multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} className="text-xs" />
              <ul className="mt-2 space-y-1">
                {form.attachments.map((f, i) => (
                  <li key={i} className="flex items-center justify-between text-xs bg-slate-50 rounded-xl px-3 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" aria-label="حذف پیوست" onClick={() => setForm({ ...form, attachments: form.attachments.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            </div>
            <button type="submit" className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer">
              <Send className="w-4 h-4" />
              <span>{editingId ? 'ذخیره تغییرات' : 'ثبت و ابلاغ'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
