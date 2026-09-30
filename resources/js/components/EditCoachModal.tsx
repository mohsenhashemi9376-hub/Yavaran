import React from 'react';
import { User } from '../types';
import { CoachFormModal } from './CoachFormModal';

interface EditCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  coach: User | null;
}

export const EditCoachModal: React.FC<EditCoachModalProps> = ({ isOpen, onClose, coach }) => {
  return <CoachFormModal isOpen={isOpen} onClose={onClose} coach={coach} />;
};
