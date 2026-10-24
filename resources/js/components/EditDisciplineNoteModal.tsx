import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { DisciplinaryNote, Student } from '../types';
import { toEnglishDigits, toPersianDigits } from '../utils/persianDate';
import { studentFullName } from '../utils/studentName';
import { Modal } from './ui/Modal';

const TYPES: { value: DisciplinaryNote['type']; label: string }[] = [
  { value: 'delay', label: 'تأخیر مکرر' },
  { value: 'absence', label: 'غیبت غیرموجه' },
  { value: 'behavior', label: 'انضباط رفتاری' },
  { value: 'uniform', label: 'پوشش و آراستگی' },
  { value: 'other', label: 'سایر' },
];

interface Props {
  student: Student | null;
  note: DisciplinaryNote | null;
  onClose: () => void;
}

/** ویرایش مورد انضباطی ثبت‌شده توسط معاون انضباطی (عنوان، شرح، تاریخ، نوع و نمره‌ی کسرشده) */
export const EditDisciplineNoteModal: React.FC<Props> = ({ student, note, onClose }) => {
  const { updateDisciplinaryNote } = useSchool();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<DisciplinaryNote['type']>('other');
  const [deduction, setDeduction] = useState('0');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!note) return;
    setTitle(note.title || '');
    setDescription(note.description || '');
    setDate(toEnglishDigits(note.date || ''));
    setType(note.type || 'other');
    setDeduction(String(note.scoreDeduction || 0));
    setError('');
  }, [note]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !note) return;
    const value = Number(toEnglishDigits(deduction).replace('٫', '.'));
    if (!title.trim()) return setError('عنوان مورد انضباطی را وارد کنید.');
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date)) return setError('تاریخ را مثل ۱۴۰۵/۰۷/۲۰ وارد کنید.');
    if (Number.isNaN(value) || value < 0 || value > 20) return setError('نمره‌ی کسرشده باید بین ۰ تا ۲۰ باشد.');
    if (updateDisciplinaryNote(student.id, note.id, { title: title.trim(), description: description.trim(), date, type, scoreDeduction: value })) onClose();
  };

  const field = 'w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600';

  return (
    <Modal
      isOpen={Boolean(note && student)}
      onClose={onClose}
      title="ویرایش مورد انضباطی"
      subtitle={student ? studentFullName(student) : ''}
      size="md"
      footer={
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="h-11 px-4 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold cursor-pointer">انصراف</button>
          <button type="submit" form="edit-discipline-form" className="h-11 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer">
            <Save className="w-4 h-4" /> ذخیره تغییرات
          </button>
        </div>
      }
    >
      <form id="edit-discipline-form" onSubmit={submit} className="space-y-3" dir="rtl">
        {error && <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-2.5">{error}</div>}
        <label className="block text-xs font-bold text-slate-700 space-y-1">عنوان
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
        </label>
        <label className="block text-xs font-bold text-slate-700 space-y-1">شرح
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-600 resize-none" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold text-slate-700 space-y-1">تاریخ
            <input value={toPersianDigits(date)} onChange={(e) => setDate(toEnglishDigits(e.target.value))} dir="ltr" className={`${field} text-center`} />
          </label>
          <label className="block text-xs font-bold text-slate-700 space-y-1">نمره‌ی کسرشده
            <input value={toPersianDigits(deduction)} onChange={(e) => setDeduction(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''))} inputMode="decimal" dir="ltr" className={`${field} text-center`} />
          </label>
        </div>
        <label className="block text-xs font-bold text-slate-700 space-y-1">نوع
          <select value={type} onChange={(e) => setType(e.target.value as DisciplinaryNote['type'])} className={field}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <p className="text-[11px] text-slate-500 leading-5">با تغییر نمره‌ی کسرشده، نمره‌ی انضباط دانش‌آموز به‌اندازه‌ی اختلاف اصلاح می‌شود.</p>
      </form>
    </Modal>
  );
};
