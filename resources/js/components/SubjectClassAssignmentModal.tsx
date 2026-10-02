import React from 'react';
import { useSchool } from '../context/SchoolContext';
import { AcademicSubject } from '../types';
import { subjectAppliesToClass } from '../utils/courseAssignments';
import { getStandardRoleTitle } from '../utils/userRoles';
import { X } from 'lucide-react';

interface Props {
  subject: AcademicSubject;
  onClose: () => void;
}

const fieldClass =
  'w-full text-sm bg-slate-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-emerald-500 focus:bg-white font-bold text-slate-700 cursor-pointer';

/** انتساب سه‌طرفه: برای هر کلاس، استاد همین درس را مشخص می‌کند (مستقل از مربی کلاس) */
export const SubjectClassAssignmentModal: React.FC<Props> = ({ subject, onClose }) => {
  const { classes, assignableStaff, getCourseTeacherId, assignCourseTeacher, showToast } = useSchool();
  const targetClasses = classes.filter((c) => subjectAppliesToClass(subject, c));

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg font-['Vazirmatn',sans-serif]">
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">استاد درس «{subject.name}» در هر کلاس</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-6 pt-2 space-y-3 max-h-[70vh] overflow-y-auto">
          {targetClasses.length === 0 && (
            <p className="text-sm text-slate-500 py-6 text-center">کلاسی برای پایه‌های این درس تعریف نشده است.</p>
          )}
          {targetClasses.map((cls) => (
            <div key={cls.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white border border-slate-100 rounded-2xl p-3">
              <div className="sm:w-40 shrink-0">
                <div className="font-bold text-sm text-slate-900">{cls.name}</div>
                <div className="text-[11px] text-slate-400">{cls.grade}</div>
              </div>
              <select
                className={fieldClass}
                value={getCourseTeacherId(cls.id, subject.id) || ''}
                aria-label={`استاد ${subject.name} در ${cls.name}`}
                onChange={(e) => {
                  assignCourseTeacher(cls.id, subject.id, e.target.value || null);
                  if (e.target.value) showToast('انتساب ذخیره شد.', 'success');
                }}
              >
                <option value="">استاد تعیین نشده</option>
                {assignableStaff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({getStandardRoleTitle(u.role)})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
