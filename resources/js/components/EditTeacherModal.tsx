import React from 'react';
import { User } from '../types';
import { TeacherFormModal } from './TeacherFormModal';

interface EditTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: User | null;
}

export const EditTeacherModal: React.FC<EditTeacherModalProps> = ({ isOpen, onClose, teacher }) => {
  return <TeacherFormModal isOpen={isOpen} onClose={onClose} teacher={teacher} />;
};
