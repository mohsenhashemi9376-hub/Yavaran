import React from 'react';
import { CoachFormModal } from './CoachFormModal';

interface AddCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddCoachModal: React.FC<AddCoachModalProps> = ({ isOpen, onClose }) => {
  return <CoachFormModal isOpen={isOpen} onClose={onClose} coach={null} />;
};
