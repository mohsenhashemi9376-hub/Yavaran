import React from 'react';
import { SchoolClass, Student, AttendanceSession } from '../types';
import { ClassProfileView } from './ClassProfileView';

interface ClassDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  classData: SchoolClass | null;
  onOpenNewAttendance: (classId: string) => void;
  onSelectStudent?: (student: Student) => void;
  onOpenAcademicGrades?: (classId: string) => void;
  onOpenMonthlySummary?: (classId: string) => void;
  onEditSession?: (session: AttendanceSession) => void;
}

export const ClassDetailModal: React.FC<ClassDetailModalProps> = ({
  isOpen,
  onClose,
  classData,
  onOpenNewAttendance,
  onSelectStudent,
  onOpenAcademicGrades,
  onOpenMonthlySummary,
  onEditSession,
}) => {
  if (!isOpen || !classData) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 overflow-y-auto" dir="rtl">
      <div className="bg-slate-100 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto border border-slate-200 animate-in fade-in zoom-in-95 p-3 sm:p-5">
        <ClassProfileView
          classData={classData}
          onClose={onClose}
          onOpenNewAttendance={onOpenNewAttendance}
          onSelectStudent={onSelectStudent}
          onOpenAcademicGrades={onOpenAcademicGrades}
          onOpenMonthlySummary={onOpenMonthlySummary}
          onEditSession={onEditSession}
          isModal={true}
        />
      </div>
    </div>
  );
};
