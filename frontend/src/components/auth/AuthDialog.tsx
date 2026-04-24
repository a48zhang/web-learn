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
    <ModalFrame onClose={onClose} ariaLabel={`${modeLabels[mode]}对话框`}>
      <div data-auth-mode={mode}>
        {children}
      </div>
    </ModalFrame>
  );
}
