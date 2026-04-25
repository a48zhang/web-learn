import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
      <motion.div
        layout
        className="overflow-hidden w-full max-w-md mx-auto"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            data-auth-mode={mode}
            initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </ModalFrame>
  );
}
