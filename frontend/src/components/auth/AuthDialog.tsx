import type { ReactNode } from 'react';
import ModalFrame from '../ui/ModalFrame';

interface AuthDialogProps {
  isOpen: boolean;
  mode: 'login' | 'register';
  onClose: () => void;
  children: ReactNode;
}

const modeLabels = {
  login: '登录',
  register: '注册',
} as const;

export default function AuthDialog({ isOpen, mode, onClose, children }: AuthDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <ModalFrame onClose={onClose}>
      <div data-auth-mode={mode} aria-label={`${modeLabels[mode]}对话框`}>
        {children}
      </div>
    </ModalFrame>
  );
}
