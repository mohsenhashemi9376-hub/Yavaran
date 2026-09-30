import React from 'react';
import { TeacherFormModal } from './TeacherFormModal';

interface AddTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddTeacherModal: React.FC<AddTeacherModalProps> = ({ isOpen, onClose }) => {
  return <TeacherFormModal isOpen={isOpen} onClose={onClose} teacher={null} />;
};
